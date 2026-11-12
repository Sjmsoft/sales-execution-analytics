import { supabase } from "../lib/supabase";
import { canonicalizeRegionName } from "./regionService";

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
const STORAGE_KEY_OUTLET_REGIONS = "penedge_outlet_selected_regions_v1";

function getSelectedOutletRegionsMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_OUTLET_REGIONS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch (e) {
    console.warn("localStorage outlet regions read error:", e);
  }
  return {};
}

export function saveSelectedOutletRegion(
  id: string | null | undefined,
  name: string | null | undefined,
  regionId: string | null | undefined
): void {
  const canonical = canonicalizeRegionName(regionId) || (regionId || "").trim();
  if (!canonical || isValidUuid(canonical)) return;
  try {
    const map = getSelectedOutletRegionsMap();
    if (id && id.trim()) {
      map[`id:${id.trim()}`] = canonical;
    }
    if (name && name.trim()) {
      map[`name:${name.trim().toLowerCase()}`] = canonical;
    }
    localStorage.setItem(STORAGE_KEY_OUTLET_REGIONS, JSON.stringify(map));
  } catch (e) {
    console.warn("localStorage outlet regions write error:", e);
  }
}

export function lookupSelectedOutletRegion(
  id?: string | null,
  name?: string | null
): string | null {
  const map = getSelectedOutletRegionsMap();
  if (id && map[`id:${id.trim()}`]) {
    const val = map[`id:${id.trim()}`];
    return canonicalizeRegionName(val) || val;
  }
  if (name && name.trim() && map[`name:${name.trim().toLowerCase()}`]) {
    const val = map[`name:${name.trim().toLowerCase()}`];
    return canonicalizeRegionName(val) || val;
  }
  return null;
}

function extractEmbeddedRegionFromRemarks(remarks?: string | null): {
  embeddedRegion: string | null;
  cleanRemarks: string | null;
} {
  if (!remarks) return { embeddedRegion: null, cleanRemarks: remarks ?? null };
  const match = remarks.match(/\[Region:\s*([^\]]+)\]/i);
  if (!match) return { embeddedRegion: null, cleanRemarks: remarks };
  const extracted = canonicalizeRegionName(match[1].trim()) || match[1].trim();
  const cleaned = remarks.replace(/\s*\[Region:\s*[^\]]+\]\s*/gi, " ").trim();
  return {
    embeddedRegion: extracted || null,
    cleanRemarks: cleaned || null,
  };
}

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
        let updated = o;
        if (!isValidUuid(o.id)) {
          needsResave = true;
          updated = { ...updated, id: generateUuid() };
        }
        const selectedOverride = lookupSelectedOutletRegion(updated.id, updated.name);
        const { embeddedRegion, cleanRemarks } = extractEmbeddedRegionFromRemarks(
          updated.visit_remarks
        );
        if (cleanRemarks !== updated.visit_remarks) {
          needsResave = true;
          updated = { ...updated, visit_remarks: cleanRemarks };
        }
        const existingRegion =
          updated.region_id &&
            !isValidUuid(String(updated.region_id)) &&
            String(updated.region_id).toLowerCase() !== "unassigned"
            ? String(updated.region_id).trim()
            : null;
        const chosenRegion =
          selectedOverride ||
          embeddedRegion ||
          existingRegion ||
          inferOutletRegion(updated);
        const canonical = chosenRegion
          ? canonicalizeRegionName(chosenRegion) || chosenRegion
          : null;
        if (canonical && canonical !== updated.region_id) {
          needsResave = true;
          updated = { ...updated, region_id: canonical };
        }
        return updated;
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
    const canonicalRegion =
      canonicalizeRegionName(outlet.region_id) || outlet.region_id;
    const normalizedOutlet: Outlet = {
      ...outlet,
      region_id: canonicalRegion,
    };
    saveSelectedOutletRegion(
      normalizedOutlet.id,
      normalizedOutlet.name,
      normalizedOutlet.region_id
    );
    const current = getLocalOutlets();
    const idx = current.findIndex(
      (o) =>
        o.id === normalizedOutlet.id ||
        o.name.trim().toLowerCase() === normalizedOutlet.name.trim().toLowerCase()
    );
    const updated =
      idx >= 0
        ? current.map((o, i) => (i === idx ? normalizedOutlet : o))
        : [normalizedOutlet, ...current];
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
      const localByName = new Map(
        localList.map((o) => [o.name.trim().toLowerCase(), o])
      );
      const remoteList: Outlet[] = data.map((d) => {
        const local =
          localById.get(d.id) ||
          localByName.get(String(d.name || "").trim().toLowerCase());
        const norm = normalizeRemoteOutlet(d, local);
        const enriched = { ...norm };
        if (
          local?.outlet_type &&
          isNaN(Number(local.outlet_type)) &&
          typeof norm.outlet_type === "number"
        ) {
          enriched.outlet_type = local.outlet_type;
        }
        if (local?.assigned_manager && !norm.assigned_manager) {
          enriched.assigned_manager = local.assigned_manager;
        }
        return enriched;
      });
      const remoteById = new Map(remoteList.map((o) => [o.id, o]));
      const remoteByName = new Map(
        remoteList.map((o) => [o.name.trim().toLowerCase(), o])
      );

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

