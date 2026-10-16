import { getSales, type Sale } from "./salesService";
import { getVisits, type VisitRecord } from "./visitsService";
import { loadUserAccounts, type UserAccount } from "./userManagementService";
import { fetchTargets, type TargetRecord } from "./targetsService";
import {
  type UserScope,
  filterSalesByScope,
  filterVisitsByScope,
  filterStaffByScope,
  filterTargetsByScope,
} from "./dataScopeService";

// ── TYPES ───────────────────────────────────────────────────────────────────

export type ActivityType = "sale" | "visit" | "attendance";

export interface ActivityItem {
  id: string;
  timestamp: string; // ISO date-time string
  formattedDate: string; // e.g. "Oct 10, 2026"
  formattedTime: string; // e.g. "01:11"
  type: ActivityType;
  staffName: string;
  staffId?: string;
  staffRole: string;
  staffRegion: string;
  staffEmail?: string;
  description: string;
  subDescription?: string;
  outletName: string;
  amount: number;
  quantity?: number;
  unitType?: string; // "Bottles" | "Cases"
  status?: string;
  gpsAccuracy?: string;
  rawRecord?: any;
}

export interface DailyActivitySummary {
  date: string; // "YYYY-MM-DD"
  formattedDate: string; // "Oct 10"
  dayOfWeek: string; // "Sat", "Fri", etc.
  attendanceStatus: "Present" | "Partial" | "Weekend" | "Off" | "-";
  attendanceCount: number;
  salesCount: number;
  revenue: number;
  visitsCount: number;
  successfulVisitsCount: number;
  successRate: number; // percentage 0 - 100
}

export interface TeamMemberComparison {
  id: string;
  name: string;
  email: string;
  role: string;
  roleKey: string;
  region: string;
  revenue: number;
  salesCount: number;
  attendancePercent: number;
  shiftsLogged: number;
  shiftsExpected: number;
  visitsCompleted: number;
  visitsTotal: number;
  status: "Active" | "Inactive";
  avatarUrl?: string | null;
  lastActiveDate?: string;
}

export interface SalesTargetSummary {
  id: string;
  name: string;
  role: string;
  region: string;
  totalSalesCases: number;
  totalTargetCases: number;
  varianceCases: number; // totalSalesCases - totalTargetCases
  attainmentPercent: number; // (totalSalesCases / totalTargetCases) * 100
  totalRevenue: number;
  bottlesSold: number;
  casesSold: number;
}

export interface TeamActivityMetrics {
  totalRevenue: number;
  salesCount: number;
  unitsMovedTotal: number;
  bottlesCount: number;
  casesCount: number;
  attendanceRatePercent: number;
  shiftsCompleted: number;
  shiftsTotal: number;
  visitsCount: number;
  successfulVisitsCount: number;
  visitSuccessRatePercent: number;
  activeMembersCount: number;
  totalMembersCount: number;
  totalSalesCases: number;
  totalTargetCases: number;
  targetVarianceCases: number;
  targetAttainmentPercent: number;
  dateRangeLabel: string;
}

export interface TeamFilterOptions {
  region: string; // "All Regions" or region name
  staffStatus: "Active Staff" | "All Staff" | "Inactive Staff";
  memberId: string; // "All Members" or specific member ID / name
  activityType: "All Types" | "Sale" | "Visit" | "Attendance";
  dateRange: "today" | "yesterday" | "7d" | "30d" | "this_month" | "last_month" | "custom";
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
}

// ── DATE UTILS ──────────────────────────────────────────────────────────────

