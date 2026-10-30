import type { Sale } from "./salesService";
import type { VisitRecord } from "./visitsService";
import { doesOutletMatchRegion, type Outlet } from "./referenceService";
import type { TargetRecord } from "./targetsService";

export type RoleTier = "national" | "regional" | "individual";

export interface UserScope {
  tier: RoleTier;
  isNational: boolean;     // Admin, NSM, HR: sees all staff activity data from all regions & all users
  isRegional: boolean;     // RSM, SE: only sees data of staff from their assigned regions
  isIndividual: boolean;   // BA, VSR: only sees their respective sales data and outlets in their regions
  staffId: string;
  staffName: string;
  staffEmail: string;
  roleKey: string;
  assignedRegions: string[]; // List of assigned region names (e.g. ["Lekki", "Edo Region"])
}

function normalize(str?: string | null): string {
  return (str ?? "").trim().toLowerCase();
}

function matchRegion(itemRegion: string | null | undefined, assignedRegions: string[]): boolean {
  if (!itemRegion) return false;
  const target = normalize(itemRegion);
  if (!target) return false;
  return assignedRegions.some((r) => {
    const regNorm = normalize(r);
    return regNorm === target || target.includes(regNorm) || regNorm.includes(target);
  });
}

/**
 * Builds a normalized UserScope object from the current authenticated staff and role.
 */
export function getUserScope(staff: any | null, role: any | null): UserScope {
  const roleKey = normalize(role?.key || staff?.user_roles?.key || staff?.assigned_role || "");
  const roleName = normalize(role?.name || staff?.user_roles?.name || "");
  const staffId = staff?.id || "";
  const staffName = staff?.name || "";
  const staffEmail = staff?.email || "";

  // Collect all assigned regions for this staff member
  const rawRegions: string[] = [];
  if (staff?.region && typeof staff.region === "string" && staff.region.trim()) {
    rawRegions.push(staff.region.trim());
  }
  if (Array.isArray(staff?.assigned_regions)) {
    staff.assigned_regions.forEach((r: any) => {
      if (typeof r === "string" && r.trim() && !rawRegions.includes(r.trim())) {
        rawRegions.push(r.trim());
      }
    });
  }

  const isAdmin =
    roleKey === "administrator" ||
    roleKey === "admin" ||
    roleKey.includes("admin") ||
    roleName.includes("admin") ||
    role?.hierarchy_level === 1 ||
    staff?.role === 1 ||
    roleKey === "a0000000-0000-4000-8000-000000000001";

  const isHR =
    roleKey === "hr" ||
    roleKey.includes("human_resource") ||
    roleKey.includes("human resource") ||
    roleName.includes("human resource") ||
    roleName.includes("hr") ||
    roleKey === "a0000000-0000-4000-8000-000000000002" ||
    (roleKey.includes("hr") && !roleKey.includes("rsm") && !roleKey.includes("vsr"));

  const isNSM =
    roleKey === "national_sales_manager" ||
    roleKey === "nsm" ||
    roleKey.includes("national_sales") ||
    roleName.includes("national sales") ||
    roleKey === "a0000000-0000-4000-8000-000000000003";

  // Tier 1: National View (Admin, NSM, HR) -> Sees all staff activity data from all regions and users
  const isNational =
    isAdmin ||
    isHR ||
    isNSM ||
    role?.hierarchy_level === 1 ||
    (role?.hierarchy_level === 2 && (role?.can_view_all_sales === true || role?.can_manage_staff === true));

  // Tier 2: Regional View (RSM, SE) -> Only sees data of staff from their assigned regions
  const isRegional =
    !isNational &&
    (roleKey === "regional_sales_manager" ||
      roleKey === "rsm" ||
      roleKey === "sales_executive" ||
      roleKey === "se" ||
      roleName.includes("regional sales") ||
      roleName.includes("sales executive") ||
      role?.can_manage_staff === true ||
      role?.hierarchy_level === 3 ||
      role?.hierarchy_level === 4);

  // Tier 3: Individual View (BA, VSR, Market Sitter) -> Only sees respective sales data and outlets in their regions
  const isIndividual = !isNational && !isRegional;

  let tier: RoleTier = "individual";
  if (isNational) tier = "national";
  else if (isRegional) tier = "regional";

  return {
    tier,
    isNational,
    isRegional,
    isIndividual,
    staffId,
    staffName,
    staffEmail,
    roleKey,
    assignedRegions: isNational ? [] : rawRegions,
  };
}

/**
 * Filters Sales records based on role access rules:
 * - Admin, NSM, HR: all sales
 * - RSM, SE: sales by staff from their assigned regions or outlets in their regions
 * - BA, VSR: respective sales data only
 */
export function filterSalesByScope(sales: Sale[], scope: UserScope): Sale[] {
  if (scope.isNational) {
    return sales;
  }

  if (scope.isRegional) {
    // RSM & SE: see data of staff from their assigned regions
    if (scope.assignedRegions.length === 0) {
      // If no explicit region is configured, allow own sales
      return sales.filter((s) => s.staff_id === scope.staffId || normalize(s.staff) === normalize(scope.staffName));
    }

    return sales.filter((s) => {
      // Direct staff ownership
      if (s.staff_id && s.staff_id === scope.staffId) return true;
      if (s.staff && normalize(s.staff) === normalize(scope.staffName)) return true;

      // Staff member belongs to assigned region
      if (matchRegion(s.staff_region, scope.assignedRegions)) return true;

      // Or outlet is in assigned region
      if (matchRegion(s.outlet_region, scope.assignedRegions)) return true;
      if (matchRegion(s.outlet_state, scope.assignedRegions)) return true;

      return false;
    });
  }

  // BA, VSR: respective sales data only
  return sales.filter((s) => {
    if (s.staff_id && scope.staffId) {
      return s.staff_id === scope.staffId;
    }
    if (s.staff && scope.staffName) {
      return normalize(s.staff) === normalize(scope.staffName);
    }
    return false;
  });
}

