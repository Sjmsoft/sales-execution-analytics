import { useState, useEffect } from "react";
import { X, Loader2, AlertCircle, Save } from "lucide-react";
import {
  type VisitOutcomeItem,
  COLOR_OPTIONS,
  saveVisitOutcome,
} from "../../services/visitOutcomeService";

type VisitOutcomeDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: (saved: VisitOutcomeItem) => void;
  outcome?: VisitOutcomeItem | null;
  totalCount?: number;
};

export function VisitOutcomeDialog({
  isOpen,
  onClose,
  onSaveSuccess,
  outcome,
  totalCount = 0,
}: VisitOutcomeDialogProps) {
  const isEditing = Boolean(outcome);

  const [name, setName] = useState("");
  const [color, setColor] = useState("#10B981");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState<number>(totalCount + 1);
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (outcome) {
        setName(outcome.name);
        setColor(outcome.color || "#10B981");
        setDescription(outcome.description || "");
        setSortOrder(outcome.sort_order ?? totalCount + 1);
        setIsActive(outcome.is_active ?? true);
      } else {
        setName("");
        setColor("#10B981");
        setDescription("");
        setSortOrder(totalCount + 1);
        setIsActive(true);
      }
      setError("");
    }
  }, [isOpen, outcome, totalCount]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Outcome name is required.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const selectedColorObj = COLOR_OPTIONS.find(
        (c) => c.hex.toLowerCase() === color.toLowerCase()
      );
      const result = await saveVisitOutcome({
        id: outcome?.id,
        name: name.trim(),
        color,
        color_name: selectedColorObj?.name || "Green",
        description: description.trim(),
        sort_order: sortOrder,
        is_active: isActive,
        created_at: outcome?.created_at,
      });

      if (!result.success || !result.data) {
        setError(result.message || "Failed to save visit outcome.");
        setLoading(false);
        return;
      }

      onSaveSuccess(result.data);
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.45)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "500px",
          boxShadow:
            "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          overflow: "hidden",
          animation: "modalSlideIn 0.2s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: "1.2rem",
                fontWeight: 700,
                color: "#0f172a",
              }}
            >
              {isEditing ? "Edit Visit Outcome" : "Add Visit Outcome"}
            </h3>
            <p
              style={{
                margin: "4px 0 0 0",
                fontSize: "0.85rem",
                color: "#64748b",
              }}
            >
              {isEditing
                ? "Update visit outcome settings"
                : "Add a new visit outcome to the system"}
            </p>
          </div>
          <button
            onClick={onClose}
            type="button"
            style={{
              background: "none",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              padding: "4px",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div
            style={{
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
          >
            {error && (
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: "8px",
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#991b1b",
                  fontSize: "0.85rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Outcome Name */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "#1e293b",
                  marginBottom: "6px",
                }}
              >
                Outcome Name <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Successful, Pending, Failed"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.9rem",
                  outline: "none",
                  backgroundColor: "#f8fafc",
                  boxSizing: "border-box",
                }}
                required
                autoFocus
              />
            </div>

            {/* Color Swatches matching screenshot 2 */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "#1e293b",
                  marginBottom: "8px",
                }}
              >
                Color
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                {COLOR_OPTIONS.map((c) => {
                  const isSelected = color.toLowerCase() === c.hex.toLowerCase();
                  return (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setColor(c.hex)}
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        backgroundColor: c.hex,
                        border: isSelected
                          ? "3px solid #075544"
                          : "2px solid transparent",
                        boxShadow: isSelected
                          ? "0 0 0 2px rgba(7, 85, 68, 0.2)"
                          : "none",
                        cursor: "pointer",
                        outline: "none",
                        transition: "all 0.15s ease",
                      }}
                      title={c.name}
                    />
                  );
                })}
              </div>
            </div>

            {/* Description */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "#1e293b",
                  marginBottom: "6px",
                }}
              >
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description"
                rows={3}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.9rem",
                  outline: "none",
                  backgroundColor: "#f8fafc",
                  boxSizing: "border-box",
                  resize: "vertical",
                }}
              />
            </div>

            {/* Active switch */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <button
                type="button"
                role="switch"
                aria-checked={isActive}
                onClick={() => setIsActive(!isActive)}
                style={{
                  width: "44px",
                  height: "24px",
                  borderRadius: "12px",
                  backgroundColor: isActive ? "#075544" : "#cbd5e1",
                  border: "none",
                  position: "relative",
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                  padding: 0,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: "2px",
                    left: isActive ? "22px" : "2px",
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    backgroundColor: "#ffffff",
                    transition: "left 0.2s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }}
                />
              </button>
              <span
                style={{
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  color: "#1e293b",
                }}
              >
                Active
              </span>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "16px 24px",
              backgroundColor: "#f8fafc",
              borderTop: "1px solid #f1f5f9",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "12px",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                backgroundColor: "#ffffff",
                color: "#475569",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "8px 20px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "#075544",
                color: "#ffffff",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 2px 4px rgba(7, 85, 68, 0.2)",
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="spin" />
                  <span>Saving…</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>{isEditing ? "Save Changes" : "Create"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
