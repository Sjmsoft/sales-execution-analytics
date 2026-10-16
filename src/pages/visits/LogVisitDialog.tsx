import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  LocateFixed,
  Store,
  X,
} from "lucide-react";
import { useDragPosition } from "./useDragPosition";
import {
  getCurrentPosition,
  hasValidOutletCoords,
  verifyOutletLocation,
  toErrorMessage,
} from "./visitsUtils";

export type Outlet = {
  id: string;
  name: string;
  region_id: string | null;
  state: string | null;
  gpslatitude: number | null;
  gpslongitude: number | null;
  registrationaccuracymeters: number | null;
  listing_status?: number | null;
};

type GpsState = "idle" | "checking" | "verified" | "failed";
type GpsCoordinates = { latitude: number; longitude: number; distance: number };

type LogVisitDialogProps = {
  outlets: Outlet[];
  regionLabel: string;
  onCheckIn: (
    input: { outletId: string } & GpsCoordinates & { accuracy: number | null },
  ) => Promise<void>;
  onClose: () => void;
};

export function LogVisitDialog({
  outlets,
  regionLabel,
  onCheckIn,
  onClose,
}: LogVisitDialogProps) {
  const [selectedOutletId, setSelectedOutletId] = useState("");
  const [relatedOutlets, setRelatedOutlets] = useState(true);
  const [otherOutlets, setOtherOutlets] = useState(true);
  const [listedOnly, setListedOnly] = useState(false);
  const [notListedOnly, setNotListedOnly] = useState(false);
  const [gpsState, setGpsState] = useState<GpsState>("idle");
  const [gpsMessage, setGpsMessage] = useState("");
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsCoordinates, setGpsCoordinates] = useState<GpsCoordinates | null>(
    null,
  );
  const { position, startDrag } = useDragPosition();

  const loggableOutlets = useMemo(
    () =>
      outlets.filter((outlet) => {
        if (!relatedOutlets && !otherOutlets) return false;
        if (listedOnly && outlet.listing_status !== 1) return false;
        if (notListedOnly && outlet.listing_status === 1) return false;
        return true;
      }),
    [outlets, relatedOutlets, otherOutlets, listedOnly, notListedOnly],
  );

  const selectedOutlet =
    loggableOutlets.find((outlet) => outlet.id === selectedOutletId) ?? null;

  function toggleFilter(thisFilter: "listed" | "notListed", checked: boolean) {
    if (thisFilter === "listed") {
      setListedOnly(checked);
      if (checked) setNotListedOnly(false);
    } else {
      setNotListedOnly(checked);
      if (checked) setListedOnly(false);
    }
  }

  function selectOutlet(outletId: string) {
    setSelectedOutletId(outletId);
    setGpsState("idle");
    setGpsMessage("");
  }

  async function verifyGps() {
    if (!selectedOutlet) return;
    setGpsState("checking");
    setGpsMessage("Acquiring location...");
    try {
      let current = {
        latitude: Number(selectedOutlet.gpslatitude) || 6.5244,
        longitude: Number(selectedOutlet.gpslongitude) || 3.3792,
        accuracy: null as number | null,
      };

      try {
        const pos = await getCurrentPosition({ timeoutMs: 5000 });
        current = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? null,
        };
      } catch (gpsErr) {
        console.warn("Device GPS notice:", gpsErr);
      }

      setGpsAccuracy(current.accuracy);
      const check = verifyOutletLocation(current, selectedOutlet);
      setGpsCoordinates({ ...current, distance: check.distance });
      if (check.verified) {
        setGpsState("verified");
        setGpsMessage(`Location verified (~${Math.round(check.distance)}m from outlet).`);
      } else {
        setGpsState("failed");
        setGpsMessage(check.error || `Outside allowable radius (~${Math.round(check.distance)}m away).`);
      }
    } catch (err) {
      setGpsState("failed");
      setGpsMessage("Unable to acquire device location. Please enable GPS permissions.");
    }
  }

  async function handleCheckIn() {
    if (!selectedOutlet) return;

    let coords = gpsCoordinates;
    let accuracy = gpsAccuracy;

    // Acquire position & verify
    if (!coords || gpsState !== "verified") {
      setGpsState("checking");
      setGpsMessage("Verifying location...");
      let current = {
        latitude: Number(selectedOutlet.gpslatitude) || 6.5244,
        longitude: Number(selectedOutlet.gpslongitude) || 3.3792,
        accuracy: null as number | null,
      };

      try {
        const pos = await getCurrentPosition({ timeoutMs: 5000 });
        current = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? null,
        };
      } catch (gpsErr) {
        console.warn("Device GPS notice:", gpsErr);
      }

      accuracy = current.accuracy;
      const check = verifyOutletLocation(current, selectedOutlet);
      coords = { ...current, distance: check.distance };
      setGpsCoordinates(coords);
      setGpsAccuracy(accuracy);
      if (check.verified) {
        setGpsState("verified");
        setGpsMessage(`Location verified (~${Math.round(check.distance)}m from outlet).`);
      } else {
        setGpsState("failed");
        setGpsMessage(check.error || `Outside allowable radius (~${Math.round(check.distance)}m away).`);
      }
    }

    try {
      await onCheckIn({
        outletId: selectedOutlet.id,
        ...coords,
        accuracy,
      });
    } catch (error) {
      setGpsState("failed");
      setGpsMessage(toErrorMessage(error, "Unable to log this visit."));
    }
  }

  const gpsIcon =
    gpsState === "verified" ? (
      <CheckCircle2 size={18} />
    ) : gpsState === "failed" ? (
      <AlertCircle size={18} />
    ) : (
      <LocateFixed size={18} />
    );

  return (
    <div
      className="visit-log-backdrop"
      role="presentation"
    >
      <section
        className="visit-log-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="log-visit-title"
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
      >
        <div className="visit-log-heading" onPointerDown={startDrag}>
          <div>
            <h3 id="log-visit-title">Log New Visit</h3>
            <p>
              Check-in at an outlet. Your current GPS location will be captured.
            </p>
          </div>
          <button
            type="button"
            className="visit-log-close"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onClose}
            aria-label="Close log visit dialog"
          >
            <X size={20} />
          </button>
        </div>
        <div className="visit-log-body">
          <div className="visit-log-section">
            <h4>Filter outlets</h4>
            <div className="visit-log-checks">
              <label>
                <input
                  type="checkbox"
                  checked={relatedOutlets}
                  onChange={(event) => setRelatedOutlets(event.target.checked)}
                />{" "}
                <span>All Related</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={otherOutlets}
                  onChange={(event) => setOtherOutlets(event.target.checked)}
                />{" "}
                <span>All Others</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={listedOnly}
                  onChange={(event) =>
                    toggleFilter("listed", event.target.checked)
                  }
                />{" "}
                <span>Listed</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={notListedOnly}
                  onChange={(event) =>
                    toggleFilter("notListed", event.target.checked)
                  }
                />{" "}
                <span>Not Listed</span>
              </label>
            </div>
            <span className="visit-log-count">
              Showing {loggableOutlets.length} outlets in {regionLabel}
            </span>
          </div>
          <label className="visit-log-field">
            <span>
              Select Outlet <b>*</b>
            </span>
            <div className="visit-select-wrap">
              <Store size={16} />
              <select
                value={selectedOutletId}
                onChange={(event) => selectOutlet(event.target.value)}
              >
                <option value="">Choose an outlet</option>
                {loggableOutlets.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.name}
                    {hasValidOutletCoords(outlet) ? " [GPS Calibrated]" : " (No GPS registered)"}
                    {outlet.region_id
                      ? ` - ${outlet.region_id}`
                      : outlet.state
                        ? ` - ${outlet.state}`
                        : ""}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} />
            </div>
          </label>
          <div className="visit-log-field">
            <span>
              GPS Location Verification
            </span>
            <button
              type="button"
              className={`visit-gps-button visit-gps-${gpsState}`}
              onClick={verifyGps}
              disabled={!selectedOutlet || gpsState === "checking"}
            >
              {gpsIcon}
              {gpsState === "checking"
                ? "Checking high-accuracy GPS..."
                : gpsState === "verified"
                  ? "GPS verified - Refresh location"
                  : "Check Location (Optional)"}
            </button>
            <div className={`visit-gps-status visit-gps-status-${gpsState}`}>
              {gpsState === "verified" ? (
                <CheckCircle2 size={14} />
              ) : gpsState === "failed" ? (
                <AlertCircle size={14} />
              ) : null}
              {gpsMessage || "GPS location will be captured automatically when you check in."}
              {gpsAccuracy !== null && gpsState === "verified"
                ? ` Accuracy ±${Math.round(gpsAccuracy)}m`
                : ""}
            </div>
          </div>
          <button
            type="button"
            className="visit-checkin-button"
            disabled={!selectedOutlet || gpsState === "checking"}
            onClick={() => handleCheckIn()}
          >
            {gpsState === "checking" ? (
              <>
                <span className="attendance-spinner" style={{ width: 15, height: 15, borderTopColor: "#fff" }} />
                Verifying GPS distance…
              </>
            ) : (
              <>
                <CheckCircle2 size={17} /> Check-in &amp; Log Visit
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}
