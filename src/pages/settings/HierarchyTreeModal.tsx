import { useState } from "react";
import {
  X,
  GitBranch,
  Shield,
  Building,
  UserCheck,
  AlertTriangle,
  Search,
} from "lucide-react";
import {
  SYSTEM_ROLES,
  validateUserHierarchy,
  type UserAccount,
} from "../../services/userManagementService";

type HierarchyTreeModalProps = {
  users: UserAccount[];
  onSelectUserToEdit: (user: UserAccount) => void;
  onClose: () => void;
};

export function HierarchyTreeModal({
  users,
  onSelectUserToEdit,
  onClose,
}: HierarchyTreeModalProps) {
  const [treeSearch, setTreeSearch] = useState("");
  const query = treeSearch.trim().toLowerCase();

  const matchesQuery = (u: UserAccount) => {
    if (!query) return true;
    return (
      u.name.toLowerCase().includes(query) ||
      u.region.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query)
    );
  };

  // Categorize users
  const adminUsers = users.filter((u) => u.role_key === "administrator" && matchesQuery(u));
  const hrUsers = users.filter((u) => u.role_key === "hr" && matchesQuery(u));
  const nsmUsers = users.filter((u) => u.role_key === "national_sales_manager" && matchesQuery(u));
  const rsmUsers = users.filter((u) => u.role_key === "regional_sales_manager");
  const seUsers = users.filter((u) => u.role_key === "sales_executive");
  const fieldUsers = users.filter((u) => u.role_key === "brand_ambassador" || u.role_key === "vsr");

  const orphanedUsers = users.filter((u) => validateUserHierarchy(u, users).isOrphaned);

  return (
    <div className="new-sale-backdrop" role="presentation">
      <section
        className="hierarchy-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hierarchy-title"
      >
        <header className="user-modal-header">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <GitBranch size={20} color="#075544" />
              <h3 id="hierarchy-title" style={{ margin: 0 }}>
                Organizational Hierarchy & Reporting Structure
              </h3>
            </div>
            <p>
              Visual tree showing National Sales leadership, Regional Managers, Sales Executives, and Field Reps
            </p>
          </div>
          <button
            type="button"
            className="user-modal-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </header>

        <div className="hierarchy-tree-body">
          {/* Quick Search & Tier Summary Strip */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", background: "#f8fafc", padding: "10px 14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
            <div style={{ position: "relative", minWidth: "240px", flex: 1 }}>
              <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <input
                type="text"
                value={treeSearch}
                onChange={(e) => setTreeSearch(e.target.value)}
                placeholder="Search hierarchy by name, email, or region..."
                style={{
                  width: "100%",
                  height: "34px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  padding: "0 28px 0 32px",
                  fontSize: "12.5px",
                  outline: "none",
                }}
              />
              {treeSearch && (
                <button
                  type="button"
                  onClick={() => setTreeSearch("")}
                  style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", fontSize: "11.5px", fontWeight: 600 }}>
              <span style={{ background: "#eff6ff", color: "#1e40af", padding: "3px 8px", borderRadius: "999px" }}>
                {rsmUsers.length} RSMs
              </span>
              <span style={{ background: "#f0fdf4", color: "#166534", padding: "3px 8px", borderRadius: "999px" }}>
                {seUsers.length} SEs
              </span>
              <span style={{ background: "#fce7f3", color: "#9d174d", padding: "3px 8px", borderRadius: "999px" }}>
                {fieldUsers.length} Field Reps
              </span>
              {orphanedUsers.length > 0 && (
                <span style={{ background: "#fef2f2", color: "#dc2626", padding: "3px 8px", borderRadius: "999px" }}>
                  {orphanedUsers.length} Orphaned
                </span>
              )}
            </div>
          </div>

          {/* Top Corporate Tier */}
          <div className="hierarchy-tier-block">
            <span className="hierarchy-tier-label">Corporate & Administration ({adminUsers.length + hrUsers.length})</span>
            <div className="hierarchy-nodes-row">
              {adminUsers.map((u) => (
                <div
                  key={u.id}
                  className="hierarchy-node-card admin"
                  onClick={() => onSelectUserToEdit(u)}
                >
                  <Shield size={16} />
                  <div>
                    <strong>{u.name}</strong>
                    <span>Administrator</span>
                  </div>
                </div>
              ))}
              {hrUsers.map((u) => (
                <div
                  key={u.id}
                  className="hierarchy-node-card hr"
                  onClick={() => onSelectUserToEdit(u)}
                >
                  <Building size={16} />
                  <div>
                    <strong>{u.name}</strong>
                    <span>Human Resources (HR) &bull; All Activities</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="hierarchy-connector-line" />

          {/* National Sales Manager Tier */}
          <div className="hierarchy-tier-block">
            <span className="hierarchy-tier-label">National Sales Leadership ({nsmUsers.length})</span>
            <div className="hierarchy-nodes-row">
              {nsmUsers.map((u) => (
                <div
                  key={u.id}
                  className="hierarchy-node-card nsm"
                  onClick={() => onSelectUserToEdit(u)}
                >
                  <UserCheck size={16} />
                  <div>
                    <strong>{u.name}</strong>
                    <span>National Sales Manager (NSM) &bull; Overall Lead</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="hierarchy-connector-line" />

          {/* Regional Sales Managers Tier */}
          <div className="hierarchy-tier-block">
            <span className="hierarchy-tier-label">Regional Sales Managers (RSM) & Territory Branches</span>
            <div className="hierarchy-nodes-grid">
              {rsmUsers.map((rsm) => {
                const subSes = seUsers.filter((se) => se.reports_to_id === rsm.id);
                const directField = fieldUsers.filter((f) => f.reports_to_id === rsm.id);
                const branchMatches =
                  matchesQuery(rsm) ||
                  subSes.some((se) => matchesQuery(se) || fieldUsers.some((f) => f.reports_to_id === se.id && matchesQuery(f))) ||
                  directField.some(matchesQuery);
                if (!branchMatches) return null;

                return (
                  <div key={rsm.id} className="hierarchy-regional-branch">
                    <div
                      className="hierarchy-node-card rsm"
                      onClick={() => onSelectUserToEdit(rsm)}
                      style={{ justifyContent: "space-between" }}
                    >
                      <div>
                        <strong>{rsm.name}</strong>
                        <span>RSM &bull; {rsm.region}</span>
                      </div>
                      <span style={{ fontSize: "10.5px", fontWeight: 700, background: "#f1f5f9", padding: "2px 6px", borderRadius: "999px", color: "#334155" }}>
                        {subSes.length} SE{subSes.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    {/* Subordinate SEs */}
                    {subSes.length > 0 && (
                      <div className="hierarchy-subordinates-box">
                        <span className="hierarchy-sub-title">Supervised SEs ({subSes.length}):</span>
                        {subSes.map((se) => {
                          const subField = fieldUsers.filter((f) => f.reports_to_id === se.id);
                          return (
                            <div key={se.id} className="hierarchy-se-sub-card">
                              <div
                                className="hierarchy-node-card se"
                                onClick={() => onSelectUserToEdit(se)}
                                style={{ justifyContent: "space-between" }}
                              >
                                <div>
                                  <strong>{se.name}</strong>
                                  <span>SE &bull; {se.region}</span>
                                </div>
                                {subField.length > 0 && (
                                  <span style={{ fontSize: "10px", fontWeight: 700, background: "#f8fafc", padding: "1px 6px", borderRadius: "999px", color: "#475569" }}>
                                    {subField.length} Rep{subField.length === 1 ? "" : "s"}
                                  </span>
                                )}
                              </div>

                              {subField.length > 0 && (
                                <div className="hierarchy-field-reps-list">
                                  {subField.map((f) => (
                                    <span
                                      key={f.id}
                                      className={`hierarchy-rep-pill ${f.role_key}`}
                                      onClick={() => onSelectUserToEdit(f)}
                                    >
                                      {f.name} ({f.role_key === "brand_ambassador" ? "BA" : "VSR"})
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Orphaned Users Attention Section */}
          {orphanedUsers.length > 0 && (
            <div className="hierarchy-orphaned-section">
              <div className="hierarchy-orphaned-header">
                <AlertTriangle size={18} color="#dc2626" />
                <strong>Orphaned Users Requiring Assignment ({orphanedUsers.length})</strong>
              </div>
              <p>
                The following users currently lack a valid manager or violate regional hierarchy constraints:
              </p>
              <div className="hierarchy-orphaned-chips">
                {orphanedUsers.map((u) => {
                  const check = validateUserHierarchy(u, users);
                  return (
                    <div
                      key={u.id}
                      className="hierarchy-orphaned-chip"
                      onClick={() => onSelectUserToEdit(u)}
                    >
                      <div>
                        <strong>{u.name}</strong> ({SYSTEM_ROLES.find((r) => r.key === u.role_key)?.shortName})
                        <small>{check.issues[0]}</small>
                      </div>
                      <button type="button" className="hierarchy-assign-btn">
                        Fix &rarr;
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="user-modal-footer">
          <button type="button" className="primary-button" onClick={onClose}>
            Close
          </button>
        </div>
      </section>
    </div>
  );
}
