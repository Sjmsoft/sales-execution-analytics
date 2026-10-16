import { useEffect, useState } from "react";
import {
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  X,
  Loader2,
  Users as UsersIcon,
  Shield,
  Heart,
  Crown,
  Briefcase,
  User,
  Wine,
} from "lucide-react";
import {
  type RoleDefinition,
  loadRoles,
  deleteRole,
  loadUserAccounts,
  SYSTEM_ROLES,
} from "../../services/userManagementService";
import LogoLoader from "../../components/brand/LogoLoader";
import { useMinimumLoading } from "../../hooks/useMinimumLoading";
import { RoleDialog } from "./RoleDialog";

const ROLE_ICONS: Record<string, any> = {
  administrator: ShieldCheck,
  hr: Heart,
  national_sales_manager: Crown,
  sales_executive: Briefcase,
  regional_sales_manager: UsersIcon,
  brand_ambassador: User,
  vsr: Wine,
};

const PAGE_LABEL_MAP: Record<string, string> = {
  dashboard: "Dashboard",
  sales: "Sales Log",
  outlets: "Outlet Management",
  targets: "Targets & KPI",
  visits: "Visits & Attendance",
  reports: "Reports & Analytics",
  settings: "Settings",
  users: "User Management",
  roles: "Role Management",
};

