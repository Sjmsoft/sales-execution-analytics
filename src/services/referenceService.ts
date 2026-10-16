import { supabase } from "../lib/supabase";

export type Outlet = {
  id: string;
  name: string;
  outlet_type: number | string | null;
  listing_status: number | null;
  address: string | null;
  state: string | null;
  lga: string | null;
  region_id: string | null;
  region?: string | null;
  gpslatitude: number | null;
  gpslongitude: number | null;
  registrationaccuracymeters: number | null;
  registration_location_captured_on: string | null;
  contact_person_name: string | null;
  contact_person_phone: string | null;
  contact_person_email: string | null;
  assigned_manager: string | null;
  visit_remarks: string | null;
};

const STORAGE_KEY_OUTLETS = "penedge_configured_outlets_v1";

export function isValidUuid(id: string | null | undefined): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id.trim());
}

export function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getLocalOutlets(): Outlet[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_OUTLETS);
    if (raw) {
      const items: Outlet[] = JSON.parse(raw);
      let needsResave = false;
      const sanitized = items.map((o) => {
        if (!isValidUuid(o.id)) {
          needsResave = true;
          return { ...o, id: generateUuid() };
        }
        return o;
      });
      if (needsResave) {
        localStorage.setItem(STORAGE_KEY_OUTLETS, JSON.stringify(sanitized));
      }
      return sanitized;
    }
  } catch (e) {
    console.warn("localStorage outlets read error:", e);
  }
  return [];
}

function saveLocalOutlet(outlet: Outlet): void {
  try {
    const current = getLocalOutlets();
    const idx = current.findIndex((o) => o.id === outlet.id || o.name.toLowerCase() === outlet.name.toLowerCase());
    const updated = idx >= 0 ? current.map((o, i) => (i === idx ? outlet : o)) : [outlet, ...current];
    localStorage.setItem(STORAGE_KEY_OUTLETS, JSON.stringify(updated));
  } catch (e) {
    console.warn("localStorage save outlet error:", e);
  }
}

function removeLocalOutlet(id: string): void {
  try {
    const current = getLocalOutlets();
    const updated = current.filter((o) => o.id !== id);
    localStorage.setItem(STORAGE_KEY_OUTLETS, JSON.stringify(updated));
  } catch (e) {
    console.warn("localStorage remove outlet error:", e);
  }
}

export async function getOutlets(): Promise<Outlet[]> {
  const localList = getLocalOutlets();

  try {
    const { data, error } = await supabase
      .from("outlets")
      .select("*")
      .order("name");

    if (error) {
      console.warn("Supabase fetch outlets error:", error);
    } else if (data) {
      const localById = new Map(localList.map((o) => [o.id, o]));
      const remoteList: Outlet[] = data.map((d) => {
        const norm = normalizeRemoteOutlet(d);
        const local = localById.get(norm.id);
        const enriched = { ...norm };
        // If remote region_id is empty or UUID while local holds the human region name, preserve the name
        if (local?.region_id && (!norm.region_id || isValidUuid(norm.region_id))) {
          enriched.region_id = local.region_id;
        }
        if (local?.outlet_type && isNaN(Number(local.outlet_type)) && typeof norm.outlet_type === "number") {
          enriched.outlet_type = local.outlet_type;
        }
        if (local?.assigned_manager && !norm.assigned_manager) {
          enriched.assigned_manager = local.assigned_manager;
        }
        return enriched;
      });
      const remoteById = new Map(remoteList.map((o) => [o.id, o]));
      const remoteByName = new Map(remoteList.map((o) => [o.name.trim().toLowerCase(), o]));

      // Outlets that only exist in this browser (created while the database
      // rejected writes) never received a server-side created_at. Try to push
      // them up so they become real records. Previously-synced rows that are now
      // missing remotely were deleted elsewhere and are dropped instead.
      const pending = localList.filter(
        (o) =>
          !(o as { created_at?: string }).created_at &&
          !remoteById.has(o.id) &&
          !remoteByName.has(o.name.trim().toLowerCase())
      );
      const synced = await Promise.all(pending.map(syncLocalOutletToSupabase));

      const merged = [...remoteList];
      pending.forEach((local, i) => merged.push(synced[i] ?? local));
      merged.sort((a, b) => a.name.localeCompare(b.name));

      localStorage.setItem(STORAGE_KEY_OUTLETS, JSON.stringify(merged));
      return merged;
    }
  } catch (err) {
    console.warn("Supabase fetch outlets notice:", err);
  }

  return localList;
}

