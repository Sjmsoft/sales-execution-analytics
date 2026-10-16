import { useState, useMemo } from "react";
import { ArrowUpDown, Search } from "lucide-react";
import type { TeamMemberComparison } from "../../services/teamActivityService";
import { formatCurrencyNaira } from "../../services/teamActivityService";

interface TabTeamComparisonProps {
  teamMembers: TeamMemberComparison[];
  onSelectMember?: (member: TeamMemberComparison) => void;
}

type SortField = "revenue" | "sales" | "attendance" | "visits" | "name";
type SortDirection = "asc" | "desc";

export default function TabTeamComparison({
  teamMembers,
  onSelectMember,
}: TabTeamComparisonProps) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("revenue");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const processedMembers = useMemo(() => {
    let result = [...teamMembers];

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.region.toLowerCase().includes(q) ||
          m.role.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === "revenue") comparison = a.revenue - b.revenue;
      else if (sortField === "sales") comparison = a.salesCount - b.salesCount;
      else if (sortField === "attendance") comparison = a.attendancePercent - b.attendancePercent;
      else if (sortField === "visits") comparison = a.visitsCompleted - b.visitsCompleted;
      else if (sortField === "name") comparison = a.name.localeCompare(b.name);

      return sortDirection === "desc" ? -comparison : comparison;
    });

    return result;
  }, [teamMembers, search, sortField, sortDirection]);

  return (
    <div className="ta-content-card">
      {/* Subheader & Search */}
      <div className="ta-card-header">
        <div className="ta-card-title-wrap">
          <h3>Team Performance Comparison</h3>
          <div className="ta-card-subtitle">Compare activities across team</div>
        </div>

        <div className="ta-card-controls">
          <div className="ta-search-input-wrap">
            <Search size={15} className="ta-search-icon" />
            <input
              type="text"
              className="ta-search-input"
              placeholder="Search member, role, region..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="ta-table-scroll-container">
        <table className="ta-table">
          <thead>
            <tr>
              <th
                style={{ width: "26%", cursor: "pointer" }}
                onClick={() => handleSort("name")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>Staff Member</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th style={{ width: "20%" }}>Role</th>
              <th
                style={{ width: "16%", textAlign: "right", cursor: "pointer" }}
                onClick={() => handleSort("revenue")}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px" }}>
                  <span>Revenue</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th
                style={{ width: "10%", textAlign: "right", cursor: "pointer" }}
                onClick={() => handleSort("sales")}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px" }}>
                  <span>Sales</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th
                style={{ width: "14%", cursor: "pointer" }}
                onClick={() => handleSort("attendance")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>Attendance</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th
                style={{ width: "10%", textAlign: "center", cursor: "pointer" }}
                onClick={() => handleSort("visits")}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                  <span>Visits</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th style={{ width: "10%", textAlign: "center" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {processedMembers.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                  No team members matching search criteria.
                </td>
              </tr>
            ) : (
              processedMembers.map((member) => (
                <tr
                  key={member.id}
                  onClick={() => onSelectMember && onSelectMember(member)}
                  style={{ cursor: onSelectMember ? "pointer" : "default" }}
                >
                  {/* Staff Member */}
                  <td>
                    <div className="ta-staff-info">
                      <span className="ta-staff-name" style={{ fontSize: "13.5px" }}>
                        {member.name}
                      </span>
                      <span className="ta-staff-region" style={{ fontSize: "12px" }}>
                        {member.region}
                      </span>
                    </div>
                  </td>

                  {/* Role */}
                  <td>
                    <span className="ta-badge-role">{member.role}</span>
                  </td>

                  {/* Revenue */}
                  <td style={{ textAlign: "right" }}>
                    <span className="ta-amount-cell" style={{ fontSize: "13px" }}>
                      {formatCurrencyNaira(member.revenue)}
                    </span>
                  </td>

                  {/* Sales Count */}
                  <td style={{ textAlign: "right", fontWeight: 600, color: "#1e293b", fontSize: "13px" }}>
                    {member.salesCount}
                  </td>

                  {/* Attendance */}
                  <td>
                    <div className="ta-progress-cell">
                      <div className="ta-progress-track">
                        <div
                          className="ta-progress-fill"
                          style={{
                            width: `${Math.min(100, member.attendancePercent)}%`,
                            background: member.attendancePercent > 0 ? "#0d5c3a" : "#cbd5e1",
                          }}
                        />
                      </div>
                      <span className="ta-progress-text">{member.attendancePercent}%</span>
                    </div>
                  </td>

                  {/* Visits */}
                  <td style={{ textAlign: "center", fontWeight: 600, color: "#334155", fontSize: "13px" }}>
                    {member.visitsCompleted}/{member.visitsTotal}
                  </td>

                  {/* Status */}
                  <td style={{ textAlign: "center" }}>
                    {member.status === "Active" ? (
                      <span className="ta-badge-active">Active</span>
                    ) : (
                      <span className="ta-badge-inactive">Inactive</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
