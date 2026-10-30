import { createClient } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

/**
 * Separate, non-persisting client used ONLY for supabase.auth.signUp when an
 * admin creates a user. Using the main client would replace the admin's session
 * with the newly created user's session, causing the follow-up staff insert to
 * be rejected by RLS (and effectively logging the admin out).
 */
const provisioningClient = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: "sb-user-provisioning",
    },
  }
);

/** Columns added by the user-management migration; may not exist on older databases. */
const OPTIONAL_STAFF_COLUMNS = ["reports_to", "assigned_regions", "avatar_url", "role"] as const;

const ROLE_TO_LEGACY_NUM: Record<RoleKey, number> = {
  administrator: 1,
  hr: 2,
  national_sales_manager: 3,
  regional_sales_manager: 4,
  sales_executive: 5,
  brand_ambassador: 6,
  vsr: 7,
};

function isMissingColumnError(err: any): boolean {
  const text = `${err?.message ?? ""} ${err?.details ?? ""}`;
  return (
    err?.code === "PGRST204" ||
    err?.code === "42703" ||
    /column .* does not exist|could not find the .* column/i.test(text)
  );
}

function isRoleForeignKeyError(err: any): boolean {
  const text = `${err?.message ?? ""} ${err?.details ?? ""}`;
  return err?.code === "23503" && /assigned_role|user_roles/i.test(text);
}

function describeSupabaseError(err: any): string {
  if (!err) return "Unknown Supabase error";
  if (err.code === "42501") {
    return "Permission denied by Supabase row-level security. Run the fix migration in Supabase SQL Editor (20261010180000_fix_admin_staff_rls_and_link.sql) to link your administrator account.";
  }
  if (err.code === "23505") {
    return "A staff record with this email or ID already exists.";
  }
  return err.message || String(err);
}

/**
 * Writes a staff row (insert or update), retrying without optional columns or the
 * role FK if the remote schema is not fully migrated yet. Returns the written row.
 */
async function writeStaffRow(
  mode: "insert" | "update" | "upsert",
  row: Record<string, any>,
  id: string
): Promise<{ data: any[] | null; error: any; droppedFields: string[] }> {
  const payload = { ...row };
  const droppedFields: string[] = [];

  for (let attempt = 0; attempt < 3; attempt++) {
    const query =
      mode === "insert"
        ? supabase.from("staff").insert(payload).select()
        : mode === "upsert"
        ? supabase.from("staff").upsert({ id, ...payload }, { onConflict: "id" }).select()
        : supabase.from("staff").update(payload).eq("id", id).select();

    const { data, error } = await query;
    if (!error) return { data, error: null, droppedFields };

    if (isMissingColumnError(error) && OPTIONAL_STAFF_COLUMNS.some((c) => c in payload)) {
      for (const c of OPTIONAL_STAFF_COLUMNS) {
        if (c in payload) {
          delete payload[c];
          droppedFields.push(c);
        }
      }
      continue;
    }
    if (isRoleForeignKeyError(error) && "assigned_role" in payload) {
      delete payload.assigned_role;
      droppedFields.push("assigned_role");
      continue;
    }
    return { data: null, error, droppedFields };
  }
  return { data: null, error: { message: "Failed to write staff row after retries" }, droppedFields };
}

export type RoleKey =
  | "administrator"
  | "hr"
  | "national_sales_manager"
  | "regional_sales_manager"
  | "sales_executive"
  | "brand_ambassador"
  | "vsr";

export type RoleDefinition = {
  id: string; // Valid UUID
  key: string;
  name: string;
  shortName: string;
  hierarchy_level: number;
  can_manage_staff: boolean;
  can_assign_targets: boolean;
  can_view_all_sales: boolean;
  description: string;
  color: string;
  badgeBg: string;
  badgeText: string;
  permissions: string[];
  is_system_default?: boolean;
  is_active?: boolean;
  allowed_pages?: string[];
  allowed_reporting_roles?: string[];
};

export type SystemPage = {
  key: string;
  label: string;
  description: string;
  category: "analytics" | "operations" | "admin";
};

export const APP_SYSTEM_PAGES: SystemPage[] = [
  { key: "dashboard", label: "Dashboard Overview", description: "View sales performance metrics, KPI charts, and activity feeds", category: "analytics" },
  { key: "sales", label: "Sales Log", description: "Record and view daily sales entries (bottles & cases)", category: "operations" },
  { key: "outlets", label: "Outlet Management", description: "Manage retail outlets, bars, and customer accounts", category: "operations" },
  { key: "targets", label: "Targets & KPI", description: "Set, assign, and track monthly sales targets", category: "operations" },
  { key: "visits", label: "Visits & Attendance", description: "Log field visits, check-ins, and view staff attendance logs", category: "operations" },
  { key: "reports", label: "Reports & Analytics", description: "Access executive reports, team performance, and CSV exports", category: "analytics" },
  { key: "settings", label: "Settings", description: "Access application settings and personal account profile", category: "admin" },
  { key: "users", label: "User Management", description: "Manage staff accounts, credentials, and reporting hierarchy", category: "admin" },
  { key: "roles", label: "Role & Permission Management", description: "Create roles and configure page access permissions", category: "admin" },
];

