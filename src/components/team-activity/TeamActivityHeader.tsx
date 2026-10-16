import { useState, useRef, useEffect } from "react";
import {
  Activity,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Printer,
  RefreshCw,
} from "lucide-react";
import type { TeamFilterOptions } from "../../services/teamActivityService";

interface TeamActivityHeaderProps {
  filters: TeamFilterOptions;
  onFilterChange: (newFilters: Partial<TeamFilterOptions>) => void;
  regions: string[];
  staffNames: string[];
  activeMembersCount: number;
  dateRangeLabel: string;
  onRefresh: () => void;
  loading: boolean;
  onExport: (format: "csv" | "excel" | "print") => void;
}

export default function TeamActivityHeader({
  filters,
  onFilterChange,
  regions,
  staffNames,
  activeMembersCount,
  dateRangeLabel,
  onRefresh,
  loading,
  onExport,
}: TeamActivityHeaderProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setExportOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="ta-header-wrapper">
      {/* Title & Metadata */}
      <div className="ta-header-left">
        <div className="ta-header-icon-badge">
          <Activity size={24} strokeWidth={2.5} />
        </div>
        <div className="ta-header-text">
          <h1>Team Activity Summary</h1>
          <div className="ta-header-meta">
            <span>{activeMembersCount} active members</span>
            <span className="ta-meta-dot">•</span>
            <span>{dateRangeLabel}</span>
          </div>
        </div>
      </div>

      {/* Export Action */}
      <div className="ta-export-btn-group" ref={dropdownRef}>
        <button
          type="button"
          className="ta-btn-export"
          onClick={() => setExportOpen((prev) => !prev)}
        >
          <Download size={16} />
          <span>Export</span>
          <ChevronDown size={14} />
        </button>

        {exportOpen && (
          <div className="ta-export-dropdown">
            <button
              type="button"
              className="ta-dropdown-item"
              onClick={() => {
                onExport("csv");
                setExportOpen(false);
              }}
            >
              <FileSpreadsheet size={15} color="#0d5c3a" />
              <span>Export as CSV</span>
            </button>
            <button
              type="button"
              className="ta-dropdown-item"
              onClick={() => {
                onExport("excel");
                setExportOpen(false);
              }}
            >
              <FileText size={15} color="#2563eb" />
              <span>Export as Excel</span>
            </button>
            <button
              type="button"
              className="ta-dropdown-item"
              onClick={() => {
                onExport("print");
                setExportOpen(false);
              }}
            >
              <Printer size={15} color="#475569" />
              <span>Print / Save PDF</span>
            </button>
          </div>
        )}
      </div>

      {/* Global Filter Bar */}
      <div className="ta-filter-bar" style={{ width: "100%", marginTop: "4px" }}>
        <div className="ta-filter-icon-wrap">
          <Filter size={16} />
        </div>

        {/* Region Filter */}
        <div className="ta-filter-select-wrapper">
          <select
            className="ta-filter-select"
            value={filters.region}
            onChange={(e) => onFilterChange({ region: e.target.value })}
            aria-label="Filter by region"
          >
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="ta-select-chevron" />
        </div>

        {/* Staff Status Filter */}
        <div className="ta-filter-select-wrapper">
          <select
            className="ta-filter-select"
            value={filters.staffStatus}
            onChange={(e) => onFilterChange({ staffStatus: e.target.value as any })}
            aria-label="Filter by staff status"
          >
            <option value="Active Staff">Active Staff</option>
            <option value="All Staff">All Staff</option>
            <option value="Inactive Staff">Inactive Staff</option>
          </select>
          <ChevronDown size={14} className="ta-select-chevron" />
        </div>

        {/* Member Filter */}
        <div className="ta-filter-select-wrapper">
          <select
            className="ta-filter-select"
            value={filters.memberId}
            onChange={(e) => onFilterChange({ memberId: e.target.value })}
            aria-label="Filter by team member"
          >
            {staffNames.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="ta-select-chevron" />
        </div>

        {/* Activity Type Filter */}
        <div className="ta-filter-select-wrapper">
          <select
            className="ta-filter-select"
            value={filters.activityType}
            onChange={(e) => onFilterChange({ activityType: e.target.value as any })}
            aria-label="Filter by activity type"
          >
            <option value="All Types">All Types</option>
            <option value="Sale">Sales Only</option>
            <option value="Visit">Visits Only</option>
            <option value="Attendance">Attendance Only</option>
          </select>
          <ChevronDown size={14} className="ta-select-chevron" />
        </div>

        {/* Date Range Filter */}
        <div className="ta-filter-select-wrapper">
          <select
            className="ta-filter-select"
            value={filters.dateRange}
            onChange={(e) => onFilterChange({ dateRange: e.target.value as any })}
            aria-label="Filter by date range"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
          </select>
          <ChevronDown size={14} className="ta-select-chevron" />
        </div>

        {/* Refresh Action */}
        <div className="ta-filter-actions">
          <button
            type="button"
            className={`ta-btn-refresh ${loading ? "spinning" : ""}`}
            onClick={onRefresh}
            title="Refresh analytics data"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
