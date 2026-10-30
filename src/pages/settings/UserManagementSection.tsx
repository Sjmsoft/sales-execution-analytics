import { useEffect, useMemo, useState } from "react";
import {
  Users,
  GitBranch,
  Search,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  Key,
  UserCheck,
  UserX,
  Download,
  RefreshCw,
  LayoutGrid,
  List,
  ArrowUpDown,
  Edit3,
  Copy,
  Check,
  AlertTriangle,
  MapPin,
  Shield,
  Filter,
} from "lucide-react";
import {
  loadUserAccounts,
  createUserAccount,
  updateUserAccount,
  setUserActiveStatus,
  validateUserHierarchy,
  syncRolesToSupabase,
  SYSTEM_ROLES,
  AVAILABLE_REGIONS,
  type UserAccount,
} from "../../services/userManagementService";
import { getRegions, type RegionItem } from "../../services/regionService";
import { EditUserDialog } from "./EditUserDialog";
import { CreateUserDialog } from "./CreateUserDialog";
import { HierarchyTreeModal } from "./HierarchyTreeModal";
import { ResetPasswordDialog } from "./ResetPasswordDialog";
import LogoLoader from "../../components/brand/LogoLoader";
import { useMinimumLoading } from "../../hooks/useMinimumLoading";

type SortOption =
  | "hierarchy"
  | "name_asc"
  | "name_desc"
  | "region"
  | "reports_desc"
  | "newest";

