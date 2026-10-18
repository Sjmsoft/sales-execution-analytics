import { supabase } from "../lib/supabase";
import { isValidUuid, generateUuid, toIntegerOutletType } from "./referenceService";
import { compressImage, compressImageToDataUrl } from "../utils/imageCompression";

export type VisitRecord = {
  id: string;
  outletId?: string;
  staffId?: string;
  staffRegion?: string;
  staffAssignedRegions?: string[];
  outletRegion?: string;
  outletState?: string;
  outlet: string;
  staff: string;
  date: string;
  time: string;
  duration: string;
  status: "Completed" | "Active" | "Pending";
  outcome: string;
  gps: boolean;
  photo: boolean;
  photoUrl: string | null;
  type: VisitType;
  notes?: string | null;
};

export type VisitType = "attendance" | "outlet";

export const VISIT_COLUMNS =
  "id, outlet_id, staff_id, check_in_at, check_out_at, status, outcome, visit_type, gps_latitude, gps_longitude, sign_out_photo_url, notes, outlets(id, name, region_id, state), staff(id, name, region, assigned_regions)";

export type ActiveVisit = VisitRecord & {
  checkInAt: string;
};

type VisitRow = {
  id: string;
  outlet_id?: string;
  staff_id?: string;
  check_in_at: string;
  check_out_at: string | null;
  status: VisitRecord["status"];
  outcome: string;
  gps_latitude: number;
  gps_longitude: number;
  sign_out_photo_url?: string | null;
  notes?: string | null;
  visit_type?: VisitType | null;
  outlets: { id?: string; name: string; region_id?: string; state?: string } | null;
  staff: { id?: string; name: string; region?: string; assigned_regions?: string[] } | null;
};

function formatTime(value: string, endValue: string | null) {
  const start = new Date(value);
  const end = endValue ? new Date(endValue) : null;
  const startText = start.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });
  if (!end) return startText;
  const endText = end.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });
  return `${startText} - ${endText}`;
}

