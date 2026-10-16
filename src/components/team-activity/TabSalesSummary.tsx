import { useState, useMemo } from "react";
import { Download, Search } from "lucide-react";
import type { SalesTargetSummary, TeamActivityMetrics } from "../../services/teamActivityService";
import { exportSalesSummaryToCsv } from "../../services/teamActivityService";

interface TabSalesSummaryProps {
  salesSummaries: SalesTargetSummary[];
  metrics: TeamActivityMetrics;
}

export default function TabSalesSummary({
  salesSummaries,
  metrics,
}: TabSalesSummaryProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return salesSummaries;
    const q = search.toLowerCase().trim();
    return salesSummaries.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.role.toLowerCase().includes(q) ||
        s.region.toLowerCase().includes(q)
    );
  }, [salesSummaries, search]);

  const handleExportCsv = () => {
    exportSalesSummaryToCsv(filtered, "Sales_Target_Variance_Summary.csv");
  };

  return (
    <div>
      {/* 3 Summary KPI Cards (Top of Tab 4 - Image 4) */}
      <div className="ta-target-kpi-grid">
        {/* Total Sales */}
        <div className="ta-target-kpi-card">
          <div className="ta-target-kpi-title">Total Sales</div>
          <div className="ta-target-kpi-value">{metrics.totalSalesCases} cases</div>
          <div className="ta-target-kpi-sub">Across {metrics.activeMembersCount} team members</div>
        </div>

        {/* Total Target */}
        <div className="ta-target-kpi-card">
          <div className="ta-target-kpi-title">Total Target</div>
          <div className="ta-target-kpi-value">{metrics.totalTargetCases} cases</div>
          <div className="ta-target-kpi-sub">For {metrics.dateRangeLabel}</div>
        </div>

        {/* Target Variance */}
        <div className="ta-target-kpi-card">
          <div className="ta-target-kpi-title">Target Variance</div>
          <div className="ta-target-kpi-value variance-neg">
            {metrics.targetVarianceCases > 0 ? `+${metrics.targetVarianceCases}` : metrics.targetVarianceCases} cases
          </div>
          <div className="ta-target-kpi-sub">Sold minus target</div>
        </div>
      </div>

      {/* Main Table Content Card */}
      <div className="ta-content-card">
        <div className="ta-card-header">
          <div className="ta-card-title-wrap">
            <h3>Sales Summary</h3>
            <div className="ta-card-subtitle">
              Sales, target, and variance for each visible team member in the selected date range.
            </div>
          </div>

          <div className="ta-card-controls">
            <div className="ta-search-input-wrap">
              <Search size={15} className="ta-search-icon" />
              <input
                type="text"
                className="ta-search-input"
                placeholder="Filter sales by rep or region..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <button
              type="button"
              className="ta-btn-secondary"
              onClick={handleExportCsv}
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="ta-table-scroll-container">
          <table className="ta-table">
            <thead>
              <tr>
                <th style={{ width: "24%" }}>Team member</th>
                <th style={{ width: "22%" }}>Role</th>
                <th style={{ width: "22%" }}>Region</th>
                <th style={{ width: "12%", textAlign: "right" }}>Total sales</th>
                <th style={{ width: "12%", textAlign: "right" }}>Total target</th>
                <th style={{ width: "14%", textAlign: "right" }}>Variance</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                    No sales target records found.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const isNegative = item.varianceCases < 0;
                  return (
                    <tr key={item.id}>
                      {/* Member */}
                      <td>
                        <span className="ta-staff-name" style={{ fontSize: "13.5px" }}>
                          {item.name}
                        </span>
                      </td>

                      {/* Role */}
                      <td>
                        <span style={{ color: "#334155", fontWeight: 500, fontSize: "13px" }}>
                          {item.role}
                        </span>
                      </td>

                      {/* Region */}
                      <td>
                        <span style={{ color: "#475569", fontSize: "13px" }}>
                          {item.region}
                        </span>
                      </td>

                      {/* Total Sales */}
                      <td style={{ textAlign: "right", fontWeight: 700, color: "#1e293b", fontSize: "13px" }}>
                        {item.totalSalesCases} cases
                      </td>

                      {/* Total Target */}
                      <td style={{ textAlign: "right", fontWeight: 600, color: "#475569", fontSize: "13px" }}>
                        {item.totalTargetCases} cases
                      </td>

                      {/* Variance */}
                      <td style={{ textAlign: "right" }}>
                        <span className={`ta-variance-pill ${isNegative ? "negative" : "positive"}`}>
                          {item.varianceCases > 0 ? `+${item.varianceCases}` : item.varianceCases} cases
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
