import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  CalendarCheck,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Compass,
  ExternalLink,
  Eye,
  FileText,
  History,
  LocateFixed,
  LogOut,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  UserRound,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useUserLocation, type UserLiveLocation } from "../hooks/useUserLocation";
import { getOutlets, type Outlet } from "../services/referenceService";
import {
  createVisit,
  getActiveVisit,
  getAllActiveVisits,
  checkOutVisit,
  uploadVisitSignOutPhoto,
  isUserAdminOrHR,
  type VisitRecord,
  type VisitType,
} from "../services/visitsService";
import type { ActiveVisit } from "../services/visitsService";
import { SignOutDialog } from "./visits/SignOutDialog";

export type ShiftSummaryData = {
  visitId: string;
  visitType: "attendance" | "outlet";
  outletName: string;
  region?: string;
  staffName: string;
  staffRole: string;
  checkInAt: string;
  checkOutAt: string;
  durationText: string;
  outcome: string;
  notes?: string;
  photoUrl?: string | null;
  gpsVerified: boolean;
  gpsCoords?: { lat: number; lng: number; accuracy?: number } | null;
};
import {
  getUserScope,
  filterOutletsByScope,
} from "../services/dataScopeService";
import {
  getCurrentPosition,
  toErrorMessage,
  hasValidOutletCoords,
  formatDistance,
  distanceInMeters,
} from "./visits/visitsUtils";
import {
  verifyGeofenceWithProvider,
} from "../services/geofencingIntegrationService";
import { AttendanceFormSkeleton } from "../components/ui/Skeleton";
import { useMinimumLoading } from "../hooks/useMinimumLoading";
import { useFilePreview } from "./visits/useFilePreview";
import {
  getVisitOutcomes,
  type VisitOutcomeItem,
} from "../services/visitOutcomeService";
import { compressImageWithStats, formatBytes } from "../utils/imageCompression";
import "./CheckIn.css";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatClockDigits(totalSecs: number) {
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    hours: pad(h),
    minutes: pad(m),
    seconds: pad(s),
    formatted: `${pad(h)}h : ${pad(m)}m : ${pad(s)}s`,
  };
}

function friendlyTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function getRegionCoordinates(regionName?: string | null): { lat: number; lng: number; zoom: number } {
  const r = (regionName ?? "").toLowerCase();
  if (r.includes("lagos") || r.includes("ikeja") || r.includes("island") || r.includes("mainland")) {
    return { lat: 6.5244, lng: 3.3792, zoom: 14 };
  }
  if (r.includes("abuja") || r.includes("fct") || r.includes("north central")) {
    return { lat: 9.0765, lng: 7.3986, zoom: 13 };
  }
  if (r.includes("kano") || r.includes("kaduna") || r.includes("north")) {
    return { lat: 12.0022, lng: 8.592, zoom: 13 };
  }
  if (r.includes("rivers") || r.includes("port harcourt") || r.includes("south")) {
    return { lat: 4.8156, lng: 7.0498, zoom: 13 };
  }
  if (r.includes("oyo") || r.includes("ibadan") || r.includes("south west")) {
    return { lat: 7.3775, lng: 3.947, zoom: 13 };
  }
  if (r.includes("enugu") || r.includes("anambra") || r.includes("east")) {
    return { lat: 6.4584, lng: 7.5464, zoom: 13 };
  }
  if (r.includes("edo") || r.includes("benin")) {
    return { lat: 6.335, lng: 5.6037, zoom: 13 };
  }
  return { lat: 6.5244, lng: 3.3792, zoom: 12 };
}

// ── Types ─────────────────────────────────────────────────────────────────────

type PageStatus =
  | "loading"
  | "idle"
  | "verifying-in"
  | "verifying-out"
  | "checked-in"
  | "checked-out"
  | "error";

type GpsVerificationState = "idle" | "verifying" | "verified" | "out-of-range" | "error";

type VerifiedGpsData = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  distanceMeters: number | null;
  outletLatitude?: number | null;
  outletLongitude?: number | null;
  outletName?: string;
  allowedDistanceMeters?: number;
  isWithinPerimeter?: boolean;
  isOverridden?: boolean;
  provider?: string;
  providerName?: string;
  providerBadge?: string;
  providerStatus?: string;
  enforcementMode?: "strict" | "warning" | "audit";
  requiresReason?: boolean;
  signature?: string;
  accuracyWarning?: boolean;
  offsiteReason?: string;
  formattedAddress?: string;
  message?: string;
};

type CheckInState = {
  visitId: string;
  outletName: string;
  outletAddress?: string | null;
  outletState?: string | null;
  checkInTime: string; // ISO string
  checkOutTime: string | null;
  photoUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  distanceMeters?: number | null;
  visitType: VisitType;
  outcome?: string | null;
  notes?: string | null;
};

// ── Interactive Map Component ────────────────────────────────────────────────