export function getDateRangeBounds(period: TeamFilterOptions["dateRange"]): {
  start: string;
  end: string;
  label: string;
} {
  const now = new Date();
  const formatYmd = (d: Date) => d.toISOString().split("T")[0];

  const formatDisplay = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  if (period === "today") {
    const today = formatYmd(now);
    return {
      start: today,
      end: today,
      label: `Today • ${formatDisplay(now)}`,
    };
  }

  if (period === "yesterday") {
    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    const yestStr = formatYmd(yest);
    return {
      start: yestStr,
      end: yestStr,
      label: `Yesterday • ${formatDisplay(yest)}`,
    };
  }

  if (period === "7d") {
    const past7 = new Date(now);
    past7.setDate(past7.getDate() - 6);
    return {
      start: formatYmd(past7),
      end: formatYmd(now),
      label: `${formatDisplay(past7)} - ${formatDisplay(now)}`,
    };
  }

  if (period === "this_month") {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      start: formatYmd(firstDay),
      end: formatYmd(now),
      label: `${formatDisplay(firstDay)} - ${formatDisplay(now)}`,
    };
  }

  if (period === "last_month") {
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    return {
      start: formatYmd(firstDayLastMonth),
      end: formatYmd(lastDayLastMonth),
      label: `${formatDisplay(firstDayLastMonth)} - ${formatDisplay(lastDayLastMonth)}`,
    };
  }

  // Default: Last 30 Days ("30d")
  const past30 = new Date(now);
  past30.setDate(past30.getDate() - 30);
  return {
    start: formatYmd(past30),
    end: formatYmd(now),
    label: `${formatDisplay(past30)} - ${formatDisplay(now)}`,
  };
}

export function formatCurrencyNaira(amount: number): string {
  if (!amount && amount !== 0) return "₦0";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount).replace("NGN", "₦").trim();
}

export function formatCompactCurrency(amount: number): string {
  if (!amount || amount === 0) return "₦0";
  if (amount >= 1_000_000) {
    const millions = (amount / 1_000_000).toFixed(1).replace(/\.0$/, "");
    return `₦${millions}M`;
  }
  if (amount >= 1_000) {
    const thousands = (amount / 1_000).toFixed(0);
    return `₦${thousands}k`;
  }
  return `₦${amount.toLocaleString()}`;
}

