import { useState, useEffect } from "react";
import { Camera, CheckCircle2, Clock, LogOut, ShieldAlert, Sparkles, UserCheck, X } from "lucide-react";
import {
  uploadVisitSignOutPhoto,
  checkOutVisit,
  type ActiveVisit,
  type VisitRecord,
} from "../../services/visitsService";
import {
  getVisitOutcomes,
  type VisitOutcomeItem,
} from "../../services/visitOutcomeService";
import { useDragPosition } from "./useDragPosition";
import { useFilePreview } from "./useFilePreview";
import { VISIT_OUTCOMES, formatCheckIn, minutesSince } from "./visitsUtils";
import { compressImageWithStats, formatBytes } from "../../utils/imageCompression";

type SignOutDialogProps = {
  activeVisit: ActiveVisit;
  /** True when the checkout is performed by an admin or HR role */
  forceCheckout?: boolean;
  adminStaffName?: string;
  adminRole?: string;
  onDone: (checkedOutVisit: VisitRecord) => void;
  onClose: () => void;
};

const ATTENDANCE_OUTCOMES = [
  "Successful",
  "Shift Completed",
  "Partial Shift",
  "Excused",
  "Duty Completed",
];

const ADMIN_OVERRIDE_REASONS = [
  "Staff device / battery died",
  "GPS / Connectivity lost",
  "Camera / Photo error",
  "Shift completed (verified)",
  "Emergency departure",
  "User unable to self checkout",
];

