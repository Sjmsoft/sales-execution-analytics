import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  CreditCard,
  DollarSign,
  Globe,
  Layers,
  MapPin,
  Package,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Store,
  Target,
  TrendingUp,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { getDashboardKpis } from "../services/dashboardService";
import { getSales, type Sale } from "../services/salesService";
import { getVisits, type VisitRecord } from "../services/visitsService";
import { getOutlets, type Outlet } from "../services/referenceService";
import { fetchTargets, type TargetRecord } from "../services/targetsService";
import {
  getUserScope,
  filterSalesByScope,
  filterVisitsByScope,
  filterOutletsByScope,
  filterTargetsByScope,
} from "../services/dataScopeService";
import { DashboardSkeleton } from "../components/ui/Skeleton";
import { useMinimumLoading } from "../hooks/useMinimumLoading";

type TimeframeOption = "today" | "7d" | "30d" | "month" | "all";
type SegmentFilter = "all" | "sales" | "visits" | "outlets" | "targets";
type ChartMetric = "revenue" | "volume";
type ActivityTab = "sales" | "visits" | "attendance";

type DashboardKpiResult = {
  transaction_count?: number;
  total_sales?: number;
  gross_sales?: number;
  total_quantity?: number;
  units_sold?: number;
  amount_paid?: number;
  outstanding_balance?: number;
  active_sales_staff?: number;
  active_outlets?: number;
  total_visits?: number;
  visit_count?: number;
  attendance_records?: number;
  completed_shifts?: number;
  payment_count?: number;
  payment_amount?: number;
  low_stock_items?: number;
  target_progress?: number;
  active_targets?: number;
  targets_achieved_100?: number;
};

function getDateRange(timeframe: TimeframeOption): { startDate: string; endDate: string } {
  const today = new Date();
  const endDate = today.toISOString().split("T")[0];
  const start = new Date(today);

  switch (timeframe) {
    case "today":
      return { startDate: endDate, endDate };
    case "7d":
      start.setDate(today.getDate() - 7);
      return { startDate: start.toISOString().split("T")[0], endDate };
    case "30d":
      start.setDate(today.getDate() - 30);
      return { startDate: start.toISOString().split("T")[0], endDate };
    case "month":
      start.setDate(1);
      return { startDate: start.toISOString().split("T")[0], endDate };
    case "all":
      return { startDate: "2026-01-01", endDate };
  }
}

