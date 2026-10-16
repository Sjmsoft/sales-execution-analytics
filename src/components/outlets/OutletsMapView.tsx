import { useEffect, useMemo, useRef, useState } from "react";
import {
  Compass,
  Crosshair,
  ExternalLink,
  Key,
  MapPin,
  Maximize2,
  Minimize2,
  Navigation,
  Pencil,
  Phone,
  Search,
  Store,
  User,
  X,
} from "lucide-react";
import { isOutletOnTrade, isOutletOffTrade, type Outlet } from "../../services/referenceService";
import { distanceInMeters } from "../../pages/visits/visitsUtils";

// Nigeria center coordinates default
const NIGERIA_CENTER = { lat: 9.082, lng: 8.6753 };
const DEFAULT_ZOOM = 6;

// Region bounding presets
const REGION_PRESETS: Record<string, { lat: number; lng: number; zoom: number; label: string }> = {
  all: { lat: 8.5, lng: 7.5, zoom: 6, label: "All Nigeria" },
  lagos: { lat: 6.455, lng: 3.425, zoom: 12, label: "Lagos" },
  abuja: { lat: 9.065, lng: 7.485, zoom: 12, label: "Abuja (FCT)" },
  rivers: { lat: 4.818, lng: 7.042, zoom: 13, label: "Port Harcourt" },
  edo: { lat: 6.335, lng: 5.604, zoom: 13, label: "Benin City" },
  enugu: { lat: 6.448, lng: 7.514, zoom: 13, label: "Enugu" },
  oyo: { lat: 7.402, lng: 3.906, zoom: 13, label: "Ibadan" },
};

// Clean modern Google Maps styling
const GOOGLE_MAP_STYLES = [
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#dbeafe" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#f8fafc" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#f1f5f9" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#475569" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#f1f5f9" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#dcfce7" }] },
  { featureType: "administrative", elementType: "labels.text.fill", stylers: [{ color: "#1e293b" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
];

declare global {
  interface Window {
    google?: any;
    __googleMapsLoadingPromise?: Promise<void>;
  }
}

function loadGoogleMapsSdk(apiKey?: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if (window.google?.maps) return Promise.resolve();
  if (window.__googleMapsLoadingPromise) return window.__googleMapsLoadingPromise;

  window.__googleMapsLoadingPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById("penedge-google-maps-script");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", (e) => reject(e));
      return;
    }

    const script = document.createElement("script");
    script.id = "penedge-google-maps-script";
    const keyQuery = apiKey ? `&key=${encodeURIComponent(apiKey)}` : "";
    script.src = `https://maps.googleapis.com/maps/api/js?v=weekly${keyQuery}&libraries=places,marker`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      resolve();
    };

    script.onerror = (err) => {
      console.warn("Google Maps script failed to load:", err);
      reject(err);
    };

    document.head.appendChild(script);
  });

  return window.__googleMapsLoadingPromise;
}

interface OutletsMapViewProps {
  outlets: Outlet[];
  onEditOutlet?: (outlet: Outlet) => void;
  staffMap: Map<string, string>;
}

