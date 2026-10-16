import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Crosshair,
  Info,
  LayoutGrid,
  List,
  Map as MapIcon,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Trash2,
  User,
  Wifi,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  createOutlet,
  deleteOutlet,
  getAssignableStaff,
  getOutlets,
  updateOutlet,
  isOutletOnTrade,
  isOutletOffTrade,
  type Outlet,
} from "../services/referenceService";
import { getRegions, type RegionItem } from "../services/regionService";
import { getOutletTypes, type OutletTypeItem } from "../services/outletTypeService";
import {
  getUserScope,
  filterOutletsByScope,
  filterStaffByScope,
} from "../services/dataScopeService";
import { getCurrentPosition, formatGpsError, distanceInMeters } from "./visits/visitsUtils";
import OutletsMapView from "../components/outlets/OutletsMapView";
import { OutletsSkeleton } from "../components/ui/Skeleton";
import { useMinimumLoading } from "../hooks/useMinimumLoading";

type ViewMode = "grid" | "list" | "map";
type QuickCategory = "all" | "on-trade" | "off-trade" | "gps-calibrated" | "gps-missing" | "listed";

const NIGERIAN_STATES: Record<string, string[]> = {
  Lagos: [
    "Ikeja",
    "Surulere",
    "Eti-Osa",
    "Alimosho",
    "Lagos Island",
    "Kosofe",
    "Oshodi-Isolo",
    "Apapa",
    "Somolu",
    "Mushin",
    "Ikorodu",
    "Agege",
    "Ifako-Ijaiye",
    "Amuwo-Odofin",
  ],
  Edo: [
    "Egor",
    "Oredo",
    "Ikpoba-Okha",
    "Uhunmwonde",
    "Ovia North-East",
    "Ovia South-West",
    "Esan Central",
    "Esan West",
  ],
  Rivers: [
    "Port Harcourt",
    "Obio-Akpor",
    "Eleme",
    "Oyigbo",
    "Ikwerre",
    "Okrika",
    "Degema",
    "Bonny",
  ],
  FCT: ["Abuja Municipal", "Bwari", "Gwagwalada", "Kuje", "Kwali", "Abaji"],
  Oyo: [
    "Ibadan North",
    "Ibadan South-West",
    "Ibadan North-East",
    "Ibadan South-East",
    "Ibadan North-West",
    "Oluyole",
    "Oyo East",
    "Ogbomosho North",
  ],
  Delta: [
    "Warri South",
    "Oshimili South",
    "Uvwie",
    "Ughelli North",
    "Sapele",
    "Oshimili North",
  ],
  Ogun: [
    "Abeokuta South",
    "Abeokuta North",
    "Ado-Odo/Ota",
    "Sagamu",
    "Ifo",
    "Ijebu Ode",
  ],
  Anambra: [
    "Awka South",
    "Onitsha North",
    "Onitsha South",
    "Nnewi North",
    "Aguata",
  ],
  Enugu: ["Enugu North", "Enugu South", "Enugu East", "Nsukka"],
  Kano: ["Kano Municipal", "Fagge", "Dala", "Gwale", "Tarauni", "Nassarawa"],
};

