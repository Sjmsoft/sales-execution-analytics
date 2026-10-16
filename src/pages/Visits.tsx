import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  AlertCircle,
  BarChart3,
  CalendarCheck,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Download,
  Filter,
  MapPin,
  RefreshCw,
  RotateCcw,
  Search,
  Store,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import { getOutlets, type Outlet } from "../services/referenceService";
import { getVisitOutcomes } from "../services/visitOutcomeService";
import {
  deleteVisit,
  getVisits,
  type VisitRecord,
} from "../services/visitsService";
import {
  getUserScope,
  filterVisitsByScope,
  filterOutletsByScope,
} from "../services/dataScopeService";
import { FilterSelect, VisitDatePicker } from "./visits/VisitFilters";
import { VisitsDashboard, type VisitsTab } from "./visits/VisitsDashboard";
import { LeaderboardView } from "./visits/LeaderboardView";
import { VisitsTable, type SortDirection, type SortField } from "./visits/VisitsTable";
import { VisitsPageSkeleton } from "../components/ui/Skeleton";
import { useMinimumLoading } from "../hooks/useMinimumLoading";
import {
  parseDate,
  todayIsoDate,
  toErrorMessage,
  visitMetrics,
} from "./visits/visitsUtils";

const DEFAULT_START = "2026-09-01";
const DEFAULT_END = todayIsoDate();

const ALL = {
  region: "All regions",
  outletType: "All outlet types",
  outlet: "All outlets",
  status: "All statuses",
  outcome: "All outcomes",
};

const DEFAULT_FILTERS = {
  region: ALL.region,
  outletType: ALL.outletType,
  outlet: ALL.outlet,
  status: ALL.status,
  outcome: ALL.outcome,
  staffSearch: "",
};

/** Fetches outlets once on mount */
function useOutlets() {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  useEffect(() => {
    void getOutlets().then(setOutlets).catch(console.error);
  }, []);
  return outlets;
}