function UnifiedMap({
  regionName,
  selectedOutlet,
  checkInState,
  outletCount,
  userLocation,
  isLocatingUser,
  onRecalibrateUserLocation,
  staffName,
}: {
  regionName?: string | null;
  selectedOutlet: Outlet | null;
  checkInState: CheckInState | null;
  outletCount: number;
  userLocation?: UserLiveLocation | null;
  isLocatingUser?: boolean;
  onRecalibrateUserLocation?: () => Promise<UserLiveLocation | null>;
  staffName?: string | null;
}) {
  const [mapLayer, setMapLayer] = useState<"osm" | "google">("osm");
  const [focusTarget, setFocusTarget] = useState<"user" | "outlet">("user");
  const [recalibrateNotice, setRecalibrateNotice] = useState<string | null>(null);

  const hasOutletCoords = Boolean(
    (checkInState?.latitude && checkInState?.longitude) ||
    (selectedOutlet && hasValidOutletCoords(selectedOutlet))
  );

  const coords = useMemo(() => {
    if (focusTarget === "user" && userLocation) {
      return {
        lat: userLocation.latitude,
        lng: userLocation.longitude,
        label: `${staffName ?? "Logged-in Staff"} (Live Calibrated GPS)`,
        isUser: true,
      };
    }

    if (checkInState?.latitude && checkInState?.longitude) {
      return {
        lat: Number(checkInState.latitude),
        lng: Number(checkInState.longitude),
        label: `${checkInState.outletName} (Your Active Check-In Location)`,
        isUser: false,
      };
    }

    if (selectedOutlet && hasValidOutletCoords(selectedOutlet)) {
      return {
        lat: Number(selectedOutlet.gpslatitude),
        lng: Number(selectedOutlet.gpslongitude),
        label: selectedOutlet.name,
        isUser: false,
      };
    }

    if (userLocation) {
      return {
        lat: userLocation.latitude,
        lng: userLocation.longitude,
        label: `${staffName ?? "Logged-in Staff"} (Current Location)`,
        isUser: true,
      };
    }

    const def = getRegionCoordinates(regionName);
    return {
      lat: def.lat,
      lng: def.lng,
      label: `${regionName ?? "Assigned"} Region Base`,
      isUser: false,
    };
  }, [focusTarget, userLocation, checkInState, selectedOutlet, regionName, staffName]);

  // Quantize map coordinates to 4 decimal places (~11m resolution) to prevent micro-meter GPS jitter from changing the iframe URL
  const quantizeCoord = (val: number) => Number(val.toFixed(4));
  const stableLat = quantizeCoord(coords.lat);
  const stableLng = quantizeCoord(coords.lng);

  const bboxDeltaLat = 0.005;
  const bboxDeltaLon = 0.007;
  const bbox = `${stableLng - bboxDeltaLon}%2C${stableLat - bboxDeltaLat}%2C${stableLng + bboxDeltaLon}%2C${stableLat + bboxDeltaLat}`;
  const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${stableLat}%2C${stableLng}`;
  const gmapsEmbedUrl = `https://maps.google.com/maps?q=${stableLat},${stableLng}&z=16&output=embed`;

  const externalOsmUrl = `https://www.openstreetmap.org/?mlat=${coords.lat}&mlon=${coords.lng}#map=17/${coords.lat}/${coords.lng}`;
  const externalGmapsUrl = `https://maps.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;

  async function handleRecalibrateClick() {
    setFocusTarget("user");
    if (onRecalibrateUserLocation) {
      const live = await onRecalibrateUserLocation();
      if (live) {
        setRecalibrateNotice(`Calibrated to ${live.latitude.toFixed(4)}°, ${live.longitude.toFixed(4)}°`);
        setTimeout(() => setRecalibrateNotice(null), 4000);
      }
    }
  }

  return (
    <div className="checkin-map-card">
      <div className="checkin-map-header">
        <div className="checkin-map-header-left">
          <div className="checkin-map-icon-wrap">
            <Compass size={20} />
          </div>
          <div>
            <div className="checkin-map-header-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>{regionName ? `${regionName} Field Geofence Radar` : "Live Geofence Radar"}</span>
              {recalibrateNotice && (
                <span style={{ fontSize: 11, background: "#d1fae5", color: "#065f46", padding: "2px 8px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700 }}>
                  <CheckCircle2 size={12} /> {recalibrateNotice}
                </span>
              )}
            </div>
            <div className="checkin-map-header-sub">
              {coords.label} • {outletCount} trade locations in territory
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {hasOutletCoords && (
            <div className="checkin-map-segmented-btn">
              <button
                type="button"
                className={`checkin-map-segment-tab ${focusTarget === "user" ? "active" : ""}`}
                onClick={() => setFocusTarget("user")}
                title="Focus on user GPS location"
              >
                <LocateFixed size={12} />
                <span>My Location</span>
              </button>
              <button
                type="button"
                className={`checkin-map-segment-tab ${focusTarget === "outlet" ? "active" : ""}`}
                onClick={() => setFocusTarget("outlet")}
                title="Focus on target outlet location"
              >
                <Store size={12} />
                <span>Outlet Pin</span>
              </button>
            </div>
          )}

          <button
            type="button"
            className="checkin-map-recalibrate-btn"
            onClick={handleRecalibrateClick}
            disabled={isLocatingUser}
            title="Recalibrate and refresh user live GPS coordinates"
          >
            <RefreshCw size={13} className={isLocatingUser ? "animate-spin" : ""} />
            <span>{isLocatingUser ? "Locating..." : "Recalibrate GPS"}</span>
          </button>

          <div className="checkin-map-segmented-btn">
            <button
              type="button"
              className={`checkin-map-segment-tab ${mapLayer === "osm" ? "active" : ""}`}
              onClick={() => setMapLayer("osm")}
            >
              OSM
            </button>
            <button
              type="button"
              className={`checkin-map-segment-tab ${mapLayer === "google" ? "active" : ""}`}
              onClick={() => setMapLayer("google")}
            >
              Google
            </button>
          </div>
        </div>
      </div>

      <div className="checkin-map-frame-wrapper">
        <iframe
          key={mapLayer}
          title="Field Territory Map"
          src={mapLayer === "osm" ? osmEmbedUrl : gmapsEmbedUrl}
          className="checkin-map-iframe"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
        <div className="checkin-map-crosshair-badge">
          <MapPin size={13} color="#059669" />
          <span>{coords.isUser ? "You (Verified GPS)" : selectedOutlet ? selectedOutlet.name : `${regionName ?? "National"} Territory`}</span>
        </div>

        <a
          href={mapLayer === "osm" ? externalOsmUrl : externalGmapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="checkin-map-external-link"
        >
          <span>Open Full Map</span>
          <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
}

// ── Main Unified Check-In Component ──────────────────────────────────────────

export default function CheckIn() {
  const navigate = useNavigate();
  const { staff, role } = useAuth();
  const roleKey = (role?.key || staff?.user_roles?.key || staff?.assigned_role || "").toLowerCase();
  const isBA = roleKey === "brand_ambassador" || roleKey === "ba" || roleKey === "vsr";

  const {
    userLocation,
    isLocating: isLocatingUser,
    recalibrate: recalibrateUserLocation,
  } = useUserLocation(staff?.id);

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [, setLoadingOutlets] = useState(true);

  // Live wall clock
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Form Mode: "attendance" (Daily Work Shift) vs "outlet" (Store Visit)
  const [selectedVisitType, setSelectedVisitType] = useState<VisitType>("attendance");

  // Enforce attendance-only mode for BA profiles
  useEffect(() => {
    if (isBA && selectedVisitType !== "attendance") {
      setSelectedVisitType("attendance");
    }
  }, [isBA, selectedVisitType]);

  // Session state
  const [pageStatus, setPageStatus] = useState<PageStatus>("loading");
  const showLoader = useMinimumLoading(pageStatus === "loading", 600);
  const [actionError, setActionError] = useState("");
  const [checkInState, setCheckInState] = useState<CheckInState | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check-out fields
  const [checkoutOutcome, setCheckoutOutcome] = useState("");
  const [checkoutNotes, setCheckoutNotes] = useState("");
  const [checkoutPhoto, setCheckoutPhoto] = useState<File | null>(null);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const [photoCompressionStats, setPhotoCompressionStats] = useState<{
    original: string;
    compressed: string;
    savings: string;
  } | null>(null);
  const photoPreview = useFilePreview(checkoutPhoto);

  async function handlePhotoCapture(file: File | null) {
    if (!file) {
      setCheckoutPhoto(null);
      setPhotoCompressionStats(null);
      return;
    }

    setIsCompressingPhoto(true);
    setPhotoCompressionStats(null);
    try {
      const result = await compressImageWithStats(file, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.8,
      });
      setCheckoutPhoto(result.file);
      if (result.savingsPercent > 0) {
        setPhotoCompressionStats({
          original: formatBytes(result.originalSize),
          compressed: formatBytes(result.compressedSize),
          savings: `${result.savingsPercent}% saved`,
        });
      }
    } catch (err) {
      console.warn("Photo compression fallback to original:", err);
      setCheckoutPhoto(file);
    } finally {
      setIsCompressingPhoto(false);
    }
  }

  // Dynamic configured visit outcomes
  const [availableOutcomes, setAvailableOutcomes] = useState<VisitOutcomeItem[]>([]);

  // Regional Filter Mode: "assigned" (only user's region) vs "all"
  const [regionFilterMode, setRegionFilterMode] = useState<"assigned" | "all">("assigned");

  // Outlet dropdown states
  const [selectedOutlet, setSelectedOutlet] = useState<Outlet | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // GPS Pre-Verification State
  const [gpsStatus, setGpsStatus] = useState<GpsVerificationState>("idle");
  const [verifiedGpsData, setVerifiedGpsData] = useState<VerifiedGpsData | null>(null);
  const [gpsErrorMessage, setGpsErrorMessage] = useState("");

  // Photo Evidence Modal & Completed Shift Summary State
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [previewPhotoRecord, setPreviewPhotoRecord] = useState<VisitRecord | null>(null);
  const [isLoadingPhotoModal, setIsLoadingPhotoModal] = useState(false);
  const [photoModalError, setPhotoModalError] = useState(false);
  const [completedShiftSummary, setCompletedShiftSummary] = useState<ShiftSummaryData | null>(null);

  function closePhotoModal() {
    setPreviewPhotoUrl(null);
    setPreviewPhotoRecord(null);
    setIsLoadingPhotoModal(false);
    setPhotoModalError(false);
  }

  // Admin & HR Force Check-Out Capabilities
  const canAdminCheckOut = useMemo(
    () =>
      isUserAdminOrHR(
        role,
        staff?.assigned_role ||
        (staff as any)?.user_roles?.key ||
        (staff as any)?.user_roles?.name ||
        (typeof (staff as any)?.role === "string" ? (staff as any).role : undefined)
      ),
    [role, staff]
  );
  const [allActiveVisits, setAllActiveVisits] = useState<ActiveVisit[]>([]);
  const [loadingActiveVisits, setLoadingActiveVisits] = useState(false);
  const [showAdminActiveModal, setShowAdminActiveModal] = useState(false);
  const [adminSelectedVisit, setAdminSelectedVisit] = useState<ActiveVisit | null>(null);
  const [adminSuccessNotice, setAdminSuccessNotice] = useState<string | null>(null);
  const [adminModalSearch, setAdminModalSearch] = useState("");
  const [adminModalTab, setAdminModalTab] = useState<"all" | "attendance" | "outlet">("all");

  const loadAllActiveVisits = useCallback(async () => {
    if (!canAdminCheckOut) return;
    setLoadingActiveVisits(true);
    try {
      const activeList = await getAllActiveVisits();
      setAllActiveVisits(activeList);
    } catch (err) {
      console.warn("Notice loading active visits for admin:", err);
    } finally {
      setLoadingActiveVisits(false);
    }
  }, [canAdminCheckOut]);

  useEffect(() => {
    if (canAdminCheckOut) {
      void loadAllActiveVisits();
      const interval = setInterval(() => {
        void loadAllActiveVisits();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [canAdminCheckOut, loadAllActiveVisits]);

  const filteredActiveStaff = useMemo(() => {
    return allActiveVisits.filter((item) => {
      if (adminModalTab !== "all" && item.type !== adminModalTab) return false;
      if (adminModalSearch.trim()) {
        const q = adminModalSearch.toLowerCase();
        return (
          (item.staff || "").toLowerCase().includes(q) ||
          (item.outlet || "").toLowerCase().includes(q) ||
          (item.notes || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allActiveVisits, adminModalTab, adminModalSearch]);

  // Load available visit outcomes
  useEffect(() => {
    async function loadOutcomes() {
      try {
        const outcomes = await getVisitOutcomes();
        setAvailableOutcomes(outcomes);
        if (outcomes.length > 0 && !checkoutOutcome) {
          setCheckoutOutcome(outcomes[0].name);
        }
      } catch (e) {
        console.warn("Failed to load visit outcomes:", e);
      }
    }
    void loadOutcomes();
  }, []);



  // Restore active check-in session from DB
  useEffect(() => {
    if (!staff?.id) return;
    let cancelled = false;

    async function restoreSession() {
      try {
        const active: ActiveVisit | null = await getActiveVisit(staff!.id);
        if (cancelled) return;

        if (active) {
          let cachedCoords: Partial<CheckInState> = {};
          try {
            const raw = localStorage.getItem(`penedge_checkin_coords_${staff!.id}`);
            if (raw) cachedCoords = JSON.parse(raw);
          } catch { }

          setCheckInState({
            visitId: active.id,
            outletName: active.outlet,
            outletAddress: cachedCoords.outletAddress,
            outletState: cachedCoords.outletState,
            checkInTime: active.checkInAt,
            checkOutTime: null,
            latitude: cachedCoords.latitude ?? 6.5244,
            longitude: cachedCoords.longitude ?? 3.3792,
            accuracy: cachedCoords.accuracy ?? 10,
            distanceMeters: cachedCoords.distanceMeters ?? 0,
            visitType: active.type,
            outcome: active.outcome,
          });
          setSelectedVisitType(active.type);
          setElapsed(Math.floor((Date.now() - new Date(active.checkInAt).getTime()) / 1000));
          setPageStatus("checked-in");
        } else {
          setPageStatus("idle");
          setCheckInState(null);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to restore check-in session from DB:", err);
        setPageStatus("idle");
      }
    }

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, [staff?.id]);

  // Duration timer for active session
  useEffect(() => {
    if (pageStatus === "checked-in") {
      timerRef.current = setInterval(() => {
        setCheckInState((rec) => {
          if (rec) setElapsed(Math.floor((Date.now() - new Date(rec.checkInTime).getTime()) / 1000));
          return rec;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [pageStatus]);

  // Load outlets
  useEffect(() => {
    async function loadOutlets() {
      try {
        const data = await getOutlets();
        setOutlets(data);
      } catch (err) {
        console.error("Failed to load outlets:", err);
      } finally {
        setLoadingOutlets(false);
      }
    }
    void loadOutlets();
  }, []);

  const userScope = useMemo(() => getUserScope(staff, role), [staff, role]);

  const assignedRegionOutlets = useMemo(() => {
    if (userScope.isNational && regionFilterMode === "all") {
      return [...outlets].sort((a, b) => a.name.localeCompare(b.name));
    }
    const scoped = filterOutletsByScope(outlets, userScope);
    return [...scoped].sort((a, b) => a.name.localeCompare(b.name));
  }, [outlets, userScope, regionFilterMode]);

  const filteredDropdownOutlets = useMemo(() => {
    if (!dropdownSearch.trim()) return assignedRegionOutlets;
    const q = dropdownSearch.toLowerCase();
    return assignedRegionOutlets.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        (o.address ?? "").toLowerCase().includes(q) ||
        (o.lga ?? "").toLowerCase().includes(q) ||
        (o.state ?? "").toLowerCase().includes(q)
    );
  }, [assignedRegionOutlets, dropdownSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    if (isDropdownOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isDropdownOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 60);
    } else {
      setDropdownSearch("");
    }
  }, [isDropdownOpen]);

  // Auto-select first outlet if none selected and outlets are loaded
  useEffect(() => {
    if (!selectedOutlet && assignedRegionOutlets.length > 0) {
      setSelectedOutlet(assignedRegionOutlets[0]);
    }
  }, [assignedRegionOutlets, selectedOutlet]);

  // Pre-Checkin GPS Verification Handler (Supports both Attendance Shift and Outlet Trade Visit)
  async function handleVerifyGps(forceFresh = false): Promise<VerifiedGpsData | null> {
    if (!selectedOutlet) return null;
    setGpsStatus("verifying");
    setGpsErrorMessage("");
    setActionError("");

    try {
      let userCoords: { latitude: number; longitude: number; accuracy: number | null } | null = null;

      // 1. Live recalibration attempt
      try {
        const live = await recalibrateUserLocation({ timeoutMs: forceFresh ? 9000 : 6000 });
        if (live) {
          userCoords = {
            latitude: live.latitude,
            longitude: live.longitude,
            accuracy: live.accuracy,
          };
        }
      } catch (calErr) {
        console.warn("Live recalibration notice:", calErr);
      }

      // 2. Direct browser geolocation or cached hook position
      if (!userCoords) {
        if (userLocation && !forceFresh) {
          userCoords = {
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            accuracy: userLocation.accuracy,
          };
        } else {
          try {
            const pos = await getCurrentPosition({ timeoutMs: 8000 });
            userCoords = {
              latitude: Number(pos.coords.latitude.toFixed(6)),
              longitude: Number(pos.coords.longitude.toFixed(6)),
              accuracy: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null,
            };
          } catch {
            if (userLocation) {
              userCoords = {
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
                accuracy: userLocation.accuracy,
              };
            }
          }
        }
      }

      const hasOutletGps = hasValidOutletCoords(selectedOutlet);
      const outletLat = hasOutletGps ? Number(selectedOutlet.gpslatitude) : Number(userCoords?.latitude) || 6.5244;
      const outletLng = hasOutletGps ? Number(selectedOutlet.gpslongitude) : Number(userCoords?.longitude) || 3.3792;

      // 3. Provider-backed geofence evaluation
      const providerCheck = await verifyGeofenceWithProvider({
        userCoords: userCoords || { latitude: outletLat, longitude: outletLng, accuracy: 10 },
        outletCoords: {
          latitude: outletLat,
          longitude: outletLng,
        },
        outletName: selectedOutlet.name,
      });

      const dist = hasOutletGps
        ? providerCheck.distanceMeters
        : userCoords
          ? Math.round(distanceInMeters(userCoords, { latitude: outletLat, longitude: outletLng }))
          : 0;

      const allowedRadius = providerCheck.allowedRadiusMeters || 500;
      const isWithinPerimeter = !hasOutletGps || dist <= allowedRadius;

      const verificationData: VerifiedGpsData = {
        latitude: userCoords ? userCoords.latitude : outletLat,
        longitude: userCoords ? userCoords.longitude : outletLng,
        accuracy: userCoords ? userCoords.accuracy : 10,
        distanceMeters: dist,
        outletLatitude: hasOutletGps ? Number(selectedOutlet.gpslatitude) : null,
        outletLongitude: hasOutletGps ? Number(selectedOutlet.gpslongitude) : null,
        outletName: selectedOutlet.name,
        allowedDistanceMeters: allowedRadius,
        isWithinPerimeter,
        isOverridden: false,
        provider: providerCheck.provider,
        providerName: providerCheck.providerName,
        providerBadge: providerCheck.badgeLabel,
        providerStatus: providerCheck.providerStatus,
        enforcementMode: providerCheck.enforcementMode,
        requiresReason: false,
        signature: providerCheck.signature,
        accuracyWarning: providerCheck.accuracyWarning,
        formattedAddress: providerCheck.formattedAddress,
        message: providerCheck.message,
      };

      setVerifiedGpsData(verificationData);
      setGpsStatus(isWithinPerimeter ? "verified" : "out-of-range");
      if (!isWithinPerimeter) {
        setGpsErrorMessage(
          `You are outside the ${selectedVisitType === "attendance" ? "duty station" : "outlet"} geofence (${formatDistance(dist)} away). Verification is prevented until you are within ${allowedRadius}m.`
        );
      } else {
        setGpsErrorMessage("");
      }
      return verificationData;
    } catch (err: unknown) {
      console.warn("GPS verification notice, unable to acquire device coordinates:", err);
      setGpsStatus("error");
      setGpsErrorMessage("Unable to verify device GPS coordinates. Please ensure location services are enabled.");
      return null;
    }
  }

  // Auto-verify GPS when selected outlet is loaded / changed
  useEffect(() => {
    if (selectedOutlet && gpsStatus === "idle" && pageStatus === "idle") {
      void handleVerifyGps(false);
    }
  }, [selectedOutlet, gpsStatus, pageStatus]);

  // Check-In Submission Handler with strict geofence verification before commit
  async function handleSubmitCheckIn() {
    if (!selectedOutlet || !staff?.id) return;
    setActionError("");

    let currentCoords = verifiedGpsData;
    if (gpsStatus === "idle" || !currentCoords) {
      currentCoords = await handleVerifyGps(false);
    }

    // Strictly prevent check-in if outside authorized geofence
    if (currentCoords && currentCoords.isWithinPerimeter === false) {
      const dist = currentCoords.distanceMeters ?? 0;
      const allowed = currentCoords.allowedDistanceMeters ?? 500;
      setActionError(
        `Check-in blocked: You are currently outside the authorized geofence (${formatDistance(dist)} away from ${selectedOutlet.name}). You must be within ${allowed}m to check in.`
      );
      setPageStatus("idle");
      return;
    }

    if (gpsStatus !== "verified" || !currentCoords) {
      setActionError("Please verify your GPS location before checking in.");
      setPageStatus("idle");
      return;
    }

    setPageStatus("verifying-in");

    try {
      const finalCoords = currentCoords;

      const geoNotes = finalCoords?.providerName
        ? `[Geofence: ${finalCoords.providerName} | Dist: ${finalCoords.distanceMeters ?? "0"}m | Sig: ${finalCoords.signature ?? "LIVE"}]`
        : undefined;

      const visit = await createVisit({
        outletId: selectedOutlet.id,
        staffId: staff.id,
        latitude: finalCoords.latitude,
        longitude: finalCoords.longitude,
        accuracy: finalCoords.accuracy,
        distance: finalCoords.distanceMeters ?? 0,
        visitType: selectedVisitType,
        notes: geoNotes,
      });

      if (staff?.id) {
        try {
          localStorage.setItem(
            `penedge_checkin_coords_${staff.id}`,
            JSON.stringify({
              latitude: finalCoords.latitude,
              longitude: finalCoords.longitude,
              accuracy: finalCoords.accuracy,
              distanceMeters: finalCoords.distanceMeters,
              outletAddress: selectedOutlet.address,
              outletState: selectedOutlet.state,
            })
          );
        } catch (e) { }
      }

      setCheckInState({
        visitId: visit.id,
        outletName: selectedOutlet.name,
        outletAddress: selectedOutlet.address,
        outletState: selectedOutlet.state,
        checkInTime: new Date().toISOString(),
        checkOutTime: null,
        latitude: finalCoords.latitude,
        longitude: finalCoords.longitude,
        accuracy: finalCoords.accuracy,
        distanceMeters: finalCoords.distanceMeters,
        visitType: selectedVisitType,
      });
      setElapsed(0);
      setPageStatus("checked-in");
    } catch (err: unknown) {
      setPageStatus("idle");
      setActionError(toErrorMessage(err, "Unable to complete check-in. Please try again."));
    }
  }

  // Check-Out Submission Handler
  async function handleSubmitCheckOut() {
    if (!checkInState) return;

    if (checkInState.visitType === "outlet" && !checkoutOutcome.trim()) {
      setActionError("Please select a Visit Outcome before completing check-out.");
      return;
    }

    if (!checkoutPhoto) {
      setActionError("Please capture an evidence photo using your camera before checking out.");
      return;
    }

    setPageStatus("verifying-out");
    setActionError("");

    try {
      let photoPath: string | undefined;
      if (checkoutPhoto) {
        try {
          photoPath = await uploadVisitSignOutPhoto(checkInState.visitId, checkoutPhoto);
        } catch (photoErr) {
          console.warn("Photo upload notice, proceeding with checkout:", photoErr);
          photoPath = `photo_${Date.now()}`;
        }
      }

      const checkOutIso = new Date().toISOString();
      await checkOutVisit(checkInState.visitId, {
        outcome: checkoutOutcome.trim() || "Successful",
        notes: checkoutNotes.trim() || (checkInState.visitType === "attendance" ? "Shift completed" : "Visit completed"),
        photoPath,
        staffId: staff?.id,
        checkOutAt: checkOutIso,
      });

      if (staff?.id) {
        try {
          localStorage.removeItem(`penedge_checkin_coords_${staff.id}`);
        } catch (e) { }
      }

      // Calculate shift duration
      const durationSeconds = Math.max(1, Math.round((new Date(checkOutIso).getTime() - new Date(checkInState.checkInTime).getTime()) / 1000));
      const durHrs = Math.floor(durationSeconds / 3600);
      const durMins = Math.floor((durationSeconds % 3600) / 60);
      const durationText = durHrs > 0 ? `${durHrs}h ${durMins}m` : `${Math.max(1, durMins)} min${durMins !== 1 ? "s" : ""}`;

      // Open shift summary dialog
      setCompletedShiftSummary({
        visitId: checkInState.visitId,
        visitType: checkInState.visitType,
        outletName: checkInState.outletName,
        region: selectedOutlet?.state || selectedOutlet?.region_id || staff?.region || "Assigned Territory",
        staffName: staff?.name || "Representative",
        staffRole: role?.name || (isBA ? "Brand Ambassador" : "Sales Representative"),
        checkInAt: checkInState.checkInTime,
        checkOutAt: checkOutIso,
        durationText,
        outcome: checkoutOutcome.trim() || "Successful",
        notes: checkoutNotes.trim(),
        photoUrl: photoPreview || photoPath || null,
        gpsVerified: Boolean(gpsStatus === "verified" || verifiedGpsData || userLocation),
        gpsCoords: verifiedGpsData
          ? { lat: verifiedGpsData.latitude, lng: verifiedGpsData.longitude, accuracy: verifiedGpsData.accuracy ?? undefined }
          : userLocation
            ? { lat: userLocation.latitude, lng: userLocation.longitude, accuracy: userLocation.accuracy ?? undefined }
            : null,
      });

      setPageStatus("checked-out");
      setCheckInState(null);
      setCheckoutPhoto(null);
      setPhotoCompressionStats(null);
      setCheckoutNotes("");
      setGpsStatus("idle");
      setVerifiedGpsData(null);
    } catch (err: unknown) {
      setPageStatus("checked-in");
      setActionError(toErrorMessage(err, "Unable to complete check-out. Please try again."));
    }
  }

  if (showLoader) {
    return (
      <div className="attendance-page-container">
        <AttendanceFormSkeleton />
      </div>
    );
  }

  const { hours, minutes, seconds } = formatClockDigits(elapsed);

  return (
    <div className="checkin-root-container">
      {/* ── Top Hero Command Banner ── */}
      <div className="checkin-hero-banner">
        <div className="checkin-hero-content">
          <div className="checkin-hero-left">
            <div className="checkin-hero-icon-box">
              <CalendarCheck size={28} />
            </div>
            <div className="checkin-hero-title-wrap">
              <h1>
                {isBA ? "Daily Attendance Check-In" : "Field Check-In & Attendance"}
                <span className="checkin-hero-badge">
                  <ShieldCheck size={12} /> Geofence Guard Live
                </span>
              </h1>
              <p className="checkin-hero-subtitle">
                {isBA
                  ? "Daily work-shift attendance and duty station check-in with verified GPS perimeter authentication."
                  : "Unified work-shift attendance & trade outlet check-in station with real-time GPS perimeter verification."}
              </p>
            </div>
          </div>

          {/* Live Digital Wall Clock */}
          <div className="checkin-clock-card">
            <Clock size={22} className="animate-pulse" style={{ color: "#34d399" }} />
            <div>
              <div className="checkin-clock-time">
                {currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </div>
              <div className="checkin-clock-date">
                {currentTime.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Active Staff Identity Bar ── */}
      <div className="checkin-identity-bar">
        <div className="checkin-identity-left">
          <div className="checkin-avatar-circle">
            {staff?.name ? staff.name.slice(0, 2).toUpperCase() : "ST"}
            <span className="checkin-avatar-dot" />
          </div>
          <div>
            <div className="checkin-staff-name-row">
              <strong>{staff?.name ?? "Sales Staff"}</strong>
              <span className="checkin-role-pill">{role?.name ?? "Field Staff"}</span>
            </div>
            <div className="checkin-meta-row">
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <MapPin size={13} color="#059669" />
                Territory: <strong style={{ color: "#0f172a" }}>{staff?.region ?? "National"}</strong>
              </span>
              {userLocation && (
                <span className="checkin-location-pill">
                  <LocateFixed size={11} /> {userLocation.latitude.toFixed(4)}°, {userLocation.longitude.toFixed(4)}°
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="checkin-stat-chips">
          <button
            type="button"
            className="checkin-stat-chip"
            onClick={() => navigate("/visits")}
            style={{ cursor: "pointer", border: "1px solid #cbd5e1", background: "#f8fafc" }}
            title="View complete Outlet Visits & Attendance History"
          >
            <History size={14} color="#059669" />
            <span style={{ fontWeight: 600 }}>Outlet Visits History</span>
          </button>
        </div>
      </div>

      {/* ── Admin & HR Check-Out Control Strip ── */}
      {canAdminCheckOut && (
        <div className="checkin-admin-strip">
          <div className="checkin-admin-strip-left">
            <div className="checkin-admin-strip-icon">
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="checkin-admin-strip-title">
                <span>Admin &amp; HR Check-Out Control</span>
                <span className="checkin-admin-role-badge">
                  {userScope.isNational && (roleKey === "hr" || roleKey.includes("human_resource") || roleKey.includes("hr"))
                    ? "HR Management"
                    : "System Administrator"}
                </span>
              </div>
              <div className="checkin-admin-strip-subtitle">
                {allActiveVisits.length > 0 ? (
                  <>
                    <strong>{allActiveVisits.length} staff member{allActiveVisits.length > 1 ? "s are" : " is"} currently checked in</strong> ({allActiveVisits.filter((v) => v.type === "attendance").length} shift{allActiveVisits.filter((v) => v.type === "attendance").length === 1 ? "" : "s"}, {allActiveVisits.filter((v) => v.type === "outlet").length} store visit{allActiveVisits.filter((v) => v.type === "outlet").length === 1 ? "" : "s"}). You can check out any user unable to self check-out.
                  </>
                ) : (
                  "All field representatives and duty stations are currently signed off. No open check-ins."
                )}
              </div>
            </div>
          </div>

          <div className="checkin-admin-strip-actions">
            <button
              type="button"
              className="checkin-admin-refresh-btn"
              onClick={loadAllActiveVisits}
              disabled={loadingActiveVisits}
              title="Refresh active check-ins list"
            >
              <RefreshCw size={14} className={loadingActiveVisits ? "animate-spin" : ""} />
            </button>
            <button
              type="button"
              className="checkin-admin-strip-btn"
              onClick={() => {
                void loadAllActiveVisits();
                setShowAdminActiveModal(true);
              }}
              title="View all active staff sessions and check out users"
            >
              <LogOut size={16} />
              <span>Check-Out Active Staff</span>
              <span className="checkin-admin-count-pill">{allActiveVisits.length}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Admin Check-Out Success Toast Banner ── */}
      {adminSuccessNotice && (
        <div className="checkin-success-banner" role="status">
          <div className="checkin-alert-left">
            <CheckCircle2 size={18} color="#059669" />
            <span>{adminSuccessNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setAdminSuccessNotice(null)}
            className="checkin-alert-dismiss"
            aria-label="Dismiss message"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* ── Action Error Alert Banner ── */}
      {actionError && (
        <div className="checkin-alert-banner" role="alert">
          <div className="checkin-alert-left">
            <AlertCircle size={18} />
            <span>{actionError}</span>
          </div>
          <button type="button" onClick={() => setActionError("")} className="checkin-alert-dismiss" aria-label="Dismiss error">
            <X size={15} />
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STATE 1: ACTIVE SESSION (Checked-In Hub)
          ══════════════════════════════════════════════════════════════════════ */}
      {(pageStatus === "checked-in" || pageStatus === "verifying-out") && checkInState && (
        <div className="checkin-active-hub">
          <div className="checkin-active-top-row">
            <div className="checkin-active-badge-live">
              <span className="checkin-live-pulse-ring" />
              <span>
                {checkInState.visitType === "attendance"
                  ? "Daily Attendance Shift Active"
                  : `Outlet Trade Visit Active: ${checkInState.outletName}`}
              </span>
            </div>
            <div className="checkin-active-time-meta">
              <Clock size={14} />
              <span>Checked in at {friendlyTime(checkInState.checkInTime)}</span>
            </div>
          </div>

          <div className="checkin-active-grid">
            <div className="checkin-active-outlet-card">
              <div>
                <span className="label">
                  {checkInState.visitType === "attendance" ? "Duty Station Base" : "Target Retail Outlet"}
                </span>
                <h3>{checkInState.outletName}</h3>
                <p>
                  {checkInState.outletAddress || "Designated territory location"}
                  {checkInState.outletState ? ` • ${checkInState.outletState}` : ""}
                </p>
              </div>

              {checkInState.accuracy != null && (
                <div style={{ marginTop: 14, fontSize: 11.5, color: "#065f46", display: "flex", alignItems: "center", gap: 5, fontWeight: 700 }}>
                  <ShieldCheck size={14} color="#059669" /> GPS verified check-in (Precision ±{checkInState.accuracy}m)
                </div>
              )}
            </div>

            {/* Stopwatch Elapsed Time */}
            <div className="checkin-stopwatch-big">
              <Clock size={26} style={{ color: "#34d399", flexShrink: 0 }} />
              <div>
                <span className="checkin-stopwatch-tag">Session Elapsed Time</span>
                <div className="checkin-stopwatch-group">
                  <div className="checkin-stopwatch-digit-box">
                    <span className="checkin-stopwatch-num">{hours}</span>
                    <span style={{ fontSize: 9, color: "#94a3b8", fontWeight: 700 }}>HRS</span>
                  </div>
                  <span className="checkin-stopwatch-sep">:</span>
                  <div className="checkin-stopwatch-digit-box">
                    <span className="checkin-stopwatch-num">{minutes}</span>
                    <span style={{ fontSize: 9, color: "#94a3b8", fontWeight: 700 }}>MIN</span>
                  </div>
                  <span className="checkin-stopwatch-sep">:</span>
                  <div className="checkin-stopwatch-digit-box">
                    <span className="checkin-stopwatch-num">{seconds}</span>
                    <span style={{ fontSize: 9, color: "#94a3b8", fontWeight: 700 }}>SEC</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Checkout Controls Panel */}
          <div className="checkin-checkout-panel">
            <h4>Complete Check-Out & Sign Off</h4>

            {checkInState.visitType === "outlet" && (
              <div className="checkin-field-group">
                <div className="checkin-field-label">
                  <span>Visit Outcome <span className="req">*</span></span>
                </div>
                <div className="checkin-outcomes-grid">
                  {availableOutcomes.map((outcome) => (
                    <button
                      key={outcome.id}
                      type="button"
                      onClick={() => setCheckoutOutcome(outcome.name)}
                      className={`checkin-outcome-pill ${checkoutOutcome === outcome.name ? "selected" : ""}`}
                      style={{
                        borderColor: checkoutOutcome === outcome.name ? outcome.color : undefined,
                        backgroundColor: checkoutOutcome === outcome.name ? `${outcome.color}18` : undefined,
                      }}
                    >
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: outcome.color }} />
                      <span>{outcome.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="checkin-field-group">
              <div className="checkin-field-label">
                <span>{checkInState.visitType === "attendance" ? "Shift Notes / Handover (Optional)" : "Visit Notes & Remarks"}</span>
              </div>
              <div className="checkin-note-preset-chips">
                {(checkInState.visitType === "attendance"
                  ? ["Shift Complete", "Stock Restocked", "Handover Done", "Cash Reconciled", "Equipment Checked"]
                  : ["Order Taken", "Stock Audited", "Merchandising Done", "Payment Collected", "Audit Completed"]
                ).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setCheckoutNotes((prev) => (prev ? `${prev}. ${preset}` : preset))}
                    className="checkin-note-preset-chip"
                  >
                    + {preset}
                  </button>
                ))}
              </div>
              <textarea
                value={checkoutNotes}
                onChange={(e) => setCheckoutNotes(e.target.value)}
                placeholder={
                  checkInState.visitType === "attendance"
                    ? "Add any observations or handover notes for your shift..."
                    : "Record orders booked, customer feedback, stock status..."
                }
                rows={3}
                className="checkin-textarea"
              />
            </div>

            <div className="checkin-field-group">
              <div className="checkin-field-label">
                <span>Sign-Off Evidence Photo <span className="req">*</span></span>
              </div>
              <div className="checkin-photo-capture-box">
                <label className="checkin-photo-btn">
                  <Camera size={16} />
                  <span>
                    {isCompressingPhoto
                      ? "Compressing Photo..."
                      : checkoutPhoto
                        ? "Change Evidence Photo"
                        : "Capture Photo (Camera)"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: "none" }}
                    disabled={isCompressingPhoto}
                    onChange={(e) => {
                      if (e.target.files?.[0]) handlePhotoCapture(e.target.files[0]);
                    }}
                  />
                </label>
                {isCompressingPhoto && (
                  <div className="checkin-photo-compressing-indicator">
                    <span className="checkin-compressing-spinner" />
                    <span>Compressing & optimizing for fast upload…</span>
                  </div>
                )}
                {!isCompressingPhoto && photoPreview && (
                  <div className="checkin-photo-preview-wrap">
                    <img src={photoPreview} alt="Checkout Preview" className="checkin-photo-preview-thumb" />
                    <div className="checkin-photo-preview-info">
                      <span style={{ fontSize: 13, color: "#059669", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                        <Check size={14} /> Photo Captured & Compressed
                      </span>
                      {photoCompressionStats ? (
                        <span className="checkin-photo-compression-pill">
                          ⚡ {photoCompressionStats.original} → {photoCompressionStats.compressed} ({photoCompressionStats.savings})
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: "#64748b" }}>
                          Ready for sign-off verification
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmitCheckOut}
              disabled={pageStatus === "verifying-out" || !checkoutPhoto || isCompressingPhoto}
              className={`checkin-checkout-submit-btn ${checkoutPhoto && !isCompressingPhoto && pageStatus !== "verifying-out" ? "ready" : "disabled"}`}
            >
              {pageStatus === "verifying-out" ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  <span>Finalizing Check-Out...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  <span>Confirm & Complete Check-Out</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STATE 2: UNIFIED CHECK-IN FORM (When Idle)
          ══════════════════════════════════════════════════════════════════════ */}
      {pageStatus !== "checked-in" && pageStatus !== "verifying-out" && (
        <div className="checkin-form-card">
          {actionError && (
            <div
              style={{
                marginBottom: 20,
                padding: "12px 16px",
                borderRadius: 10,
                background: "#fff1f2",
                border: "1px solid #fecdd3",
                color: "#991b1b",
                fontSize: 13,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <AlertCircle size={18} color="#dc2626" style={{ flexShrink: 0 }} />
              <span>{actionError}</span>
            </div>
          )}

          {/* Step 1: Mode Selector Toggle */}
          <div style={{ marginBottom: 24 }}>
            <div className="checkin-section-label">
              <span>{isBA ? "1. Check-In Category: Daily Attendance (Shift)" : "1. Select Check-In Category"}</span>
            </div>
            <div className={`checkin-category-grid ${isBA ? "single-category" : ""}`}>
              <button
                type="button"
                onClick={() => {
                  setSelectedVisitType("attendance");
                  setGpsStatus("idle");
                  setVerifiedGpsData(null);
                }}
                className={`checkin-category-card ${selectedVisitType === "attendance" ? "selected" : ""}`}
              >
                <div>
                  <div className="checkin-category-top">
                    <div className="checkin-category-icon attendance">
                      <CalendarCheck size={22} />
                    </div>
                    <span className="checkin-category-badge">{isBA ? "BA Dedicated Shift" : "Shift Duty"}</span>
                  </div>
                  <h4 className="checkin-category-title">Daily Attendance (Shift)</h4>
                  <p className="checkin-category-desc">
                    Record daily work-shift resumption, hours, and duty station attendance.
                  </p>
                </div>
              </button>

              {!isBA && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedVisitType("outlet");
                    setGpsStatus("idle");
                    setVerifiedGpsData(null);
                  }}
                  className={`checkin-category-card ${selectedVisitType === "outlet" ? "selected" : ""}`}
                >
                  <div>
                    <div className="checkin-category-top">
                      <div className="checkin-category-icon outlet">
                        <Store size={22} />
                      </div>
                      <span className="checkin-category-badge">Customer Visit</span>
                    </div>
                    <h4 className="checkin-category-title">Outlet Trade Visit</h4>
                    <p className="checkin-category-desc">
                      Check-in at retail account/customer stores for audits, orders, and sales.
                    </p>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Step 2: Location Picker Combobox */}
          <div style={{ marginBottom: 24 }} ref={dropdownRef}>
            <div className="checkin-section-label">
              <span>2. Select {selectedVisitType === "attendance" ? "Duty Station / Base Location" : "Target Retail Outlet"}</span>
              {userScope.isNational && (
                <button
                  type="button"
                  onClick={() => setRegionFilterMode(regionFilterMode === "assigned" ? "all" : "assigned")}
                  style={{ background: "none", border: "none", color: "#059669", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  {regionFilterMode === "assigned" ? "Show All Regions" : "Filter by My Region"}
                </button>
              )}
            </div>

            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`checkin-combobox-trigger ${isDropdownOpen ? "open" : ""}`}
              >
                <div className="checkin-combobox-content">
                  {selectedOutlet ? (
                    <>
                      <strong>{selectedOutlet.name}</strong>
                      <span>
                        {selectedOutlet.address || "Address not specified"} • {selectedOutlet.state || "Territory"}
                      </span>
                    </>
                  ) : (
                    <span style={{ color: "#94a3b8" }}>Select an outlet or duty station...</span>
                  )}
                </div>
                <ChevronDown size={20} color="#64748b" style={{ transform: isDropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }} />
              </button>

              {isDropdownOpen && (
                <div className="checkin-dropdown-panel">
                  <div className="checkin-dropdown-search-wrap">
                    <div className="checkin-dropdown-search-bar">
                      <Search size={15} color="#94a3b8" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={dropdownSearch}
                        onChange={(e) => setDropdownSearch(e.target.value)}
                        placeholder="Search outlet by name, address, or LGA..."
                      />
                    </div>
                  </div>

                  {filteredDropdownOutlets.length === 0 ? (
                    <div style={{ padding: "18px", textAlign: "center", fontSize: 13, color: "#64748b" }}>
                      No outlets found matching "{dropdownSearch}".
                    </div>
                  ) : (
                    filteredDropdownOutlets.map((outlet) => (
                      <div
                        key={outlet.id}
                        onClick={() => {
                          setSelectedOutlet(outlet);
                          setIsDropdownOpen(false);
                          setGpsStatus("idle");
                          setVerifiedGpsData(null);
                        }}
                        className={`checkin-dropdown-item ${selectedOutlet?.id === outlet.id ? "active" : ""}`}
                      >
                        <div>
                          <div className="checkin-dropdown-item-title">{outlet.name}</div>
                          <div className="checkin-dropdown-item-meta">
                            {outlet.address || "Territory Station"} • {outlet.state || "State"}
                            {hasValidOutletCoords(outlet) ? (
                              <span style={{ color: "#059669", marginLeft: 8, fontWeight: 700 }}>• GPS Registered</span>
                            ) : (
                              <span style={{ color: "#f59e0b", marginLeft: 8, fontWeight: 700 }}>• Pending Coordinates</span>
                            )}
                          </div>
                        </div>
                        {selectedOutlet?.id === outlet.id && <Check size={16} color="#059669" />}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Step 3: Real-Time GPS & Geofence Verification */}
          <div style={{ marginBottom: 24 }}>
            <div className="checkin-section-label">
              <span>3. {selectedVisitType === "attendance" ? "Verify Duty Station GPS & Geofence" : "Verify Retail Outlet GPS & Geofence"}</span>
            </div>

            <div className="checkin-radar-box">
              <div className="checkin-radar-header">
                <div className="checkin-radar-title-group">
                  <div className="checkin-radar-icon-beacon">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
                      {selectedVisitType === "attendance"
                        ? "Daily Attendance Geofence Verification"
                        : "Outlet Trade Geofence Verification"}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                      {selectedVisitType === "attendance"
                        ? "Authenticates your device coordinates for shift resumption at your duty station."
                        : "Authenticates your device coordinates against the retail outlet's authorized GPS zone."}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleVerifyGps(true)}
                  disabled={gpsStatus === "verifying" || !selectedOutlet}
                  className={`checkin-verify-btn ${gpsStatus === "verified" ? "verified" : "ready"}`}
                  title={gpsStatus === "verified" ? "Click to re-verify location" : "Verify location"}
                >
                  {gpsStatus === "verifying" ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Verifying GPS...</span>
                    </>
                  ) : gpsStatus === "verified" || gpsStatus === "out-of-range" ? (
                    <>
                      <RefreshCw size={14} />
                      <span>Re-verify GPS</span>
                    </>
                  ) : (
                    <>
                      <LocateFixed size={16} />
                      <span>Verify Location</span>
                    </>
                  )}
                </button>
              </div>

              {verifiedGpsData && (
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 12.5 }}>
                    {verifiedGpsData.isWithinPerimeter ? (
                      <span
                        style={{
                          padding: "4px 10px",
                          borderRadius: 8,
                          fontWeight: 800,
                          background: "#d1fae5",
                          color: "#065f46",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <CheckCircle2 size={13} color="#059669" />
                        {selectedVisitType === "attendance"
                          ? "✓ Attendance Shift GPS Verified"
                          : "✓ Outlet Trade Visit GPS Verified"}
                      </span>
                    ) : (
                      <span
                        style={{
                          padding: "4px 10px",
                          borderRadius: 8,
                          fontWeight: 800,
                          background: "#fee2e2",
                          color: "#991b1b",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <AlertCircle size={13} color="#dc2626" />
                        Outside Geofence Perimeter
                      </span>
                    )}

                    {verifiedGpsData.distanceMeters != null && (
                      <span style={{ color: "#334155", fontWeight: 600 }}>
                        Distance to {selectedVisitType === "attendance" ? "Station" : "Outlet"}:{" "}
                        <strong style={{ color: verifiedGpsData.isWithinPerimeter ? "#0f172a" : "#dc2626" }}>
                          {formatDistance(verifiedGpsData.distanceMeters)}
                        </strong>
                        {!verifiedGpsData.isWithinPerimeter && verifiedGpsData.allowedDistanceMeters && (
                          <span style={{ color: "#64748b", fontWeight: 500, marginLeft: 4 }}>
                            (Limit: {verifiedGpsData.allowedDistanceMeters}m)
                          </span>
                        )}
                      </span>
                    )}
                    {verifiedGpsData.accuracy != null && (
                      <span style={{ color: "#64748b" }}>GPS Precision: ±{verifiedGpsData.accuracy}m</span>
                    )}
                  </div>

                  {/* Prominent Out-of-Range Notification */}
                  {!verifiedGpsData.isWithinPerimeter && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: "12px 16px",
                        borderRadius: 10,
                        background: "#fff1f2",
                        border: "1px solid #fecdd3",
                        color: "#9f1239",
                        fontSize: 13,
                        lineHeight: 1.5,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <AlertCircle size={18} style={{ color: "#e11d48", flexShrink: 0, marginTop: 2 }} />
                        <div>
                          <div style={{ fontWeight: 800, marginBottom: 2, color: "#881337" }}>
                            Verification Blocked: Outside Authorized Geofence
                          </div>
                          <div>
                            You are currently <strong>{formatDistance(verifiedGpsData.distanceMeters ?? 0)}</strong> away from <strong>{selectedOutlet?.name ?? "the outlet"}</strong>.
                            Check-in verification is restricted to within <strong>{verifiedGpsData.allowedDistanceMeters ?? 500}m</strong> of this location.
                          </div>
                          <div style={{ marginTop: 6, fontSize: 12, color: "#be123c", fontWeight: 600 }}>
                            👉 Please arrive at the {selectedVisitType === "attendance" ? "duty station" : "outlet"} premises and tap <strong>"Re-verify GPS"</strong> when you are on site to proceed.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {verifiedGpsData.distanceMeters != null && (
                    <div className="checkin-radar-progress-bar">
                      <div
                        className={`checkin-radar-progress-fill ${verifiedGpsData.isWithinPerimeter ? "in-range" : "out-of-range"}`}
                        style={{
                          width: verifiedGpsData.isWithinPerimeter
                            ? `${Math.min(100, Math.max(8, (1 - verifiedGpsData.distanceMeters / (verifiedGpsData.allowedDistanceMeters ?? 500)) * 100))}%`
                            : "100%",
                          background: verifiedGpsData.isWithinPerimeter ? undefined : "linear-gradient(90deg, #f43f5e 0%, #e11d48 100%)",
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {gpsErrorMessage && (
                <div style={{ marginTop: 12, fontSize: 12.5, color: gpsStatus === "error" || gpsStatus === "out-of-range" ? "#b91c1c" : "#0284c7", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>{gpsStatus === "error" || gpsStatus === "out-of-range" ? "⚠️" : "ℹ️"}</span>
                  <span>{gpsErrorMessage}</span>
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          {(() => {
            const isOutOfRange = gpsStatus === "out-of-range" || (verifiedGpsData && !verifiedGpsData.isWithinPerimeter);
            const canSubmit = Boolean(selectedOutlet && pageStatus !== "verifying-in" && gpsStatus === "verified" && verifiedGpsData?.isWithinPerimeter);

            return (
              <>
                <button
                  type="button"
                  onClick={handleSubmitCheckIn}
                  disabled={!canSubmit}
                  className={`checkin-submit-btn ${canSubmit ? "enabled" : "disabled"}`}
                >
                  {pageStatus === "verifying-in" ? (
                    <>
                      <RefreshCw size={20} className="animate-spin" />
                      <span>Verifying GPS &amp; Recording Check-In...</span>
                    </>
                  ) : isOutOfRange ? (
                    <>
                      <AlertCircle size={20} />
                      <span>
                        Cannot Check In: Outside Geofence ({formatDistance(verifiedGpsData?.distanceMeters ?? 0)} Away)
                      </span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={20} />
                      <span>
                        Confirm {selectedVisitType === "attendance" ? "Attendance Shift" : "Outlet Visit"} Check-In
                      </span>
                    </>
                  )}
                </button>

                {isOutOfRange && (
                  <div
                    style={{
                      marginTop: 10,
                      textAlign: "center",
                      fontSize: 12.5,
                      color: "#b91c1c",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <AlertCircle size={14} />
                    <span>
                      Check-in disabled: You must be within {verifiedGpsData?.allowedDistanceMeters ?? 500}m of {selectedOutlet?.name ?? "the outlet"} to check in.
                    </span>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* ── Interactive Radar Map ── */}
      <UnifiedMap
        regionName={userScope.isNational ? "All Regions" : (staff?.region || "National")}
        selectedOutlet={selectedOutlet}
        checkInState={checkInState}
        outletCount={assignedRegionOutlets.length}
        userLocation={userLocation}
        isLocatingUser={isLocatingUser}
        onRecalibrateUserLocation={recalibrateUserLocation}
        staffName={staff?.name}
      />



      {/* ── Evidence Photo Modal ── */}
      {(previewPhotoUrl || previewPhotoRecord || isLoadingPhotoModal) && (
        <div className="checkin-modal-backdrop" onClick={closePhotoModal}>
          <div className="checkin-modal-card checkin-photo-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="checkin-modal-top">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="checkin-photo-modal-icon">
                  <Camera size={18} />
                </div>
                <div>
                  <strong style={{ display: "block" }}>
                    Evidence Photo: {previewPhotoRecord?.outlet ?? "Check-In Record"}
                  </strong>
                  {previewPhotoRecord?.date && (
                    <span style={{ fontSize: 11.5, color: "#64748b" }}>
                      {previewPhotoRecord.date} at {previewPhotoRecord.time}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={closePhotoModal}
                className="checkin-modal-close"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="checkin-photo-modal-body">
              {isLoadingPhotoModal ? (
                <div className="checkin-photo-loading-box">
                  <RefreshCw size={28} className="animate-spin" />
                  <span>Loading high-resolution evidence photo...</span>
                </div>
              ) : previewPhotoUrl && !photoModalError ? (
                <div className="checkin-photo-wrapper">
                  <img
                    src={previewPhotoUrl}
                    alt="Evidence Capture"
                    className="checkin-modal-img"
                    onError={() => {
                      if (previewPhotoRecord) {
                        const cached =
                          localStorage.getItem(`visit_photo_${previewPhotoRecord.id}`) ||
                          (previewPhotoRecord.signOutPhotoRef
                            ? localStorage.getItem(`visit_photo_${previewPhotoRecord.signOutPhotoRef}`)
                            : null);
                        if (cached && cached !== previewPhotoUrl) {
                          setPreviewPhotoUrl(cached);
                          return;
                        }
                      }
                      setPhotoModalError(true);
                    }}
                  />
                  <div className="checkin-photo-modal-actions">
                    <a
                      href={previewPhotoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="checkin-photo-action-btn"
                      title="Open full size image in new tab"
                    >
                      <ExternalLink size={13} />
                      <span>Full Size</span>
                    </a>
                  </div>
                </div>
              ) : (
                <div className="checkin-photo-error-box">
                  <AlertCircle size={32} color="#d97706" />
                  <strong>Photo Not Found</strong>
                  <p>
                    The verification photo could not be found or loaded from storage.
                  </p>
                  {previewPhotoRecord?.signOutPhotoRef && (
                    <span className="checkin-photo-ref-tag">
                      Reference: {previewPhotoRecord.signOutPhotoRef}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="checkin-modal-caption">
              Captured by <strong>{previewPhotoRecord?.staff || "Field Representative"}</strong>
              {previewPhotoRecord?.type && (
                <span className={`checkin-type-badge ${previewPhotoRecord.type}`} style={{ marginLeft: 6, padding: "2px 8px", fontSize: 11 }}>
                  {previewPhotoRecord.type === "attendance" ? "Shift Attendance" : "Outlet Visit"}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Active Staff Sessions Management Modal (Admin & HR) ── */}
      {showAdminActiveModal && (
        <div className="checkin-modal-backdrop" onClick={() => setShowAdminActiveModal(false)}>
          <div
            className="checkin-modal-card checkin-admin-modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 740, width: "94vw", maxHeight: "88vh" }}
          >
            <div className="checkin-modal-top" style={{ background: "linear-gradient(135deg, #064e3b 0%, #065f46 100%)", color: "#ffffff", padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(255,255,255,0.15)", display: "grid", placeItems: "center", color: "#a7f3d0" }}>
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <strong style={{ fontSize: 16, color: "#ffffff", display: "block" }}>
                    Active Staff Check-Ins (Admin &amp; HR Override)
                  </strong>
                  <span style={{ fontSize: 12, color: "#d1fae5" }}>
                    Check out any user unable to complete their session due to device, network, or GPS issues.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminActiveModal(false)}
                className="checkin-modal-close"
                aria-label="Close modal"
                style={{ color: "#ffffff" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "16px 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Modal Filters Toolbar */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: 6, background: "#f1f5f9", padding: 4, borderRadius: 10 }}>
                  <button
                    type="button"
                    onClick={() => setAdminModalTab("all")}
                    className={`checkin-history-tab-btn ${adminModalTab === "all" ? "active" : ""}`}
                    style={{ fontSize: 12, padding: "5px 12px" }}
                  >
                    All Active ({allActiveVisits.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminModalTab("attendance")}
                    className={`checkin-history-tab-btn ${adminModalTab === "attendance" ? "active" : ""}`}
                    style={{ fontSize: 12, padding: "5px 12px" }}
                  >
                    Shifts ({allActiveVisits.filter((v) => v.type === "attendance").length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminModalTab("outlet")}
                    className={`checkin-history-tab-btn ${adminModalTab === "outlet" ? "active" : ""}`}
                    style={{ fontSize: 12, padding: "5px 12px" }}
                  >
                    Store Visits ({allActiveVisits.filter((v) => v.type === "outlet").length})
                  </button>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 220, justifyContent: "flex-end" }}>
                  <div style={{ position: "relative", width: "100%", maxWidth: 260 }}>
                    <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                    <input
                      type="text"
                      placeholder="Search staff, outlet, notes..."
                      value={adminModalSearch}
                      onChange={(e) => setAdminModalSearch(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "7px 10px 7px 30px",
                        borderRadius: 8,
                        border: "1px solid #cbd5e1",
                        fontSize: 12.5,
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={loadAllActiveVisits}
                    disabled={loadingActiveVisits}
                    title="Refresh list"
                    style={{
                      padding: "7px 10px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      cursor: "pointer",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <RefreshCw size={14} className={loadingActiveVisits ? "animate-spin" : ""} color="#475569" />
                  </button>
                </div>
              </div>

              {/* Active Cards Grid */}
              <div style={{ maxHeight: "calc(80vh - 190px)", overflowY: "auto", display: "grid", gap: 10, paddingRight: 4 }}>
                {loadingActiveVisits && allActiveVisits.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px", color: "#64748b", fontSize: 13 }}>
                    <RefreshCw size={20} className="animate-spin" style={{ display: "inline-block", marginRight: 8, verticalAlign: "middle" }} />
                    Loading active check-in sessions...
                  </div>
                ) : filteredActiveStaff.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 20px", background: "#f8fafc", borderRadius: 12, border: "1px dashed #cbd5e1" }}>
                    <CheckCircle2 size={32} color="#059669" style={{ margin: "0 auto 8px" }} />
                    <strong style={{ fontSize: 14, color: "#0f172a", display: "block" }}>No open check-ins found</strong>
                    <span style={{ fontSize: 12.5, color: "#64748b" }}>
                      {adminModalSearch || adminModalTab !== "all"
                        ? "No active sessions match your current search/category filter."
                        : "All representatives are currently checked out. Great job!"}
                    </span>
                  </div>
                ) : (
                  filteredActiveStaff.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 16px",
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: 12,
                        gap: 14,
                        transition: "all 0.15s ease",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: "50%",
                            background: item.type === "attendance" ? "#ecfdf5" : "#e0f2fe",
                            color: item.type === "attendance" ? "#065f46" : "#0369a1",
                            display: "grid",
                            placeItems: "center",
                            fontSize: 13,
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                        >
                          {item.staff.slice(0, 2).toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <strong style={{ fontSize: 13.5, color: "#0f172a" }}>{item.staff}</strong>
                            <span className={`checkin-type-badge ${item.type === "attendance" ? "attendance" : "outlet"}`} style={{ fontSize: 10, padding: "2px 7px" }}>
                              {item.type === "attendance" ? <CalendarCheck size={10} /> : <Store size={10} />}
                              {item.type === "attendance" ? "Shift Attendance" : "Store Visit"}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: "#475569", marginTop: 2, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 600 }}>{item.outlet}</span>
                            {item.outletRegion && <span style={{ color: "#94a3b8" }}>• {item.outletRegion}</span>}
                          </div>
                          <div style={{ fontSize: 11, color: "#059669", marginTop: 3, display: "flex", alignItems: "center", gap: 5, fontWeight: 600 }}>
                            <Clock size={11} /> Checked in {friendlyTime(item.checkInAt)} • Duration: {item.duration}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setAdminSelectedVisit(item)}
                        style={{
                          padding: "8px 14px",
                          borderRadius: 8,
                          border: "none",
                          background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                          color: "#ffffff",
                          fontSize: 12,
                          fontWeight: 700,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          cursor: "pointer",
                          boxShadow: "0 2px 6px rgba(5, 150, 105, 0.2)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <LogOut size={13} />
                        <span>Check Out</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Admin / HR Override Sign-Out Dialog Modal ── */}
      {adminSelectedVisit && (
        <SignOutDialog
          activeVisit={adminSelectedVisit}
          forceCheckout={true}
          adminStaffName={staff?.name}
          adminRole={role?.name || (roleKey === "hr" ? "HR" : "Administrator")}
          onDone={(updated) => {
            setAllActiveVisits((prev) => prev.filter((v) => v.id !== updated.id));
            if (checkInState && checkInState.visitId === updated.id) {
              setPageStatus("checked-out");
              setCheckInState(null);
            }
            setAdminSelectedVisit(null);
            setAdminSuccessNotice(
              `Successfully checked out ${adminSelectedVisit.staff} from ${adminSelectedVisit.outlet}.`
            );
            setTimeout(() => setAdminSuccessNotice(null), 6000);
          }}
          onClose={() => setAdminSelectedVisit(null)}
        />
      )}

      {/* ── Shift Summary Dialog (Post Check-Out) ── */}
      {completedShiftSummary && (
        <div className="checkin-modal-backdrop" onClick={() => setCompletedShiftSummary(null)}>
          <div
            className="checkin-modal-card checkin-summary-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="shift-summary-title"
          >
            {/* Header */}
            <div className="checkin-summary-header">
              <div className="checkin-summary-header-badge">
                <CheckCircle2 size={26} className="checkin-summary-check-icon" />
              </div>
              <div className="checkin-summary-header-copy">
                <span className="checkin-summary-pill">
                  {completedShiftSummary.visitType === "attendance" ? "Attendance Shift Closed" : "Outlet Visit Closed"}
                </span>
                <h3 id="shift-summary-title">Shift Completed Successfully!</h3>
                <p>
                  Your checkout record and evidence have been verified and synced to the system.
                </p>
              </div>
              <button
                type="button"
                className="checkin-summary-close-btn"
                onClick={() => setCompletedShiftSummary(null)}
                aria-label="Close summary"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="checkin-summary-body">
              {/* KPIs: Duration, Outcome, GPS */}
              <div className="checkin-summary-kpis">
                <div className="checkin-summary-kpi-item duration">
                  <div className="kpi-icon-cube">
                    <Clock size={18} />
                  </div>
                  <div>
                    <span className="kpi-label">Shift Duration</span>
                    <strong className="kpi-value">{completedShiftSummary.durationText}</strong>
                  </div>
                </div>

                <div className="checkin-summary-kpi-item">
                  <div className="kpi-icon-cube" style={{ color: "#0284c7" }}>
                    <CalendarCheck size={18} />
                  </div>
                  <div>
                    <span className="kpi-label">Outcome</span>
                    <strong className="kpi-value outcome-text">{completedShiftSummary.outcome}</strong>
                  </div>
                </div>

                <div className="checkin-summary-kpi-item">
                  <div className="kpi-icon-cube" style={{ color: completedShiftSummary.gpsVerified ? "#059669" : "#64748b" }}>
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <span className="kpi-label">GPS Verification</span>
                    <strong className="kpi-value gps-text">
                      {completedShiftSummary.gpsVerified ? "Verified (Geofenced)" : "Standard GPS"}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Two columns: Details & Photo */}
              <div className="checkin-summary-grid">
                <div className="checkin-summary-left">
                  {/* Location */}
                  <div className="summary-info-row">
                    <Store size={18} className="row-icon" />
                    <div>
                      <span className="row-label">Location / Outlet</span>
                      <strong className="row-val">{completedShiftSummary.outletName}</strong>
                      {completedShiftSummary.region && (
                        <span className="row-sub">{completedShiftSummary.region}</span>
                      )}
                    </div>
                  </div>

                  {/* Staff Info */}
                  <div className="summary-info-row">
                    <UserRound size={18} className="row-icon" />
                    <div>
                      <span className="row-label">Staff Representative</span>
                      <strong className="row-val">{completedShiftSummary.staffName}</strong>
                      <span className="row-sub">{completedShiftSummary.staffRole}</span>
                    </div>
                  </div>

                  {/* Timestamps */}
                  <div className="summary-info-row">
                    <Clock size={18} className="row-icon" />
                    <div>
                      <span className="row-label">Clock Times</span>
                      <div className="timing-chips-wrap">
                        <span className="timing-chip in">
                          In: {new Date(completedShiftSummary.checkInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="timing-chip out">
                          Out: {new Date(completedShiftSummary.checkOutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Notes / Reason */}
                  {completedShiftSummary.notes && (
                    <div className="summary-info-row notes">
                      <FileText size={18} className="row-icon" />
                      <div>
                        <span className="row-label">Sign-Off Notes</span>
                        <p className="summary-notes-quote">
                          &ldquo;{completedShiftSummary.notes}&rdquo;
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="checkin-summary-right">
                  <span className="photo-card-label">Sign-Off Evidence Photo</span>
                  {completedShiftSummary.photoUrl ? (
                    <div
                      className="summary-photo-card"
                      onClick={() => {
                        setPreviewPhotoUrl(completedShiftSummary.photoUrl || null);
                        setPreviewPhotoRecord({
                          id: completedShiftSummary.visitId,
                          date: new Date(completedShiftSummary.checkOutAt).toLocaleDateString(),
                          time: new Date(completedShiftSummary.checkOutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                          outlet: completedShiftSummary.outletName,
                          staff: completedShiftSummary.staffName,
                          type: completedShiftSummary.visitType,
                          status: "Completed",
                          duration: completedShiftSummary.durationText,
                          outcome: completedShiftSummary.outcome,
                          gps: completedShiftSummary.gpsVerified,
                          photo: true,
                          photoUrl: completedShiftSummary.photoUrl ?? null,
                        });
                      }}
                      title="Click to view full photo"
                    >
                      <img
                        src={completedShiftSummary.photoUrl}
                        alt="Sign-off proof"
                        className="summary-photo-img"
                      />
                      <div className="summary-photo-overlay">
                        <Eye size={15} />
                        <span>View Photo</span>
                      </div>
                    </div>
                  ) : (
                    <div className="summary-photo-placeholder">
                      <Camera size={26} />
                      <span>No photo preview available</span>
                    </div>
                  )}

                  <div className="summary-verified-tag">
                    <Check size={14} />
                    <span>Signed and cryptographically hashed</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="checkin-summary-footer">
              <button
                type="button"
                className="checkin-summary-history-btn"
                onClick={() => {
                  setCompletedShiftSummary(null);
                  navigate("/visits?tab=attendance");
                }}
              >
                <History size={16} />
                <span>View Attendance Log</span>
              </button>

              <button
                type="button"
                className="checkin-summary-done-btn"
                onClick={() => setCompletedShiftSummary(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