export function UserManagementSection() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [configuredRegions, setConfiguredRegions] = useState<RegionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const visibleLoading = useMinimumLoading(loading, 600);

  // Filters & View State
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [managerFilter, setManagerFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("hierarchy");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Copy feedback state
  const [copiedEmailId, setCopiedEmailId] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [resettingPasswordUser, setResettingPasswordUser] = useState<UserAccount | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [hierarchyModalOpen, setHierarchyModalOpen] = useState(false);
  const [notification, setNotification] = useState<string>("");

  function showToast(msg: string, duration = 4500) {
    setNotification(msg);
    setTimeout(() => {
      setNotification((prev) => (prev === msg ? "" : prev));
    }, duration);
  }

  async function fetchDirectory(isManualRefresh = false) {
    if (isManualRefresh) setRefreshing(true);
    try {
      const [accounts, regionsData] = await Promise.all([
        loadUserAccounts(),
        getRegions().catch(() => [] as RegionItem[]),
      ]);
      setUsers(accounts);
      setConfiguredRegions(regionsData);
      if (isManualRefresh) {
        showToast(`User directory synced (${accounts.length} accounts loaded).`);
      }
    } catch (err) {
      console.error("Failed to load user accounts:", err);
      if (isManualRefresh) {
        showToast("Could not refresh user directory.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void fetchDirectory(false);
    void syncRolesToSupabase();
  }, []);

  // Merge configured regions, AVAILABLE_REGIONS, and any regions dynamically present on users
  const regionOptions = useMemo(() => {
    const set = new Set<string>();
    const activeConfigured = configuredRegions
      .filter((r) => r.is_active !== false)
      .map((r) => r.name);

    const baseList = activeConfigured.length > 0 ? activeConfigured : AVAILABLE_REGIONS;
    baseList.forEach((r) => {
      if (r && r !== "National") set.add(r);
    });
    users.forEach((u) => {
      if (u.region && u.region !== "National") set.add(u.region);
      u.assigned_regions?.forEach((ar) => {
        if (ar && ar !== "National") set.add(ar);
      });
    });
    return Array.from(set).sort();
  }, [configuredRegions, users]);

  // Direct reports count map (managerId -> count)
  const directReportsMap = useMemo(() => {
    const map: Record<string, UserAccount[]> = {};
    for (const u of users) {
      if (u.reports_to_id) {
        if (!map[u.reports_to_id]) map[u.reports_to_id] = [];
        map[u.reports_to_id].push(u);
      }
    }
    return map;
  }, [users]);

  // Helper to resolve manager's display name
  function getManagerName(managerId: string | null) {
    if (!managerId) return "—";
    const mgr = users.find((u) => u.id === managerId);
    return mgr ? mgr.name : "Unknown Manager";
  }

  // Role counts across all users (respecting search and regionFilter for contextual accuracy)
  const roleDistribution = useMemo(() => {
    const counts: Record<string, number> = { all: users.length };
    SYSTEM_ROLES.forEach((r) => {
      counts[r.key] = 0;
    });
    users.forEach((u) => {
      counts[u.role_key] = (counts[u.role_key] || 0) + 1;
    });
    return counts;
  }, [users]);

  // Filtered & Sorted users calculation
  const filteredUsers = useMemo(() => {
    const list = users.filter((u) => {
      // 1. Search text (matches name, email, region, team, phone, or manager name)
      if (search.trim()) {
        const query = search.toLowerCase();
        const mgrName = u.reports_to_id ? getManagerName(u.reports_to_id).toLowerCase() : "";
        const roleDef = SYSTEM_ROLES.find((r) => r.key === u.role_key);
        const matches =
          u.name.toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query) ||
          u.region.toLowerCase().includes(query) ||
          (u.assigned_regions && u.assigned_regions.some((ar) => ar.toLowerCase().includes(query))) ||
          u.team.toLowerCase().includes(query) ||
          (u.phone && u.phone.toLowerCase().includes(query)) ||
          mgrName.includes(query) ||
          (roleDef &&
            (roleDef.name.toLowerCase().includes(query) ||
              roleDef.shortName.toLowerCase().includes(query)));
        if (!matches) return false;
      }

      // 2. Region filter
      if (regionFilter !== "all") {
        const matchesRegion =
          u.region === regionFilter ||
          (u.assigned_regions && u.assigned_regions.includes(regionFilter));
        if (!matchesRegion) return false;
      }

      // 3. Role filter
      if (roleFilter !== "all" && u.role_key !== roleFilter) {
        return false;
      }

      // 4. Manager drill-down filter
      if (managerFilter !== "all" && u.reports_to_id !== managerFilter) {
        return false;
      }

      // 5. Status filter
      if (statusFilter === "active" && !u.is_active) return false;
      if (statusFilter === "inactive" && u.is_active) return false;
      if (statusFilter === "assigned") {
        const isAssigned =
          Boolean(u.reports_to_id) || u.role_key === "administrator" || u.role_key === "hr";
        if (!isAssigned) return false;
      }
      if (statusFilter === "orphaned") {
        const check = validateUserHierarchy(u, users);
        if (!check.isOrphaned) return false;
      }
      if (statusFilter === "supervisors") {
        const count = directReportsMap[u.id]?.length || 0;
        if (count === 0) return false;
      }

      return true;
    });

    // Sort filtered list
    return [...list].sort((a, b) => {
      if (sortBy === "name_asc") return a.name.localeCompare(b.name);
      if (sortBy === "name_desc") return b.name.localeCompare(a.name);
      if (sortBy === "region") {
        const regCmp = (a.region || "").localeCompare(b.region || "");
        return regCmp !== 0 ? regCmp : a.name.localeCompare(b.name);
      }
      if (sortBy === "reports_desc") {
        const countA = directReportsMap[a.id]?.length || 0;
        const countB = directReportsMap[b.id]?.length || 0;
        return countB !== countA ? countB - countA : a.name.localeCompare(b.name);
      }
      if (sortBy === "newest") {
        return (b.created_at || "").localeCompare(a.created_at || "");
      }
      // Default: "hierarchy"
      const levelA = SYSTEM_ROLES.find((r) => r.key === a.role_key)?.hierarchy_level ?? 99;
      const levelB = SYSTEM_ROLES.find((r) => r.key === b.role_key)?.hierarchy_level ?? 99;
      if (levelA !== levelB) return levelA - levelB;
      return a.name.localeCompare(b.name);
    });
  }, [users, search, regionFilter, roleFilter, managerFilter, statusFilter, sortBy, directReportsMap]);

  // Global & Filtered KPI Calculations
  const totalUsersCount = users.length;
  const filteredCount = filteredUsers.length;
  const activeCount = filteredUsers.filter((u) => u.is_active).length;
  const inactiveCount = filteredCount - activeCount;
  const activeRate = filteredCount > 0 ? Math.round((activeCount / filteredCount) * 100) : 0;

  const reportingAssignedCount = filteredUsers.filter(
    (u) => Boolean(u.reports_to_id) || u.role_key === "administrator" || u.role_key === "hr"
  ).length;
  const reportingRate =
    filteredCount > 0 ? Math.round((reportingAssignedCount / filteredCount) * 100) : 0;

  const totalOrphanedInSystem = useMemo(
    () => users.filter((u) => validateUserHierarchy(u, users).isOrphaned).length,
    [users]
  );

  const orphanedUsersList = useMemo(() => {
    return filteredUsers.filter((u) => validateUserHierarchy(u, users).isOrphaned);
  }, [filteredUsers, users]);

  const orphanedCount = orphanedUsersList.length;

  const hasActiveFilters =
    Boolean(search.trim()) ||
    regionFilter !== "all" ||
    roleFilter !== "all" ||
    statusFilter !== "all" ||
    managerFilter !== "all";

  function resetAllFilters() {
    setSearch("");
    setRegionFilter("all");
    setRoleFilter("all");
    setStatusFilter("all");
    setManagerFilter("all");
  }

  // Reset pagination when filters change
  useEffect(() => {
    setPage(1);
  }, [search, regionFilter, roleFilter, statusFilter, managerFilter, sortBy]);

  // Pagination calculations
  const totalItems = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  const getPageNumbers = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 3) {
      return [1, 2, 3, 4, "...", totalPages];
    }
    if (currentPage >= totalPages - 2) {
      return [1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
  };

  // Single User Active Toggle
  async function handleToggleActive(u: UserAccount, e: React.MouseEvent) {
    e.stopPropagation();
    const nextStatus = !u.is_active;
    const res = await setUserActiveStatus(u.id, nextStatus);
    if (res.success) {
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_active: nextStatus } : x)));
      showToast(`Account for ${u.name} is now ${nextStatus ? "Active" : "Deactivated"}.`);
    } else {
      showToast(`Failed to update status: ${res.message}`);
    }
  }

  // Bulk Selection Helpers
  const allOnPageSelected =
    paginatedUsers.length > 0 && paginatedUsers.every((u) => selectedIds.includes(u.id));

  function toggleSelectAllOnPage() {
    if (allOnPageSelected) {
      const pageIds = new Set(paginatedUsers.map((u) => u.id));
      setSelectedIds((prev) => prev.filter((id) => !pageIds.has(id)));
    } else {
      const next = new Set(selectedIds);
      paginatedUsers.forEach((u) => next.add(u.id));
      setSelectedIds(Array.from(next));
    }
  }

  function toggleSelectUser(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleBulkStatusChange(targetActive: boolean) {
    if (selectedIds.length === 0) return;
    setBulkProcessing(true);
    try {
      let updatedCount = 0;
      for (const id of selectedIds) {
        const userObj = users.find((u) => u.id === id);
        if (!userObj || userObj.is_active === targetActive) continue;
        const res = await setUserActiveStatus(id, targetActive);
        if (res.success) updatedCount++;
      }
      const targetSet = new Set(selectedIds);
      setUsers((prev) =>
        prev.map((u) => (targetSet.has(u.id) ? { ...u, is_active: targetActive } : u))
      );
      setSelectedIds([]);
      showToast(
        `${updatedCount || selectedIds.length} user account(s) set to ${
          targetActive ? "Active" : "Deactivated"
        }.`
      );
    } finally {
      setBulkProcessing(false);
    }
  }

  // CSV Export (exports either selected users or all filtered users)
  function handleExportCsv(onlySelected = false) {
    const sourceList =
      onlySelected && selectedIds.length > 0
        ? users.filter((u) => selectedIds.includes(u.id))
        : filteredUsers;

    if (sourceList.length === 0) {
      showToast("No users to export.");
      return;
    }

    const headers = [
      "Name",
      "Email",
      "Phone",
      "Role",
      "Primary Region",
      "Assigned Territories",
      "Reports To",
      "Direct Reports Count",
      "Team",
      "Status",
      "Hierarchy Status",
      "Created Date",
    ];

    const escapeCsv = (val: string) => `"${String(val ?? "").replace(/"/g, '""')}"`;

    const rows = sourceList.map((u) => {
      const roleDef = SYSTEM_ROLES.find((r) => r.key === u.role_key);
      const hierarchy = validateUserHierarchy(u, users);
      const directCount = directReportsMap[u.id]?.length || 0;
      const territories =
        u.assigned_regions && u.assigned_regions.length > 0
          ? u.assigned_regions.join("; ")
          : u.region || "National";
      return [
        u.name,
        u.email,
        u.phone || "",
        roleDef?.name || u.role_key,
        u.region || "National",
        territories,
        u.role_key === "administrator" ? "—" : getManagerName(u.reports_to_id),
        String(directCount),
        u.team || "",
        u.is_active ? "Active" : "Deactivated",
        hierarchy.isOrphaned ? `Issue: ${hierarchy.issues.join("; ")}` : "Healthy",
        u.created_at ? u.created_at.slice(0, 10) : "",
      ].map(escapeCsv);
    });

    const csvContent = [headers.map(escapeCsv).join(","), ...rows.map((r) => r.join(","))].join(
      "\n"
    );
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `staff-directory-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Exported ${sourceList.length} user record(s) to CSV.`);
  }

  function handleCopyEmail(email: string, id: string, e: React.MouseEvent) {
    e.stopPropagation();
    void navigator.clipboard.writeText(email);
    setCopiedEmailId(id);
    setTimeout(() => {
      setCopiedEmailId((prev) => (prev === id ? null : prev));
    }, 2000);
  }

  // Save changes from Edit User modal
  async function handleSaveEditedUser(updated: UserAccount) {
    const result = await updateUserAccount(updated);
    if (!result.success) {
      throw new Error(result.message);
    }
    const nextUsers = users.map((u) =>
      u.id === result.user.id || u.id === updated.id ? result.user : u
    );
    setUsers(nextUsers);
    setEditingUser(null);
    showToast(result.message, 5000);
  }

  // Create new user
  async function handleCreateUser(newUser: UserAccount, tempPassword?: string) {
    const result = await createUserAccount(newUser, tempPassword);
    if (!result.success) {
      throw new Error(result.message);
    }
    try {
      setUsers(await loadUserAccounts());
    } catch {
      setUsers([result.user, ...users.filter((u) => u.id !== result.user.id)]);
    }
    setCreateModalOpen(false);
    showToast(result.message, 5000);
  }

  return (
    <div className="user-management-container">
      {/* ── Top Header ── */}
      <div className="um-header-row">
        <div className="um-title-group">
          <div className="um-title-with-icon">
            <div className="um-icon-badge">
              <Users size={22} className="um-main-icon" />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <h2 className="um-title">User Management</h2>
                <span className="um-users-count-badge">{totalUsersCount} Total Staff</span>
              </div>
              <p className="um-subtitle">
                Manage user accounts, role permissions, reporting hierarchy, and regional territory coverage
              </p>
            </div>
          </div>
        </div>

        <div className="um-header-actions">
          <button
            type="button"
            className="um-hierarchy-btn"
            onClick={() => void fetchDirectory(true)}
            disabled={refreshing}
            title="Sync user directory with Supabase"
          >
            <RefreshCw size={15} className={refreshing ? "um-spin" : ""} />
            <span>{refreshing ? "Syncing..." : "Sync"}</span>
          </button>

          <button
            type="button"
            className="um-hierarchy-btn"
            onClick={() => handleExportCsv(false)}
            title="Export filtered directory to CSV"
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            className="um-hierarchy-btn"
            onClick={() => setHierarchyModalOpen(true)}
            title="View Interactive Reporting Tree"
          >
            <GitBranch size={15} />
            <span>Org Chart</span>
            {totalOrphanedInSystem > 0 && (
              <span className="um-btn-alert-dot" title={`${totalOrphanedInSystem} hierarchy issues`}>
                {totalOrphanedInSystem}
              </span>
            )}
          </button>

          <button
            type="button"
            className="primary-button um-add-user-btn"
            onClick={() => setCreateModalOpen(true)}
          >
            <span aria-hidden="true">+</span>
            <span>Add User</span>
          </button>
        </div>
      </div>

      {notification && (
        <div className="new-sale-success" style={{ margin: "2px 0" }} role="status">
          <CheckCircle2 size={18} />
          <span>{notification}</span>
          <button
            type="button"
            onClick={() => setNotification("")}
            aria-label="Dismiss message"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Interactive 4 KPI Summary Cards (Click to Filter) ── */}
      <div className="um-kpi-grid">
        <button
          type="button"
          className={`um-kpi-card interactive ${statusFilter === "all" && !hasActiveFilters ? "active-kpi" : ""}`}
          onClick={() => setStatusFilter("all")}
          title="Click to show all users"
        >
          <div className="um-kpi-top-row">
            <span className="um-kpi-label">Directory Scope</span>
            <span className="um-kpi-pill neutral">
              {totalUsersCount > 0 ? Math.round((filteredCount / totalUsersCount) * 100) : 100}% visible
            </span>
          </div>
          <strong className="um-kpi-value">
            {filteredCount}
            {filteredCount !== totalUsersCount && (
              <small className="um-kpi-subvalue"> / {totalUsersCount}</small>
            )}
          </strong>
          <span className="um-kpi-caption">
            {hasActiveFilters
              ? "Filtered accounts matching active criteria."
              : "All registered staff accounts in directory."}
          </span>
        </button>

        <button
          type="button"
          className={`um-kpi-card interactive ${statusFilter === "active" ? "active-kpi" : ""}`}
          onClick={() => setStatusFilter(statusFilter === "active" ? "all" : "active")}
          title="Click to filter to Active accounts"
        >
          <div className="um-kpi-top-row">
            <span className="um-kpi-label">Active Accounts</span>
            <span className="um-kpi-pill success">{activeRate}% active</span>
          </div>
          <strong className="um-kpi-value" style={{ color: "#075544" }}>
            {activeCount}
          </strong>
          <span className="um-kpi-caption">
            {inactiveCount > 0
              ? `${inactiveCount} deactivated account${inactiveCount === 1 ? "" : "s"} in current view.`
              : "All accounts in this view are active."}
          </span>
        </button>

        <button
          type="button"
          className={`um-kpi-card interactive ${statusFilter === "assigned" ? "active-kpi" : ""}`}
          onClick={() => setStatusFilter(statusFilter === "assigned" ? "all" : "assigned")}
          title="Click to filter to users with a valid reporting line"
        >
          <div className="um-kpi-top-row">
            <span className="um-kpi-label">Reporting Assigned</span>
            <span className="um-kpi-pill info">{reportingRate}% linked</span>
          </div>
          <strong className="um-kpi-value">{reportingAssignedCount}</strong>
          <span className="um-kpi-caption">
            Staff connected to a valid supervisor or national tier.
          </span>
        </button>

        <button
          type="button"
          className={`um-kpi-card interactive ${orphanedCount > 0 ? "has-orphaned" : ""} ${
            statusFilter === "orphaned" ? "active-kpi-danger" : ""
          }`}
          onClick={() => setStatusFilter(statusFilter === "orphaned" ? "all" : "orphaned")}
          title="Click to filter to Orphaned users requiring hierarchy assignment"
        >
          <div className="um-kpi-top-row">
            <span className="um-kpi-label">Orphaned / Issues</span>
            <span className={`um-kpi-pill ${orphanedCount > 0 ? "danger" : "success"}`}>
              {orphanedCount > 0 ? "Needs Fix" : "100% Healthy"}
            </span>
          </div>
          <strong
            className="um-kpi-value"
            style={{ color: orphanedCount > 0 ? "#dc2626" : "#0f172a" }}
          >
            {orphanedCount}
          </strong>
          <span className="um-kpi-caption">
            {orphanedCount > 0
              ? "Click to isolate users missing a valid supervisor."
              : "Every user satisfies reporting hierarchy rules."}
          </span>
        </button>
      </div>

      {/* ── Role Distribution Quick-Filter Strip ── */}
      <div className="um-role-strip" role="tablist" aria-label="Quick filter by role">
        <button
          type="button"
          role="tab"
          aria-selected={roleFilter === "all"}
          className={`um-role-chip-btn ${roleFilter === "all" ? "active" : ""}`}
          onClick={() => setRoleFilter("all")}
        >
          <span>All Roles</span>
          <span className="um-role-chip-count">{roleDistribution.all}</span>
        </button>

        {SYSTEM_ROLES.map((role) => {
          const count = roleDistribution[role.key] || 0;
          const isActive = roleFilter === role.key;
          return (
            <button
              key={role.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`um-role-chip-btn ${isActive ? "active" : ""}`}
              onClick={() => setRoleFilter(isActive ? "all" : role.key)}
              title={`${role.name} — ${role.description}`}
            >
              <span
                className="um-role-chip-dot"
                style={{ background: isActive ? "#ffffff" : role.color }}
              />
              <span>{role.shortName}</span>
              <span className="um-role-chip-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* ── Actionable Hierarchy Issues Alert Banner ── */}
      {orphanedCount > 0 && (
        <div className="um-hierarchy-alert-card">
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
            <AlertTriangle size={20} style={{ color: "#dc2626", flexShrink: 0, marginTop: 2 }} />
            <div className="um-hierarchy-alert-text">
              <strong>Hierarchy issues require attention ({orphanedCount} affected)</strong>
              <p>
                {orphanedCount === 1
                  ? "1 user currently lacks a valid reporting manager or violates regional hierarchy rules."
                  : `${orphanedCount} users currently lack a valid reporting manager or violate regional hierarchy rules.`}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="um-alert-action-btn"
              onClick={() =>
                setStatusFilter(statusFilter === "orphaned" ? "all" : "orphaned")
              }
            >
              <Filter size={13} />
              <span>
                {statusFilter === "orphaned"
                  ? "Show All Users"
                  : `Isolate Orphaned (${orphanedCount})`}
              </span>
            </button>
            <button
              type="button"
              className="um-alert-action-btn primary"
              onClick={() => setHierarchyModalOpen(true)}
            >
              <GitBranch size={13} />
              <span>Fix in Org Chart</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Filters, Sort & View Toolbar ── */}
      <div className="um-filter-toolbar">
        <div className="um-search-wrap">
          <Search size={16} className="um-search-icon" />
          <input
            type="text"
            className="um-search-input"
            placeholder="Search by name, email, phone, region, team, or manager..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="um-search-clear"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="um-select-wrap">
          <select
            className="um-filter-select"
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            aria-label="Filter by region"
          >
            <option value="all">All Regions ({regionOptions.length})</option>
            {regionOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <ChevronDown size={15} className="um-chevron" />
        </div>

        <div className="um-select-wrap">
          <select
            className="um-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Deactivated Only</option>
            <option value="assigned">Reporting Assigned</option>
            <option value="orphaned">Orphaned / Issues Only</option>
            <option value="supervisors">Managers (With Direct Reports)</option>
          </select>
          <ChevronDown size={15} className="um-chevron" />
        </div>

        <div className="um-select-wrap">
          <ArrowUpDown
            size={14}
            style={{ position: "absolute", left: 10, color: "#64748b", pointerEvents: "none" }}
          />
          <select
            className="um-filter-select"
            style={{ paddingLeft: 30 }}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            aria-label="Sort users by"
          >
            <option value="hierarchy">Sort: Hierarchy Tier</option>
            <option value="name_asc">Sort: Name (A → Z)</option>
            <option value="name_desc">Sort: Name (Z → A)</option>
            <option value="region">Sort: Region (A → Z)</option>
            <option value="reports_desc">Sort: Direct Reports</option>
            <option value="newest">Sort: Recently Added</option>
          </select>
          <ChevronDown size={15} className="um-chevron" />
        </div>

        {/* View Toggle (Table vs Grid) */}
        <div className="um-view-toggle-group" role="group" aria-label="Directory layout view">
          <button
            type="button"
            className={`um-view-toggle-btn ${viewMode === "table" ? "active" : ""}`}
            onClick={() => setViewMode("table")}
            title="Table View"
            aria-label="Table View"
          >
            <List size={16} />
          </button>
          <button
            type="button"
            className={`um-view-toggle-btn ${viewMode === "grid" ? "active" : ""}`}
            onClick={() => setViewMode("grid")}
            title="Card Grid View"
            aria-label="Card Grid View"
          >
            <LayoutGrid size={16} />
          </button>
        </div>
      </div>

      {/* ── Active Filter Pills Bar ── */}
      {hasActiveFilters && (
        <div className="um-active-filters-bar">
          <span className="um-active-filters-label">Active filters:</span>

          {search.trim() && (
            <span className="um-filter-tag">
              Search: &ldquo;{search.trim()}&rdquo;
              <button type="button" onClick={() => setSearch("")} aria-label="Remove search filter">
                <X size={12} />
              </button>
            </span>
          )}

          {regionFilter !== "all" && (
            <span className="um-filter-tag">
              Region: {regionFilter}
              <button
                type="button"
                onClick={() => setRegionFilter("all")}
                aria-label="Remove region filter"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {roleFilter !== "all" && (
            <span className="um-filter-tag">
              Role: {SYSTEM_ROLES.find((r) => r.key === roleFilter)?.name || roleFilter}
              <button
                type="button"
                onClick={() => setRoleFilter("all")}
                aria-label="Remove role filter"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {statusFilter !== "all" && (
            <span className="um-filter-tag">
              Status: {statusFilter}
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                aria-label="Remove status filter"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {managerFilter !== "all" && (
            <span className="um-filter-tag">
              Reports to: {getManagerName(managerFilter)}
              <button
                type="button"
                onClick={() => setManagerFilter("all")}
                aria-label="Remove supervisor filter"
              >
                <X size={12} />
              </button>
            </span>
          )}

          <button type="button" className="um-clear-all-btn" onClick={resetAllFilters}>
            Clear all filters
          </button>
        </div>
      )}

      {/* ── Bulk Selection Action Bar ── */}
      {selectedIds.length > 0 && (
        <div className="um-bulk-action-bar" role="region" aria-label="Bulk actions">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span className="um-bulk-count-badge">{selectedIds.length} selected</span>
            <span style={{ fontSize: "13px", color: "#334155" }}>
              Apply batch actions to selected staff accounts:
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="secondary-button"
              disabled={bulkProcessing}
              onClick={() => void handleBulkStatusChange(true)}
              style={{
                height: 32,
                padding: "0 12px",
                fontSize: "12.5px",
                gap: 6,
                color: "#15803d",
                borderColor: "#bbf7d0",
                background: "#f0fdf4",
              }}
            >
              <UserCheck size={14} />
              <span>Activate Selected</span>
            </button>

            <button
              type="button"
              className="secondary-button"
              disabled={bulkProcessing}
              onClick={() => void handleBulkStatusChange(false)}
              style={{
                height: 32,
                padding: "0 12px",
                fontSize: "12.5px",
                gap: 6,
                color: "#b91c1c",
                borderColor: "#fecaca",
                background: "#fef2f2",
              }}
            >
              <UserX size={14} />
              <span>Deactivate Selected</span>
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() => handleExportCsv(true)}
              style={{ height: 32, padding: "0 12px", fontSize: "12.5px", gap: 6 }}
            >
              <Download size={14} />
              <span>Export Selected</span>
            </button>

            <button
              type="button"
              className="um-clear-all-btn"
              onClick={() => setSelectedIds([])}
              style={{ marginLeft: 4 }}
            >
              Clear selection
            </button>
          </div>
        </div>
      )}

      {/* ── User Directory Content (Table or Card Grid) ── */}
      <div className="um-table-container">
        {visibleLoading ? (
          <LogoLoader
            variant="section"
            message="Loading user directory"
            hint="Fetching roles and user permissions"
          />
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state" style={{ padding: "48px 24px" }}>
            <h3>No matching staff accounts</h3>
            <p>No user accounts matched your current search or filter criteria.</p>
            <button
              type="button"
              className="secondary-button"
              style={{ marginTop: 12 }}
              onClick={resetAllFilters}
            >
              Reset all filters
            </button>
          </div>
        ) : viewMode === "table" ? (
          <>
            <div className="table-wrapper">
              <table className="um-table">
                <thead>
                  <tr>
                    <th style={{ width: "42px", paddingRight: 0 }}>
                      <input
                        type="checkbox"
                        checked={allOnPageSelected}
                        onChange={toggleSelectAllOnPage}
                        aria-label="Select all users on this page"
                        style={{ width: 15, height: 15, accentColor: "#075544", cursor: "pointer" }}
                      />
                    </th>
                    <th style={{ width: "31%" }}>Identity & Contact</th>
                    <th style={{ width: "36%" }}>Org Structure & Territory</th>
                    <th style={{ width: "29%" }}>Capabilities & Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map((u) => {
                    const roleDef = SYSTEM_ROLES.find((r) => r.key === u.role_key);
                    const hierarchy = validateUserHierarchy(u, users);
                    const directReports = directReportsMap[u.id] || [];
                    const isSelected = selectedIds.includes(u.id);
                    const isNational =
                      u.role_key === "administrator" ||
                      u.role_key === "national_sales_manager" ||
                      u.role_key === "hr";
                    const extraRegionsCount =
                      !isNational && u.assigned_regions && u.assigned_regions.length > 1
                        ? u.assigned_regions.length - 1
                        : 0;

                    const initials = u.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase();

                    return (
                      <tr
                        key={u.id}
                        className={`um-table-row ${isSelected ? "selected-row" : ""}`}
                        onClick={() => setEditingUser(u)}
                        title="Click to edit user profile, role, and reporting line"
                      >
                        {/* Bulk Select Checkbox */}
                        <td
                          style={{ padding: "18px 0 18px 18px", verticalAlign: "top" }}
                          onClick={(e) => toggleSelectUser(u.id, e)}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            aria-label={`Select ${u.name}`}
                            style={{ width: 15, height: 15, accentColor: "#075544", cursor: "pointer", marginTop: 4 }}
                          />
                        </td>

                        {/* Column 1: Identity */}
                        <td className="um-identity-cell">
                          <div className="um-identity-wrap">
                            <div style={{ position: "relative", flexShrink: 0 }}>
                              <div
                                className="um-avatar-circle"
                                style={{ background: roleDef?.color || "#075544" }}
                              >
                                {u.avatar_url ? (
                                  <img src={u.avatar_url} alt={u.name} className="user-avatar-img" />
                                ) : (
                                  initials
                                )}
                              </div>
                              <span
                                className={`um-avatar-status-dot ${u.is_active ? "online" : "offline"}`}
                                title={u.is_active ? "Active account" : "Deactivated account"}
                              />
                            </div>

                            <div className="um-identity-info">
                              <div className="um-name-badge-row">
                                <strong className="um-user-name">{u.name}</strong>
                                {hierarchy.isOrphaned && (
                                  <span className="um-orphaned-flag-badge">Orphaned</span>
                                )}
                              </div>

                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span className="um-user-email">{u.email}</span>
                                <button
                                  type="button"
                                  className="um-inline-copy-btn"
                                  onClick={(e) => handleCopyEmail(u.email, u.id, e)}
                                  title="Copy email address"
                                  aria-label={`Copy email for ${u.name}`}
                                >
                                  {copiedEmailId === u.id ? (
                                    <Check size={12} style={{ color: "#16a34a" }} />
                                  ) : (
                                    <Copy size={12} />
                                  )}
                                </button>
                              </div>

                              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginTop: 2 }}>
                                {u.phone && <span className="um-user-phone">{u.phone}</span>}
                                {u.created_at && (
                                  <span className="um-user-joined">
                                    Joined {u.created_at.slice(0, 10)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Column 2: Org Structure & Territory */}
                        <td className="um-org-cell">
                          <div className="um-org-badges-row">
                            <span
                              className="um-role-badge-pill"
                              style={{
                                background: roleDef?.badgeBg,
                                color: roleDef?.badgeText,
                              }}
                            >
                              {roleDef?.name}
                            </span>

                            <span className="um-region-badge-pill">
                              <MapPin size={11} style={{ marginRight: 3 }} />
                              {isNational ? "National" : u.region || "Unassigned"}
                            </span>

                            {extraRegionsCount > 0 && (
                              <span
                                className="um-multi-region-pill"
                                title={`Assigned territories: ${u.assigned_regions?.join(", ")}`}
                              >
                                +{extraRegionsCount} region{extraRegionsCount === 1 ? "" : "s"}
                              </span>
                            )}
                          </div>

                          <div className="um-org-details-list">
                            <div className="um-org-line">
                              <span className="um-org-label">Reports to:</span>
                              {u.role_key === "administrator" ? (
                                <span className="um-org-value">Top-Level Governance</span>
                              ) : u.reports_to_id ? (
                                <button
                                  type="button"
                                  className="um-manager-link-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const mgr = users.find((x) => x.id === u.reports_to_id);
                                    if (mgr) setEditingUser(mgr);
                                  }}
                                  title="Click to inspect supervisor profile"
                                >
                                  {getManagerName(u.reports_to_id)}
                                </button>
                              ) : (
                                <span className="um-org-value" style={{ color: "#dc2626", fontWeight: 600 }}>
                                  Unassigned
                                </span>
                              )}
                            </div>

                            {u.team && (
                              <div className="um-org-line">
                                <span className="um-org-label">Team / Fleet:</span>
                                <span className="um-org-value">{u.team}</span>
                              </div>
                            )}

                            {directReports.length > 0 && (
                              <div className="um-org-line" style={{ marginTop: 2 }}>
                                <button
                                  type="button"
                                  className="um-direct-reports-pill"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setManagerFilter(managerFilter === u.id ? "all" : u.id);
                                  }}
                                  title={`Click to filter directory to ${u.name}'s ${directReports.length} direct report(s)`}
                                >
                                  <Users size={12} />
                                  <span>
                                    Supervises {directReports.length} direct report
                                    {directReports.length === 1 ? "" : "s"}
                                  </span>
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Actionable Hierarchy Issue Box */}
                          {hierarchy.isOrphaned && (
                            <div className="um-row-hierarchy-issue-box">
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                                <strong>Hierarchy issue</strong>
                                <span style={{ fontSize: "11px", fontWeight: 700, color: "#dc2626" }}>
                                  Fix Now &rarr;
                                </span>
                              </div>
                              <p>{hierarchy.issues[0]}</p>
                            </div>
                          )}
                        </td>

                        {/* Column 3: Capabilities, Status & Quick Actions */}
                        <td className="um-status-cell">
                          <div className="um-status-col">
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                width: "100%",
                                gap: "8px",
                                flexWrap: "wrap",
                              }}
                            >
                              <span
                                className={`um-status-pill ${u.is_active ? "active" : "inactive"}`}
                              >
                                <span className="um-status-dot" />
                                {u.is_active ? "Active" : "Deactivated"}
                              </span>

                              {/* Quick Admin Action Buttons */}
                              <div
                                style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  className="secondary-button"
                                  onClick={() => setEditingUser(u)}
                                  title="Edit User Profile & Access"
                                  style={{
                                    padding: "4px 8px",
                                    fontSize: "0.74rem",
                                    gap: "4px",
                                    height: "28px",
                                  }}
                                >
                                  <Edit3 size={12} style={{ color: "#075544" }} />
                                  <span>Edit</span>
                                </button>

                                <button
                                  type="button"
                                  className="secondary-button"
                                  onClick={() => setResettingPasswordUser(u)}
                                  title="Reset User Password"
                                  style={{
                                    padding: "4px 8px",
                                    fontSize: "0.74rem",
                                    gap: "4px",
                                    height: "28px",
                                  }}
                                >
                                  <Key size={12} style={{ color: "#075544" }} />
                                  <span>Password</span>
                                </button>

                                <button
                                  type="button"
                                  className="secondary-button"
                                  onClick={(e) => handleToggleActive(u, e)}
                                  title={u.is_active ? "Deactivate Account" : "Activate Account"}
                                  style={{
                                    padding: "4px 8px",
                                    fontSize: "0.74rem",
                                    gap: "4px",
                                    height: "28px",
                                    color: u.is_active ? "#b91c1c" : "#15803d",
                                    borderColor: u.is_active ? "#fecaca" : "#bbf7d0",
                                    background: u.is_active ? "#fef2f2" : "#f0fdf4",
                                  }}
                                >
                                  {u.is_active ? <UserX size={12} /> : <UserCheck size={12} />}
                                  <span>{u.is_active ? "Deactivate" : "Activate"}</span>
                                </button>
                              </div>
                            </div>

                            {/* Meaningful Role Capability Badges */}
                            {roleDef && (
                              <div className="um-capability-tags-row">
                                {roleDef.can_view_all_sales && (
                                  <span className="um-cap-badge highlight">
                                    <Shield size={10} /> All Sales Visibility
                                  </span>
                                )}
                                {roleDef.can_manage_staff && (
                                  <span className="um-cap-badge">Manage Staff</span>
                                )}
                                {roleDef.can_assign_targets && (
                                  <span className="um-cap-badge">Assign Targets</span>
                                )}
                                {roleDef.permissions.slice(0, 3).map((perm) => (
                                  <span key={perm} className="um-cap-badge muted">
                                    {perm.replace(/_/g, " ")}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          /* ── Card Grid View ── */
          <div className="um-cards-grid">
            {paginatedUsers.map((u) => {
              const roleDef = SYSTEM_ROLES.find((r) => r.key === u.role_key);
              const hierarchy = validateUserHierarchy(u, users);
              const directReports = directReportsMap[u.id] || [];
              const isNational =
                u.role_key === "administrator" ||
                u.role_key === "national_sales_manager" ||
                u.role_key === "hr";
              const initials = u.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();

              return (
                <article
                  key={u.id}
                  className={`um-user-grid-card ${hierarchy.isOrphaned ? "orphaned-card" : ""}`}
                  onClick={() => setEditingUser(u)}
                >
                  <div className="um-grid-card-top">
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ position: "relative" }}>
                        <div
                          className="um-avatar-circle"
                          style={{ background: roleDef?.color || "#075544" }}
                        >
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt={u.name} className="user-avatar-img" />
                          ) : (
                            initials
                          )}
                        </div>
                        <span
                          className={`um-avatar-status-dot ${u.is_active ? "online" : "offline"}`}
                        />
                      </div>
                      <div>
                        <strong className="um-user-name" style={{ display: "block" }}>
                          {u.name}
                        </strong>
                        <span className="um-user-email">{u.email}</span>
                      </div>
                    </div>

                    <span className={`um-status-pill ${u.is_active ? "active" : "inactive"}`}>
                      <span className="um-status-dot" />
                      {u.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div className="um-org-badges-row" style={{ margin: "10px 0 6px" }}>
                    <span
                      className="um-role-badge-pill"
                      style={{ background: roleDef?.badgeBg, color: roleDef?.badgeText }}
                    >
                      {roleDef?.name}
                    </span>
                    <span className="um-region-badge-pill">
                      <MapPin size={11} style={{ marginRight: 3 }} />
                      {isNational ? "National" : u.region}
                    </span>
                  </div>

                  <div className="um-org-details-list" style={{ flex: 1 }}>
                    <div className="um-org-line">
                      <span className="um-org-label">Reports to:</span>
                      <span className="um-org-value">
                        {u.role_key === "administrator"
                          ? "Top-Level Governance"
                          : getManagerName(u.reports_to_id)}
                      </span>
                    </div>
                    {u.team && (
                      <div className="um-org-line">
                        <span className="um-org-label">Team:</span>
                        <span className="um-org-value">{u.team}</span>
                      </div>
                    )}
                    {directReports.length > 0 && (
                      <div className="um-org-line">
                        <span className="um-org-label">Direct reports:</span>
                        <span className="um-org-value" style={{ color: "#075544", fontWeight: 700 }}>
                          {directReports.length} staff member{directReports.length === 1 ? "" : "s"}
                        </span>
                      </div>
                    )}
                  </div>

                  {hierarchy.isOrphaned && (
                    <div className="um-row-hierarchy-issue-box" style={{ marginTop: 8 }}>
                      <strong>Hierarchy issue</strong>
                      <p>{hierarchy.issues[0]}</p>
                    </div>
                  )}

                  <div
                    className="um-grid-card-footer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setEditingUser(u)}
                      style={{ flex: 1, height: 30, fontSize: "12px", gap: 5 }}
                    >
                      <Edit3 size={12} />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setResettingPasswordUser(u)}
                      style={{ height: 30, fontSize: "12px", padding: "0 10px" }}
                      title="Reset Password"
                    >
                      <Key size={13} />
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={(e) => handleToggleActive(u, e)}
                      style={{
                        height: 30,
                        fontSize: "12px",
                        padding: "0 10px",
                        color: u.is_active ? "#b91c1c" : "#15803d",
                        borderColor: u.is_active ? "#fecaca" : "#bbf7d0",
                        background: u.is_active ? "#fef2f2" : "#f0fdf4",
                      }}
                      title={u.is_active ? "Deactivate" : "Activate"}
                    >
                      {u.is_active ? <UserX size={13} /> : <UserCheck size={13} />}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* ── Pagination Bar ── */}
        {!visibleLoading && filteredUsers.length > 0 && (
          <div
            className="um-pagination-bar"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 18px",
              borderTop: "1px solid #e5e7eb",
              background: "#ffffff",
              fontSize: "0.85rem",
              color: "#4b5563",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
              <span>
                Showing <strong>{startItem}</strong>–<strong>{endItem}</strong> of{" "}
                <strong>{totalItems}</strong> users
              </span>

              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <label
                  htmlFor="um-page-size-select"
                  style={{ fontSize: "0.8rem", color: "#6b7280" }}
                >
                  Per page:
                </label>
                <select
                  id="um-page-size-select"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "6px",
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    fontSize: "0.8rem",
                    outline: "none",
                    color: "#374151",
                    cursor: "pointer",
                  }}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "32px",
                    height: "32px",
                    borderRadius: "6px",
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    color: currentPage === 1 ? "#9ca3af" : "#374151",
                    cursor: currentPage === 1 ? "not-allowed" : "pointer",
                    transition: "all 0.15s ease",
                  }}
                  title="Previous Page"
                  aria-label="Previous Page"
                >
                  <ChevronLeft size={16} />
                </button>

                {getPageNumbers().map((item, idx) => {
                  if (item === "...") {
                    return (
                      <span
                        key={`ellipsis-${idx}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "28px",
                          height: "32px",
                          color: "#9ca3af",
                          fontSize: "0.85rem",
                        }}
                      >
                        &hellip;
                      </span>
                    );
                  }
                  const pageNum = Number(item);
                  const isActive = pageNum === currentPage;
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setPage(pageNum)}
                      style={{
                        minWidth: "32px",
                        height: "32px",
                        padding: "0 6px",
                        borderRadius: "6px",
                        border: isActive ? "1px solid #075544" : "1px solid #d1d5db",
                        background: isActive ? "#075544" : "#ffffff",
                        color: isActive ? "#ffffff" : "#374151",
                        fontWeight: isActive ? 600 : 400,
                        cursor: "pointer",
                        fontSize: "0.8rem",
                        transition: "all 0.15s ease",
                      }}
                      aria-current={isActive ? "page" : undefined}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "32px",
                    height: "32px",
                    borderRadius: "6px",
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    color: currentPage === totalPages ? "#9ca3af" : "#374151",
                    cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                    transition: "all 0.15s ease",
                  }}
                  title="Next Page"
                  aria-label="Next Page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {editingUser && (
        <EditUserDialog
          user={editingUser}
          allUsers={users}
          onSave={handleSaveEditedUser}
          onClose={() => setEditingUser(null)}
        />
      )}

      {resettingPasswordUser && (
        <ResetPasswordDialog
          user={resettingPasswordUser}
          onClose={() => setResettingPasswordUser(null)}
        />
      )}

      {createModalOpen && (
        <CreateUserDialog
          allUsers={users}
          onCreate={handleCreateUser}
          onClose={() => setCreateModalOpen(false)}
        />
      )}

      {hierarchyModalOpen && (
        <HierarchyTreeModal
          users={users}
          onSelectUserToEdit={(target) => {
            setHierarchyModalOpen(false);
            setEditingUser(target);
          }}
          onClose={() => setHierarchyModalOpen(false)}
        />
      )}
    </div>
  );
}
