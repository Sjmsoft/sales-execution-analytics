import { useState } from "react";
import {
  X,
  Shield,
  Check,
  Loader2,
  AlertCircle,
  LayoutDashboard,
  Wine,
  Store,
  Target,
  Calendar,
  FileText,
  Settings,
  Users,
  ShieldCheck,
  Eye,
  UserCheck,
  Sliders,
} from "lucide-react";
import {
  type RoleDefinition,
  APP_SYSTEM_PAGES,
  saveRole,
} from "../../services/userManagementService";

type RoleDialogProps = {
  role?: RoleDefinition | null;
  onSave: (savedRole: RoleDefinition) => void;
  onClose: () => void;
};

const ICON_MAP: Record<string, any> = {
  dashboard: LayoutDashboard,
  sales: Wine,
  outlets: Store,
  targets: Target,
  visits: Calendar,
  reports: FileText,
  settings: Settings,
  users: Users,
  roles: ShieldCheck,
};

export function RoleDialog({ role, onSave, onClose }: RoleDialogProps) {
  const isEditing = Boolean(role);

  const [name, setName] = useState(role?.name || "");
  const [key, setKey] = useState(role?.key || "");
  const [shortName, setShortName] = useState(role?.shortName || "");
  const [hierarchyLevel, setHierarchyLevel] = useState<number>(role?.hierarchy_level ?? 3);
  const [description, setDescription] = useState(role?.description || "");
  const [color, setColor] = useState(role?.color || "#075544");
  const [isActive, setIsActive] = useState(role?.is_active ?? true);

  // Capabilities
  const [canManageStaff, setCanManageStaff] = useState(role?.can_manage_staff ?? false);
  const [canAssignTargets, setCanAssignTargets] = useState(role?.can_assign_targets ?? false);
  const [canViewAllSales, setCanViewAllSales] = useState(role?.can_view_all_sales ?? false);

  // Page Access Permissions
  const [allowedPages, setAllowedPages] = useState<string[]>(
    role?.allowed_pages || ["dashboard", "sales"]
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Handle auto slug generation for new roles
  function handleNameChange(val: string) {
    setName(val);
    if (!isEditing && !key) {
      const slug = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
      setKey(slug);
    }
  }

  function togglePagePermission(pageKey: string) {
    if (allowedPages.includes(pageKey)) {
      setAllowedPages(allowedPages.filter((p) => p !== pageKey));
    } else {
      setAllowedPages([...allowedPages, pageKey]);
    }
  }

  function toggleAllPages() {
    if (allowedPages.length === APP_SYSTEM_PAGES.length) {
      setAllowedPages(["dashboard", "settings"]);
    } else {
      setAllowedPages(APP_SYSTEM_PAGES.map((p) => p.key));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Role name is required.");
      return;
    }
    if (!key.trim()) {
      setError("Role key slug is required.");
      return;
    }

    setSubmitting(true);
    setError("");

    const rolePayload: RoleDefinition = {
      id: role?.id || `role-${Date.now()}`,
      key: key.trim().toLowerCase(),
      name: name.trim(),
      shortName: shortName.trim() || name.substring(0, 3).toUpperCase(),
      hierarchy_level: hierarchyLevel,
      can_manage_staff: canManageStaff,
      can_assign_targets: canAssignTargets,
      can_view_all_sales: canViewAllSales,
      description: description.trim(),
      color,
      badgeBg: "#e6f4f0",
      badgeText: color,
      permissions: allowedPages,
      is_system_default: role?.is_system_default ?? false,
      is_active: isActive,
      allowed_pages: allowedPages,
      allowed_reporting_roles: role?.allowed_reporting_roles || [],
    };

    const res = await saveRole(rolePayload);
    setSubmitting(false);

    if (res.success) {
      onSave(res.role);
    } else {
      setError(res.message);
    }
  }

  return (
    <div className="new-sale-backdrop" role="presentation">
      <section
        className="user-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="role-dialog-title"
        style={{ maxWidth: "680px", width: "100%" }}
      >
        <header className="user-modal-header">
          <div>
            <h3 id="role-dialog-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Shield size={20} style={{ color: "#075544" }} />
              {isEditing ? `Edit Role: ${role?.name}` : "Create Custom System Role"}
            </h3>
            <p>Define role hierarchy, system capabilities, and page accessibility permissions</p>
          </div>
          <button type="button" className="user-modal-close" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="user-modal-body" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {error && (
            <div className="settings-pw-error" style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: "10px 14px", borderRadius: "8px" }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {/* Section 1: General Details */}
          <div>
            <h4 style={{ margin: "0 0 12px 0", fontSize: "0.95rem", fontWeight: 700, color: "#111827", display: "flex", alignItems: "center", gap: "6px" }}>
              <Sliders size={16} style={{ color: "#075544" }} /> General Details
            </h4>

            <div className="settings-form-grid">
              <div className="settings-field">
                <label>Role Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Trade Marketing Manager"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                />
              </div>

              <div className="settings-field">
                <label>Key Slug *</label>
                <input
                  type="text"
                  placeholder="e.g. trade_marketing_manager"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  disabled={role?.is_system_default}
                  required
                />
              </div>

              <div className="settings-field">
                <label>Short Code</label>
                <input
                  type="text"
                  placeholder="e.g. TMM"
                  value={shortName}
                  onChange={(e) => setShortName(e.target.value)}
                />
              </div>

              <div className="settings-field">
                <label>Hierarchy Level</label>
                <select
                  value={hierarchyLevel}
                  onChange={(e) => setHierarchyLevel(Number(e.target.value))}
                >
                  <option value={1}>Level 1 - Executive / Administrator</option>
                  <option value={2}>Level 2 - National Lead / Management</option>
                  <option value={3}>Level 3 - Regional Lead / Supervisor</option>
                  <option value={4}>Level 4 - Sales Representative / Field Rep</option>
                  <option value={5}>Level 5 - Support Representative</option>
                </select>
              </div>

              <div className="settings-field">
                <label>Status</label>
                <select
                  value={isActive ? "active" : "inactive"}
                  onChange={(e) => setIsActive(e.target.value === "active")}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Deactivated / Disabled</option>
                </select>
              </div>

              <div className="settings-field">
                <label>Theme Color</label>
                <select
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                >
                  <option value="#075544">Dark Green (Default)</option>
                  <option value="#b91c1c">Red (Executive / Admin)</option>
                  <option value="#1e40af">Blue (Management)</option>
                  <option value="#0f766e">Teal (Regional Supervisor)</option>
                  <option value="#d97706">Amber (Field Supervisor)</option>
                  <option value="#be185d">Pink / Magenta (Brand Ambassador)</option>
                </select>
              </div>

              <div className="settings-field settings-field--full">
                <label>Description</label>
                <textarea
                  className="user-modal-input"
                  rows={2}
                  placeholder="Briefly describe the operational scope and duties for this role..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ width: "100%", borderRadius: "8px", border: "1px solid #d1d5db", padding: "8px 12px", fontSize: "0.85rem", resize: "none" }}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Page & Accessibility Permissions */}
          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <div>
                <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#111827", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Eye size={16} style={{ color: "#075544" }} /> Page Accessibility & Module Navigation
                </h4>
                <p style={{ margin: "2px 0 0 0", fontSize: "0.78rem", color: "#6b7280" }}>
                  Select which pages and modules this role can access and use.
                </p>
              </div>

              <button
                type="button"
                className="secondary-button"
                onClick={toggleAllPages}
                style={{ fontSize: "0.78rem", padding: "4px 10px" }}
              >
                {allowedPages.length === APP_SYSTEM_PAGES.length ? "Deselect All" : "Select All Pages"}
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "10px" }}>
              {APP_SYSTEM_PAGES.map((pg) => {
                const IconComponent = ICON_MAP[pg.key] || Shield;
                const isSelected = allowedPages.includes(pg.key);

                return (
                  <div
                    key={pg.key}
                    onClick={() => togglePagePermission(pg.key)}
                    style={{
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: isSelected ? "1.5px solid #075544" : "1px solid #e5e7eb",
                      background: isSelected ? "#f0fdf4" : "#ffffff",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => togglePagePermission(pg.key)}
                      style={{ marginTop: "3px", cursor: "pointer", accentColor: "#075544" }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <IconComponent size={15} style={{ color: isSelected ? "#075544" : "#6b7280" }} />
                        <strong style={{ fontSize: "0.85rem", color: isSelected ? "#075544" : "#111827" }}>
                          {pg.label}
                        </strong>
                      </div>
                      <p style={{ margin: "2px 0 0 0", fontSize: "0.75rem", color: "#6b7280", lineHeight: 1.3 }}>
                        {pg.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: High-Level Operational Capabilities */}
          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "16px" }}>
            <h4 style={{ margin: "0 0 10px 0", fontSize: "0.95rem", fontWeight: 700, color: "#111827", display: "flex", alignItems: "center", gap: "6px" }}>
              <UserCheck size={16} style={{ color: "#075544" }} /> Capabilities & Operational Overrides
            </h4>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", background: "#f9fafb", borderRadius: "8px", border: "1px solid #e5e7eb", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={canManageStaff}
                  onChange={(e) => setCanManageStaff(e.target.checked)}
                  style={{ accentColor: "#075544" }}
                />
                <div>
                  <strong style={{ fontSize: "0.85rem", color: "#111827" }}>Manage Staff & Hierarchy</strong>
                  <span style={{ display: "block", fontSize: "0.78rem", color: "#6b7280" }}>
                    Allows managing assigned subordinate staff and reporting relationships.
                  </span>
                </div>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", background: "#f9fafb", borderRadius: "8px", border: "1px solid #e5e7eb", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={canAssignTargets}
                  onChange={(e) => setCanAssignTargets(e.target.checked)}
                  style={{ accentColor: "#075544" }}
                />
                <div>
                  <strong style={{ fontSize: "0.85rem", color: "#111827" }}>Assign Sales Targets</strong>
                  <span style={{ display: "block", fontSize: "0.78rem", color: "#6b7280" }}>
                    Allows creating and assigning monthly volume/revenue targets to sales reps.
                  </span>
                </div>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", background: "#f9fafb", borderRadius: "8px", border: "1px solid #e5e7eb", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={canViewAllSales}
                  onChange={(e) => setCanViewAllSales(e.target.checked)}
                  style={{ accentColor: "#075544" }}
                />
                <div>
                  <strong style={{ fontSize: "0.85rem", color: "#111827" }}>View Global Sales (National Scope)</strong>
                  <span style={{ display: "block", fontSize: "0.78rem", color: "#6b7280" }}>
                    Grants global visibility across all regions instead of restricting data to assigned territory.
                  </span>
                </div>
              </label>
            </div>
          </div>

          <footer className="user-modal-footer" style={{ borderTop: "1px solid #e5e7eb", paddingTop: "14px", marginTop: "10px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button type="button" className="secondary-button" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 size={14} className="spin" /> Saving...
                </>
              ) : (
                <>
                  <Check size={14} /> {isEditing ? "Save Role Changes" : "Create Role"}
                </>
              )}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