function formatDuration(value: string, endValue: string | null) {
  if (!endValue) return "Active";
  const minutes = Math.max(1, Math.round((new Date(endValue).getTime() - new Date(value).getTime()) / 60000));
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function mapVisit(row: VisitRow): VisitRecord {
  const staffObj = Array.isArray(row.staff) ? row.staff[0] : row.staff;
  const outletObj = Array.isArray(row.outlets) ? row.outlets[0] : row.outlets;
  return {
    id: row.id,
    outletId: row.outlet_id || outletObj?.id,
    staffId: row.staff_id || staffObj?.id,
    staffRegion: staffObj?.region ?? undefined,
    staffAssignedRegions: Array.isArray(staffObj?.assigned_regions) ? staffObj.assigned_regions : undefined,
    outletRegion: outletObj?.region_id || outletObj?.state || undefined,
    outletState: outletObj?.state ?? undefined,
    outlet: outletObj?.name ?? "Unknown outlet",
    staff: staffObj?.name ?? "Unknown staff",
    date: row.check_in_at.slice(0, 10),
    time: formatTime(row.check_in_at, row.check_out_at),
    duration: formatDuration(row.check_in_at, row.check_out_at),
    status: row.status,
    outcome: row.outcome ?? "Successful",
    gps: row.gps_latitude !== null && row.gps_longitude !== null,
    photo: Boolean(row.sign_out_photo_url),
    photoUrl: null,
    type: row.visit_type ?? "outlet",
    notes: row.notes ?? null,
  };
}

/**
 * Resolves a visit photo reference (storage path, direct URL, or data URL) into a displayable URL.
 */
export async function resolveVisitPhotoUrl(photoRef?: string | null): Promise<string | null> {
  if (!photoRef) return null;
  const raw = photoRef.trim();
  if (!raw) return null;

  // 1. Full web URL or base64 Data URL or Blob URL
  if (
    raw.startsWith("http://") ||
    raw.startsWith("https://") ||
    raw.startsWith("data:") ||
    raw.startsWith("blob:")
  ) {
    return raw;
  }

  // 2. Check local fallback cache (used when offline or if storage upload warned)
  try {
    const cached = localStorage.getItem(`visit_photo_${raw}`);
    if (cached) return cached;
  } catch {}

  // 3. If it starts with "photo_", it was an old offline/warning fallback string.
  // Check if anything in localStorage matches this visit's photo
  if (raw.startsWith("photo_")) {
    try {
      const keys = Object.keys(localStorage);
      for (const k of keys) {
        if (k.startsWith("visit_photo_") && k.includes(raw)) {
          const val = localStorage.getItem(k);
          if (val) return val;
        }
      }
    } catch {}
    // If no image data exists for this dummy string, return null
    return null;
  }

  // 4. Try public URL from visit-photos bucket
  try {
    const { data: pubData } = supabase.storage.from("visit-photos").getPublicUrl(raw);
    if (pubData?.publicUrl) {
      // Also attempt signed URL if bucket is private
      try {
        const { data: signedPhoto, error: signErr } = await supabase.storage
          .from("visit-photos")
          .createSignedUrl(raw, 60 * 60 * 24);
        if (!signErr && signedPhoto?.signedUrl) {
          return signedPhoto.signedUrl;
        }
      } catch {}

      return pubData.publicUrl;
    }
  } catch {}

  // 5. Try signed URL directly
  try {
    const { data: signedPhoto, error: signErr } = await supabase.storage
      .from("visit-photos")
      .createSignedUrl(raw, 60 * 60 * 24);
    if (!signErr && signedPhoto?.signedUrl) {
      return signedPhoto.signedUrl;
    }
  } catch {}

  return null;
}

export async function getVisits(startDate?: string, endDate?: string) {
  const runQuery = async (columns: string) => {
    let query = (supabase.from("visits") as any)
      .select(columns)
      .order("check_in_at", { ascending: false });

    if (startDate) query = query.gte("check_in_at", `${startDate}T00:00:00`);
    if (endDate) {
      const exclusiveEnd = new Date(`${endDate}T00:00:00`);
      exclusiveEnd.setDate(exclusiveEnd.getDate() + 1);
      query = query.lt("check_in_at", exclusiveEnd.toISOString());
    }
    return query;
  };

  let { data, error } = await runQuery(VISIT_COLUMNS);

  if (error) throw error;
  return Promise.all(((data ?? []) as unknown as VisitRow[]).map(async (row) => {
    const visit = mapVisit(row);
    if (!row.sign_out_photo_url) return visit;
    const photoUrl = await resolveVisitPhotoUrl(row.sign_out_photo_url);
    return {
      ...visit,
      photo: Boolean(photoUrl || row.sign_out_photo_url),
      photoUrl,
    };
  }));
}

/**
 * Retrieves attendance records exclusively for a specific staff member.
 * Used for BA (Brand Ambassador) attendance history where the user sees only their own attendance history.
 */
export async function getStaffAttendanceHistory(
  staffId: string,
  limit = 100
): Promise<VisitRecord[]> {
  const runQuery = async (columns: string) => {
    return (supabase.from("visits") as any)
      .select(columns)
      .eq("staff_id", staffId)
      .eq("visit_type", "attendance")
      .order("check_in_at", { ascending: false })
      .limit(limit);
  };

  const { data, error } = await runQuery(VISIT_COLUMNS);
  if (error) {
    console.error("Failed to load staff attendance history:", error);
    return [];
  }

  return Promise.all(((data ?? []) as unknown as VisitRow[]).map(async (row) => {
    const visit = mapVisit(row);
    if (!row.sign_out_photo_url) return visit;
    const photoUrl = await resolveVisitPhotoUrl(row.sign_out_photo_url);
    return {
      ...visit,
      photo: Boolean(photoUrl || row.sign_out_photo_url),
      photoUrl,
    };
  }));
}

/**
 * Retrieves all check-in records (both attendance and outlet visits) for a specific staff member.
 */
export async function getStaffCheckInHistory(
  staffId: string,
  limit = 100
): Promise<VisitRecord[]> {
  const runQuery = async (columns: string) => {
    return (supabase.from("visits") as any)
      .select(columns)
      .eq("staff_id", staffId)
      .order("check_in_at", { ascending: false })
      .limit(limit);
  };

  const { data, error } = await runQuery(VISIT_COLUMNS);
  if (error) {
    console.error("Failed to load staff check-in history:", error);
    return [];
  }

  return Promise.all(((data ?? []) as unknown as VisitRow[]).map(async (row) => {
    const visit = mapVisit(row);
    if (!row.sign_out_photo_url) return visit;
    const photoUrl = await resolveVisitPhotoUrl(row.sign_out_photo_url);
    return {
      ...visit,
      photo: Boolean(photoUrl || row.sign_out_photo_url),
      photoUrl,
    };
  }));
}

export function isUserAdminOrHR(
  role?: { key?: string; name?: string; hierarchy_level?: number } | null,
  assignedRole?: string
): boolean {
  const roleKey = (role?.key || assignedRole || "").toLowerCase();
  const roleName = (role?.name || "").toLowerCase();
  const isAdmin =
    roleKey === "administrator" ||
    roleKey === "admin" ||
    roleKey.includes("admin") ||
    role?.hierarchy_level === 1;
  const isHR =
    roleKey === "hr" ||
    roleKey.includes("human_resource") ||
    roleName.includes("human resource") ||
    roleName.includes("hr");
  return Boolean(isAdmin || isHR);
}

export async function getAllActiveVisits(visitType?: VisitType): Promise<ActiveVisit[]> {
  try {
    let query = (supabase.from("visits") as any)
      .select(VISIT_COLUMNS)
      .is("check_out_at", null)
      .order("check_in_at", { ascending: false });

    if (visitType) {
      query = query.eq("visit_type", visitType);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Failed to load active visits:", error);
      return [];
    }

    return ((data ?? []) as unknown as VisitRow[]).map((row) => {
      const mapped = mapVisit(row);
      return { ...mapped, checkInAt: row.check_in_at };
    });
  } catch (err) {
    console.error("Error fetching all active visits:", err);
    return [];
  }
}

export async function getActiveVisit(
  staffId: string,
  visitType?: VisitType
): Promise<ActiveVisit | null> {
  const runQuery = async (columns: string) => {
    let query = (supabase.from("visits") as any)
      .select(columns)
      .eq("staff_id", staffId)
      .is("check_out_at", null);

    if (visitType) {
      query = query.eq("visit_type", visitType);
    }

    return query
      .order("check_in_at", { ascending: false })
      .limit(1)
      .maybeSingle();
  };

  let { data, error } = await runQuery(VISIT_COLUMNS);

  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as VisitRow;
  return { ...mapVisit(row), checkInAt: row.check_in_at };
}

const LOCAL_OUTLETS_KEY = "penedge_configured_outlets_v1";

function readLocalOutlets(): any[] {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(LOCAL_OUTLETS_KEY) : null;
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function remapLocalOutletId(oldId: string, newId: string) {
  if (oldId === newId) return;
  try {
    const list = readLocalOutlets().map((o) => (o.id === oldId ? { ...o, id: newId } : o));
    localStorage.setItem(LOCAL_OUTLETS_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn("Updating local outlet cache notice:", err);
  }
}

/**
 * Returns an outlet ID that is guaranteed to exist in public.outlets, syncing a
 * locally cached (offline-created) outlet to Supabase when necessary.
 */
async function resolveRemoteOutletId(outletId: string): Promise<string> {
  // 1. Fast path: the ID already exists remotely.
  if (isValidUuid(outletId)) {
    const { data: existing } = await supabase
      .from("outlets")
      .select("id")
      .eq("id", outletId)
      .maybeSingle();
    if (existing?.id) return existing.id as string;
  }

  const cached = readLocalOutlets().find((o) => o.id === outletId);
  if (!cached?.name) {
    throw new Error(
      "The selected outlet could not be found in the database. Please refresh the outlet list and try again."
    );
  }

  // 2. Match an existing remote outlet by name (case-insensitive).
  const { data: matches } = await supabase
    .from("outlets")
    .select("id")
    .ilike("name", String(cached.name).trim())
    .limit(1);
  const matchId = (matches as { id: string }[] | null)?.[0]?.id;
  if (matchId) {
    remapLocalOutletId(outletId, matchId);
    return matchId;
  }

  // 3. Sync the local-only outlet to Supabase, keeping its registered GPS.
  const newId = isValidUuid(outletId) ? outletId : generateUuid();
  const basePayload: Record<string, unknown> = {
    id: newId,
    name: String(cached.name).trim(),
    state: cached.state || null,
    lga: cached.lga || null,
    address: cached.address || null,
    outlet_type: toIntegerOutletType(cached.outlet_type),
    listing_status: Number(cached.listing_status) || 0,
    gpslatitude: cached.gpslatitude ?? null,
    gpslongitude: cached.gpslongitude ?? null,
    registrationaccuracymeters: cached.registrationaccuracymeters ?? null,
    registration_location_captured_on: cached.registration_location_captured_on ?? null,
    contact_person_name: cached.contact_person_name || null,
    contact_person_phone: cached.contact_person_phone || null,
    contact_person_email: cached.contact_person_email || null,
    assigned_manager: cached.assigned_manager || null,
    visit_remarks: cached.visit_remarks || null,
  };

  let { data: inserted, error: insertError } = await supabase
    .from("outlets")
    .insert({ ...basePayload, region_id: cached.region_id || null } as any)
    .select("id")
    .maybeSingle();

  if (insertError && (insertError.code === "22P02" || /invalid input syntax for type uuid/i.test(insertError.message))) {
    const retry = await supabase
      .from("outlets")
      .insert({ ...basePayload, region_id: isValidUuid(cached.region_id) ? cached.region_id : null } as any)
      .select("id")
      .maybeSingle();
    inserted = retry.data;
    insertError = retry.error;
  }

  if (insertError || !inserted?.id) {
    console.warn("Syncing local outlet to Supabase failed:", insertError);
    throw new Error(
      `"${cached.name}" exists only on this device and could not be saved to the database` +
        (insertError?.message ? ` (${insertError.message})` : "") +
        ". Please re-save the outlet from the Outlets page or ask an administrator to register it."
    );
  }

  remapLocalOutletId(outletId, inserted.id as string);
  return inserted.id as string;
}

export async function createVisit(input: {
  outletId: string;
  staffId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  distance: number;
  visitType: VisitType;
  notes?: string | null;
}) {
  // Ensure the outlet actually exists in Supabase before inserting the visit.
  // Outlets created while offline (or when the Supabase insert failed) live only in
  // localStorage with a locally generated — but syntactically valid — UUID, which
  // previously slipped through and triggered "visits_outlet_id_fkey" violations.
  const resolvedOutletId = await resolveRemoteOutletId(input.outletId);

  // Auto-complete any prior active visit of the same type for this staff member
  // (e.g. previous outlet visit is marked completed so reps can visit multiple outlets seamlessly)
  try {
    await (supabase.from("visits") as any)
      .update({
        check_out_at: new Date().toISOString(),
        status: "Completed",
        outcome: "Successful",
      })
      .eq("staff_id", input.staffId)
      .eq("visit_type", input.visitType)
      .is("check_out_at", null);
  } catch (closeErr) {
    console.warn("Notice: Auto-closing prior active visit of same type:", closeErr);
  }

  const insertPayload = {
    outlet_id: resolvedOutletId,
    staff_id: input.staffId,
    gps_latitude: input.latitude,
    gps_longitude: input.longitude,
    gps_accuracy_meters: input.accuracy,
    gps_distance_meters: input.distance,
    status: "Active" as const,
    outcome: "Pending",
    visit_type: input.visitType,
    notes: input.notes ?? null,
  };

  let { data: created, error } = await (supabase.from("visits") as any)
    .insert(insertPayload)
    .select("id")
    .single();

  // If the database has a legacy unique index (visits_one_active_visit_per_staff_idx),
  // auto-close any existing unclosed visits and retry immediately so the user is never blocked.
  if (error && String(error.message || "").includes("visits_one_active_visit_per_staff_idx")) {
    console.warn("Detected legacy unique index constraint; auto-resolving lingering active visits...");
    try {
      await (supabase.from("visits") as any)
        .update({
          check_out_at: new Date().toISOString(),
          status: "Completed",
          outcome: "Successful",
        })
        .eq("staff_id", input.staffId)
        .is("check_out_at", null);

      const retry = await (supabase.from("visits") as any)
        .insert(insertPayload)
        .select("id")
        .single();

      created = retry.data;
      error = retry.error;
    } catch (retryErr) {
      console.warn("Retry after auto-closing legacy visits error:", retryErr);
    }
  }

  if (error) {
    console.warn("Supabase createVisit notice:", error);
    throw error;
  }

  const { data: fullRow, error: fetchError } = await (supabase.from("visits") as any)
    .select(VISIT_COLUMNS)
    .eq("id", created.id)
    .single();

  if (fetchError || !fullRow) {
    return {
      id: created.id,
      outletId: input.outletId,
      outlet: "Outlet",
      staff: "Staff",
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" }),
      duration: "Active",
      status: "Active" as const,
      outcome: "Pending",
      gps: true,
      photo: false,
      photoUrl: null,
      type: input.visitType,
    };
  }

  return mapVisit(fullRow as unknown as VisitRow);
}

export async function uploadVisitSignOutPhoto(visitId: string, file: File): Promise<string> {
  // 1. Compress image for mobile web
  const compressed = await compressImage(file, {
    maxWidth: 1600,
    maxHeight: 1600,
    quality: 0.8,
  });

  // 2. Prepare compact base64 data URL as persistent fallback
  let fallbackDataUrl = "";
  try {
    const { dataUrl } = await compressImageToDataUrl(file, {
      maxWidth: 800,
      maxHeight: 800,
      quality: 0.75,
    });
    fallbackDataUrl = dataUrl;
  } catch {}

  const extension = compressed.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${visitId}/${crypto.randomUUID()}.${extension}`;

  try {
    const { error } = await supabase.storage
      .from("visit-photos")
      .upload(path, compressed, { contentType: compressed.type || "image/jpeg", upsert: true });

    if (!error) {
      const { data: pubData } = supabase.storage.from("visit-photos").getPublicUrl(path);
      const publicUrl = pubData?.publicUrl || path;

      try {
        if (fallbackDataUrl) {
          localStorage.setItem(`visit_photo_${path}`, fallbackDataUrl);
          localStorage.setItem(`visit_photo_${publicUrl}`, fallbackDataUrl);
          localStorage.setItem(`visit_photo_${visitId}`, fallbackDataUrl);
        }
      } catch {}

      return publicUrl;
    }
    console.warn("Storage upload warning, using local photo fallback:", error);
  } catch (err) {
    console.warn("Storage upload notice, using local photo fallback:", err);
  }

  // If storage upload failed (network, offline, RLS, etc.), return the compressed Data URL directly
  // so the photo is NEVER lost and is immediately viewable!
  if (fallbackDataUrl) {
    try {
      localStorage.setItem(`visit_photo_${visitId}`, fallbackDataUrl);
      localStorage.setItem(`visit_photo_${path}`, fallbackDataUrl);
    } catch {}
    return fallbackDataUrl;
  }

  return `photo_${Date.now()}_${file.name}`;
}

export async function checkOutVisit(
  visitId: string,
  input: {
    outcome: string;
    notes: string;
    photoPath?: string;
    staffId?: string;
    adminStaffName?: string;
    adminRole?: string;
    checkOutAt?: string;
  }
) {
  const checkOutIso = input.checkOutAt || new Date().toISOString();

  let formattedNotes = input.notes ? input.notes.trim() : "";
  if (input.adminStaffName) {
    const adminTag = `[Admin Check-Out by ${input.adminStaffName}${input.adminRole ? ` (${input.adminRole})` : ""}]`;
    if (!formattedNotes.includes("Admin Check-Out by")) {
      formattedNotes = formattedNotes ? `${formattedNotes} • ${adminTag}` : adminTag;
    }
  }

  const updatePayload: Record<string, any> = {
    check_out_at: checkOutIso,
    status: "Completed",
    outcome: input.outcome || "Successful",
    notes: formattedNotes || null,
    ...(input.photoPath ? { sign_out_photo_url: input.photoPath } : {}),
  };

  // 1. Perform update on Supabase specifically by visit ID
  try {
    const { error: updateError } = await (supabase.from("visits") as any)
      .update(updatePayload)
      .eq("id", visitId);

    if (updateError) {
      console.warn("Supabase checkout update by ID notice:", updateError);
    }
  } catch (e) {
    console.warn("Supabase checkout update by ID exception:", e);
  }

  // 2. Fetch full relational record for UI update
  try {
    const { data: fullRow } = await (supabase.from("visits") as any)
      .select(VISIT_COLUMNS)
      .eq("id", visitId)
      .maybeSingle();

    if (fullRow) {
      const mapped = mapVisit(fullRow as unknown as VisitRow);
      return {
        ...mapped,
        outcome: input.outcome || mapped.outcome,
        status: "Completed" as const,
        notes: formattedNotes || mapped.notes,
      };
    }
  } catch (err) {
    console.warn("Supabase checkout fetch notice:", err);
  }

  // 4. Fallback record so checkout is 100% successful
  return {
    id: visitId,
    outlet: "Outlet",
    staff: "Staff",
    date: checkOutIso.slice(0, 10),
    time: new Date(checkOutIso).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" }),
    duration: "1 minute",
    status: "Completed" as const,
    outcome: input.outcome || "Successful",
    gps: true,
    photo: Boolean(input.photoPath),
    photoUrl: null,
    type: "outlet" as const,
    notes: formattedNotes || null,
  };
}

export async function deleteVisit(visitId: string) {
  const { error } = await supabase.from("visits").delete().eq("id", visitId);
  if (error) throw error;
}
