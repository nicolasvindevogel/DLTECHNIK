import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });

const txt = (v: unknown, max = 5000) => String(v ?? "").trim().slice(0, max);
const pinOk = (v: unknown) => /^[0-9]{6}$/.test(String(v ?? ""));
const uuidOk = (v: unknown) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v ?? ""));

async function session(body: any) {
  const token = txt(body.device_token, 256);
  if (!token) return null;
  const { data, error } = await admin.rpc("technik_validate_device_token", { p_device_token: token });
  if (error) throw error;
  return Array.isArray(data) && data.length ? data[0] : null;
}

async function requireSession(body: any) {
  const s = await session(body);
  if (!s) throw new Error("SESSION_INVALID");
  return s;
}

async function ownJob(jobId: string, technicianId: string) {
  const { data, error } = await admin
    .from("technik_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("assigned_technician_id", technicianId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Intervention introuvable ou non attribuée.");
  return data;
}

async function ownVisit(visitId: string, technicianId: string) {
  const { data, error } = await admin
    .from("technik_visits")
    .select("*, technik_jobs!inner(id,status,assigned_technician_id,intervention_type_code,copro_id)")
    .eq("id", visitId)
    .eq("technician_id", technicianId)
    .eq("technik_jobs.assigned_technician_id", technicianId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Passage introuvable.");
  return data;
}

async function seedCleaningChecks(visitId: string, coproId: string | null) {
  const { count } = await admin
    .from("technik_cleaning_checks")
    .select("id", { count: "exact", head: true })
    .eq("visit_id", visitId);
  if ((count || 0) > 0) return;

  let templateId: string | null = null;
  if (coproId) {
    const { data } = await admin
      .from("technik_cleaning_templates")
      .select("id")
      .eq("active", true)
      .eq("copro_id", coproId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    templateId = data?.id || null;
  }
  if (!templateId) {
    const { data } = await admin
      .from("technik_cleaning_templates")
      .select("id")
      .eq("active", true)
      .is("copro_id", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    templateId = data?.id || null;
  }
  if (!templateId) return;

  const { data: items, error } = await admin
    .from("technik_cleaning_template_items")
    .select("id,label,sort_order")
    .eq("template_id", templateId)
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  if (!items?.length) return;

  const rows = items.map((i: any) => ({
    visit_id: visitId,
    template_item_id: i.id,
    label_snapshot: i.label,
    checked: false,
  }));
  const { error: insErr } = await admin.from("technik_cleaning_checks").insert(rows);
  if (insErr) throw insErr;
}

async function detail(jobId: string, technicianId: string) {
  await ownJob(jobId, technicianId);

  const { data: job, error: je } = await admin
    .from("technik_v_interventions")
    .select("*")
    .eq("id", jobId)
    .single();
  if (je) throw je;

  const { data: visits, error: ve } = await admin
    .from("technik_visits")
    .select("*")
    .eq("job_id", jobId)
    .order("visit_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (ve) throw ve;

  const visitIds = (visits || []).map((v: any) => v.id);
  let photos: any[] = [];
  let checks: any[] = [];

  if (visitIds.length) {
    const [{ data: p, error: pe }, { data: c, error: ce }] = await Promise.all([
      admin.from("technik_photos").select("*").in("visit_id", visitIds).order("sort_order"),
      admin.from("technik_cleaning_checks").select("*").in("visit_id", visitIds).order("created_at"),
    ]);
    if (pe) throw pe;
    if (ce) throw ce;
    photos = p || [];
    checks = c || [];
  }

  if (photos.length) {
    const paths = photos.map((p: any) => p.storage_path);
    const { data: urls, error } = await admin.storage
      .from("technik-interventions")
      .createSignedUrls(paths, 3600);
    if (!error && urls) {
      photos = photos.map((p: any, i: number) => ({
        ...p,
        signed_url: urls[i]?.signedUrl || null,
      }));
    }
  }

  return { job, visits: visits || [], photos, checks };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const action = txt(body.action, 80);
    const ua = txt(req.headers.get("user-agent"), 500);
    const deviceName = txt(body.device_name || "DL TECHNIK PWA", 120);

    // ------------------------------------------------------------
    // AUTH V1
    // ------------------------------------------------------------
    if (action === "list_users") {
      const { data, error } = await admin
        .from("technik_users")
        .select("id,display_name,first_name,last_name,trade,pin_hash,pin_reset_requested")
        .eq("active", true)
        .order("first_name")
        .order("last_name");
      if (error) throw error;
      return reply({
        users: (data || []).map((u: any) => ({
          id: u.id,
          display_name: u.display_name || [u.first_name, u.last_name].filter(Boolean).join(" "),
          trade: u.trade || "",
          pin_configured: Boolean(u.pin_hash) && !u.pin_reset_requested,
          pin_reset_requested: Boolean(u.pin_reset_requested),
        })),
      });
    }

    if (action === "setup_pin") {
      const technicianId = txt(body.technician_id, 80);
      const pin = String(body.pin || "");
      if (!uuidOk(technicianId) || !pinOk(pin)) return reply({ error: "PIN invalide." }, 400);

      const { data, error } = await admin.rpc("technik_setup_pin", {
        p_technician_id: technicianId,
        p_pin: pin,
        p_device_name: deviceName,
        p_user_agent: ua,
      });
      if (error) return reply({ error: error.message }, 400);
      const row = Array.isArray(data) ? data[0] : null;
      return reply({
        ok: true,
        technician: { id: row.technician_id, display_name: row.display_name },
        device_token: row.device_token,
      });
    }

    if (action === "login") {
      const technicianId = txt(body.technician_id, 80);
      const pin = String(body.pin || "");
      if (!uuidOk(technicianId) || !pinOk(pin)) return reply({ error: "PIN incorrect." }, 400);

      const { data, error } = await admin.rpc("technik_login_with_pin", {
        p_technician_id: technicianId,
        p_pin: pin,
        p_device_name: deviceName,
        p_user_agent: ua,
      });
      if (error) return reply({ error: error.message }, 401);
      const row = Array.isArray(data) ? data[0] : null;
      return reply({
        ok: true,
        technician: { id: row.technician_id, display_name: row.display_name },
        device_token: row.device_token,
      });
    }

    if (action === "session") {
      const s = await session(body);
      if (!s) return reply({ valid: false }, 401);
      return reply({ valid: true, technician: s });
    }

    if (action === "logout") {
      const token = txt(body.device_token, 256);
      if (token) await admin.rpc("technik_logout_device", { p_device_token: token });
      return reply({ ok: true });
    }

    // ------------------------------------------------------------
    // API TERRAIN V2
    // ------------------------------------------------------------
    const s = await requireSession(body);
    const techId = s.technician_id;

    if (action === "dashboard") {
      const { data, error } = await admin
        .from("technik_v_interventions")
        .select("*")
        .eq("assigned_technician_id", techId)
        .order("planned_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      const jobs = data || [];
      return reply({
        technician: s,
        assigned: jobs.filter((j: any) => ["draft","assigned"].includes(j.status)),
        in_progress: jobs.filter((j: any) => j.status === "in_progress"),
        completed: jobs.filter((j: any) => ["report_received","validated","archived"].includes(j.status)),
      });
    }

    if (action === "list_jobs") {
      const mode = txt(body.mode, 20);
      let statuses = ["draft","assigned","in_progress"];
      if (mode === "completed") statuses = ["report_received","validated","archived"];
      const { data, error } = await admin
        .from("technik_v_interventions")
        .select("*")
        .eq("assigned_technician_id", techId)
        .in("status", statuses)
        .order("planned_date", { ascending: false, nullsFirst: false })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return reply({ jobs: data || [] });
    }

    if (action === "reference_data") {
      const [{ data: types, error: te }, { data: copros, error: ce }] = await Promise.all([
        admin.from("technik_intervention_types").select("code,label").eq("active", true).order("sort_order"),
        admin.from("compta_copros").select("id,name,code,profile").order("name"),
      ]);
      if (te) throw te;
      if (ce) throw ce;
      return reply({
        can_create_jobs: Boolean(s.can_create_jobs),
        types: types || [],
        copros: (copros || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          code: c.code || "",
          address: c.profile?.address || "",
          postal_code: c.profile?.postal_code || "",
          city: c.profile?.city || "",
        })),
      });
    }

    if (action === "job_detail") {
      const jobId = txt(body.job_id, 80);
      if (!uuidOk(jobId)) return reply({ error: "Intervention invalide." }, 400);
      return reply(await detail(jobId, techId));
    }

    if (action === "create_job") {
      if (!s.can_create_jobs) return reply({ error: "Vous n'êtes pas autorisé à créer une intervention." }, 403);

      const locationType = body.location_type === "external" ? "external" : "copro";
      const title = txt(body.title, 300);
      if (!title) return reply({ error: "L'objet de l'intervention est obligatoire." }, 400);

      const payload: any = {
        location_type: locationType,
        intervention_type_code: txt(body.intervention_type_code, 60) || "technique",
        title,
        description: txt(body.description, 5000) || null,
        priority: ["low","normal","high","urgent"].includes(body.priority) ? body.priority : "normal",
        status: "assigned",
        assigned_technician_id: techId,
        planned_date: txt(body.planned_date, 20) || new Date().toISOString().slice(0,10),
      };

      if (locationType === "copro") {
        const coproId = txt(body.copro_id, 80);
        if (!uuidOk(coproId)) return reply({ error: "Sélectionnez une copropriété." }, 400);
        payload.copro_id = coproId;
      } else {
        payload.external_location_name = txt(body.external_location_name, 300) || null;
        payload.external_address_line1 = txt(body.external_address_line1, 500);
        payload.external_postal_code = txt(body.external_postal_code, 30) || null;
        payload.external_city = txt(body.external_city, 200);
        if (!payload.external_address_line1 || !payload.external_city) {
          return reply({ error: "Renseignez l'adresse et la ville." }, 400);
        }
      }

      const { data, error } = await admin.from("technik_jobs").insert(payload).select("id").single();
      if (error) throw error;

      await admin.from("technik_audit_log").insert({
        technician_id: techId,
        event_type: "job_created_from_pwa",
        entity_type: "technik_job",
        entity_id: data.id,
      });

      return reply({ ok: true, job_id: data.id });
    }

    if (action === "prepare_visit") {
      const jobId = txt(body.job_id, 80);
      const job = await ownJob(jobId, techId);
      if (["validated","archived","cancelled"].includes(job.status)) {
        return reply({ error: "Cette intervention est clôturée." }, 400);
      }

      const { data: current } = await admin
        .from("technik_visits")
        .select("*")
        .eq("job_id", jobId)
        .eq("technician_id", techId)
        .in("status", ["draft","in_progress"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let visit = current;
      if (!visit) {
        const { data, error } = await admin.from("technik_visits").insert({
          job_id: jobId,
          technician_id: techId,
          visit_date: new Date().toISOString().slice(0,10),
          status: "draft",
        }).select("*").single();
        if (error) throw error;
        visit = data;
      }

      if (job.intervention_type_code === "nettoyage_regulier") {
        await seedCleaningChecks(visit.id, job.copro_id || null);
      }

      return reply({ ok: true, visit });
    }

    if (action === "save_visit") {
      const visitId = txt(body.visit_id, 80);
      const visit = await ownVisit(visitId, techId);
      if (visit.status === "validated" || visit.status === "cancelled") {
        return reply({ error: "Ce passage n'est plus modifiable." }, 400);
      }

      const payload: any = {
        work_done: txt(body.work_done, 10000) || null,
        remarks: txt(body.remarks, 5000) || null,
        materials_used: txt(body.materials_used, 5000) || null,
      };
      if (body.manual_duration_minutes !== undefined && body.manual_duration_minutes !== null && body.manual_duration_minutes !== "") {
        const n = Number(body.manual_duration_minutes);
        if (Number.isFinite(n) && n >= 0) payload.manual_duration_minutes = Math.round(n);
      }

      const { error } = await admin.from("technik_visits").update(payload).eq("id", visitId);
      if (error) throw error;
      return reply({ ok: true });
    }

    if (action === "save_checks") {
      const visitId = txt(body.visit_id, 80);
      await ownVisit(visitId, techId);
      const checks = Array.isArray(body.checks) ? body.checks : [];
      for (const c of checks) {
        if (!uuidOk(c.id)) continue;
        const { error } = await admin
          .from("technik_cleaning_checks")
          .update({ checked: Boolean(c.checked), remark: txt(c.remark, 1000) || null })
          .eq("id", c.id)
          .eq("visit_id", visitId);
        if (error) throw error;
      }
      return reply({ ok: true });
    }

    if (action === "finish_visit") {
      const visitId = txt(body.visit_id, 80);
      const visit = await ownVisit(visitId, techId);
      if (visit.status === "validated" || visit.status === "cancelled") {
        return reply({ error: "Ce passage est déjà clôturé." }, 400);
      }

      const minutes = Number(body.manual_duration_minutes);
      if (!Number.isFinite(minutes) || minutes <= 0) {
        return reply({ error: "Indiquez le temps passé avant d'envoyer le rapport." }, 400);
      }

      const payload: any = {
        status: "submitted",
        submitted_at: new Date().toISOString(),
        manual_duration_minutes: Math.round(minutes),
        work_done: txt(body.work_done, 10000) || null,
        remarks: txt(body.remarks, 5000) || null,
        materials_used: txt(body.materials_used, 5000) || null,
      };

      const { error } = await admin.from("technik_visits").update(payload).eq("id", visitId);
      if (error) throw error;
      await admin.from("technik_jobs").update({ status: "report_received" }).eq("id", visit.job_id);

      await admin.from("technik_audit_log").insert({
        technician_id: techId,
        event_type: "visit_submitted",
        entity_type: "technik_visit",
        entity_id: visitId,
      });

      return reply({ ok: true });
    }

    if (action === "photo_upload_url") {
      const visitId = txt(body.visit_id, 80);
      const photoType = ["before","after","other"].includes(body.photo_type) ? body.photo_type : "other";
      const visit = await ownVisit(visitId, techId);
      if (visit.status === "validated" || visit.status === "cancelled") {
        return reply({ error: "Ce passage n'est plus modifiable." }, 400);
      }

      const mime = txt(body.mime_type, 100) || "image/jpeg";
      let ext = "jpg";
      if (mime.includes("png")) ext = "png";
      else if (mime.includes("webp")) ext = "webp";
      else if (mime.includes("heic")) ext = "heic";
      else if (mime.includes("heif")) ext = "heif";

      const path = `${techId}/${visit.job_id}/${visitId}/${photoType}/${crypto.randomUUID()}.${ext}`;
      const { data, error } = await admin.storage
        .from("technik-interventions")
        .createSignedUploadUrl(path);
      if (error) throw error;

      return reply({
        path,
        token: data.token,
        signed_url: data.signedUrl,
      });
    }

    if (action === "register_photo") {
      const visitId = txt(body.visit_id, 80);
      const photoType = ["before","after","other"].includes(body.photo_type) ? body.photo_type : "other";
      await ownVisit(visitId, techId);
      const path = txt(body.storage_path, 1000);
      if (!path || !path.startsWith(`${techId}/`)) return reply({ error: "Photo invalide." }, 400);

      const { data, error } = await admin.from("technik_photos").insert({
        visit_id: visitId,
        technician_id: techId,
        photo_type: photoType,
        storage_path: path,
        original_filename: txt(body.original_filename, 300) || null,
        mime_type: txt(body.mime_type, 100) || null,
        file_size_bytes: Number(body.file_size_bytes || 0) || null,
        caption: txt(body.caption, 1000) || null,
        taken_at: new Date().toISOString(),
      }).select("id").single();
      if (error) throw error;
      return reply({ ok: true, photo_id: data.id });
    }

    if (action === "delete_photo") {
      const photoId = txt(body.photo_id, 80);
      const { data: photo, error } = await admin
        .from("technik_photos")
        .select("*, technik_visits!inner(id,technician_id,status)")
        .eq("id", photoId)
        .eq("technik_visits.technician_id", techId)
        .maybeSingle();
      if (error) throw error;
      if (!photo) return reply({ error: "Photo introuvable." }, 404);
      if (photo.technik_visits.status === "validated") return reply({ error: "Rapport déjà validé." }, 400);

      await admin.storage.from("technik-interventions").remove([photo.storage_path]);
      const { error: de } = await admin.from("technik_photos").delete().eq("id", photoId);
      if (de) throw de;
      return reply({ ok: true });
    }

    return reply({ error: "Action inconnue." }, 400);
  } catch (error) {
    console.error(error);
    if (error?.message === "SESSION_INVALID") return reply({ error: "SESSION_INVALID" }, 401);
    return reply({ error: error?.message || "Erreur serveur." }, 500);
  }
});