/**
 * Filters Visit and Attendance records based on role access rules:
 * - Admin, NSM, HR: all visits
 * - RSM, SE: visits by staff from assigned regions
 * - BA, VSR: respective visits only
 */
export function filterVisitsByScope(visits: VisitRecord[], scope: UserScope): VisitRecord[] {
  if (scope.isNational) {
    return visits;
  }

  if (scope.isRegional) {
    if (scope.assignedRegions.length === 0) {
      return visits.filter((v) => v.staffId === scope.staffId || normalize(v.staff) === normalize(scope.staffName));
    }

    return visits.filter((v) => {
      // Direct staff ownership
      if (v.staffId && v.staffId === scope.staffId) return true;
      if (v.staff && normalize(v.staff) === normalize(scope.staffName)) return true;

      // Staff member assigned to this region
      if (matchRegion(v.staffRegion, scope.assignedRegions)) return true;
      if (
        Array.isArray(v.staffAssignedRegions) &&
        v.staffAssignedRegions.some((r) => matchRegion(r, scope.assignedRegions))
      ) {
        return true;
      }

      // Outlet located in this region
      if (matchRegion(v.outletRegion, scope.assignedRegions)) return true;
      if (matchRegion(v.outletState, scope.assignedRegions)) return true;

      return false;
    });
  }

  // BA, VSR: respective visits only
  return visits.filter((v) => {
    if (v.staffId && scope.staffId) {
      return v.staffId === scope.staffId;
    }
    if (v.staff && scope.staffName) {
      return normalize(v.staff) === normalize(scope.staffName);
    }
    return false;
  });
}

/**
 * Filters Outlets based on role access rules:
 * - Admin, NSM, HR: all outlets
 * - RSM, SE, BA, VSR: outlets assigned in their regions
 */
export function filterOutletsByScope(outlets: Outlet[], scope: UserScope): Outlet[] {
  if (scope.isNational) {
    return outlets;
  }

  if (scope.assignedRegions.length === 0) {
    return outlets;
  }

  return outlets.filter((o) => {
    if (scope.assignedRegions.some((reg) => doesOutletMatchRegion(o, reg))) return true;
    if (matchRegion(o.region_id, scope.assignedRegions)) return true;
    if (matchRegion(o.region, scope.assignedRegions)) return true;
    if (matchRegion(o.state, scope.assignedRegions)) return true;
    if (o.assigned_manager && (o.assigned_manager === scope.staffId || normalize(o.assigned_manager) === normalize(scope.staffName))) return true;
    return false;
  });
}

/**
 * Filters Targets based on role access rules:
 * - Admin, NSM, HR: all targets
 * - RSM, SE: targets for staff in assigned regions
 * - BA, VSR: respective targets only
 */
export function filterTargetsByScope(targets: TargetRecord[], scope: UserScope): TargetRecord[] {
  if (scope.isNational) {
    return targets;
  }

  if (scope.isRegional) {
    if (scope.assignedRegions.length === 0) {
      return targets.filter(
        (t) => t.salesRep.id === scope.staffId || normalize(t.salesRep.name) === normalize(scope.staffName)
      );
    }

    return targets.filter((t) => {
      if (t.salesRep.id === scope.staffId) return true;
      if (normalize(t.salesRep.name) === normalize(scope.staffName)) return true;
      if (matchRegion(t.salesRep.region, scope.assignedRegions)) return true;
      return false;
    });
  }

  // BA, VSR: respective targets only
  return targets.filter(
    (t) => t.salesRep.id === scope.staffId || normalize(t.salesRep.name) === normalize(scope.staffName)
  );
}

/**
 * Filters Staff / User accounts based on role access rules:
 * - Admin, NSM, HR: all staff
 * - RSM, SE: staff belonging to their assigned regions
 * - BA, VSR: self only
 */
export function filterStaffByScope<
  T extends {
    id?: string;
    name?: string;
    region?: string | null;
    assigned_regions?: string[] | null;
    email?: string | null;
  }
>(staffList: T[], scope: UserScope): T[] {
  if (scope.isNational) {
    return staffList;
  }

  if (scope.isRegional) {
    if (scope.assignedRegions.length === 0) {
      return staffList.filter(
        (s) => s.id === scope.staffId || normalize(s.name) === normalize(scope.staffName)
      );
    }

    return staffList.filter((s) => {
      if (s.id && s.id === scope.staffId) return true;
      if (s.name && normalize(s.name) === normalize(scope.staffName)) return true;
      if (matchRegion(s.region, scope.assignedRegions)) return true;
      if (Array.isArray(s.assigned_regions) && s.assigned_regions.some((r) => matchRegion(r, scope.assignedRegions))) {
        return true;
      }
      return false;
    });
  }

  // BA, VSR: self only
  return staffList.filter(
    (s) => (s.id && s.id === scope.staffId) || (s.name && normalize(s.name) === normalize(scope.staffName))
  );
}