function normalizeRemoteOutlet(o: any): Outlet {
  return {
    ...o,
    region_id: o.region_id ?? null,
    outlet_type: o.outlet_type ?? 1,
  };
}

export function toIntegerOutletType(val: unknown): number {
  if (typeof val === "number" && !isNaN(val)) return val;
  const s = String(val ?? "").trim().toLowerCase();
  if (s === "1" || s === "on-trade" || s === "on_trade") return 1;
  if (s === "2" || s === "off-trade" || s === "off_trade") return 2;
  if (s === "3" || s === "key_account" || s === "key-account" || s === "key account") return 3;
  if (s === "4" || s === "mt" || s === "modern_trade" || s === "modern trade") return 4;
  if (s !== "" && !isNaN(Number(s))) return Number(s);

  const offTradeKeywords = [
    "off",
    "supermarket",
    "grocery",
    "groceries",
    "liquor",
    "store",
    "wholesale",
    "retail",
    "mart",
    "kiosk",
    "shop",
    "distributor",
    "depot",
  ];
  if (offTradeKeywords.some((kw) => s.includes(kw))) {
    return 2;
  }

  // Venues: restaurant, bar, club, lounge, hotel, cafe, pub, eatery, etc.
  return 1;
}

export function isOutletOnTrade(outletType: unknown): boolean {
  if (outletType === 1 || outletType === "1" || outletType === "on-trade") return true;
  if (outletType === 2 || outletType === "2" || outletType === "off-trade") return false;
  return toIntegerOutletType(outletType) === 1;
}

export function isOutletOffTrade(outletType: unknown): boolean {
  if (outletType === 2 || outletType === "2" || outletType === "off-trade") return true;
  if (outletType === 1 || outletType === "1" || outletType === "on-trade") return false;
  return toIntegerOutletType(outletType) === 2;
}

function isIntegerTypeError(err: any): boolean {
  return (
    err &&
    (err.code === "22P02" ||
      /invalid input syntax for type integer/i.test(String(err.message || "")))
  );
}

function isUuidTypeError(err: any): boolean {
  return (
    err &&
    (err.code === "22P02" ||
      /invalid input syntax for type uuid/i.test(String(err.message || "")))
  );
}

/**
 * Adjusts payload in-place if remote PostgreSQL columns still enforce legacy
 * strict integer (for outlet_type) or UUID (for region_id, assigned_manager).
 * Returns true if the payload was modified to allow a retry.
 */
function sanitizePayloadForLegacySchema(
  payload: Record<string, unknown>,
  error: any
): boolean {
  let modified = false;

  if (isIntegerTypeError(error) && typeof payload.outlet_type !== "number") {
    payload.outlet_type = toIntegerOutletType(payload.outlet_type);
    modified = true;
  }

  if (isUuidTypeError(error)) {
    if (payload.region_id && !isValidUuid(String(payload.region_id))) {
      payload.region_id = null;
      modified = true;
    }
    if (payload.assigned_manager && !isValidUuid(String(payload.assigned_manager))) {
      payload.assigned_manager = null;
      modified = true;
    }
  }

  return modified;
}

/** Best-effort upload of a browser-only outlet. Returns the saved row or null. */
async function syncLocalOutletToSupabase(local: Outlet): Promise<Outlet | null> {
  const { id: _ignored, ...rest } = local;
  const payload: Record<string, unknown> = {
    ...rest,
    id: isValidUuid(local.id) ? local.id : generateUuid(),
  };
  delete payload.region;
  try {
    let { data, error } = await supabase.from("outlets").insert(payload).select("*").single();

    if (error && sanitizePayloadForLegacySchema(payload, error)) {
      const retry = await supabase.from("outlets").insert(payload).select("*").single();
      data = retry.data;
      error = retry.error;

      if (error && sanitizePayloadForLegacySchema(payload, error)) {
        const retry2 = await supabase.from("outlets").insert(payload).select("*").single();
        data = retry2.data;
        error = retry2.error;
      }
    }

    if (error) {
      console.warn(`Pending outlet "${local.name}" could not be synced:`, error.message);
      return null;
    }
    return normalizeRemoteOutlet(data);
  } catch (err) {
    console.warn(`Pending outlet "${local.name}" sync exception:`, err);
    return null;
  }
}

