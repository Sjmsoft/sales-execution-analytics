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
import { EditUserDialog } from "./EditUserDialog";
import { CreateUserDialog } from "./CreateUserDialog";
import { HierarchyTreeModal } from "./HierarchyTreeModal";
import { ResetPasswordDialog } from "./ResetPasswordDialog";
import LogoLoader from "../../components/brand/LogoLoader";
import { useMinimumLoading } from "../../hooks/useMinimumLoading";

export function UserManagementSection() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const visibleLoading = useMinimumLoading(loading, 600);
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [resettingPasswordUser, setResettingPasswordUser] = useState<UserAccount | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [hierarchyModalOpen, setHierarchyModalOpen] = useState(false);
  const [notification, setNotification] = useState<string>("");

  async function handleToggleActive(u: UserAccount, e: React.MouseEvent) {
    e.stopPropagation();
    const nextStatus = !u.is_active;
    const res = await setUserActiveStatus(u.id, nextStatus);
    if (res.success) {
      setUsers(users.map((x) => (x.id === u.id ? { ...x, is_active: nextStatus } : x)));
      setNotification(`Account for ${u.name} is now ${nextStatus ? "Active" : "Deactivated"}.`);
      setTimeout(() => setNotification(""), 4000);
    } else {
      setNotification(`Failed to update status: ${res.message}`);
    }
  }

  useEffect(() => {
    let isMounted = true;
    void loadUserAccounts()
      .then((data) => {
        if (isMounted) {
          setUsers(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load user accounts:", err);
        if (isMounted) {
          setLoading(false);
        }
      });
    void syncRolesToSupabase();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filtered users calculation
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // 1. Search text
      if (search.trim()) {
        const query = search.toLowerCase();
        const matches =
          u.name.toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query) ||
          u.region.toLowerCase().includes(query) ||
          u.team.toLowerCase().includes(query) ||
          (u.phone && u.phone.includes(query));
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

      // 4. Status filter
      if (statusFilter === "active" && !u.is_active) return false;
      if (statusFilter === "inactive" && u.is_active) return false;
      if (statusFilter === "orphaned") {
        const check = validateUserHierarchy(u, users);
        if (!check.isOrphaned) return false;
      }

      return true;
    });
  }, [users, search, regionFilter, roleFilter, statusFilter]);

  // KPI Calculations based on filtered result set
  const filteredCount = filteredUsers.length;
  const activeCount = filteredUsers.filter((u) => u.is_active).length;
  const inactiveCount = filteredCount - activeCount;

  const reportingAssignedCount = filteredUsers.filter(
    (u) => Boolean(u.reports_to_id) || u.role_key === "administrator" || u.role_key === "hr"
  ).length;

  const orphanedUsersList = useMemo(() => {
    return filteredUsers.filter((u) => validateUserHierarchy(u, users).isOrphaned);
  }, [filteredUsers, users]);

  const orphanedCount = orphanedUsersList.length;

  // Reset pagination when filters change
  useEffect(() => {
    setPage(1);
  }, [search, regionFilter, roleFilter, statusFilter]);

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
    setNotification(result.message);
    setTimeout(() => setNotification(""), 5000);
  }

  // Create new user
  async function handleCreateUser(newUser: UserAccount, tempPassword?: string) {
    const result = await createUserAccount(newUser, tempPassword);
    if (!result.success) {
      // Keep the dialog open and surface the real Supabase error.
      throw new Error(result.message);
    }
    // Re-read from Supabase so the list reflects what is actually stored.
    try {
      setUsers(await loadUserAccounts());
    } catch {
      setUsers([result.user, ...users.filter((u) => u.id !== result.user.id)]);
    }
    setCreateModalOpen(false);
    setNotification(result.message);
    setTimeout(() => setNotification(""), 5000);
  }

  // Helper to resolve manager's display name
  function getManagerName(managerId: string | null) {
    if (!managerId) return "—";
    const mgr = users.find((u) => u.id === managerId);
    return mgr ? mgr.name : "Unknown Manager";
  }

  return (
    <div className="user-management-container">
      {/* ── Top Header (Image 1) ── */}
      <div className="um-header-row">
        <div className="um-title-group">
          <div className="um-title-with-icon">
            <Users size={24} className="um-main-icon" />
            <div>
              <h2 className="um-title">User Management</h2>
              <p className="um-subtitle">
                Manage user accounts, roles, reporting hierarchy, and region membership
              </p>
            </div>
          </div>
        </div>

        <div className="um-header-actions">
          <button
            type="button"
            className="um-hierarchy-btn"
            onClick={() => setHierarchyModalOpen(true)}
            title="View Visual Reporting Tree"
          >
            <GitBranch size={16} />
            <span>Hierarchy</span>
          </button>

          <span className="um-users-count-badge">
            {users.length} Users
          </span>

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
        <div className="new-sale-success" style={{ margin: "14px 0" }} role="status">
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

      {/* ── 4 KPI Summary Cards (Image 1) ── */}
      <div className="um-kpi-grid">
        <div className="um-kpi-card">
          <span className="um-kpi-label">Filtered users</span>
          <strong className="um-kpi-value">{filteredCount}</strong>
          <span className="um-kpi-caption">Based on current search and filters.</span>
        </div>

        <div className="um-kpi-card">
          <span className="um-kpi-label">Active accounts</span>
          <strong className="um-kpi-value">{activeCount}</strong>
          <span className="um-kpi-caption">
            {inactiveCount > 0
              ? `${inactiveCount} inactive accounts in the current result set.`
              : "All accounts in this view are currently active."}
          </span>
        </div>

        <div className="um-kpi-card">
          <span className="um-kpi-label">Reporting assigned</span>
          <strong className="um-kpi-value">{reportingAssignedCount}</strong>
          <span className="um-kpi-caption">Users with a defined manager relationship.</span>
        </div>

        <div className={`um-kpi-card ${orphanedCount > 0 ? "has-orphaned" : ""}`}>
          <span className="um-kpi-label">Orphaned users</span>
          <strong className="um-kpi-value">{orphanedCount}</strong>
          <span className="um-kpi-caption">
            Users missing a valid manager or breaking hierarchy rules.
          </span>
        </div>
      </div>

      {/* ── Operations Focus Info Banner (Image 1) ── */}
      <div className="um-operations-focus-bar">
        <div>
          <strong>Operations focus</strong>
          <p>
            Use the table for quick review, then open a user only when you need role, access, photo, and override changes.
          </p>
        </div>
        <span className="um-focus-pill">Detail editing stays in the side dialog</span>
      </div>

      {/* ── Filters Row (Image 1) ── */}
      <div className="um-filter-toolbar">
        <div className="um-search-wrap">
          <Search size={16} className="um-search-icon" />
          <input
            type="text"
            className="um-search-input"
            placeholder="Search by name, email, or region..."
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
            <option value="all">All Regions</option>
            {AVAILABLE_REGIONS.map((r) => (
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
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            aria-label="Filter by role"
          >
            <option value="all">All Roles</option>
            {SYSTEM_ROLES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.name}
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
            <option value="inactive">Inactive Only</option>
            <option value="orphaned">Orphaned / Issues Only</option>
          </select>
          <ChevronDown size={15} className="um-chevron" />
        </div>
      </div>

      {/* ── Hierarchy Issues Warning Banner (Image 1) ── */}
      {orphanedCount > 0 && (
        <div className="um-hierarchy-alert-card">
          <div className="um-hierarchy-alert-text">
            <strong>Hierarchy issues need attention</strong>
            <p>{orphanedCount} users currently have no valid reporting path.</p>
          </div>
          <span className="um-orphaned-badge-pill">Orphaned users detected</span>
        </div>
      )}

      {/* ── User Table (Image 1) ── */}
      <div className="um-table-container">
        {visibleLoading ? (
          <LogoLoader variant="section" message="Loading user directory" hint="Fetching roles and user permissions" />
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state">
            <h3>No users found</h3>
            <p>No user accounts matched your current filter criteria.</p>
            <button
              type="button"
              className="secondary-button"
              style={{ marginTop: 10 }}
              onClick={() => {
                setSearch("");
                setRegionFilter("all");
                setRoleFilter("all");
                setStatusFilter("all");
              }}
            >
              Reset filters
            </button>
          </div>
        ) : (
          <>
            <div className="table-wrapper">
            <table className="um-table">
              <thead>
                <tr>
                  <th style={{ width: "32%" }}>Identity</th>
                  <th style={{ width: "38%" }}>Org Structure</th>
                  <th style={{ width: "30%" }}>Permissions & Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map((u) => {
                  const roleDef = SYSTEM_ROLES.find((r) => r.key === u.role_key);
                  const hierarchy = validateUserHierarchy(u, users);
                  const initials = u.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();

                  return (
                    <tr
                      key={u.id}
                      className="um-table-row"
                      onClick={() => setEditingUser(u)}
                      title="Click to edit user details, role, and reporting structure"
                    >
                      {/* Column 1: Identity */}
                      <td className="um-identity-cell">
                        <div className="um-identity-wrap">
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
                          <div className="um-identity-info">
                            <div className="um-name-badge-row">
                              <strong className="um-user-name">{u.name}</strong>
                              {hierarchy.isOrphaned && (
                                <span className="um-orphaned-flag-badge">Orphaned</span>
                              )}
                            </div>
                            <span className="um-user-email">{u.email}</span>
                            {u.phone && <span className="um-user-phone">{u.phone}</span>}
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Org Structure */}
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
                          {(u.region || u.role_key === "administrator" || u.role_key === "national_sales_manager" || u.role_key === "hr") && (
                            <span className="um-region-badge-pill">
                              {u.role_key === "administrator" || u.role_key === "national_sales_manager" || u.role_key === "hr" ? "National" : u.region}
                            </span>
                          )}
                        </div>

                        <div className="um-org-details-list">
                          <div className="um-org-line">
                            <span className="um-org-label">Reports to:</span>
                            <span className="um-org-value">
                              {u.role_key === "administrator"
                                ? "—"
                                : getManagerName(u.reports_to_id)}
                            </span>
                          </div>

                          {(u.region || u.role_key === "administrator" || u.role_key === "national_sales_manager" || u.role_key === "hr") && (
                            <div className="um-org-line">
                              <span className="um-org-label">Current region:</span>
                              <span className="um-org-value">
                                {u.role_key === "administrator" || u.role_key === "national_sales_manager" || u.role_key === "hr" ? "National" : u.region}
                              </span>
                            </div>
                          )}

                          {u.team && (
                            <div className="um-org-line">
                              <span className="um-org-label">Team:</span>
                              <span className="um-org-value">{u.team}</span>
                            </div>
                          )}
                        </div>

                        {/* Hierarchy Issue Box (Image 1) */}
                        {hierarchy.isOrphaned && (
                          <div className="um-row-hierarchy-issue-box">
                            <strong>Hierarchy issue</strong>
                            <p>{hierarchy.issues[0]}</p>
                          </div>
                        )}
                      </td>

                      {/* Column 3: Permissions & Status + Quick Actions */}
                      <td className="um-status-cell">
                        <div className="um-status-col">
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: "8px" }}>
                            <span
                              className={`um-status-pill ${u.is_active ? "active" : "inactive"}`}
                            >
                              <span className="um-status-dot" />
                              {u.is_active ? "Active" : "Deactivated"}
                            </span>

                            {/* Quick Admin Action Buttons */}
                            <div style={{ display: "flex", gap: "6px" }} onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => setResettingPasswordUser(u)}
                                title="Reset User Password"
                                style={{ padding: "4px 8px", fontSize: "0.75rem", gap: "4px", height: "28px" }}
                              >
                                <Key size={13} style={{ color: "#075544" }} />
                                <span>Reset Password</span>
                              </button>
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={(e) => handleToggleActive(u, e)}
                                title={u.is_active ? "Deactivate Account" : "Activate Account"}
                                style={{
                                  padding: "4px 8px",
                                  fontSize: "0.75rem",
                                  gap: "4px",
                                  height: "28px",
                                  color: u.is_active ? "#b91c1c" : "#15803d",
                                  borderColor: u.is_active ? "#fecaca" : "#bbf7d0",
                                  background: u.is_active ? "#fef2f2" : "#f0fdf4",
                                }}
                              >
                                {u.is_active ? <UserX size={13} /> : <UserCheck size={13} />}
                                <span>{u.is_active ? "Deactivate" : "Activate"}</span>
                              </button>
                            </div>
                          </div>

                          <p className="um-status-caption">
                            Open the editor to update page access, role history, account status, and dashboard overrides.
                          </p>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

            {/* ── Pagination Bar ── */}
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
                  Showing <strong>{startItem}</strong>–<strong>{endItem}</strong> of <strong>{totalItems}</strong> users
                </span>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <label htmlFor="um-page-size-select" style={{ fontSize: "0.8rem", color: "#6b7280" }}>
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
          </>
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
