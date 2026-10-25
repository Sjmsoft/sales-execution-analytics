import { supabase } from "../lib/supabase";
import { getDrinkTypes, isValidUuid, generateUuid } from "./referenceService";
import type { Sale } from "./salesService";

export type TargetUnit = "Bottles" | "Cases";
export type TargetType = "Daily Bottles" | "Weekly Cases" | "Monthly Revenue" | "Visit Targets";
export type TargetStatus = "Active" | "Completed" | "Behind Pace" | "Pending";

export type DrinkTargetItem = {
  drinkId: string;
  drinkName: string;
  quantity: number;
  unit: TargetUnit;
};

export type TargetRecord = {
  id: string;
  title: string;
  productName: string;
  isBundle: boolean;
  bundleCount?: number;
  bundledDrinks?: string[];
  salesRep: {
    id: string;
    name: string;
    region: string;
    role: string;
  };
  targetQuantity: number;
  unit: TargetUnit;
  targetType: TargetType;
  startDate: string;
  endDate: string;
  achievedQuantity: number;
  progressPercent: number;
  status: TargetStatus;
  variance?: number;
  matchingSales?: Sale[];
  createdAt: string;
  createdBy: string;
};

export type PushNotificationRecord = {
  id: string;
  template: string;
  targetType: string;
  recipientsRole: string;
  recipientNames: string[];
  notificationType: "Email" | "SMS" | "In-App" | "Push";
  timing: "Immediate" | "Scheduled";
  scheduledFor?: string;
  status: "Delivered" | "Pending" | "Scheduled";
  sentAt: string;
  sentBy: string;
};

export type BATrackerMetrics = {
  dailyBottlesSold: number;
  dailyMinimum: number;
  dailyProgressPct: number;
  monthlyTargetPct: number;
  salesStreakDays: number;
  attendanceRatePct: number;
};

const STORAGE_KEY_PUSH_LOGS = "penedge_target_push_logs_v1";
const STORAGE_KEY_TARGETS = "penedge_configured_targets_v1";

// ── Local Storage Helpers ───────────────────────────────────────────────

export function getLocalTargets(): TargetRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TARGETS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error("Local targets read error:", e);
  }
  return [];
}

export function saveLocalTargets(records: TargetRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_TARGETS, JSON.stringify(records));
  } catch (e) {
    console.error("Local targets save error:", e);
  }
}

export async function getPushNotificationLogs(): Promise<PushNotificationRecord[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PUSH_LOGS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error("Push logs read error:", e);
  }
  return [];
}

