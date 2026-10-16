import { useState } from "react";
import { X, MapPin, Check, Loader2, AlertCircle, Save } from "lucide-react";
import { type RegionItem, saveRegion } from "../../services/regionService";

type RegionDialogProps = {
  region?: RegionItem | null;
  onSave: (savedRegion: RegionItem) => void;
  onClose: () => void;
};

export function RegionDialog({ region, onSave, onClose }: RegionDialogProps) {
  const isEditing = Boolean(region);

  const [name, setName] = useState(region?.name || "");
  const [code, setCode] = useState(region?.code || "");
  const [state, setState] = useState(region?.state || "");
  const [description, setDescription] = useState(region?.description || "");
  const [isActive, setIsActive] = useState(region?.is_active ?? true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Handle auto-generating short region code if empty
  function handleNameChange(val: string) {
    setName(val);
    if (!isEditing && !code) {
      const parts = val.trim().split(/[\s-]+/);
      let autoCode = "";
      if (parts.length >= 2) {
        autoCode = (parts[0][0] + "." + parts[1][0]).toUpperCase();
      } else if (parts[0].length >= 3) {
        autoCode = parts[0].substring(0, 3).toUpperCase();
      } else {
        autoCode = parts[0].toUpperCase();
      }
      setCode(autoCode);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Region Name is required.");
      return;
    }
    if (!code.trim()) {
      setError("Region Code is required.");
      return;
    }

    setSubmitting(true);
    setError("");

    const payload: RegionItem = {
      id: region?.id || `reg-${Date.now()}`,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      state: state.trim() || "N/A",
      description: description.trim() || "-",
      is_active: isActive,
    };

    const res = await saveRegion(payload);
    setSubmitting(false);

    if (res.success) {
      onSave(res.region);
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
        aria-labelledby="region-dialog-title"
        style={{ maxWidth: "480px", width: "100%", borderRadius: "16px", background: "#f8faf9" }}
      >
        <header className="user-modal-header" style={{ padding: "18px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <h3 id="region-dialog-title" style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "#111827", display: "flex", alignItems: "center", gap: "8px" }}>
              <MapPin size={20} style={{ color: "#075544" }} />
              {isEditing ? "Edit Region" : "Add New Region"}
            </h3>
            <p style={{ margin: "3px 0 0 0", fontSize: "0.83rem", color: "#6b7280" }}>
              {isEditing ? "Update sales region and territory details" : "Add a new region to the system"}
            </p>
          </div>
          <button type="button" className="user-modal-close" onClick={onClose} aria-label="Close dialog" style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: "4px" }}>
            <X size={18} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="user-modal-body" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", padding: "10px 14px", borderRadius: "8px", fontSize: "0.85rem" }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Region Name * */}
          <div className="settings-field">
            <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#374151", marginBottom: "4px", display: "block" }}>
              Region Name *
            </label>
            <input
              type="text"
              placeholder="e.g., Lagos Mainland"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
              style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #d1d5db", background: "#ffffff", fontSize: "0.9rem", outline: "none" }}
            />
          </div>

          {/* Region Code * */}
          <div className="settings-field">
            <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#374151", marginBottom: "4px", display: "block" }}>
              Region Code *
            </label>
            <input
              type="text"
              placeholder="e.g., LM"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #d1d5db", background: "#ffffff", fontSize: "0.9rem", outline: "none", fontFamily: "monospace" }}
            />
          </div>

          {/* State */}
          <div className="settings-field">
            <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#374151", marginBottom: "4px", display: "block" }}>
              State
            </label>
            <input
              type="text"
              placeholder="e.g., Lagos"
              value={state}
              onChange={(e) => setState(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #d1d5db", background: "#ffffff", fontSize: "0.9rem", outline: "none" }}
            />
          </div>

          {/* Description */}
          <div className="settings-field">
            <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#374151", marginBottom: "4px", display: "block" }}>
              Description
            </label>
            <textarea
              rows={3}
              placeholder="Brief description of the region"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #d1d5db", background: "#ffffff", fontSize: "0.85rem", resize: "none", outline: "none" }}
            />
          </div>

          {/* Active Switch Toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" }}>
            <button
              type="button"
              role="switch"
              aria-checked={isActive}
              onClick={() => setIsActive(!isActive)}
              style={{
                width: "44px",
                height: "24px",
                borderRadius: "12px",
                background: isActive ? "#075544" : "#cbd5e1",
                border: "none",
                cursor: "pointer",
                position: "relative",
                transition: "background 0.2s ease",
                padding: "2px",
              }}
            >
              <span
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  background: "#ffffff",
                  display: "block",
                  transform: isActive ? "translateX(20px)" : "translateX(0)",
                  transition: "transform 0.2s ease",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }}
              />
            </button>
            <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "#111827" }}>Active</span>
          </div>

          {/* Footer Buttons */}
          <footer style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px", marginTop: "12px", paddingTop: "14px", borderTop: "1px solid #e2e8f0" }}>
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={submitting}
              style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #d1d5db", background: "#ffffff", color: "#374151", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer" }}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="primary-button"
              disabled={submitting}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 18px", borderRadius: "8px", border: "none", background: "#075544", color: "#ffffff", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer" }}
            >
              {submitting ? (
                <>
                  <Loader2 size={15} className="spin" /> Saving...
                </>
              ) : (
                <>
                  {isEditing ? <Check size={15} /> : <Save size={15} />}
                  <span>{isEditing ? "Save Changes" : "Create"}</span>
                </>
              )}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