export function formatUnitsNumber(units: number): string {
  if (units >= 1000) {
    return `${(units / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return units.toLocaleString();
}

// ── COMPREHENSIVE SUPABASE DATA FETCHER & AGGREGATOR ─────────────────────────

export async function fetchTeamActivityData(
  filters: TeamFilterOptions,
  scope?: UserScope
): Promise<{
  metrics: TeamActivityMetrics;
  activities: ActivityItem[];
  dailySummaries: DailyActivitySummary[];
  teamMembers: TeamMemberComparison[];
  salesSummaries: SalesTargetSummary[];
  regions: string[];
  staffNames: string[];
}> {
  const { start, end, label } = filters.dateRange === "custom" && filters.startDate && filters.endDate
    ? { start: filters.startDate, end: filters.endDate, label: `${filters.startDate} - ${filters.endDate}` }
    : getDateRangeBounds(filters.dateRange);

  // 1. Fetch live remote data from Supabase concurrently
  const [rawSales, rawVisits, rawStaff, rawTargets] = await Promise.all([
    getSales(start || undefined, end || undefined).catch((err) => {
      console.error("Error loading sales from Supabase:", err);
      return [] as Sale[];
    }),
    getVisits(start || undefined, end || undefined).catch((err) => {
      console.error("Error loading visits from Supabase:", err);
      return [] as VisitRecord[];
    }),
    loadUserAccounts().catch((err) => {
      console.error("Error loading staff accounts from Supabase:", err);
      return [] as UserAccount[];
    }),
    fetchTargets().catch((err) => {
      console.error("Error loading targets from Supabase:", err);
      return [] as TargetRecord[];
    }),
  ]);

  const salesData = scope ? filterSalesByScope(rawSales, scope) : rawSales;
  const visitsData = scope ? filterVisitsByScope(rawVisits, scope) : rawVisits;
  const staffUsers = scope ? filterStaffByScope(rawStaff, scope) : rawStaff;
  const targetsData = scope ? filterTargetsByScope(rawTargets, scope) : rawTargets;

  // 2. Map all live sales & visits into unified ActivityItem feed
  const mappedActivities: ActivityItem[] = [];

  // Map Sales
  (salesData || []).forEach((s) => {
    const dt = new Date(s.sale_date || s.created_at || new Date());
    const isCase = s.unit_type === 2;
    const unit = isCase ? "Cases" : "Bottles";
    const qty = s.quantity ?? 1;
    const amt = Number(s.total_amount ?? 0);

    mappedActivities.push({
      id: `sale-${s.id}`,
      timestamp: dt.toISOString(),
      formattedDate: dt.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
      formattedTime: dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
      type: "sale",
      staffName: s.staff || "Field Rep",
      staffId: s.staff_id || undefined,
      staffRole: s.staff_role ? s.staff_role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Sales Executive",
      staffRegion: s.staff_region || s.outlet_region || "National",
      description: `Recorded sale of ${qty} ${unit.toLowerCase()}`,
      subDescription: `${s.drink_type || "Product order"} • ${formatCurrencyNaira(amt)}`,
      outletName: s.outlet || "Field Outlet",
      amount: amt,
      quantity: qty,
      unitType: unit,
      status: "Completed",
      rawRecord: s,
    });
  });

  // Map Visits
  (visitsData || []).forEach((v) => {
    const dt = new Date(v.date || new Date());
    const isAttendance = v.type === "attendance";

    mappedActivities.push({
      id: `visit-${v.id}`,
      timestamp: dt.toISOString(),
      formattedDate: dt.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
      formattedTime: v.time || dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
      type: isAttendance ? "attendance" : "visit",
      staffName: v.staff || "Field Rep",
      staffRole: isAttendance ? "Field Staff" : "Field Executive",
      staffRegion: "Territory",
      description: isAttendance
        ? `Shift Check-in: ${v.status || "Completed"}`
        : `Outlet visit: ${v.outcome || v.status || "Completed"}`,
      subDescription: v.notes || (v.gps ? "GPS location verified" : "Field activity log"),
      outletName: v.outlet || (isAttendance ? "Depot Check-in" : "Retail Store"),
      amount: 0,
      status: v.outcome || v.status,
      gpsAccuracy: v.gps ? "GPS Verified" : undefined,
      rawRecord: v,
    });
  });

  // Sort activities chronologically (newest first)
  mappedActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // 3. Extract unique list of regions & staff from actual database records
  const regionSet = new Set<string>();
  const staffSet = new Set<string>();

  staffUsers.forEach((u) => {
    if (u.region) regionSet.add(u.region);
    if (u.name) staffSet.add(u.name);
  });

  salesData.forEach((s) => {
    if (s.staff_region) regionSet.add(s.staff_region);
    if (s.outlet_region) regionSet.add(s.outlet_region);
    if (s.staff) staffSet.add(s.staff);
  });

  visitsData.forEach((v) => {
    if (v.staff) staffSet.add(v.staff);
  });

  const regions = ["All Regions", ...Array.from(regionSet).filter(Boolean).sort()];
  const staffNames = ["All Members", ...Array.from(staffSet).filter(Boolean).sort()];

  // 4. Filter activities based on user filter selections
  let filteredActivities = [...mappedActivities];

  if (filters.region && filters.region !== "All Regions") {
    const rLower = filters.region.toLowerCase();
    filteredActivities = filteredActivities.filter((a) =>
      a.staffRegion.toLowerCase().includes(rLower)
    );
  }

  if (filters.memberId && filters.memberId !== "All Members") {
    const mLower = filters.memberId.toLowerCase();
    filteredActivities = filteredActivities.filter((a) =>
      a.staffName.toLowerCase() === mLower
    );
  }

  if (filters.activityType && filters.activityType !== "All Types") {
    const targetType = filters.activityType.toLowerCase();
    filteredActivities = filteredActivities.filter((a) => a.type === targetType);
  }

  if (filters.searchQuery && filters.searchQuery.trim()) {
    const q = filters.searchQuery.toLowerCase().trim();
    filteredActivities = filteredActivities.filter(
      (a) =>
        a.staffName.toLowerCase().includes(q) ||
        a.outletName.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        (a.subDescription && a.subDescription.toLowerCase().includes(q))
    );
  }

  // 5. Build Team Member Performance from actual Supabase staff
  const staffSalesMap = new Map<string, { revenue: number; salesCount: number; bottles: number; cases: number }>();
  salesData.forEach((s) => {
    const staffKey = (s.staff || s.staff_id || "Unknown").toLowerCase();
    if (!staffSalesMap.has(staffKey)) {
      staffSalesMap.set(staffKey, { revenue: 0, salesCount: 0, bottles: 0, cases: 0 });
    }
    const rec = staffSalesMap.get(staffKey)!;
    rec.revenue += Number(s.total_amount ?? 0);
    rec.salesCount += 1;
    if (s.unit_type === 2) {
      rec.cases += Number(s.quantity ?? 1);
    } else {
      rec.bottles += Number(s.quantity ?? 1);
    }
  });

  const staffVisitsMap = new Map<string, { total: number; completed: number; attendanceLogs: number }>();
  visitsData.forEach((v) => {
    const staffKey = (v.staff || "Unknown").toLowerCase();
    if (!staffVisitsMap.has(staffKey)) {
      staffVisitsMap.set(staffKey, { total: 0, completed: 0, attendanceLogs: 0 });
    }
    const vRec = staffVisitsMap.get(staffKey)!;
    if (v.type === "attendance") {
      vRec.attendanceLogs += 1;
    } else {
      vRec.total += 1;
      if (v.status === "Completed" || v.outcome === "Successful") {
        vRec.completed += 1;
      }
    }
  });

  let teamMembers: TeamMemberComparison[] = staffUsers.map((u) => {
    const staffKeyName = (u.name || "").toLowerCase();
    const staffKeyId = (u.id || "").toLowerCase();
    const sStats = staffSalesMap.get(staffKeyName) || staffSalesMap.get(staffKeyId) || { revenue: 0, salesCount: 0, bottles: 0, cases: 0 };
    const vStats = staffVisitsMap.get(staffKeyName) || staffVisitsMap.get(staffKeyId) || { total: 0, completed: 0, attendanceLogs: 0 };

    const expectedShifts = 22; // standard monthly working days
    const attendancePct = u.is_active
      ? (vStats.attendanceLogs > 0 ? Math.min(100, Math.round((vStats.attendanceLogs / expectedShifts) * 100)) : 100)
      : 0;

    return {
      id: u.id,
      name: u.name || "Staff User",
      email: u.email || `${u.id}@penedge.com`,
      role: u.role_key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      roleKey: u.role_key,
      region: u.region || "National",
      revenue: sStats.revenue,
      salesCount: sStats.salesCount,
      attendancePercent: attendancePct,
      shiftsLogged: vStats.attendanceLogs,
      shiftsExpected: expectedShifts,
      visitsCompleted: vStats.completed,
      visitsTotal: vStats.total,
      status: u.is_active ? "Active" : "Inactive",
      avatarUrl: u.avatar_url,
    };
  });

  // Filter team members by region, status, search
  if (filters.region && filters.region !== "All Regions") {
    const rLower = filters.region.toLowerCase();
    teamMembers = teamMembers.filter((m) => m.region.toLowerCase().includes(rLower));
  }

  if (filters.staffStatus === "Active Staff") {
    teamMembers = teamMembers.filter((m) => m.status === "Active");
  } else if (filters.staffStatus === "Inactive Staff") {
    teamMembers = teamMembers.filter((m) => m.status === "Inactive");
  }

  if (filters.memberId && filters.memberId !== "All Members") {
    const mLower = filters.memberId.toLowerCase();
    teamMembers = teamMembers.filter((m) => m.name.toLowerCase() === mLower);
  }

  // 6. Build Sales Target Summary from actual Supabase targets & staff
  const staffTargetMap = new Map<string, number>();
  targetsData.forEach((t) => {
    const repName = (t.salesRep?.name || t.salesRep?.id || "").toLowerCase();
    if (repName) {
      staffTargetMap.set(repName, (staffTargetMap.get(repName) || 0) + Number(t.targetQuantity ?? 0));
    }
  });

  let salesSummaries: SalesTargetSummary[] = staffUsers.map((u) => {
    const staffKeyName = (u.name || "").toLowerCase();
    const sStats = staffSalesMap.get(staffKeyName) || staffSalesMap.get((u.id || "").toLowerCase()) || { revenue: 0, salesCount: 0, bottles: 0, cases: 0 };
    const targetCases = staffTargetMap.get(staffKeyName) || 0;
    const soldCases = sStats.cases;
    const variance = soldCases - targetCases;
    const attainment = targetCases > 0 ? Math.round((soldCases / targetCases) * 1000) / 10 : 0;

    return {
      id: u.id,
      name: u.name,
      role: u.role_key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      region: u.region || "National",
      totalSalesCases: soldCases,
      totalTargetCases: targetCases,
      varianceCases: variance,
      attainmentPercent: attainment,
      totalRevenue: sStats.revenue,
      bottlesSold: sStats.bottles,
      casesSold: sStats.cases,
    };
  });

  if (filters.region && filters.region !== "All Regions") {
    const rLower = filters.region.toLowerCase();
    salesSummaries = salesSummaries.filter((s) => s.region.toLowerCase().includes(rLower));
  }
  if (filters.memberId && filters.memberId !== "All Members") {
    const mLower = filters.memberId.toLowerCase();
    salesSummaries = salesSummaries.filter((s) => s.name.toLowerCase() === mLower);
  }

  // 7. Build Daily Activity Summary purely from real database rows within date range
  const dailyMap = new Map<string, {
    date: string;
    formattedDate: string;
    dayOfWeek: string;
    attendanceCount: number;
    salesCount: number;
    revenue: number;
    visitsCount: number;
    successfulVisitsCount: number;
  }>();

  const startDateObj = new Date(start);
  const endDateObj = new Date(end);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Initialize day rows for the range
  const currDay = new Date(endDateObj);
  while (currDay >= startDateObj) {
    const dateIso = currDay.toISOString().split("T")[0];
    const formattedDate = currDay.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
    const dayOfWeek = dayNames[currDay.getDay()];

    dailyMap.set(dateIso, {
      date: dateIso,
      formattedDate,
      dayOfWeek,
      attendanceCount: 0,
      salesCount: 0,
      revenue: 0,
      visitsCount: 0,
      successfulVisitsCount: 0,
    });

    currDay.setDate(currDay.getDate() - 1);
  }

  // Aggregate real sales into days
  salesData.forEach((s) => {
    const sDate = (s.sale_date || (s.created_at ? s.created_at.split("T")[0] : "")).slice(0, 10);
    if (dailyMap.has(sDate)) {
      const dRec = dailyMap.get(sDate)!;
      dRec.salesCount += 1;
      dRec.revenue += Number(s.total_amount ?? 0);
    }
  });

  // Aggregate real visits into days
  visitsData.forEach((v) => {
    const vDate = (v.date || "").slice(0, 10);
    if (dailyMap.has(vDate)) {
      const dRec = dailyMap.get(vDate)!;
      if (v.type === "attendance") {
        dRec.attendanceCount += 1;
      } else {
        dRec.visitsCount += 1;
        if (v.status === "Completed" || v.outcome === "Successful") {
          dRec.successfulVisitsCount += 1;
        }
      }
    }
  });

  const dailySummaries: DailyActivitySummary[] = Array.from(dailyMap.values()).map((d) => {
    const isWeekend = d.dayOfWeek === "Sat" || d.dayOfWeek === "Sun";
    let attStatus: DailyActivitySummary["attendanceStatus"] = "-";
    if (d.attendanceCount > 0) {
      attStatus = "Present";
    } else if (isWeekend) {
      attStatus = "Off";
    } else if (d.salesCount > 0 || d.visitsCount > 0) {
      attStatus = "Present";
    }

    const successRate = d.visitsCount > 0
      ? Math.round((d.successfulVisitsCount / d.visitsCount) * 100)
      : 0;

    return {
      ...d,
      attendanceStatus: attStatus,
      successRate,
    };
  });

  // 8. Compute Overall Aggregate Metrics strictly from Supabase data
  const totalRevenue = salesData.reduce((sum, s) => sum + Number(s.total_amount ?? 0), 0);
  const totalSalesCount = salesData.length;
  const totalUnitsMoved = salesData.reduce((sum, s) => sum + Number(s.quantity ?? 0), 0);
  const bottlesCount = salesData
    .filter((s) => s.unit_type !== 2)
    .reduce((sum, s) => sum + Number(s.quantity ?? 0), 0);
  const casesCount = salesData
    .filter((s) => s.unit_type === 2)
    .reduce((sum, s) => sum + Number(s.quantity ?? 0), 0);

  const activeStaff = staffUsers.filter((u) => u.is_active);
  const attendanceLogsCount = visitsData.filter((v) => v.type === "attendance").length;
  const outletVisits = visitsData.filter((v) => v.type !== "attendance");
  const successfulVisits = outletVisits.filter(
    (v) => v.status === "Completed" || v.outcome === "Successful"
  ).length;
  const visitSuccessRate = outletVisits.length > 0
    ? Math.round((successfulVisits / outletVisits.length) * 100)
    : 0;

  const totalSalesCases = casesCount;
  const totalTargetCases = targetsData.reduce((sum, t) => sum + Number(t.targetQuantity ?? 0), 0);
  const targetVariance = totalSalesCases - totalTargetCases;
  const targetAttainment = totalTargetCases > 0
    ? Math.round((totalSalesCases / totalTargetCases) * 1000) / 10
    : 0;

  const attendanceRate = activeStaff.length > 0
    ? (attendanceLogsCount > 0 ? Math.min(100, Math.round((attendanceLogsCount / (activeStaff.length * 20)) * 100)) : 100)
    : 0;

  const metrics: TeamActivityMetrics = {
    totalRevenue,
    salesCount: totalSalesCount,
    unitsMovedTotal: totalUnitsMoved,
    bottlesCount,
    casesCount,
    attendanceRatePercent: attendanceRate,
    shiftsCompleted: attendanceLogsCount,
    shiftsTotal: activeStaff.length * 20 || attendanceLogsCount,
    visitsCount: outletVisits.length,
    successfulVisitsCount: successfulVisits,
    visitSuccessRatePercent: visitSuccessRate,
    activeMembersCount: activeStaff.length,
    totalMembersCount: staffUsers.length,
    totalSalesCases,
    totalTargetCases,
    targetVarianceCases: targetVariance,
    targetAttainmentPercent: targetAttainment,
    dateRangeLabel: label,
  };

  return {
    metrics,
    activities: filteredActivities,
    dailySummaries,
    teamMembers,
    salesSummaries,
    regions,
    staffNames,
  };
}

// ── CSV EXPORT HELPERS ───────────────────────────────────────────────────────

export function exportActivitiesToCsv(activities: ActivityItem[], filename = "Team_Activities_Log.csv") {
  const headers = ["Date & Time", "Activity Type", "Staff Member", "Role", "Region", "Outlet", "Description", "Details", "Amount (NGN)"];
  const rows = activities.map((a) => [
    `"${a.formattedDate} ${a.formattedTime}"`,
    `"${a.type.toUpperCase()}"`,
    `"${a.staffName}"`,
    `"${a.staffRole}"`,
    `"${a.staffRegion}"`,
    `"${a.outletName.replace(/"/g, '""')}"`,
    `"${a.description.replace(/"/g, '""')}"`,
    `"${(a.subDescription || "").replace(/"/g, '""')}"`,
    a.amount,
  ]);

  downloadCsv(headers, rows, filename);
}

