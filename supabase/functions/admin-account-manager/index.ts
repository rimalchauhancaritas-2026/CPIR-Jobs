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

  if (action === "create") {
    const email = String(body.email ?? "").trim().toLowerCase();
    const displayName = String(body.display_name ?? "").trim();
    const password = String(body.temporary_password ?? "");
    const roleId = String(body.role_id ?? "");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply({ error: "Enter a valid email address." }, 400);
    if (!displayName || displayName.length > 120) return reply({ error: "Enter a name (maximum 120 characters)." }, 400);
    if (password.length < 12) return reply({ error: "Temporary password must be at least 12 characters." }, 400);
    if (roleId === "super_admin" || !roleId) return reply({ error: "Choose a permitted sub-admin role." }, 400);

    const { data: role, error: roleError } = await adminClient
      .from("portal_admin_roles").select("id").eq("id", roleId).maybeSingle();
    if (roleError || !role) return reply({ error: "The selected role is not available." }, 400);

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: displayName, administrator_account: true },
    });
    if (createError || !created.user) return reply({ error: createError?.message ?? "Could not create the account." }, 400);

    const { error: insertError } = await adminClient.from("portal_admin_accounts").insert({
      user_id: created.user.id,
      email,
      display_name: displayName,
      role_id: roleId,
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
      details: { email, role_id: roleId, initial_status: "inactive_pending_stage3" },
    });
    return reply({
      ok: true,
      message: "Sub-admin account created and saved as inactive. Login access will be enabled after Stage 3 security controls are installed.",
    });
  }

  const targetId = String(body.user_id ?? "");
  if (!targetId) return reply({ error: "Select an administrator account." }, 400);

  if (action === "set_role") {
    const roleId = String(body.role_id ?? "");
    if (!roleId || roleId === "super_admin") return reply({ error: "A sub-admin cannot be assigned the Main Admin role." }, 400);
    const { data: role } = await adminClient.from("portal_admin_roles").select("id").eq("id", roleId).maybeSingle();
    if (!role) return reply({ error: "The selected role is not available." }, 400);
    const { data: target } = await adminClient.from("portal_admin_accounts").select("user_id,role_id").eq("user_id", targetId).maybeSingle();
    if (!target || target.role_id === "super_admin" || targetId === actor.id) return reply({ error: "That sub-admin account cannot be changed." }, 404);
    const { error } = await adminClient.from("portal_admin_accounts")
      .update({ role_id: roleId, updated_at: new Date().toISOString() }).eq("user_id", targetId);
    if (error) return reply({ error: error.message }, 500);
    await adminClient.from("portal_admin_activity").insert({
      actor_user_id: actor.id, target_user_id: targetId,
      action: "subadmin_role_changed", details: { role_id: roleId },
    });
    return reply({ ok: true, message: "Sub-admin role updated." });
  }

  if (action === "deactivate") {
    if (targetId === actor.id) return reply({ error: "You cannot deactivate your own Main Admin account." }, 400);
    const { data: target } = await adminClient.from("portal_admin_accounts").select("user_id,role_id").eq("user_id", targetId).maybeSingle();
    if (!target || target.role_id === "super_admin") return reply({ error: "Sub-admin account not found." }, 404);
    const { error } = await adminClient.from("portal_admin_accounts")
      .update({ is_active: false, updated_at: new Date().toISOString() }).eq("user_id", targetId);
    if (error) return reply({ error: error.message }, 500);
    await adminClient.auth.admin.updateUserById(targetId, { ban_duration: "876000h" });
    await adminClient.from("portal_admin_activity").insert({
      actor_user_id: actor.id, target_user_id: targetId,
      action: "subadmin_deactivated", details: {},
    });
    return reply({ ok: true, message: "Sub-admin deactivated. Database permissions are blocked immediately and Auth sign-in is suspended." });
  }

  if (action === "activate") {
    const { data: target } = await adminClient.from("portal_admin_accounts")
      .select("user_id,role_id").eq("user_id", targetId).maybeSingle();
    if (!target || target.role_id === "super_admin" || targetId === actor.id) {
      return reply({ error: "Sub-admin account not found." }, 404);
    }
    const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(targetId, { ban_duration: "none" });
    if (authUpdateError) return reply({ error: "Could not restore Auth access: " + authUpdateError.message }, 500);
    const { error } = await adminClient.from("portal_admin_accounts")
      .update({ is_active: true, updated_at: new Date().toISOString() }).eq("user_id", targetId);
    if (error) {
      await adminClient.auth.admin.updateUserById(targetId, { ban_duration: "876000h" });
      return reply({ error: "Could not activate account: " + error.message }, 500);
    }
    await adminClient.from("portal_admin_activity").insert({
      actor_user_id: actor.id, target_user_id: targetId,
      action: "subadmin_activated", details: {},
    });
    return reply({ ok: true, message: "Sub-admin activated. They must still change their temporary password before accessing the dashboard." });
  }

  return reply({ error: "Unsupported action." }, 400);
});