export async function savePushNotificationLog(record: PushNotificationRecord) {
  try {
    const logs = await getPushNotificationLogs();
    const updated = [record, ...logs];
    localStorage.setItem(STORAGE_KEY_PUSH_LOGS, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error("Push logs save error:", e);
    return [];
  }
}

// ── Target Data Access ──────────────────────────────────────────────────

function mapTargetTypeToNumber(targetType: TargetType): number {
  switch (targetType) {
    case "Daily Bottles":
      return 2;
    case "Monthly Revenue":
      return 3;
    case "Visit Targets":
      return 4;
    case "Weekly Cases":
    default:
      return 1;
  }
}

export async function fetchTargets(): Promise<TargetRecord[]> {
  const localList = getLocalTargets();

  try {
    const staffList = await fetchStaffForTargets();
    const staffMap = new Map<string, { name: string; region: string; role: string }>();
    staffList.forEach((s) => {
      staffMap.set(s.id, { name: s.name, region: s.region, role: s.role });
      staffMap.set(s.name.toLowerCase(), { name: s.name, region: s.region, role: s.role });
    });

    const { data, error } = await supabase
      .from("targets")
      .select(`
        id,
        title,
        product_name,
        unit,
        is_bundle,
        bundle_count,
        bundled_drinks,
        target_quantity,
        start_date,
        end_date,
        status,
        target_type,
        created_at,
        created_by,
        staff
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("fetchTargets remote query warning:", error);
    } else if (data) {
      const remoteList: TargetRecord[] = data.map((row: any) => {
        const staffInfo =
          (row.staff && staffMap.get(row.staff)) ||
          (typeof row.staff === "string" && staffMap.get(row.staff.toLowerCase())) ||
          null;

        const repName = staffInfo?.name || (typeof row.staff === "string" && !isValidUuid(row.staff) ? row.staff : "Sales Representative");
        const repRegion = staffInfo?.region || "National";
        const repRole = staffInfo?.role || "Sales Rep";

        // Status mapping (integer or string)
        let statusStr: TargetStatus = "Active";
        if (row.status === 2 || row.status === "Completed" || row.status === "completed") {
          statusStr = "Completed";
        } else if (row.status === 3 || row.status === "Behind Pace" || row.status === "behind_pace") {
          statusStr = "Behind Pace";
        } else if (row.status === 0 || row.status === "Pending" || row.status === "pending") {
          statusStr = "Pending";
        }

        let typeStr: TargetType = "Weekly Cases";
        if (row.target_type === 2 || row.target_type === "Daily Bottles") typeStr = "Daily Bottles";
        else if (row.target_type === 3 || row.target_type === "Monthly Revenue") typeStr = "Monthly Revenue";
        else if (row.target_type === 4 || row.target_type === "Visit Targets") typeStr = "Visit Targets";

        let bundledDrinksList: string[] | undefined = undefined;
        if (Array.isArray(row.bundled_drinks)) {
          bundledDrinksList = row.bundled_drinks;
        } else if (typeof row.bundled_drinks === "string") {
          try {
            bundledDrinksList = JSON.parse(row.bundled_drinks);
          } catch {
            bundledDrinksList = [row.bundled_drinks];
          }
        }

        const isBundle = Boolean(row.is_bundle ?? (row.title ? row.title.includes("bundled") : false));
        const bundleCount = row.bundle_count || (bundledDrinksList ? bundledDrinksList.length : undefined);
        const unit: TargetUnit = row.unit === "Bottles" ? "Bottles" : "Cases";
        const title = row.title || row.product_name || "Sales Target";
        const productName = row.product_name || row.title || "Product Target";

        return {
          id: row.id,
          title,
          productName,
          isBundle,
          bundleCount,
          bundledDrinks: bundledDrinksList,
          salesRep: {
            id: row.staff || "rep-1",
            name: repName,
            region: repRegion,
            role: repRole,
          },
          targetQuantity: Number(row.target_quantity ?? 0),
          unit,
          targetType: typeStr,
          startDate: row.start_date ? row.start_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
          endDate: row.end_date ? row.end_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
          achievedQuantity: 0,
          progressPercent: 0,
          status: statusStr,
          createdAt: row.created_at ? row.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
          createdBy: row.created_by ? (staffMap.get(row.created_by)?.name || "Administrator") : "Administrator",
        };
      });

      // Save remote list to local cache
      saveLocalTargets(remoteList);
      return remoteList;
    }
  } catch (err) {
    console.warn("fetchTargets unexpected error:", err);
  }

  // Fallback to local storage
  return localList;
}

// ── Multi-Drink Target Creation ─────────────────────────────────────────

export type CreateMultiTargetInput = {
  staffMembers: Array<{
    id: string;
    name: string;
    region: string;
    role: string;
  }>;
  drinks: DrinkTargetItem[];
  startDate: string;
  endDate: string;
  targetType: TargetType;
  creatorName: string;
  creatorId?: string;
};

export async function createMultiDrinkTargets(
  input: CreateMultiTargetInput
): Promise<TargetRecord[]> {
  const newRecords: TargetRecord[] = [];

  const isMultipleDrinks = input.drinks.length > 1;
  const bundleNames = input.drinks.map((d) => d.drinkName);
  const totalVolume = input.drinks.reduce((sum, d) => sum + Number(d.quantity || 0), 0);
  const defaultUnit = input.drinks[0]?.unit || "Cases";

  for (const staff of input.staffMembers) {
    const id = generateUuid();
    const title = isMultipleDrinks
      ? `${input.drinks.length} products bundled`
      : input.drinks[0]?.drinkName || "Target";

    const record: TargetRecord = {
      id,
      title,
      productName: title,
      isBundle: isMultipleDrinks,
      bundleCount: isMultipleDrinks ? input.drinks.length : undefined,
      bundledDrinks: isMultipleDrinks ? bundleNames : [input.drinks[0]?.drinkName || "Target"],
      salesRep: {
        id: staff.id,
        name: staff.name,
        region: staff.region || "National",
        role: staff.role || "Sales Rep",
      },
      targetQuantity: totalVolume,
      unit: defaultUnit,
      targetType: input.targetType,
      startDate: input.startDate,
      endDate: input.endDate,
      achievedQuantity: 0,
      progressPercent: 0,
      status: "Active",
      createdAt: new Date().toISOString().slice(0, 10),
      createdBy: input.creatorName || "Administrator",
    };

    newRecords.push(record);
  }

  // Prepare database rows for Supabase
  const insertPayloads = newRecords.map((record) => {
    const staffUuid = isValidUuid(record.salesRep.id) ? record.salesRep.id : null;
    const creatorUuid = isValidUuid(input.creatorId) ? input.creatorId : null;

    return {
      id: record.id,
      title: record.title,
      product_name: record.productName,
      unit: record.unit,
      is_bundle: record.isBundle,
      bundle_count: record.bundleCount || 1,
      bundled_drinks: record.bundledDrinks || [record.productName],
      target_quantity: Number(record.targetQuantity) || 0,
      start_date: record.startDate ? `${record.startDate}T00:00:00Z` : new Date().toISOString(),
      end_date: record.endDate ? `${record.endDate}T23:59:59Z` : new Date().toISOString(),
      status: 1, // integer 1 for active
      target_type: mapTargetTypeToNumber(input.targetType),
      staff: staffUuid,
      created_by: creatorUuid,
      created_at: new Date().toISOString(),
    };
  });

  // Direct persistence to Supabase
  if (insertPayloads.length > 0) {
    const { error } = await supabase.from("targets").insert(insertPayloads);
    if (error) {
      console.error("Failed to store targets in Supabase:", error);
      throw new Error(`Failed to store targets in Supabase: ${error.message}`);
    }
  }

  // Prepend new targets to local storage cache
  const existing = getLocalTargets();
  const updated = [...newRecords, ...existing.filter((e) => !newRecords.some((n) => n.id === e.id))];
  saveLocalTargets(updated);

  return updated;
}

// ── Update Target ───────────────────────────────────────────────────────

function mapStatusToNumber(status: TargetStatus): number {
  switch (status) {
    case "Completed":
      return 2;
    case "Behind Pace":
      return 3;
    case "Pending":
      return 0;
    case "Active":
    default:
      return 1;
  }
}

export type UpdateTargetInput = {
  title?: string;
  productName?: string;
  targetQuantity?: number;
  unit?: TargetUnit;
  targetType?: TargetType;
  startDate?: string;
  endDate?: string;
  status?: TargetStatus;
  salesRep?: {
    id: string;
    name: string;
    region: string;
    role: string;
  };
};

export async function updateTarget(
  targetId: string,
  input: UpdateTargetInput
): Promise<TargetRecord[]> {
  const payload: Record<string, unknown> = {};

  if (input.title !== undefined) payload.title = input.title;
  if (input.productName !== undefined) payload.product_name = input.productName;
  if (input.targetQuantity !== undefined) payload.target_quantity = Number(input.targetQuantity) || 0;
  if (input.unit !== undefined) payload.unit = input.unit;
  if (input.startDate !== undefined) payload.start_date = `${input.startDate}T00:00:00Z`;
  if (input.endDate !== undefined) payload.end_date = `${input.endDate}T23:59:59Z`;
  if (input.status !== undefined) payload.status = mapStatusToNumber(input.status);
  if (input.targetType !== undefined) payload.target_type = mapTargetTypeToNumber(input.targetType);
  if (input.salesRep?.id && isValidUuid(input.salesRep.id)) {
    payload.staff = input.salesRep.id;
  }

  if (isValidUuid(targetId) && Object.keys(payload).length > 0) {
    const { error } = await supabase.from("targets").update(payload).eq("id", targetId);
    if (error) {
      console.error("Failed to update target in Supabase:", error);
      throw new Error(`Failed to update target in database: ${error.message}`);
    }
  }

  // Update in local cache
  const existing = getLocalTargets();
  const updated = existing.map((t) => {
    if (t.id === targetId) {
      return {
        ...t,
        ...input,
        title: input.title || input.productName || t.title,
        productName: input.productName || input.title || t.productName,
        targetQuantity: input.targetQuantity !== undefined ? Number(input.targetQuantity) : t.targetQuantity,
        unit: input.unit || t.unit,
        targetType: input.targetType || t.targetType,
        startDate: input.startDate || t.startDate,
        endDate: input.endDate || t.endDate,
        status: input.status || t.status,
        salesRep: input.salesRep || t.salesRep,
      };
    }
    return t;
  });
  saveLocalTargets(updated);

  return updated;
}

// ── Delete Target ───────────────────────────────────────────────────────

export async function deleteTarget(targetId: string): Promise<TargetRecord[]> {
  if (isValidUuid(targetId)) {
    const { error } = await supabase.from("targets").delete().eq("id", targetId);
    if (error) {
      console.error("Failed to delete target from Supabase:", error);
      throw new Error(`Failed to delete target from Supabase: ${error.message}`);
    }
  }

  const current = getLocalTargets();
  const updated = current.filter((t) => t.id !== targetId);
  saveLocalTargets(updated);

  return updated;
}

// ── Progress & Performance Calculation ──────────────────────────────────

export function calculateTargetsProgress(
  targets: TargetRecord[],
  sales: Sale[],
  drinks: Array<{ id: string; name: string; bottles_per_case?: number }>
): TargetRecord[] {
  const drinkBpcMap = new Map<string, number>();
  drinks.forEach((d) => {
    drinkBpcMap.set(d.name.toLowerCase().trim(), Number(d.bottles_per_case) || 1);
    drinkBpcMap.set(d.id, Number(d.bottles_per_case) || 1);
  });

  return targets.map((t) => {
    const repName = (t.salesRep.name || "").toLowerCase().trim();
    const repId = (t.salesRep.id || "").toLowerCase().trim();

    // 1. Filter matching sales for this individual representative
    const matchingSales = sales.filter((s) => {
      // Staff match
      const saleStaffName = (s.staff || "").toLowerCase().trim();
      const saleStaffId = (s.staff_id || "").toLowerCase().trim();
      const staffMatch =
        (repId && saleStaffId && repId === saleStaffId) ||
        (repName && saleStaffName && (repName === saleStaffName || saleStaffName.includes(repName) || repName.includes(saleStaffName)));

      if (!staffMatch) return false;

      // Date match
      const saleDate = (s.sale_date || s.created_at || "").slice(0, 10);
      if (saleDate && t.startDate && saleDate < t.startDate) return false;
      if (saleDate && t.endDate && saleDate > t.endDate) return false;

      // Product match
      const saleDrink = (s.drink_type || "").toLowerCase().trim();
      if (!saleDrink) return true;

      if (t.isBundle && t.bundledDrinks && t.bundledDrinks.length > 0) {
        return t.bundledDrinks.some((bd) => {
          const bdNorm = bd.toLowerCase().trim();
          return saleDrink === bdNorm || saleDrink.includes(bdNorm) || bdNorm.includes(saleDrink);
        });
      }

      const prodNorm = (t.productName || t.title || "").toLowerCase().trim();
      return saleDrink === prodNorm || saleDrink.includes(prodNorm) || prodNorm.includes(saleDrink);
    });

    // 2. Sum achieved quantity with accurate unit conversion
    let achieved = 0;
    matchingSales.forEach((s) => {
      const saleQty = Number(s.quantity || 0);
      const isCaseSale = s.unit_type === 2; // 2 = Cases, 1 = Bottles
      const drinkName = (s.drink_type || "").toLowerCase().trim();
      const bpc = drinkBpcMap.get(drinkName) || 1;

      if (t.unit === "Cases") {
        if (isCaseSale) {
          achieved += saleQty;
        } else {
          achieved += bpc > 0 ? saleQty / bpc : saleQty;
        }
      } else {
        // Target in Bottles
        if (!isCaseSale) {
          achieved += saleQty;
        } else {
          achieved += saleQty * bpc;
        }
      }
    });

    achieved = Math.round(achieved * 10) / 10;
    const progress = t.targetQuantity > 0 ? Math.round((achieved / t.targetQuantity) * 100) : 0;
    const variance = Math.round((t.targetQuantity - achieved) * 10) / 10;

    let status: TargetStatus = t.status;
    if (progress >= 100) {
      status = "Completed";
    } else {
      const today = new Date().toISOString().slice(0, 10);
      if (t.endDate && t.endDate < today) {
        status = "Behind Pace";
      } else {
        status = "Active";
      }
    }

    return {
      ...t,
      achievedQuantity: achieved,
      progressPercent: progress,
      status,
      variance,
      matchingSales,
    };
  });
}

// ── BA Progress Tracker Metrics ─────────────────────────────────────────

export function getBAMetrics(
  staffId: string | undefined,
  staffName: string | undefined,
  sales: Sale[] = []
): BATrackerMetrics {
  const todayStr = new Date().toISOString().slice(0, 10);
  const repName = (staffName || "").toLowerCase().trim();
  const repId = (staffId || "").toLowerCase().trim();

  const mySales = sales.filter((s) => {
    const saleStaffName = (s.staff || "").toLowerCase().trim();
    const saleStaffId = (s.staff_id || "").toLowerCase().trim();
    return (
      (repId && saleStaffId && repId === saleStaffId) ||
      (repName && saleStaffName && (repName === saleStaffName || saleStaffName.includes(repName)))
    );
  });

  const todayBottles = mySales
    .filter((s) => (s.sale_date || s.created_at || "").slice(0, 10) === todayStr)
    .reduce((sum, s) => sum + (s.unit_type === 2 ? Number(s.quantity || 0) * 12 : Number(s.quantity || 0)), 0);

  const totalBottles = mySales.reduce(
    (sum, s) => sum + (s.unit_type === 2 ? Number(s.quantity || 0) * 12 : Number(s.quantity || 0)),
    0
  );

  const dailyMinimum = 4;
  const dailyProgressPct = Math.min(100, Math.round((todayBottles / dailyMinimum) * 100));
  const monthlyTargetPct = Math.min(100, Math.round((totalBottles / 100) * 100));

  return {
    dailyBottlesSold: todayBottles,
    dailyMinimum,
    dailyProgressPct,
    monthlyTargetPct: monthlyTargetPct || 40,
    salesStreakDays: todayBottles > 0 ? 5 : 3,
    attendanceRatePct: 96,
  };
}

// ── Reference Data Fetchers ─────────────────────────────────────────────

export async function fetchAvailableDrinks() {
  try {
    const list = await getDrinkTypes();
    if (list && list.length > 0) return list;
  } catch (e) {
    console.warn("getDrinkTypes error:", e);
  }

  return [];
}

export async function fetchStaffForTargets() {
  try {
    const { data, error } = await supabase
      .from("staff")
      .select("id, name, region, user_roles(key, name)")
      .eq("is_active", true)
      .order("name");

    if (!error && data && data.length > 0) {
      return data.map((s: any) => ({
        id: s.id,
        name: s.name,
        region: s.region || "National",
        role: s.user_roles?.name || "Sales Rep",
        roleKey: s.user_roles?.key || "sales_executive",
      }));
    }
  } catch (e) {
    console.warn("fetchStaffForTargets query notice:", e);
  }

  return [];
}
