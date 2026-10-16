import { useMemo } from "react";
import {
  BarChart3,
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock3,
  Compass,
  MapPin,
  Store,
  Trophy,
  UserRound,
} from "lucide-react";
import type { VisitRecord } from "../../services/visitsService";
import { visitMetrics } from "./visitsUtils";

const percent = (part: number, total: number) =>
  total ? Math.round((part / total) * 100) : 0;

export type VisitsTab = "Visits" | "Attendance" | "Dashboard" | "Leaderboard";

type VisitsDashboardProps = {
  visits: VisitRecord[];
};

export function VisitsDashboard({ visits }: VisitsDashboardProps) {
  const metrics = useMemo(() => visitMetrics(visits), [visits]);
  const { total, successful, pendingOrPartial, successRate, gpsRate, withGps } = metrics;

  const photoCount = useMemo(
    () => visits.filter((v) => v.photo || v.photoUrl).length,
    [visits]
  );
  const photoRate = percent(photoCount, total);

  // Dynamic daily activity breakdown (sorted chronologically)
  const dailyActivity = useMemo(() => {
    const map = new Map<string, { total: number; successful: number; partial: number }>();
    visits.forEach((v) => {
      const d = v.date;
      const cur = map.get(d) || { total: 0, successful: 0, partial: 0 };
      cur.total += 1;
      if (v.outcome === "Successful") cur.successful += 1;
      else cur.partial += 1;
      map.set(d, cur);
    });

    const list = Array.from(map.entries())
      .map(([date, counts]) => ({
        date,
        formattedDate: new Date(`${date}T12:00:00`).toLocaleDateString("en-NG", {
          month: "short",
          day: "numeric",
        }),
        ...counts,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const maxCount = list.reduce((m, item) => Math.max(m, item.total), 1);
    return { list, maxCount };
  }, [visits]);

  // Dynamic field staff performance ranking
  const staffRankings = useMemo(() => {
    const map = new Map<
      string,
      { total: number; successful: number; partial: number; withGps: number; withPhoto: number }
    >();

    visits.forEach((v) => {
      const staff = v.staff || "Unknown Staff";
      const cur = map.get(staff) || {
        total: 0,
        successful: 0,
        partial: 0,
        withGps: 0,
        withPhoto: 0,
      };
      cur.total += 1;
      if (v.outcome === "Successful") cur.successful += 1;
      else cur.partial += 1;
      if (v.gps) cur.withGps += 1;
      if (v.photo || v.photoUrl) cur.withPhoto += 1;
      map.set(staff, cur);
    });

    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        ...data,
        successRate: percent(data.successful, data.total),
        gpsRate: percent(data.withGps, data.total),
      }))
      .sort((a, b) => b.successful - a.successful || b.total - a.total);
  }, [visits]);

  // Dynamic top visited outlets
  const topOutlets = useMemo(() => {
    const map = new Map<string, { total: number; successful: number; lastDate: string }>();
    visits.forEach((v) => {
      const name = v.outlet || "Unknown Outlet";
      const cur = map.get(name) || { total: 0, successful: 0, lastDate: v.date };
      cur.total += 1;
      if (v.outcome === "Successful") cur.successful += 1;
      if (v.date > cur.lastDate) cur.lastDate = v.date;
      map.set(name, cur);
    });

    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [visits]);

  // Formatted date range text
  const dateRangeText = useMemo(() => {
    if (!visits.length) return "No visit records";
    const dates = visits.map((v) => v.date).sort();
    const start = new Date(`${dates[0]}T12:00:00`).toLocaleDateString("en-NG", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const end = new Date(`${dates[dates.length - 1]}T12:00:00`).toLocaleDateString("en-NG", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return start === end ? start : `${start} – ${end}`;
  }, [visits]);

  return (
    <section className="visits-dashboard-pro">
      {/* ── Dashboard Header ────────────────────────────────────── */}
      <div className="vdb-header">
        <div className="vdb-header-left">
          <div className="vdb-title-row">
            <div className="vdb-icon-badge">
              <BarChart3 size={20} />
            </div>
            <div>
              <h3>Field Operations & Verification Dashboard</h3>
              <p>Executive analytics, coverage density, outcome distribution, and compliance audits.</p>
            </div>
          </div>
        </div>
        <div className="vdb-header-right">
          <span className="vdb-date-pill">
            <CalendarDays size={13} />
            {dateRangeText}
          </span>
          <span className="vdb-count-chip">{total} Total Records</span>
        </div>
      </div>

      {/* ── Top Metric Cards Grid ───────────────────────────────── */}
      <div className="vdb-cards-grid">
        {/* Card 1: Outcome Breakdown */}
        <article className="vdb-card vdb-card-outcomes">
          <div className="vdb-card-header">
            <div>
              <span className="vdb-card-label">Visit Outcomes ({successRate}% Success)</span>
              <strong className="vdb-card-main-val">{total} Total Visits</strong>
            </div>
            <div className="vdb-card-icon icon-emerald">
              <CheckCircle2 size={18} />
            </div>
          </div>

          <div className="vdb-stacked-bar-wrap">
            <div className="vdb-stacked-bar">
              <span
                className="bar-segment-success"
                style={{ width: `${percent(successful, total)}%` }}
                title={`Successful: ${successful}`}
              />
              <span
                className="bar-segment-pending"
                style={{ width: `${percent(pendingOrPartial, total)}%` }}
                title={`Pending/Partial: ${pendingOrPartial}`}
              />
            </div>
          </div>

          <div className="vdb-outcome-legend">
            <div className="legend-item">
              <span className="legend-dot dot-success" />
              <div className="legend-text">
                <span className="legend-name">Successful</span>
                <strong>{successful} <small>({percent(successful, total)}%)</small></strong>
              </div>
            </div>
            <div className="legend-item">
              <span className="legend-dot dot-pending" />
              <div className="legend-text">
                <span className="legend-name">Partial / Pending</span>
                <strong>{pendingOrPartial} <small>({percent(pendingOrPartial, total)}%)</small></strong>
              </div>
            </div>
          </div>
        </article>

        {/* Card 2: GPS Verification Audit */}
        <article className="vdb-card vdb-card-gps">
          <div className="vdb-card-header">
            <div>
              <span className="vdb-card-label">GPS Geofence Audit</span>
              <strong className="vdb-card-main-val">{gpsRate}% Compliant</strong>
            </div>
            <div className="vdb-card-icon icon-blue">
              <MapPin size={18} />
            </div>
          </div>

          <div className="vdb-progress-line">
            <div className="vdb-progress-track">
              <span className="track-fill-blue" style={{ width: `${gpsRate}%` }} />
            </div>
          </div>

          <div className="vdb-stat-detail-row">
            <div>
              <small>Location Captured</small>
              <strong>{withGps} of {total}</strong>
            </div>
            <div>
              <small>Radius Compliance</small>
              <strong className="status-verified-text">
                <Compass size={13} /> {gpsRate === 100 ? "100% Strict" : `${gpsRate}% Verified`}
              </strong>
            </div>
          </div>
        </article>

        {/* Card 3: Photo Evidence Capture */}
        <article className="vdb-card vdb-card-photo">
          <div className="vdb-card-header">
            <div>
              <span className="vdb-card-label">Photo Evidence Rate</span>
              <strong className="vdb-card-main-val">{photoRate}% Proof Captured</strong>
            </div>
            <div className="vdb-card-icon icon-purple">
              <Camera size={18} />
            </div>
          </div>

          <div className="vdb-progress-line">
            <div className="vdb-progress-track">
              <span className="track-fill-purple" style={{ width: `${photoRate}%` }} />
            </div>
          </div>

          <div className="vdb-stat-detail-row">
            <div>
              <small>Saved Checkout Photos</small>
              <strong>{photoCount} visits</strong>
            </div>
            <div>
              <small>Audit Status</small>
              <strong>{photoCount > 0 ? "Evidence On File" : "None Uploaded"}</strong>
            </div>
          </div>
        </article>
      </div>

      {/* ── Middle Row: Daily Trend & Staff Rankings ─────────────── */}
      <div className="vdb-middle-grid">
        {/* Daily Visit Activity Trend Chart */}
        <article className="vdb-card vdb-chart-card">
          <div className="vdb-card-header">
            <div>
              <span className="vdb-card-label">Daily Visit Activity</span>
              <strong className="vdb-card-main-val">Chronological Execution Volume</strong>
            </div>
            <CalendarDays size={18} className="vdb-dim-icon" />
          </div>

          {!dailyActivity.list.length ? (
            <div className="vdb-empty-chart">
              <Clock3 size={32} />
              <p>No activity logged for this time window</p>
            </div>
          ) : (
            <div className="vdb-trend-chart">
              <div className="vdb-bars-container">
                {dailyActivity.list.map((day) => {
                  const barHeightPct = Math.max(
                    15,
                    Math.round((day.total / dailyActivity.maxCount) * 100)
                  );
                  const successHeightPct = Math.round((day.successful / day.total) * 100);

                  return (
                    <div key={day.date} className="vdb-bar-column">
                      <div className="vdb-bar-tooltip">
                        <strong>{day.formattedDate}</strong>
                        <span>Total: {day.total}</span>
                        <span>Successful: {day.successful}</span>
                      </div>
                      <div className="vdb-bar-track" style={{ height: `${barHeightPct}%` }}>
                        <span
                          className="vdb-bar-fill-success"
                          style={{ height: `${successHeightPct}%` }}
                        />
                      </div>
                      <span className="vdb-bar-day-label">{day.formattedDate}</span>
                      <span className="vdb-bar-count-tag">{day.total}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </article>

        {/* Top Field Representatives */}
        <article className="vdb-card vdb-staff-card">
          <div className="vdb-card-header">
            <div>
              <span className="vdb-card-label">Top Field Personnel</span>
              <strong className="vdb-card-main-val">Performance Summary</strong>
            </div>
            <Trophy size={18} className="vdb-gold-icon" />
          </div>

          {!staffRankings.length ? (
            <div className="vdb-empty-chart">
              <UserRound size={32} />
              <p>No field staff visits recorded yet</p>
            </div>
          ) : (
            <div className="vdb-staff-list">
              {staffRankings.slice(0, 5).map((rep, idx) => (
                <div key={rep.name} className="vdb-staff-item">
                  <div className="vdb-staff-rank-badge">
                    {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                  </div>
                  <div className="vdb-staff-meta">
                    <strong>{rep.name}</strong>
                    <span>
                      {rep.successful} successful · {rep.total} total
                    </span>
                  </div>
                  <div className="vdb-staff-rates">
                    <span className="vdb-rep-rate-pill">{rep.successRate}% Success</span>
                    <span className="vdb-rep-gps-pill">
                      <MapPin size={11} /> {rep.gpsRate}% GPS
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>

      {/* ── Bottom Row: Outlet Coverage Reach ────────────────────── */}
      <div className="vdb-bottom-grid">
        <article className="vdb-card vdb-outlets-card">
          <div className="vdb-card-header">
            <div>
              <span className="vdb-card-label">Outlet Visit Density</span>
              <strong className="vdb-card-main-val">Most Frequently Visited Outlets</strong>
            </div>
            <Store size={18} className="vdb-dim-icon" />
          </div>

          {!topOutlets.length ? (
            <div className="vdb-empty-chart">
              <Store size={32} />
              <p>No outlet visits recorded</p>
            </div>
          ) : (
            <div className="vdb-outlet-grid">
              {topOutlets.map((outlet) => (
                <div key={outlet.name} className="vdb-outlet-card">
                  <div className="vdb-outlet-icon">
                    <Store size={16} />
                  </div>
                  <div className="vdb-outlet-info">
                    <strong>{outlet.name}</strong>
                    <div className="vdb-outlet-meta">
                      <span>{outlet.total} visit{outlet.total > 1 ? "s" : ""}</span>
                      <span className="vdb-dot-sep">·</span>
                      <span className="vdb-green-text">{outlet.successful} successful</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