export const SYSTEM_ROLES: RoleDefinition[] = [
  {
    id: "a0000000-0000-4000-8000-000000000001",
    key: "administrator",
    name: "Administrator",
    shortName: "Admin",
    hierarchy_level: 1,
    can_manage_staff: true,
    can_assign_targets: true,
    can_view_all_sales: true,
    is_system_default: true,
    is_active: true,
    description: "Full system access with all permissions, settings, security, and global configuration.",
    color: "#b91c1c",
    badgeBg: "#fee2e2",
    badgeText: "#991b1b",
    permissions: ["full_access", "manage_users", "manage_roles", "view_all_data", "system_settings"],
    allowed_pages: ["dashboard", "sales", "outlets", "targets", "visits", "reports", "settings", "users", "roles"],
    allowed_reporting_roles: ["Human Resources", "National Sales Manager", "Regional Sales Manager", "Sales Executive", "Brand Ambassador", "Van Sales Rep"],
  },
  {
    id: "a0000000-0000-4000-8000-000000000002",
    key: "hr",
    name: "Human Resources",
    shortName: "HR",
    hierarchy_level: 1,
    can_manage_staff: true,
    can_assign_targets: false,
    can_view_all_sales: true,
    is_system_default: true,
    is_active: true,
    description: "Monitors non-admin staff activities, attendance, audit history, and reporting chains.",
    color: "#065f46",
    badgeBg: "#d1fae5",
    badgeText: "#047857",
    permissions: ["view_all_activities", "view_all_staff", "view_attendance", "view_reports", "audit_logs"],
    allowed_pages: ["dashboard", "sales", "visits", "reports", "users"],
    allowed_reporting_roles: ["National Sales Manager", "Regional Sales Manager", "Sales Executive", "Brand Ambassador", "Van Sales Rep"],
  },
  {
    id: "a0000000-0000-4000-8000-000000000003",
    key: "national_sales_manager",
    name: "National Sales Manager",
    shortName: "NSM",
    hierarchy_level: 2,
    can_manage_staff: true,
    can_assign_targets: true,
    can_view_all_sales: true,
    is_system_default: true,
    is_active: true,
    description: "Oversees all regional sales operations and sales rep target allocation.",
    color: "#064e3b",
    badgeBg: "#ecfdf5",
    badgeText: "#065f46",
    permissions: ["view_national_sales", "assign_targets", "manage_regions", "view_all_activities", "view_reports"],
    allowed_pages: ["dashboard", "sales", "outlets", "targets", "visits", "reports"],
    allowed_reporting_roles: ["Regional Sales Manager", "Sales Executive", "Brand Ambassador", "Van Sales Rep"],
  },
  {
    id: "a0000000-0000-4000-8000-000000000004",
    key: "sales_executive",
    name: "Sales Executive",
    shortName: "SE",
    hierarchy_level: 3,
    can_manage_staff: true,
    can_assign_targets: true,
    can_view_all_sales: false,
    is_system_default: true,
    is_active: true,
    description: "Manages outlet relationships and executes sales operations.",
    color: "#6b7280",
    badgeBg: "#f3f4f6",
    badgeText: "#374151",
    permissions: ["view_sales", "create_sales", "manage_assigned_bas", "view_visits"],
    allowed_pages: ["dashboard", "sales", "outlets", "targets", "visits"],
    allowed_reporting_roles: ["Brand Ambassador", "Van Sales Rep"],
  },
  {
    id: "a0000000-0000-4000-8000-000000000005",
    key: "regional_sales_manager",
    name: "Regional Sales Manager",
    shortName: "RSM",
    hierarchy_level: 3,
    can_manage_staff: true,
    can_assign_targets: true,
    can_view_all_sales: false,
    is_system_default: true,
    is_active: true,
    description: "Manages sales operations within a specific geographical region.",
    color: "#d97706",
    badgeBg: "#fef3c7",
    badgeText: "#b45309",
    permissions: ["view_regional_sales", "assign_regional_targets", "manage_regional_staff", "view_reports"],
    allowed_pages: ["dashboard", "sales", "outlets", "targets", "visits", "reports"],
    allowed_reporting_roles: ["Sales Executive", "Brand Ambassador", "Van Sales Rep"],
  },
  {
    id: "a0000000-0000-4000-8000-000000000006",
    key: "brand_ambassador",
    name: "Brand Ambassador",
    shortName: "BA",
    hierarchy_level: 4,
    can_manage_staff: false,
    can_assign_targets: false,
    can_view_all_sales: false,
    is_system_default: true,
    is_active: true,
    description: "Field representative for sales and outlet promotions.",
    color: "#047857",
    badgeBg: "#d1fae5",
    badgeText: "#065f46",
    permissions: ["view_sales", "create_sales", "check_in_outlet"],
    allowed_pages: ["dashboard", "sales", "visits"],
    allowed_reporting_roles: [],
  },
  {
    id: "a0000000-0000-4000-8000-000000000007",
    key: "vsr",
    name: "Van Sales Rep",
    shortName: "VSR",
    hierarchy_level: 4,
    can_manage_staff: false,
    can_assign_targets: false,
    can_view_all_sales: false,
    is_system_default: true,
    is_active: true,
    description: "Mobile distributor recording sales and attendance across retail accounts.",
    color: "#c2410c",
    badgeBg: "#ffedd5",
    badgeText: "#9a3412",
    permissions: ["view_sales", "create_sales", "check_in_outlet"],
    allowed_pages: ["dashboard", "sales", "visits"],
    allowed_reporting_roles: [],
  },
];

export const AVAILABLE_REGIONS = [
  "Edo Region",
  "Lagos Island",
  "Victoria Island",
  "Ikeja",
  "Lekki",
  "Surulere",
  "Lagos Mainland",
  "Port Harcourt",
  "Abuja Central",
  "Ibadan",
  "Enugu - East",
  "South Region",
];

export type UserAccount = {
  id: string; // UUID
  name: string;
  email: string;
  phone: string;
  role_key: RoleKey;
  region: string;
  assigned_regions: string[];
  team: string;
  reports_to_id: string | null;
  reports_to_name?: string | null;
  is_active: boolean;
  avatar_url?: string | null;
  created_at: string;
};

export type HierarchyValidationResult = {
  isOrphaned: boolean;
  issues: string[];
};

export type UserMutationResult = {
  success: boolean;
  user: UserAccount;
  supabaseSynced: boolean;
  message: string;
  error?: string;
};

export function isUuid(str: string | null | undefined): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export function ensureValidUuid(id: string): string {
  if (isUuid(id)) return id;
  const seedMatch = id.match(/^usr-(\d+)$/);
  if (seedMatch) {
    const num = parseInt(seedMatch[1], 10);
    const hex = num.toString(16).padStart(12, "0");
    return `b0000000-0000-4000-8000-${hex}`;
  }
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "c0000000-0000-4000-8000-" + Date.now().toString(16).padStart(12, "0").slice(-12);
}

export const INITIAL_SEED_USERS: UserAccount[] = [];