export function inferOutletRegion(o: {
  region_id?: string | null;
  region?: string | null;
  state?: string | null;
  lga?: string | null;
  address?: string | null;
  name?: string | null;
}): string | null {
  const rawRegion = (o.region_id || o.region || "").trim();
  if (
    rawRegion &&
    !isValidUuid(rawRegion) &&
    !["unassigned", "null", "none", "n/a"].includes(rawRegion.toLowerCase())
  ) {
    return canonicalizeRegionName(rawRegion) || rawRegion;
  }

  const hay = `${o.lga || ""} ${o.address || ""} ${o.name || ""}`.toLowerCase();
  const st = (o.state || "").toLowerCase();

  if (
    /\b(lekki|ajah|ikate|chevron|marwa|jakande|agungi|osapa|igbo[\s-]*efon|ikota|vgc|sangotedo|abijo|ibeju|chisco|admiralty)\b/.test(
      hay
    )
  ) {
    return "Lekki";
  }
  if (
    /\b(victoria[\s-]*island|v\.?i\b|oniru|adeola[\s-]*odeku|sanusi[\s-]*fafunwa|ajose[\s-]*adeogun|kofo[\s-]*abayomi|akin[\s-]*adesola|ozumba[\s-]*mbadiwe|ligali[\s-]*ayorinde|ikoyi|banana[\s-]*island|awolowo[\s-]*rd|awolowo[\s-]*road)\b/.test(
      hay
    )
  ) {
    return "Victoria Island";
  }
  if (
    /\b(ikeja|allen|opebi|alausa|ogba|adeniyi[\s-]*jones|maryland|omole|magodo|computer[\s-]*village)\b/.test(
      hay
    )
  ) {
    return "Ikeja";
  }
  if (
    /\b(surulere|bode[\s-]*thomas|adeniran[\s-]*ogunsanya|ojuelegba|aguda|iponri|eric[\s-]*moore|adelabu|lawanson|kilo)\b/.test(
      hay
    )
  ) {
    return "Surulere";
  }
  if (/\b(eti[\s-]*osa|lagos[\s-]*island|marina|broad[\s-]*street|onikan|obalende)\b/.test(hay)) {
    return "Lagos Island";
  }
  if (st.includes("lagos")) {
    return "Lagos mainland";
  }
  if (
    st.includes("river") ||
    /\b(port[\s-]*harcourt|portharcourt|obio[\s-]*akpor|eleme|oyigbo|ikwerre|okrika|bonny|trans[\s-]*amadi|peter[\s-]*odili|rumuola|rumuokoro|rumuomasi|ada[\s-]*george|woji|diobu|eliozu)\b/.test(
      hay
    )
  ) {
    return "Portharcourt - South";
  }
  if (
    st.includes("fct") ||
    st.includes("abuja") ||
    /\b(abuja|bwari|gwagwalada|kuje|kwali|abaji|wuse|maitama|garki|asokoro|gwarinpa|jabi|utako|kubwa|lugbe|karu|nyanya|lokogoma|gudu|apo|katampe|life[\s-]*camp|mabushi|dawaki)\b/.test(
      hay
    )
  ) {
    return "Abuja - North";
  }
  if (
    st.includes("enugu") ||
    /\b(enugu|nsukka|trans[\s-]*ekulu|independence[\s-]*layout|new[\s-]*haven|agbani|achara|ogui|uwani|abakpa|emene)\b/.test(
      hay
    )
  ) {
    return "Enugu- East";
  }
  if (
    st.includes("edo") ||
    /\b(benin|oredo|egor|ikpoba|uhunmwonde|ovia|esan|ugbowo|sapele[\s-]*road|uselu|adesuwa|ihama|ekpoma|auchi)\b/.test(
      hay
    )
  ) {
    return "Edo Region";
  }
  if (st.includes("anambra") || /\b(anambra|awka|onitsha|nnewi|aguata|ekwulobia|obosi|ogidi)\b/.test(hay)) {
    return "Anambra";
  }
  if (st.includes("oyo") || /\b(ibadan|oyo|bodija|oluyole|dugbe|agodi|mokola|akobo|samonda|jericho|ogbomosho)\b/.test(hay)) {
    return "Ibadan";
  }
  return null;
}

