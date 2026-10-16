import type { DailyActivitySummary } from "../../services/teamActivityService";
import { formatCurrencyNaira } from "../../services/teamActivityService";

interface TabDailyActivityProps {
  dailySummaries: DailyActivitySummary[];
}

export default function TabDailyActivity({ dailySummaries }: TabDailyActivityProps) {
  // Aggregate totals
  const totalSales = dailySummaries.reduce((sum, d) => sum + d.salesCount, 0);
  const totalRevenue = dailySummaries.reduce((sum, d) => sum + d.revenue, 0);
  const totalVisits = dailySummaries.reduce((sum, d) => sum + d.visitsCount, 0);
  const totalSuccessfulVisits = dailySummaries.reduce((sum, d) => sum + d.successfulVisitsCount, 0);

  return (
    <div className="ta-content-card">
      {/* Subheader */}
      <div className="ta-card-header">
        <div className="ta-card-title-wrap">
          <h3>Daily Activity Summary</h3>
          <div className="ta-card-subtitle">{dailySummaries.length} days</div>
        </div>
      </div>

      {/* Table */}
      <div className="ta-table-scroll-container">
        <table className="ta-table">
          <thead>
            <tr>
              <th style={{ width: "14%" }}>Date</th>
              <th style={{ width: "12%" }}>Day</th>
              <th style={{ width: "16%" }}>Attendance</th>
              <th style={{ width: "14%", textAlign: "right" }}>Sales</th>
              <th style={{ width: "18%", textAlign: "right" }}>Revenue</th>
              <th style={{ width: "13%", textAlign: "right" }}>Visits</th>
              <th style={{ width: "13%", textAlign: "right" }}>Successful</th>
            </tr>
          </thead>
          <tbody>
            {dailySummaries.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                  No daily records found for the selected date range.
                </td>
              </tr>
            ) : (
              dailySummaries.map((day) => (
                <tr key={day.date}>
                  {/* Date */}
                  <td style={{ fontWeight: 600, color: "#1e293b", fontSize: "13.5px" }}>
                    {day.formattedDate}
                  </td>

                  {/* Day of week */}
                  <td style={{ color: "#475569", fontWeight: 500, fontSize: "13px" }}>
                    {day.dayOfWeek}
                  </td>

                  {/* Attendance Badge */}
                  <td>
                    {day.attendanceStatus === "Present" && (
                      <span className="ta-badge-present">Present</span>
                    )}
                    {day.attendanceStatus === "Partial" && (
                      <span className="ta-badge-off" style={{ background: "#fef3c7", color: "#92400e" }}>
                        Partial
                      </span>
                    )}
                    {day.attendanceStatus === "Off" && (
                      <span className="ta-badge-off">Off</span>
                    )}
                    {day.attendanceStatus === "-" && (
                      <span className="ta-badge-off" style={{ minWidth: "30px" }}>-</span>
                    )}
                  </td>

                  {/* Sales */}
                  <td style={{ textAlign: "right", fontWeight: 600, color: "#1e293b", fontSize: "13px" }}>
                    {day.salesCount}
                  </td>

                  {/* Revenue */}
                  <td style={{ textAlign: "right" }}>
                    <span className="ta-amount-cell" style={{ fontSize: "13px" }}>
                      {formatCurrencyNaira(day.revenue)}
                    </span>
                  </td>

                  {/* Visits */}
                  <td style={{ textAlign: "right", fontWeight: 600, color: "#1e293b", fontSize: "13px" }}>
                    {day.visitsCount}
                  </td>

                  {/* Successful */}
                  <td style={{ textAlign: "right", fontWeight: 600, color: "#1e293b", fontSize: "13px" }}>
                    {day.successfulVisitsCount}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {/* Summary Row */}
          {dailySummaries.length > 0 && (
            <tfoot>
              <tr style={{ background: "#f8fafc", fontWeight: 700, borderTop: "2px solid #cbd5e1" }}>
                <td style={{ padding: "14px 16px", color: "#092c1f" }}>Total / Period</td>
                <td style={{ color: "#64748b" }}>{dailySummaries.length} days</td>
                <td>—</td>
                <td style={{ textAlign: "right", color: "#092c1f" }}>{totalSales}</td>
                <td style={{ textAlign: "right", color: "#092c1f", fontFamily: "monospace" }}>
                  {formatCurrencyNaira(totalRevenue)}
                </td>
                <td style={{ textAlign: "right", color: "#092c1f" }}>{totalVisits}</td>
                <td style={{ textAlign: "right", color: "#092c1f" }}>
                  {totalSuccessfulVisits}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