/**
 * Validates reporting hierarchy rules:
 * 1. Administrator sits outside sales hierarchy (reports to no one, should not be assigned a region).
 * 2. HR sits at executive corporate level (sees all activities like NSM, reports to Admin or none).
 * 3. NSM is the overall sales lead (reports to Admin or none).
 * 4. RSM oversees an assigned region (must have region, reports to NSM).
 * 5. SE oversees sales execution in an assigned region (must have region, reports to RSM or NSM).
 * 6. BA must be assigned to an SE or RSM in their assigned region!
 * 7. VSR must have a region and report to an SE or RSM (or NSM) in that region.
 */
export function validateUserHierarchy(
  user: UserAccount,
  allUsers: UserAccount[]
): HierarchyValidationResult {
  const issues: string[] = [];

// 1. Administrator rules
  if (user.role_key === "administrator") {
    if (user.reports_to_id) {
      issues.push("Administrator sits outside the sales reporting hierarchy and should not report to another manager.");
    }
    return {
      isOrphaned: issues.length > 0,
      issues,
    };
  }

  // 2. HR rules
  if (user.role_key === "hr") {
    if (user.reports_to_id) {
      const manager = allUsers.find((u) => u.id === user.reports_to_id);
      if (manager && manager.role_key !== "administrator") {
        issues.push("Human Resources (HR) sits at the corporate executive level and should only report to an Administrator.");
      }
    }
    return {
      isOrphaned: issues.length > 0,
      issues,
    };
  }

  // 3. National Sales Manager (NSM) rules
  if (user.role_key === "national_sales_manager") {
    if (user.reports_to_id) {
      const manager = allUsers.find((u) => u.id === user.reports_to_id);
      if (manager && manager.role_key !== "administrator") {
        issues.push("National Sales Manager (NSM) is the overall sales leader and should only report to an Administrator.");
      }
    }
    return {
      isOrphaned: issues.length > 0,
      issues,
    };
  }

  // 4. RSM rules
  if (user.role_key === "regional_sales_manager") {
    if (!user.region || user.region === "National") {
      issues.push("Regional Sales Manager (RSM) must oversee an assigned geographic region.");
    }
    if (!user.reports_to_id) {
      issues.push("Regional Sales Manager (RSM) has no valid reporting path; must report to the National Sales Manager (NSM).");
    } else {
      const manager = allUsers.find((u) => u.id === user.reports_to_id);
      if (!manager || (manager.role_key !== "national_sales_manager" && manager.role_key !== "administrator")) {
        issues.push("Regional Sales Manager (RSM) must report to the National Sales Manager (NSM).");
      }
    }
    return {
      isOrphaned: issues.length > 0,
      issues,
    };
  }

  // 5. SE rules
  if (user.role_key === "sales_executive") {
    if (!user.region || user.region === "National") {
      issues.push("Sales Executive (SE) must oversee an assigned territory region.");
    }
    if (!user.reports_to_id) {
      issues.push("Sales Executive (SE) has no valid reporting path; must report to a Regional Sales Manager (RSM) or National Sales Manager (NSM).");
    } else {
      const manager = allUsers.find((u) => u.id === user.reports_to_id);
      if (!manager || !["regional_sales_manager", "national_sales_manager", "administrator"].includes(manager.role_key)) {
        issues.push("Sales Executive (SE) must report to a Regional Sales Manager (RSM) or NSM.");
      }
    }
    return {
      isOrphaned: issues.length > 0,
      issues,
    };
  }

  // 6. Brand Ambassador (BA) rules - STRICT
  if (user.role_key === "brand_ambassador") {
    if (!user.reports_to_id) {
      issues.push("Brand Ambassador (BA) must be assigned to a Sales Executive (SE) or Regional Sales Manager (RSM) in their region.");
    } else {
      const manager = allUsers.find((u) => u.id === user.reports_to_id);
      if (!manager) {
        issues.push("Assigned reporting manager does not exist in the active user directory.");
      } else if (manager.role_key !== "sales_executive" && manager.role_key !== "regional_sales_manager") {
        issues.push(`Brand Ambassador (BA) cannot report to a ${manager.role_key.replace(/_/g, " ")}; must report to a Sales Executive (SE) or Regional Sales Manager (RSM).`);
      } else {
        // Region match check
        const managerRegions = manager.assigned_regions?.length ? manager.assigned_regions : [manager.region];
        const userRegions = user.assigned_regions?.length ? user.assigned_regions : [user.region];
        const sharesRegion = userRegions.some((r) => managerRegions.includes(r)) || manager.region === "National";
        if (!sharesRegion) {
          issues.push(`Brand Ambassador is assigned to ${user.region} but manager (${manager.name}) is in ${manager.region}. Both must share a region.`);
        }
      }
    }
    return {
      isOrphaned: issues.length > 0,
      issues,
    };
  }

  // 7. Van Sales Rep (VSR) rules
  if (user.role_key === "vsr") {
    if (!user.reports_to_id) {
      issues.push("Van Sales Rep (VSR) must report to a Sales Executive (SE) or Regional Sales Manager (RSM) in their assigned region.");
    } else {
      const manager = allUsers.find((u) => u.id === user.reports_to_id);
      if (!manager) {
        issues.push("Assigned manager does not exist in the active roster.");
      } else if (!["sales_executive", "regional_sales_manager", "national_sales_manager"].includes(manager.role_key)) {
        issues.push("Van Sales Rep (VSR) must report to a Sales Executive or Regional Sales Manager.");
      }
    }
    return {
      isOrphaned: issues.length > 0,
      issues,
    };
  }

  return { isOrphaned: false, issues: [] };
}

/**
 * Returns available manager candidates for a user given their selected role and region.
 */
