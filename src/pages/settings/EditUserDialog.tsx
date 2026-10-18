import { useState, useEffect, useMemo } from "react";
import {
  X,
  Upload,
  Save,
  AlertTriangle,
  MapPin,
  Shield,
  Key,
} from "lucide-react";
import {
  SYSTEM_ROLES,
  AVAILABLE_REGIONS,
  validateUserHierarchy,
  getEligibleManagers,
  type RoleKey,
  type UserAccount,
} from "../../services/userManagementService";
import { getRegions, type RegionItem } from "../../services/regionService";
import { ResetPasswordDialog } from "./ResetPasswordDialog";
import { compressImageToDataUrl } from "../../utils/imageCompression";

type EditUserDialogProps = {
  user: UserAccount;
  allUsers: UserAccount[];
  onSave: (updatedUser: UserAccount) => Promise<void> | void;
  onClose: () => void;
};

export function EditUserDialog({
  user,
  allUsers,
  onSave,
  onClose,
}: EditUserDialogProps) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [roleKey, setRoleKey] = useState<RoleKey>(user.role_key);
  const [assignedRegions, setAssignedRegions] = useState<string[]>(
    user.assigned_regions?.length ? user.assigned_regions : user.region ? [user.region] : ["Lagos Island"]
  );
  const [reportsToId, setReportsToId] = useState<string>(user.reports_to_id || "");
  const [team, setTeam] = useState(user.team || "");
  const [isActive, setIsActive] = useState(user.is_active);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatar_url || null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showResetModal, setShowResetModal] = useState(false);
  const [configuredRegions, setConfiguredRegions] = useState<RegionItem[]>([]);

  useEffect(() => {
    void getRegions().then(setConfiguredRegions).catch(console.error);
  }, []);

  const regionOptions = useMemo(() => {
    const active = configuredRegions.filter((r) => r.is_active !== false).map((r) => r.name);
    if (active.length > 0) return active.sort();
    return AVAILABLE_REGIONS;
  }, [configuredRegions]);

  const isNationalRole = roleKey === "administrator" || roleKey === "national_sales_manager" || roleKey === "hr";

  // Region toggling
  function toggleRegion(r: string) {
    if (isNationalRole) return; // National roles should not have regional lock
    if (assignedRegions.includes(r)) {
      if (assignedRegions.length > 1) {
        setAssignedRegions(assignedRegions.filter((x) => x !== r));
      }
    } else {
      setAssignedRegions([...assignedRegions, r]);
    }
  }

  // Primary region is first assigned region
  const primaryRegion = assignedRegions[0] || "Lagos Island";

  // Build draft user to run live validation
  const draftUser: UserAccount = {
    ...user,
    name,
    phone,
    role_key: roleKey,
    region: isNationalRole ? "National" : primaryRegion,
    assigned_regions: isNationalRole ? [] : assignedRegions,
    reports_to_id: roleKey === "administrator" ? null : reportsToId || null,
    team,
    is_active: isActive,
    avatar_url: avatarUrl,
  };

  const hierarchyCheck = validateUserHierarchy(draftUser, allUsers);
  const eligibleManagers = getEligibleManagers(roleKey, primaryRegion, allUsers, user.id);
  const selectedRoleDef = SYSTEM_ROLES.find((r) => r.key === roleKey);

  // Handle Photo upload simulation with client compression
  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const { dataUrl } = await compressImageToDataUrl(file, {
          maxWidth: 400,
          maxHeight: 400,
          quality: 0.8,
        });
        setAvatarUrl(dataUrl);
      } catch (err) {
        console.warn("Avatar compression notice, fallback to reader:", err);
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") {
            setAvatarUrl(reader.result);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError("");
    try {
      await onSave(draftUser);
    } catch (err: any) {
      setSaveError(err?.message || "Failed to save changes to Supabase.");
    } finally {
      setSaving(false);
    }
  }

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="new-sale-backdrop" role="presentation">
      <section
        className="user-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-user-title"
      >
        {/* Header */}
        <header className="user-modal-header">
          <div>
            <h3 id="edit-user-title">Edit User</h3>
            <p>Update role, region assignment, and reporting structure for {user.name}</p>
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

        <form onSubmit={handleFormSubmit} className="user-modal-body">
          {/* Identity card */}
          <div className="user-identity-card">
            <div className="user-avatar-circle" style={{ background: selectedRoleDef?.color || "#075544" }}>
              {avatarUrl ? <img src={avatarUrl} alt={user.name} className="user-avatar-img" /> : initials}
            </div>
            <div>
              <strong className="user-identity-name">{user.name}</strong>
              <span className="user-identity-email">{user.email}</span>
            </div>
          </div>

          {/* Profile Photo */}
          <div className="user-form-section">
            <label className="user-field-label">Profile Photo</label>
            <div className="user-photo-row">
              <div
                className="user-avatar-circle small"
                style={{ background: selectedRoleDef?.color || "#075544" }}
              >
                {avatarUrl ? <img src={avatarUrl} alt={user.name} className="user-avatar-img" /> : initials}
              </div>
              <div>
                <label className="user-upload-btn">
                  <Upload size={14} />
                  <span>Change photo</span>
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

          {/* Full Name */}
          <div className="user-form-section">
            <label htmlFor="edit-name-input" className="user-field-label">
              Full Name
            </label>
            <input
              id="edit-name-input"
              type="text"
              className="user-modal-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* User Role */}
          <div className="user-form-section">
            <label htmlFor="edit-role-select" className="user-field-label">
              User Role
            </label>
            <div className="user-select-wrap">
              <select
                id="edit-role-select"
                className="user-modal-select"
                value={roleKey}
                onChange={(e) => {
                  const newRole = e.target.value as RoleKey;
                  setRoleKey(newRole);
                  if (newRole === "administrator") {
                    setReportsToId("");
                    setAssignedRegions([]);
                  }
                }}
              >
                {SYSTEM_ROLES.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="user-field-hint" style={{ marginTop: 4 }}>
              {selectedRoleDef?.description}
            </p>
          </div>

          {/* Assigned Regions */}
          {roleKey !== "administrator" ? (
            <div className="user-form-section">
              <label className="user-field-label">Assigned Regions</label>
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
              <p className="user-field-hint">
                Select every region this user can access. Assignments are applied to Outlet Visits and other region-scoped records.
              </p>
            </div>
          ) : (
            <div className="user-hierarchy-info-box note">
              <Shield size={16} />
              <span>
                Administrator has global administrative authority and is not restricted to regional territories.
              </span>
            </div>
          )}

          {/* Reports To (Hierarchy Assignment) */}
          <div className="user-form-section">
            <label htmlFor="edit-reports-to" className="user-field-label">
              Reports To
            </label>

            {roleKey === "administrator" ? (
              <p className="user-field-hint">
                Administrator sits outside the sales reporting hierarchy and does not report to another manager.
              </p>
            ) : (
              <>
                <div className="user-select-wrap">
                  <select
                    id="edit-reports-to"
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

                {roleKey === "brand_ambassador" && (
                  <p className="user-field-hint" style={{ color: "#9d174d", fontWeight: 600, marginTop: 4 }}>
                    Brand Ambassador (BA) must report to a Sales Executive (SE) or Regional Sales Manager (RSM) in their region.
                  </p>
                )}
                {roleKey === "sales_executive" && (
                  <p className="user-field-hint" style={{ marginTop: 4 }}>
                    Sales Executive (SE) reports to a Regional Sales Manager (RSM) or the National Sales Manager (NSM).
                  </p>
                )}
                {roleKey === "regional_sales_manager" && (
                  <p className="user-field-hint" style={{ marginTop: 4 }}>
                    Regional Sales Manager (RSM) reports to the National Sales Manager (NSM).
                  </p>
                )}
              </>
            )}
          </div>

          {/* Hierarchy Rule Warning Box */}
          {hierarchyCheck.isOrphaned && (
            <div className="user-hierarchy-error-banner" role="alert">
              <AlertTriangle size={18} className="user-hierarchy-error-icon" />
              <div>
                <strong>Hierarchy Issue Detected</strong>
                <ul>
                  {hierarchyCheck.issues.map((issue, idx) => (
                    <li key={idx}>{issue}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Team Assignment */}
          <div className="user-form-section">
            <label htmlFor="edit-team-input" className="user-field-label">
              Team / Fleet
            </label>
            <input
              id="edit-team-input"
              type="text"
              className="user-modal-input"
              placeholder="e.g., Island On-Trade Squad"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
            />
          </div>

          {/* Phone Number */}
          <div className="user-form-section">
            <label htmlFor="edit-phone-input" className="user-field-label">
              Phone Number
            </label>
            <input
              id="edit-phone-input"
              type="tel"
              className="user-modal-input"
              placeholder="+234 801 234 5678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          {/* Security & Password Reset Section */}
          <div className="user-form-section" style={{ borderTop: "1px solid #e2e8f0", paddingTop: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <strong className="user-status-switch-title" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <Key size={16} style={{ color: "#075544" }} />
                  Security & Password
                </strong>
                <p className="user-field-hint" style={{ margin: 0 }}>
                  Reset temporary password or send a password reset link to user.
                </p>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowResetModal(true)}
                style={{ fontSize: "0.82rem", gap: "6px" }}
              >
                <Key size={14} />
                Reset Password
              </button>
            </div>
          </div>

          {/* Account Status Switch & Deactivation */}
          <div
            className="user-status-switch-row"
            style={{
              background: isActive ? "#f8fafc" : "#fef2f2",
              border: isActive ? "1px solid #e2e8f0" : "1px solid #fecaca",
              padding: "1rem",
              borderRadius: "8px",
            }}
          >
            <div>
              <strong className="user-status-switch-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                Account Status:
                <span
                  style={{
                    fontSize: "0.8rem",
                    padding: "2px 8px",
                    borderRadius: "12px",
                    background: isActive ? "#dcfce7" : "#fee2e2",
                    color: isActive ? "#15803d" : "#b91c1c",
                    fontWeight: 700,
                  }}
                >
                  {isActive ? "Active Account" : "Deactivated / Inactive"}
                </span>
              </strong>
              <p className="user-field-hint" style={{ margin: "4px 0 0", color: isActive ? "#64748b" : "#991b1b" }}>
                {isActive
                  ? "Deactivating this user prevents them from signing in or recording sales data."
                  : "Account is currently deactivated. Reactivate to restore user sign-in access."}
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

          {saveError && (
            <div className="user-hierarchy-error-banner" role="alert">
              <AlertTriangle size={17} className="user-hierarchy-error-icon" />
              <span>{saveError}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="user-modal-footer">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={saving}
            >
              <Save size={15} />
              <span>{saving ? "Saving to Supabase..." : "Save Changes"}</span>
            </button>
          </div>
        </form>
      </section>

      {showResetModal && (
        <ResetPasswordDialog
          user={user}
          onClose={() => setShowResetModal(false)}
        />
      )}
    </div>
  );
}
