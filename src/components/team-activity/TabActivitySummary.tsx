import { useState, useMemo } from "react";
import {
  Search,
  ShoppingCart,
  MapPin,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { ActivityItem } from "../../services/teamActivityService";
import { formatCurrencyNaira } from "../../services/teamActivityService";

interface TabActivitySummaryProps {
  activities: ActivityItem[];
  onSelectActivity?: (activity: ActivityItem) => void;
}

const PAGE_SIZE = 15;

export default function TabActivitySummary({
  activities,
  onSelectActivity,
}: TabActivitySummaryProps) {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Filter activities by internal search
  const filteredActivities = useMemo(() => {
    if (!search.trim()) return activities;
    const q = search.toLowerCase().trim();
    return activities.filter(
      (a) =>
        a.staffName.toLowerCase().includes(q) ||
        a.outletName.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        (a.subDescription && a.subDescription.toLowerCase().includes(q))
    );
  }, [activities, search]);

  const totalPages = Math.max(1, Math.ceil(filteredActivities.length / PAGE_SIZE));
  const validPage = Math.min(currentPage, totalPages);

  const paginatedActivities = useMemo(() => {
    const startIndex = (validPage - 1) * PAGE_SIZE;
    return filteredActivities.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredActivities, validPage]);

  return (
    <div className="ta-content-card">
      {/* Subheader & Search */}
      <div className="ta-card-header">
        <div className="ta-card-title-wrap">
          <h3>Activity Summary</h3>
          <div className="ta-card-subtitle">
            {filteredActivities.length} activities found
          </div>
        </div>

        <div className="ta-card-controls">
          <div className="ta-search-input-wrap">
            <Search size={15} className="ta-search-icon" />
            <input
              type="text"
              className="ta-search-input"
              placeholder="Search activities, staff, outlets..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="ta-table-scroll-container">
        <table className="ta-table">
          <thead>
            <tr>
              <th style={{ width: "16%" }}>Date & Time</th>
              <th style={{ width: "12%" }}>Type</th>
              <th style={{ width: "18%" }}>Staff</th>
              <th style={{ width: "26%" }}>Description</th>
              <th style={{ width: "16%" }}>Outlet</th>
              <th style={{ width: "12%", textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {paginatedActivities.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                  No activities matching the selected filters.
                </td>
              </tr>
            ) : (
              paginatedActivities.map((act) => (
                <tr
                  key={act.id}
                  onClick={() => onSelectActivity && onSelectActivity(act)}
                  style={{ cursor: onSelectActivity ? "pointer" : "default" }}
                >
                  {/* Date & Time */}
                  <td>
                    <div style={{ fontWeight: 600, color: "#1e293b", fontSize: "13px" }}>
                      {act.formattedDate}
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                      {act.formattedTime}
                    </div>
                  </td>

                  {/* Type Badge */}
                  <td>
                    {act.type === "sale" && (
                      <span className="ta-badge-sale">
                        <ShoppingCart size={13} strokeWidth={2.5} />
                        <span>Sale</span>
                      </span>
                    )}
                    {act.type === "visit" && (
                      <span className="ta-badge-visit">
                        <MapPin size={13} />
                        <span>Visit</span>
                      </span>
                    )}
                    {act.type === "attendance" && (
                      <span className="ta-badge-attendance">
                        <Clock size={13} />
                        <span>Attendance</span>
                      </span>
                    )}
                  </td>

                  {/* Staff */}
                  <td>
                    <div className="ta-staff-name" style={{ fontSize: "13.5px" }}>
                      {act.staffName}
                    </div>
                  </td>

                  {/* Description */}
                  <td>
                    <div className="ta-desc-primary" style={{ fontSize: "13px" }}>
                      {act.description}
                    </div>
                    {act.subDescription && (
                      <div className="ta-desc-sub">{act.subDescription}</div>
                    )}
                  </td>

                  {/* Outlet */}
                  <td>
                    <div style={{ fontWeight: 500, color: "#334155", fontSize: "13px" }}>
                      {act.outletName}
                    </div>
                  </td>

                  {/* Amount */}
                  <td style={{ textAlign: "right" }}>
                    <span className="ta-amount-cell" style={{ fontSize: "13px" }}>
                      {act.amount > 0 ? formatCurrencyNaira(act.amount) : "-"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      {filteredActivities.length > PAGE_SIZE && (
        <div className="ta-pagination-bar">
          <div>
            Showing {(validPage - 1) * PAGE_SIZE + 1} to{" "}
            {Math.min(validPage * PAGE_SIZE, filteredActivities.length)} of{" "}
            {filteredActivities.length} entries
          </div>

          <div className="ta-pagination-btns">
            <button
              type="button"
              className="ta-page-btn"
              disabled={validPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={14} />
              <span>Previous</span>
            </button>
            <span style={{ padding: "0 8px", fontWeight: 600, color: "#1e293b" }}>
              Page {validPage} of {totalPages}
            </span>
            <button
              type="button"
              className="ta-page-btn"
              disabled={validPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
