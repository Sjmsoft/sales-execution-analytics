import { supabase } from "../lib/supabase";
import { getDrinkTypes } from "./referenceService";

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

export async function fetchTargets(): Promise<TargetRecord[]> {
  const { data, error } = await supabase
    .from("targets")
    .select("id, title, target_quantity, start_date, end_date, status, target_type, created_at, created_by, staff")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Remote targets fetch error:", error);
    return [];
  }

  if (data && data.length > 0) {
    return data.map((row: any) => ({
      id: row.id,
      title: row.title || "Sales Target",
      productName: row.title || "Product Target",
      isBundle: false,
      salesRep: {
        id: row.staff || "unknown",
        name: typeof row.staff === "string" ? row.staff : "Sales Rep",
        region: "National",
        role: "Sales Rep",
      },
      targetQuantity: Number(row.target_quantity ?? 0),
      unit: "Cases",
      targetType: (row.target_type as TargetType) || "Weekly Cases",
      startDate: row.start_date || "2026-09-01",
      endDate: row.end_date || "2026-09-30",
      achievedQuantity: 0,
      progressPercent: 0,
      status: (row.status as TargetStatus) || "Active",
      createdAt: row.created_at ? row.created_at.slice(0, 10) : "2026-09-06",
      createdBy: row.created_by || "Administrator",
    }));
  }

  return [];
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
    const id = `tgt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const title = isMultipleDrinks
      ? `${input.drinks.length} products bundled`
      : input.drinks[0]?.drinkName || "Target";

    const initialAchieved = 0;
    const initialProgress = 0;

    const record: TargetRecord = {
      id,
      title,
      productName: title,
      isBundle: isMultipleDrinks,
      bundleCount: isMultipleDrinks ? input.drinks.length : undefined,
      bundledDrinks: isMultipleDrinks ? bundleNames : undefined,
      salesRep: {
        id: staff.id,
        name: staff.name,
        region: staff.region || "Territory",
        role: staff.role || "Sales Rep",
      },
      targetQuantity: totalVolume,
      unit: defaultUnit,
      targetType: input.targetType,
      startDate: input.startDate,
      endDate: input.endDate,
      achievedQuantity: initialAchieved,
      progressPercent: initialProgress,
      status: "Active",
      createdAt: new Date().toISOString().slice(0, 10),
      createdBy: input.creatorName || "Manager",
    };

    newRecords.push(record);

    // Attempt remote insert into Supabase targets table
    await supabase
      .from("targets")
      .insert({
        title: record.title,
        target_quantity: record.targetQuantity,
        start_date: record.startDate,
        end_date: record.endDate,
        status: record.status,
        target_type: record.targetType,
        created_by: record.createdBy,
        staff: staff.name,
      })
      .then(({ error }) => {
        if (error) {
          console.warn("Supabase targets remote insert notice:", error.message);
        }
      });
  }

  return await fetchTargets();
}

// ── BA Progress Tracker Metrics ─────────────────────────────────────────

export function getBAMetrics(
  _staffId: string | undefined,
  _staffName?: string
): BATrackerMetrics {
  return {
    dailyBottlesSold: 0,
    dailyMinimum: 4,
    dailyProgressPct: 0,
    monthlyTargetPct: 0,
    salesStreakDays: 0,
    attendanceRatePct: 0,
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


