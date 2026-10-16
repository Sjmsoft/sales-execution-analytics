import { X } from "lucide-react";
import type { ActivityItem } from "../../services/teamActivityService";
import { formatCurrencyNaira } from "../../services/teamActivityService";

interface ActivityDetailModalProps {
  activity: ActivityItem | null;
  onClose: () => void;
}

export default function ActivityDetailModal({
  activity,
  onClose,
}: ActivityDetailModalProps) {
  if (!activity) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.55)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "540px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          border: "1px solid #e2e8f0",
          overflow: "hidden",
          animation: "taFadeDown 0.2s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#fbfdfc",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              className={
                activity.type === "sale"
                  ? "ta-badge-sale"
                  : activity.type === "visit"
                  ? "ta-badge-visit"
                  : "ta-badge-attendance"
              }
            >
              {activity.type.toUpperCase()}
            </span>
            <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#092c1f" }}>
              Activity Details
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              padding: "6px",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "18px" }}>
          {/* Main Description Highlight */}
          <div
            style={{
              padding: "16px",
              background: "#f8faf9",
              borderRadius: "12px",
              border: "1px solid #edf2f0",
            }}
          >
            <div style={{ fontSize: "15px", fontWeight: 700, color: "#092c1f" }}>
              {activity.description}
            </div>
            {activity.subDescription && (
              <div style={{ fontSize: "13px", color: "#475569", marginTop: "4px" }}>
                {activity.subDescription}
              </div>
            )}
          </div>

          {/* Key-Value Details Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "14px",
              fontSize: "13.5px",
            }}
          >
            {/* Date */}
            <div>
              <div style={{ color: "#64748b", fontSize: "12px", fontWeight: 500 }}>Date & Time</div>
              <div style={{ fontWeight: 600, color: "#1e293b", marginTop: "3px" }}>
                {activity.formattedDate} at {activity.formattedTime}
              </div>
            </div>

            {/* Status */}
            <div>
              <div style={{ color: "#64748b", fontSize: "12px", fontWeight: 500 }}>Execution Status</div>
              <div style={{ fontWeight: 600, color: "#0d5c3a", marginTop: "3px" }}>
                {activity.status || "Completed"}
              </div>
            </div>

            {/* Staff Rep */}
            <div>
              <div style={{ color: "#64748b", fontSize: "12px", fontWeight: 500 }}>Staff Member</div>
              <div style={{ fontWeight: 700, color: "#092c1f", marginTop: "3px" }}>
                {activity.staffName}
              </div>
              <div style={{ fontSize: "12px", color: "#64748b" }}>
                {activity.staffRole} • {activity.staffRegion}
              </div>
            </div>

            {/* Outlet */}
            <div>
              <div style={{ color: "#64748b", fontSize: "12px", fontWeight: 500 }}>Outlet / Location</div>
              <div style={{ fontWeight: 600, color: "#1e293b", marginTop: "3px" }}>
                {activity.outletName}
              </div>
              {activity.gpsAccuracy && (
                <div style={{ fontSize: "12px", color: "#0d5c3a" }}>
                  GPS accuracy {activity.gpsAccuracy}
                </div>
              )}
            </div>

            {/* Amount (if sale) */}
            {activity.type === "sale" && (
              <>
                <div>
                  <div style={{ color: "#64748b", fontSize: "12px", fontWeight: 500 }}>Transaction Amount</div>
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontWeight: 800,
                      fontSize: "16px",
                      color: "#092c1f",
                      marginTop: "3px",
                    }}
                  >
                    {formatCurrencyNaira(activity.amount)}
                  </div>
                </div>

                <div>
                  <div style={{ color: "#64748b", fontSize: "12px", fontWeight: 500 }}>Quantity & Unit</div>
                  <div style={{ fontWeight: 600, color: "#1e293b", marginTop: "3px" }}>
                    {activity.quantity} {activity.unitType || "Units"}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #e2e8f0",
            background: "#f8fafc",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            className="ta-btn-secondary"
            onClick={onClose}
            style={{ padding: "8px 20px" }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
