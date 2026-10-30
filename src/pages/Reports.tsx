import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getSales, type Sale } from "../services/salesService";
import { getUserScope, filterSalesByScope } from "../services/dataScopeService";
import {
  Activity,
  Calendar,
  ChevronDown,
  FileText,
  MapPin,
  Package,
  Printer,
  Store,
  TrendingUp,
  Users,
  DollarSign,
  Download,
} from "lucide-react";
import "../reports.css";
import LogoLoader from "../components/brand/LogoLoader";
import { useMinimumLoading } from "../hooks/useMinimumLoading";

function getPeriodDateRange(periodKey: string): { start: string; end: string } {
  const now = new Date();
  const formatYmd = (d: Date) => d.toISOString().split("T")[0];

  switch (periodKey) {
    case "today": {
      const todayStr = formatYmd(now);
      return { start: todayStr, end: todayStr };
    }
    case "this_week": {
      const day = now.getDay();
      const diffToMonday = (day === 0 ? -6 : 1) - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMonday);
      return { start: formatYmd(monday), end: formatYmd(now) };
    }
    case "this_month": {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: formatYmd(firstDay), end: formatYmd(now) };
    }
    case "this_year": {
      const firstDay = new Date(now.getFullYear(), 0, 1);
      return { start: formatYmd(firstDay), end: formatYmd(now) };
    }
    default:
      return { start: "", end: "" };
  }
}