export default function Outlets() {
  const { staff, role } = useAuth();
  const userScope = useMemo(() => getUserScope(staff, role), [staff, role]);

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [search, setSearch] = useState("");
  const [quickCategory, setQuickCategory] = useState<QuickCategory>("all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filters, setFilters] = useState({
    state: "",
    lga: "",
    region: "",
    outletType: "",
    personnel: "",
    listingStatus: "",
  });
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortOrder, setSortOrder] = useState("name");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const visibleLoading = useMinimumLoading(loading, 800);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOutletId, setEditingOutletId] = useState<string | null>(null);
  const [gpsSamples, setGpsSamples] = useState<GeolocationPosition[]>([]);
  const [gpsError, setGpsError] = useState("");
  const [capturingGps, setCapturingGps] = useState(false);
  const [manualCoordsOpen, setManualCoordsOpen] = useState(false);
  const [staffOptions, setStaffOptions] = useState<{ id: string; name: string }[]>([]);
  const [configuredRegions, setConfiguredRegions] = useState<RegionItem[]>([]);
  const [configuredOutletTypes, setConfiguredOutletTypes] = useState<OutletTypeItem[]>([]);

  // Mobile viewport detection
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Support map view on both desktop and mobile; default to list on mobile if grid is active
  const effectiveViewMode: ViewMode = isMobile && viewMode === "grid" ? "list" : viewMode;

  const dialogRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({
    name: "",
    outletType: "1",
    listingStatus: "0",
    regionId: "",
    address: "",
    state: "",
    lga: "",
    latitude: null as number | null,
    longitude: null as number | null,
    accuracy: null as number | null,
    capturedOn: null as string | null,
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    assignedManager: "",
    remarks: "",
  });

  const staffMap = useMemo(() => {
    const map = new Map<string, string>();
    staffOptions.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [staffOptions]);

  // Check for duplicate outlet (same name at same location / LGA / address)
  const duplicateOutlet = useMemo(() => {
    const trimmedName = form.name.trim().toLowerCase();
    if (!trimmedName || trimmedName.length < 2) return null;

    return outlets.find((existing) => {
      if (editingOutletId && existing.id === editingOutletId) return false;
      if (existing.name.trim().toLowerCase() !== trimmedName) return false;

      const sameState =
        Boolean(form.state) &&
        Boolean(existing.state) &&
        existing.state?.toLowerCase() === form.state.toLowerCase();
      const sameLga =
        Boolean(form.lga) &&
        Boolean(existing.lga) &&
        existing.lga?.toLowerCase() === form.lga.toLowerCase();
      const sameAddress =
        Boolean(existing.address) &&
        Boolean(form.address) &&
        existing.address?.trim().toLowerCase() === form.address.trim().toLowerCase();

      let closeGps = false;
      if (
        form.latitude !== null &&
        form.latitude !== undefined &&
        form.longitude !== null &&
        form.longitude !== undefined &&
        existing.gpslatitude !== null &&
        existing.gpslatitude !== undefined &&
        existing.gpslongitude !== null &&
        existing.gpslongitude !== undefined &&
        !isNaN(Number(form.latitude)) &&
        !isNaN(Number(form.longitude)) &&
        !isNaN(Number(existing.gpslatitude)) &&
        !isNaN(Number(existing.gpslongitude))
      ) {
        const dist = distanceInMeters(
          { latitude: Number(form.latitude), longitude: Number(form.longitude) },
          { latitude: Number(existing.gpslatitude), longitude: Number(existing.gpslongitude) }
        );
        closeGps = dist <= 100;
      }

      return sameAddress || (sameState && sameLga) || closeGps;
    });
  }, [form.name, form.state, form.lga, form.address, form.latitude, form.longitude, outlets, editingOutletId]);

  // Outlets co-located at the same GPS location (within 60m, e.g. shopping mall / commercial hub)
  const colocatedOutlets = useMemo(() => {
    if (
      form.latitude === null ||
      form.latitude === undefined ||
      form.longitude === null ||
      form.longitude === undefined ||
      isNaN(Number(form.latitude)) ||
      isNaN(Number(form.longitude))
    ) {
      return [];
    }

    return outlets.filter((existing) => {
      if (editingOutletId && existing.id === editingOutletId) return false;
      if (
        existing.gpslatitude === null ||
        existing.gpslatitude === undefined ||
        existing.gpslongitude === null ||
        existing.gpslongitude === undefined ||
        isNaN(Number(existing.gpslatitude)) ||
        isNaN(Number(existing.gpslongitude))
      ) {
        return false;
      }

      const dist = distanceInMeters(
        { latitude: Number(form.latitude), longitude: Number(form.longitude) },
        { latitude: Number(existing.gpslatitude), longitude: Number(existing.gpslongitude) }
      );
      // Within 60 meters (same plaza, mall, or multi-tenant commercial building)
      return dist <= 60;
    });
  }, [form.latitude, form.longitude, outlets, editingOutletId]);

  const loadOutlets = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getOutlets();
      const scoped = filterOutletsByScope(data, userScope);
      setOutlets(scoped);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unable to load outlets.");
    } finally {
      setLoading(false);
    }
  }, [userScope]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadOutlets();
      void getAssignableStaff()
        .then((staffData) => {
          const scopedStaff = filterStaffByScope(staffData, userScope);
          setStaffOptions(scopedStaff);
        })
        .catch(console.error);
      void getRegions().then(setConfiguredRegions).catch(console.error);
      void getOutletTypes().then(setConfiguredOutletTypes).catch(console.error);
    }, 0);

    return () => window.clearTimeout(loadTimer);
  }, [loadOutlets, userScope]);

  function resetForm() {
    const defaultType = configuredOutletTypes[0]?.key || "1";
    setForm({
      name: "",
      outletType: defaultType,
      listingStatus: "0",
      regionId: "",
      address: "",
      state: "",
      lga: "",
      latitude: null,
      longitude: null,
      accuracy: null,
      capturedOn: null,
      contactName: "",
      contactPhone: "",
      contactEmail: "",
      assignedManager: "",
      remarks: "",
    });
    setGpsSamples([]);
    setGpsError("");
    setManualCoordsOpen(false);
  }

  function openAddDialog() {
    void getRegions().then(setConfiguredRegions).catch(console.error);
    void getOutletTypes().then(setConfiguredOutletTypes).catch(console.error);
    setEditingOutletId(null);
    resetForm();
    setError("");
    setDialogOpen(true);
  }

  function openEditDialog(outlet: Outlet) {
    void getRegions().then(setConfiguredRegions).catch(console.error);
    void getOutletTypes().then(setConfiguredOutletTypes).catch(console.error);
    setEditingOutletId(outlet.id);

    const currentRegion = outlet.region_id || (outlet as any).region || "";

    let currentTypeKey = String(outlet.outlet_type ?? "");
    if (currentTypeKey === "1") currentTypeKey = "on-trade";
    else if (currentTypeKey === "2") currentTypeKey = "off-trade";
    else if (currentTypeKey === "3") currentTypeKey = "key_account";
    else if (currentTypeKey === "4") currentTypeKey = "mt";

    setForm({
      name: outlet.name,
      outletType: currentTypeKey || "on-trade",
      listingStatus: String(outlet.listing_status ?? 0),
      regionId: currentRegion,
      address: outlet.address ?? "",
      state: outlet.state ?? "",
      lga: outlet.lga ?? "",
      latitude: outlet.gpslatitude,
      longitude: outlet.gpslongitude,
      accuracy: outlet.registrationaccuracymeters,
      capturedOn: outlet.registration_location_captured_on,
      contactName: outlet.contact_person_name ?? "",
      contactPhone: outlet.contact_person_phone ?? "",
      contactEmail: outlet.contact_person_email ?? "",
      assignedManager: outlet.assigned_manager ?? "",
      remarks: outlet.visit_remarks ?? "",
    });
    setGpsSamples([]);
    setGpsError("");
    setError("");
    setManualCoordsOpen(false);
    setDialogOpen(true);
  }

  async function captureGps(forceStandard = false) {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser.");
      return;
    }

    setCapturingGps(true);
    setGpsError("");

    try {
      // 1. Acquire initial location with smart fallback
      const s1 = await getCurrentPosition({ forceStandard });
      const samples: GeolocationPosition[] = [s1];
      setGpsSamples(samples);

      // Immediately store coordinates so user is not blocked
      setForm((currentForm) => ({
        ...currentForm,
        latitude: s1.coords.latitude,
        longitude: s1.coords.longitude,
        accuracy: s1.coords.accuracy,
        capturedOn: new Date(s1.timestamp).toISOString(),
      }));

      // 2. If high accuracy mode, attempt 2 additional background samples to refine accuracy
      if (!forceStandard) {
        try {
          const s2 = await getCurrentPosition();
          samples.push(s2);
          setGpsSamples([...samples]);

          const s3 = await getCurrentPosition();
          samples.push(s3);
          setGpsSamples([...samples]);

          const best = samples.reduce((selected, sample) =>
            sample.coords.accuracy < selected.coords.accuracy ? sample : selected
          );

          setForm((currentForm) => ({
            ...currentForm,
            latitude: best.coords.latitude,
            longitude: best.coords.longitude,
            accuracy: best.coords.accuracy,
            capturedOn: new Date(best.timestamp).toISOString(),
          }));
        } catch {
          // If subsequent refinement samples time out, s1 is already safely stored
        }
      }
    } catch (positionError: unknown) {
      setGpsError(formatGpsError(positionError));
    } finally {
      setCapturingGps(false);
    }
  }

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = outlets.length;
    const onTrade = outlets.filter((o) => isOutletOnTrade(o.outlet_type)).length;
    const offTrade = outlets.filter((o) => isOutletOffTrade(o.outlet_type)).length;
    const withGps = outlets.filter(
      (o) =>
        o.gpslatitude !== null &&
        o.gpslatitude !== undefined &&
        o.gpslongitude !== null &&
        o.gpslongitude !== undefined &&
        !isNaN(Number(o.gpslatitude)) &&
        !isNaN(Number(o.gpslongitude))
    ).length;
    const listed = outlets.filter((o) => o.listing_status === 1).length;
    return { total, onTrade, offTrade, withGps, listed };
  }, [outlets]);

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.state) count++;
    if (filters.lga) count++;
    if (filters.region) count++;
    if (filters.outletType) count++;
    if (filters.personnel) count++;
    if (filters.listingStatus) count++;
    if (quickCategory !== "all") count++;
    return count;
  }, [filters, quickCategory]);

  function resetAllFilters() {
    setSearch("");
    setQuickCategory("all");
    setFilters({
      state: "",
      lga: "",
      region: "",
      outletType: "",
      personnel: "",
      listingStatus: "",
    });
  }

  const filteredOutlets = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = outlets.filter((outlet) => {
      const matchesSearch =
        !query ||
        outlet.name.toLowerCase().includes(query) ||
        (outlet.address && outlet.address.toLowerCase().includes(query)) ||
        (outlet.lga && outlet.lga.toLowerCase().includes(query)) ||
        (outlet.state && outlet.state.toLowerCase().includes(query)) ||
        (outlet.contact_person_name &&
          outlet.contact_person_name.toLowerCase().includes(query));

      if (!matchesSearch) return false;

      const hasGps =
        outlet.gpslatitude !== null &&
        outlet.gpslatitude !== undefined &&
        outlet.gpslongitude !== null &&
        outlet.gpslongitude !== undefined &&
        !isNaN(Number(outlet.gpslatitude)) &&
        !isNaN(Number(outlet.gpslongitude));

      if (quickCategory === "on-trade" && !isOutletOnTrade(outlet.outlet_type)) return false;
      if (quickCategory === "off-trade" && !isOutletOffTrade(outlet.outlet_type)) return false;
      if (quickCategory === "gps-calibrated" && !hasGps) return false;
      if (quickCategory === "gps-missing" && hasGps) return false;
      if (quickCategory === "listed" && outlet.listing_status !== 1) return false;

      if (filters.state && outlet.state !== filters.state) return false;
      if (filters.lga && outlet.lga !== filters.lga) return false;
      if (filters.region && outlet.region_id !== filters.region) return false;
      if (filters.outletType && String(outlet.outlet_type ?? "") !== filters.outletType)
        return false;
      if (filters.personnel && outlet.assigned_manager !== filters.personnel)
        return false;
      if (
        filters.listingStatus &&
        String(outlet.listing_status ?? "") !== filters.listingStatus
      )
        return false;

      return true;
    });

    return [...result].sort((a, b) => {
      if (sortOrder === "name-desc") {
        return b.name.localeCompare(a.name);
      }
      if (sortOrder === "type") {
        return String(a.outlet_type ?? "").localeCompare(String(b.outlet_type ?? ""));
      }
      if (sortOrder === "gps") {
        const aHasGps = Boolean(a.gpslatitude && a.gpslongitude);
        const bHasGps = Boolean(b.gpslatitude && b.gpslongitude);
        return Number(aHasGps) - Number(bHasGps);
      }
      return a.name.localeCompare(b.name);
    });
  }, [filters, outlets, quickCategory, search, sortOrder]);

  const availableStates = useMemo(() => {
    const fromData = outlets
      .map((o) => o.state)
      .filter((s): s is string => Boolean(s));
    return [...new Set([...Object.keys(NIGERIAN_STATES), ...fromData])].sort();
  }, [outlets]);

  const availableLgas = useMemo(() => {
    if (!form.state) return [];
    if (NIGERIAN_STATES[form.state]) return NIGERIAN_STATES[form.state];
    return [
      ...new Set(
        outlets
          .filter((o) => o.state === form.state)
          .map((o) => o.lga)
          .filter((l): l is string => Boolean(l))
      ),
    ].sort();
  }, [form.state, outlets]);

  const availableRegions = useMemo(() => {
    const settingsRegions = configuredRegions
      .filter((r) => r.is_active !== false)
      .map((r) => r.name);
    const fromData = outlets
      .map((o) => o.region_id)
      .filter((r): r is string => Boolean(r));
    const merged = Array.from(new Set([...settingsRegions, ...fromData]));
    if (merged.length === 0) {
      return [
        "Portharcourt - South",
        "Abuja - North",
        "Lagos mainland",
        "Anambra",
        "Lagos Island",
        "Enugu- East",
        "Edo Region",
        "Victoria Island",
        "Ikeja",
        "Lekki",
        "Surulere",
        "Ibadan",
      ].sort();
    }
    return merged.sort();
  }, [configuredRegions, outlets]);

  const filterStateOptions = useMemo(
    () =>
      [
        ...new Set(
          outlets
            .map((outlet) => outlet.state)
            .filter((value): value is string => Boolean(value))
        ),
      ].sort(),
    [outlets]
  );

  const filterLgaOptions = useMemo(
    () =>
      [
        ...new Set(
          outlets
            .filter((outlet) => !filters.state || outlet.state === filters.state)
            .map((outlet) => outlet.lga)
            .filter((value): value is string => Boolean(value))
        ),
      ].sort(),
    [filters.state, outlets]
  );

  const filterRegionOptions = useMemo(
    () =>
      [
        ...new Set([
          ...configuredRegions.filter((r) => r.is_active !== false).map((r) => r.name),
          ...outlets
            .map((outlet) => outlet.region_id)
            .filter((value): value is string => Boolean(value)),
        ]),
      ].sort(),
    [configuredRegions, outlets]
  );

  const pageSize = 12;
  const totalPages = Math.ceil(filteredOutlets.length / pageSize);

  const filterKey = `${filters.state}|${filters.lga}|${filters.region}|${filters.outletType}|${filters.personnel}|${filters.listingStatus}|${quickCategory}|${search}|${sortOrder}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setCurrentPage(1);
  }

  const safeCurrentPage = Math.min(currentPage, Math.max(totalPages, 1));
  const paginatedOutlets = filteredOutlets.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize
  );

  async function handleCreateOutlet(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;

    if (
      !form.name.trim() ||
      !form.address.trim() ||
      !form.state ||
      !form.lga ||
      !form.regionId
    ) {
      setError(
        "Please complete all required fields (Name, Address, State, LGA, Sales Region)."
      );
      return;
    }

    if (duplicateOutlet) {
      setError(
        `Duplicate Outlet Detected: An outlet named "${duplicateOutlet.name}" already exists at ${duplicateOutlet.address ? `${duplicateOutlet.address}, ` : ""}${duplicateOutlet.lga} (${duplicateOutlet.state}). Duplicate outlet creation prevented.`
      );
      return;
    }
    if (
      !editingOutletId &&
      (form.latitude === null ||
        form.latitude === undefined ||
        form.longitude === null ||
        form.longitude === undefined ||
        isNaN(Number(form.latitude)) ||
        isNaN(Number(form.longitude)))
    ) {
      setError(
        "GPS coordinates are required. Please capture GPS location or enter coordinates manually."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      const submissionForm = {
        ...form,
        capturedOn: form.capturedOn || new Date().toISOString(),
      };
      const outlet = editingOutletId
        ? await updateOutlet(editingOutletId, submissionForm)
        : await createOutlet(submissionForm);

      const targetEditId = editingOutletId;
      setOutlets((current) =>
        targetEditId
          ? current.map((item) => (item.id === targetEditId || item.id === outlet.id ? outlet : item))
          : [...current, outlet]
      );
      resetForm();
      setEditingOutletId(null);
      setDialogOpen(false);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unable to save outlet.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteOutlet() {
    if (
      !editingOutletId ||
      !window.confirm(`Delete ${form.name || "this outlet"}? This cannot be undone.`)
    ) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      await deleteOutlet(editingOutletId);
      setOutlets((current) =>
        current.filter((outlet) => outlet.id !== editingOutletId)
      );
      setDialogOpen(false);
      setEditingOutletId(null);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unable to delete outlet.");
    } finally {
      setSaving(false);
    }
  }

  function isGpsCalibrated(outlet: Outlet) {
    return (
      outlet.gpslatitude !== null &&
      outlet.gpslatitude !== undefined &&
      outlet.gpslongitude !== null &&
      outlet.gpslongitude !== undefined &&
      !isNaN(Number(outlet.gpslatitude)) &&
      !isNaN(Number(outlet.gpslongitude))
    );
  }

  if (visibleLoading && outlets.length === 0) {
    return (
      <div className="page outlets-page">
        <OutletsSkeleton />
      </div>
    );
  }

  return (
    <div className="page outlets-page">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="outlets-header-pro">
        <div className="outlets-header-copy">
          <div className="outlets-title-badge-group">
            <h2>Outlets</h2>
            <span className="outlets-total-chip">{outlets.length} total</span>
          </div>
          <p>Directory of retail locations, GPS coordinates, and assigned personnel.</p>
        </div>

        <div className="outlets-header-actions">
          <button
            type="button"
            className="refresh-btn-secondary"
            onClick={() => void loadOutlets()}
            disabled={loading}
            title="Reload outlets"
            aria-label="Refresh"
          >
            <RefreshCw size={15} className={loading ? "spin" : ""} />
            <span className="btn-label-desktop">Refresh</span>
          </button>

          <button
            type="button"
            className="primary-button add-outlet-btn"
            onClick={openAddDialog}
          >
            <Plus size={16} />
            <span>Add Outlet</span>
          </button>
        </div>
      </div>

      {/* ── KPI Summary Ribbon ─────────────────────────────────── */}
      <section className="outlets-kpi-ribbon" aria-label="Outlet statistics">
        <button
          type="button"
          className={`kpi-chip ${quickCategory === "all" ? "active" : ""}`}
          onClick={() => setQuickCategory("all")}
        >
          <Store size={15} className="kpi-icon total" />
          <div className="kpi-content">
            <span className="kpi-count">{metrics.total}</span>
            <span className="kpi-title">All Outlets</span>
          </div>
        </button>

        <button
          type="button"
          className={`kpi-chip ${quickCategory === "on-trade" ? "active" : ""}`}
          onClick={() =>
            setQuickCategory(quickCategory === "on-trade" ? "all" : "on-trade")
          }
        >
          <Building2 size={15} className="kpi-icon on-trade" />
          <div className="kpi-content">
            <span className="kpi-count">{metrics.onTrade}</span>
            <span className="kpi-title">On-Trade</span>
          </div>
        </button>

        <button
          type="button"
          className={`kpi-chip ${quickCategory === "off-trade" ? "active" : ""}`}
          onClick={() =>
            setQuickCategory(quickCategory === "off-trade" ? "all" : "off-trade")
          }
        >
          <Store size={15} className="kpi-icon off-trade" />
          <div className="kpi-content">
            <span className="kpi-count">{metrics.offTrade}</span>
            <span className="kpi-title">Off-Trade</span>
          </div>
        </button>

        <button
          type="button"
          className={`kpi-chip ${quickCategory === "gps-calibrated" ? "active" : ""}`}
          onClick={() =>
            setQuickCategory(
              quickCategory === "gps-calibrated" ? "all" : "gps-calibrated"
            )
          }
        >
          <MapPin size={15} className="kpi-icon gps" />
          <div className="kpi-content">
            <span className="kpi-count">{metrics.withGps}</span>
            <span className="kpi-title">GPS Calibrated</span>
          </div>
        </button>

        <button
          type="button"
          className={`kpi-chip ${quickCategory === "listed" ? "active" : ""}`}
          onClick={() =>
            setQuickCategory(quickCategory === "listed" ? "all" : "listed")
          }
        >
          <CheckCircle2 size={15} className="kpi-icon listed" />
          <div className="kpi-content">
            <span className="kpi-count">{metrics.listed}</span>
            <span className="kpi-title">Listed</span>
          </div>
        </button>
      </section>

      {error && (
        <div className="outlet-error" role="alert">
          <div className="outlet-error-left">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError("")} aria-label="Dismiss error">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Search & Filter Toolbar ────────────────────────────── */}
      <div className="outlets-toolbar-pro">
        <div className="toolbar-primary-row">
          <div className="search-field-pro">
            <Search size={16} className="search-icon" aria-hidden="true" />
            <input
              id="outlet-search"
              type="search"
              placeholder="Search outlet, address, LGA or manager..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="toolbar-controls-right">
            <button
              type="button"
              className={`filter-toggle-btn ${activeFiltersCount > 0 ? "has-filters" : ""} ${showAdvancedFilters ? "active" : ""}`}
              onClick={() => setShowAdvancedFilters((prev) => !prev)}
              aria-expanded={showAdvancedFilters}
            >
              <SlidersHorizontal size={15} />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="filter-badge-count">{activeFiltersCount}</span>
              )}
              {showAdvancedFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            <div className="sort-dropdown-pro">
              <label htmlFor="outlet-sort" className="sr-only">
                Sort
              </label>
              <select
                id="outlet-sort"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              >
                <option value="name">Name A-Z</option>
                <option value="name-desc">Name Z-A</option>
                <option value="type">Type (On/Off)</option>
                <option value="gps">GPS Status</option>
              </select>
            </div>

            {/* View Switcher (Grid / List / Map) */}
            <div
              className="view-switcher desktop-view-switcher"
              aria-label="Outlet view mode"
            >
              <button
                type="button"
                className={effectiveViewMode === "grid" ? "active" : ""}
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
                title="Grid view"
              >
                <LayoutGrid size={15} />
                <span className="view-btn-text">Grid</span>
              </button>
              <button
                type="button"
                className={effectiveViewMode === "list" ? "active" : ""}
                onClick={() => setViewMode("list")}
                aria-label="List view"
                title="List view"
              >
                <List size={15} />
                <span className="view-btn-text">List</span>
              </button>
              <button
                type="button"
                className={effectiveViewMode === "map" ? "active" : ""}
                onClick={() => setViewMode("map")}
                aria-label="Google Maps view"
                title="Google Maps view"
              >
                <MapIcon size={15} />
                <span className="view-btn-text">Map</span>
              </button>
            </div>
          </div>
        </div>

        {/* Collapsible Advanced Filters Drawer */}
        {showAdvancedFilters && (
          <div className="advanced-filters-panel">
            <div className="filters-grid">
              <div className="filter-field">
                <label htmlFor="filter-state">State</label>
                <select
                  id="filter-state"
                  value={filters.state}
                  onChange={(e) =>
                    setFilters({ ...filters, state: e.target.value, lga: "" })
                  }
                >
                  <option value="">All States</option>
                  {filterStateOptions.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-field">
                <label htmlFor="filter-lga">LGA</label>
                <select
                  id="filter-lga"
                  value={filters.lga}
                  onChange={(e) => setFilters({ ...filters, lga: e.target.value })}
                  disabled={!filters.state}
                >
                  <option value="">All LGAs</option>
                  {filterLgaOptions.map((lga) => (
                    <option key={lga} value={lga}>
                      {lga}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-field">
                <label htmlFor="filter-region">Region</label>
                <select
                  id="filter-region"
                  value={filters.region}
                  onChange={(e) => setFilters({ ...filters, region: e.target.value })}
                >
                  <option value="">All Regions</option>
                  {filterRegionOptions.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-field">
                <label htmlFor="filter-type">Trade Type</label>
                <select
                  id="filter-type"
                  value={filters.outletType}
                  onChange={(e) =>
                    setFilters({ ...filters, outletType: e.target.value })
                  }
                >
                  <option value="">All Types</option>
                  <option value="1">ON-TRADE</option>
                  <option value="2">OFF-TRADE</option>
                </select>
              </div>

              <div className="filter-field">
                <label htmlFor="filter-personnel">Assigned Personnel</label>
                <select
                  id="filter-personnel"
                  value={filters.personnel}
                  onChange={(e) =>
                    setFilters({ ...filters, personnel: e.target.value })
                  }
                >
                  <option value="">All Personnel</option>
                  {staffOptions.map((staffMember) => (
                    <option key={staffMember.id} value={staffMember.id}>
                      {staffMember.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-field">
                <label htmlFor="filter-listing">Listing Status</label>
                <select
                  id="filter-listing"
                  value={filters.listingStatus}
                  onChange={(e) =>
                    setFilters({ ...filters, listingStatus: e.target.value })
                  }
                >
                  <option value="">All Listing Statuses</option>
                  <option value="1">Listed</option>
                  <option value="0">Not Listed</option>
                </select>
              </div>
            </div>

            {activeFiltersCount > 0 && (
              <div className="filters-footer-actions">
                <button
                  type="button"
                  className="reset-filters-btn"
                  onClick={resetAllFilters}
                >
                  <RotateCcw size={13} />
                  <span>Reset all filters</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Active Filter Badges & Results Count ───────────────── */}
      <div className="outlets-results-bar">
        <div className="results-counter">
          <strong>{filteredOutlets.length}</strong>
          <span>{filteredOutlets.length === 1 ? "outlet" : "outlets"} found</span>
          {search && <span className="results-query">for “{search}”</span>}
        </div>

        {activeFiltersCount > 0 && (
          <button
            type="button"
            className="clear-all-pill-btn"
            onClick={resetAllFilters}
          >
            Clear active filters ({activeFiltersCount}) <X size={12} />
          </button>
        )}
      </div>

      {/* ── Outlets Display Area ───────────────────────────────── */}
      {loading ? (
        <div className="outlet-empty-state">
          <RefreshCw size={24} className="spin empty-icon" />
          <strong>Loading outlets...</strong>
          <span>Synchronizing locations from database</span>
        </div>
      ) : filteredOutlets.length === 0 ? (
        <div className="outlet-empty-state">
          <Store size={32} className="empty-icon" />
          <strong>No matching outlets found</strong>
          <span>Try adjusting your search criteria or clear active filters.</span>
          <button
            type="button"
            className="secondary-button"
            onClick={resetAllFilters}
            style={{ marginTop: 8 }}
          >
            Reset filters
          </button>
        </div>
      ) : effectiveViewMode === "map" ? (
        /* ── GOOGLE MAPS OUTLETS VIEW ── */
        <OutletsMapView
          outlets={filteredOutlets}
          onEditOutlet={openEditDialog}
          staffMap={staffMap}
        />
      ) : effectiveViewMode === "grid" ? (
        /* ── DESKTOP GRID VIEW ── */
        <div className="outlet-gallery outlet-gallery-grid">
          {paginatedOutlets.map((outlet) => {
            const hasGps = isGpsCalibrated(outlet);
            const managerName =
              outlet.assigned_manager && staffMap.has(outlet.assigned_manager)
                ? staffMap.get(outlet.assigned_manager)
                : outlet.assigned_manager;

            return (
              <article className="outlet-card-pro" key={outlet.id}>
                <div className="card-top-row">
                  <div
                    className={`outlet-avatar-pro ${isOutletOffTrade(outlet.outlet_type) ? "off-trade" : "on-trade"}`}
                    aria-hidden="true"
                  >
                    {outlet.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="card-heading-copy">
                    <h3 title={outlet.name}>{outlet.name}</h3>
                    <div className="card-badge-row">
                      <span
                        className={`trade-type-tag ${isOutletOffTrade(outlet.outlet_type) ? "off" : "on"}`}
                      >
                        {isOutletOffTrade(outlet.outlet_type) ? "OFF-TRADE" : "ON-TRADE"}
                      </span>
                      {outlet.listing_status === 1 ? (
                        <span className="listing-tag listed">Listed</span>
                      ) : (
                        <span className="listing-tag unlisted">Not Listed</span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="card-edit-action-btn"
                    onClick={() => openEditDialog(outlet)}
                    aria-label={`Edit ${outlet.name}`}
                    title="Edit outlet"
                  >
                    <Pencil size={14} />
                  </button>
                </div>

                <div className="card-meta-list">
                  <div
                    className="meta-line address-line"
                    title={outlet.address || undefined}
                  >
                    <MapPin size={13} className="meta-icon" />
                    <span>
                      {outlet.address
                        ? `${outlet.address}, ${outlet.lga || ""} ${outlet.state || ""}`
                        : `${outlet.lga || ""} ${outlet.state || "Location pending"}`}
                    </span>
                  </div>

                  {managerName && (
                    <div className="meta-line manager-line">
                      <User size={13} className="meta-icon" />
                      <span>{managerName}</span>
                    </div>
                  )}

                  {outlet.contact_person_phone && (
                    <div className="meta-line contact-line">
                      <Phone size={13} className="meta-icon" />
                      <a href={`tel:${outlet.contact_person_phone}`}>
                        {outlet.contact_person_phone}
                      </a>
                      {outlet.contact_person_name && (
                        <span className="contact-name">
                          ({outlet.contact_person_name})
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="card-footer-row">
                  {hasGps ? (
                    <span
                      className="gps-status-pill calibrated"
                      title={`GPS Accuracy: ~${Math.round(outlet.registrationaccuracymeters || 10)}m`}
                    >
                      <Check size={11} />
                      <span>GPS Calibrated</span>
                    </span>
                  ) : (
                    <span
                      className="gps-status-pill missing"
                      title="Coordinates not registered"
                    >
                      <AlertCircle size={11} />
                      <span>GPS Missing</span>
                    </span>
                  )}

                  <button
                    type="button"
                    className="card-quick-edit-link"
                    onClick={() => openEditDialog(outlet)}
                  >
                    Edit details →
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        /* ── LIST VIEW (Responsive: Desktop Table / Compact Mobile Rows) ── */
        <div className="outlet-list-container">
          {/* Desktop Table View */}
          <div className="outlet-table-wrapper desktop-only">
            <table className="outlet-table-pro">
              <thead>
                <tr>
                  <th scope="col">Outlet</th>
                  <th scope="col">Type</th>
                  <th scope="col">Location</th>
                  <th scope="col">Assigned Rep</th>
                  <th scope="col">GPS Status</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedOutlets.map((outlet) => {
                  const hasGps = isGpsCalibrated(outlet);
                  const managerName =
                    outlet.assigned_manager && staffMap.has(outlet.assigned_manager)
                      ? staffMap.get(outlet.assigned_manager)
                      : outlet.assigned_manager;

                  return (
                    <tr key={outlet.id} className="outlet-table-row">
                      <td className="outlet-name-cell">
                        <div
                          className={`outlet-avatar-sm ${isOutletOffTrade(outlet.outlet_type) ? "off-trade" : "on-trade"}`}
                        >
                          {outlet.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="outlet-name-text">
                          <strong title={outlet.name}>{outlet.name}</strong>
                          {outlet.contact_person_name && (
                            <small>{outlet.contact_person_name}</small>
                          )}
                        </div>
                      </td>

                      <td>
                        <span
                          className={`trade-type-tag ${isOutletOffTrade(outlet.outlet_type) ? "off" : "on"}`}
                        >
                          {isOutletOffTrade(outlet.outlet_type) ? "OFF-TRADE" : "ON-TRADE"}
                        </span>
                      </td>

                      <td className="outlet-location-cell">
                        <span>{outlet.address || "No address"}</span>
                        <small>
                          {[outlet.lga, outlet.state].filter(Boolean).join(", ") ||
                            "—"}
                        </small>
                      </td>

                      <td>
                        <span className="rep-cell-text">
                          {managerName || "Unassigned"}
                        </span>
                      </td>

                      <td>
                        {hasGps ? (
                          <span
                            className="gps-status-pill calibrated"
                            title={`Lat: ${outlet.gpslatitude?.toFixed(4)}, Lng: ${outlet.gpslongitude?.toFixed(4)}`}
                          >
                            <Check size={11} />
                            <span>Calibrated</span>
                          </span>
                        ) : (
                          <span className="gps-status-pill missing">
                            <AlertCircle size={11} />
                            <span>Missing</span>
                          </span>
                        )}
                      </td>

                      <td>
                        {outlet.listing_status === 1 ? (
                          <span className="listing-tag listed">Listed</span>
                        ) : (
                          <span className="listing-tag unlisted">Not Listed</span>
                        )}
                      </td>

                      <td className="text-right">
                        <button
                          type="button"
                          className="table-action-btn"
                          onClick={() => openEditDialog(outlet)}
                          aria-label={`Edit ${outlet.name}`}
                          title="Edit outlet"
                        >
                          <Pencil size={13} />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Compact Mobile List View */}
          <div className="outlet-mobile-list mobile-only">
            {paginatedOutlets.map((outlet) => {
              const hasGps = isGpsCalibrated(outlet);
              const managerName =
                outlet.assigned_manager && staffMap.has(outlet.assigned_manager)
                  ? staffMap.get(outlet.assigned_manager)
                  : outlet.assigned_manager;

              return (
                <div
                  className="mobile-outlet-item"
                  key={outlet.id}
                  onClick={() => openEditDialog(outlet)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      openEditDialog(outlet);
                    }
                  }}
                >
                  <div
                    className={`mobile-avatar ${isOutletOffTrade(outlet.outlet_type) ? "off-trade" : "on-trade"}`}
                  >
                    {outlet.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="mobile-item-body">
                    <div className="mobile-title-row">
                      <strong className="mobile-outlet-name">{outlet.name}</strong>
                      <span
                        className={`trade-type-mini ${isOutletOffTrade(outlet.outlet_type) ? "off" : "on"}`}
                      >
                        {isOutletOffTrade(outlet.outlet_type) ? "OFF" : "ON"}
                      </span>
                    </div>

                    <div className="mobile-details-row">
                      <span className="mobile-loc">
                        {[outlet.lga, outlet.state].filter(Boolean).join(", ") ||
                          outlet.address ||
                          "No location"}
                      </span>
                      {managerName && (
                        <>
                          <span className="dot-divider">·</span>
                          <span className="mobile-rep">{managerName}</span>
                        </>
                      )}
                    </div>

                    <div className="mobile-badges-row">
                      {hasGps ? (
                        <span className="mobile-gps-tag calibrated">
                          <Check size={10} /> GPS
                        </span>
                      ) : (
                        <span className="mobile-gps-tag missing">
                          <AlertCircle size={10} /> No GPS
                        </span>
                      )}
                      {outlet.listing_status === 1 && (
                        <span className="mobile-status-tag">Listed</span>
                      )}
                    </div>
                  </div>

                  <div
                    className="mobile-item-actions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {outlet.contact_person_phone && (
                      <a
                        href={`tel:${outlet.contact_person_phone}`}
                        className="mobile-call-icon-btn"
                        aria-label={`Call ${outlet.name}`}
                        title="Call outlet"
                      >
                        <Phone size={14} />
                      </a>
                    )}
                    <button
                      type="button"
                      className="mobile-edit-icon-btn"
                      onClick={() => openEditDialog(outlet)}
                      aria-label={`Edit ${outlet.name}`}
                      title="Edit outlet"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Pagination ─────────────────────────────────────────── */}
      {!loading && effectiveViewMode !== "map" && totalPages > 1 && (
        <nav className="outlet-pagination" aria-label="Outlets pagination">
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
            disabled={currentPage === 1}
            aria-label="Previous page"
          >
            <ChevronLeft size={14} />
            <span className="btn-label-desktop">Previous</span>
          </button>

          <span className="pagination-info">
            Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
          </span>

          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}
            disabled={currentPage === totalPages}
            aria-label="Next page"
          >
            <span className="btn-label-desktop">Next</span>
            <ChevronRight size={14} />
          </button>
        </nav>
      )}

      {/* ── Enhanced Professional Add / Edit Outlet Modal ─────────── */}
      {dialogOpen && (
        <div
          className="dialog-backdrop modal-backdrop-pro"
          role="presentation"
        >
          <div
            ref={dialogRef}
            className="outlet-modal-container"
            role="dialog"
            aria-modal="true"
            aria-labelledby="outlet-dialog-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="outlet-modal-header">
              <div className="modal-header-left">
                <div className="modal-header-icon-badge" aria-hidden="true">
                  <Store size={20} />
                </div>
                <div className="modal-header-titles">
                  <h3 id="outlet-dialog-title">
                    {editingOutletId ? "Edit Outlet Details" : "Add New Outlet"}
                  </h3>
                  <p className="modal-header-subtitle">
                    {editingOutletId
                      ? `Managing profile & territory for ${form.name || "this location"}`
                      : "Register a retail store, assign sales territory, and calibrate GPS coordinates."}
                  </p>
                </div>
              </div>

              <div className="modal-header-right">
                <span
                  className={`trade-type-badge-pro ${isOutletOffTrade(form.outletType) ? "off" : "on"}`}
                >
                  {isOutletOffTrade(form.outletType) ? "OFF-TRADE" : "ON-TRADE"}
                </span>

                {form.latitude && form.longitude ? (
                  <span className="modal-gps-pill calibrated" title="Coordinates recorded">
                    <Check size={11} /> GPS Calibrated
                  </span>
                ) : (
                  <span className="modal-gps-pill missing" title="GPS coordinates pending">
                    <AlertCircle size={11} /> GPS Required
                  </span>
                )}

                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setDialogOpen(false)}
                  aria-label="Close dialog"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateOutlet} className="outlet-modal-form">
              <div className="outlet-modal-scroll-area">
                <div className="outlet-modal-grid">
                  {/* Left Column: Core Form Sections */}
                  <div className="modal-form-main-column">
                    {/* Section 1: Store Identity */}
                    <div className="form-card-section">
                      <div className="section-card-header">
                        <Store size={16} className="section-card-icon" />
                        <div>
                          <h4>Store Identity</h4>
                          <span>Basic store name, trade classification and status</span>
                        </div>
                      </div>

                      <div className="form-fields-stack">
                        <div className="form-input-group">
                          <label htmlFor="new-outlet-name">
                            Outlet Name <span className="required-mark">*</span>
                          </label>
                          <input
                            id="new-outlet-name"
                            type="text"
                            placeholder="e.g. De Golden Lounge & Suites"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            autoFocus
                            required
                          />
                          {duplicateOutlet && (
                            <div className="duplicate-outlet-inline-alert" role="alert">
                              <AlertCircle size={14} className="duplicate-inline-icon" />
                              <span>
                                <strong>Duplicate Detected:</strong> An outlet named "{duplicateOutlet.name}" is already registered in {duplicateOutlet.lga || duplicateOutlet.state} ({duplicateOutlet.address || "same location"}).
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="form-input-group">
                          <label htmlFor="outlet-address">
                            Street Address <span className="required-mark">*</span>
                          </label>
                          <div className="input-with-icon">
                            <MapPin size={15} className="field-inner-icon" />
                            <input
                              id="outlet-address"
                              type="text"
                              placeholder="e.g. 14 Airport Road, GRA"
                              value={form.address}
                              onChange={(e) =>
                                setForm({ ...form, address: e.target.value })
                              }
                              required
                            />
                          </div>
                        </div>

                        <div className="form-fields-row-2">
                          <div className="form-input-group">
                            <label htmlFor="outlet-type">
                              Outlet Type <span className="required-mark">*</span>
                            </label>
                            <select
                              id="outlet-type"
                              value={form.outletType}
                              onChange={(e) =>
                                setForm({ ...form, outletType: e.target.value })
                              }
                              required
                            >
                              <option value="">Select Outlet Type</option>
                              {configuredOutletTypes
                                .filter((t) => t.is_active !== false)
                                .map((typeItem) => (
                                  <option key={typeItem.id} value={typeItem.key}>
                                    {typeItem.name} {typeItem.description ? `(${typeItem.description})` : ""}
                                  </option>
                                ))}
                            </select>
                          </div>

                          <div className="form-input-group">
                            <label htmlFor="listing-status">Listing Status</label>
                            <select
                              id="listing-status"
                              value={form.listingStatus}
                              onChange={(e) =>
                                setForm({ ...form, listingStatus: e.target.value })
                              }
                            >
                              <option value="0">Not Listed</option>
                              <option value="1">Listed (Active Portfolio)</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Territory & Personnel */}
                    <div className="form-card-section">
                      <div className="section-card-header">
                        <MapPin size={16} className="section-card-icon" />
                        <div>
                          <h4>Territory & Assignment</h4>
                          <span>Geographic coverage and sales representative</span>
                        </div>
                      </div>

                      <div className="form-fields-stack">
                        <div className="form-fields-row-2">
                          <div className="form-input-group">
                            <label htmlFor="outlet-state">
                              State <span className="required-mark">*</span>
                            </label>
                            <select
                              id="outlet-state"
                              value={form.state}
                              onChange={(e) =>
                                setForm({ ...form, state: e.target.value, lga: "" })
                              }
                              required
                            >
                              <option value="">Select State</option>
                              {availableStates.map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="form-input-group">
                            <label htmlFor="outlet-lga">
                              LGA <span className="required-mark">*</span>
                            </label>
                            <select
                              id="outlet-lga"
                              value={form.lga}
                              onChange={(e) => setForm({ ...form, lga: e.target.value })}
                              disabled={!form.state}
                              required
                            >
                              <option value="">
                                {form.state ? "Select LGA" : "Select state first"}
                              </option>
                              {availableLgas.map((lga) => (
                                <option key={lga} value={lga}>
                                  {lga}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="form-fields-row-2">
                          <div className="form-input-group">
                            <label htmlFor="outlet-region">
                              Sales Region <span className="required-mark">*</span>
                            </label>
                            <select
                              id="outlet-region"
                              value={form.regionId}
                              onChange={(e) =>
                                setForm({ ...form, regionId: e.target.value })
                              }
                              required
                            >
                              <option value="">Select Region</option>
                              {availableRegions.map((region) => (
                                <option key={region} value={region}>
                                  {region}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="form-input-group">
                            <label htmlFor="assigned-personnel">
                              Assigned Sales Rep
                            </label>
                            <select
                              id="assigned-personnel"
                              value={form.assignedManager}
                              onChange={(e) =>
                                setForm({
                                  ...form,
                                  assignedManager: e.target.value,
                                })
                              }
                            >
                              <option value="">Select Representative</option>
                              {staffOptions.map((staffMember) => (
                                <option key={staffMember.id} value={staffMember.id}>
                                  {staffMember.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section 3: Contact & Remarks */}
                    <div className="form-card-section">
                      <div className="section-card-header">
                        <Phone size={16} className="section-card-icon" />
                        <div>
                          <h4>Contact & Landmarks</h4>
                          <span>Store manager contact and visit guidelines</span>
                        </div>
                      </div>

                      <div className="form-fields-stack">
                        <div className="form-fields-row-2">
                          <div className="form-input-group">
                            <label htmlFor="contact-name">Contact Person</label>
                            <div className="input-with-icon">
                              <User size={15} className="field-inner-icon" />
                              <input
                                id="contact-name"
                                type="text"
                                placeholder="Store manager name"
                                value={form.contactName}
                                onChange={(e) =>
                                  setForm({ ...form, contactName: e.target.value })
                                }
                              />
                            </div>
                          </div>

                          <div className="form-input-group">
                            <label htmlFor="contact-phone">Contact Phone</label>
                            <div className="input-with-icon">
                              <Phone size={15} className="field-inner-icon" />
                              <input
                                id="contact-phone"
                                type="tel"
                                placeholder="+234..."
                                value={form.contactPhone}
                                onChange={(e) =>
                                  setForm({ ...form, contactPhone: e.target.value })
                                }
                              />
                            </div>
                          </div>
                        </div>

                        <div className="form-input-group">
                          <label htmlFor="contact-email">Email Address</label>
                          <input
                            id="contact-email"
                            type="email"
                            placeholder="manager@example.com"
                            value={form.contactEmail}
                            onChange={(e) =>
                              setForm({ ...form, contactEmail: e.target.value })
                            }
                          />
                        </div>

                        <div className="form-input-group">
                          <label htmlFor="outlet-remarks">Remarks & Directions</label>
                          <textarea
                            id="outlet-remarks"
                            placeholder="Notable landmarks, operating hours, delivery access notes..."
                            value={form.remarks}
                            onChange={(e) =>
                              setForm({ ...form, remarks: e.target.value })
                            }
                            rows={2}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: GPS Verification & Calibration Hub */}
                  <div className="modal-form-side-column">
                    {/* GPS Calibration Hub */}
                    <div className="gps-calibration-card-pro">
                      <div className="gps-hub-header">
                        <div className="gps-hub-title-group">
                          <Crosshair size={17} className="gps-hub-icon" />
                          <div>
                            <h4>GPS Calibration</h4>
                            <span>Verification for field attendance</span>
                          </div>
                        </div>
                        <span className="gps-accuracy-chip">High Accuracy</span>
                      </div>

                      {/* Coordinates Display Box */}
                      {form.latitude !== null &&
                      form.latitude !== undefined &&
                      form.longitude !== null &&
                      form.longitude !== undefined ? (
                        <div className="gps-calibrated-banner">
                          <div className="banner-status-line">
                            <CheckCircle2 size={16} className="text-emerald" />
                            <strong>Coordinates Calibrated</strong>
                          </div>
                          <div className="coords-display-pills">
                            <div className="coord-pill">
                              <span className="coord-lbl">Lat</span>
                              <span className="coord-val">{Number(form.latitude).toFixed(6)}</span>
                            </div>
                            <div className="coord-pill">
                              <span className="coord-lbl">Lng</span>
                              <span className="coord-val">{Number(form.longitude).toFixed(6)}</span>
                            </div>
                          </div>
                          {form.accuracy && (
                            <div className="coord-meta-sub">
                              <span>Estimated accuracy: ~{Math.round(form.accuracy)}m</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="gps-pending-banner">
                          <AlertCircle size={20} className="text-amber" />
                          <div>
                            <strong>No Coordinates Captured</strong>
                            <p>
                              Capture GPS coordinates on-site or enter them manually.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Co-located Outlets Notice (Multiple distinct outlets at same GPS location) */}
                      {colocatedOutlets.length > 0 && (
                        <div className="colocated-outlets-banner">
                          <Building2 size={16} className="colocated-icon" />
                          <div className="colocated-content">
                            <div className="colocated-header-line">
                              <strong>Shared Location Hub ({colocatedOutlets.length} other outlet{colocatedOutlets.length > 1 ? "s" : ""} here)</strong>
                              <span className="colocated-tag">Multi-tenant Site</span>
                            </div>
                            <p>
                              Sharing coordinates with: <strong>{colocatedOutlets.slice(0, 3).map((o) => o.name).join(", ")}</strong>
                              {colocatedOutlets.length > 3 ? ` +${colocatedOutlets.length - 3} more` : ""}.
                              Different businesses at the same complex, plaza, or address are supported.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* GPS Action Button */}
                      <div className="gps-hub-actions">
                        <button
                          type="button"
                          className={`gps-primary-capture-btn ${capturingGps ? "loading" : ""} ${form.latitude ? "recalibrate" : ""}`}
                          onClick={() => void captureGps(false)}
                          disabled={capturingGps}
                        >
                          {capturingGps ? (
                            <>
                              <RefreshCw size={15} className="spin" />
                              <span>
                                {gpsSamples.length > 0
                                  ? `Sampling GPS (${gpsSamples.length} captured)...`
                                  : "Acquiring GPS fix..."}
                              </span>
                            </>
                          ) : form.latitude ? (
                            <>
                              <RefreshCw size={15} />
                              <span>Recalibrate GPS</span>
                            </>
                          ) : (
                            <>
                              <Crosshair size={16} />
                              <span>Capture High-Accuracy GPS</span>
                            </>
                          )}
                        </button>

                        {form.latitude !== null && form.latitude !== undefined && (
                          <button
                            type="button"
                            className="gps-reset-btn"
                            onClick={() => {
                              setGpsSamples([]);
                              setForm((prev) => ({
                                ...prev,
                                latitude: null,
                                longitude: null,
                                accuracy: null,
                                capturedOn: null,
                              }));
                            }}
                          >
                            Reset coordinates
                          </button>
                        )}
                      </div>

                      {gpsError && (
                        <div className="gps-error-alert-wrapper">
                          <div className="gps-error-alert" role="alert">
                            <AlertCircle size={14} style={{ flexShrink: 0 }} />
                            <span>{gpsError}</span>
                          </div>
                          <div className="gps-fallback-actions">
                            <button
                              type="button"
                              className="gps-fallback-btn"
                              onClick={() => void captureGps(true)}
                              disabled={capturingGps}
                              title="Try acquiring location via Wi-Fi or cellular network"
                            >
                              <Wifi size={13} />
                              <span>Try Network Location</span>
                            </button>
                            <button
                              type="button"
                              className="gps-fallback-btn-outline"
                              onClick={() => setManualCoordsOpen(true)}
                            >
                              <MapPin size={13} />
                              <span>Enter Coordinates Manually</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Manual coordinate overrides */}
                      <details
                        className="manual-coords-details"
                        open={manualCoordsOpen}
                        onToggle={(e) => setManualCoordsOpen((e.target as HTMLDetailsElement).open)}
                      >
                        <summary>Manual coordinate input (Admin / Fallback)</summary>
                        <div className="form-fields-row-2" style={{ marginTop: 8 }}>
                          <div className="form-input-group">
                            <label htmlFor="outlet-latitude">Latitude</label>
                            <input
                              id="outlet-latitude"
                              type="number"
                              step="any"
                              placeholder="e.g. 6.5244"
                              value={form.latitude ?? ""}
                              onChange={(e) =>
                                setForm({
                                  ...form,
                                  latitude: e.target.value ? Number(e.target.value) : null,
                                  capturedOn: form.capturedOn || new Date().toISOString(),
                                })
                              }
                            />
                          </div>
                          <div className="form-input-group">
                            <label htmlFor="outlet-longitude">Longitude</label>
                            <input
                              id="outlet-longitude"
                              type="number"
                              step="any"
                              placeholder="e.g. 3.3792"
                              value={form.longitude ?? ""}
                              onChange={(e) =>
                                setForm({
                                  ...form,
                                  longitude: e.target.value ? Number(e.target.value) : null,
                                  capturedOn: form.capturedOn || new Date().toISOString(),
                                })
                              }
                            />
                          </div>
                        </div>
                      </details>
                    </div>

                    {/* Policy Thresholds Card */}
                    <div className="policy-info-card-pro">
                      <div className="policy-card-title">
                        <ShieldCheck size={16} className="text-emerald" />
                        <h5>Field Attendance Policy</h5>
                      </div>
                      <div className="policy-metrics-grid">
                        <div className="policy-stat-item">
                          <span className="policy-stat-num">500m</span>
                          <span className="policy-stat-lbl">Max Check-in Radius</span>
                        </div>
                        <div className="policy-stat-item">
                          <span className="policy-stat-num">
                            {form.accuracy ? `${Math.round(form.accuracy)}m` : "17m"}
                          </span>
                          <span className="policy-stat-lbl">Allowed Accuracy</span>
                        </div>
                      </div>
                      <p className="policy-card-hint">
                        <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                        <span>
                          Reps can only log attendance and sales visits when physically within
                          calibrated distance.
                        </span>
                      </p>
                    </div>

                    {/* Audit Summary */}
                    <div className="audit-info-card-pro">
                      <span className="audit-label">Record Status</span>
                      <strong className="audit-val">
                        {editingOutletId ? "Existing Record Update" : "New Outlet Draft"}
                      </strong>
                      {form.capturedOn && (
                        <small className="audit-date">
                          Calibrated: {new Date(form.capturedOn).toLocaleString()}
                        </small>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Error Banner */}
              {error && (
                <div className="modal-error-banner" role="alert">
                  <AlertCircle size={15} />
                  <span>{error}</span>
                </div>
              )}

              {/* Modal Sticky Footer Actions */}
              <div className="outlet-modal-footer">
                <div className="modal-footer-left">
                  {editingOutletId && (
                    <button
                      type="button"
                      className="modal-delete-btn"
                      onClick={() => void handleDeleteOutlet()}
                      disabled={saving}
                    >
                      <Trash2 size={14} />
                      <span>Delete Outlet</span>
                    </button>
                  )}
                </div>

                <div className="modal-footer-right">
                  <button
                    type="button"
                    className="modal-cancel-btn"
                    onClick={() => setDialogOpen(false)}
                    disabled={saving}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="primary-button modal-submit-btn"
                    disabled={saving || Boolean(duplicateOutlet)}
                    title={
                      duplicateOutlet
                        ? `An outlet named "${duplicateOutlet.name}" is already registered at this location/area`
                        : undefined
                    }
                  >
                    {saving ? (
                      <>
                        <RefreshCw size={15} className="spin" />
                        <span>Saving...</span>
                      </>
                    ) : editingOutletId ? (
                      <>
                        <Check size={15} />
                        <span>Save Changes</span>
                      </>
                    ) : (
                      <>
                        <Plus size={15} />
                        <span>Create Outlet</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}