export function exportDailyToCsv(daily: DailyActivitySummary[], filename = "Daily_Activity_Summary.csv") {
  const headers = ["Date", "Day", "Attendance", "Sales Count", "Revenue (NGN)", "Total Visits", "Successful Visits", "Success Rate (%)"];
  const rows = daily.map((d) => [
    `"${d.formattedDate} (${d.date})"`,
    `"${d.dayOfWeek}"`,
    `"${d.attendanceStatus}"`,
    d.salesCount,
    d.revenue,
    d.visitsCount,
    d.successfulVisitsCount,
    `${d.successRate}%`,
  ]);

  downloadCsv(headers, rows, filename);
}

export function exportTeamComparisonToCsv(team: TeamMemberComparison[], filename = "Team_Performance_Comparison.csv") {
  const headers = ["Staff Member", "Role", "Region", "Revenue (NGN)", "Sales Count", "Attendance (%)", "Visits Ratio", "Status"];
  const rows = team.map((m) => [
    `"${m.name}"`,
    `"${m.role}"`,
    `"${m.region}"`,
    m.revenue,
    m.salesCount,
    `${m.attendancePercent}%`,
    `"${m.visitsCompleted}/${m.visitsTotal}"`,
    `"${m.status}"`,
  ]);

  downloadCsv(headers, rows, filename);
}

export function exportSalesSummaryToCsv(sales: SalesTargetSummary[], filename = "Sales_Target_Summary.csv") {
  const headers = ["Team Member", "Role", "Region", "Total Sales (Cases)", "Total Target (Cases)", "Variance (Cases)", "Attainment (%)", "Total Revenue (NGN)"];
  const rows = sales.map((s) => [
    `"${s.name}"`,
    `"${s.role}"`,
    `"${s.region}"`,
    s.totalSalesCases,
    s.totalTargetCases,
    s.varianceCases,
    `${s.attainmentPercent}%`,
    s.totalRevenue,
  ]);

  downloadCsv(headers, rows, filename);
}

function downloadCsv(headers: string[], rows: (string | number)[][], filename: string) {
  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
