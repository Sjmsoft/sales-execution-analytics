import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getOutlets, type Outlet } from "../services/referenceService";
import {
  createVisit,
  getActiveVisit,
  type ActiveVisit,
} from "../services/visitsService";
import { LogVisitDialog } from "./visits/LogVisitDialog";
import { toErrorMessage } from "./visits/visitsUtils";

/**
 * Standalone page for logging a new outlet visit / check-in.
 */
export default function NewVisitPage() {
  const navigate = useNavigate();
  const { staff, role } = useAuth();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [activeVisit, setActiveVisit] = useState<ActiveVisit | null>(null);
  const [loadingActiveVisit, setLoadingActiveVisit] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  // Load outlets
  useEffect(() => {
    void getOutlets()
      .then(setOutlets)
      .catch((err) => {
        console.error("Failed to load outlets:", err);
        setErrorMessage("Unable to load outlets list.");
      });
  }, []);

  // Check if staff already has an active outlet visit
  useEffect(() => {
    if (!staff?.id) {
      setLoadingActiveVisit(false);
      return;
    }
    let cancelled = false;
    void getActiveVisit(staff.id, "outlet")
      .then((visit) => {
        if (!cancelled) setActiveVisit(visit);
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setErrorMessage(
            toErrorMessage(error, "Unable to check for an active visit.")
          );
      })
      .finally(() => {
        if (!cancelled) setLoadingActiveVisit(false);
      });

    return () => {
      cancelled = true;
    };
  }, [staff?.id]);

  const regionOutlets =
    role?.key === "administrator" || !staff?.region
      ? outlets
      : outlets.filter(
          (outlet) =>
            outlet.region_id === staff.region || outlet.state === staff.region
        );

  async function handleCheckIn(input: {
    outletId: string;
    latitude: number;
    longitude: number;
    distance: number;
    accuracy: number | null;
  }) {
    if (!staff?.id) return;
    await createVisit({
      outletId: input.outletId,
      staffId: staff.id,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy,
      distance: input.distance,
      visitType: "outlet",
    });
    // Navigate back to visits history page
    navigate("/visits");
  }

  return (
    <div className="page new-visit-page">
      <div className="page-heading">
        <div>
          <button
            type="button"
            className="visits-outline-button"
            style={{ marginBottom: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
            onClick={() => navigate("/visits")}
          >
            <ArrowLeft size={16} /> Back to Visits History
          </button>
          <h2>Log Outlet Visit</h2>
          <p>Verify your GPS location and check in to an outlet</p>
        </div>
      </div>

      {errorMessage && (
        <div className="visits-error" role="alert" style={{ marginBottom: 16 }}>
          {errorMessage}
        </div>
      )}

      {loadingActiveVisit ? (
        <div style={{ padding: 24, textAlign: "center", color: "#666" }}>
          Checking active visits…
        </div>
      ) : (
        <>
          {activeVisit && (
            <section className="active-visit-alert" role="alert" style={{ maxWidth: 640, marginBottom: 16 }}>
              <AlertCircle size={24} />
              <div>
                <h3>Active Visit in Progress</h3>
                <p>
                  You are currently checked in at <strong>{activeVisit.outlet}</strong>{" "}
                  (since{" "}
                  {new Date(activeVisit.checkInAt).toLocaleTimeString("en-NG", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  ). Checking in to a new outlet below will automatically complete your prior visit.
                </p>
              </div>
              <button type="button" onClick={() => navigate("/visits")}>
                <LogOut size={16} /> Go to Visits
              </button>
            </section>
          )}

          <LogVisitDialog
            outlets={regionOutlets}
            regionLabel={staff?.region || "your assigned regions"}
            onCheckIn={handleCheckIn}
            onClose={() => navigate("/visits")}
          />
        </>
      )}
    </div>
  );
}