/** Loads visits for the date range and exposes a reload callback */
function useVisits(
  startDate: string,
  endDate: string,
  onError: (message: string) => void,
) {
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const visibleLoading = useMinimumLoading(loading, 800);

  const reload = useCallback(() => {
    setLoading(true);
    void getVisits(startDate, endDate)
      .then((data) => {
        setVisits(data);
      })
      .catch((error: unknown) =>
        onError(toErrorMessage(error, "Unable to load visits.")),
      )
      .finally(() => {
        setLoading(false);
      });
  }, [startDate, endDate, onError]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { visits, setVisits, loading: visibleLoading, reload };
}

export default function Visits() {
  const { staff, role } = useAuth();
  const userScope = useMemo(() => getUserScope(staff, role), [staff, role]);
  const roleKey = (role?.key || staff?.user_roles?.key || staff?.assigned_role || "").toLowerCase();
  const isBA = roleKey === "brand_ambassador" || roleKey === "ba" || roleKey === "vsr";

  const [activeTab, setActiveTab] = useState<VisitsTab>(isBA ? "Attendance" : "Visits");

  useEffect(() => {
    if (isBA && activeTab !== "Attendance") {
      setActiveTab("Attendance");
    }
  }, [isBA, activeTab]);

  const [startDate, setStartDate] = useState(DEFAULT_START);
  const [endDate, setEndDate] = useState(DEFAULT_END);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [visitError, setVisitError] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Sorting state
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Mobile viewport detection
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  const [showMobileFilters, setShowMobileFilters] = useState(true);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const rawOutlets = useOutlets();
  const outlets = useMemo(() => filterOutletsByScope(rawOutlets, userScope), [rawOutlets, userScope]);

  const { visits: rawVisits, setVisits, loading, reload } = useVisits(
    startDate,
    endDate,
    setVisitError,
  );
  const visits = useMemo(() => filterVisitsByScope(rawVisits, userScope), [rawVisits, userScope]);

  const [outcomeOptions, setOutcomeOptions] = useState<string[]>([
    "All outcomes",
    "Successful",
    "Partial",
    "Pending",
  ]);

  useEffect(() => {
    let active = true;
    getVisitOutcomes()
      .then((items) => {
        if (active) {
          const activeNames = items.filter((i) => i.is_active).map((i) => i.name);
          if (activeNames.length > 0) {
            setOutcomeOptions(["All outcomes", ...activeNames]);
          }
        }
      })
      .catch(console.warn);
    return () => {
      active = false;
    };
  }, []);

  const setFilter = <K extends keyof typeof DEFAULT_FILTERS>(
    key: K,
    value: (typeof DEFAULT_FILTERS)[K],
  ) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setStartDate(DEFAULT_START);
    setEndDate(DEFAULT_END);
    setFilters(DEFAULT_FILTERS);
    setSelectedIds([]);
    setCurrentPage(1);
  };

  const isAttendanceTab = activeTab === "Attendance";

  // Attendance tab shows shift check-ins; every other view is outlet visits.
  const scopedVisits = useMemo(
    () =>
      visits.filter(
        (visit) => visit.type === (isAttendanceTab ? "attendance" : "outlet"),
      ),
    [visits, isAttendanceTab],
  );

  const regionOptions = useMemo(() => {
    const set = new Set<string>();
    if (userScope.isRegional && userScope.assignedRegions.length > 0) {
      userScope.assignedRegions.forEach((r) => set.add(r));
    }
    scopedVisits.forEach((v) => {
      if (v.staffRegion) set.add(v.staffRegion);
      if (v.outletRegion) set.add(v.outletRegion);
      if (v.staffAssignedRegions) {
        v.staffAssignedRegions.forEach((r) => set.add(r));
      }
    });
    outlets.forEach((o) => {
      if (o.region_id) set.add(o.region_id);
      if (o.region) set.add(o.region);
      if (o.state) set.add(o.state);
    });
    const sorted = Array.from(set).filter(Boolean).sort();
    return [ALL.region, ...sorted];
  }, [userScope, scopedVisits, outlets]);

  const filteredVisits = useMemo(
    () =>
      scopedVisits.filter((visit) => {
        const matchesDate = visit.date >= startDate && visit.date <= endDate;
        const matchesStaff = visit.staff
          .toLowerCase()
          .includes(filters.staffSearch.toLowerCase());
        const matchesStatus =
          filters.status === ALL.status || visit.status === filters.status;
        const matchesOutcome =
          filters.outcome === ALL.outcome || visit.outcome === filters.outcome;
        const matchesOutlet =
          filters.outlet === ALL.outlet || visit.outlet === filters.outlet;
        const matchesRegion =
          filters.region === ALL.region ||
          (Boolean(visit.staffRegion) && visit.staffRegion!.toLowerCase().includes(filters.region.toLowerCase())) ||
          (Boolean(visit.outletRegion) && visit.outletRegion!.toLowerCase().includes(filters.region.toLowerCase())) ||
          (Boolean(visit.outletState) && visit.outletState!.toLowerCase().includes(filters.region.toLowerCase())) ||
          (Array.isArray(visit.staffAssignedRegions) &&
            visit.staffAssignedRegions.some((r) => r.toLowerCase().includes(filters.region.toLowerCase())));

        return (
          matchesDate &&
          matchesStaff &&
          matchesStatus &&
          matchesOutcome &&
          matchesOutlet &&
          matchesRegion
        );
      }),
    [scopedVisits, startDate, endDate, filters],
  );

  // Sort visits based on sortField and sortDirection
  const sortedVisits = useMemo(() => {
    return [...filteredVisits].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "outlet":
          comparison = a.outlet.localeCompare(b.outlet);
          break;
        case "staff":
          comparison = a.staff.localeCompare(b.staff);
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
        case "outcome":
          comparison = a.outcome.localeCompare(b.outcome);
          break;
        case "duration":
          comparison = a.duration.localeCompare(b.duration);
          break;
        case "date":
        default:
          comparison = a.date.localeCompare(b.date);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredVisits, sortField, sortDirection]);

  // Paginated slice
  const paginatedVisits = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedVisits.slice(start, start + pageSize);
  }, [sortedVisits, currentPage, pageSize]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const toggleSelected = (id: string) =>
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );

  const toggleAllSelected = () => {
    const pageIds = paginatedVisits.map((v) => v.id);
    const allPageSelected = pageIds.every((id) => selectedIds.includes(id));
    if (allPageSelected) {
      setSelectedIds((current) => current.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((current) => [...new Set([...current, ...pageIds])]);
    }
  };

  function handleDeleteVisit(visit: VisitRecord) {
    if (
      !window.confirm(
        `Delete the visit record for ${visit.outlet}? This cannot be undone.`,
      )
    )
      return;
    void deleteVisit(visit.id)
      .then(() => {
        setVisits((current) => current.filter((item) => item.id !== visit.id));
        setSelectedIds((current) => current.filter((id) => id !== visit.id));
      })
      .catch((error: unknown) =>
        setVisitError(toErrorMessage(error, "Unable to delete this visit.")),
      );
  }

  const handleDeleteSelected = () => {
    if (
      !window.confirm(
        `Delete ${selectedIds.length} selected visit records? This cannot be undone.`,
      )
    )
      return;

    selectedIds.forEach((id) => {
      void deleteVisit(id).catch(console.error);
    });

    setVisits((current) => current.filter((v) => !selectedIds.includes(v.id)));
    setSelectedIds([]);
  };

  const exportVisitsToCsv = () => {
    if (!sortedVisits.length) return;
    const headers = [
      "ID",
      "Type",
      "Outlet",
      "Representative",
      "Date",
      "Time",
      "Duration",
      "Status",
      "Outcome",
      "GPS Verified",
      "Photo Proof",
      "Notes",
    ];

    const rows = sortedVisits.map((r) => [
      r.id,
      r.type,
      `"${r.outlet.replace(/"/g, '""')}"`,
      `"${r.staff.replace(/"/g, '""')}"`,
      r.date,
      `"${r.time.replace(/"/g, '""')}"`,
      `"${r.duration.replace(/"/g, '""')}"`,
      r.status,
      r.outcome,
      r.gps ? "Yes" : "No",
      r.photo ? "Yes" : "No",
      `"${(r.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `${isAttendanceTab ? "attendance_checkins" : "outlet_visits"}_${todayIsoDate()}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const metrics = useMemo(() => visitMetrics(scopedVisits), [scopedVisits]);

  // Count active filters (ignoring defaults)
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.region !== ALL.region) count++;
    if (filters.outletType !== ALL.outletType) count++;
    if (filters.outlet !== ALL.outlet) count++;
    if (filters.status !== ALL.status) count++;
    if (filters.outcome !== ALL.outcome) count++;
    if (filters.staffSearch.trim()) count++;
    return count;
  }, [filters]);

  const isDateRangeFiltered = startDate !== DEFAULT_START || endDate !== DEFAULT_END;
  const activeFiltersTotalCount = activeFiltersCount + (isDateRangeFiltered ? 1 : 0);
  const hasActiveFilters = activeFiltersTotalCount > 0;

  if (loading && visits.length === 0) {
    return (
      <div className="page visits-page">
        <VisitsPageSkeleton />
      </div>
    );
  }

  return (
    <div className="page visits-page">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="visits-header-pro">
        <div className="visits-header-copy">
          <div className="visits-title-group">
            <h2>{isBA ? "Attendance History" : "Outlet Visits History"}</h2>
            <span className="visits-count-pill">
              {scopedVisits.length} {isBA ? "attendance records" : "total records"}
            </span>
          </div>
          <p>
            {isBA
              ? "Your operational log of daily attendance check-ins, shift duration, and GPS verification."
              : "Complete operational log of field visits, shift attendance check-ins, and GPS audits."}
          </p>
        </div>

        <div className="visits-header-actions">
          <button
            type="button"
            className="visits-action-btn-outline"
            onClick={reload}
            disabled={loading}
            title="Refresh visit records"
          >
            <RefreshCw size={15} className={loading ? "spin" : ""} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            className="visits-action-btn-primary"
            onClick={exportVisitsToCsv}
            disabled={!sortedVisits.length}
            title="Export filtered records to CSV"
          >
            <Download size={15} />
            <span>Export CSV ({sortedVisits.length})</span>
          </button>
        </div>
      </div>

      {/* ── Tab Navigation ───────────────────────────────────────── */}
      <div className="visits-tabs-container">
        <div
          className="visits-tabs-pro"
          role="tablist"
          aria-label="Outlet visits views"
        >
          {(
            isBA
              ? ([["Attendance", CalendarCheck]] as const)
              : ([
                  ["Visits", Store],
                  ["Attendance", CalendarCheck],
                  ["Dashboard", BarChart3],
                  ["Leaderboard", Trophy],
                ] as const)
          ).map(([label, Icon]) => (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={activeTab === label}
              className={`visits-tab-pro-btn ${activeTab === label ? "active" : ""}`}
              onClick={() => {
                if (isBA) return;
                setActiveTab(label);
                setSelectedIds([]);
                setCurrentPage(1);
              }}
            >
              <Icon size={15} />
              <span>{isBA ? "Attendance History" : label}</span>
              {label === "Visits" && (
                <span className="tab-badge">
                  {visits.filter((v) => v.type === "outlet").length}
                </span>
              )}
              {label === "Attendance" && (
                <span className="tab-badge">
                  {visits.filter((v) => v.type === "attendance").length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Feedback Banners ─────────────────────────────────────── */}
      {visitError && (
        <div className="visits-error-banner" role="alert">
          <AlertCircle size={16} />
          <span>{visitError}</span>
        </div>
      )}

      {/* ── KPI Metric Cards ─────────────────────────────────────── */}
      <div className="visits-kpi-pro-grid">
        <div className="visits-kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-label">
              {isAttendanceTab ? "Total Check-ins" : "Total Visits"}
            </span>
            <div className="kpi-icon-cube">
              <Store size={16} />
            </div>
          </div>
          <strong className="kpi-value">{metrics.total}</strong>
          <small className="kpi-subtext">Scoped to current filters</small>
        </div>

        <div className="visits-kpi-card kpi-card-active">
          <div className="kpi-card-header">
            <span className="kpi-label">Active Right Now</span>
            <div className="kpi-icon-cube icon-active">
              <MapPin size={16} />
            </div>
          </div>
          <strong className="kpi-value">{metrics.pendingOrPartial}</strong>
          <small className="kpi-subtext">
            {metrics.pendingOrPartial > 0 ? "Checkout pending" : "No open check-in"}
          </small>
        </div>

        <div className="visits-kpi-card kpi-card-success">
          <div className="kpi-card-header">
            <span className="kpi-label">Successful</span>
            <div className="kpi-icon-cube icon-success">
              <Check size={16} />
            </div>
          </div>
          <strong className="kpi-value">{metrics.successful}</strong>
          <small className="kpi-subtext">Fully verified visits</small>
        </div>

        <div className="visits-kpi-card kpi-card-pending">
          <div className="kpi-card-header">
            <span className="kpi-label">Partial / Pending</span>
            <div className="kpi-icon-cube icon-pending">
              <Clock3 size={16} />
            </div>
          </div>
          <strong className="kpi-value">{metrics.pendingOrPartial}</strong>
          <small className="kpi-subtext">Pending outcomes</small>
        </div>

        <div className="visits-kpi-card kpi-card-rate">
          <div className="kpi-card-header">
            <span className="kpi-label">Success Rate</span>
            <span className="kpi-rate-badge">{metrics.successRate}%</span>
          </div>
          <div className="kpi-progress-bar">
            <span style={{ width: `${metrics.successRate}%` }} />
          </div>
          <small className="kpi-subtext">{metrics.gpsRate}% GPS compliance</small>
        </div>
      </div>

      {/* ── Main View Content ────────────────────────────────────── */}
      {activeTab === "Dashboard" ? (
        <VisitsDashboard visits={scopedVisits} />
      ) : activeTab === "Leaderboard" ? (
        <LeaderboardView visits={scopedVisits} isAttendance={isAttendanceTab} />
      ) : (
        <section className="visits-records-panel-pro">
          {/* Panel Header */}
          <div className="visits-records-header-pro">
            <div className="records-header-left">
              <h3>
                {isAttendanceTab
                  ? "Daily Shift Attendance Records"
                  : "Outlet Visit History"}
              </h3>
              <p>
                {isAttendanceTab
                  ? "Staff check-ins and check-outs with GPS verification and checkout photos."
                  : "Review visit outcomes, durations, GPS compliance, and photo evidence."}
              </p>
            </div>

            <div className="records-header-right">
              {hasActiveFilters && (
                <button
                  type="button"
                  className="header-clear-filters-btn"
                  onClick={resetFilters}
                  title="Clear all active filters and reset dates"
                >
                  <RotateCcw size={13} />
                  <span>Clear Filters ({activeFiltersTotalCount})</span>
                </button>
              )}
              {isMobile && (
                <button
                  type="button"
                  className={`mobile-filter-toggle-btn ${showMobileFilters ? "open" : ""}`}
                  onClick={() => setShowMobileFilters((prev) => !prev)}
                  aria-expanded={showMobileFilters}
                >
                  <Filter size={14} />
                  <span>Filters {activeFiltersTotalCount > 0 ? `(${activeFiltersTotalCount})` : ""}</span>
                  {showMobileFilters ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              )}
              <span className="record-count-chip">
                {filteredVisits.length} records found
              </span>
            </div>
          </div>

          {/* Filter Bar (Collapsible on Mobile, Full on Desktop) */}
          <div className={`visits-filter-suite ${isMobile && !showMobileFilters ? "collapsed" : ""}`}>
            {/* Date Pickers */}
            <div className="date-picker-row">
              <VisitDatePicker
                label="Start date"
                value={startDate}
                onChange={(val) => {
                  setStartDate(val);
                  setCurrentPage(1);
                }}
                maxDate={parseDate(endDate)}
              />
              <VisitDatePicker
                label="End date"
                value={endDate}
                onChange={(val) => {
                  setEndDate(val);
                  setCurrentPage(1);
                }}
                minDate={parseDate(startDate)}
              />
              <div className="date-filter-actions">
                <button
                  type="button"
                  className="date-apply-btn"
                  onClick={reload}
                  disabled={loading}
                >
                  Apply Range
                </button>
                <button
                  type="button"
                  className={`clear-filters-btn ${hasActiveFilters ? "active" : ""}`}
                  onClick={resetFilters}
                  disabled={!hasActiveFilters}
                  title="Clear all filters and reset to default dates"
                >
                  <RotateCcw size={13} />
                  <span>Clear Filters</span>
                  {activeFiltersTotalCount > 0 && (
                    <span className="clear-filters-count">{activeFiltersTotalCount}</span>
                  )}
                </button>
              </div>
            </div>

            {/* Dropdown Filters & Search */}
            <div className="dropdown-filter-row">
              <FilterSelect
                label="Region"
                value={filters.region}
                options={regionOptions}
                onChange={(value) => setFilter("region", value)}
              />
              <FilterSelect
                label="Outlet type"
                value={filters.outletType}
                options={["All outlet types", "ON-TRADE", "OFF-TRADE"]}
                onChange={(value) => setFilter("outletType", value)}
              />
              <FilterSelect
                label="Outlet"
                value={filters.outlet}
                options={["All outlets", ...outlets.map((item) => item.name)]}
                onChange={(value) => setFilter("outlet", value)}
              />
              <FilterSelect
                label="Status"
                value={filters.status}
                options={["All statuses", "Completed", "Active", "Pending"]}
                onChange={(value) => setFilter("status", value)}
              />
              <FilterSelect
                label="Outcome"
                value={filters.outcome}
                options={outcomeOptions}
                onChange={(value) => setFilter("outcome", value)}
              />
              <div className="visits-filter-field search-filter-field">
                <span className="visits-field-label">Representative</span>
                <div className="visits-staff-search-box">
                  <Search size={14} className="search-icon" />
                  <input
                    placeholder="Search representative..."
                    value={filters.staffSearch}
                    onChange={(event) => setFilter("staffSearch", event.target.value)}
                    aria-label="Search representative"
                  />
                  {filters.staffSearch && (
                    <button
                      type="button"
                      className="search-clear-btn"
                      onClick={() => setFilter("staffSearch", "")}
                      aria-label="Clear search"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="visits-table-toolbar-pro">
            <div className="toolbar-info">
              <span>
                {selectedIds.length > 0 ? (
                  <strong className="selection-active-text">
                    {selectedIds.length} item{selectedIds.length > 1 ? "s" : ""} selected
                  </strong>
                ) : (
                  <span>Showing sorted visit entries. Click headers to reorder.</span>
                )}
              </span>
            </div>

            <div className="toolbar-actions-cluster">
              {hasActiveFilters && (
                <button
                  type="button"
                  className="reset-filters-btn"
                  onClick={resetFilters}
                >
                  <RotateCcw size={13} />
                  <span>Clear Filters ({activeFiltersTotalCount})</span>
                </button>
              )}

              {selectedIds.length > 0 && (
                <button
                  type="button"
                  className="delete-selected-btn"
                  onClick={handleDeleteSelected}
                >
                  <Trash2 size={13} />
                  <span>Delete Selected ({selectedIds.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* ── Table & Pagination Component ───────────────────────── */}
          <VisitsTable
            visits={paginatedVisits}
            allFilteredCount={sortedVisits.length}
            selectedIds={selectedIds}
            onToggleSelected={toggleSelected}
            onToggleAll={toggleAllSelected}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={toggleSort}
            isMobile={isMobile}
            onDeleteVisit={handleDeleteVisit}
            isAttendanceTab={isAttendanceTab}
            onResetFilters={resetFilters}
            hasActiveFilters={hasActiveFilters}
            loading={loading}
          />
        </section>
      )}
    </div>
  );
}