export function RoleManagementSection() {
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [staffCountMap, setStaffCountMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const visibleLoading = useMinimumLoading(loading, 600);
  const [notification, setNotification] = useState("");
  const [error, setError] = useState("");

  // Accordion expanded row state
  const [expandedRoleKeys, setExpandedRoleKeys] = useState<Record<string, boolean>>({
    administrator: true, // expand first row by default as in screenshot
  });

  // Modal dialog state
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDefinition | null>(null);

  // Delete confirmation
  const [deletingRole, setDeletingRole] = useState<RoleDefinition | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  async function init() {
    setLoading(true);
    setError("");
    try {
      const fetchedRoles = await loadRoles().catch(() => SYSTEM_ROLES);
      setRoles(fetchedRoles && fetchedRoles.length > 0 ? fetchedRoles : SYSTEM_ROLES);

      let fetchedUsers: any[] = [];
      try {
        fetchedUsers = await loadUserAccounts();
      } catch (e) {
        console.warn("loadUserAccounts notice in RoleManagementSection:", e);
      }

      // Compute staff counts for each role key
      const counts: Record<string, number> = {};
      for (const u of fetchedUsers) {
        const k = u.role_key || "sales_executive";
        counts[k] = (counts[k] || 0) + 1;
      }
      setStaffCountMap(counts);
    } catch (e: any) {
      setError(e?.message || "Failed to load system roles.");
      setRoles(SYSTEM_ROLES);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void init();
  }, []);

  function toggleExpandRow(roleKey: string) {
    setExpandedRoleKeys((prev) => ({
      ...prev,
      [roleKey]: !prev[roleKey],
    }));
  }

  function handleOpenCreate() {
    setEditingRole(null);
    setRoleDialogOpen(true);
  }

  function handleOpenEdit(r: RoleDefinition, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingRole(r);
    setRoleDialogOpen(true);
  }

  function handleOpenDelete(r: RoleDefinition, e: React.MouseEvent) {
    e.stopPropagation();
    if (r.is_system_default) {
      setError("System default roles cannot be deleted. You can edit their page access instead.");
      setTimeout(() => setError(""), 4000);
      return;
    }
    setDeletingRole(r);
  }

  async function confirmDeleteRole() {
    if (!deletingRole) return;
    setDeletingLoading(true);
    const res = await deleteRole(deletingRole.id, deletingRole.key);
    setDeletingLoading(false);

    if (res.success) {
      setRoles((prev) => prev.filter((r) => r.id !== deletingRole.id && r.key !== deletingRole.key));
      setNotification(`Role "${deletingRole.name}" deleted successfully.`);
      setDeletingRole(null);
      setTimeout(() => setNotification(""), 4000);
    } else {
      setError(res.message);
      setDeletingRole(null);
      setTimeout(() => setError(""), 4000);
    }
  }

  function handleSaveSuccess(saved: RoleDefinition) {
    setRoles((prev) => {
      const idx = prev.findIndex((r) => r.key === saved.key || r.id === saved.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = saved;
        return copy;
      }
      return [...prev, saved];
    });

    setRoleDialogOpen(false);
    setEditingRole(null);
    setNotification(`Role "${saved.name}" saved successfully.`);
    setTimeout(() => setNotification(""), 4000);
  }

  // Summary counts
  const totalRoles = roles.length;
  const systemDefaultCount = roles.filter((r) => r.is_system_default).length;
  const customCount = totalRoles - systemDefaultCount;
  const activeCount = roles.filter((r) => r.is_active ?? true).length;

  return (
    <div className="user-management-container" style={{ padding: "1.5rem", background: "#f9fafb", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
      {/* ── Top Header ── */}
      <div className="um-header-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", flexWrap: "wrap", gap: "12px" }}>
        <div className="um-title-with-icon" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <ShieldCheck size={28} className="um-main-icon" style={{ color: "#075544", background: "#e6f4f0", padding: "8px", borderRadius: "10px" }} />
          <div>
            <h2 className="um-title" style={{ fontSize: "1.25rem", fontWeight: 700, color: "#111827", margin: 0 }}>
              Role & Permission Management
            </h2>
            <p className="um-subtitle" style={{ fontSize: "0.85rem", color: "#6b7280", margin: "2px 0 0 0" }}>
              Configure custom roles, hierarchy levels, capabilities, and page accessibility permissions
            </p>
          </div>
        </div>

        <div className="um-header-actions" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            className="primary-button um-add-user-btn"
            onClick={handleOpenCreate}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "8px", background: "#075544", color: "#ffffff", fontWeight: 600, fontSize: "0.875rem", border: "none", cursor: "pointer" }}
          >
            <Plus size={16} />
            <span>Add Role</span>
          </button>
        </div>
      </div>

      {/* ── Banners ── */}
      {notification && (
        <div className="new-sale-success" style={{ margin: "0 0 1.25rem 0", display: "flex", alignItems: "center", gap: "8px", background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d", padding: "10px 14px", borderRadius: "8px" }} role="status">
          <CheckCircle2 size={18} />
          <span style={{ flex: 1 }}>{notification}</span>
          <button type="button" onClick={() => setNotification("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#15803d" }}>
            <X size={16} />
          </button>
        </div>
      )}

      {error && (
        <div style={{ margin: "0 0 1.25rem 0", display: "flex", alignItems: "center", gap: "8px", background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", padding: "10px 14px", borderRadius: "8px" }}>
          <span style={{ flex: 1 }}>{error}</span>
          <button type="button" onClick={() => setError("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#b91c1c" }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── KPI Summary Cards ── */}
      <div className="um-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "1.5rem" }}>
        <div className="um-kpi-card" style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px 20px" }}>
          <span className="um-kpi-label" style={{ fontSize: "0.78rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Configured Roles</span>
          <strong className="um-kpi-value" style={{ fontSize: "1.6rem", fontWeight: 800, color: "#111827", margin: "4px 0", display: "block" }}>{totalRoles}</strong>
          <span className="um-kpi-caption" style={{ fontSize: "0.78rem", color: "#6b7280" }}>Total system and custom roles.</span>
        </div>

        <div className="um-kpi-card" style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px 20px" }}>
          <span className="um-kpi-label" style={{ fontSize: "0.78rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>System Defaults</span>
          <strong className="um-kpi-value" style={{ fontSize: "1.6rem", fontWeight: 800, color: "#075544", margin: "4px 0", display: "block" }}>{systemDefaultCount}</strong>
          <span className="um-kpi-caption" style={{ fontSize: "0.78rem", color: "#6b7280" }}>Pre-configured operational roles.</span>
        </div>

        <div className="um-kpi-card" style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px 20px" }}>
          <span className="um-kpi-label" style={{ fontSize: "0.78rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Custom Roles</span>
          <strong className="um-kpi-value" style={{ fontSize: "1.6rem", fontWeight: 800, color: "#111827", margin: "4px 0", display: "block" }}>{customCount}</strong>
          <span className="um-kpi-caption" style={{ fontSize: "0.78rem", color: "#6b7280" }}>Custom administrative definitions.</span>
        </div>

        <div className="um-kpi-card" style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px 20px" }}>
          <span className="um-kpi-label" style={{ fontSize: "0.78rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Active Roles</span>
          <strong className="um-kpi-value" style={{ fontSize: "1.6rem", fontWeight: 800, color: "#15803d", margin: "4px 0", display: "block" }}>{activeCount}</strong>
          <span className="um-kpi-caption" style={{ fontSize: "0.78rem", color: "#6b7280" }}>Currently enabled role templates.</span>
        </div>
      </div>

      {/* ── Table Card ── */}
      <div className="um-table-container" style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
        {/* Table Subtitle Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", background: "#ffffff" }}>
          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#111827" }}>Configured Roles</h3>
          <p style={{ margin: "2px 0 0 0", fontSize: "0.82rem", color: "#6b7280" }}>
            Click a role to expand details. Edit or delete using the action buttons.
          </p>
        </div>

        {visibleLoading ? (
          <LogoLoader variant="section" message="Loading role configurations" hint="Fetching permissions and access matrix" />
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="um-table" style={{ width: "100%", minWidth: "900px", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "12px 16px", fontWeight: 600, color: "#4b5563", width: "40%" }}>Role</th>
                  <th style={{ padding: "12px 16px", fontWeight: 600, color: "#4b5563", width: "12%" }}>Key</th>
                  <th style={{ padding: "12px 16px", fontWeight: 600, color: "#4b5563", width: "10%" }}>Level</th>
                  <th style={{ padding: "12px 16px", fontWeight: 600, color: "#4b5563", width: "12%" }}>Staff</th>
                  <th style={{ padding: "12px 16px", fontWeight: 600, color: "#4b5563", width: "14%" }}>Status</th>
                  <th style={{ padding: "12px 16px", fontWeight: 600, color: "#4b5563", width: "12%", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => {
                  const isExpanded = Boolean(expandedRoleKeys[r.key]);
                  const RoleIcon = ROLE_ICONS[r.key] || Shield;
                  const staffAssigned = staffCountMap[r.key] || 0;
                  const isActiveRole = r.is_active ?? true;

                  const allowedPages = Array.isArray(r.allowed_pages) ? r.allowed_pages : [];
                  const reportingRoles = Array.isArray(r.allowed_reporting_roles) ? r.allowed_reporting_roles : [];

                  return (
                    <tr key={r.key || r.id} style={{ borderBottom: "1px solid #e5e7eb", background: isExpanded ? "#fafafa" : "#ffffff" }}>
                      <td colSpan={6} style={{ padding: 0 }}>
                        {/* Main Row Content */}
                        <div
                          onClick={() => toggleExpandRow(r.key)}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "40% 12% 10% 12% 14% 12%",
                            alignItems: "center",
                            padding: "16px",
                            cursor: "pointer",
                            transition: "background 0.15s ease",
                          }}
                        >
                          {/* Col 1: Role Name, Icon & Default Badge */}
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpandRow(r.key);
                              }}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: "2px", display: "flex" }}
                            >
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>

                            <div
                              style={{
                                width: "36px",
                                height: "36px",
                                borderRadius: "8px",
                                background: r.key === "administrator" ? "#fee2e2" : r.key === "hr" ? "#d1fae5" : "#e6f4f0",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              <RoleIcon size={18} style={{ color: r.key === "administrator" ? "#b91c1c" : r.key === "hr" ? "#047857" : "#075544" }} />
                            </div>

                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <strong style={{ fontSize: "0.95rem", color: "#111827" }}>{r.name}</strong>
                                {r.is_system_default && (
                                  <span
                                    title="System default role"
                                    style={{
                                      padding: "2px 8px",
                                      borderRadius: "12px",
                                      background: "#e5e7eb",
                                      color: "#374151",
                                      fontSize: "0.72rem",
                                      fontWeight: 600,
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    Default
                                  </span>
                                )}
                              </div>
                              <p style={{ margin: "2px 0 0 0", fontSize: "0.78rem", color: "#6b7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "300px" }}>
                                {r.description}
                              </p>
                            </div>
                          </div>

                          {/* Col 2: Key */}
                          <div>
                            <span style={{ padding: "4px 10px", borderRadius: "16px", background: "#f3f4f6", border: "1px solid #e5e7eb", color: "#374151", fontSize: "0.78rem", fontFamily: "monospace", fontWeight: 600 }}>
                              {r.key}
                            </span>
                          </div>

                          {/* Col 3: Level */}
                          <div>
                            <span
                              style={{
                                width: "24px",
                                height: "24px",
                                borderRadius: "50%",
                                background: "#d1fae5",
                                color: "#065f46",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "0.78rem",
                                fontWeight: 700,
                              }}
                            >
                              {r.hierarchy_level}
                            </span>
                          </div>

                          {/* Col 4: Staff */}
                          <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "#374151", fontSize: "0.85rem", fontWeight: 600 }}>
                            <UsersIcon size={14} style={{ color: "#6b7280" }} />
                            <span>{staffAssigned}</span>
                          </div>

                          {/* Col 5: Status */}
                          <div>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "4px 12px",
                                borderRadius: "20px",
                                background: isActiveRole ? "#d97706" : "#fef2f2",
                                color: isActiveRole ? "#ffffff" : "#b91c1c",
                                fontSize: "0.78rem",
                                fontWeight: 700,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {isActiveRole ? "✓ Active" : "Deactivated"}
                            </span>
                          </div>

                          {/* Col 6: Actions */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }} onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={(e) => handleOpenEdit(r, e)}
                              title="Edit Role & Permissions"
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#4b5563", padding: "6px", borderRadius: "6px", display: "flex", alignItems: "center" }}
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleOpenDelete(r, e)}
                              title={r.is_system_default ? "System default roles cannot be deleted" : "Delete Role"}
                              disabled={r.is_system_default}
                              style={{ background: "none", border: "none", cursor: r.is_system_default ? "not-allowed" : "pointer", color: r.is_system_default ? "#d1d5db" : "#ef4444", padding: "6px", borderRadius: "6px", display: "flex", alignItems: "center" }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>

                        {/* ── Expanded Detail Box ── */}
                        {isExpanded && (
                          <div
                            style={{
                              padding: "16px 20px 20px 60px",
                              background: "#f9fafb",
                              borderTop: "1px solid #e5e7eb",
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr 1fr",
                              gap: "20px",
                            }}
                          >
                            {/* Capabilities */}
                            <div>
                              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: "8px" }}>
                                CAPABILITIES
                              </span>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                {r.can_assign_targets && (
                                  <span style={{ padding: "3px 10px", borderRadius: "16px", background: "#ffffff", border: "1px solid #d1d5db", fontSize: "0.78rem", fontWeight: 600, color: "#374151" }}>
                                    🎯 Assign Targets
                                  </span>
                                )}
                                {r.can_view_all_sales && (
                                  <span style={{ padding: "3px 10px", borderRadius: "16px", background: "#ffffff", border: "1px solid #d1d5db", fontSize: "0.78rem", fontWeight: 600, color: "#374151" }}>
                                    👁️ View All Sales
                                  </span>
                                )}
                                {r.can_manage_staff && (
                                  <span style={{ padding: "3px 10px", borderRadius: "16px", background: "#ffffff", border: "1px solid #d1d5db", fontSize: "0.78rem", fontWeight: 600, color: "#374151" }}>
                                    👥 Manage Staff
                                  </span>
                                )}
                                {!r.can_assign_targets && !r.can_view_all_sales && !r.can_manage_staff && (
                                  <span style={{ fontSize: "0.8rem", color: "#9ca3af" }}>Standard Field Execution</span>
                                )}
                              </div>
                            </div>

                            {/* Permission Template / Allowed Pages */}
                            <div>
                              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: "8px" }}>
                                ALLOWED PAGES / PERMISSIONS
                              </span>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                {allowedPages.length > 0 ? (
                                  allowedPages.map((p) => (
                                    <span key={p} style={{ padding: "3px 8px", borderRadius: "12px", background: "#e6f4f0", border: "1px solid #b2dfd5", fontSize: "0.75rem", fontWeight: 600, color: "#075544" }}>
                                      {PAGE_LABEL_MAP[p] || p}
                                    </span>
                                  ))
                                ) : (
                                  <span style={{ fontSize: "0.8rem", color: "#9ca3af" }}>No template defined</span>
                                )}
                              </div>
                            </div>

                            {/* Allowed Reporting Roles */}
                            <div>
                              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: "8px" }}>
                                ALLOWED REPORTING ROLES
                              </span>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                {reportingRoles.length > 0 ? (
                                  reportingRoles.map((arr) => (
                                    <span key={arr} style={{ padding: "3px 8px", borderRadius: "12px", background: "#f3f4f6", border: "1px solid #e5e7eb", fontSize: "0.75rem", color: "#4b5563" }}>
                                      {arr}
                                    </span>
                                  ))
                                ) : (
                                  <span style={{ fontSize: "0.8rem", color: "#9ca3af" }}>None specified</span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Dialog Modals ── */}
      {roleDialogOpen && (
        <RoleDialog
          role={editingRole}
          onSave={handleSaveSuccess}
          onClose={() => {
            setRoleDialogOpen(false);
            setEditingRole(null);
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deletingRole && (
        <div className="new-sale-backdrop" role="presentation">
          <div className="user-modal-dialog" style={{ maxWidth: "420px", padding: "20px" }}>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "1.1rem", color: "#111827", fontWeight: 700 }}>
              Delete Role: {deletingRole.name}?
            </h3>
            <p style={{ margin: "0 0 16px 0", fontSize: "0.85rem", color: "#4b5563" }}>
              Are you sure you want to delete this custom role? Staff currently assigned to this role will fallback to standard permissions.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setDeletingRole(null)}
                disabled={deletingLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={confirmDeleteRole}
                disabled={deletingLoading}
                style={{ background: "#dc2626" }}
              >
                {deletingLoading ? <Loader2 size={14} className="spin" /> : "Delete Role"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