export type CreateOutletInput = {
  name: string;
  outletType: string;
  listingStatus: string;
  regionId: string;
  address: string;
  state: string;
  lga: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  capturedOn: string | null;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  assignedManager: string;
  remarks: string;
};

function parseOutletType(value: string): number | string {
  const raw = (value || "").trim().toLowerCase();
  if (raw === "on-trade" || raw === "1") return 1;
  if (raw === "off-trade" || raw === "2") return 2;
  if (raw === "key_account" || raw === "3") return 3;
  if (raw === "mt" || raw === "4") return 4;
  if (raw !== "" && !isNaN(Number(raw))) return Number(raw);
  return value;
}

function buildOutletPayload(input: CreateOutletInput): Record<string, unknown> {
  return {
    name: input.name.trim(),
    outlet_type: parseOutletType(input.outletType),
    listing_status: Number(input.listingStatus) || 0,
    region_id: input.regionId || null,
    address: input.address.trim(),
    state: input.state,
    lga: input.lga,
    gpslatitude: input.latitude,
    gpslongitude: input.longitude,
    registrationaccuracymeters: input.accuracy,
    registration_location_captured_on: input.capturedOn,
    contact_person_name: input.contactName.trim() || null,
    contact_person_phone: input.contactPhone.trim() || null,
    contact_person_email: input.contactEmail.trim() || null,
    assigned_manager: input.assignedManager || null,
    visit_remarks: input.remarks.trim() || null,
  };
}

/** Turns a PostgREST error into a message the user can act on. */
function outletDbError(action: string, error: { code?: string; message?: string } | null): Error {
  const code = error?.code ?? "";
  const msg = error?.message ?? "Unknown database error";
  if (code === "42501" || /row-level security/i.test(msg)) {
    return new Error(
      `Unable to ${action} outlet: your account does not have database permission to write outlets. ` +
        `Ask an administrator to apply the "outlets_write_rls" migration in Supabase.`
    );
  }
  if (code === "22P02") {
    return new Error(`Unable to ${action} outlet: one of the fields has an invalid format (${msg}).`);
  }
  if (code === "23505") {
    return new Error(`Unable to ${action} outlet: an outlet with these details already exists.`);
  }
  return new Error(`Unable to ${action} outlet: ${msg}`);
}

export async function createOutlet(input: CreateOutletInput): Promise<Outlet> {
  if (!input.regionId?.trim()) {
    throw new Error("Sales region is required.");
  }

  const normalizedName = input.name.trim();

  // Guard against duplicate outlet creation:
  const localList = getLocalOutlets();
  const duplicate = localList.find(
    (o) =>
      o.name.trim().toLowerCase() === normalizedName.toLowerCase() &&
      o.state?.toLowerCase() === input.state?.toLowerCase() &&
      o.lga?.toLowerCase() === input.lga?.toLowerCase()
  );
  if (duplicate) {
    throw new Error(
      `An outlet named "${normalizedName}" already exists at this location (${input.lga || ""}, ${input.state || ""}). Duplicate outlet creation prevented.`
    );
  }

  const payload = buildOutletPayload(input);
  let { data, error } = await supabase
    .from("outlets")
    .insert({ ...payload, created_at: new Date().toISOString() })
    .select("*")
    .single();

  if (error && sanitizePayloadForLegacySchema(payload, error)) {
    console.warn("DB schema mismatch; retrying insert with sanitized payload:", error.message);
    const retry = await supabase
      .from("outlets")
      .insert({ ...payload, created_at: new Date().toISOString() })
      .select("*")
      .single();
    data = retry.data;
    error = retry.error;

    if (error && sanitizePayloadForLegacySchema(payload, error)) {
      const retry2 = await supabase
        .from("outlets")
        .insert({ ...payload, created_at: new Date().toISOString() })
        .select("*")
        .single();
      data = retry2.data;
      error = retry2.error;
    }
  }

  if (error || !data) {
    console.error("createOutlet Supabase error:", error);
    throw outletDbError("create", error);
  }

  const saved: Outlet = {
    ...normalizeRemoteOutlet(data),
    region_id: input.regionId,
    assigned_manager: input.assignedManager,
    outlet_type: input.outletType,
  };
  saveLocalOutlet(saved);
  return saved;
}

