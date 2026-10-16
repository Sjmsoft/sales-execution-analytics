import { useMemo } from "react";
import { CheckCircle2, MapPin, Trophy, UserRound } from "lucide-react";
import type { VisitRecord } from "../../services/visitsService";

type LeaderboardViewProps = {
  visits: VisitRecord[];
  isAttendance?: boolean;
};

type StaffStats = {
  name: string;
  total: number;
  successful: number;
  partialOrPending: number;
  withGps: number;
  withPhoto: number;
  successRate: number;
  gpsRate: number;
};

export function LeaderboardView({ visits, isAttendance = false }: LeaderboardViewProps) {
  const staffRankings = useMemo(() => {
    const map = new Map<string, {
      total: number;
      successful: number;
      partialOrPending: number;
      withGps: number;
      withPhoto: number;
    }>();

    visits.forEach((v) => {
      const staffName = v.staff || "Unknown Staff";
      const current = map.get(staffName) || {
        total: 0,
        successful: 0,
        partialOrPending: 0,
        withGps: 0,
        withPhoto: 0,
      };

      current.total += 1;
      if (v.outcome === "Successful") current.successful += 1;
      else current.partialOrPending += 1;
      if (v.gps) current.withGps += 1;
      if (v.photo) current.withPhoto += 1;

      map.set(staffName, current);
    });

    const list: StaffStats[] = [];
    map.forEach((data, name) => {
      const successRate = data.total > 0 ? Math.round((data.successful / data.total) * 100) : 0;
      const gpsRate = data.total > 0 ? Math.round((data.withGps / data.total) * 100) : 0;
      list.push({
        name,
        ...data,
        successRate,
        gpsRate,
      });
    });

    // Rank primarily by successful visits, then by success rate, then total
    return list.sort((a, b) => {
      if (b.successful !== a.successful) return b.successful - a.successful;
      if (b.successRate !== a.successRate) return b.successRate - a.successRate;
      return b.total - a.total;
    });
  }, [visits]);

  const topThree = staffRankings.slice(0, 3);

  return (
    <div className="leaderboard-container">
      <div className="leaderboard-heading">
        <div className="leaderboard-title-group">
          <div className="leaderboard-icon-badge">
            <Trophy size={20} />
          </div>
          <div>
            <h3>Field Performance Leaderboard</h3>
            <p>
              Rankings based on completed {isAttendance ? "attendance check-ins" : "outlet visits"}, success rate, and GPS compliance.
            </p>
          </div>
        </div>
        <span className="leaderboard-count-pill">{staffRankings.length} Active Representatives</span>
      </div>

      {!staffRankings.length ? (
        <div className="leaderboard-empty-state">
          <Trophy size={40} className="empty-icon" />
          <h4>No visit activity recorded yet</h4>
          <p>As field reps complete visits and check-ins, performance rankings will appear here.</p>
        </div>
      ) : (
        <>
          {/* Top 3 Podium Cards */}
          <div className="leaderboard-podium-grid">
            {topThree.map((rep, idx) => {
              const rank = idx + 1;
              const rankClass = rank === 1 ? "rank-gold" : rank === 2 ? "rank-silver" : "rank-bronze";
              const rankMedal = rank === 1 ? "🥇 1st Place" : rank === 2 ? "🥈 2nd Place" : "🥉 3rd Place";

              return (
                <div key={rep.name} className={`podium-card ${rankClass}`}>
                  <div className="podium-badge-line">
                    <span className="podium-rank-tag">{rankMedal}</span>
                    <span className="podium-score-tag">{rep.successRate}% Success</span>
                  </div>

                  <div className="podium-user-info">
                    <div className="podium-avatar">
                      <UserRound size={22} />
                    </div>
                    <h4>{rep.name}</h4>
                  </div>

                  <div className="podium-stats-row">
                    <div className="podium-stat">
                      <small>Successful</small>
                      <strong>{rep.successful}</strong>
                    </div>
                    <div className="podium-stat">
                      <small>Total</small>
                      <strong>{rep.total}</strong>
                    </div>
                    <div className="podium-stat">
                      <small>GPS Compliance</small>
                      <strong>{rep.gpsRate}%</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Full Rankings Table / List */}
          <div className="leaderboard-table-card">
            <div className="leaderboard-table-header">
              <h4>Complete Representative Rankings</h4>
              <span>Showing all {staffRankings.length} field personnel</span>
            </div>

            <div className="leaderboard-table-wrap">
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>Rank</th>
                    <th>Representative</th>
                    <th>Total {isAttendance ? "Check-ins" : "Visits"}</th>
                    <th>Successful</th>
                    <th>Partial / Pending</th>
                    <th>Success Rate</th>
                    <th>GPS Compliance</th>
                    <th>Photo Proof</th>
                  </tr>
                </thead>
                <tbody>
                  {staffRankings.map((rep, index) => (
                    <tr key={rep.name} className={index < 3 ? "podium-row" : ""}>
                      <td>
                        <span className={`rank-indicator rank-${index + 1}`}>
                          {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                        </span>
                      </td>
                      <td>
                        <div className="leaderboard-rep-cell">
                          <UserRound size={15} />
                          <strong>{rep.name}</strong>
                        </div>
                      </td>
                      <td>
                        <span className="metric-cell-bold">{rep.total}</span>
                      </td>
                      <td>
                        <span className="success-tag">
                          <CheckCircle2 size={13} /> {rep.successful}
                        </span>
                      </td>
                      <td>
                        <span className="pending-tag">{rep.partialOrPending}</span>
                      </td>
                      <td>
                        <div className="rate-cell">
                          <div className="mini-rate-bar">
                            <span style={{ width: `${rep.successRate}%` }} />
                          </div>
                          <span>{rep.successRate}%</span>
                        </div>
                      </td>
                      <td>
                        <span className="gps-compliance-pill">
                          <MapPin size={12} /> {rep.gpsRate}%
                        </span>
                      </td>
                      <td>
                        <span className="photo-count-pill">{rep.withPhoto} saved</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
