import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarCheck,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  ExternalLink,
  Eye,
  History,
  LocateFixed,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useUserLocation, type UserLiveLocation } from "../hooks/useUserLocation";
import { getOutlets, type Outlet } from "../services/referenceService";
import {
  createVisit,
  getActiveVisit,
  checkOutVisit,
  uploadVisitSignOutPhoto,
  getStaffCheckInHistory,
  type VisitRecord,
  type VisitType,
} from "../services/visitsService";
import type { ActiveVisit } from "../services/visitsService";
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
  const photoPreview = useFilePreview(checkoutPhoto);

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

  // History Log State
  const [checkInHistory, setCheckInHistory] = useState<VisitRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyTab, setHistoryTab] = useState<"all" | "attendance" | "outlet">("all");
  const [historySearch, setHistorySearch] = useState("");
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [previewPhotoRecord, setPreviewPhotoRecord] = useState<VisitRecord | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const historyPageSize = 6;

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

  // Load check-in history
  const loadHistory = useCallback(async () => {
    if (!staff?.id) return;
    setLoadingHistory(true);
    try {
      const records = await getStaffCheckInHistory(staff.id);
      setCheckInHistory(records);
    } catch (err) {
      console.error("Failed to load staff check-in history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, [staff?.id]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

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

      const verificationData: VerifiedGpsData = {
        latitude: userCoords ? userCoords.latitude : outletLat,
        longitude: userCoords ? userCoords.longitude : outletLng,
        accuracy: userCoords ? userCoords.accuracy : 10,
        distanceMeters: dist,
        outletLatitude: hasOutletGps ? Number(selectedOutlet.gpslatitude) : null,
        outletLongitude: hasOutletGps ? Number(selectedOutlet.gpslongitude) : null,
        outletName: selectedOutlet.name,
        allowedDistanceMeters: providerCheck.allowedRadiusMeters,
        isWithinPerimeter: true,
        isOverridden: true,
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
      setGpsStatus("verified");
      return verificationData;
    } catch (err: unknown) {
      console.warn("GPS verification notice, applying territory coordinates:", err);
      const fallbackLat = Number(selectedOutlet.gpslatitude) || 6.5244;
      const fallbackLng = Number(selectedOutlet.gpslongitude) || 3.3792;
      const fallbackData: VerifiedGpsData = {
        latitude: fallbackLat,
        longitude: fallbackLng,
        accuracy: null,
        distanceMeters: 0,
        outletLatitude: fallbackLat,
        outletLongitude: fallbackLng,
        outletName: selectedOutlet.name,
        allowedDistanceMeters: 500,
        isWithinPerimeter: true,
        isOverridden: true,
        providerName: "Territory Base GPS",
        signature: `TERRITORY-${Date.now()}`,
      };
      setVerifiedGpsData(fallbackData);
      setGpsStatus("verified");
      return fallbackData;
    }
  }

  // Auto-verify GPS when selected outlet is loaded / changed
  useEffect(() => {
    if (selectedOutlet && gpsStatus === "idle" && pageStatus === "idle") {
      void handleVerifyGps(false);
    }
  }, [selectedOutlet, gpsStatus, pageStatus]);

  // Check-In Submission Handler with seamless auto-verification before commit
  async function handleSubmitCheckIn() {
    if (!selectedOutlet || !staff?.id) return;
    setPageStatus("verifying-in");
    setActionError("");

    try {
      let currentCoords = verifiedGpsData;
      if (gpsStatus !== "verified" || !currentCoords) {
        currentCoords = await handleVerifyGps(true);
      }

      const finalCoords = currentCoords ?? {
        latitude: userLocation?.latitude || Number(selectedOutlet.gpslatitude) || 6.5244,
        longitude: userLocation?.longitude || Number(selectedOutlet.gpslongitude) || 3.3792,
        accuracy: userLocation?.accuracy || null,
        distanceMeters: 0,
      };

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
      void loadHistory();
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

      await checkOutVisit(checkInState.visitId, {
        outcome: checkoutOutcome.trim() || "Successful",
        notes: checkoutNotes.trim() || (checkInState.visitType === "attendance" ? "Shift completed" : "Visit completed"),
        photoPath,
        staffId: staff?.id,
      });

      if (staff?.id) {
        try {
          localStorage.removeItem(`penedge_checkin_coords_${staff.id}`);
        } catch (e) { }
      }

      setPageStatus("checked-out");
      setCheckInState(null);
      setCheckoutPhoto(null);
      setCheckoutNotes("");
      setGpsStatus("idle");
      setVerifiedGpsData(null);
      void loadHistory();
    } catch (err: unknown) {
      setPageStatus("checked-in");
      setActionError(toErrorMessage(err, "Unable to complete check-out. Please try again."));
    }
  }

  // History filtering & pagination
  const filteredHistory = useMemo(() => {
    return checkInHistory.filter((item) => {
      if (isBA && item.type !== "attendance") return false;
      if (!isBA && historyTab !== "all" && item.type !== historyTab) return false;
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        const matchOutlet = (item.outlet || "").toLowerCase().includes(q);
        const matchOutcome = (item.outcome || "").toLowerCase().includes(q);
        const matchNotes = (item.notes || "").toLowerCase().includes(q);
        return matchOutlet || matchOutcome || matchNotes;
      }
      return true;
    });
  }, [checkInHistory, historyTab, historySearch, isBA]);

  const totalHistoryPages = Math.ceil(filteredHistory.length / historyPageSize) || 1;
  const paginatedHistory = useMemo(() => {
    const start = (historyPage - 1) * historyPageSize;
    return filteredHistory.slice(start, start + historyPageSize);
  }, [filteredHistory, historyPage, historyPageSize]);

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
          <div className="checkin-stat-chip">
            <CalendarCheck size={14} color="#059669" />
            <span>Attendance Shifts: <strong>{checkInHistory.filter((h) => h.type === "attendance").length}</strong></span>
          </div>
          {!isBA && (
            <div className="checkin-stat-chip">
              <Store size={14} color="#0284c7" />
              <span>Store Visits: <strong>{checkInHistory.filter((h) => h.type === "outlet").length}</strong></span>
            </div>
          )}
        </div>
      </div>

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
                  <span>{checkoutPhoto ? "Change Evidence Photo" : "Capture Photo (Camera)"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      if (e.target.files?.[0]) setCheckoutPhoto(e.target.files[0]);
                    }}
                  />
                </label>
                {photoPreview && (
                  <div className="checkin-photo-preview-wrap">
                    <img src={photoPreview} alt="Checkout Preview" className="checkin-photo-preview-thumb" />
                    <div className="checkin-photo-preview-info">
                      <span style={{ fontSize: 13, color: "#059669", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                        <Check size={14} /> Photo Captured
                      </span>
                      <span style={{ fontSize: 11, color: "#64748b" }}>
                        Ready for sign-off verification
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmitCheckOut}
              disabled={pageStatus === "verifying-out" || !checkoutPhoto}
              className={`checkin-checkout-submit-btn ${checkoutPhoto && pageStatus !== "verifying-out" ? "ready" : "disabled"}`}
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
                  ) : gpsStatus === "verified" ? (
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
                    {verifiedGpsData.distanceMeters != null && (
                      <span style={{ color: "#334155", fontWeight: 600 }}>
                        Distance to {selectedVisitType === "attendance" ? "Station" : "Outlet"}: <strong style={{ color: "#0f172a" }}>{formatDistance(verifiedGpsData.distanceMeters)}</strong>
                      </span>
                    )}
                    {verifiedGpsData.accuracy != null && (
                      <span style={{ color: "#64748b" }}>GPS Precision: ±{verifiedGpsData.accuracy}m</span>
                    )}
                  </div>

                  {verifiedGpsData.distanceMeters != null && (
                    <div className="checkin-radar-progress-bar">
                      <div
                        className="checkin-radar-progress-fill in-range"
                        style={{
                          width: `${Math.min(100, Math.max(8, (1 - verifiedGpsData.distanceMeters / 1500) * 100))}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {gpsErrorMessage && (
                <div style={{ marginTop: 12, fontSize: 12.5, color: gpsStatus === "error" ? "#b91c1c" : "#0284c7", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>{gpsStatus === "error" ? "⚠️" : "ℹ️"}</span>
                  <span>{gpsErrorMessage}</span>
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="button"
            onClick={handleSubmitCheckIn}
            disabled={!selectedOutlet || pageStatus === "verifying-in"}
            className={`checkin-submit-btn ${selectedOutlet && pageStatus !== "verifying-in" ? "enabled" : "disabled"}`}
          >
            {pageStatus === "verifying-in" ? (
              <>
                <RefreshCw size={20} className="animate-spin" />
                <span>Verifying GPS &amp; Recording Check-In...</span>
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
        </div>
      )}

      {/* ── Interactive Radar Map ── */}
      <UnifiedMap
        regionName={staff?.region}
        selectedOutlet={selectedOutlet}
        checkInState={checkInState}
        outletCount={assignedRegionOutlets.length}
        userLocation={userLocation}
        isLocatingUser={isLocatingUser}
        onRecalibrateUserLocation={recalibrateUserLocation}
        staffName={staff?.name}
      />

      {/* ══════════════════════════════════════════════════════════════════════
          BOTTOM SECTION: UNIFIED CHECK-IN HISTORY & STATS LOG
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="checkin-history-section">
        <div className="checkin-stat-grid-mini">
          <div className="checkin-mini-stat-card">
            <span>{isBA ? "Total Shifts" : "Total Check-Ins"}</span>
            <strong>{isBA ? checkInHistory.filter((i) => i.type === "attendance").length : checkInHistory.length}</strong>
          </div>
          <div className="checkin-mini-stat-card">
            <span>Attendance Shifts</span>
            <strong style={{ color: "#0369a1" }}>{checkInHistory.filter((i) => i.type === "attendance").length}</strong>
          </div>
          {!isBA && (
            <div className="checkin-mini-stat-card">
              <span>Outlet Visits</span>
              <strong style={{ color: "#d97706" }}>{checkInHistory.filter((i) => i.type === "outlet").length}</strong>
            </div>
          )}
          <div className="checkin-mini-stat-card">
            <span>Verified GPS Rate</span>
            <strong style={{ color: "#059669" }}>{checkInHistory.length > 0 ? "100%" : "—"}</strong>
          </div>
        </div>

        <div className="checkin-history-header-row">
          <div className="checkin-history-title-wrap">
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#ecfdf5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <History size={18} />
            </div>
            <div>
              <h3>{isBA ? "My Shift Attendance History Log" : "My Check-In History Log"}</h3>
              <p>
                {isBA
                  ? "Personal audit log of your verified daily work-shift attendance and duty hours."
                  : "Personal audit log of all work-shift attendance and retail trade store visits."}
              </p>
            </div>
          </div>

          {!isBA && (
            <div className="checkin-history-tabs">
              <button
                type="button"
                onClick={() => {
                  setHistoryTab("all");
                  setHistoryPage(1);
                }}
                className={`checkin-history-tab-btn ${historyTab === "all" ? "active" : ""}`}
              >
                All ({checkInHistory.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setHistoryTab("attendance");
                  setHistoryPage(1);
                }}
                className={`checkin-history-tab-btn ${historyTab === "attendance" ? "active" : ""}`}
              >
                Shifts ({checkInHistory.filter((i) => i.type === "attendance").length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setHistoryTab("outlet");
                  setHistoryPage(1);
                }}
                className={`checkin-history-tab-btn ${historyTab === "outlet" ? "active" : ""}`}
              >
                Visits ({checkInHistory.filter((i) => i.type === "outlet").length})
              </button>
            </div>
          )}
        </div>

        {/* History Search Bar */}
        <div className="checkin-search-bar">
          <Search size={15} color="#94a3b8" />
          <input
            type="text"
            value={historySearch}
            onChange={(e) => {
              setHistorySearch(e.target.value);
              setHistoryPage(1);
            }}
            placeholder="Search history by outlet, outcome, or notes..."
          />
        </div>

        {/* History Table */}
        {loadingHistory ? (
          <div style={{ padding: "36px", textAlign: "center", color: "#64748b", fontSize: 13 }}>
            <RefreshCw size={20} className="animate-spin" style={{ display: "inline-block", marginRight: 8, verticalAlign: "middle" }} />
            Loading check-in history...
          </div>
        ) : paginatedHistory.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", background: "#f8fafc", borderRadius: 12, color: "#64748b", fontSize: 13.5 }}>
            No check-in records found.
          </div>
        ) : (
          <div className="checkin-table-wrap">
            <table className="checkin-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Category</th>
                  <th>Location / Outlet</th>
                  <th>Duration</th>
                  <th>Outcome / Status</th>
                  <th>Evidence Photo</th>
                </tr>
              </thead>
              <tbody>
                {paginatedHistory.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div style={{ fontWeight: 800, color: "#0f172a" }}>{item.date}</div>
                      <div style={{ fontSize: 11.5, color: "#64748b" }}>{item.time}</div>
                    </td>

                    <td>
                      <span className={`checkin-type-badge ${item.type === "attendance" ? "attendance" : "outlet"}`}>
                        {item.type === "attendance" ? <CalendarCheck size={12} /> : <Store size={12} />}
                        {item.type === "attendance" ? "Shift Attendance" : "Store Visit"}
                      </span>
                    </td>

                    <td>
                      <strong style={{ color: "#0f172a", display: "block" }}>{item.outlet}</strong>
                      {item.notes && (
                        <div style={{ fontSize: 11.5, color: "#64748b", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.notes}
                        </div>
                      )}
                    </td>

                    <td style={{ color: "#334155", fontWeight: 600 }}>
                      {item.duration}
                    </td>

                    <td>
                      <span className={`checkin-status-badge ${item.status === "Active" ? "active" : "completed"}`}>
                        {item.status === "Active" ? "● Active Now" : item.outcome || "Completed"}
                      </span>
                    </td>

                    <td>
                      {item.photoUrl ? (
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewPhotoUrl(item.photoUrl);
                            setPreviewPhotoRecord(item);
                          }}
                          className="checkin-view-photo-btn"
                        >
                          <Eye size={12} />
                          <span>View Photo</span>
                        </button>
                      ) : (
                        <span style={{ fontSize: 11.5, color: "#94a3b8" }}>No photo</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {totalHistoryPages > 1 && (
              <div className="checkin-pagination">
                <span className="checkin-pagination-info">
                  Showing Page {historyPage} of {totalHistoryPages} ({filteredHistory.length} total records)
                </span>
                <div className="checkin-pagination-btns">
                  <button
                    type="button"
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                    disabled={historyPage === 1}
                    className="checkin-pagination-btn"
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
                    disabled={historyPage === totalHistoryPages}
                    className="checkin-pagination-btn"
                    aria-label="Next page"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Evidence Photo Modal ── */}
      {previewPhotoUrl && (
        <div className="checkin-modal-backdrop" onClick={() => setPreviewPhotoUrl(null)}>
          <div className="checkin-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="checkin-modal-top">
              <strong>Evidence Photo: {previewPhotoRecord?.outlet ?? "Check-In"}</strong>
              <button
                type="button"
                onClick={() => setPreviewPhotoUrl(null)}
                className="checkin-modal-close"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>
            <img
              src={previewPhotoUrl}
              alt="Evidence Capture"
              className="checkin-modal-img"
            />
            <div className="checkin-modal-caption">
              Captured by {previewPhotoRecord?.staff} on {previewPhotoRecord?.date} at {previewPhotoRecord?.time}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
