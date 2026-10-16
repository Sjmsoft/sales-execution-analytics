import { useEffect, useState } from "react";
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import {
  type OutletTypeItem,
  getOutletTypes,
  deleteOutletType,
} from "../../services/outletTypeService";
import { OutletTypeDialog } from "./OutletTypeDialog";
import LogoLoader from "../../components/brand/LogoLoader";
import { useMinimumLoading } from "../../hooks/useMinimumLoading";

export function OutletTypesSection() {
  const [outletTypes, setOutletTypes] = useState<OutletTypeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const visibleLoading = useMinimumLoading(loading, 600);
  const [notification, setNotification] = useState("");
  const [error, setError] = useState("");

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<OutletTypeItem | null>(null);

  // Delete Confirm State
  const [deletingType, setDeletingType] = useState<OutletTypeItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const data = await getOutletTypes();
      setOutletTypes(data);
    } catch (e: any) {
      setError(e?.message || "Failed to load outlet types.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  function handleOpenCreate() {
    setEditingType(null);
    setDialogOpen(true);
  }

  function handleOpenEdit(item: OutletTypeItem, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingType(item);
    setDialogOpen(true);
  }

  function handleOpenDelete(item: OutletTypeItem, e: React.MouseEvent) {
    e.stopPropagation();
    setDeletingType(item);
  }

  async function confirmDelete() {
    if (!deletingType) return;
    setDeleteLoading(true);

    const res = await deleteOutletType(deletingType.id);
    setDeleteLoading(false);

    if (res.success) {
      setOutletTypes((prev) => prev.filter((t) => t.id !== deletingType.id));
      setNotification(`Outlet type "${deletingType.name}" deleted successfully.`);
      setDeletingType(null);
      setTimeout(() => setNotification(""), 4000);
    } else {
      setError(res.message || "Failed to delete outlet type.");
    }
  }

  function handleSaveSuccess(saved: OutletTypeItem) {
    setOutletTypes((prev) => {
      const idx = prev.findIndex((t) => t.id === saved.id || t.key === saved.key);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = saved;
        return updated;
      }
      return [...prev, saved];
    });
    setNotification(
      `Outlet type "${saved.name}" ${editingType ? "updated" : "created"} successfully.`
    );
    setTimeout(() => setNotification(""), 4000);
  }

  return (
    <div className="settings-section-card" style={{ padding: "1.75rem" }}>
      {/* Header Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "1.5rem",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              backgroundColor: "rgba(7, 85, 68, 0.08)",
              color: "#075544",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginTop: "2px",
            }}
          >
            <Building2 size={22} />
          </div>
          <div>
            <h3
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "#0f172a",
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              Outlet Types
            </h3>
            <p
              style={{
                fontSize: "0.875rem",
                color: "#64748b",
                margin: "4px 0 0 0",
              }}
            >
              Manage outlet types used for categorizing stores and establishments.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          style={{
            padding: "0.625rem 1.25rem",
            backgroundColor: "#075544",
            color: "#ffffff",
            borderRadius: "8px",
            border: "none",
            fontWeight: 600,
            fontSize: "0.875rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            boxShadow: "0 1px 2px rgba(7, 85, 68, 0.2)",
            whiteSpace: "nowrap",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#054033")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#075544")}
        >
          <Plus size={16} />
          Add Type
        </button>
      </div>

      {/* Notifications */}
      {notification && (
        <div
          style={{
            padding: "0.75rem 1rem",
            backgroundColor: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "8px",
            color: "#166534",
            fontSize: "0.875rem",
            marginBottom: "1.25rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
          <span>{notification}</span>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "0.75rem 1rem",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "8px",
            color: "#991b1b",
            fontSize: "0.875rem",
            marginBottom: "1.25rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Table Container */}
      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          overflow: "hidden",
          backgroundColor: "#ffffff",
        }}
      >
        {visibleLoading ? (
          <LogoLoader variant="section" message="Loading outlet types" hint="Fetching store classifications" />
        ) : outletTypes.length === 0 ? (
          <div
            style={{
              padding: "3rem",
              textAlign: "center",
              color: "#64748b",
            }}
          >
            <Building2 size={36} style={{ margin: "0 auto 0.75rem", color: "#94a3b8" }} />
            <p style={{ margin: 0, fontWeight: 600 }}>No outlet types found.</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "0.875rem" }}>
              Click "+ Add Type" above to create your first outlet type classification.
            </p>
          </div>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
              fontSize: "0.875rem",
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid #e2e8f0",
                  backgroundColor: "#f8fafc",
                }}
              >
                <th style={{ padding: "0.875rem 1.25rem", color: "#475569", fontWeight: 600, width: "60px" }}>
                  #
                </th>
                <th style={{ padding: "0.875rem 1.25rem", color: "#475569", fontWeight: 600 }}>
                  Type Name
                </th>
                <th style={{ padding: "0.875rem 1.25rem", color: "#475569", fontWeight: 600 }}>
                  Key
                </th>
                <th style={{ padding: "0.875rem 1.25rem", color: "#475569", fontWeight: 600 }}>
                  Description
                </th>
                <th style={{ padding: "0.875rem 1.25rem", color: "#475569", fontWeight: 600, width: "80px" }}>
                  Color
                </th>
                <th style={{ padding: "0.875rem 1.25rem", color: "#475569", fontWeight: 600, width: "100px" }}>
                  Status
                </th>
                <th style={{ padding: "0.875rem 1.25rem", color: "#475569", fontWeight: 600, textAlign: "right", width: "100px" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {outletTypes.map((item, index) => (
                <tr
                  key={item.id}
                  style={{
                    borderBottom: index < outletTypes.length - 1 ? "1px solid #f1f5f9" : "none",
                    transition: "background-color 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ffffff")}
                >
                  {/* # */}
                  <td style={{ padding: "1rem 1.25rem", color: "#94a3b8" }}>
                    {index + 1}
                  </td>

                  {/* Type Name */}
                  <td style={{ padding: "1rem 1.25rem", fontWeight: 700, color: "#0f172a" }}>
                    {item.name}
                  </td>

                  {/* Key */}
                  <td style={{ padding: "1rem 1.25rem" }}>
                    <span
                      style={{
                        fontFamily: "monospace",
                        backgroundColor: "#f1f5f9",
                        padding: "0.2rem 0.5rem",
                        borderRadius: "4px",
                        color: "#475569",
                        fontSize: "0.8125rem",
                      }}
                    >
                      {item.key}
                    </span>
                  </td>

                  {/* Description */}
                  <td style={{ padding: "1rem 1.25rem", color: "#64748b" }}>
                    {item.description || "—"}
                  </td>

                  {/* Color */}
                  <td style={{ padding: "1rem 1.25rem" }}>
                    <div
                      style={{
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        backgroundColor: item.color || "#075544",
                        border: "1px solid rgba(0,0,0,0.1)",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                      }}
                      title={item.color}
                    />
                  </td>

                  {/* Status */}
                  <td style={{ padding: "1rem 1.25rem" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "0.25rem 0.625rem",
                        borderRadius: "9999px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        backgroundColor: item.is_active ? "#075544" : "#f1f5f9",
                        color: item.is_active ? "#ffffff" : "#64748b",
                      }}
                    >
                      {item.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>

                  {/* Actions */}
                  <td style={{ padding: "1rem 1.25rem", textAlign: "right" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.375rem" }}>
                      <button
                        type="button"
                        onClick={(e) => handleOpenEdit(item, e)}
                        title="Edit outlet type"
                        style={{
                          background: "none",
                          border: "none",
                          color: "#475569",
                          cursor: "pointer",
                          padding: "6px",
                          borderRadius: "6px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = "#075544";
                          e.currentTarget.style.backgroundColor = "rgba(7, 85, 68, 0.08)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = "#475569";
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleOpenDelete(item, e)}
                        title="Delete outlet type"
                        style={{
                          background: "none",
                          border: "none",
                          color: "#94a3b8",
                          cursor: "pointer",
                          padding: "6px",
                          borderRadius: "6px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = "#ef4444";
                          e.currentTarget.style.backgroundColor = "#fef2f2";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = "#94a3b8";
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Dialog */}
      <OutletTypeDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaveSuccess={handleSaveSuccess}
        outletType={editingType}
        totalCount={outletTypes.length}
      />

      {/* Delete Confirmation Modal */}
      {deletingType && (
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
          onClick={() => setDeletingType(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "420px",
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              padding: "1.5rem",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
              border: "1px solid #e2e8f0",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                backgroundColor: "#fef2f2",
                color: "#ef4444",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "1rem",
              }}
            >
              <AlertTriangle size={24} />
            </div>

            <h4 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.5rem 0" }}>
              Delete Outlet Type?
            </h4>
            <p style={{ fontSize: "0.875rem", color: "#64748b", margin: "0 0 1.5rem 0", lineHeight: 1.5 }}>
              Are you sure you want to delete <strong>"{deletingType.name}"</strong>? This will remove this classification from the system settings.
            </p>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={() => setDeletingType(null)}
                disabled={deleteLoading}
                style={{
                  padding: "0.625rem 1.25rem",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  color: "#334155",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteLoading}
                style={{
                  padding: "0.625rem 1.25rem",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: "#ef4444",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                {deleteLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete Type"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
