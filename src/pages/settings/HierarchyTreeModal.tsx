import {
  X,
  GitBranch,
  Shield,
  Building,
  UserCheck,
  AlertTriangle,
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
  // Categorize users
  const adminUsers = users.filter((u) => u.role_key === "administrator");
  const hrUsers = users.filter((u) => u.role_key === "hr");
  const nsmUsers = users.filter((u) => u.role_key === "national_sales_manager");
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
          {/* Top Corporate Tier */}
          <div className="hierarchy-tier-block">
            <span className="hierarchy-tier-label">Corporate & Administration</span>
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
            <span className="hierarchy-tier-label">National Sales Leadership</span>
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
            <span className="hierarchy-tier-label">Regional Sales Managers (RSM)</span>
            <div className="hierarchy-nodes-grid">
              {rsmUsers.map((rsm) => {
                const subSes = seUsers.filter((se) => se.reports_to_id === rsm.id);

                return (
                  <div key={rsm.id} className="hierarchy-regional-branch">
                    <div
                      className="hierarchy-node-card rsm"
                      onClick={() => onSelectUserToEdit(rsm)}
                    >
                      <strong>{rsm.name}</strong>
                      <span>RSM &bull; {rsm.region}</span>
                    </div>

                    {/* Subordinate SEs */}
                    {subSes.length > 0 && (
                      <div className="hierarchy-subordinates-box">
                        <span className="hierarchy-sub-title">Supervised SEs:</span>
                        {subSes.map((se) => {
                          const subField = fieldUsers.filter((f) => f.reports_to_id === se.id);
                          return (
                            <div key={se.id} className="hierarchy-se-sub-card">
                              <div
                                className="hierarchy-node-card se"
                                onClick={() => onSelectUserToEdit(se)}
                              >
                                <strong>{se.name}</strong>
                                <span>SE &bull; {se.region}</span>
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