export function getExactOutletRegion(outlet: {
  id?: string | null;
  name?: string | null;
  region_id?: string | null;
  region?: string | null;
  visit_remarks?: string | null;
  state?: string | null;
  lga?: string | null;
  address?: string | null;
}): string | null {
  const selectedOverride = lookupSelectedOutletRegion(outlet.id, outlet.name);
  if (selectedOverride) return selectedOverride;

  const { embeddedRegion } = extractEmbeddedRegionFromRemarks(outlet.visit_remarks);
  if (embeddedRegion) return embeddedRegion;

  const explicit = (outlet.region_id || outlet.region || "").trim();
  if (
    explicit &&
    !isValidUuid(explicit) &&
    !["unassigned", "null", "none", "n/a"].includes(explicit.toLowerCase())
  ) {
    return canonicalizeRegionName(explicit) || explicit;
  }

  const inferred = inferOutletRegion(outlet);
  return inferred ? canonicalizeRegionName(inferred) || inferred : null;
}

export function doesOutletMatchRegion(
  outlet: Outlet,
  selectedRegion: string,
  _staffRegionMap?: Map<string, string[]>
): boolean {
  const rawSelected = selectedRegion.trim();
  if (!rawSelected) return true;

  const targetRegion = (canonicalizeRegionName(rawSelected) || rawSelected)
    .trim()
    .toLowerCase();
  const outletRegion = (getExactOutletRegion(outlet) || "").trim().toLowerCase();

  return Boolean(outletRegion) && outletRegion === targetRegion;
}