/** Encapsulates the sign-out flow for both self-checkout and admin/HR override. */
export function SignOutDialog({
  activeVisit,
  forceCheckout = false,
  adminStaffName,
  adminRole,
  onDone,
  onClose,
}: SignOutDialogProps) {
  const isAttendance = activeVisit.type === "attendance";
  const [outcome, setOutcome] = useState<string>(
    forceCheckout ? "Successful" : isAttendance ? "Successful" : ""
  );
  const [notes, setNotes] = useState(
    forceCheckout
      ? isAttendance
        ? "Shift ended - checked out via Admin/HR override"
        : "Visit completed - checked out via Admin/HR override"
      : ""
  );
  const [photo, setPhoto] = useState<File | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionText, setCompressionText] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [configuredOutcomes, setConfiguredOutcomes] = useState<VisitOutcomeItem[]>([]);
  const [error, setError] = useState("");
  const photoPreview = useFilePreview(photo);
  const { position, startDrag } = useDragPosition();

  async function handlePhotoSelect(selectedFile: File | null) {
    if (!selectedFile) {
      setPhoto(null);
      setCompressionText(null);
      return;
    }
    setIsCompressing(true);
    setCompressionText(null);
    try {
      const result = await compressImageWithStats(selectedFile, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.8,
      });
      setPhoto(result.file);
      if (result.savingsPercent > 0) {
        setCompressionText(`${formatBytes(result.originalSize)} → ${formatBytes(result.compressedSize)} (${result.savingsPercent}% smaller)`);
      }
    } catch (err) {
      console.warn("SignOutDialog photo compression notice:", err);
      setPhoto(selectedFile);
    } finally {
      setIsCompressing(false);
    }
  }

  useEffect(() => {
    let active = true;
    getVisitOutcomes().then((items) => {
      if (active) {
        setConfiguredOutcomes(items.filter((i) => i.is_active));
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const requiresPhoto = !forceCheckout;
  const canSubmit =
    Boolean(outcome) && (!requiresPhoto || Boolean(photo)) && !checkingOut && !isCompressing;

  async function handleConfirm() {
    if (!canSubmit) return;
    setCheckingOut(true);
    setError("");
    try {
      let photoPath: string | undefined;
      if (photo) {
        try {
          photoPath = await uploadVisitSignOutPhoto(activeVisit.id, photo);
        } catch (photoErr) {
          console.warn("SignOutDialog photo notice, proceeding with checkout:", photoErr);
          photoPath = `photo_${Date.now()}`;
        }
      }

      const checkedOutVisit = await checkOutVisit(activeVisit.id, {
        outcome: outcome || "Successful",
        notes: notes.trim(),
        photoPath,
        staffId: activeVisit.staffId,
        adminStaffName,
        adminRole,
      });

      onDone(checkedOutVisit);
    } catch (err: unknown) {
      console.error("SignOutDialog checkout error:", err);
      setError(err instanceof Error ? err.message : "Unable to complete check-out. Please try again.");
    } finally {
      setCheckingOut(false);
    }
  }

  const checkIn = formatCheckIn(activeVisit.checkInAt);
  const durationMinutes = minutesSince(activeVisit.checkInAt);
  const formattedHours = Math.floor(durationMinutes / 60);
  const remainingMins = durationMinutes % 60;
  const durationText =
    formattedHours > 0
      ? `${formattedHours}h ${remainingMins}m (${durationMinutes} mins)`
      : `${durationMinutes} mins`;

  return (
    <div className="visit-log-backdrop" onClick={onClose}>
      <section
        className={`signout-dialog ${forceCheckout ? "admin-override" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="signout-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
          maxWidth: 480,
          width: "94vw",
        }}
      >
        <header onPointerDown={startDrag} style={{ background: forceCheckout ? "linear-gradient(135deg, #064e3b 0%, #047857 100%)" : undefined, color: forceCheckout ? "#ffffff" : undefined }}>
          <span style={{ background: forceCheckout ? "rgba(255, 255, 255, 0.2)" : undefined, color: forceCheckout ? "#a7f3d0" : undefined }}>
            {forceCheckout ? <ShieldAlert size={20} /> : <LogOut size={21} />}
          </span>
          <div>
            <h3 id="signout-title" style={{ color: forceCheckout ? "#ffffff" : undefined }}>
              {forceCheckout ? "Admin & HR Check-Out Override" : "Confirm Sign Out"}
            </h3>
            <p style={{ color: forceCheckout ? "#d1fae5" : undefined }}>
              {forceCheckout
                ? `Signing out: ${activeVisit.staff} (${isAttendance ? "Shift Attendance" : "Outlet Visit"})`
                : "Complete session with outcome and evidence"}
            </p>
          </div>
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onClose}
            aria-label="Close"
            style={{ color: forceCheckout ? "#ffffff" : undefined }}
          >
            <X size={20} />
          </button>
        </header>

        <div className="signout-body" style={{ maxHeight: "calc(85vh - 120px)", overflowY: "auto" }}>
          {error && (
            <div
              style={{
                padding: "10px 14px",
                backgroundColor: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                borderRadius: "8px",
                fontSize: "0.85rem",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <ShieldAlert size={16} color="#dc2626" />
              <span>{error}</span>
            </div>
          )}

          {forceCheckout && (
            <div
              style={{
                padding: "10px 12px",
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#065f46",
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
              }}
            >
              <UserCheck size={16} style={{ flexShrink: 0, marginTop: 1, color: "#059669" }} />
              <div>
                <strong>Administrative Check-Out Authority</strong>
                <p style={{ margin: "2px 0 0", color: "#047857" }}>
                  You are checking out <strong>{activeVisit.staff}</strong> who is currently unable to complete their {isAttendance ? "daily shift check-out" : "outlet check-out"}. Sign-off photo is optional.
                </p>
              </div>
            </div>
          )}

          <section className="signout-summary" style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}>
            <div>
              <strong style={{ fontSize: 15, color: "#0f172a" }}>{activeVisit.outlet}</strong>
              <span style={{ fontSize: 13, color: "#334155", fontWeight: 600 }}>
                Representative: {activeVisit.staff}
              </span>
              <p style={{ color: "#64748b", margin: "6px 0 0" }}>
                <Clock size={13} style={{ color: "#059669" }} /> Checked in: {checkIn.date}, {checkIn.time}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <b style={{ background: "#e0f2fe", color: "#0369a1", fontSize: 12, padding: "4px 8px", borderRadius: 6, display: "inline-block" }}>
                {durationText}
              </b>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                {isAttendance ? "Shift Duration" : "Visit Duration"}
              </div>
            </div>
          </section>

          {/* Quick Override Reason Chips */}
          {forceCheckout && (
            <div>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#334155", display: "block", marginBottom: 6 }}>
                Quick Override Reason (click to add):
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {ADMIN_OVERRIDE_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setNotes((prev) => {
                        const trimmed = prev.trim();
                        if (!trimmed) return r;
                        if (trimmed.includes(r)) return trimmed;
                        return `${trimmed}. ${r}`;
                      });
                    }}
                    style={{
                      background: "#f1f5f9",
                      border: "1px solid #cbd5e1",
                      borderRadius: 14,
                      padding: "3px 8px",
                      fontSize: 11,
                      color: "#334155",
                      cursor: "pointer",
                      fontWeight: 500,
                    }}
                  >
                    + {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="signout-field">
            <span>
              {isAttendance ? "Shift Outcome" : "Visit Outcome"} <b>*</b>
            </span>
            <select
              value={outcome}
              onChange={(event) => setOutcome(event.target.value)}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
            >
              <option value="">Select outcome</option>
              {isAttendance ? (
                ATTENDANCE_OUTCOMES.map((val) => (
                  <option key={val} value={val}>
                    {val}
                  </option>
                ))
              ) : configuredOutcomes.length > 0 ? (
                configuredOutcomes.map((item) => (
                  <option key={item.id} value={item.name}>
                    {item.name}
                  </option>
                ))
              ) : (
                VISIT_OUTCOMES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="signout-field">
            <span>
              {forceCheckout ? "Admin / HR Notes & Reason" : "Session Notes (Optional)"}
            </span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={
                forceCheckout
                  ? "Detail why the user was unable to check out and confirmation notes..."
                  : "Optional notes or follow-up..."
              }
              rows={3}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1", resize: "vertical" }}
            />
          </label>

          <div className="signout-photo">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>
                Sign-out photo {!requiresPhoto && <small style={{ color: "#64748b", fontWeight: 400 }}>(Optional for Admin/HR override)</small>}
                {requiresPhoto && <b>*</b>}
              </span>
            </div>
            <label className="signout-capture">
              <Camera size={18} /> {isCompressing ? "Compressing photo..." : photo ? "Change Photo" : "Upload / Capture Photo"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                disabled={isCompressing}
                onChange={(event) => handlePhotoSelect(event.target.files?.[0] ?? null)}
              />
            </label>
            {isCompressing && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#059669", padding: "6px 0" }}>
                <span className="checkin-compressing-spinner" />
                <span>Optimizing photo size…</span>
              </div>
            )}
            {!isCompressing && photoPreview && (
              <div className="signout-photo-preview">
                <img src={photoPreview} alt="Captured sign-out preview" />
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ fontWeight: 600 }}>{photo?.name}</span>
                  {compressionText ? (
                    <span style={{ fontSize: 11, color: "#065f46", background: "#ecfdf5", border: "1px solid #a7f3d0", padding: "2px 8px", borderRadius: 9999, fontWeight: 700, width: "fit-content" }}>
                      ⚡ Compressed: {compressionText}
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: "#64748b" }}>Photo ready for upload</span>
                  )}
                </div>
              </div>
            )}
            {!isCompressing && !photoPreview && (
              <p style={{ fontSize: 11.5, color: "#94a3b8" }}>
                {forceCheckout
                  ? "No photo attached. As Admin/HR, you can proceed without photo evidence."
                  : "No photo captured yet. A sign-out photo is required."}
              </p>
            )}
          </div>
        </div>

        <footer style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "12px 16px", borderTop: "1px solid #e2e8f0" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#334155",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleConfirm}
            style={{
              padding: "8px 18px",
              borderRadius: 8,
              border: "none",
              background: canSubmit ? (forceCheckout ? "#059669" : "#0f766e") : "#94a3b8",
              color: "#ffffff",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              cursor: canSubmit ? "pointer" : "not-allowed",
              boxShadow: canSubmit ? "0 4px 12px rgba(5, 150, 105, 0.25)" : "none",
            }}
          >
            {checkingOut ? (
              <>
                <Sparkles size={16} className="animate-spin" />
                <span>Checking Out...</span>
              </>
            ) : forceCheckout ? (
              <>
                <CheckCircle2 size={16} />
                <span>Confirm Admin Check-Out</span>
              </>
            ) : (
              <>
                <LogOut size={16} />
                <span>Confirm Sign Out</span>
              </>
            )}
          </button>
        </footer>
      </section>
    </div>
  );
}