export async function updateOutlet(
  id: string,
  input: CreateOutletInput
): Promise<Outlet> {
  if (!input.regionId?.trim()) {
    throw new Error("Sales region is required.");
  }

  const payload = buildOutletPayload(input);

  let { data, error } = await supabase
    .from("outlets")
    .update(payload)
    .eq("id", id)
    .select("*");

  if (error && sanitizePayloadForLegacySchema(payload, error)) {
    console.warn("DB schema mismatch; retrying update with sanitized payload:", error.message);
    const retry = await supabase
      .from("outlets")
      .update(payload)
      .eq("id", id)
      .select("*");
    data = retry.data;
    error = retry.error;

    if (error && sanitizePayloadForLegacySchema(payload, error)) {
      const retry2 = await supabase
        .from("outlets")
        .update(payload)
        .eq("id", id)
        .select("*");
      data = retry2.data;
      error = retry2.error;
    }
  }

  if (error) {
    console.error("updateOutlet Supabase error:", error);
    throw outletDbError("update", error);
  }

  let saved: Outlet | null = data && data.length > 0 ? normalizeRemoteOutlet(data[0]) : null;

  if (!saved) {
    // No row was updated: either the outlet only exists in this browser, or RLS
    // filtered the update out. Distinguish the two before deciding what to do.
    const { data: existing } = await supabase.from("outlets").select("id").eq("id", id).maybeSingle();

    if (existing) {
      throw outletDbError("update", { code: "42501", message: "row-level security" });
    }

    const insertPayload: Record<string, unknown> = { ...payload, id: isValidUuid(id) ? id : generateUuid() };
    let { data: inserted, error: insertError } = await supabase
      .from("outlets")
      .insert(insertPayload)
      .select("*")
      .single();

    if (insertError && sanitizePayloadForLegacySchema(insertPayload, insertError)) {
      const retry = await supabase
        .from("outlets")
        .insert(insertPayload)
        .select("*")
        .single();
      inserted = retry.data;
      insertError = retry.error;

      if (insertError && sanitizePayloadForLegacySchema(insertPayload, insertError)) {
        const retry2 = await supabase
          .from("outlets")
          .insert(insertPayload)
          .select("*")
          .single();
        inserted = retry2.data;
        insertError = retry2.error;
      }
    }

    if (insertError || !inserted) {
      console.error("updateOutlet (sync local outlet) Supabase error:", insertError);
      throw outletDbError("save", insertError);
    }
    saved = normalizeRemoteOutlet(inserted);
    if (saved.id !== id) removeLocalOutlet(id);
  }

  const finalSaved: Outlet = {
    ...saved,
    region_id: input.regionId,
    assigned_manager: input.assignedManager,
    outlet_type: input.outletType,
  };
  saveLocalOutlet(finalSaved);
  return finalSaved;
}

export async function deleteOutlet(id: string) {
  removeLocalOutlet(id);
  try {
    await supabase.from("outlets").delete().eq("id", id);
  } catch (e) {
    if (e) {
      console.error("deleteOutlet remote error:", e);
    }
  }
}