export function getEligibleManagers(
  targetRole: RoleKey,
  targetRegion: string,
  allUsers: UserAccount[],
  currentUserId?: string
): UserAccount[] {
  const eligible = allUsers.filter((u) => u.id !== currentUserId && u.is_active);

  switch (targetRole) {
    case "brand_ambassador": {
      return eligible.filter(
        (u) =>
          (u.role_key === "sales_executive" || u.role_key === "regional_sales_manager") &&
          (!targetRegion || u.assigned_regions?.includes(targetRegion) || u.region === targetRegion || u.region === "National")
      );
    }
    case "vsr": {
      return eligible.filter(
        (u) =>
          ["sales_executive", "regional_sales_manager", "national_sales_manager"].includes(u.role_key) &&
          (!targetRegion || u.assigned_regions?.includes(targetRegion) || u.region === targetRegion || u.region === "National")
      );
    }
    case "sales_executive": {
      return eligible.filter((u) => u.role_key === "regional_sales_manager" || u.role_key === "national_sales_manager");
    }
    case "regional_sales_manager": {
      return eligible.filter((u) => u.role_key === "national_sales_manager" || u.role_key === "administrator");
    }
    case "national_sales_manager":
    case "hr": {
      return eligible.filter((u) => u.role_key === "administrator");
    }
    case "administrator":
    default:
      return [];
  }
}

/**
 * Helper to resolve the database UUID of a role from user_roles table or SYSTEM_ROLES fallback.
 */
export async function resolveRoleId(roleKey: RoleKey): Promise<string> {
  try {
    const { data } = await supabase
      .from("user_roles")
      .select("id, key")
      .eq("key", roleKey)
      .maybeSingle();

    if (data?.id && isUuid(data.id)) {
      return data.id;
    }
  } catch (err) {
    console.warn("resolveRoleId query notice:", err);
  }

  const found = SYSTEM_ROLES.find((r) => r.key === roleKey);
  return found?.id || "a0000000-0000-4000-8000-000000000005";
}

/**
 * Migrates local cache array so that legacy IDs like 'usr-01' become valid UUIDs.
 */
function normalizeUserAccounts(accounts: UserAccount[]): UserAccount[] {
  return accounts.map((u) => ({
    ...u,
    id: ensureValidUuid(u.id),
    reports_to_id: u.reports_to_id ? ensureValidUuid(u.reports_to_id) : null,
  }));
}

export async function loadUserAccounts(): Promise<UserAccount[]> {
  const baseColumns = "id, name, email, phone, region, team, is_active, assigned_role, created_at";
  const roleJoin = "user_roles ( id, key, name )";

  // Try the fully-migrated shape first, then progressively simpler selects.
  const attempts = [
    `${baseColumns}, reports_to, assigned_regions, avatar_url, ${roleJoin}`,
    `${baseColumns}, ${roleJoin}`,
    baseColumns,
  ];

  let data: any[] | null = null;
  let error: any = null;
  for (const columns of attempts) {
    const res = await supabase.from("staff").select(columns).order("name");
    data = res.data as any[] | null;
    error = res.error;
    if (!error) break;
  }

  if (error) {
    throw error;
  }

  if (!data) return [];

  return data.map((s: any) => {
    const roleRel = s.user_roles ? (Array.isArray(s.user_roles) ? s.user_roles[0] : s.user_roles) : null;
    let roleKey: RoleKey = "sales_executive";

    if (roleRel?.key) {
      roleKey = roleRel.key.toLowerCase() as RoleKey;
    } else if (s.assigned_role) {
      const matchedRole = SYSTEM_ROLES.find(
        (r) => r.id === s.assigned_role || r.key === s.assigned_role
      );
      if (matchedRole) roleKey = matchedRole.key as RoleKey;
    }

    const isNationalRole =
      roleKey === "administrator" ||
      roleKey === "national_sales_manager" ||
      roleKey === "hr" ||
      roleKey.includes("admin") ||
      roleKey.includes("human_resource") ||
      roleKey.includes("national_sales");

    return {
      id: s.id,
      name: s.name || "Unnamed User",
      email: s.email || `${s.id}@penedge.com`,
      phone: s.phone || "",
      role_key: roleKey,
      region: isNationalRole ? "National" : (s.region || "Lagos Island"),
      assigned_regions: isNationalRole ? [] : (s.assigned_regions?.length ? s.assigned_regions : (s.region ? [s.region] : ["Lagos Island"])),
      team: s.team || "Field Execution Team",
      reports_to_id: s.reports_to || null,
      is_active: s.is_active ?? true,
      avatar_url: s.avatar_url || null,
      created_at: s.created_at || new Date().toISOString(),
    };
  });
}

/**
 * Creates a new user account:
 * 1. Generates a valid UUID.
 * 2. Ensures role ID is resolved from user_roles.
 * 3. Registers Supabase Auth user if tempPassword provided.
 * 4. Inserts row directly into Supabase 'staff' table.
 * 5. Updates persistent local cache.
 */
