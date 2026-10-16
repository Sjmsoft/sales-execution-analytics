import {
  TrendingUp,
  Package,
  ClipboardCheck,
  Store,
} from "lucide-react";
import type { TeamActivityMetrics } from "../../services/teamActivityService";

interface TeamActivityKpiCardsProps {
  metrics: TeamActivityMetrics;
  loading?: boolean;
}

export default function TeamActivityKpiCards({
  metrics,
  loading = false,
}: TeamActivityKpiCardsProps) {
  if (loading) {
    return (
      <div className="ta-kpi-grid">
        <div className="ta-skeleton-card" />
        <div className="ta-skeleton-card" />
        <div className="ta-skeleton-card" />
        <div className="ta-skeleton-card" />
      </div>
    );
  }

  // Format revenue clearly (e.g. ₦36823k as shown in screenshot with clean formatting)
  const formattedRevenueShort =
    metrics.totalRevenue >= 1_000_000
      ? `₦${(metrics.totalRevenue / 1_000).toFixed(0)}k`
      : `₦${metrics.totalRevenue.toLocaleString()}`;

  const unitsDisplay =
    metrics.unitsMovedTotal >= 1000
      ? `${(metrics.unitsMovedTotal / 1000).toFixed(1)}k`
      : `${metrics.unitsMovedTotal}`;

  return (
    <div className="ta-kpi-grid">
      {/* 1. Total Revenue */}
      <div className="ta-kpi-card">
        <div className="ta-kpi-top">
          <span className="ta-kpi-label">Total Revenue</span>
          <span className="ta-kpi-icon-pill" title="Revenue trend">
            <TrendingUp size={18} strokeWidth={2} />
          </span>
        </div>
        <div className="ta-kpi-bottom">
          <div className="ta-kpi-value">{formattedRevenueShort}</div>
          <div className="ta-kpi-subtext">
            <span>{metrics.salesCount} sales</span>
          </div>
        </div>
      </div>

      {/* 2. Units Moved */}
      <div className="ta-kpi-card">
        <div className="ta-kpi-top">
          <span className="ta-kpi-label">Units Moved</span>
          <span className="ta-kpi-icon-pill" title="Inventory units moved">
            <Package size={18} strokeWidth={2} />
          </span>
        </div>
        <div className="ta-kpi-bottom">
          <div className="ta-kpi-value">{unitsDisplay}</div>
          <div className="ta-kpi-subtext">
            <span>{metrics.bottlesCount} btl, {metrics.casesCount} cs</span>
          </div>
        </div>
      </div>

      {/* 3. Attendance */}
      <div className="ta-kpi-card">
        <div className="ta-kpi-top">
          <span className="ta-kpi-label">Attendance</span>
          <span className="ta-kpi-icon-pill" title="Staff shift attendance">
            <ClipboardCheck size={18} strokeWidth={2} />
          </span>
        </div>
        <div className="ta-kpi-bottom">
          <div className="ta-kpi-value">{metrics.attendanceRatePercent}%</div>
          <div className="ta-kpi-subtext">
            <span>{metrics.shiftsCompleted}/{metrics.shiftsTotal} shifts</span>
          </div>
        </div>
      </div>

      {/* 4. Visits */}
      <div className="ta-kpi-card">
        <div className="ta-kpi-top">
          <span className="ta-kpi-label">Visits</span>
          <span className="ta-kpi-icon-pill" title="Outlet field visits">
            <Store size={18} strokeWidth={2} />
          </span>
        </div>
        <div className="ta-kpi-bottom">
          <div className="ta-kpi-value">{metrics.visitsCount}</div>
          <div className="ta-kpi-subtext">
            <span>{metrics.successfulVisitsCount} successful ({metrics.visitSuccessRatePercent}%)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