/** Updates an outlet's registered GPS location in Supabase and local storage */
export async function calibrateOutletGps(
  outletId: string,
  latitude: number,
  longitude: number,
  accuracy?: number | null
): Promise<Outlet | null> {
  try {
    const payload = {
      gpslatitude: latitude,
      gpslongitude: longitude,
      registrationaccuracymeters: accuracy ? Math.round(accuracy) : 10,
      registration_location_captured_on: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("outlets")
      .update(payload)
      .eq("id", outletId)
      .select("*")
      .maybeSingle();

    if (error) {
      console.warn("calibrateOutletGps DB update notice:", error);
    }

    const localStr = localStorage.getItem(STORAGE_KEY_OUTLETS);
    if (localStr) {
      try {
        const items: Outlet[] = JSON.parse(localStr);
        const idx = items.findIndex((i) => String(i.id) === String(outletId));
        if (idx !== -1) {
          items[idx] = {
            ...items[idx],
            gpslatitude: latitude,
            gpslongitude: longitude,
            registrationaccuracymeters: accuracy ? Math.round(accuracy) : 10,
          };
          localStorage.setItem(STORAGE_KEY_OUTLETS, JSON.stringify(items));
        }
      } catch (e) {}
    }

    return data as Outlet | null;
  } catch (err) {
    console.warn("calibrateOutletGps exception:", err);
    return null;
  }
}

export async function getAssignableStaff() {
  try {
    const { data, error } = await supabase
      .from("staff")
      .select("id, name")
      .eq("is_active", true)
      .order("name");

    if (!error && data && data.length > 0) {
      return data;
    }
  } catch (e) {
    console.warn("getAssignableStaff remote notice:", e);
  }

  return [];
}

export type DrinkType = {
  id: string;
  name: string;
  category: string | null;
  bottles_per_case: number;
  price_per_bottle: number;
  price_per_case: number;
  created_at?: string | null;
  created_by?: string | null;
};

export type CreateDrinkTypeInput = {
  name: string;
  category: string | null;
  price_per_bottle: number;
  price_per_case: number;
  bottles_per_case: number;
  created_by?: string | null;
};

export async function getDrinkTypes(): Promise<DrinkType[]> {
  // First attempt selecting with created_at and created_by
  const { data, error } = await supabase
    .from("drink_types")
    .select("id, name, category, bottles_per_case, price_per_bottle, price_per_case, created_at, created_by")
    .order("name");

  if (!error && data) {
    return data;
  }

  // Fallback if created_at or created_by columns do not exist yet on remote table
  const fallback = await supabase
    .from("drink_types")
    .select("id, name, category, bottles_per_case, price_per_bottle, price_per_case")
    .order("name");

  if (fallback.error) {
    console.error("Error fetching drink_types:", fallback.error);
    return [];
  }

  return fallback.data ?? [];
}

export async function createDrinkType(input: CreateDrinkTypeInput): Promise<DrinkType> {
  const payload: Record<string, any> = {
    name: input.name.trim(),
    category: input.category?.trim() || null,
    price_per_bottle: Number(input.price_per_bottle) || 0,
    price_per_case: Number(input.price_per_case) || 0,
    bottles_per_case: Number(input.bottles_per_case) || 12,
  };

  if (input.created_by) {
    payload.created_by = input.created_by;
  }

  let data = null;
  let error = null;

  const res = await supabase.from("drink_types").insert(payload).select().single();
  data = res.data;
  error = res.error;

  // Fallback if created_by column is not yet added in remote table
  if (error && "created_by" in payload) {
    delete payload.created_by;
    const fb = await supabase.from("drink_types").insert(payload).select().single();
    data = fb.data;
    error = fb.error;
  }

  if (error) {
    console.error("Error creating drink type:", error);
    throw new Error(error.message || "Failed to create drink type in Supabase.");
  }

  return data;
}

export async function updateDrinkType(id: string, input: CreateDrinkTypeInput): Promise<DrinkType> {
  const payload = {
    name: input.name.trim(),
    category: input.category?.trim() || null,
    price_per_bottle: Number(input.price_per_bottle) || 0,
    price_per_case: Number(input.price_per_case) || 0,
    bottles_per_case: Number(input.bottles_per_case) || 12,
  };

  const { data, error } = await supabase
    .from("drink_types")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating drink type:", error);
    if (error.code === "23503" || /foreign key constraint|fk_sales_drink_type/i.test(error.message || "")) {
      throw new Error("Cannot modify this drink product because it has existing recorded sales or targets linked to it.");
    }
    throw new Error(error.message || "Failed to update drink type in Supabase.");
  }

  return data;
}

export async function deleteDrinkType(id: string): Promise<void> {
  const { error } = await supabase
    .from("drink_types")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting drink type:", error);
    if (error.code === "23503" || /foreign key constraint|fk_sales_drink_type/i.test(error.message || "")) {
      throw new Error("Cannot delete this drink product because it has existing recorded sales or targets linked to it.");
    }
    throw new Error(error.message || "Failed to delete drink type from Supabase.");
  }
}