export async function createUserAccount(
  input: UserAccount,
  tempPassword?: string
): Promise<UserMutationResult> {
  const userId = ensureValidUuid(input.id);
  const roleId = await resolveRoleId(input.role_key);

  let authUserId: string | null = null;

  // 1. Register auth credentials in Supabase Auth if provided
  // (isolated client so the admin's own session is not replaced)
  if (tempPassword && input.email) {
    try {
      const { data: authData, error: authErr } = await provisioningClient.auth.signUp({
        email: input.email.trim().toLowerCase(),
        password: tempPassword,
      });

      if (authErr) {
        console.warn("Supabase auth signUp notice:", authErr.message);
        const isAlreadyRegistered = /already registered|already exists|email.*already in use/i.test(
          authErr.message
        );

        if (isAlreadyRegistered) {
          // Check if this staff member already exists in the staff table
          const { data: existingStaff } = await supabase
            .from("staff")
            .select("id, name, email")
            .ilike("email", input.email.trim())
            .maybeSingle();

          if (existingStaff) {
            return {
              success: false,
              user: input,
              supabaseSynced: false,
              message: `A staff profile for ${existingStaff.name || input.email} (${input.email}) already exists.`,
              error: authErr.message,
            };
          }

          // User credentials already exist in Supabase Auth (e.g. from earlier attempt),
          // but their staff profile is missing. Proceed to create the staff profile in Supabase.
          console.info(
            "User already registered in Supabase Auth; continuing to create staff profile."
          );
        } else {
          let errorMsg = authErr.message;
          if (/rate limit/i.test(authErr.message)) {
            errorMsg =
              "Supabase Auth email rate limit exceeded. Please disable 'Confirm email' in Supabase Dashboard (Authentication -> Providers -> Email) or wait a few minutes before trying again.";
          }
          return {
            success: false,
            user: input,
            supabaseSynced: false,
            message: `Failed to create login credentials in Supabase Auth: ${errorMsg}`,
            error: errorMsg,
          };
        }
      }

      if (authData?.user?.id) {
        if (Array.isArray(authData.user.identities) && authData.user.identities.length === 0) {
          console.info("User already existed in Supabase Auth (empty identities array)");
        } else {
          authUserId = authData.user.id;
        }
      }
    } catch (e: any) {
      console.error("Supabase auth signUp exception:", e);
      return {
        success: false,
        user: input,
        supabaseSynced: false,
        message: `Failed to create user in Auth: ${e?.message || String(e)}`,
        error: e?.message || String(e),
      };
    }
  }

  const finalUser: UserAccount = {
    ...input,
    id: userId,
    created_at: input.created_at || new Date().toISOString(),
  };

  // 2. Direct write to Supabase staff table
  let supabaseSynced = false;
  let supabaseErrorMsg: string | undefined;

  let droppedFields: string[] = [];

  try {
    const staffRow: Record<string, any> = {
      id: userId,
      name: finalUser.name,
      email: finalUser.email,
      phone: finalUser.phone || null,
      region: finalUser.region || null,
      team: finalUser.team || null,
      is_active: finalUser.is_active,
      assigned_role: roleId,
      role: ROLE_TO_LEGACY_NUM[finalUser.role_key] ?? 5,
      reports_to: finalUser.reports_to_id || null,
      assigned_regions: finalUser.assigned_regions ?? [],
      avatar_url: finalUser.avatar_url || null,
      created_at: finalUser.created_at,
    };
    if (authUserId) {
      staffRow.auth_user_id = authUserId;
    }

    // Proactively ensure the calling admin's session is linked in staff
    try {
      await supabase.rpc("link_current_user_staff");
    } catch {
      // Ignore if RPC is not yet created
    }

    const res = await writeStaffRow("insert", staffRow, userId);
    droppedFields = res.droppedFields;

    if (res.error) {
      console.warn("Direct staff insert warning:", res.error);
      supabaseErrorMsg = describeSupabaseError(res.error);
    } else if (!res.data || res.data.length === 0) {
      supabaseErrorMsg =
        "Supabase accepted the insert but returned no row (row-level security may be hiding it).";
    } else {
      supabaseSynced = true;
    }
  } catch (err: any) {
    console.error("Supabase staff insert error:", err);
    supabaseErrorMsg = describeSupabaseError(err);
  }

  const note = droppedFields.length
    ? ` Note: ${droppedFields.join(", ")} not saved — run the user-management migration in Supabase.`
    : "";

  return {
    success: supabaseSynced,
    user: finalUser,
    supabaseSynced,
    message: supabaseSynced
      ? `User ${finalUser.name} saved to Supabase.${note}`
      : `Could not save ${finalUser.name} to Supabase: ${supabaseErrorMsg}`,
    error: supabaseErrorMsg,
  };
}

/**
 * Updates an existing user account:
 * 1. Resolves role UUID from user_roles.
 * 2. Writes update to Supabase 'staff' table by ID.
 * 3. Falls back to upsert if row is not yet in Supabase (e.g. initial seed user).
 * 4. Updates persistent local cache.
 */
export async function updateUserAccount(
  updated: UserAccount
): Promise<UserMutationResult> {
  const userId = ensureValidUuid(updated.id);
  const roleId = await resolveRoleId(updated.role_key);

  const finalUser: UserAccount = {
    ...updated,
    id: userId,
  };

  let supabaseSynced = false;
  let supabaseErrorMsg: string | undefined;

  let droppedFields: string[] = [];

  try {
    const updatePayload: Record<string, any> = {
      name: finalUser.name,
      email: finalUser.email,
      phone: finalUser.phone || null,
      region: finalUser.region || null,
      team: finalUser.team || null,
      is_active: finalUser.is_active,
      assigned_role: roleId,
      role: ROLE_TO_LEGACY_NUM[finalUser.role_key] ?? 5,
      reports_to: finalUser.reports_to_id || null,
      assigned_regions: finalUser.assigned_regions ?? [],
      avatar_url: finalUser.avatar_url || null,
    };

    const updateRes = await writeStaffRow("update", updatePayload, userId);
    droppedFields = updateRes.droppedFields;

    if (updateRes.error) {
      console.warn("Staff update warning:", updateRes.error);
      supabaseErrorMsg = describeSupabaseError(updateRes.error);
    } else if (updateRes.data && updateRes.data.length > 0) {
      supabaseSynced = true;
    } else {
      // 0 rows matched: either the row isn't in the DB yet, or RLS blocked the update.
      const upsertRes = await writeStaffRow(
        "upsert",
        { ...updatePayload, created_at: finalUser.created_at || new Date().toISOString() },
        userId
      );
      droppedFields = upsertRes.droppedFields;
      if (!upsertRes.error && upsertRes.data && upsertRes.data.length > 0) {
        supabaseSynced = true;
      } else {
        console.warn("Staff upsert fallback warning:", upsertRes.error);
        supabaseErrorMsg = describeSupabaseError(
          upsertRes.error ?? { code: "42501" }
        );
      }
    }
  } catch (err: any) {
    console.error("Supabase staff update error:", err);
    supabaseErrorMsg = describeSupabaseError(err);
  }

  const note = droppedFields.length
    ? ` Note: ${droppedFields.join(", ")} not saved — run the user-management migration in Supabase.`
    : "";

  return {
    success: supabaseSynced,
    user: finalUser,
    supabaseSynced,
    message: supabaseSynced
      ? `User ${finalUser.name} updated in Supabase.${note}`
      : `Could not update ${finalUser.name} in Supabase: ${supabaseErrorMsg}`,
    error: supabaseErrorMsg,
  };
}

export async function saveUserAccounts(users: UserAccount[]): Promise<void> {
  const normalized = normalizeUserAccounts(users);
  
  // Sync to Supabase in background
  try {
    for (const u of normalized) {
      const roleId = await resolveRoleId(u.role_key);
      await writeStaffRow(
        "upsert",
        {
          name: u.name,
          email: u.email,
          phone: u.phone,
          region: u.region,
          team: u.team,
          is_active: u.is_active,
          assigned_role: roleId,
          role: ROLE_TO_LEGACY_NUM[u.role_key] ?? 5,
          reports_to: u.reports_to_id || null,
          assigned_regions: u.assigned_regions ?? [],
          avatar_url: u.avatar_url || null,
        },
        u.id
      );
    }
  } catch (err) {
    console.warn("Background sync to Supabase staff:", err);
  }
}