function normalizeRemoteOutlet(o: any, local?: Outlet): Outlet {
  const { embeddedRegion, cleanRemarks } = extractEmbeddedRegionFromRemarks(
    o.visit_remarks
  );
  const selectedOverride = lookupSelectedOutletRegion(o.id, o.name);
  const explicitRemote =
    o.region_id &&
      !isValidUuid(String(o.region_id)) &&
      String(o.region_id).toLowerCase() !== "unassigned"
      ? String(o.region_id).trim()
      : o.region &&
        !isValidUuid(String(o.region)) &&
        String(o.region).toLowerCase() !== "unassigned"
        ? String(o.region).trim()
        : null;
  const localRegion =
    local?.region_id &&
      !isValidUuid(String(local.region_id)) &&
      String(local.region_id).toLowerCase() !== "unassigned"
      ? String(local.region_id).trim()
      : null;

  const chosenRegion =
    selectedOverride ||
    explicitRemote ||
    embeddedRegion ||
    localRegion ||
    inferOutletRegion(o);

  const canonicalRegion = chosenRegion
    ? canonicalizeRegionName(chosenRegion) || chosenRegion
    : null;

  return {
    ...o,
    visit_remarks: cleanRemarks,
    region_id: canonicalRegion,
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

export function isOutletOffTrade(outletType: unknown): boolean {
  if (outletType === 2 || outletType === "2" || outletType === "off-trade" || outletType === "off_trade") return true;
  if (outletType === 4 || outletType === "4" || outletType === "mt" || outletType === "modern_trade" || outletType === "modern trade") return true;
  if (outletType === 1 || outletType === "1" || outletType === "on-trade" || outletType === "on_trade") return false;
  const intType = toIntegerOutletType(outletType);
  return intType === 2 || intType === 4;
}

export function isOutletOnTrade(outletType: unknown): boolean {
  return !isOutletOffTrade(outletType);
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
 * Preserves the exact selected region inside visit_remarks so it is never lost
 * even on legacy schemas where region_id is a UUID column.
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
      const regionLabel =
        canonicalizeRegionName(String(payload.region_id)) ||
        String(payload.region_id).trim();
      const existingRemarks = String(payload.visit_remarks || "")
        .replace(/\s*\[Region:\s*[^\]]+\]\s*/gi, " ")
        .trim();
      payload.visit_remarks = existingRemarks
        ? `${existingRemarks} [Region: ${regionLabel}]`
        : `[Region: ${regionLabel}]`;
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
    return normalizeRemoteOutlet(data, local);
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
  const canonicalRegion =
    canonicalizeRegionName(input.regionId) || input.regionId.trim() || null;
  return {
    name: input.name.trim(),
    outlet_type: parseOutletType(input.outletType),
    listing_status: Number(input.listingStatus) || 0,
    region_id: canonicalRegion,
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
  const exactSelectedRegion =
    canonicalizeRegionName(input.regionId) || input.regionId.trim();

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

  // Persist the exact selected region by outlet name immediately so even if DB
  // strips region_id for legacy UUID compatibility, the selected region is preserved
  saveSelectedOutletRegion(null, normalizedName, exactSelectedRegion);

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

  saveSelectedOutletRegion(data.id, normalizedName, exactSelectedRegion);

  const saved: Outlet = {
    ...normalizeRemoteOutlet(data),
    region_id: exactSelectedRegion,
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

  const exactSelectedRegion =
    canonicalizeRegionName(input.regionId) || input.regionId.trim();
  saveSelectedOutletRegion(id, input.name.trim(), exactSelectedRegion);

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

  saveSelectedOutletRegion(saved.id, input.name.trim(), exactSelectedRegion);

  const finalSaved: Outlet = {
    ...saved,
    region_id: exactSelectedRegion,
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
      } catch (e) { }
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
      .select("id, name, region, assigned_regions")
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
  distributor_price?: number;
  wholesale_price?: number;
  retail_price?: number;
  created_at?: string | null;
  created_by?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
};

export type CreateDrinkTypeInput = {
  name: string;
  category: string | null;
  price_per_bottle: number;
  price_per_case: number;
  bottles_per_case: number;
  distributor_price?: number;
  wholesale_price?: number;
  retail_price?: number;
  old_distributor_price?: number;
  old_wholesale_price?: number;
  old_retail_price?: number;
  created_by?: string | null;
  changed_by_id?: string | null;
};

export type PricingHistoryEntry = {
  id: string;
  drink_type: string | null;
  drink_type_name1: string;
  change_type: number;
  old_distributor_price: number;
  new_distributor_price: number;
  old_wholesale_price: number;
  new_wholesale_price: number;
  old_retail_price: number;
  new_retail_price: number;
  changed_at: string;
  changed_by: string | null;
  changed_by_name1: string;
  reference: string | null;
};

export type UpdateProductCasePricingInput = {
  drinkId: string;
  drinkName: string;
  distributorPrice: number;
  wholesalePrice: number;
  retailPrice: number;
  oldDistributorPrice?: number;
  oldWholesalePrice?: number;
  oldRetailPrice?: number;
  changedById?: string | null;
  changedByName?: string | null;
};

function normalizeDrinkTypeRow(row: any): DrinkType {
  const pricePerCase = Number(row.price_per_case ?? 0);
  const distPrice = Number(row.distributor_price ?? 0);
  const wholePrice = Number(row.wholesale_price ?? 0);
  const retPrice = Number(row.retail_price ?? 0);
  const hasAnyTier = distPrice > 0 || wholePrice > 0 || retPrice > 0;

  return {
    id: String(row.id),
    name: String(row.name || ""),
    category: row.category ?? null,
    bottles_per_case: Number(row.bottles_per_case ?? 12) || 12,
    price_per_bottle: Number(row.price_per_bottle ?? 0),
    price_per_case: pricePerCase,
    distributor_price: hasAnyTier ? distPrice : pricePerCase,
    wholesale_price: hasAnyTier ? wholePrice : pricePerCase,
    retail_price: hasAnyTier ? retPrice : pricePerCase,
    created_at: row.created_at ?? null,
    created_by: row.created_by ?? null,
    updated_at: row.updated_at ?? null,
    updated_by: row.updated_by ?? null,
  };
}

export async function getDrinkTypes(): Promise<DrinkType[]> {
  // First attempt selecting all columns including tiered case prices
  const { data, error } = await supabase
    .from("drink_types")
    .select(
      "id, name, category, bottles_per_case, price_per_bottle, price_per_case, distributor_price, wholesale_price, retail_price, created_at, created_by, updated_at, updated_by"
    )
    .order("name");

  if (!error && data) {
    return data.map(normalizeDrinkTypeRow);
  }

  // Fallback if some audit columns do not exist yet on remote table
  const fallback = await supabase
    .from("drink_types")
    .select("*")
    .order("name");

  if (fallback.error) {
    console.error("Error fetching drink_types:", fallback.error);
    return [];
  }

  return (fallback.data ?? []).map(normalizeDrinkTypeRow);
}

export async function createDrinkType(input: CreateDrinkTypeInput): Promise<DrinkType> {
  const defaultCasePrice = Number(input.price_per_case) || 0;
  const distPrice =
    input.distributor_price !== undefined ? Number(input.distributor_price) || 0 : defaultCasePrice;
  const wholePrice =
    input.wholesale_price !== undefined ? Number(input.wholesale_price) || 0 : defaultCasePrice;
  const retPrice =
    input.retail_price !== undefined ? Number(input.retail_price) || 0 : defaultCasePrice;

  const payload: Record<string, any> = {
    name: input.name.trim(),
    category: input.category?.trim() || null,
    price_per_bottle: Number(input.price_per_bottle) || 0,
    price_per_case: defaultCasePrice || distPrice || wholePrice || retPrice,
    bottles_per_case: Number(input.bottles_per_case) || 12,
    distributor_price: distPrice,
    wholesale_price: wholePrice,
    retail_price: retPrice,
  };

  if (input.created_by) {
    payload.created_by = input.created_by;
  }

  let data = null;
  let error = null;

  const res = await supabase.from("drink_types").insert(payload).select().single();
  data = res.data;
  error = res.error;

  // Fallback if optional columns are not yet present
  if (error) {
    const minimalPayload: Record<string, any> = {
      name: input.name.trim(),
      category: input.category?.trim() || null,
      price_per_bottle: Number(input.price_per_bottle) || 0,
      price_per_case: defaultCasePrice || distPrice || wholePrice || retPrice,
      bottles_per_case: Number(input.bottles_per_case) || 12,
      distributor_price: distPrice,
      wholesale_price: wholePrice,
      retail_price: retPrice,
    };
    const fb = await supabase.from("drink_types").insert(minimalPayload).select().single();
    data = fb.data;
    error = fb.error;
  }

  if (error) {
    console.error("Error creating drink type:", error);
    throw new Error(error.message || "Failed to create drink type in Supabase.");
  }

  // Write pricing_history audit row when product is created with tiered case prices
  if (distPrice > 0 || wholePrice > 0 || retPrice > 0) {
    try {
      await supabase.from("pricing_history").insert({
        id: generateUuid(),
        drink_type: isValidUuid(data?.id) ? data.id : null,
        drink_type_name1: input.name.trim(),
        old_distributor_price: 0,
        new_distributor_price: distPrice,
        old_wholesale_price: 0,
        new_wholesale_price: wholePrice,
        old_retail_price: 0,
        new_retail_price: retPrice,
        changed_at: new Date().toISOString(),
        changed_by: isValidUuid(input.changed_by_id) ? input.changed_by_id : null,
        changed_by_name1: input.created_by || "Admin",
        change_type: 2,
        reference: `PRC-${Date.now()}`,
      });
    } catch (histErr) {
      console.warn("Notice writing pricing_history create audit row:", histErr);
    }
  }

  return normalizeDrinkTypeRow(data);
}

export async function updateDrinkType(id: string, input: CreateDrinkTypeInput): Promise<DrinkType> {
  const distPrice =
    input.distributor_price !== undefined ? Number(input.distributor_price) || 0 : undefined;
  const wholePrice =
    input.wholesale_price !== undefined ? Number(input.wholesale_price) || 0 : undefined;
  const retPrice =
    input.retail_price !== undefined ? Number(input.retail_price) || 0 : undefined;

  let oldDist = input.old_distributor_price;
  let oldWhole = input.old_wholesale_price;
  let oldRetail = input.old_retail_price;

  if (
    (distPrice !== undefined || wholePrice !== undefined || retPrice !== undefined) &&
    (oldDist === undefined || oldWhole === undefined || oldRetail === undefined)
  ) {
    try {
      const { data: existing } = await supabase
        .from("drink_types")
        .select("distributor_price, wholesale_price, retail_price")
        .eq("id", id)
        .maybeSingle();
      if (existing) {
        if (oldDist === undefined) oldDist = Number(existing.distributor_price ?? 0);
        if (oldWhole === undefined) oldWhole = Number(existing.wholesale_price ?? 0);
        if (oldRetail === undefined) oldRetail = Number(existing.retail_price ?? 0);
      }
    } catch {
      // ignore fallback fetch error
    }
  }

  const resolvedCasePrice =
    Number(input.price_per_case) || distPrice || wholePrice || retPrice || 0;

  const payload: Record<string, any> = {
    name: input.name.trim(),
    category: input.category?.trim() || null,
    price_per_bottle: Number(input.price_per_bottle) || 0,
    price_per_case: resolvedCasePrice,
    bottles_per_case: Number(input.bottles_per_case) || 12,
  };

  if (distPrice !== undefined) payload.distributor_price = distPrice;
  if (wholePrice !== undefined) payload.wholesale_price = wholePrice;
  if (retPrice !== undefined) payload.retail_price = retPrice;

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

  // Write pricing_history audit row when tiered case prices are updated
  if (distPrice !== undefined || wholePrice !== undefined || retPrice !== undefined) {
    try {
      const { error: histInsertErr } = await supabase.from("pricing_history").insert({
        id: generateUuid(),
        drink_type: isValidUuid(id) ? id : null,
        drink_type_name1: input.name.trim(),
        old_distributor_price: Number(oldDist ?? 0),
        new_distributor_price: distPrice ?? 0,
        old_wholesale_price: Number(oldWhole ?? 0),
        new_wholesale_price: wholePrice ?? 0,
        old_retail_price: Number(oldRetail ?? 0),
        new_retail_price: retPrice ?? 0,
        changed_at: new Date().toISOString(),
        changed_by: isValidUuid(input.changed_by_id) ? input.changed_by_id : null,
        changed_by_name1: input.created_by || "Admin",
        change_type: 1,
        reference: `PRC-${Date.now()}`,
      });
      if (histInsertErr) {
        console.warn("pricing_history insert warning:", histInsertErr.message);
      }
    } catch (histErr) {
      console.warn("Notice writing pricing_history audit row:", histErr);
    }
  }

  return normalizeDrinkTypeRow(data);
}

export async function updateProductCasePricing(
  input: UpdateProductCasePricingInput
): Promise<DrinkType> {
  const dist = Math.max(0, Number(input.distributorPrice) || 0);
  const whole = Math.max(0, Number(input.wholesalePrice) || 0);
  const retail = Math.max(0, Number(input.retailPrice) || 0);

  const updatePayload: Record<string, any> = {
    distributor_price: dist,
    wholesale_price: whole,
    retail_price: retail,
    updated_at: new Date().toISOString(),
    updated_by: input.changedByName || "System Admin",
  };

  let { data, error } = await supabase
    .from("drink_types")
    .update(updatePayload)
    .eq("id", input.drinkId)
    .select("*")
    .single();

  if (error) {
    // Retry without updated_at / updated_by if those columns aren't present
    const retryPayload = {
      distributor_price: dist,
      wholesale_price: whole,
      retail_price: retail,
    };
    const retry = await supabase
      .from("drink_types")
      .update(retryPayload)
      .eq("id", input.drinkId)
      .select("*")
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error || !data) {
    console.error("Error updating product case pricing in Supabase:", error);
    throw new Error(error?.message || "Failed to save product case pricing to Supabase.");
  }

  // Also write an audit record to public.pricing_history in Supabase
  try {
    const historyPayload: Record<string, any> = {
      drink_type: isValidUuid(input.drinkId) ? input.drinkId : null,
      drink_type_name1: input.drinkName,
      old_distributor_price: Number(input.oldDistributorPrice ?? 0),
      new_distributor_price: dist,
      old_wholesale_price: Number(input.oldWholesalePrice ?? 0),
      new_wholesale_price: whole,
      old_retail_price: Number(input.oldRetailPrice ?? 0),
      new_retail_price: retail,
      changed_at: new Date().toISOString(),
      changed_by: isValidUuid(input.changedById) ? input.changedById : null,
      changed_by_name1: input.changedByName || "System Admin",
      change_type: 1,
      reference: `PRC-${Date.now()}`,
    };
    await supabase.from("pricing_history").insert(historyPayload);
  } catch (histErr) {
    console.warn("Notice writing pricing_history audit row:", histErr);
  }

  return normalizeDrinkTypeRow(data);
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

export async function getPricingHistory(): Promise<PricingHistoryEntry[]> {
  const { data, error } = await supabase
    .from("pricing_history")
    .select(
      "id, drink_type, drink_type_name1, change_type, old_distributor_price, new_distributor_price, old_wholesale_price, new_wholesale_price, old_retail_price, new_retail_price, changed_at, changed_by, changed_by_name1, reference"
    )
    .order("changed_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("Error fetching pricing_history:", error);
    throw new Error(error.message || "Failed to load pricing history from Supabase.");
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    drink_type: row.drink_type ?? null,
    drink_type_name1: String(row.drink_type_name1 || "Unknown Product"),
    change_type: Number(row.change_type ?? 1),
    old_distributor_price: Number(row.old_distributor_price ?? 0),
    new_distributor_price: Number(row.new_distributor_price ?? 0),
    old_wholesale_price: Number(row.old_wholesale_price ?? 0),
    new_wholesale_price: Number(row.new_wholesale_price ?? 0),
    old_retail_price: Number(row.old_retail_price ?? 0),
    new_retail_price: Number(row.new_retail_price ?? 0),
    changed_at: row.changed_at || new Date().toISOString(),
    changed_by: row.changed_by ?? null,
    changed_by_name1: String(row.changed_by_name1 || "Admin"),
    reference: row.reference ?? null,
  }));
}

export async function clearPricingHistory(): Promise<void> {
  const { error } = await supabase
    .from("pricing_history")
    .delete()
    .not("id", "is", null);

  if (error) {
    console.error("Error clearing pricing_history:", error);
    throw new Error(error.message || "Failed to clear pricing history in Supabase.");
  }
}
