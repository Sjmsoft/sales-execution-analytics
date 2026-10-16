import { useState } from "react";
import {
  Calendar,
  Camera,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Eye,
  FileText,
  MapPin,
  RotateCcw,
  Store,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import type { VisitRecord } from "../../services/visitsService";
import { formatDate } from "./visitsUtils";
import { TableSkeleton } from "../../components/ui/Skeleton";

export type SortField = "date" | "outlet" | "staff" | "duration" | "status" | "outcome";
export type SortDirection = "asc" | "desc";

type VisitsTableProps = {
  visits: VisitRecord[];
  allFilteredCount: number;
  selectedIds: string[];
  onToggleSelected: (id: string) => void;
  onToggleAll: () => void;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  isMobile?: boolean;
  onDeleteVisit?: (visit: VisitRecord) => void;
  isAttendanceTab?: boolean;
  onResetFilters?: () => void;
  hasActiveFilters?: boolean;
  loading?: boolean;
};

export function VisitsTable({
  visits,
  allFilteredCount,
  selectedIds,
  onToggleSelected,
  onToggleAll,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  sortField,
  sortDirection,
  onSort,
  isMobile = false,
  onDeleteVisit,
  isAttendanceTab = false,
  onResetFilters,
  hasActiveFilters = false,
  loading = false,
}: VisitsTableProps) {
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string } | null>(null);

  if (loading) {
    return (
      <div className="visits-table-container">
        <div style={{ padding: 16, background: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0" }}>
          <TableSkeleton rows={Math.min(pageSize, 8)} cols={8} />
        </div>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(allFilteredCount / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startRecord = allFilteredCount === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endRecord = Math.min(safeCurrentPage * pageSize, allFilteredCount);
  const allCurrentPageSelected =
    visits.length > 0 && visits.every((v) => selectedIds.includes(v.id));

  // Compute pagination page numbers with smart ellipsis
  const getPageNumbers = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (safeCurrentPage <= 3) {
      return [1, 2, 3, 4, "...", totalPages];
    }
    if (safeCurrentPage >= totalPages - 2) {
      return [1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, "...", safeCurrentPage - 1, safeCurrentPage, safeCurrentPage + 1, "...", totalPages];
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <span className="sort-indicator neutral">↕</span>;
    }
    return (
      <span className="sort-indicator active">
        {sortDirection === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  return (
    <div className="visits-table-container">
      {/* ── Desktop View (Table) ──────────────────────────────────── */}
      <div className={`visits-table-wrap ${isMobile ? "mobile-hidden" : ""}`}>
        <table className="visits-table">
          <thead>
            <tr>
              <th style={{ width: 44 }}>
                <input
                  type="checkbox"
                  aria-label="Select all visits on this page"
                  checked={allCurrentPageSelected}
                  onChange={onToggleAll}
                />
              </th>
              <th className="sortable-header" onClick={() => onSort("outlet")}>
                <span>{isAttendanceTab ? "Shift Location" : "Outlet"}</span>
                {renderSortIndicator("outlet")}
              </th>
              <th className="sortable-header" onClick={() => onSort("staff")}>
                <span>Representative</span>
                {renderSortIndicator("staff")}
              </th>
              <th className="sortable-header" onClick={() => onSort("date")}>
                <span>{isAttendanceTab ? "Shift Date" : "Visit Date"}</span>
                {renderSortIndicator("date")}
              </th>
              <th>Time</th>
              <th className="sortable-header" onClick={() => onSort("duration")}>
                <span>{isAttendanceTab ? "Shift Duration" : "Duration"}</span>
                {renderSortIndicator("duration")}
              </th>
              <th className="sortable-header" onClick={() => onSort("status")}>
                <span>Status &amp; Outcome</span>
                {renderSortIndicator("status")}
              </th>
              <th>Verification</th>
              <th style={{ textAlign: "right", paddingRight: 16 }}>Evidence &amp; Actions</th>
            </tr>
          </thead>
          <tbody>
            {!visits.length ? (
              <tr className="visits-empty-row">
                <td colSpan={9} className="visits-empty-table-td">
                  <div className="visits-empty-state">
                    <div className="visits-empty-icon-wrap">
                      <Store size={36} className="empty-icon" />
                    </div>
                    <h4 className="visits-empty-title">
                      {isAttendanceTab ? "No attendance records found" : "No visits found"}
                    </h4>
                    <p className="visits-empty-description">
                      {isAttendanceTab
                        ? "No shift attendance check-ins match your current criteria, date range, or active filters."
                        : "No visit records match your current criteria, date range, or active filters."}
                    </p>
                    {hasActiveFilters && onResetFilters && (
                      <button
                        type="button"
                        className="empty-state-clear-btn"
                        onClick={onResetFilters}
                      >
                        <RotateCcw size={13} />
                        <span>Clear All Filters</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              visits.map((visit) => {
                const isSelected = selectedIds.includes(visit.id);

                return (
                  <tr key={visit.id} className={isSelected ? "row-selected" : ""}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select ${visit.outlet}`}
                        checked={isSelected}
                        onChange={() => onToggleSelected(visit.id)}
                      />
                    </td>
                    <td>
                      <div className="visits-outlet-cell">
                        <div className="outlet-avatar-cube">
                          <Store size={15} />
                        </div>
                        <div className="outlet-cell-copy">
                          <strong title={visit.outlet}>{visit.outlet}</strong>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                            <small className="outlet-id-tag">ID: {visit.id.slice(0, 8)}</small>
                            {visit.notes && (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  fontSize: 11,
                                  color: "#4a5a54",
                                  background: "#edf3f0",
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  maxWidth: 220,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                                title={`Note: ${visit.notes}`}
                              >
                                <FileText size={10} style={{ flexShrink: 0 }} />
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{visit.notes}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="visits-staff-cell">
                        <UserRound size={14} className="staff-icon" />
                        <span>{visit.staff}</span>
                      </div>
                    </td>
                    <td>
                      <div className="date-cell">
                        <span>{formatDate(visit.date)}</span>
                      </div>
                    </td>
                    <td>
                      <span className="time-badge">{visit.time}</span>
                    </td>
                    <td>
                      <span className="duration-pill">
                        <Clock3 size={12} />
                        {visit.duration}
                      </span>
                    </td>
                    <td>
                      <div className="status-cell-stack">
                        <span className={`visit-status-badge status-${visit.status.toLowerCase()}`}>
                          {visit.status}
                        </span>
                        <span className={`visit-outcome-badge outcome-${visit.outcome.toLowerCase()}`}>
                          {visit.outcome}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="verification-badges-row">
                        <span className={`verification-chip ${visit.gps ? "gps-valid" : "gps-missing"}`}>
                          <MapPin size={11} />
                          {visit.gps ? "GPS Captured" : "GPS Pending"}
                        </span>
                        {visit.photo && (
                          <span className="verification-chip photo-valid">
                            <Camera size={11} />
                            Photo Proof
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="actions-cell-right">
                        {visit.photoUrl ? (
                          <button
                            type="button"
                            className="visit-photo-thumb-btn"
                            onClick={() =>
                              setPreviewPhoto({
                                url: visit.photoUrl!,
                                title: `${visit.outlet} checkout photo`,
                              })
                            }
                            title="View sign-out photo"
                          >
                            <img src={visit.photoUrl} alt={`Photo at ${visit.outlet}`} />
                            <span className="zoom-hint">
                              <Eye size={12} />
                            </span>
                          </button>
                        ) : (
                          <span className="no-photo-text">No photo</span>
                        )}

                        {onDeleteVisit && (
                          <button
                            type="button"
                            className="visit-row-delete-btn"
                            onClick={() => onDeleteVisit(visit)}
                            title="Delete visit record"
                            aria-label={`Delete record for ${visit.outlet}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }))}
          </tbody>
        </table>
      </div>

      {/* ── Mobile View (Responsive Feed Cards) ──────────────────── */}
      <div className={`visits-mobile-feed ${!isMobile ? "desktop-hidden" : ""}`}>
        {!visits.length ? (
          <div className="visits-empty-state">
            <div className="visits-empty-icon-wrap">
              <Store size={36} className="empty-icon" />
            </div>
            <h4 className="visits-empty-title">
              {isAttendanceTab ? "No attendance records found" : "No visits found"}
            </h4>
            <p className="visits-empty-description">
              {isAttendanceTab
                ? "No shift attendance check-ins match your current criteria, date range, or active filters."
                : "No visit records match your current criteria, date range, or active filters."}
            </p>
            {hasActiveFilters && onResetFilters && (
              <button
                type="button"
                className="empty-state-clear-btn"
                onClick={onResetFilters}
              >
                <RotateCcw size={13} />
                <span>Clear All Filters</span>
              </button>
            )}
          </div>
        ) : (
          visits.map((visit) => {
            const isSelected = selectedIds.includes(visit.id);

            return (
              <div
                key={visit.id}
                className={`visit-mobile-card ${isSelected ? "card-selected" : ""}`}
              >
                <div className="card-top-row">
                  <div className="card-outlet-heading">
                    <input
                      type="checkbox"
                      aria-label={`Select ${visit.outlet}`}
                      checked={isSelected}
                      onChange={() => onToggleSelected(visit.id)}
                    />
                    <div>
                      <strong className="card-outlet-title">{visit.outlet}</strong>
                      <span className="card-sub-id">ID: {visit.id.slice(0, 8)}</span>
                    </div>
                  </div>
                  <div className="card-status-cluster">
                    <span className={`visit-status-badge status-${visit.status.toLowerCase()}`}>
                      {visit.status}
                    </span>
                    <span className={`visit-outcome-badge outcome-${visit.outcome.toLowerCase()}`}>
                      {visit.outcome}
                    </span>
                  </div>
                </div>

                {visit.notes && (
                  <div
                    style={{
                      margin: "8px 0 2px",
                      padding: "6px 8px",
                      background: "#edf3f0",
                      borderRadius: 6,
                      fontSize: 12,
                      color: "#30403a",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 6,
                    }}
                  >
                    <FileText size={13} style={{ marginTop: 2, flexShrink: 0, color: "#166534" }} />
                    <span style={{ wordBreak: "break-word" }}>{visit.notes}</span>
                  </div>
                )}

                <div className="card-meta-grid">
                  <div className="card-meta-item">
                    <UserRound size={13} className="text-muted" />
                    <span>{visit.staff}</span>
                  </div>
                  <div className="card-meta-item">
                    <Calendar size={13} className="text-muted" />
                    <span>{formatDate(visit.date)}</span>
                  </div>
                  <div className="card-meta-item">
                    <Clock3 size={13} className="text-muted" />
                    <span>{visit.time} ({visit.duration})</span>
                  </div>
                </div>

                <div className="card-bottom-bar">
                  <div className="card-verification-chips">
                    <span className={`verification-chip ${visit.gps ? "gps-valid" : "gps-missing"}`}>
                      <MapPin size={11} />
                      {visit.gps ? "GPS Verified" : "No GPS"}
                    </span>
                    {visit.photo && (
                      <span className="verification-chip photo-valid">
                        <Camera size={11} />
                        Photo
                      </span>
                    )}
                  </div>

                  <div className="card-action-btns">
                    {visit.photoUrl && (
                      <button
                        type="button"
                        className="mobile-photo-preview-btn"
                        onClick={() =>
                          setPreviewPhoto({
                            url: visit.photoUrl!,
                            title: `${visit.outlet} checkout photo`,
                          })
                        }
                      >
                        <Eye size={13} />
                        <span>Photo</span>
                      </button>
                    )}
                    {onDeleteVisit && (
                      <button
                        type="button"
                        className="mobile-card-del-btn"
                        onClick={() => onDeleteVisit(visit)}
                        title="Delete visit"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Professional Pagination Bar ──────────────────────────── */}
      {allFilteredCount > 0 && (
        <div className="visits-pagination-bar">
          <div className="pagination-summary">
            <span>
              Showing <strong>{startRecord}</strong>–<strong>{endRecord}</strong> of{" "}
              <strong>{allFilteredCount}</strong> {isAttendanceTab ? "check-ins" : "visits"}
            </span>

            <div className="pagination-page-size-wrap">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  onPageSizeChange(Number(e.target.value));
                  onPageChange(1);
                }}
                aria-label="Rows per page"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>per page</span>
            </div>
          </div>

          <div className="pagination-controls">
            <button
              type="button"
              className="page-nav-arrow"
              onClick={() => onPageChange(1)}
              disabled={safeCurrentPage <= 1}
              title="First Page"
              aria-label="First page"
            >
              «
            </button>
            <button
              type="button"
              className="page-nav-arrow"
              onClick={() => onPageChange(safeCurrentPage - 1)}
              disabled={safeCurrentPage <= 1}
              title="Previous Page"
              aria-label="Previous page"
            >
              <ChevronLeft size={15} />
            </button>

            <div className="page-number-buttons">
              {getPageNumbers().map((num, idx) =>
                num === "..." ? (
                  <span key={`ellipsis-${idx}`} className="page-ellipsis">
                    …
                  </span>
                ) : (
                  <button
                    key={num}
                    type="button"
                    className={`page-num-btn ${safeCurrentPage === num ? "active" : ""}`}
                    onClick={() => onPageChange(Number(num))}
                  >
                    {num}
                  </button>
                )
              )}
            </div>

            <button
              type="button"
              className="page-nav-arrow"
              onClick={() => onPageChange(safeCurrentPage + 1)}
              disabled={safeCurrentPage >= totalPages}
              title="Next Page"
              aria-label="Next page"
            >
              <ChevronRight size={15} />
            </button>
            <button
              type="button"
              className="page-nav-arrow"
              onClick={() => onPageChange(totalPages)}
              disabled={safeCurrentPage >= totalPages}
              title="Last Page"
              aria-label="Last page"
            >
              »
            </button>
          </div>
        </div>
      )}

      {/* ── Photo Lightbox Modal ─────────────────────────────────── */}
      {previewPhoto && (
        <div
          className="photo-lightbox-backdrop"
          onClick={() => setPreviewPhoto(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="photo-lightbox-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="photo-lightbox-header">
              <h4>{previewPhoto.title}</h4>
              <div className="lightbox-header-actions">
                <a
                  href={previewPhoto.url}
                  target="_blank"
                  rel="noreferrer"
                  className="lightbox-open-external"
                  title="Open full resolution in new tab"
                >
                  <ExternalLink size={15} />
                </a>
                <button
                  type="button"
                  className="lightbox-close-btn"
                  onClick={() => setPreviewPhoto(null)}
                  aria-label="Close photo preview"
                >
                  <X size={17} />
                </button>
              </div>
            </div>
            <div className="photo-lightbox-body">
              <img src={previewPhoto.url} alt={previewPhoto.title} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
