import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const adminClient = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Method not allowed." }, 405);
  if (!supabaseUrl || !serviceKey) return reply({ error: "Server configuration is incomplete." }, 500);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return reply({ error: "Sign in as Main Admin first." }, 401);

  const { data: authData, error: authError } = await adminClient.auth.getUser(token);
  const actor = authData?.user;
  if (authError || !actor) return reply({ error: "Your session is invalid. Sign in again." }, 401);

  const { data: setting, error: settingError } = await adminClient
    .from("portal_admin_settings")
    .select("main_admin_user_id")
    .eq("singleton", true)
    .maybeSingle();
  if (settingError || setting?.main_admin_user_id !== actor.id) {
    return reply({ error: "Only the designated Main Admin can manage administrator accounts." }, 403);
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return reply({ error: "Invalid request body." }, 400); }
  const action = String(body.action ?? "");

  if (action === "assign_existing") {
    const email = String(body.email ?? "").trim().toLowerCase();
    const displayNameInput = String(body.display_name ?? "").trim();
    const roleIds = Array.isArray(body.role_ids) ? [...new Set(body.role_ids.map((id) => String(id)))] : [String(body.role_id ?? "")].filter(Boolean);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply({ error: "Enter the candidate's registered email address." }, 400);
    if (displayNameInput.length > 120) return reply({ error: "Name must be 120 characters or fewer." }, 400);
    if (!roleIds.length || roleIds.includes("super_admin")) return reply({ error: "Choose one or more permitted sub-admin roles." }, 400);

    const { data: roles, error: roleError } = await adminClient
      .from("portal_admin_roles").select("id").in("id", roleIds);
    if (roleError || !roles || roles.length !== roleIds.length) return reply({ error: "One or more selected roles are not available." }, 400);

    // Find the existing Auth identity by exact email without creating a duplicate user.
    let existingUser: any = null;
    for (let page = 1; page <= 100; page++) {
      const { data: usersPage, error: usersError } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
      if (usersError) return reply({ error: "Could not verify the existing account: " + usersError.message }, 500);
      const users = usersPage?.users ?? [];
      existingUser = users.find((u: any) => String(u.email ?? "").toLowerCase() === email) ?? null;
      if (existingUser || users.length < 1000) break;
    }
    if (!existingUser) return reply({ error: "No Supabase account was found for that email. Use Create Sub-Admin for a new staff account." }, 404);
    if (existingUser.id === actor.id) return reply({ error: "Your Main Admin account cannot be assigned a sub-admin role." }, 400);

    const { data: candidate, error: candidateError } = await adminClient
      .from("profiles").select("user_id,full_name,email").eq("user_id", existingUser.id).maybeSingle();
    if (candidateError) return reply({ error: "Could not verify the candidate profile: " + candidateError.message }, 500);
    if (!candidate) return reply({ error: "This email belongs to an Auth user without a candidate profile. Use Create Sub-Admin if this is a new staff account." }, 404);

    const { data: alreadyAdmin, error: adminLookupError } = await adminClient
      .from("portal_admin_accounts").select("user_id,role_id").eq("user_id", existingUser.id).maybeSingle();
    if (adminLookupError) return reply({ error: "Could not check administrator status: " + adminLookupError.message }, 500);
    if (alreadyAdmin) return reply({ error: "This account already has administrator access. Change its role in the administrator accounts list instead." }, 409);

    const displayName = displayNameInput || candidate.full_name || existingUser.user_metadata?.full_name || "Sub-Admin";
    const { error: insertError } = await adminClient.from("portal_admin_accounts").insert({
      user_id: existingUser.id,
      email,
      display_name: displayName,
      role_id: roleIds[0],
      role_ids: roleIds,
      is_active: false,
      must_change_password: true,
      created_by: actor.id,
    });
    if (insertError) return reply({ error: "Could not assign the sub-admin role: " + insertError.message }, 500);

    await adminClient.from("portal_admin_activity").insert({
      actor_user_id: actor.id, target_user_id: existingUser.id,
      action: "existing_candidate_assigned_subadmin",
      details: { email, role_ids: roleIds, initial_status: "inactive_pending_activation" },
    });
    return reply({
      ok: true,
      message: "Existing candidate account assigned as an inactive sub-admin. Their candidate profile and CV remain intact. After you activate the account, they can sign in with their existing password and will be asked to change it before entering the Admin Portal.",
    });
  }

  if (action === "create") {
    const email = String(body.email ?? "").trim().toLowerCase();
    const displayName = String(body.display_name ?? "").trim();
    const password = String(body.temporary_password ?? "");
    const roleIds = Array.isArray(body.role_ids) ? [...new Set(body.role_ids.map((id) => String(id)))] : [String(body.role_id ?? "")].filter(Boolean);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply({ error: "Enter a valid email address." }, 400);
    if (!displayName || displayName.length > 120) return reply({ error: "Enter a name (maximum 120 characters)." }, 400);
    if (password.length < 12) return reply({ error: "Temporary password must be at least 12 characters." }, 400);
    if (!roleIds.length || roleIds.includes("super_admin")) return reply({ error: "Choose one or more permitted sub-admin roles." }, 400);

    const { data: roles, error: roleError } = await adminClient
      .from("portal_admin_roles").select("id").in("id", roleIds);
    if (roleError || !roles || roles.length !== roleIds.length) return reply({ error: "One or more selected roles are not available." }, 400);

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: displayName, administrator_account: true },
    });
    if (createError || !created.user) return reply({ error: createError?.message ?? "Could not create the account." }, 400);

    const { error: insertError } = await adminClient.from("portal_admin_accounts").insert({
      user_id: created.user.id,
      email,
      display_name: displayName,
      role_id: roleIds[0],
      role_ids: roleIds,
      is_active: false,
      must_change_password: true,
      created_by: actor.id,
    });
    if (insertError) {
      await adminClient.auth.admin.deleteUser(created.user.id);
      return reply({ error: "Account setup failed; the temporary Auth user was rolled back. " + insertError.message }, 500);
    }

    await adminClient.from("portal_admin_activity").insert({
      actor_user_id: actor.id, target_user_id: created.user.id,
      action: "subadmin_created",
      details: { email, role_ids: roleIds, initial_status: "inactive_pending_stage3" },
    });
    return reply({
      ok: true,
      message: "Sub-admin account created and saved as inactive. Login access will be enabled after Stage 3 security controls are installed.",
    });
  }

  const targetId = String(body.user_id ?? "");
  if (!targetId) return reply({ error: "Select an administrator account." }, 400);

  if (action === "set_roles" || action === "set_role") {
    const roleIds = Array.isArray(body.role_ids) ? [...new Set(body.role_ids.map((id) => String(id)))] : [String(body.role_id ?? "")].filter(Boolean);
    if (!roleIds.length || roleIds.includes("super_admin")) return reply({ error: "Select one or more permitted sub-admin roles. Main Admin cannot be assigned." }, 400);
    const { data: roles, error: rolesError } = await adminClient.from("portal_admin_roles").select("id").in("id", roleIds);
    if (rolesError || !roles || roles.length !== roleIds.length) return reply({ error: "One or more selected roles are not available." }, 400);
    const { data: target } = await adminClient.from("portal_admin_accounts").select("user_id,role_id").eq("user_id", targetId).maybeSingle();
    if (!target || target.role_id === "super_admin" || targetId === actor.id) return reply({ error: "That sub-admin account cannot be changed." }, 404);
    const { error } = await adminClient.from("portal_admin_accounts")
      .update({ role_id: roleIds[0], role_ids: roleIds, updated_at: new Date().toISOString() }).eq("user_id", targetId);
    if (error) return reply({ error: error.message }, 500);
    await adminClient.from("portal_admin_activity").insert({
      actor_user_id: actor.id, target_user_id: targetId,
      action: "subadmin_roles_changed", details: { role_ids: roleIds },
    });
    return reply({ ok: true, message: "Sub-admin roles updated." });
  }

  if (action === "deactivate") {
    if (targetId === actor.id) return reply({ error: "You cannot deactivate your own Main Admin account." }, 400);
    const { data: target } = await adminClient.from("portal_admin_accounts").select("user_id,role_id").eq("user_id", targetId).maybeSingle();
    if (!target || target.role_id === "super_admin") return reply({ error: "Sub-admin account not found." }, 404);
    const { error } = await adminClient.from("portal_admin_accounts")
      .update({ is_active: false, updated_at: new Date().toISOString() }).eq("user_id", targetId);
    if (error) return reply({ error: error.message }, 500);
    await adminClient.from("portal_admin_activity").insert({
      actor_user_id: actor.id, target_user_id: targetId,
      action: "subadmin_deactivated", details: {},
    });
    return reply({ ok: true, message: "Sub-admin access deactivated. Their shared Auth sign-in remains available for candidate services; Admin Portal access is blocked." });
  }

  if (action === "activate") {
    const { data: target } = await adminClient.from("portal_admin_accounts")
      .select("user_id,role_id").eq("user_id", targetId).maybeSingle();
    if (!target || target.role_id === "super_admin" || targetId === actor.id) {
      return reply({ error: "Sub-admin account not found." }, 404);
    }
    const { error } = await adminClient.from("portal_admin_accounts")
      .update({ is_active: true, updated_at: new Date().toISOString() }).eq("user_id", targetId);
    if (error) return reply({ error: "Could not activate account: " + error.message }, 500);
    await adminClient.from("portal_admin_activity").insert({
      actor_user_id: actor.id, target_user_id: targetId,
      action: "subadmin_activated", details: {},
    });
    return reply({ ok: true, message: "Sub-admin activated. They must change their password before accessing the dashboard." });
  }

  return reply({ error: "Unsupported action." }, 400);
});
