import { useState, useEffect } from "react";
import {
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  X,
} from "lucide-react";
import {
  type PaymentMethodItem,
  getPaymentMethods,
  deletePaymentMethod,
} from "../../services/paymentMethodService";
import { PaymentMethodDialog } from "./PaymentMethodDialog";
import LogoLoader from "../../components/brand/LogoLoader";
import { useMinimumLoading } from "../../hooks/useMinimumLoading";

export function PaymentMethodsSection() {
  const [methods, setMethods] = useState<PaymentMethodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const visibleLoading = useMinimumLoading(loading, 600);
  const [error, setError] = useState("");

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodItem | null>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<PaymentMethodItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const data = await getPaymentMethods();
      setMethods(data);
    } catch (err: unknown) {
      setError("Failed to load payment methods.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleOpenCreate() {
    setSelectedMethod(null);
    setIsDialogOpen(true);
  }

  function handleOpenEdit(item: PaymentMethodItem) {
    setSelectedMethod(item);
    setIsDialogOpen(true);
  }

  function handleSaveSuccess(saved: PaymentMethodItem) {
    setMethods((prev) => {
      const exists = prev.some((t) => t.id === saved.id);
      if (exists) {
        return prev.map((t) => (t.id === saved.id ? saved : t));
      }
      return [...prev, saved];
    });
    loadData();
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      await deletePaymentMethod(deleteTarget.id);
      setMethods((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: unknown) {
      setError("Failed to delete payment method.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Main Card Header matching user reference screenshot 1 */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          padding: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "20px",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <CreditCard size={22} style={{ color: "#075544" }} />
              <h3
                style={{
                  margin: 0,
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                Payment Methods
              </h3>
            </div>
            <p
              style={{
                margin: "4px 0 0 0",
                fontSize: "0.875rem",
                color: "#64748b",
              }}
            >
              Manage available payment methods for sales transactions
            </p>
          </div>

          <button
            onClick={handleOpenCreate}
            type="button"
            style={{
              backgroundColor: "#075544",
              color: "#ffffff",
              border: "none",
              borderRadius: "10px",
              padding: "10px 18px",
              fontSize: "0.875rem",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(7, 85, 68, 0.2)",
              transition: "transform 0.1s ease",
            }}
          >
            <Plus size={16} />
            <span>Add Method</span>
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "8px",
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              fontSize: "0.875rem",
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Table View matching screenshot 1 */}
        {visibleLoading ? (
          <LogoLoader variant="section" message="Loading payment methods" hint="Fetching accepted settlement methods" />
        ) : methods.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "48px 0",
              color: "#94a3b8",
            }}
          >
            <p style={{ margin: 0, fontSize: "0.95rem" }}>
              No payment methods found. Click "Add Method" to create one.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
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
                    borderBottom: "1px solid #f1f5f9",
                    color: "#475569",
                    fontWeight: 600,
                  }}
                >
                  <th style={{ padding: "12px 16px" }}>Method</th>
                  <th style={{ padding: "12px 16px" }}>Description</th>
                  <th style={{ padding: "12px 16px" }}>Order</th>
                  <th style={{ padding: "12px 16px" }}>Status</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {methods.map((item) => (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: "1px solid #f8fafc",
                      transition: "background-color 0.15s ease",
                    }}
                  >
                    {/* Method Column with CreditCard icon */}
                    <td style={{ padding: "16px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                        }}
                      >
                        <CreditCard size={18} style={{ color: "#475569" }} />
                        <span
                          style={{
                            fontWeight: 600,
                            color: "#0f172a",
                          }}
                        >
                          {item.name}
                        </span>
                      </div>
                    </td>

                    {/* Description Column */}
                    <td style={{ padding: "16px", color: "#64748b" }}>
                      {item.description || "-"}
                    </td>

                    {/* Order Column */}
                    <td style={{ padding: "16px", color: "#64748b" }}>
                      {item.sort_order ?? "-"}
                    </td>

                    {/* Status Column */}
                    <td style={{ padding: "16px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "4px 10px",
                          borderRadius: "12px",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          backgroundColor: item.is_active
                            ? "#075544"
                            : "#f1f5f9",
                          color: item.is_active ? "#ffffff" : "#64748b",
                        }}
                      >
                        {item.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>

                    {/* Actions Column */}
                    <td style={{ padding: "16px", textAlign: "right" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "flex-end",
                          gap: "8px",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
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
                            transition: "background-color 0.15s",
                          }}
                          title="Edit Payment Method"
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteTarget(item)}
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
                            transition: "color 0.15s",
                          }}
                          title="Delete Payment Method"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PaymentMethodDialog */}
      <PaymentMethodDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSaveSuccess={handleSaveSuccess}
        paymentMethod={selectedMethod}
        totalCount={methods.length}
      />

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
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
            if (e.target === e.currentTarget && !deleting) setDeleteTarget(null);
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "440px",
              boxShadow:
                "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              overflow: "hidden",
              animation: "modalSlideIn 0.2s ease-out",
            }}
          >
            <div style={{ padding: "24px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "16px",
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "10px",
                    backgroundColor: "#fef2f2",
                    color: "#ef4444",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Trash2 size={20} />
                </div>
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  type="button"
                  style={{
                    background: "none",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              <h3
                style={{
                  margin: "0 0 8px 0",
                  fontSize: "1.15rem",
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                Delete Payment Method
              </h3>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "#64748b" }}>
                Are you sure you want to delete payment method{" "}
                <strong>"{deleteTarget.name}"</strong>? This action cannot be undone.
              </p>

              <div
                style={{
                  marginTop: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: "12px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
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
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: "#ef4444",
                    color: "#ffffff",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  {deleting ? (
                    <>
                      <Loader2 size={16} className="spin" />
                      <span>Deleting…</span>
                    </>
                  ) : (
                    <span>Delete Method</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