/**
 * Ensures system roles are initialized in Supabase user_roles table if accessible.
 */
export async function syncRolesToSupabase(): Promise<void> {
  try {
    for (const role of SYSTEM_ROLES) {
      await supabase.from("user_roles").upsert(
        {
          id: role.id,
          key: role.key,
          name: role.name,
          hierarchy_level: role.hierarchy_level,
          can_manage_staff: role.can_manage_staff,
          can_assign_targets: role.can_assign_targets,
          can_view_all_sales: role.can_view_all_sales,
          description: role.description,
        },
        { onConflict: "key" }
      );
    }
  } catch (e) {
    console.warn("syncRolesToSupabase notice:", e);
  }
}

const STORAGE_KEY_PW_RESETS = "penedge_password_resets_v1";

export type PasswordResetRecord = {
  email: string;
  resetAt: string;
  resetBy?: string;
  mustChangeOnLogin: boolean;
  deliveryChannels?: string[];
};

export function getPasswordResetRecord(email: string | null | undefined): PasswordResetRecord | null {
  if (!email) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PW_RESETS);
    if (!raw) return null;
    const map: Record<string, PasswordResetRecord> = JSON.parse(raw);
    return map[email.trim().toLowerCase()] || null;
  } catch {
    return null;
  }
}

export function savePasswordResetRecord(record: PasswordResetRecord): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PW_RESETS);
    const map: Record<string, PasswordResetRecord> = raw ? JSON.parse(raw) : {};
    map[record.email.trim().toLowerCase()] = record;
    localStorage.setItem(STORAGE_KEY_PW_RESETS, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

export async function clearPasswordResetRequirement(email: string | null | undefined): Promise<void> {
  if (!email) return;
  const cleanEmail = email.trim().toLowerCase();
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PW_RESETS);
    if (raw) {
      const map: Record<string, PasswordResetRecord> = JSON.parse(raw);
      if (map[cleanEmail]) {
        map[cleanEmail] = { ...map[cleanEmail], mustChangeOnLogin: false };
        localStorage.setItem(STORAGE_KEY_PW_RESETS, JSON.stringify(map));
      }
    }
  } catch {
    // ignore
  }

  try {
    await supabase
      .from("staff")
      .update({ must_change_password: false })
      .eq("email", cleanEmail);
  } catch {
    // optional column may not exist on older schema
  }
}

/**
 * Formats a phone number into clean international E.164 digits for WhatsApp (wa.me) and SMS.
 * Defaults Nigerian 070/080/081/090/091 numbers to +234.
 */
export function formatWhatsAppPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/[^\d+]/g, "");
  const cleanDigits = digits.replace(/\+/g, "");
  if (!cleanDigits) return "";
  // Nigerian local format e.g. 08031234567 -> 2348031234567
  if (cleanDigits.length === 11 && cleanDigits.startsWith("0")) {
    return `234${cleanDigits.slice(1)}`;
  }
  // 10-digit Nigerian number without leading 0
  if (cleanDigits.length === 10 && /^[789][01]\d{8}$/.test(cleanDigits)) {
    return `234${cleanDigits}`;
  }
  return cleanDigits;
}

/**
 * Builds pre-formatted multi-channel share links (WhatsApp, SMS, Email mailto, and plain text)
 * so an Administrator can send a reset password or reset link to the user's Email, Phone, or WhatsApp.
 */
export function buildPasswordResetShareLinks(params: {
  name: string;
  email: string;
  phone?: string | null;
  tempPassword?: string;
  mode: "temp_password" | "reset_link";
  mustChangeOnLogin?: boolean;
}) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://penedge.app";
  const loginUrl = `${origin}/login`;
  const securitySettingsUrl = `${origin}/settings?tab=security`;
  const cleanPhone = formatWhatsAppPhone(params.phone);

  const subject =
    params.mode === "temp_password"
      ? "Pen Edge Sales Execution — Your Password Has Been Reset"
      : "Pen Edge Sales Execution — Password Reset Instructions";

  const plainTextMessage =
    params.mode === "temp_password"
      ? [
          `Hello ${params.name},`,
          ``,
          `Your Pen Edge Sales Execution account password has been reset by the System Administrator.`,
          ``,
          `🔐 Login Details:`,
          `• Portal: ${loginUrl}`,
          `• Email: ${params.email}`,
          `• Temporary Password: ${params.tempPassword || ""}`,
          ``,
          params.mustChangeOnLogin !== false
            ? `⚠️ Important: After signing in, please go to Account Settings → Security (${securitySettingsUrl}) to change this temporary password to your own personal password.`
            : `You can change your password anytime from Account Settings → Security (${securitySettingsUrl}).`,
        ].join("\n")
      : [
          `Hello ${params.name},`,
          ``,
          `A password reset link has been dispatched to your registered email (${params.email}) for your Pen Edge Sales Execution account.`,
          ``,
          `• Please check your email inbox (and spam folder) and click the reset link to set a new password.`,
          `• Portal Login: ${loginUrl}`,
        ].join("\n");

  const smsBody =
    params.mode === "temp_password"
      ? `Pen Edge Reset: Hi ${params.name}, your login email is ${params.email} and temporary password is ${params.tempPassword || ""}. Login at ${loginUrl} and change your password in Settings > Security.`
      : `Pen Edge Reset: Hi ${params.name}, a password reset link was sent to ${params.email}. Please check your inbox or login at ${loginUrl}.`;

  const whatsappUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(plainTextMessage)}`
    : `https://wa.me/?text=${encodeURIComponent(plainTextMessage)}`;

  const smsUrl = cleanPhone
    ? `sms:+${cleanPhone}?body=${encodeURIComponent(smsBody)}`
    : `sms:?body=${encodeURIComponent(smsBody)}`;

  const mailtoUrl = `mailto:${encodeURIComponent(params.email)}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(plainTextMessage)}`;

  return {
    cleanPhone,
    subject,
    plainTextMessage,
    smsBody,
    whatsappUrl,
    smsUrl,
    mailtoUrl,
  };
}

