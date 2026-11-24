// Supabase Edge Function: Smart Job Collector live connectors
// Fetches only the approved Jobicy API and Remote OK RSS feed.
// All records enter fetched_jobs with needs_review; nothing is published automatically.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-collector-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SourceRow = {
  source_key: string;
  display_name: string;
  access_method: string;
  access_status: string;
  feed_url: string | null;
  enabled: boolean;
  schedule_enabled: boolean;
};

type FetchedRecord = {
  source_name: string;
  external_id: string;
  title: string;
  organization: string;
  category: string;
  location_scope: string;
  city: string;
  country: string | null;
  remote_eligibility: string | null;
  work_arrangement: string;
  qualification: string | null;
  experience: string | null;
  employment_type: string | null;
  salary: string | null;
  posted_date: string | null;
  deadline: string | null;
  source_url: string;
  apply_url: string;
  description: string | null;
  is_demo: boolean;
  review_status: string;
  review_notes: string;
  raw_data: Record<string, unknown>;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const collectorSecret = Deno.env.get("COLLECTOR_CRON_SECRET") ?? "";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cleanText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function stripHtml(value: unknown): string {
  return cleanText(String(value ?? "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " "));
}

function dateOnly(value: unknown): string | null {
  const raw = cleanText(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function salaryText(min: unknown, max: unknown, currency: unknown, period: unknown): string | null {
  const low = cleanText(min);
  const high = cleanText(max);
  if (!low && !high) return null;
  const unit = [cleanText(currency), cleanText(period)].filter(Boolean).join(" ");
  const range = low && high ? low + " - " + high : low || high;
  return [range, unit].filter(Boolean).join(" ");
}

function safeFeedUrl(source: SourceRow): URL {
  if (!source.feed_url) throw new Error("Approved feed URL is missing.");
  const url = new URL(source.feed_url);
  if (url.protocol !== "https:") throw new Error("Only HTTPS feed URLs are allowed.");
  if (source.source_key === "jobicy" &&
      (url.hostname !== "jobicy.com" || !url.pathname.startsWith("/api/jobs"))) {
    throw new Error("Jobicy source URL is outside the approved API endpoint.");
  }
  if (source.source_key === "remoteok" &&
      (url.hostname !== "remoteok.com" || url.pathname !== "/remote-jobs.rss")) {
    throw new Error("Remote OK source URL is outside the approved RSS endpoint.");
  }
  return url;
}

async function fetchJobicy(source: SourceRow): Promise<FetchedRecord[]> {
  const url = safeFeedUrl(source);
  const response = await fetch(url, {
    headers: { "Accept": "application/json", "User-Agent": "CPIR-Jobs-Collector/1.0 (+https://rimalchauhancaritas-2026.github.io/CPIR-Jobs/)" },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error("Jobicy API returned HTTP " + response.status);
  const payload = await response.json();
  if (payload?.success === false) throw new Error(cleanText(payload.error) || "Jobicy API reported an error.");
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : [];
  return jobs.map((job: Record<string, unknown>) => {
    const listingUrl = cleanText(job.url);
    const id = cleanText(job.id || job.jobSlug || listingUrl);
    const geo = cleanText(job.jobGeo) || "See original listing for eligible countries";
    const types = Array.isArray(job.jobType) ? job.jobType.map(cleanText).filter(Boolean) : [];
    const industries = Array.isArray(job.jobIndustry) ? job.jobIndustry.map(cleanText).filter(Boolean) : [];
    return {
      source_name: source.display_name,
      external_id: id,
      title: cleanText(job.jobTitle),
      organization: cleanText(job.companyName),
      category: "Private",
      location_scope: "international",
      city: "Remote",
      country: null,
      remote_eligibility: geo,
      work_arrangement: "Remote",
      qualification: cleanText(job.jobLevel) || null,
      experience: null,
      employment_type: types[0] || null,
      salary: salaryText(job.salaryMin, job.salaryMax, job.salaryCurrency, job.salaryPeriod),
      posted_date: dateOnly(job.pubDate),
      deadline: null,
      source_url: listingUrl,
      apply_url: listingUrl,
      description: cleanText(job.jobDescription) || cleanText(job.jobExcerpt) || null,
      is_demo: false,
      review_status: "needs_review",
      review_notes: "Fetched from the public Jobicy API. Verify current availability, eligible countries and application deadline against the original listing before importing.",
      raw_data: { provider: "Jobicy", provider_job: job, attribution_required: true },
    } satisfies FetchedRecord;
  }).filter((job: FetchedRecord) => job.external_id && job.title && job.organization && /^https:\/\/jobicy\.com\//i.test(job.source_url));
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCodePoint(parseInt(n, 16)));
}

function xmlTag(block: string, name: string): string {
  const match = block.match(new RegExp("<(?:[\\w.-]+:)?" + name + "\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?" + name + "\\s*>", "i"));
  return match ? decodeXml(match[1]).trim() : "";
}

async function fetchRemoteOk(source: SourceRow): Promise<FetchedRecord[]> {
  const url = safeFeedUrl(source);
  const response = await fetch(url, {
    headers: { "Accept": "application/rss+xml, application/xml, text/xml", "User-Agent": "CPIR-Jobs-Collector/1.0 (+https://rimalchauhancaritas-2026.github.io/CPIR-Jobs/)" },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error("Remote OK RSS returned HTTP " + response.status);
  const xml = await response.text();
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  return items.map((item) => {
    const link = xmlTag(item, "link");
    const guid = xmlTag(item, "guid");
    const title = xmlTag(item, "title");
    const company = xmlTag(item, "company");
    const location = xmlTag(item, "location");
    const description = xmlTag(item, "description") || xmlTag(item, "encoded");
    const posted = xmlTag(item, "pubDate");
    const tags = [...item.matchAll(/<category\b[^>]*>([\s\S]*?)<\/category>/gi)].map((m) => stripHtml(decodeXml(m[1]))).filter(Boolean);
    const idMatch = (guid || link).match(/(\d{4,})/);
    const externalId = idMatch?.[1] || guid || link;
    const canonical = link || guid;
    return {
      source_name: source.display_name,
      external_id: externalId,
      title: stripHtml(title),
      organization: stripHtml(company),
      category: "Private",
      location_scope: "international",
      city: "Remote",
      country: null,
      remote_eligibility: location || "Remote role — verify eligible countries in the original listing",
      work_arrangement: "Remote",
      qualification: null,
      experience: null,
      employment_type: tags.find((tag) => /full.?time|part.?time|contract|intern/i.test(tag)) || null,
      salary: null,
      posted_date: dateOnly(posted),
      deadline: null,
      source_url: canonical,
      apply_url: canonical,
      description: stripHtml(description).slice(0, 12000) || null,
      is_demo: false,
      review_status: "needs_review",
      review_notes: "Fetched from the public Remote OK RSS feed. Credit Remote OK and retain the original listing link. Verify employer, eligible countries and application deadline before importing.",
      raw_data: { provider: "Remote OK", guid, title, link, company, location, posted, tags, attribution_required: true },
    } satisfies FetchedRecord;
  }).filter((job: FetchedRecord) => job.external_id && job.title && /^https:\/\/(?:www\.)?remoteok\.com\//i.test(job.source_url));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  if (!supabaseUrl || !serviceKey || !collectorSecret) {
    return json({ error: "Collector function secrets are not configured. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and COLLECTOR_CRON_SECRET." }, 500);
  }
  if (req.headers.get("x-collector-secret") !== collectorSecret) {
    return json({ error: "Unauthorized collector request." }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: sources, error: sourceError } = await supabase
    .from("collector_sources")
    .select("source_key,display_name,access_method,access_status,feed_url,enabled,schedule_enabled")
    .eq("enabled", true)
    .eq("schedule_enabled", true)
    .eq("access_status", "approved")
    .in("source_key", ["jobicy", "remoteok"]);

  if (sourceError) return json({ error: "Could not load approved collector sources: " + sourceError.message }, 500);
  if (!sources?.length) return json({ ok: true, message: "No approved live sources are enabled for the schedule.", sources_processed: 0 });

  const results: Record<string, unknown>[] = [];
  for (const source of sources as SourceRow[]) {
    const run = await supabase.from("collector_runs").insert({
      source_key: source.source_key, run_mode: "live", status: "running",
      summary: "Live approved feed collection started.",
    }).select("id").single();
    if (run.error || !run.data?.id) {
      results.push({ source: source.source_key, status: "failed", error: run.error?.message || "Could not create run record." });
      continue;
    }

    try {
      let records: FetchedRecord[];
      if (source.source_key === "jobicy" && source.access_method === "api") records = await fetchJobicy(source);
      else if (source.source_key === "remoteok" && source.access_method === "rss") records = await fetchRemoteOk(source);
      else throw new Error("The selected source has an unsupported connection method.");

      const seen = records.length;
      const { data: known, error: knownError } = await supabase.from("fetched_jobs")
        .select("external_id").eq("source_name", source.display_name);
      if (knownError) throw knownError;
      const existing = new Set((known ?? []).map((row: { external_id: string | null }) => row.external_id).filter(Boolean));
      const fresh = records.filter((record) => !existing.has(record.external_id));
      let inserted = 0;
      if (fresh.length) {
        const { error: insertError } = await supabase.from("fetched_jobs").insert(fresh);
        if (insertError) throw insertError;
        inserted = fresh.length;
      }
      const duplicates = seen - inserted;
      const summary = "Fetched " + seen + " valid listing(s); inserted " + inserted + "; skipped " + duplicates + " duplicate(s). All new records remain in Needs Review.";
      await supabase.from("collector_runs").update({
        status: "succeeded", items_seen: seen, items_inserted: inserted,
        items_duplicates: duplicates, summary, finished_at: new Date().toISOString(),
      }).eq("id", run.data.id);
      await supabase.from("collector_sources").update({
        last_checked_at: new Date().toISOString(), last_success_at: new Date().toISOString(),
        last_error: null, updated_at: new Date().toISOString(),
      }).eq("source_key", source.source_key);
      results.push({ source: source.display_name, status: "succeeded", items_seen: seen, items_inserted: inserted, items_duplicates: duplicates });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await supabase.from("collector_runs").update({
        status: "failed", summary: message, finished_at: new Date().toISOString(),
      }).eq("id", run.data.id);
      await supabase.from("collector_sources").update({
        last_checked_at: new Date().toISOString(), last_error: message, updated_at: new Date().toISOString(),
      }).eq("source_key", source.source_key);
      results.push({ source: source.display_name, status: "failed", error: message });
    }
  }

  const failed = results.filter((result) => result.status === "failed").length;
  return json({
    ok: failed === 0,
    message: failed ? "Collection completed with one or more source errors." : "Approved source collection completed.",
    sources_processed: results.length,
    results,
  }, failed === results.length ? 502 : 200);
});