export default function Dashboard() {
  const { staff, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Role Scoping
  const userScope = useMemo(() => getUserScope(staff, role), [staff, role]);
  const roleKey = (role?.key || staff?.user_roles?.key || staff?.assigned_role || "").toLowerCase();
  const isExecutive =
    userScope.isNational ||
    roleKey === "administrator" ||
    roleKey === "admin" ||
    roleKey === "national_sales_manager" ||
    roleKey === "nsm" ||
    roleKey === "hr";

  // Executive Command Center is strictly visible to Admin, NSM, and HR only
  if (!authLoading && !isExecutive) {
    if (roleKey === "brand_ambassador" || roleKey === "ba" || roleKey === "vsr") {
      return <Navigate to="/attendance" replace />;
    }
    return <Navigate to="/sales" replace />;
  }

  // State Management
  const [timeframe, setTimeframe] = useState<TimeframeOption>("30d");
  const [activeSegment, setActiveSegment] = useState<SegmentFilter>("all");
  const [chartMetric, setChartMetric] = useState<ChartMetric>("revenue");
  const [activityTab, setActivityTab] = useState<ActivityTab>("sales");
  const [activitySearch, setActivitySearch] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());

  const [kpis, setKpis] = useState<DashboardKpiResult | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [targets, setTargets] = useState<TargetRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const visibleLoading = useMinimumLoading(loading, 900);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Live real-time clock ticker
  useEffect(() => {
    const clockTimer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // Main data loader
  const loadDashboardData = useCallback(
    async (isManualRefresh = false) => {
      try {
        if (isManualRefresh) {
          setRefreshing(true);
        }
        setError("");

        const { startDate, endDate } = getDateRange(timeframe);

        const [kpiRes, salesRes, visitsRes, outletsRes, targetsRes] = await Promise.all([
          getDashboardKpis(startDate, endDate).catch((err) => {
            console.error("Dashboard KPI load error:", err);
            return null;
          }),
          getSales(startDate, endDate).catch((err) => {
            console.error("Sales load error:", err);
            return [];
          }),
          getVisits(startDate, endDate).catch((err) => {
            console.error("Visits load error:", err);
            return [];
          }),
          getOutlets().catch((err) => {
            console.error("Outlets load error:", err);
            return [];
          }),
          fetchTargets().catch((err) => {
            console.error("Targets load error:", err);
            return [];
          }),
        ]);

        const rawKpi = (
          Array.isArray(kpiRes) ? kpiRes[0] : kpiRes
        ) as DashboardKpiResult | null;

        const rawSales = (salesRes as Sale[]) || [];
        const rawVisits = (visitsRes as VisitRecord[]) || [];
        const rawOutlets = (outletsRes as Outlet[]) || [];
        const rawTargets = (targetsRes as TargetRecord[]) || [];

        // Apply strict role-based data scoping
        const scopedSales = filterSalesByScope(rawSales, userScope);
        const scopedVisits = filterVisitsByScope(rawVisits, userScope);
        const scopedOutlets = filterOutletsByScope(rawOutlets, userScope);
        const scopedTargets = filterTargetsByScope(rawTargets, userScope);

        setKpis(rawKpi);
        setSales(scopedSales);
        setVisits(scopedVisits);
        setOutlets(scopedOutlets);
        setTargets(scopedTargets);
      } catch (err: unknown) {
        console.error(err);
        setError(
          err instanceof Error
            ? err.message
            : "Unable to sync executive dashboard data. Please retry."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [timeframe, userScope]
  );

  // Initial load & real-time Postgres listeners
  useEffect(() => {
    void loadDashboardData(false);

    const channel = supabase
      .channel("executive-dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () =>
        void loadDashboardData(false)
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "visits" }, () =>
        void loadDashboardData(false)
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "targets" }, () =>
        void loadDashboardData(false)
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "outlets" }, () =>
        void loadDashboardData(false)
      )
      .subscribe();

    const interval = window.setInterval(() => {
      void loadDashboardData(false);
    }, 40_000);

    return () => {
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [loadDashboardData]);

  // Formatting utilities
  const formatCurrency = (value: number | undefined | null) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(value ?? 0);
  };

  const formatShortCurrency = (num: number) => {
    if (num >= 1_000_000_000) return `₦${(num / 1_000_000_000).toFixed(1)}B`;
    if (num >= 1_000_000) return `₦${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `₦${(num / 1_000).toFixed(1)}K`;
    return formatCurrency(num);
  };

  const formatActivityDate = (value: string | null | undefined) => {
    if (!value) return "Just now";
    try {
      const d = new Date(value);
      return d.toLocaleDateString("en-NG", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return value;
    }
  };

  // ── Multi-Segment Calculated Analytics ───────────────────────────────────

  // 1. Commercial & Revenue Metrics
  const grossSales = userScope.isNational && kpis?.gross_sales !== undefined
    ? Number(kpis?.gross_sales ?? kpis?.total_sales ?? sales.reduce((sum, s) => sum + Number(s.total_amount ?? 0), 0))
    : sales.reduce((sum, s) => sum + Number(s.total_amount ?? 0), 0);

  const unitsSold = userScope.isNational && kpis?.units_sold !== undefined
    ? Number(kpis?.units_sold ?? kpis?.total_quantity ?? sales.reduce((sum, s) => sum + Number(s.quantity ?? 0), 0))
    : sales.reduce((sum, s) => sum + Number(s.quantity ?? 0), 0);

  const totalOrders = userScope.isNational && kpis?.transaction_count !== undefined
    ? Number(kpis?.transaction_count ?? sales.length)
    : sales.length;

  const cashCollected = userScope.isNational && kpis?.amount_paid !== undefined
    ? Number(kpis?.amount_paid ?? sales.reduce((sum, s) => sum + Number(s.amount_paid ?? 0), 0))
    : sales.reduce((sum, s) => sum + Number(s.amount_paid ?? 0), 0);

  const outstandingBalance = userScope.isNational && kpis?.outstanding_balance !== undefined
    ? Number(kpis?.outstanding_balance ?? sales.reduce((sum, s) => sum + Number(s.balance ?? 0), 0))
    : sales.reduce((sum, s) => sum + Number(s.balance ?? 0), 0);

  const collectionRate = grossSales > 0 ? Math.min(100, Math.round((cashCollected / grossSales) * 100)) : 100;
  const avgOrderValue = totalOrders > 0 ? Math.round(grossSales / totalOrders) : 0;

  const paidCount = useMemo(() => sales.filter((s) => Number(s.balance ?? 0) <= 0 || Number(s.amount_paid ?? 0) >= Number(s.total_amount ?? 0)).length, [sales]);
  const partialCount = useMemo(() => sales.filter((s) => Number(s.amount_paid ?? 0) > 0 && Number(s.balance ?? 0) > 0).length, [sales]);
  const creditCount = useMemo(() => sales.filter((s) => Number(s.amount_paid ?? 0) === 0 && Number(s.balance ?? 0) > 0).length, [sales]);

  // 2. Field Trade & Operations Metrics
  const totalVisits = userScope.isNational && kpis?.visit_count !== undefined
    ? Number(kpis?.visit_count ?? kpis?.total_visits ?? visits.length)
    : visits.length;
  const activeVisitsCount = useMemo(() => visits.filter((v) => v.status === "Active").length, [visits]);
  const completedVisitsCount = useMemo(() => visits.filter((v) => v.status === "Completed").length, [visits]);
  const successfulVisitsCount = useMemo(() => visits.filter((v) => v.outcome === "Successful" || v.outcome?.toLowerCase().includes("order")).length, [visits]);
  const visitSuccessRate = totalVisits > 0 ? Math.round((successfulVisitsCount / totalVisits) * 100) : 0;
  
  const gpsVerifiedCount = useMemo(() => visits.filter((v) => Boolean(v.gps)).length, [visits]);
  const gpsComplianceRate = totalVisits > 0 ? Math.round((gpsVerifiedCount / totalVisits) * 100) : 0;
  
  const photoVerifiedCount = useMemo(() => visits.filter((v) => Boolean(v.photo || v.photoUrl)).length, [visits]);
  const photoComplianceRate = totalVisits > 0 ? Math.round((photoVerifiedCount / totalVisits) * 100) : 0;
  const overallAuditScore = Math.round((gpsComplianceRate * 0.5) + (photoComplianceRate * 0.5));

  // 3. Retail Outlets & Distribution Footprint
  const totalOutlets = outlets.length;
  const activeOutlets = userScope.isNational && kpis?.active_outlets !== undefined
    ? Number(kpis?.active_outlets ?? new Set(sales.map((s) => s.outlet || s.outlet_id).filter(Boolean)).size)
    : new Set(sales.map((s) => s.outlet || s.outlet_id).filter(Boolean)).size;
  const coverageRate = totalOutlets > 0 ? Math.min(100, Math.round((activeOutlets / totalOutlets) * 100)) : 0;
  const dormantOutlets = Math.max(0, totalOutlets - activeOutlets);

  // 4. Targets, Quotas & Workforce Performance
  const activeTargets = targets.length;
  const targetsAchieved = targets.filter((t) => t.progressPercent >= 100 || t.status === "Completed").length;
  const targetProgress = targets.length > 0
    ? targets.reduce((acc, t) => acc + (t.progressPercent || 0), 0) / targets.length
    : (userScope.isNational && kpis?.target_progress !== undefined ? Number(kpis.target_progress) : 0);
  const targetIsOnTrack = targetProgress >= 70;

  const activeReps = new Set(sales.map((s) => s.staff || s.staff_id).filter(Boolean)).size;
  const completedShifts = visits.filter((v) => v.type === "attendance" && v.status === "Completed").length;
  const attendanceRecords = visits.filter((v) => v.type === "attendance").length;

  // ── Trend & Chart Aggregator ─────────────────────────────────────────────
  const trendData = useMemo(() => {
    // Generate dates based on timeframe
    const days = timeframe === "today" ? 1 : timeframe === "7d" ? 7 : timeframe === "month" ? 15 : 14;
    const result: Array<{ label: string; date: string; revenue: number; volume: number }> = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("en-NG", { weekday: "short", day: "numeric" });

      const daySales = sales.filter((s) => {
        const sDate = s.sale_date || s.created_at;
        return sDate && sDate.startsWith(dateStr);
      });

      const dayRevenue = daySales.reduce((acc, s) => acc + Number(s.total_amount ?? 0), 0);
      const dayVolume = daySales.reduce((acc, s) => acc + Number(s.quantity ?? 0), 0);

      result.push({
        label,
        date: dateStr,
        revenue: dayRevenue,
        volume: dayVolume,
      });
    }
    return result;
  }, [sales, timeframe]);

  const maxChartValue = useMemo(() => {
    if (chartMetric === "revenue") {
      const maxRev = Math.max(...trendData.map((t) => t.revenue), 10000);
      return maxRev * 1.15;
    }
    const maxVol = Math.max(...trendData.map((t) => t.volume), 20);
    return maxVol * 1.2;
  }, [trendData, chartMetric]);

  // ── Product / Beverage Contribution Breakdown ────────────────────────────
  const topProducts = useMemo(() => {
    const productMap = new Map<string, { name: string; volume: number; revenue: number }>();

    sales.forEach((sale) => {
      const drink = sale.drink_type || "Premium Beverage";
      const vol = Number(sale.quantity ?? 0);
      const rev = Number(sale.total_amount ?? 0);

      const existing = productMap.get(drink) || { name: drink, volume: 0, revenue: 0 };
      existing.volume += vol;
      existing.revenue += rev;
      productMap.set(drink, existing);
    });

    const list = Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue);
    const totalRev = list.reduce((acc, item) => acc + item.revenue, 0) || 1;

    return list.slice(0, 5).map((p) => ({
      ...p,
      sharePct: Math.round((p.revenue / totalRev) * 100),
    }));
  }, [sales]);

  // ── Regional / Territory Distribution Breakdown ──────────────────────────
  const regionalDistribution = useMemo(() => {
    const regionMap = new Map<string, { region: string; outletsCount: number; salesVolume: number; revenue: number }>();

    outlets.forEach((o) => {
      const reg = o.region || o.region_id || o.state || "National Territory";
      const existing = regionMap.get(reg) || { region: reg, outletsCount: 0, salesVolume: 0, revenue: 0 };
      existing.outletsCount += 1;
      regionMap.set(reg, existing);
    });

    sales.forEach((s) => {
      const reg = s.outlet_region || s.staff_region || s.outlet_state || "National Territory";
      const existing = regionMap.get(reg) || { region: reg, outletsCount: 0, salesVolume: 0, revenue: 0 };
      existing.salesVolume += Number(s.quantity ?? 0);
      existing.revenue += Number(s.total_amount ?? 0);
      regionMap.set(reg, existing);
    });

    return Array.from(regionMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 4);
  }, [outlets, sales]);

  // ── Filtered Activity Feed ────────────────────────────────────────────────
  const filteredSalesActivity = useMemo(() => {
    if (!activitySearch.trim()) return sales.slice(0, 8);
    const q = activitySearch.toLowerCase();
    return sales
      .filter(
        (s) =>
          s.outlet?.toLowerCase().includes(q) ||
          s.drink_type?.toLowerCase().includes(q) ||
          s.staff?.toLowerCase().includes(q) ||
          s.reference?.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [sales, activitySearch]);

  const filteredVisitsActivity = useMemo(() => {
    if (!activitySearch.trim()) return visits.slice(0, 8);
    const q = activitySearch.toLowerCase();
    return visits
      .filter(
        (v) =>
          v.outlet?.toLowerCase().includes(q) ||
          v.staff?.toLowerCase().includes(q) ||
          v.outcome?.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [visits, activitySearch]);

  const attendanceVisits = useMemo(() => {
    return visits.filter((v) => v.type === "attendance").slice(0, 8);
  }, [visits]);

  if (visibleLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="dashboard-container">
      {/* ══════════════════════════════════════════════════════════════════════
          1. EXECUTIVE HERO COMMAND BAR & VITAL SIGNS
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="executive-hero-command-bar">
        <div className="hero-top-row">
          {/* Identity & Status */}
          <div className="hero-identity-group">
            <div className="hero-avatar-badge" aria-hidden="true">
              <span>{staff?.name ? (staff.name.slice(0, 2)).toUpperCase() : "PE"}</span>
            </div>
            <div className="hero-titles">
              <div className="hero-salutation-line">
                <h2>Executive Command Center</h2>
                <span className="live-status-pill">
                  <span className="live-pulse-dot" />
                  Live Sync
                </span>
              </div>
              <div className="hero-meta-subtitle">
                <span>
                  Welcome, <strong>{staff?.name ?? "Executive Leader"}</strong>
                </span>
                <span className="hero-role-tag">{role?.name ?? "Sales Directorate"}</span>
                <span className="hero-region-tag" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                  <Globe size={11} />
                  All Regions Oversight (National)
                </span>
                <span className="hero-timestamp">
                  <Clock size={11} />
                  {currentTime.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} WAT
                </span>
              </div>
            </div>
          </div>

          {/* Timeframe Selector & Actions */}
          <div className="hero-controls-group">
            <div className="hero-timeframe-picker" role="radiogroup" aria-label="Timeframe filter">
              <button
                type="button"
                className={`timeframe-btn ${timeframe === "today" ? "timeframe-btn-active" : ""}`}
                onClick={() => setTimeframe("today")}
              >
                Today
              </button>
              <button
                type="button"
                className={`timeframe-btn ${timeframe === "7d" ? "timeframe-btn-active" : ""}`}
                onClick={() => setTimeframe("7d")}
              >
                7 Days
              </button>
              <button
                type="button"
                className={`timeframe-btn ${timeframe === "30d" ? "timeframe-btn-active" : ""}`}
                onClick={() => setTimeframe("30d")}
              >
                30 Days
              </button>
              <button
                type="button"
                className={`timeframe-btn ${timeframe === "month" ? "timeframe-btn-active" : ""}`}
                onClick={() => setTimeframe("month")}
              >
                This Month
              </button>
              <button
                type="button"
                className={`timeframe-btn ${timeframe === "all" ? "timeframe-btn-active" : ""}`}
                onClick={() => setTimeframe("all")}
              >
                All Time
              </button>
            </div>

            <button
              type="button"
              className={`hero-refresh-btn ${refreshing ? "spinning" : ""}`}
              onClick={() => void loadDashboardData(true)}
              title="Refresh all metrics"
              aria-label="Refresh executive dashboard"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {/* ── Executive Vital Signs Strip (4 Strategic Micro Gauges) ── */}
        <div className="executive-vital-strip">
          {/* Vital 1: Revenue Momentum */}
          <div className="vital-item" onClick={() => navigate("/sales")}>
            <div className="vital-icon-box revenue-accent">
              <DollarSign size={16} />
            </div>
            <div className="vital-details">
              <span className="vital-label">Gross Revenue Pacing</span>
              <strong className="vital-value">{formatShortCurrency(grossSales)}</strong>
              <span className="vital-subtext success">
                <TrendingUp size={11} /> {totalOrders} orders logged
              </span>
            </div>
            <ArrowRight size={13} className="vital-arrow" />
          </div>

          {/* Vital 2: Cash Realization Health */}
          <div className="vital-item" onClick={() => navigate("/sales")}>
            <div className="vital-icon-box cash-accent">
              <CreditCard size={16} />
            </div>
            <div className="vital-details">
              <span className="vital-label">Cash Collection Rate</span>
              <strong className="vital-value">{collectionRate}%</strong>
              <span className={`vital-subtext ${collectionRate >= 80 ? "success" : "warning"}`}>
                {formatShortCurrency(cashCollected)} collected
              </span>
            </div>
            <ArrowRight size={13} className="vital-arrow" />
          </div>

          {/* Vital 3: Target Attainment */}
          <div className="vital-item" onClick={() => navigate("/targets")}>
            <div className="vital-icon-box target-accent">
              <Target size={16} />
            </div>
            <div className="vital-details">
              <span className="vital-label">Aggregate Target Progress</span>
              <strong className="vital-value">{targetProgress.toFixed(1)}%</strong>
              <span className={`vital-subtext ${targetIsOnTrack ? "success" : "warning"}`}>
                {targetIsOnTrack ? "Pacing Ahead of Quota" : "Pacing Requires Focus"}
              </span>
            </div>
            <ArrowRight size={13} className="vital-arrow" />
          </div>

          {/* Vital 4: Field Audit Compliance */}
          <div className="vital-item" onClick={() => navigate("/visits")}>
            <div className="vital-icon-box audit-accent">
              <ShieldCheck size={16} />
            </div>
            <div className="vital-details">
              <span className="vital-label">Trade Audit Integrity</span>
              <strong className="vital-value">{overallAuditScore}%</strong>
              <span className="vital-subtext info">
                {gpsComplianceRate}% GPS · {photoComplianceRate}% Photo
              </span>
            </div>
            <ArrowRight size={13} className="vital-arrow" />
          </div>
        </div>

        {/* ── Command Action Center (1-Click Launchpad) ── */}
        <div className="hero-action-deck">
          <div className="action-deck-header">
            <Zap size={14} className="action-deck-icon" />
            <span>Executive Command Actions:</span>
          </div>
          <div className="action-deck-links">
            <Link to="/new-sale" className="action-deck-btn action-btn-primary">
              <Plus size={14} />
              <span>Record Sale</span>
            </Link>
            <Link to="/visits/check-in" className="action-deck-btn action-btn-secondary">
              <MapPin size={14} />
              <span>Trade Check-In</span>
            </Link>
            <Link to="/attendance" className="action-deck-btn action-btn-secondary">
              <UserCheck size={14} />
              <span>Daily Attendance</span>
            </Link>
            <Link to="/targets" className="action-deck-btn action-btn-secondary">
              <Target size={14} />
              <span>Manage Targets</span>
            </Link>
            <Link to="/outlets" className="action-deck-btn action-btn-secondary">
              <Store size={14} />
              <span>Register Outlet</span>
            </Link>
            <Link to="/reports" className="action-deck-btn action-btn-secondary">
              <BarChart3 size={14} />
              <span>BI Reports</span>
            </Link>
          </div>
        </div>
      </section>

      {error && (
        <div className="dashboard-alert-banner">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button type="button" onClick={() => void loadDashboardData(true)} className="alert-retry-btn">
            Retry Sync
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          2. SEGMENT FILTER NAVIGATOR
      ══════════════════════════════════════════════════════════════════════ */}
      <nav className="executive-segment-nav" aria-label="Executive Section Filters">
        <button
          type="button"
          className={`segment-tab ${activeSegment === "all" ? "segment-tab-active" : ""}`}
          onClick={() => setActiveSegment("all")}
        >
          <Layers size={14} />
          <span>All Overview Segments</span>
          <span className="segment-tab-badge">4</span>
        </button>
        <button
          type="button"
          className={`segment-tab ${activeSegment === "sales" ? "segment-tab-active" : ""}`}
          onClick={() => setActiveSegment("sales")}
        >
          <ShoppingCart size={14} />
          <span>Commercial & Revenue</span>
        </button>
        <button
          type="button"
          className={`segment-tab ${activeSegment === "visits" ? "segment-tab-active" : ""}`}
          onClick={() => setActiveSegment("visits")}
        >
          <MapPin size={14} />
          <span>Field Trade & Coverage</span>
        </button>
        <button
          type="button"
          className={`segment-tab ${activeSegment === "outlets" ? "segment-tab-active" : ""}`}
          onClick={() => setActiveSegment("outlets")}
        >
          <Store size={14} />
          <span>Retail Network Footprint</span>
        </button>
        <button
          type="button"
          className={`segment-tab ${activeSegment === "targets" ? "segment-tab-active" : ""}`}
          onClick={() => setActiveSegment("targets")}
        >
          <Target size={14} />
          <span>Quotas & Team Pacing</span>
        </button>
      </nav>

      {/* ══════════════════════════════════════════════════════════════════════
          3. MULTI-SEGMENT KPI COMMAND GRIDS (WITH DIRECT DATA LINKS)
      ══════════════════════════════════════════════════════════════════════ */}

      {/* ── SEGMENT 1: COMMERCIAL & REVENUE PERFORMANCE ── */}
      {(activeSegment === "all" || activeSegment === "sales") && (
        <section className="executive-kpi-block commercial-theme">
          <div className="kpi-block-header">
            <div className="kpi-block-title-group">
              <div className="block-title-icon commercial-bg">
                <DollarSign size={16} />
              </div>
              <div>
                <h3>Commercial & Sales Performance</h3>
                <p>Transaction velocity, revenue realization, cash collection & receivables</p>
              </div>
            </div>
            <Link to="/sales" className="block-deep-link" title="Navigate to Sales Records">
              <span>View All Sales Ledger</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="executive-kpi-grid">
            {/* Card 1: Gross Sales */}
            <div className="exec-kpi-card" onClick={() => navigate("/sales")}>
              <div className="exec-card-top">
                <span className="exec-card-title">Gross Revenue</span>
                <div className="exec-icon-pill commercial-light">
                  <TrendingUp size={15} />
                </div>
              </div>
              <strong className="exec-card-value">{formatCurrency(grossSales)}</strong>
              <div className="exec-card-footer">
                <span className="exec-sub-text">{totalOrders.toLocaleString()} Total Transactions</span>
                <span className="exec-pill-badge badge-success">Avg {formatCurrency(avgOrderValue)}</span>
              </div>
              <div className="exec-card-hover-hint">
                <span>Explore Sales Data</span>
                <ChevronRight size={12} />
              </div>
            </div>

            {/* Card 2: Units Sold */}
            <div className="exec-kpi-card" onClick={() => navigate("/sales")}>
              <div className="exec-card-top">
                <span className="exec-card-title">Volume Distributed</span>
                <div className="exec-icon-pill commercial-light">
                  <Package size={15} />
                </div>
              </div>
              <strong className="exec-card-value">{unitsSold.toLocaleString()}</strong>
              <div className="exec-card-footer">
                <span className="exec-sub-text">Bottles & Cases in Market</span>
                <span className="exec-pill-badge badge-info">{sales.length} Invoices</span>
              </div>
              <div className="exec-card-hover-hint">
                <span>View Product Breakdown</span>
                <ChevronRight size={12} />
              </div>
            </div>

            {/* Card 3: Cash Collected */}
            <div className="exec-kpi-card" onClick={() => navigate("/sales")}>
              <div className="exec-card-top">
                <span className="exec-card-title">Cash Realized</span>
                <div className="exec-icon-pill success-light">
                  <CreditCard size={15} />
                </div>
              </div>
              <strong className="exec-card-value">{formatCurrency(cashCollected)}</strong>
              <div className="exec-card-footer">
                <span className="exec-sub-text">{paidCount} Fully Settled Invoices</span>
                <span className={`exec-pill-badge ${collectionRate >= 80 ? "badge-success" : "badge-warning"}`}>
                  {collectionRate}% Realization
                </span>
              </div>
              <div className="exec-card-hover-hint">
                <span>Audit Payment Logs</span>
                <ChevronRight size={12} />
              </div>
            </div>

            {/* Card 4: Outstanding Credit */}
            <div className="exec-kpi-card" onClick={() => navigate("/sales")}>
              <div className="exec-card-top">
                <span className="exec-card-title">Trade Receivables</span>
                <div className="exec-icon-pill warning-light">
                  <AlertCircle size={15} />
                </div>
              </div>
              <strong className="exec-card-value">{formatCurrency(outstandingBalance)}</strong>
              <div className="exec-card-footer">
                <span className="exec-sub-text">{creditCount + partialCount} Pending Collections</span>
                <span className={`exec-pill-badge ${outstandingBalance > 0 ? "badge-warning" : "badge-success"}`}>
                  {outstandingBalance > 0 ? "Pending Follow-up" : "Zero Debt Exposure"}
                </span>
              </div>
              <div className="exec-card-hover-hint">
                <span>Review Credit Aging</span>
                <ChevronRight size={12} />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── SEGMENT 2: FIELD TRADE EXECUTION & COVERAGE ── */}
      {(activeSegment === "all" || activeSegment === "visits") && (
        <section className="executive-kpi-block visits-theme">
          <div className="kpi-block-header">
            <div className="kpi-block-title-group">
              <div className="block-title-icon visits-bg">
                <MapPin size={16} />
              </div>
              <div>
                <h3>Field Trade Execution & Audit Integrity</h3>
                <p>Retail check-ins, conversion rates, GPS proximity compliance & merchandising proofs</p>
              </div>
            </div>
            <Link to="/visits" className="block-deep-link" title="Navigate to Field Visits">
              <span>View Field Visits History</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="executive-kpi-grid">
            {/* Card 1: Total Visits */}
            <div className="exec-kpi-card" onClick={() => navigate("/visits")}>
              <div className="exec-card-top">
                <span className="exec-card-title">Trade Visits Logged</span>
                <div className="exec-icon-pill visits-light">
                  <MapPin size={15} />
                </div>
              </div>
              <strong className="exec-card-value">{totalVisits.toLocaleString()}</strong>
              <div className="exec-card-footer">
                <span className="exec-sub-text">{completedVisitsCount} Completed Visits</span>
                {activeVisitsCount > 0 ? (
                  <span className="exec-pill-badge badge-primary">{activeVisitsCount} Active Now</span>
                ) : (
                  <span className="exec-pill-badge badge-info">Coverage On Schedule</span>
                )}
              </div>
              <div className="exec-card-hover-hint">
                <span>Inspect Field Visits</span>
                <ChevronRight size={12} />
              </div>
            </div>

            {/* Card 2: Conversion Success Rate */}
            <div className="exec-kpi-card" onClick={() => navigate("/visits")}>
              <div className="exec-card-top">
                <span className="exec-card-title">Order Conversion Rate</span>
                <div className="exec-icon-pill success-light">
                  <CheckCircle2 size={15} />
                </div>
              </div>
              <strong className="exec-card-value">{visitSuccessRate}%</strong>
              <div className="exec-card-footer">
                <span className="exec-sub-text">{successfulVisitsCount} Resulted in Direct Orders</span>
                <span className="exec-pill-badge badge-success">High Conversion</span>
              </div>
              <div className="exec-card-hover-hint">
                <span>View Conversion Logs</span>
                <ChevronRight size={12} />
              </div>
            </div>

            {/* Card 3: GPS Geofence Compliance */}
            <div className="exec-kpi-card" onClick={() => navigate("/visits")}>
              <div className="exec-card-top">
                <span className="exec-card-title">GPS Proximity Match</span>
                <div className="exec-icon-pill commercial-light">
                  <Compass size={15} />
                </div>
              </div>
              <strong className="exec-card-value">{gpsComplianceRate}%</strong>
              <div className="exec-card-footer">
                <span className="exec-sub-text">{gpsVerifiedCount} Geotagged Visits</span>
                <span className={`exec-pill-badge ${gpsComplianceRate >= 80 ? "badge-success" : "badge-warning"}`}>
                  {gpsComplianceRate >= 80 ? "Audited Verified" : "Location Flagged"}
                </span>
              </div>
              <div className="exec-card-hover-hint">
                <span>Check Geotag Map</span>
                <ChevronRight size={12} />
              </div>
            </div>

            {/* Card 4: Photo Proof Compliance */}
            <div className="exec-kpi-card" onClick={() => navigate("/visits")}>
              <div className="exec-card-top">
                <span className="exec-card-title">Merchandising Proofs</span>
                <div className="exec-icon-pill purple-light">
                  <Camera size={15} />
                </div>
              </div>
              <strong className="exec-card-value">{photoComplianceRate}%</strong>
              <div className="exec-card-footer">
                <span className="exec-sub-text">{photoVerifiedCount} Sign-Out Photos</span>
                <span className="exec-pill-badge badge-purple">Audit Verified</span>
              </div>
              <div className="exec-card-hover-hint">
                <span>Review Photo Gallery</span>
                <ChevronRight size={12} />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── SEGMENT 3: RETAIL NETWORK & TARGETS OVERVIEW ── */}
      {(activeSegment === "all" || activeSegment === "outlets" || activeSegment === "targets") && (
        <section className="executive-kpi-block network-theme">
          <div className="kpi-block-header">
            <div className="kpi-block-title-group">
              <div className="block-title-icon network-bg">
                <Store size={16} />
              </div>
              <div>
                <h3>Retail Network & Quota Realization</h3>
                <p>Store coverage penetration, ordering accounts, sales force pacing & shift attendance</p>
              </div>
            </div>
            <div className="block-header-links">
              <Link to="/outlets" className="block-deep-link" title="View Outlets">
                <span>Outlets Directory</span>
                <ArrowUpRight size={14} />
              </Link>
              <Link to="/targets" className="block-deep-link" title="View Targets">
                <span>Targets Center</span>
                <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>

          <div className="executive-kpi-grid">
            {/* Card 1: Total Registered Outlets */}
            <div className="exec-kpi-card" onClick={() => navigate("/outlets")}>
              <div className="exec-card-top">
                <span className="exec-card-title">Registered Store Doors</span>
                <div className="exec-icon-pill purple-light">
                  <Store size={15} />
                </div>
              </div>
              <strong className="exec-card-value">{totalOutlets.toLocaleString()}</strong>
              <div className="exec-card-footer">
                <span className="exec-sub-text">
                  {dormantOutlets > 0 ? `${dormantOutlets} Dormant Accounts` : "Full Network Active"}
                </span>
                <span className="exec-pill-badge badge-purple">Direct Accounts</span>
              </div>
              <div className="exec-card-hover-hint">
                <span>Browse Outlet Database</span>
                <ChevronRight size={12} />
              </div>
            </div>

            {/* Card 2: Active Buying Accounts */}
            <div className="exec-kpi-card" onClick={() => navigate("/outlets")}>
              <div className="exec-card-top">
                <span className="exec-card-title">Active Transacting Accounts</span>
                <div className="exec-icon-pill success-light">
                  <ShoppingBag size={15} />
                </div>
              </div>
              <strong className="exec-card-value">{activeOutlets.toLocaleString()}</strong>
              <div className="exec-card-footer">
                <span className="exec-sub-text">{coverageRate}% Trade Penetration</span>
                <span className="exec-pill-badge badge-success">Active Buying</span>
              </div>
              <div className="exec-card-hover-hint">
                <span>View Active Accounts</span>
                <ChevronRight size={12} />
              </div>
            </div>

            {/* Card 3: Target Quota Attainment */}
            <div className="exec-kpi-card" onClick={() => navigate("/targets")}>
              <div className="exec-card-top">
                <span className="exec-card-title">Period Target Attainment</span>
                <div className="exec-icon-pill warning-light">
                  <Target size={15} />
                </div>
              </div>
              <strong className="exec-card-value">{targetProgress.toFixed(1)}%</strong>
              <div className="exec-card-footer">
                <span className="exec-sub-text">{targetsAchieved} of {activeTargets} Quotas Attained</span>
                <span className={`exec-pill-badge ${targetIsOnTrack ? "badge-success" : "badge-warning"}`}>
                  {targetIsOnTrack ? "Pacing On Track" : "Action Needed"}
                </span>
              </div>
              <div className="exec-card-hover-hint">
                <span>Track Rep Quotas</span>
                <ChevronRight size={12} />
              </div>
            </div>

            {/* Card 4: Sales Force & Shifts */}
            <div className="exec-kpi-card" onClick={() => navigate("/attendance")}>
              <div className="exec-card-top">
                <span className="exec-card-title">Field Sales Force</span>
                <div className="exec-icon-pill commercial-light">
                  <Users size={15} />
                </div>
              </div>
              <strong className="exec-card-value">{activeReps} Active Reps</strong>
              <div className="exec-card-footer">
                <span className="exec-sub-text">{completedShifts} Completed Shifts</span>
                <span className="exec-pill-badge badge-primary">{attendanceRecords} Clock-ins</span>
              </div>
              <div className="exec-card-hover-hint">
                <span>View Team Attendance</span>
                <ChevronRight size={12} />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          4. INTERACTIVE VISUAL ANALYTICS & EXECUTIVE RUN-RATE ENGINE
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="executive-visual-grid">
        {/* Visual Panel 1: Commercial Velocity & Revenue Run-Rate Trend */}
        <section className="exec-visual-panel">
          <div className="visual-panel-header">
            <div>
              <div className="panel-title-with-pill">
                <h3>Commercial Velocity & Daily Run-Rate</h3>
                <span className="panel-metric-chip">{chartMetric === "revenue" ? "Revenue (₦)" : "Volume (Units)"}</span>
              </div>
              <p>Daily performance momentum across selected timeframe</p>
            </div>

            <div className="visual-panel-controls">
              {/* Metric Toggle */}
              <div className="chart-metric-toggle">
                <button
                  type="button"
                  className={`toggle-btn ${chartMetric === "revenue" ? "toggle-btn-active" : ""}`}
                  onClick={() => setChartMetric("revenue")}
                >
                  <DollarSign size={13} />
                  Revenue
                </button>
                <button
                  type="button"
                  className={`toggle-btn ${chartMetric === "volume" ? "toggle-btn-active" : ""}`}
                  onClick={() => setChartMetric("volume")}
                >
                  <Package size={13} />
                  Volume
                </button>
              </div>

              <Link to="/sales" className="panel-link-btn" title="Detailed Sales Breakdown">
                <span>Deep Dive</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          {/* Dynamic SVG Visualizer Bar Chart */}
          <div className="exec-chart-container">
            <div className="exec-chart-bars-wrap">
              {trendData.map((point) => {
                const val = chartMetric === "revenue" ? point.revenue : point.volume;
                const pct = Math.min(100, Math.max(8, Math.round((val / maxChartValue) * 100)));
                const formattedVal = chartMetric === "revenue" ? formatShortCurrency(val) : `${val.toLocaleString()} u`;

                return (
                  <div className="chart-bar-col" key={point.date}>
                    <div className="chart-bar-tooltip">
                      <strong>{point.label}</strong>
                      <span>{chartMetric === "revenue" ? formatCurrency(point.revenue) : `${point.volume.toLocaleString()} units`}</span>
                    </div>
                    <div className="chart-bar-track">
                      <div
                        className={`chart-bar-fill ${val > 0 ? "has-data" : "zero-data"}`}
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                    <span className="chart-bar-value-label">{val > 0 ? formattedVal : "—"}</span>
                    <span className="chart-bar-date-label">{point.label.split(" ")[0]}</span>
                  </div>
                );
              })}
            </div>

            {/* Chart Summary Footnote */}
            <div className="chart-footer-metrics">
              <div className="chart-foot-stat">
                <span>Period Gross Run:</span>
                <strong>{formatCurrency(grossSales)}</strong>
              </div>
              <div className="chart-foot-stat">
                <span>Total Units Flow:</span>
                <strong>{unitsSold.toLocaleString()} Bottles & Crates</strong>
              </div>
              <div className="chart-foot-stat">
                <span>Daily Avg Pace:</span>
                <strong>
                  {formatCurrency(trendData.length > 0 ? Math.round(grossSales / trendData.length) : 0)} / day
                </strong>
              </div>
            </div>
          </div>
        </section>

        {/* Visual Panel 2: Product & Brand Contribution Breakdown */}
        <section className="exec-visual-panel">
          <div className="visual-panel-header">
            <div>
              <div className="panel-title-with-pill">
                <h3>Top Product Contribution</h3>
                <span className="panel-metric-chip purple">Brand Share</span>
              </div>
              <p>Top beverage revenue and volume leaders</p>
            </div>
            <Link to="/sales" className="panel-link-btn">
              <span>View All</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="product-breakdown-list">
            {topProducts.length === 0 ? (
              <div className="empty-chart-fallback">
                <Package size={28} />
                <p>No product transactions in this period.</p>
                <Link to="/new-sale" className="action-deck-btn action-btn-primary" style={{ marginTop: 8 }}>
                  <Plus size={13} /> Record New Sale
                </Link>
              </div>
            ) : (
              topProducts.map((prod, idx) => (
                <div className="product-rank-row" key={prod.name} onClick={() => navigate("/sales")}>
                  <div className="product-rank-badge">#{idx + 1}</div>
                  <div className="product-rank-info">
                    <div className="product-rank-title-row">
                      <strong className="product-name">{prod.name}</strong>
                      <span className="product-amount">{formatCurrency(prod.revenue)}</span>
                    </div>
                    <div className="product-progress-track">
                      <div
                        className="product-progress-fill"
                        style={{ width: `${Math.max(8, prod.sharePct)}%` }}
                      />
                    </div>
                    <div className="product-rank-subline">
                      <span>{prod.volume.toLocaleString()} units sold</span>
                      <span>{prod.sharePct}% of gross sales</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          5. TERRITORY DISTRIBUTION & FIELD AUDIT CONTROL
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="executive-dual-grid">
        {/* Territory Matrix Card */}
        <section className="dual-card">
          <div className="dual-card-header">
            <div className="dual-card-title-wrap">
              <Building2 size={16} className="dual-card-icon" />
              <div>
                <h4>Territory & Regional Footprint</h4>
                <p>Regional outlet penetration and revenue distribution</p>
              </div>
            </div>
            <Link to="/outlets" className="block-deep-link">
              <span>Territories</span>
              <ArrowUpRight size={13} />
            </Link>
          </div>

          <div className="territory-grid-cards">
            {regionalDistribution.length === 0 ? (
              <div className="empty-sub-fallback">
                <span>No regional outlet data found.</span>
              </div>
            ) : (
              regionalDistribution.map((reg) => (
                <div className="territory-card-item" key={reg.region} onClick={() => navigate("/outlets")}>
                  <div className="territory-top">
                    <span className="territory-name">{reg.region}</span>
                    <span className="territory-outlets-badge">{reg.outletsCount} Outlets</span>
                  </div>
                  <div className="territory-mid">
                    <strong className="territory-revenue">{formatCurrency(reg.revenue)}</strong>
                    <span className="territory-volume">{reg.salesVolume.toLocaleString()} units</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Field Audit & Target Realization Meter */}
        <section className="dual-card">
          <div className="dual-card-header">
            <div className="dual-card-title-wrap">
              <ShieldCheck size={16} className="dual-card-icon" />
              <div>
                <h4>Field Integrity & Quota Realization</h4>
                <p>GPS verification, photo proofs & pacing health</p>
              </div>
            </div>
            <Link to="/targets" className="block-deep-link">
              <span>Target Details</span>
              <ArrowUpRight size={13} />
            </Link>
          </div>

          <div className="quota-audit-body">
            {/* Target Hero Bar */}
            <div className="quota-meter-block">
              <div className="quota-meter-head">
                <span className="quota-meter-title">Period Quota Realization:</span>
                <span className="quota-meter-value">{targetProgress.toFixed(1)}%</span>
              </div>
              <div className="quota-progress-track">
                <div
                  className={`quota-progress-fill ${targetIsOnTrack ? "fill-success" : "fill-warning"}`}
                  style={{ width: `${Math.min(100, Math.max(5, targetProgress))}%` }}
                />
              </div>
              <div className="quota-meter-sub">
                <span>{targetsAchieved} of {activeTargets} targets completed</span>
                <span className={`target-status-chip ${targetIsOnTrack ? "status-ontrack" : "status-warning"}`}>
                  {targetIsOnTrack ? "Pacing On Track" : "Needs Acceleration"}
                </span>
              </div>
            </div>

            {/* Audit Compliance Verification Items */}
            <div className="compliance-audit-list">
              <div className="compliance-audit-item" onClick={() => navigate("/visits")}>
                <div className="audit-item-left">
                  <div className="audit-item-icon gps-icon">
                    <Compass size={15} />
                  </div>
                  <div>
                    <strong>GPS Location Compliance</strong>
                    <span>Physical outlet coordinates verified</span>
                  </div>
                </div>
                <div className="audit-item-right">
                  <strong>{gpsComplianceRate}%</strong>
                  <span className="audit-count">{gpsVerifiedCount} verified</span>
                </div>
              </div>

              <div className="compliance-audit-item" onClick={() => navigate("/visits")}>
                <div className="audit-item-left">
                  <div className="audit-item-icon photo-icon">
                    <Camera size={15} />
                  </div>
                  <div>
                    <strong>Merchandising Photo Proof</strong>
                    <span>Store shelf visibility captured</span>
                  </div>
                </div>
                <div className="audit-item-right">
                  <strong>{photoComplianceRate}%</strong>
                  <span className="audit-count">{photoVerifiedCount} photos</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          6. REAL-TIME MULTI-CHANNEL ACTIVITY & AUDIT STREAM
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="executive-activity-feed-section">
        <div className="activity-feed-header">
          <div className="activity-feed-title-wrap">
            <div className="activity-pulse-icon">
              <Radio size={15} />
            </div>
            <div>
              <h3>Real-Time Live Activity Ledger</h3>
              <p>Chronological transaction stream, store check-ins & field workforce logs</p>
            </div>
          </div>

          <div className="activity-feed-controls">
            {/* Search filter in feed */}
            <div className="activity-search-box">
              <Search size={13} className="activity-search-icon" />
              <input
                type="text"
                placeholder="Filter stream by outlet, rep, beverage..."
                value={activitySearch}
                onChange={(e) => setActivitySearch(e.target.value)}
                aria-label="Filter activity feed"
              />
            </div>

            {/* Tab switchers */}
            <div className="activity-tab-group">
              <button
                type="button"
                className={`activity-tab-btn ${activityTab === "sales" ? "activity-tab-btn-active" : ""}`}
                onClick={() => setActivityTab("sales")}
              >
                <ShoppingCart size={13} />
                <span>Sales ({sales.length})</span>
              </button>
              <button
                type="button"
                className={`activity-tab-btn ${activityTab === "visits" ? "activity-tab-btn-active" : ""}`}
                onClick={() => setActivityTab("visits")}
              >
                <MapPin size={13} />
                <span>Visits ({visits.length})</span>
              </button>
              <button
                type="button"
                className={`activity-tab-btn ${activityTab === "attendance" ? "activity-tab-btn-active" : ""}`}
                onClick={() => setActivityTab("attendance")}
              >
                <UserCheck size={13} />
                <span>Attendance ({attendanceVisits.length})</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Tab 1: Recent Sales Transactions ── */}
        {activityTab === "sales" && (
          <div className="activity-stream-body">
            {filteredSalesActivity.length === 0 ? (
              <div className="activity-empty-state">
                <ShoppingCart size={32} />
                <p>No sales transactions found in this timeframe.</p>
                <Link to="/new-sale" className="action-deck-btn action-btn-primary">
                  <Plus size={13} /> Record New Sale
                </Link>
              </div>
            ) : (
              <div className="activity-table-wrapper">
                <table className="executive-stream-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Outlet / Retailer</th>
                      <th>Product / Volume</th>
                      <th>Sales Rep</th>
                      <th>Total Amount</th>
                      <th>Settlement</th>
                      <th>Timestamp</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSalesActivity.map((sale) => {
                      const total = Number(sale.total_amount ?? 0);
                      const paid = Number(sale.amount_paid ?? 0);
                      const bal = Number(sale.balance ?? total - paid);
                      const isPaid = paid >= total || bal <= 0;
                      const isPartial = paid > 0 && bal > 0;

                      return (
                        <tr key={sale.id} className="stream-table-row">
                          <td>
                            <span
                              className={`status-chip ${
                                isPaid ? "chip-paid" : isPartial ? "chip-partial" : "chip-credit"
                              }`}
                            >
                              {isPaid ? "Paid" : isPartial ? "Partial" : "Credit"}
                            </span>
                          </td>
                          <td>
                            <div className="table-outlet-cell">
                              <Store size={13} className="cell-icon" />
                              <strong className="cell-outlet-name">{sale.outlet || "Direct Retail Outlet"}</strong>
                            </div>
                          </td>
                          <td>
                            <span className="cell-product-name">
                              {sale.drink_type || "Beverage Product"} · {Number(sale.quantity ?? 0).toLocaleString()} units
                            </span>
                          </td>
                          <td>
                            <span className="cell-rep-name">{sale.staff || "Sales Representative"}</span>
                          </td>
                          <td>
                            <strong className="cell-amount">{formatCurrency(total)}</strong>
                          </td>
                          <td>
                            <span className="cell-paid-text">
                              {isPaid ? "Full (₦0 Due)" : `Paid: ${formatCurrency(paid)}`}
                            </span>
                          </td>
                          <td>
                            <span className="cell-timestamp">{formatActivityDate(sale.sale_date || sale.created_at)}</span>
                          </td>
                          <td>
                            <Link to="/sales" className="table-action-link" title="View Sale Details">
                              <span>View</span>
                              <ChevronRight size={13} />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="activity-stream-footer">
              <span className="stream-count-text">
                Showing {filteredSalesActivity.length} of {sales.length} transactions
              </span>
              <Link to="/sales" className="stream-view-all-link">
                <span>View Full Sales Ledger ({sales.length})</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        )}

        {/* ── Tab 2: Recent Field Trade Visits ── */}
        {activityTab === "visits" && (
          <div className="activity-stream-body">
            {filteredVisitsActivity.length === 0 ? (
              <div className="activity-empty-state">
                <MapPin size={32} />
                <p>No field visit logs recorded for this timeframe.</p>
                <Link to="/visits/check-in" className="action-deck-btn action-btn-primary">
                  <MapPin size={13} /> Log New Visit
                </Link>
              </div>
            ) : (
              <div className="activity-table-wrapper">
                <table className="executive-stream-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Retail Outlet</th>
                      <th>Field Representative</th>
                      <th>Outcome</th>
                      <th>GPS Integrity</th>
                      <th>Photo Proof</th>
                      <th>Duration</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVisitsActivity.map((v) => {
                      const isSuccessful = v.outcome === "Successful" || v.outcome?.toLowerCase().includes("order");

                      return (
                        <tr key={v.id} className="stream-table-row">
                          <td>
                            <span
                              className={`status-chip ${
                                v.status === "Active" ? "chip-active" : "chip-completed"
                              }`}
                            >
                              {v.status || "Completed"}
                            </span>
                          </td>
                          <td>
                            <div className="table-outlet-cell">
                              <Store size={13} className="cell-icon" />
                              <strong className="cell-outlet-name">{v.outlet || "Retail Store"}</strong>
                            </div>
                          </td>
                          <td>
                            <span className="cell-rep-name">{v.staff || "Field Officer"}</span>
                          </td>
                          <td>
                            <span className={`outcome-chip ${isSuccessful ? "outcome-success" : "outcome-routine"}`}>
                              {v.outcome || "Routine Visit"}
                            </span>
                          </td>
                          <td>
                            <span className={`compliance-tag ${v.gps ? "compliance-verified" : "compliance-unverified"}`}>
                              {v.gps ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                              {v.gps ? "GPS Verified" : "No GPS"}
                            </span>
                          </td>
                          <td>
                            <span className={`compliance-tag ${v.photo || v.photoUrl ? "compliance-verified" : "compliance-unverified"}`}>
                              {v.photo || v.photoUrl ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                              {v.photo || v.photoUrl ? "Photo Attached" : "No Photo"}
                            </span>
                          </td>
                          <td>
                            <span className="cell-timestamp">{v.duration || "25 mins"}</span>
                          </td>
                          <td>
                            <Link to="/visits" className="table-action-link" title="View Visit Record">
                              <span>Audit</span>
                              <ChevronRight size={13} />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="activity-stream-footer">
              <span className="stream-count-text">
                Showing {filteredVisitsActivity.length} of {visits.length} field visits
              </span>
              <Link to="/visits" className="stream-view-all-link">
                <span>View Full Visits History ({visits.length})</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        )}

        {/* ── Tab 3: Staff Attendance & Shifts ── */}
        {activityTab === "attendance" && (
          <div className="activity-stream-body">
            {attendanceVisits.length === 0 ? (
              <div className="activity-empty-state">
                <UserCheck size={32} />
                <p>No attendance clock-ins recorded for this timeframe.</p>
                <Link to="/attendance" className="action-deck-btn action-btn-primary">
                  <UserCheck size={13} /> Mark Shift Attendance
                </Link>
              </div>
            ) : (
              <div className="activity-table-wrapper">
                <table className="executive-stream-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Staff Member</th>
                      <th>Check-In Timestamp</th>
                      <th>Shift Duration</th>
                      <th>GPS Geofence</th>
                      <th>Location / Territory</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceVisits.map((att) => (
                      <tr key={att.id} className="stream-table-row">
                        <td>
                          <span className={`status-chip ${att.status === "Active" ? "chip-active" : "chip-completed"}`}>
                            {att.status === "Active" ? "On Shift" : "Shift Closed"}
                          </span>
                        </td>
                        <td>
                          <div className="table-outlet-cell">
                            <UserCheck size={13} className="cell-icon" />
                            <strong className="cell-outlet-name">{att.staff || "Sales Representative"}</strong>
                          </div>
                        </td>
                        <td>
                          <span className="cell-timestamp">{formatActivityDate(att.date)}</span>
                        </td>
                        <td>
                          <span className="cell-paid-text">{att.duration || "Full Shift"}</span>
                        </td>
                        <td>
                          <span className={`compliance-tag ${att.gps ? "compliance-verified" : "compliance-unverified"}`}>
                            {att.gps ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                            {att.gps ? "Geotagged Clock-In" : "Manual Clock-In"}
                          </span>
                        </td>
                        <td>
                          <span className="cell-product-name">{att.outlet || "Territory Hub"}</span>
                        </td>
                        <td>
                          <Link to="/attendance" className="table-action-link" title="View Shift Logs">
                            <span>Inspect</span>
                            <ChevronRight size={13} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="activity-stream-footer">
              <span className="stream-count-text">
                Showing {attendanceVisits.length} attendance shift records
              </span>
              <Link to="/attendance" className="stream-view-all-link">
                <span>View Attendance Roster</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          7. ALL-IN-ONE EXECUTIVE NAVIGATION MATRIX (SYSTEM MODULE HUB)
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="executive-system-directory-section">
        <div className="system-directory-header">
          <div>
            <h3>Platform Modules & Strategic Directory</h3>
            <p>Direct at-a-glance navigation into every subsystem of Pen Edge Field Operations</p>
          </div>
          <span className="system-status-indicator">
            <span className="live-pulse-dot" /> 8 Operational Modules Online
          </span>
        </div>

        <div className="system-modules-grid">
          {/* Module 1: Sales */}
          <div className="system-module-card" onClick={() => navigate("/sales")}>
            <div className="module-card-top">
              <div className="module-icon-box commercial-theme">
                <ShoppingCart size={18} />
              </div>
              <span className="module-stat-badge">{formatShortCurrency(grossSales)}</span>
            </div>
            <h4>Sales & Invoicing</h4>
            <p>Live transaction ledger, invoice generation, cash collections and credit debt aging.</p>
            <div className="module-card-footer">
              <span>{sales.length} Transactions</span>
              <ArrowRight size={14} className="module-arrow" />
            </div>
          </div>

          {/* Module 2: Field Trade Visits */}
          <div className="system-module-card" onClick={() => navigate("/visits")}>
            <div className="module-card-top">
              <div className="module-icon-box visits-theme">
                <MapPin size={18} />
              </div>
              <span className="module-stat-badge">{totalVisits} Logged</span>
            </div>
            <h4>Field Trade Visits</h4>
            <p>GPS-verified store audits, check-ins, merchandising proofs and trade compliance.</p>
            <div className="module-card-footer">
              <span>{visitSuccessRate}% Conversion</span>
              <ArrowRight size={14} className="module-arrow" />
            </div>
          </div>

          {/* Module 3: Retail Outlets */}
          <div className="system-module-card" onClick={() => navigate("/outlets")}>
            <div className="module-card-top">
              <div className="module-icon-box network-theme">
                <Store size={18} />
              </div>
              <span className="module-stat-badge">{totalOutlets} Stores</span>
            </div>
            <h4>Retail Outlets Network</h4>
            <p>Complete retail store directory, manager contacts, geolocations and tier tagging.</p>
            <div className="module-card-footer">
              <span>{activeOutlets} Active Buying</span>
              <ArrowRight size={14} className="module-arrow" />
            </div>
          </div>

          {/* Module 4: Daily Attendance */}
          <div className="system-module-card" onClick={() => navigate("/attendance")}>
            <div className="module-card-top">
              <div className="module-icon-box attendance-theme">
                <UserCheck size={18} />
              </div>
              <span className="module-stat-badge">{activeReps} On Duty</span>
            </div>
            <h4>Daily Attendance & Roster</h4>
            <p>Geofenced shift clock-in, live field presence, shift timers and workforce duty roster.</p>
            <div className="module-card-footer">
              <span>{completedShifts} Shifts Done</span>
              <ArrowRight size={14} className="module-arrow" />
            </div>
          </div>

          {/* Module 5: Targets & Quotas */}
          <div className="system-module-card" onClick={() => navigate("/targets")}>
            <div className="module-card-top">
              <div className="module-icon-box target-theme">
                <Target size={18} />
              </div>
              <span className="module-stat-badge">{targetProgress.toFixed(0)}% Achieved</span>
            </div>
            <h4>Targets & Quotas</h4>
            <p>Product volume goals, sales rep quota allocations, bonus tiers and pacing tracker.</p>
            <div className="module-card-footer">
              <span>{activeTargets} Active Quotas</span>
              <ArrowRight size={14} className="module-arrow" />
            </div>
          </div>

          {/* Module 6: Executive BI Reports */}
          <div className="system-module-card" onClick={() => navigate("/reports")}>
            <div className="module-card-top">
              <div className="module-icon-box reports-theme">
                <BarChart3 size={18} />
              </div>
              <span className="module-stat-badge">Analytics</span>
            </div>
            <h4>Executive BI Reports</h4>
            <p>Cross-territory analysis, Brand Ambassador vs Sales Exec performance matrix.</p>
            <div className="module-card-footer">
              <span>Export Ready</span>
              <ArrowRight size={14} className="module-arrow" />
            </div>
          </div>

          {/* Module 7: Field Team */}
          <div className="system-module-card" onClick={() => navigate("/staff")}>
            <div className="module-card-top">
              <div className="module-icon-box staff-theme">
                <Users size={18} />
              </div>
              <span className="module-stat-badge">Workforce</span>
            </div>
            <h4>Sales Force Directory</h4>
            <p>Staff hierarchy, regional territory assignments, access permissions and roles.</p>
            <div className="module-card-footer">
              <span>National Team</span>
              <ArrowRight size={14} className="module-arrow" />
            </div>
          </div>

          {/* Module 8: Settings & Config (Admin only) */}
          {(role?.key === "administrator" || role?.hierarchy_level === 1 || staff?.user_roles?.key === "administrator") && (
            <div className="system-module-card" onClick={() => navigate("/settings")}>
              <div className="module-card-top">
                <div className="module-icon-box settings-theme">
                  <Settings size={18} />
                </div>
                <span className="module-stat-badge">Admin</span>
              </div>
              <h4>System Configuration</h4>
              <p>Master data parameters, payment methods, regions, push logs and access policies.</p>
              <div className="module-card-footer">
                <span>System v1.0</span>
                <ArrowRight size={14} className="module-arrow" />
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}