import { useState, useEffect } from "react";
import { X, Loader2, AlertCircle } from "lucide-react";
import {
  type OutletTypeItem,
  saveOutletType,
} from "../../services/outletTypeService";

type OutletTypeDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: (saved: OutletTypeItem) => void;
  outletType?: OutletTypeItem | null;
  totalCount?: number;
};

const PRESET_COLORS = [
  "#E91E63", // Pink
  "#7C3AED", // Purple
  "#D946EF", // Magenta
  "#EC4899", // Soft Pink
  "#075544", // Deep Green
  "#0284C7", // Sky Blue
  "#EA580C", // Amber/Orange
  "#4F46E5", // Indigo
];

export function OutletTypeDialog({
  isOpen,
  onClose,
  onSaveSuccess,
  outletType,
  totalCount = 0,
}: OutletTypeDialogProps) {
  const isEditing = Boolean(outletType);

  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#E91E63");
  const [sortOrder, setSortOrder] = useState<number>(totalCount + 1);
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (outletType) {
        setName(outletType.name);
        setKey(outletType.key);
        setDescription(outletType.description || "");
        setColor(outletType.color || "#E91E63");
        setSortOrder(outletType.sort_order ?? totalCount + 1);
        setIsActive(outletType.is_active ?? true);
      } else {
        setName("");
        setKey("");
        setDescription("");
        setColor("#E91E63");
        setSortOrder(totalCount + 1);
        setIsActive(true);
      }
      setError("");
    }
  }, [isOpen, outletType, totalCount]);

  // Auto-generate key when typing name in create mode
  function handleNameChange(val: string) {
    setName(val);
    if (!isEditing) {
      const generatedKey = val
        .toLowerCase()
        .replace(/[^a-z0-9\s_-]/g, "")
        .trim()
        .replace(/[\s-]+/g, "_");
      setKey(generatedKey);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Outlet type name is required.");
      return;
    }
    if (!key.trim()) {
      setError("Outlet type key is required.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await saveOutletType({
        id: outletType?.id,
        name: name.trim(),
        key: key.trim().toLowerCase().replace(/\s+/g, "_"),
        description: description.trim(),
        color,
        sort_order: Number(sortOrder) || totalCount + 1,
        is_active: isActive,
        created_at: outletType?.created_at,
      });

      if (result.success && result.data) {
        onSaveSuccess(result.data);
        onClose();
      } else {
        setError(result.message || "Failed to save outlet type.");
      }
    } catch (err: any) {
      setError(err?.message || "An error occurred while saving.");
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
        backgroundColor: "rgba(15, 23, 42, 0.5)",
        backdropFilter: "blur(4px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
          overflow: "hidden",
          border: "1px solid #e2e8f0",
          animation: "modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "1.25rem 1.5rem",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            borderBottom: "1px solid #f1f5f9",
          }}
        >
          <div>
            <h3
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "#0f172a",
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              {isEditing ? "Edit Outlet Type" : "Add Outlet Type"}
            </h3>
            <p
              style={{
                fontSize: "0.875rem",
                color: "#64748b",
                margin: "4px 0 0 0",
              }}
            >
              Create a new outlet type for categorizing stores.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
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
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#0f172a";
              e.currentTarget.style.backgroundColor = "#f1f5f9";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#94a3b8";
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div
            style={{
              padding: "1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
              maxHeight: "75vh",
              overflowY: "auto",
            }}
          >
            {error && (
              <div
                style={{
                  padding: "0.75rem 1rem",
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "8px",
                  color: "#991b1b",
                  fontSize: "0.875rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Name */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "#1e293b",
                  marginBottom: "0.375rem",
                }}
              >
                Name <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., Bar, Restaurant, Hotel"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.625rem 0.875rem",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.9375rem",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Key */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "#1e293b",
                  marginBottom: "0.375rem",
                }}
              >
                Key <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., bar, restaurant, hotel"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.625rem 0.875rem",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.9375rem",
                  outline: "none",
                  fontFamily: "monospace",
                  boxSizing: "border-box",
                }}
              />
              <span
                style={{
                  display: "block",
                  fontSize: "0.75rem",
                  color: "#64748b",
                  marginTop: "0.25rem",
                }}
              >
                Unique identifier (lowercase, no spaces)
              </span>
            </div>

            {/* Description */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "#1e293b",
                  marginBottom: "0.375rem",
                }}
              >
                Description
              </label>
              <textarea
                rows={3}
                placeholder="Brief description of this outlet type"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.625rem 0.875rem",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.9375rem",
                  outline: "none",
                  resize: "vertical",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
              />
            </div>

            {/* Color & Sort Order side by side */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              {/* Color */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: "#1e293b",
                    marginBottom: "0.375rem",
                  }}
                >
                  Color
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      backgroundColor: color,
                      border: "1px solid #cbd5e1",
                      flexShrink: 0,
                      boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                    }}
                  />
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.625rem",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.875rem",
                      fontFamily: "monospace",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                {/* Preset color swatches */}
                <div style={{ display: "flex", gap: "4px", marginTop: "6px" }}>
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        backgroundColor: c,
                        border: color === c ? "2px solid #0f172a" : "1px solid rgba(0,0,0,0.1)",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Sort Order */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: "#1e293b",
                    marginBottom: "0.375rem",
                  }}
                >
                  Sort Order
                </label>
                <input
                  type="number"
                  min={1}
                  value={sortOrder}
                  onChange={(e) => setSortOrder(parseInt(e.target.value) || 1)}
                  style={{
                    width: "100%",
                    padding: "0.625rem 0.875rem",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.9375rem",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            {/* Active Toggle Switch */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: "0.5rem",
              }}
            >
              <span
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  color: "#1e293b",
                }}
              >
                Active
              </span>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                style={{
                  width: "44px",
                  height: "24px",
                  borderRadius: "12px",
                  backgroundColor: isActive ? "#075544" : "#cbd5e1",
                  border: "none",
                  cursor: "pointer",
                  position: "relative",
                  transition: "background-color 0.2s ease",
                  padding: 0,
                }}
              >
                <div
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    backgroundColor: "#ffffff",
                    position: "absolute",
                    top: "2px",
                    left: isActive ? "22px" : "2px",
                    transition: "left 0.2s ease",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }}
                />
              </button>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "1rem 1.5rem",
              backgroundColor: "#f8fafc",
              borderTop: "1px solid #f1f5f9",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "0.75rem",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: "0.625rem 1.25rem",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                backgroundColor: "#ffffff",
                color: "#334155",
                fontWeight: 600,
                fontSize: "0.875rem",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f1f5f9")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ffffff")}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "0.625rem 1.5rem",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "#075544",
                color: "#ffffff",
                fontWeight: 600,
                fontSize: "0.875rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                transition: "all 0.15s ease",
                boxShadow: "0 1px 2px rgba(7, 85, 68, 0.2)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#054033")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#075544")}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Saving...
                </>
              ) : isEditing ? (
                "Save Changes"
              ) : (
                "Create"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