export default function OutletsMapView({
  outlets,
  onEditOutlet,
  staffMap,
}: OutletsMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);
  const infoWindowRef = useRef<any>(null);

  // States
  const [selectedOutlet, setSelectedOutlet] = useState<Outlet | null>(null);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [tradeFilter, setTradeFilter] = useState<"all" | "on-trade" | "off-trade">("all");
  const [activeRegion, setActiveRegion] = useState<string>("all");
  const [mapType, setMapType] = useState<"roadmap" | "satellite">("roadmap");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locatingUser, setLocatingUser] = useState(false);
  const [isSdkLoaded, setIsSdkLoaded] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [customApiKey, setCustomApiKey] = useState(() => {
    if (typeof window === "undefined") return "";
    return (
      (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY ||
      localStorage.getItem("penedge_google_maps_api_key") ||
      ""
    );
  });

  // Filter outlets with valid GPS coordinates
  const mappedOutlets = useMemo(() => {
    return outlets.filter((o) => {
      const hasGps =
        o.gpslatitude !== null &&
        o.gpslatitude !== undefined &&
        o.gpslongitude !== null &&
        o.gpslongitude !== undefined &&
        !isNaN(Number(o.gpslatitude)) &&
        !isNaN(Number(o.gpslongitude));
      if (!hasGps) return false;

      if (tradeFilter === "on-trade" && !isOutletOnTrade(o.outlet_type)) return false;
      if (tradeFilter === "off-trade" && !isOutletOffTrade(o.outlet_type)) return false;

      if (activeRegion !== "all") {
        const regionStateMap: Record<string, string> = {
          lagos: "Lagos",
          abuja: "FCT",
          rivers: "Rivers",
          edo: "Edo",
          enugu: "Enugu",
          oyo: "Oyo",
        };
        const expectedState = regionStateMap[activeRegion];
        if (expectedState && o.state !== expectedState) return false;
      }

      if (sidebarSearch.trim()) {
        const q = sidebarSearch.toLowerCase();
        const matchName = o.name.toLowerCase().includes(q);
        const matchAddr = o.address?.toLowerCase().includes(q);
        const matchLga = o.lga?.toLowerCase().includes(q);
        const matchState = o.state?.toLowerCase().includes(q);
        if (!matchName && !matchAddr && !matchLga && !matchState) return false;
      }

      return true;
    });
  }, [outlets, tradeFilter, sidebarSearch, activeRegion]);

  const unmappedCount = useMemo(() => {
    return outlets.length - mappedOutlets.length;
  }, [outlets.length, mappedOutlets.length]);

  // Initial SDK Load: only load JS SDK if customApiKey is provided and non-empty
  useEffect(() => {
    let isMounted = true;
    if (!customApiKey || !customApiKey.trim()) {
      setIsSdkLoaded(false);
      setSdkError(null);
      return;
    }

    loadGoogleMapsSdk(customApiKey)
      .then(() => {
        if (isMounted) {
          setIsSdkLoaded(true);
          setSdkError(null);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.warn("Google Maps JS API load error:", err);
          setSdkError("Google Maps JS API unavailable. Interactive embed active.");
          setIsSdkLoaded(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [customApiKey]);

  // Initialize Google Maps instance
  useEffect(() => {
    if (!isSdkLoaded || !mapContainerRef.current || !window.google?.maps) return;

    if (!mapInstanceRef.current) {
      const map = new window.google.maps.Map(mapContainerRef.current, {
        center: NIGERIA_CENTER,
        zoom: DEFAULT_ZOOM,
        styles: GOOGLE_MAP_STYLES,
        mapTypeId: mapType,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        zoomControlOptions: {
          position: window.google.maps.ControlPosition.RIGHT_BOTTOM,
        },
      });

      mapInstanceRef.current = map;
      infoWindowRef.current = new window.google.maps.InfoWindow({
        maxWidth: 320,
      });

      // Close selected outlet on map click
      map.addListener("click", () => {
        infoWindowRef.current?.close();
        setSelectedOutlet(null);
      });
    }
  }, [isSdkLoaded, mapType]);

  // Update map type
  useEffect(() => {
    if (mapInstanceRef.current && window.google?.maps) {
      mapInstanceRef.current.setMapTypeId(
        mapType === "satellite"
          ? window.google.maps.MapTypeId.HYBRID
          : window.google.maps.MapTypeId.ROADMAP
      );
    }
  }, [mapType]);

  // Update Markers on map
  useEffect(() => {
    if (!isSdkLoaded || !mapInstanceRef.current || !window.google?.maps) return;
    const map = mapInstanceRef.current;

    // Clear old markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    if (mappedOutlets.length === 0) return;

    const bounds = new window.google.maps.LatLngBounds();

    mappedOutlets.forEach((outlet) => {
      const lat = Number(outlet.gpslatitude);
      const lng = Number(outlet.gpslongitude);
      const isOnTrade = isOutletOnTrade(outlet.outlet_type);
      const isSelected = selectedOutlet?.id === outlet.id;

      // Custom Google Maps marker pin SVG
      const pinColor = isOnTrade ? "#059669" : "#d97706";
      const pinStroke = isSelected ? "#ffffff" : "#ffffff";
      const scale = isSelected ? 1.3 : 1.0;

      const marker = new window.google.maps.Marker({
        position: { lat, lng },
        map,
        title: outlet.name,
        animation: isSelected ? window.google.maps.Animation.BOUNCE : null,
        icon: {
          path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
          fillColor: pinColor,
          fillOpacity: 1,
          strokeColor: pinStroke,
          strokeWeight: 1.5,
          scale: 1.7 * scale,
          anchor: new window.google.maps.Point(12, 22),
        },
      });

      marker.addListener("click", () => {
        setSelectedOutlet(outlet);

        // Build InfoWindow Content
        const managerName =
          outlet.assigned_manager && staffMap.has(outlet.assigned_manager)
            ? staffMap.get(outlet.assigned_manager)
            : outlet.assigned_manager || "Unassigned";

        const content = `
          <div style="font-family: Inter, system-ui, sans-serif; padding: 4px 2px; color: #17201d;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px;">
              <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; background: ${isOnTrade ? "#ecfdf5" : "#fffbeb"}; color: ${isOnTrade ? "#065f46" : "#b45309"}; border: 1px solid ${isOnTrade ? "#a7f3d0" : "#fde68a"};">
                ${isOnTrade ? "ON-TRADE" : "OFF-TRADE"}
              </span>
              <span style="font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px; background: ${outlet.listing_status === 1 ? "#dcfce7" : "#f1f5f9"}; color: ${outlet.listing_status === 1 ? "#15803d" : "#64748b"};">
                ${outlet.listing_status === 1 ? "Listed" : "Unlisted"}
              </span>
            </div>
            <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 700; color: #083e32;">
              ${outlet.name}
            </h4>
            <p style="margin: 0 0 6px 0; font-size: 11.5px; color: #4b5563; line-height: 1.35;">
              📍 ${outlet.address || ""}${outlet.lga ? `, ${outlet.lga}` : ""}${outlet.state ? ` (${outlet.state})` : ""}
            </p>
            <div style="font-size: 11px; color: #64748b; margin-bottom: 8px; border-top: 1px solid #f1f5f9; padding-top: 5px;">
              👤 Manager: <strong style="color: #1f2937;">${managerName}</strong>
              ${outlet.contact_person_phone ? `<br/>📞 <a href="tel:${outlet.contact_person_phone}" style="color: #083e32; font-weight: 600; text-decoration: none;">${outlet.contact_person_phone}</a>` : ""}
            </div>
            <div style="display: flex; gap: 6px; margin-top: 6px;">
              <a 
                href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" 
                target="_blank" 
                rel="noopener noreferrer"
                style="flex: 1; text-align: center; background: #083e32; color: #ffffff; text-decoration: none; padding: 5px 8px; border-radius: 6px; font-size: 11px; font-weight: 600;"
              >
                Directions ↗
              </a>
            </div>
          </div>
        `;

        if (infoWindowRef.current) {
          infoWindowRef.current.setContent(content);
          infoWindowRef.current.open(map, marker);
        }
      });

      markersRef.current.push(marker);
      bounds.extend({ lat, lng });
    });

    // Auto-fit bounds if no region is explicitly locked
    if (activeRegion === "all" && mappedOutlets.length > 0 && !selectedOutlet) {
      map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
    }
  }, [mappedOutlets, isSdkLoaded, selectedOutlet, staffMap, activeRegion]);

  // Handle Pan to specific outlet
  const handleFocusOutlet = (outlet: Outlet) => {
    setSelectedOutlet(outlet);
    const lat = Number(outlet.gpslatitude);
    const lng = Number(outlet.gpslongitude);

    if (mapInstanceRef.current && !isNaN(lat) && !isNaN(lng)) {
      mapInstanceRef.current.panTo({ lat, lng });
      mapInstanceRef.current.setZoom(16);

      // Open InfoWindow for this marker
      const matchingMarker = markersRef.current.find(
        (m) =>
          Math.abs(m.getPosition().lat() - lat) < 0.0001 &&
          Math.abs(m.getPosition().lng() - lng) < 0.0001
      );
      if (matchingMarker && infoWindowRef.current) {
        window.google.maps.event.trigger(matchingMarker, "click");
      }
    }
  };

  // Region preset jump
  const handleSelectRegion = (key: string) => {
    setActiveRegion(key);
    setSelectedOutlet(null);
    infoWindowRef.current?.close();

    const preset = REGION_PRESETS[key];
    if (preset && mapInstanceRef.current) {
      mapInstanceRef.current.panTo({ lat: preset.lat, lng: preset.lng });
      mapInstanceRef.current.setZoom(preset.zoom);
    }
  };

  // User Geolocation
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocatingUser(false);
        const userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(userPos);

        if (mapInstanceRef.current && window.google?.maps) {
          mapInstanceRef.current.panTo(userPos);
          mapInstanceRef.current.setZoom(14);

          if (userMarkerRef.current) {
            userMarkerRef.current.setMap(null);
          }

          userMarkerRef.current = new window.google.maps.Marker({
            position: userPos,
            map: mapInstanceRef.current,
            title: "Your Location",
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: "#2563eb",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
            },
          });
        }
      },
      (err) => {
        setLocatingUser(false);
        alert(`Unable to retrieve location: ${err.message}`);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Fallback Google Maps Embed URL
  const embedCenter = selectedOutlet
    ? { lat: Number(selectedOutlet.gpslatitude), lng: Number(selectedOutlet.gpslongitude), zoom: 16 }
    : REGION_PRESETS[activeRegion] || NIGERIA_CENTER;

  const embedUrl = `https://www.google.com/maps?q=${embedCenter.lat},${embedCenter.lng}&z=${embedCenter.zoom || 14}&t=${mapType === "satellite" ? "k" : "m"}&output=embed`;

  return (
    <div className="outlets-map-view-wrapper">
      {/* ── Top Map Control Bar ───────────────────────────────── */}
      <div className="map-view-toolbar">
        <div className="toolbar-left-stats">
          <div className="map-stat-chip">
            <MapPin size={14} color="#059669" />
            <span>
              <strong>{mappedOutlets.length}</strong> Outlets Mapped
            </span>
          </div>
          <div className="map-stat-chip-divider" />
          <div className="map-legend-pills">
            <span className="legend-dot on-trade" />
            <span className="legend-label">On-Trade ({outlets.filter((o) => isOutletOnTrade(o.outlet_type)).length})</span>
            <span className="legend-dot off-trade" />
            <span className="legend-label">Off-Trade ({outlets.filter((o) => isOutletOffTrade(o.outlet_type)).length})</span>
          </div>
        </div>

        {/* Quick Region Selector */}
        <div className="map-region-pills-scroll">
          {Object.entries(REGION_PRESETS).map(([key, val]) => (
            <button
              key={key}
              type="button"
              className={`region-pill-btn ${activeRegion === key ? "active" : ""}`}
              onClick={() => handleSelectRegion(key)}
            >
              {val.label}
            </button>
          ))}
        </div>

        {/* Right Tools */}
        <div className="toolbar-right-tools">
          {/* Map Type Switcher */}
          <div className="map-type-toggle">
            <button
              type="button"
              className={mapType === "roadmap" ? "active" : ""}
              onClick={() => setMapType("roadmap")}
              title="Standard Roadmap"
            >
              Map
            </button>
            <button
              type="button"
              className={mapType === "satellite" ? "active" : ""}
              onClick={() => setMapType("satellite")}
              title="Satellite / Aerial Imagery"
            >
              Satellite
            </button>
          </div>

          {/* Locate Me */}
          <button
            type="button"
            className={`map-tool-btn ${userLocation ? "located" : ""}`}
            onClick={handleLocateMe}
            disabled={locatingUser}
            title="Locate my position on map"
          >
            <Crosshair size={14} className={locatingUser ? "spinning" : ""} />
            <span className="btn-label-desktop">Locate Me</span>
          </button>

          {/* Re-center / Fit bounds */}
          <button
            type="button"
            className="map-tool-btn"
            onClick={() => handleSelectRegion("all")}
            title="Fit all outlets in view"
          >
            <Compass size={14} />
            <span className="btn-label-desktop">Fit All</span>
          </button>

          {/* Toggle Directory Sidebar */}
          <button
            type="button"
            className="map-tool-btn"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            title={sidebarCollapsed ? "Show Directory" : "Hide Directory"}
          >
            {sidebarCollapsed ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </button>

          {/* Optional API Key Settings */}
          <button
            type="button"
            className="map-tool-btn key-btn"
            onClick={() => setApiKeyModalOpen(true)}
            title="Google Maps API Key Configuration"
          >
            <Key size={13} />
          </button>
        </div>
      </div>

      {/* ── Main Split Canvas ───────────────────────────────────── */}
      <div className="map-view-split-layout">
        {/* Left Outlets Directory Drawer */}
        {!sidebarCollapsed && (
          <aside className="map-outlets-drawer" aria-label="Outlet Directory">
            {/* Drawer Search & Filter */}
            <div className="drawer-header-controls">
              <div className="drawer-search-wrap">
                <Search size={14} className="drawer-search-icon" />
                <input
                  type="text"
                  placeholder="Filter mapped outlets..."
                  value={sidebarSearch}
                  onChange={(e) => setSidebarSearch(e.target.value)}
                />
                {sidebarSearch && (
                  <button
                    type="button"
                    onClick={() => setSidebarSearch("")}
                    className="drawer-clear-search"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Trade Type Filter Tabs */}
              <div className="drawer-trade-tabs">
                <button
                  type="button"
                  className={tradeFilter === "all" ? "active" : ""}
                  onClick={() => setTradeFilter("all")}
                >
                  All ({mappedOutlets.length})
                </button>
                <button
                  type="button"
                  className={tradeFilter === "on-trade" ? "active" : ""}
                  onClick={() => setTradeFilter("on-trade")}
                >
                  On-Trade
                </button>
                <button
                  type="button"
                  className={tradeFilter === "off-trade" ? "active" : ""}
                  onClick={() => setTradeFilter("off-trade")}
                >
                  Off-Trade
                </button>
              </div>
            </div>

            {/* Outlets Scrollable Cards */}
            <div className="drawer-outlets-scroll">
              {mappedOutlets.length === 0 ? (
                <div className="drawer-empty-state">
                  <Store size={24} color="#94a3b8" />
                  <p>No outlets found with GPS coordinates</p>
                  {unmappedCount > 0 && (
                    <span className="unmapped-alert">
                      {unmappedCount} outlet(s) missing coordinates
                    </span>
                  )}
                </div>
              ) : (
                mappedOutlets.map((outlet) => {
                  const isSelected = selectedOutlet?.id === outlet.id;
                  const isOnTrade = isOutletOnTrade(outlet.outlet_type);
                  const managerName =
                    outlet.assigned_manager && staffMap.has(outlet.assigned_manager)
                      ? staffMap.get(outlet.assigned_manager)
                      : outlet.assigned_manager;

                  let distanceKm: string | null = null;
                  if (
                    userLocation &&
                    outlet.gpslatitude &&
                    outlet.gpslongitude
                  ) {
                    const m = distanceInMeters(
                      { latitude: userLocation.lat, longitude: userLocation.lng },
                      {
                        latitude: Number(outlet.gpslatitude),
                        longitude: Number(outlet.gpslongitude),
                      }
                    );
                    distanceKm = m > 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
                  }

                  return (
                    <div
                      key={outlet.id}
                      className={`drawer-outlet-item ${isSelected ? "selected" : ""} ${isOnTrade ? "on-trade" : "off-trade"}`}
                      onClick={() => handleFocusOutlet(outlet)}
                    >
                      <div className="drawer-item-header">
                        <span className={`trade-badge ${isOnTrade ? "on" : "off"}`}>
                          {isOnTrade ? "ON" : "OFF"}
                        </span>
                        <h4 className="drawer-outlet-title" title={outlet.name}>
                          {outlet.name}
                        </h4>
                        {outlet.listing_status === 1 && (
                          <span className="listed-dot" title="Listed Account" />
                        )}
                      </div>

                      <p className="drawer-outlet-address" title={outlet.address || undefined}>
                        📍 {outlet.address ? `${outlet.address}, ` : ""}
                        {outlet.lga || ""} {outlet.state ? `(${outlet.state})` : ""}
                      </p>

                      <div className="drawer-item-footer">
                        {managerName && (
                          <span className="drawer-rep-name">
                            <User size={11} /> {managerName}
                          </span>
                        )}
                        {distanceKm && (
                          <span className="drawer-distance-tag">
                            <Navigation size={10} /> {distanceKm}
                          </span>
                        )}
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${Number(outlet.gpslatitude)},${Number(outlet.gpslongitude)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="drawer-ext-link"
                          onClick={(e) => e.stopPropagation()}
                          title="Open directly in Google Maps"
                        >
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        )}

        {/* Right Canvas: Google Maps Container */}
        <div className="map-canvas-container">
          {isSdkLoaded && !sdkError ? (
            /* Native Google Maps JS SDK Canvas */
            <div
              ref={mapContainerRef}
              className="google-maps-dom-target"
              style={{ width: "100%", height: "100%", minHeight: "680px" }}
            />
          ) : (
            /* Interactive Google Maps Embed Canvas */
            <div className="google-maps-embed-fallback">
              <iframe
                title="Google Maps Outlets Overview"
                width="100%"
                height="100%"
                style={{ border: 0, width: "100%", height: "100%" }}
                loading="lazy"
                allowFullScreen
                src={embedUrl}
              />
              <div className="embed-watermark-overlay">
                <div className="embed-notice-badge">
                  <MapPin size={13} color="#059669" />
                  <span>Google Maps View Active</span>
                  {selectedOutlet && (
                    <strong style={{ color: "#083e32" }}> · {selectedOutlet.name}</strong>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Floating Selected Outlet Bottom Bar */}
          {selectedOutlet && (
            <div className="floating-selected-outlet-card">
              <div className="floating-card-left">
                <div
                  className={`floating-avatar ${isOutletOnTrade(selectedOutlet.outlet_type) ? "on" : "off"}`}
                >
                  {selectedOutlet.name.charAt(0).toUpperCase()}
                </div>
                <div className="floating-copy">
                  <div className="floating-title-row">
                    <h4>{selectedOutlet.name}</h4>
                    <span
                      className={`trade-type-tag ${isOutletOnTrade(selectedOutlet.outlet_type) ? "on" : "off"}`}
                    >
                      {isOutletOnTrade(selectedOutlet.outlet_type) ? "ON-TRADE" : "OFF-TRADE"}
                    </span>
                    {selectedOutlet.listing_status === 1 && (
                      <span className="listing-tag listed">Listed</span>
                    )}
                  </div>
                  <p className="floating-address">
                    📍 {selectedOutlet.address || ""}, {selectedOutlet.lga || ""}{" "}
                    {selectedOutlet.state ? `(${selectedOutlet.state})` : ""}
                  </p>
                  <div className="floating-meta">
                    {selectedOutlet.assigned_manager && (
                      <span>
                        👤 Rep:{" "}
                        <strong>
                          {staffMap.get(selectedOutlet.assigned_manager) ||
                            selectedOutlet.assigned_manager}
                        </strong>
                      </span>
                    )}
                    {selectedOutlet.gpslatitude && selectedOutlet.gpslongitude && (
                      <span className="floating-coords">
                        🌐 {Number(selectedOutlet.gpslatitude).toFixed(4)},{" "}
                        {Number(selectedOutlet.gpslongitude).toFixed(4)} (~
                        {Math.round(selectedOutlet.registrationaccuracymeters || 5)}m)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="floating-card-actions">
                {selectedOutlet.contact_person_phone && (
                  <a
                    href={`tel:${selectedOutlet.contact_person_phone}`}
                    className="floating-btn call-btn"
                    title={`Call ${selectedOutlet.contact_person_name || "Manager"}`}
                  >
                    <Phone size={13} />
                    <span>Call</span>
                  </a>
                )}

                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${Number(selectedOutlet.gpslatitude)},${Number(selectedOutlet.gpslongitude)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="floating-btn directions-btn"
                  title="Navigate in Google Maps"
                >
                  <Navigation size={13} />
                  <span>Navigate</span>
                </a>

                {onEditOutlet && (
                  <button
                    type="button"
                    className="floating-btn edit-btn"
                    onClick={() => onEditOutlet(selectedOutlet)}
                    title="Edit outlet details"
                  >
                    <Pencil size={13} />
                    <span>Edit</span>
                  </button>
                )}

                <button
                  type="button"
                  className="floating-close-btn"
                  onClick={() => {
                    setSelectedOutlet(null);
                    infoWindowRef.current?.close();
                  }}
                  aria-label="Close"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── API KEY CONFIGURATION MODAL ───────────────────────── */}
      {apiKeyModalOpen && (
        <div
          className="tgt-modal-backdrop"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="tgt-modal-dialog"
            style={{ maxWidth: "460px" }}
          >
            <div className="tgt-modal-header">
              <div className="tgt-modal-header-text">
                <h3>Google Maps Integration</h3>
                <p>Configure Google Maps JavaScript API key or use interactive mode.</p>
              </div>
              <button
                type="button"
                className="tgt-modal-close"
                onClick={() => setApiKeyModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="tgt-modal-body" style={{ padding: "18px 20px" }}>
              <div className="tgt-field-group">
                <span className="tgt-field-label">Google Maps API Key</span>
                <input
                  type="text"
                  placeholder="AIzaSy..."
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                  }}
                />
                <small style={{ color: "#64748b", fontSize: "11.5px", marginTop: "5px", display: "block" }}>
                  An API key with <strong>Maps JavaScript API</strong> enabled. If left blank, the app runs in interactive embed mode seamlessly.
                </small>
              </div>

              <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  type="button"
                  className="btn-secondary-target"
                  onClick={() => setApiKeyModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary-target"
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      if (customApiKey) {
                        localStorage.setItem("penedge_google_maps_api_key", customApiKey);
                      } else {
                        localStorage.removeItem("penedge_google_maps_api_key");
                      }
                      window.location.reload();
                    }
                  }}
                >
                  Save & Reload Map
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
