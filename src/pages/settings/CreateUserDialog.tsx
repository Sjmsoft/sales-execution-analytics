import { useState, useEffect, useMemo } from "react";
import {
  X,
  Upload,
  UserPlus,
  AlertTriangle,
  MapPin,
  CheckCircle2,
  GitBranch,
} from "lucide-react";
import {
  SYSTEM_ROLES,
  AVAILABLE_REGIONS,
  getEligibleManagers,
  type RoleKey,
  type UserAccount,
} from "../../services/userManagementService";
import { getRegions, type RegionItem } from "../../services/regionService";

type CreateUserDialogProps = {
  allUsers: UserAccount[];
  onCreate: (newUser: UserAccount, tempPassword?: string) => Promise<void> | void;
  onClose: () => void;
};

export function CreateUserDialog({
  allUsers,
  onCreate,
  onClose,
}: CreateUserDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roleKey, setRoleKey] = useState<RoleKey>("brand_ambassador");
  const [assignedRegions, setAssignedRegions] = useState<string[]>(["Lagos Island"]);
  const [reportsToId, setReportsToId] = useState<string>("");
  const [team, setTeam] = useState("");
  const [tempPassword, setTempPassword] = useState("Penedge2026!");
  const [isActive, setIsActive] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [creating, setCreating] = useState(false);
  const [configuredRegions, setConfiguredRegions] = useState<RegionItem[]>([]);

  useEffect(() => {
    void getRegions().then(setConfiguredRegions).catch(console.error);
  }, []);

  const regionOptions = useMemo(() => {
    const active = configuredRegions.filter((r) => r.is_active !== false).map((r) => r.name);
    if (active.length > 0) return active.sort();
    return AVAILABLE_REGIONS;
  }, [configuredRegions]);

  const primaryRegion = assignedRegions[0] || "Lagos Island";
  const eligibleManagers = getEligibleManagers(roleKey, primaryRegion, allUsers);
  const selectedRoleDef = SYSTEM_ROLES.find((r) => r.key === roleKey);

  const isNationalRole = roleKey === "administrator" || roleKey === "national_sales_manager" || roleKey === "hr";

  function toggleRegion(r: string) {
    if (isNationalRole) return;
    if (assignedRegions.includes(r)) {
      if (assignedRegions.length > 1) {
        setAssignedRegions(assignedRegions.filter((x) => x !== r));
      }
    } else {
      setAssignedRegions([...assignedRegions, r]);
    }
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setAvatarUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    if (!name.trim()) {
      setErrorMsg("Full Name is required.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("A valid Email Address is required.");
      return;
    }
    if (!tempPassword.trim()) {
      setErrorMsg("Temporary password is required.");
      return;
    }

    // Role-specific check
    if (roleKey === "brand_ambassador") {
      if (!reportsToId) {
        setErrorMsg("Brand Ambassador must be assigned to a Sales Executive (SE) or Regional Sales Manager (RSM) before creating.");
        return;
      }
      const manager = allUsers.find((u) => u.id === reportsToId);
      if (!manager || (manager.role_key !== "sales_executive" && manager.role_key !== "regional_sales_manager")) {
        setErrorMsg("Selected manager must be a Sales Executive or Regional Sales Manager.");
        return;
      }
    }

    setCreating(true);

    const newId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `b0000000-0000-4000-8000-${Date.now().toString(16).padStart(12, "0").slice(-12)}`;

    const newUser: UserAccount = {
      id: newId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      role_key: roleKey,
      region: isNationalRole ? "National" : primaryRegion,
      assigned_regions: isNationalRole ? [] : assignedRegions,
      reports_to_id: roleKey === "administrator" ? null : reportsToId || null,
      team: team.trim() || "Field Operations",
      is_active: isActive,
      avatar_url: avatarUrl,
      created_at: new Date().toISOString(),
    };

    try {
      await onCreate(newUser, tempPassword.trim());
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to save user to Supabase.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="new-sale-backdrop" role="presentation">
      <section
        className="user-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-user-title"
      >
        {/* Header */}
        <header className="user-modal-header">
          <div>
            <h3 id="create-user-title">+ Create New User</h3>
            <p>Add a new user to the system. Fields marked with * are required.</p>
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

        <form onSubmit={handleSubmit} className="user-modal-body">
          {/* Profile Photo */}
          <div className="user-form-section">
            <label className="user-field-label">Profile Photo</label>
            <div className="user-photo-row">
              <div
                className="user-avatar-circle"
                style={{
                  background: avatarUrl ? "transparent" : "#e5eee9",
                  color: "#075544",
                  border: "1.5px dashed #a3c4b6",
                }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Uploaded" className="user-avatar-img" />
                ) : (
                  <Upload size={20} />
                )}
              </div>
              <div>
                <label className="user-upload-btn">
                  <Upload size={14} />
                  <span>Upload photo</span>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/gif, image/webp"
                    onChange={handlePhotoUpload}
                    style={{ display: "none" }}
                  />
                </label>
                <p className="user-field-hint">JPG, PNG, GIF or WebP. Max 5MB.</p>
              </div>
            </div>
          </div>

          {/* Basic Information */}
          <div className="user-form-section">
            <strong className="user-section-title">Basic Information</strong>

            <div className="user-input-group">
              <label htmlFor="create-name-input" className="user-field-label">
                Full Name *
              </label>
              <input
                id="create-name-input"
                type="text"
                required
                className="user-modal-input"
                placeholder="e.g., John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="user-input-group">
              <label htmlFor="create-email-input" className="user-field-label">
                Email Address *
              </label>
              <input
                id="create-email-input"
                type="email"
                required
                className="user-modal-input"
                placeholder="e.g., john@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="user-input-group">
              <label htmlFor="create-phone-input" className="user-field-label">
                Phone Number
              </label>
              <input
                id="create-phone-input"
                type="tel"
                className="user-modal-input"
                placeholder="e.g., +234 801 234 5678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          {/* User Role */}
          <div className="user-form-section">
            <label htmlFor="create-role-select" className="user-field-label">
              User Role *
            </label>
            <div className="user-select-wrap">
              <select
                id="create-role-select"
                className="user-modal-select"
                value={roleKey}
                onChange={(e) => {
                  const newRole = e.target.value as RoleKey;
                  setRoleKey(newRole);
                  setReportsToId("");
                }}
              >
                {SYSTEM_ROLES.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Role Permissions Preview */}
          {selectedRoleDef && (
            <div className="user-permissions-preview-card">
              <span>Permissions for {selectedRoleDef.shortName}:</span>
              <div className="user-permission-tags">
                {selectedRoleDef.permissions.map((perm) => (
                  <span key={perm} className="user-permission-tag">
                    <CheckCircle2 size={12} />
                    {perm.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Preview reporting chain before save card (Image 4) */}
          <div className="user-reporting-chain-preview-card">
            <div className="user-chain-header">
              <GitBranch size={16} />
              <strong>Preview reporting chain before save</strong>
            </div>
            <p>
              {roleKey === "brand_ambassador"
                ? "This role must connect to a Regional Sales Manager or Sales Executive before the user can be created."
                : roleKey === "vsr"
                ? "Van Sales Reps must be assigned to a Sales Executive or Regional Sales Manager in their region."
                : roleKey === "sales_executive"
                ? "Sales Executives report to a Regional Sales Manager (RSM) or National Sales Manager (NSM)."
                : roleKey === "regional_sales_manager"
                ? "Regional Sales Managers report directly to the National Sales Manager (NSM)."
                : roleKey === "administrator"
                ? "Administrator sits outside the sales hierarchy and requires no reporting manager."
                : "Corporate oversight role. Reports to Administrator."}
            </p>
          </div>

          {/* Assigned Regions */}
          {roleKey !== "administrator" && (
            <div className="user-form-section">
              <label className="user-field-label">Regions *</label>
              <div className="user-region-chips-grid">
                {regionOptions.map((r) => {
                  const isSelected = assignedRegions.includes(r);
                  return (
                    <button
                      type="button"
                      key={r}
                      className={`user-region-chip ${isSelected ? "selected" : ""}`}
                      onClick={() => toggleRegion(r)}
                    >
                      <MapPin size={13} className="user-region-chip-icon" />
                      <span>{r}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Assignment: Reports To & Team */}
          {roleKey !== "administrator" && (
            <div className="user-form-section">
              <strong className="user-section-title">Assignment</strong>

              <div className="user-input-group">
                <label htmlFor="create-reports-to" className="user-field-label">
                  Reports To {roleKey === "brand_ambassador" ? "*" : ""}
                </label>
                <div className="user-select-wrap">
                  <select
                    id="create-reports-to"
                    className="user-modal-select"
                    value={reportsToId}
                    onChange={(e) => setReportsToId(e.target.value)}
                  >
                    <option value="">-- Select Reporting Manager --</option>
                    {eligibleManagers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({SYSTEM_ROLES.find((r) => r.key === m.role_key)?.shortName} &bull; {m.region})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="user-input-group">
                <label htmlFor="create-team-input" className="user-field-label">
                  Team
                </label>
                <input
                  id="create-team-input"
                  type="text"
                  className="user-modal-input"
                  placeholder="e.g., Team Alpha"
                  value={team}
                  onChange={(e) => setTeam(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Initial password */}
          <div className="user-form-section">
            <strong className="user-section-title">Initial password</strong>
            <div className="user-input-group">
              <label htmlFor="create-password-input" className="user-field-label">
                Temporary password *
              </label>
              <input
                id="create-password-input"
                type="text"
                required
                className="user-modal-input"
                placeholder="Enter temporary password"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
              />
              <p className="user-field-hint">
                Share this temporary password with the new user and ask them to change it after first sign-in.
              </p>
            </div>
          </div>

          {/* Account Status Switch */}
          <div className="user-status-switch-row">
            <div>
              <strong className="user-status-switch-title">Account Status</strong>
              <p className="user-field-hint" style={{ margin: 0 }}>
                Set account as active or inactive
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isActive}
              onClick={() => setIsActive(!isActive)}
              className={`user-toggle-switch ${isActive ? "active" : ""}`}
            >
              <span className="user-toggle-switch-thumb" />
            </button>
          </div>

          {errorMsg && (
            <div className="user-hierarchy-error-banner" role="alert">
              <AlertTriangle size={17} className="user-hierarchy-error-icon" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="user-modal-footer">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={creating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={creating}
            >
              <UserPlus size={15} />
              <span>{creating ? "Saving to Supabase..." : "Create User"}</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