/**
 * Triggers an official password reset email to the user via Supabase Auth.
 */
export async function sendPasswordResetEmail(email: string): Promise<{ success: boolean; message: string }> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/login?reset=recovery`,
    });
    if (error) {
      return { success: false, message: error.message };
    }
    savePasswordResetRecord({
      email: cleanEmail,
      resetAt: new Date().toISOString(),
      mustChangeOnLogin: false,
      deliveryChannels: ["email_link"],
    });
    return { success: true, message: `Password reset email sent to ${email}.` };
  } catch (err: any) {
    return { success: false, message: err?.message || "Failed to send reset email." };
  }
}

/**
 * Updates a user's password directly using the admin RPC (for existing auth.users)
 * or falls back to the provisioning client (when creating/provisioning auth credentials).
 */
export async function adminResetUserPassword(
  email: string,
  newPassword: string,
  options?: {
    mustChangeOnLogin?: boolean;
    phone?: string;
    userId?: string;
  }
): Promise<{ success: boolean; message: string }> {
  try {
    if (!newPassword || newPassword.length < 6) {
      return { success: false, message: "Password must be at least 6 characters long." };
    }

    const cleanEmail = email.trim().toLowerCase();
    const mustChange = options?.mustChangeOnLogin ?? true;

    // If admin also provided or updated the user's phone/WhatsApp number, save it to staff
    if (options?.phone !== undefined && options.phone.trim()) {
      try {
        const phoneQuery = options.userId
          ? supabase.from("staff").update({ phone: options.phone.trim() }).eq("id", options.userId)
          : supabase.from("staff").update({ phone: options.phone.trim() }).eq("email", cleanEmail);
        await phoneQuery;
      } catch {
        // non-fatal
      }
    }

    // 1. Try security-definer RPC `admin_reset_user_password` first (handles existing users in auth.users)
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc("admin_reset_user_password", {
        p_email: cleanEmail,
        p_new_password: newPassword,
        p_must_change: mustChange,
      });

      if (!rpcErr && rpcData && rpcData.success === true) {
        savePasswordResetRecord({
          email: cleanEmail,
          resetAt: new Date().toISOString(),
          mustChangeOnLogin: mustChange,
          deliveryChannels: ["admin_temp_password"],
        });
        return {
          success: true,
          message: `Password for ${email} has been reset to the new temporary password. You can now send it to the user via Email, WhatsApp, or SMS below.`,
        };
      }
    } catch {
      // RPC may not be deployed yet; continue to provisioningClient fallback
    }

    // 2. Fallback: Provisioning client signUp (for staff rows not yet in auth.users)
    const { data: authData, error: authErr } = await provisioningClient.auth.signUp({
      email: cleanEmail,
      password: newPassword,
    });

    if (authErr) {
      // If user is already registered in Auth and RPC isn't deployed yet, trigger reset email link + record temp password
      if (/already registered|already exists/i.test(authErr.message)) {
        savePasswordResetRecord({
          email: cleanEmail,
          resetAt: new Date().toISOString(),
          mustChangeOnLogin: mustChange,
          deliveryChannels: ["admin_temp_password"],
        });
        return {
          success: true,
          message: `Temporary password prepared for ${email}. Note: Run migration 20261030100000_admin_password_reset_rpc.sql in Supabase SQL Editor for direct Auth password overwrite, or click 'Send Reset Email' / 'Share via WhatsApp' below.`,
        };
      }

      let msg = authErr.message;
      if (/rate limit/i.test(msg)) {
        msg =
          "Supabase Auth email rate limit exceeded. Please turn off 'Confirm email' in Supabase Dashboard (Authentication -> Providers -> Email) or share the credentials via WhatsApp / SMS below.";
      }
      return { success: false, message: `Failed to set user password in Auth: ${msg}` };
    }

    if (authData?.user?.id) {
      await supabase
        .from("staff")
        .update({ auth_user_id: authData.user.id })
        .eq("email", cleanEmail);
    }

    savePasswordResetRecord({
      email: cleanEmail,
      resetAt: new Date().toISOString(),
      mustChangeOnLogin: mustChange,
      deliveryChannels: ["admin_temp_password"],
    });

    return {
      success: true,
      message: `Password set successfully for ${email}. You can now send the credentials via Email, WhatsApp, or SMS below.`,
    };
  } catch (err: any) {
    return { success: false, message: err?.message || "Failed to update user password." };
  }
}

/**
 * Toggles a user's active status (deactivate or activate) in Supabase 'staff' table.
 */
export async function setUserActiveStatus(
  userId: string,
  isActive: boolean
): Promise<{ success: boolean; message: string }> {
  try {
    const { error } = await supabase
      .from("staff")
      .update({ is_active: isActive })
      .eq("id", userId);

    if (error) {
      return { success: false, message: describeSupabaseError(error) };
    }
    return {
      success: true,
      message: `User status set to ${isActive ? "Active" : "Inactive / Deactivated"} in Supabase.`,
    };
  } catch (err: any) {
    return { success: false, message: err?.message || "Failed to update account status." };
  }
}

const STORAGE_KEY_ROLES = "penedge_custom_roles_v2";

function ensureStringArray(val: any, fallback: string[] = []): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === "string" && val.trim().length > 0) {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return val.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return fallback;
}

/**
 * Loads all configured roles (combining system default roles and custom roles from Supabase/localStorage).
 */
export async function loadRoles(): Promise<RoleDefinition[]> {
  let customRoles: RoleDefinition[] = [];

  // Try loading from localStorage cache first
  try {
    const cached = localStorage.getItem(STORAGE_KEY_ROLES);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        customRoles = parsed.map((r: any) => ({
          ...r,
          permissions: ensureStringArray(r.permissions),
          allowed_pages: ensureStringArray(r.allowed_pages, ["dashboard", "sales"]),
          allowed_reporting_roles: ensureStringArray(r.allowed_reporting_roles),
        }));
      }
    }
  } catch (e) {
    console.warn("localStorage role read notice:", e);
  }

  // Try loading from Supabase user_roles table if available
  try {
    const { data } = await supabase.from("user_roles").select("*");
    if (data && data.length > 0) {
      const remoteRoles: RoleDefinition[] = data.map((r: any) => {
        const sysRole = SYSTEM_ROLES.find((sr) => sr.key === r.key);
        return {
          id: r.id || sysRole?.id || ensureValidUuid(""),
          key: r.key || sysRole?.key || "custom_role",
          name: r.name || sysRole?.name || r.key || "Custom Role",
          shortName: r.shortName || sysRole?.shortName || r.name?.substring(0, 3)?.toUpperCase() || "ROLE",
          hierarchy_level: r.hierarchy_level ?? sysRole?.hierarchy_level ?? 3,
          can_manage_staff: Boolean(r.can_manage_staff ?? sysRole?.can_manage_staff ?? false),
          can_assign_targets: Boolean(r.can_assign_targets ?? sysRole?.can_assign_targets ?? false),
          can_view_all_sales: Boolean(r.can_view_all_sales ?? sysRole?.can_view_all_sales ?? false),
          description: r.description || sysRole?.description || "Custom configured role",
          color: r.color || sysRole?.color || "#075544",
          badgeBg: r.badgeBg || sysRole?.badgeBg || "#e6f4f0",
          badgeText: r.badgeText || sysRole?.badgeText || "#075544",
          permissions: ensureStringArray(r.permissions, sysRole?.permissions || []),
          is_system_default: Boolean(r.is_system_default ?? sysRole?.is_system_default ?? false),
          is_active: Boolean(r.is_active ?? true),
          allowed_pages: ensureStringArray(r.allowed_pages, sysRole?.allowed_pages || ["dashboard", "sales"]),
          allowed_reporting_roles: ensureStringArray(r.allowed_reporting_roles, sysRole?.allowed_reporting_roles || []),
        };
      });

      // Merge remote roles with system defaults
      const combined = [...SYSTEM_ROLES];
      for (const rr of remoteRoles) {
        const idx = combined.findIndex((sr) => sr.key === rr.key);
        if (idx >= 0) {
          combined[idx] = { ...combined[idx], ...rr };
        } else {
          combined.push(rr);
        }
      }
      return combined;
    }
  } catch (err) {
    console.warn("loadRoles Supabase fetch notice:", err);
  }

  // Fallback to SYSTEM_ROLES merged with localStorage custom roles
  const combined = [...SYSTEM_ROLES];
  for (const cr of customRoles) {
    const idx = combined.findIndex((sr) => sr.key === cr.key);
    if (idx >= 0) {
      combined[idx] = { ...combined[idx], ...cr };
    } else {
      combined.push(cr);
    }
  }
  return combined;
}

/**
 * Saves a role definition (create or update).
 */
export async function saveRole(
  role: RoleDefinition
): Promise<{ success: boolean; role: RoleDefinition; message: string }> {
  try {
    const validRole: RoleDefinition = {
      ...role,
      id: isUuid(role.id) ? role.id : ensureValidUuid(""),
      is_active: role.is_active ?? true,
      allowed_pages: role.allowed_pages || ["dashboard", "sales"],
    };

    // 1. Try saving to Supabase
    try {
      await supabase.from("user_roles").upsert(
        {
          id: validRole.id,
          key: validRole.key,
          name: validRole.name,
          shortName: validRole.shortName,
          hierarchy_level: validRole.hierarchy_level,
          can_manage_staff: validRole.can_manage_staff,
          can_assign_targets: validRole.can_assign_targets,
          can_view_all_sales: validRole.can_view_all_sales,
          description: validRole.description,
          color: validRole.color,
          badgeBg: validRole.badgeBg,
          badgeText: validRole.badgeText,
          permissions: validRole.permissions,
          is_system_default: validRole.is_system_default ?? false,
          is_active: validRole.is_active,
          allowed_pages: validRole.allowed_pages,
          allowed_reporting_roles: validRole.allowed_reporting_roles,
        },
        { onConflict: "key" }
      );
    } catch (e) {
      console.warn("saveRole Supabase notice:", e);
    }

    // 2. Save to localStorage cache
    try {
      const existing = await loadRoles();
      const idx = existing.findIndex((r) => r.key === validRole.key || r.id === validRole.id);
      if (idx >= 0) {
        existing[idx] = validRole;
      } else {
        existing.push(validRole);
      }
      localStorage.setItem(STORAGE_KEY_ROLES, JSON.stringify(existing.filter((r) => !r.is_system_default)));
    } catch (e) {
      console.warn("saveRole localStorage notice:", e);
    }

    return {
      success: true,
      role: validRole,
      message: `Role "${validRole.name}" saved successfully.`,
    };
  } catch (err: any) {
    return {
      success: false,
      role,
      message: err?.message || "Failed to save role.",
    };
  }
}

/**
 * Deletes a custom role. System default roles cannot be deleted.
 */
export async function deleteRole(
  roleId: string,
  roleKey: string
): Promise<{ success: boolean; message: string }> {
  const sysRole = SYSTEM_ROLES.find((r) => r.key === roleKey || r.id === roleId);
  if (sysRole || roleKey === "administrator" || roleKey === "admin") {
    return {
      success: false,
      message: "System default roles cannot be deleted. You can edit their permissions instead.",
    };
  }

  try {
    // 1. Delete from Supabase
    try {
      await supabase.from("user_roles").delete().eq("id", roleId);
    } catch (e) {
      console.warn("deleteRole Supabase notice:", e);
    }

    // 2. Delete from localStorage cache
    try {
      const cached = localStorage.getItem(STORAGE_KEY_ROLES);
      if (cached) {
        const parsed: RoleDefinition[] = JSON.parse(cached);
        const filtered = parsed.filter((r) => r.id !== roleId && r.key !== roleKey);
        localStorage.setItem(STORAGE_KEY_ROLES, JSON.stringify(filtered));
      }
    } catch (e) {
      console.warn("deleteRole localStorage notice:", e);
    }

    return {
      success: true,
      message: "Role deleted successfully.",
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Failed to delete role.",
    };
  }
}
