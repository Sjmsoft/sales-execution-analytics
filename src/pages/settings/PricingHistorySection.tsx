import { useEffect, useState } from "react";
import {
  History,
  Trash2,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  getPricingHistory,
  clearPricingHistory,
  type PricingHistoryEntry,
} from "../../services/referenceService";

export function PricingHistorySection() {
  const { staff, role } = useAuth();
  const roleKey = (
    role?.key ||
    staff?.user_roles?.key ||
    staff?.assigned_role ||
    ""
  ).toLowerCase();
  const isAdmin =
    roleKey === "administrator" ||
    roleKey === "admin" ||
    roleKey === "a0000000-0000-4000-8000-000000000001" ||
    role?.hierarchy_level === 1;

  const [entries, setEntries] = useState<PricingHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [error, setError] = useState("");
  const [notification, setNotification] = useState("");

  async function loadHistory() {
    setLoading(true);
    setError("");
    try {
      const data = await getPricingHistory();
      setEntries(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load pricing history from Supabase.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHistory();
  }, []);

  if (!isAdmin) {
    return null;
  }

  async function handleClearHistory() {
    setClearing(true);
    setError("");
    try {
      await clearPricingHistory();
      setEntries([]);
      setConfirmClear(false);
      setNotification("Pricing history log cleared.");
      setTimeout(() => setNotification(""), 4000);
    } catch (err: any) {
      setError(err?.message || "Failed to clear pricing history.");
    } finally {
      setClearing(false);
    }
  }

  function formatNaira(amount: number) {
    return (
      "₦" +
      new Intl.NumberFormat("en-NG", {
        maximumFractionDigits: 0,
      }).format(Number(amount) || 0)
    );
  }

  function formatDateTime(dateStr: string) {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "—";
      return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return "—";
    }
  }

  function renderChangeLabel(changeType: number) {
    if (changeType === 2) return "Created";
    return "Updated";
  }

  function renderPriceTransition(oldVal: number, newVal: number) {
    return (
      <span style={{ whiteSpace: "nowrap", fontSize: "0.84rem" }}>
        <span style={{ color: "#374151" }}>{formatNaira(oldVal)}</span>{" "}
        <span style={{ color: "#6b7280" }}>→</span>{" "}
        <strong style={{ color: "#059669", fontWeight: 700 }}>
          {formatNaira(newVal)}
        </strong>
      </span>
    );
  }

  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: "12px",
        border: "1px solid #e5e7eb",
        padding: "24px",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: "20px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <History
              size={20}
              strokeWidth={2.2}
              style={{ color: "#075544", flexShrink: 0 }}
            />
            <h2
              style={{
                fontSize: "1.15rem",
                fontWeight: 700,
                color: "#111827",
                margin: 0,
              }}
            >
              Pricing History Log
            </h2>
          </div>
          <p
            style={{
              fontSize: "0.85rem",
              color: "#6b7280",
              margin: "4px 0 0 0",
            }}
          >
            Audit trail of all product pricing changes. Shows who changed what and when.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            onClick={() => void loadHistory()}
            disabled={loading}
            title="Refresh pricing history"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              background: "#ffffff",
              color: "#374151",
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} />
            <span>Refresh</span>
          </button>

          {confirmClear ? (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                padding: "5px 10px",
                borderRadius: "8px",
              }}
            >
              <span style={{ fontSize: "0.8rem", color: "#991b1b", fontWeight: 600 }}>
                Clear all entries?
              </span>
              <button
                type="button"
                onClick={() => void handleClearHistory()}
                disabled={clearing}
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: "none",
                  background: "#dc2626",
                  color: "#ffffff",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {clearing ? "Clearing..." : "Confirm"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                disabled={clearing}
                style={{
                  padding: "4px 8px",
                  borderRadius: "6px",
                  border: "1px solid #d1d5db",
                  background: "#ffffff",
                  color: "#374151",
                  fontSize: "0.78rem",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              disabled={entries.length === 0 || loading}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
                background: "#ffffff",
                color: entries.length === 0 ? "#9ca3af" : "#111827",
                fontSize: "0.82rem",
                fontWeight: 600,
                cursor: entries.length === 0 || loading ? "not-allowed" : "pointer",
              }}
            >
              <Trash2 size={14} />
              <span>Clear History</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Alerts ── */}
      {notification && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            color: "#166534",
            padding: "10px 14px",
            borderRadius: "8px",
            marginBottom: "16px",
            fontSize: "0.85rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <CheckCircle2 size={16} />
            <span>{notification}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification("")}
            style={{
              background: "none",
              border: "none",
              color: "#166534",
              cursor: "pointer",
            }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {error && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            padding: "10px 14px",
            borderRadius: "8px",
            marginBottom: "16px",
            fontSize: "0.85rem",
          }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* ── Table ── */}
      <div style={{ overflowX: "auto", width: "100%" }}>
        <table
          style={{
            width: "100%",
            minWidth: "820px",
            borderCollapse: "collapse",
            fontSize: "0.85rem",
            textAlign: "left",
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: "1px solid #e5e7eb",
                color: "#374151",
                background: "#fafafa",
              }}
            >
              <th style={{ padding: "11px 12px", fontWeight: 600 }}>Date &amp; Time</th>
              <th style={{ padding: "11px 12px", fontWeight: 600 }}>Product</th>
              <th style={{ padding: "11px 12px", fontWeight: 600 }}>Change Type</th>
              <th style={{ padding: "11px 12px", fontWeight: 600 }}>Distributor</th>
              <th style={{ padding: "11px 12px", fontWeight: 600 }}>Wholesale</th>
              <th style={{ padding: "11px 12px", fontWeight: 600 }}>Retail</th>
              <th style={{ padding: "11px 12px", fontWeight: 600 }}>Changed By</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    padding: "32px",
                    textAlign: "center",
                    color: "#6b7280",
                  }}
                >
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                    <Loader2 size={16} className="spin" />
                    <span>Loading pricing history...</span>
                  </div>
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    padding: "36px 16px",
                    textAlign: "center",
                    color: "#6b7280",
                  }}
                >
                  No pricing changes logged yet. Edit a product&apos;s case pricing in{" "}
                  <strong>Drinks &amp; Products</strong> to record an audit entry.
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr
                  key={entry.id}
                  style={{
                    borderBottom: "1px solid #f1f5f9",
                    transition: "background 0.12s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td
                    style={{
                      padding: "13px 12px",
                      color: "#374151",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatDateTime(entry.changed_at)}
                  </td>
                  <td
                    style={{
                      padding: "13px 12px",
                      fontWeight: 700,
                      color: "#111827",
                    }}
                  >
                    {entry.drink_type_name1}
                  </td>
                  <td style={{ padding: "13px 12px" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "3px 10px",
                        borderRadius: "9999px",
                        border: "1px solid #d1d5db",
                        background: "#ffffff",
                        color: "#111827",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                      }}
                    >
                      {renderChangeLabel(entry.change_type)}
                    </span>
                  </td>
                  <td style={{ padding: "13px 12px" }}>
                    {renderPriceTransition(
                      entry.old_distributor_price,
                      entry.new_distributor_price
                    )}
                  </td>
                  <td style={{ padding: "13px 12px" }}>
                    {renderPriceTransition(
                      entry.old_wholesale_price,
                      entry.new_wholesale_price
                    )}
                  </td>
                  <td style={{ padding: "13px 12px" }}>
                    {renderPriceTransition(
                      entry.old_retail_price,
                      entry.new_retail_price
                    )}
                  </td>
                  <td style={{ padding: "13px 12px" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "3px 10px",
                        borderRadius: "9999px",
                        border: "1px solid #d1d5db",
                        background: "#ffffff",
                        color: "#374151",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {entry.changed_by_name1 || "Admin"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Footer Count ── */}
      <div
        style={{
          marginTop: "14px",
          fontSize: "0.82rem",
          color: "#6b7280",
        }}
      >
        Total entries: <strong style={{ color: "#111827" }}>{entries.length}</strong>
      </div>
    </div>
  );
}