export default function Reports() {
  const { staff, role } = useAuth();
  const userScope = useMemo(() => getUserScope(staff, role), [staff, role]);

  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const visibleLoading = useMinimumLoading(loading, 800);
  const [period, setPeriod] = useState("this_month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (period !== "custom") {
      const bounds = getPeriodDateRange(period);
      setStartDate(bounds.start);
      setEndDate(bounds.end);
    }
  }, [period]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const data = await getSales(startDate || undefined, endDate || undefined);
        const scoped = filterSalesByScope(data || [], userScope);
        setSales(scoped);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [startDate, endDate, userScope]);

  // --- KPI Calculations ---
  const totalRevenue = useMemo(() => sales.reduce((acc, s) => acc + Number(s.total_amount ?? 0), 0), [sales]);
  const totalUnits = useMemo(() => sales.reduce((acc, s) => acc + Number(s.quantity ?? 0), 0), [sales]);
  const totalCash = useMemo(() => sales.reduce((acc, s) => acc + Number(s.amount_paid ?? 0), 0), [sales]);
  const collectionEfficiency = totalRevenue > 0 ? Math.round((totalCash / totalRevenue) * 100) : 0;
  const avgOrderValue = sales.length > 0 ? Math.round(totalRevenue / sales.length) : 0;

  // --- Reports Data Computations ---

  // 1. Daily Breakdown (Revenue & Units)
  const dailyBreakdown = useMemo(() => {
    const map = new Map<string, { date: string; revenue: number; units: number }>();
    sales.forEach((s) => {
      const d = s.sale_date || (s.created_at ? s.created_at.split("T")[0] : "Recent");
      if (!map.has(d)) map.set(d, { date: d, revenue: 0, units: 0 });
      const item = map.get(d)!;
      item.revenue += Number(s.total_amount ?? 0);
      item.units += Number(s.quantity ?? 0);
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [sales]);

  // 2. Individual Sales Performance (Reps)
  const repPerformance = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; units: number; orders: number; paid: number }>();
    sales.forEach((s) => {
      const name = s.staff || "Direct Sales";
      if (!map.has(name)) map.set(name, { name, revenue: 0, units: 0, orders: 0, paid: 0 });
      const item = map.get(name)!;
      item.revenue += Number(s.total_amount ?? 0);
      item.units += Number(s.quantity ?? 0);
      item.paid += Number(s.amount_paid ?? 0);
      item.orders += 1;
    });
    return Array.from(map.values())
      .map(r => ({ ...r, collectionRate: r.revenue > 0 ? Math.round((r.paid / r.revenue) * 100) : 0 }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [sales]);

  // 3. Sales in Regions
  const regionPerformance = useMemo(() => {
    const map = new Map<string, { region: string; revenue: number; units: number }>();
    sales.forEach((s) => {
      const reg = s.outlet_region || s.staff_region || s.outlet_state || "National";
      if (!map.has(reg)) map.set(reg, { region: reg, revenue: 0, units: 0 });
      const item = map.get(reg)!;
      item.revenue += Number(s.total_amount ?? 0);
      item.units += Number(s.quantity ?? 0);
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [sales]);

  // 4. Sales by Products
  const productPerformance = useMemo(() => {
    const map = new Map<string, { product: string; revenue: number; units: number }>();
    sales.forEach((s) => {
      const prod = s.drink_type || "General Beverage";
      if (!map.has(prod)) map.set(prod, { product: prod, revenue: 0, units: 0 });
      const item = map.get(prod)!;
      item.revenue += Number(s.total_amount ?? 0);
      item.units += Number(s.quantity ?? 0);
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [sales]);

  // 5. Top Outlets
  const outletPerformance = useMemo(() => {
    const map = new Map<string, { outlet: string; revenue: number; orders: number }>();
    sales.forEach((s) => {
      const out = s.outlet || "Unknown Store";
      if (!map.has(out)) map.set(out, { outlet: out, revenue: 0, orders: 0 });
      const item = map.get(out)!;
      item.revenue += Number(s.total_amount ?? 0);
      item.orders += 1;
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [sales]);

  const formatCurrency = (val: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(val);
  const maxDailyRevenue = Math.max(...dailyBreakdown.map(d => d.revenue), 100);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    const headers = ["Date", "Staff", "Region", "Outlet", "Product", "Quantity", "Total Amount (NGN)", "Amount Paid (NGN)"];
    const rows = sales.map((s) => [
      s.sale_date || (s.created_at ? s.created_at.split("T")[0] : ""),
      `"${(s.staff || "Direct Sales").replace(/"/g, '""')}"`,
      `"${(s.outlet_region || s.staff_region || s.outlet_state || "National").replace(/"/g, '""')}"`,
      `"${(s.outlet || "Store").replace(/"/g, '""')}"`,
      `"${(s.drink_type || "Beverage").replace(/"/g, '""')}"`,
      Number(s.quantity ?? 0),
      Number(s.total_amount ?? 0),
      Number(s.amount_paid ?? 0),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pen-edge-sales-report-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="reports-page">
      {/* HEADER */}
      <div className="reports-header-box">
        <div className="reports-title-wrap">
          <div className="reports-icon-box">
            <FileText size={24} />
          </div>
          <div>
            <h2>Sales & Performance Reports</h2>
            <p>Comprehensive analytics of commercial execution, territory performance, and representative KPIs</p>
          </div>
        </div>
        <div className="reports-controls" style={{ flexWrap: "wrap" }}>
          <div className="report-filter-select">
            <Calendar size={15} />
            <select value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="all">All Time History</option>
              <option value="today">Today</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="this_year">This Year</option>
              <option value="custom">Custom Date Range</option>
            </select>
            <ChevronDown size={14} className="chevron" />
          </div>
          {period === "custom" && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                aria-label="Start date"
                style={{
                  padding: "7px 10px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: "0.82rem",
                  background: "#ffffff",
                }}
              />
              <span style={{ fontSize: "0.8rem", color: "#64748b" }}>to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                aria-label="End date"
                style={{
                  padding: "7px 10px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: "0.82rem",
                  background: "#ffffff",
                }}
              />
            </div>
          )}
          <button
            type="button"
            className="report-print-btn"
            onClick={handleExportCsv}
            disabled={sales.length === 0}
            style={{ background: "#ffffff", color: "#092c1f", border: "1px solid #cbd5e1" }}
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>
          <button type="button" className="report-print-btn" onClick={handlePrint}>
            <Printer size={15} />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {visibleLoading ? (
        <LogoLoader
          variant="page"
          message="Compiling analytical report"
          hint="Aggregating regional revenue, volume, and payment collections"
        />
      ) : (
        <div className="reports-content-container">
          
          {/* PRIMARY KPI SUMMARY STRIP */}
          <div className="report-kpi-strip">
            <div className="report-kpi-item">
              <span className="rkpi-label">Total Revenue Generated</span>
              <strong className="rkpi-value">{formatCurrency(totalRevenue)}</strong>
              <div className="rkpi-footer"><DollarSign size={13}/> <span>Top Line Value</span></div>
            </div>
            <div className="report-kpi-item">
              <span className="rkpi-label">Volume Distributed</span>
              <strong className="rkpi-value">{totalUnits.toLocaleString()} Units</strong>
              <div className="rkpi-footer"><Package size={13}/> <span>Cases & Bottles</span></div>
            </div>
            <div className="report-kpi-item">
              <span className="rkpi-label">Collection Efficiency</span>
              <strong className="rkpi-value">{collectionEfficiency}%</strong>
              <div className="rkpi-footer"><Activity size={13}/> <span>{formatCurrency(totalCash)} Recovered</span></div>
            </div>
            <div className="report-kpi-item">
              <span className="rkpi-label">Average Order Value</span>
              <strong className="rkpi-value">{formatCurrency(avgOrderValue)}</strong>
              <div className="rkpi-footer"><TrendingUp size={13}/> <span>Across {sales.length} Deals</span></div>
            </div>
          </div>

          <div className="report-grid-2col">
            {/* DAILY BREAKDOWN CHART */}
            <div className="report-card full-span">
              <div className="rcard-head">
                <h3>Daily Revenue Progression</h3>
                <span className="rcard-meta">Chronological transaction velocity</span>
              </div>
              <div className="rcard-body">
                {dailyBreakdown.length === 0 ? (
                  <div className="rcard-empty">No activity found for this period.</div>
                ) : (
                  <div className="report-bar-chart-wrap">
                    <svg viewBox="0 0 800 200" className="report-bar-chart" preserveAspectRatio="none">
                      {dailyBreakdown.map((d, i) => {
                        const width = 800 / Math.max(1, dailyBreakdown.length) - 4;
                        const x = i * (width + 4);
                        const height = (d.revenue / maxDailyRevenue) * 180;
                        const y = 200 - height;
                        return (
                          <g key={d.date} className="report-chart-group">
                            <rect x={x} y={y} width={Math.max(8, width)} height={height} fill="#075544" rx="2" className="report-chart-rect" />
                            <title>{d.date}: {formatCurrency(d.revenue)}</title>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                )}
              </div>
            </div>

            {/* REPRESENTATIVE PERFORMANCE */}
            <div className="report-card">
              <div className="rcard-head">
                <h3><Users size={16}/> Individual Rep Performance</h3>
              </div>
              <div className="rcard-body scrollable">
                <table className="report-data-table">
                  <thead>
                    <tr>
                      <th>Sales Representative</th>
                      <th className="num-col">Revenue</th>
                      <th className="num-col">Collection</th>
                    </tr>
                  </thead>
                  <tbody>
                    {repPerformance.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                          No representative sales recorded for this period.
                        </td>
                      </tr>
                    ) : (
                      repPerformance.map(rep => (
                        <tr key={rep.name}>
                          <td>
                            <strong>{rep.name}</strong>
                            <span className="table-sub">{rep.orders} Orders · {rep.units} Units</span>
                          </td>
                          <td className="num-col"><strong>{formatCurrency(rep.revenue)}</strong></td>
                          <td className="num-col">
                            <span className={`rep-collect-badge ${rep.collectionRate >= 90 ? 'good' : rep.collectionRate >= 70 ? 'avg' : 'poor'}`}>
                              {rep.collectionRate}%
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* REGIONAL / TERRITORY DISTRIBUTION */}
            <div className="report-card">
              <div className="rcard-head">
                <h3><MapPin size={16}/> Territory Performance</h3>
              </div>
              <div className="rcard-body scrollable">
                <table className="report-data-table">
                  <thead>
                    <tr>
                      <th>Region / State</th>
                      <th className="num-col">Volume (Units)</th>
                      <th className="num-col">Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regionPerformance.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                          No regional data recorded for this period.
                        </td>
                      </tr>
                    ) : (
                      regionPerformance.map(reg => (
                        <tr key={reg.region}>
                          <td><strong>{reg.region}</strong></td>
                          <td className="num-col">{reg.units.toLocaleString()}</td>
                          <td className="num-col"><strong>{formatCurrency(reg.revenue)}</strong></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PRODUCT CONTRIBUTION */}
            <div className="report-card">
              <div className="rcard-head">
                <h3><Package size={16}/> Beverage Product Mix</h3>
              </div>
              <div className="rcard-body scrollable">
                {productPerformance.length === 0 ? (
                  <div className="rcard-empty">No product sales recorded for this period.</div>
                ) : (
                  <div className="report-list-blocks">
                    {productPerformance.map((prod, idx) => (
                      <div className="report-list-block" key={prod.product}>
                        <div className="rlb-left">
                          <div className="rlb-index">#{idx + 1}</div>
                          <div>
                            <strong>{prod.product}</strong>
                            <span>{prod.units.toLocaleString()} Units Sold</span>
                          </div>
                        </div>
                        <div className="rlb-right">
                          <strong>{formatCurrency(prod.revenue)}</strong>
                          <span>{totalRevenue > 0 ? Math.round((prod.revenue / totalRevenue) * 100) : 0}% Share</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* TOP 10 RETAIL OUTLETS */}
            <div className="report-card">
              <div className="rcard-head">
                <h3><Store size={16}/> Top 10 Retail Outlets</h3>
              </div>
              <div className="rcard-body scrollable">
                {outletPerformance.length === 0 ? (
                  <div className="rcard-empty">No outlet transactions recorded for this period.</div>
                ) : (
                  <div className="report-list-blocks">
                    {outletPerformance.map((out, idx) => (
                      <div className="report-list-block" key={out.outlet}>
                        <div className="rlb-left">
                          <div className="rlb-index">#{idx + 1}</div>
                          <div>
                            <strong>{out.outlet}</strong>
                            <span>{out.orders} Transactions</span>
                          </div>
                        </div>
                        <div className="rlb-right">
                          <strong>{formatCurrency(out.revenue)}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}