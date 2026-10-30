import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Users,
  TrendingUp,
  ClipboardCheck,
  Activity,
  Search,
  ChevronDown,
  ArrowRight,
  Download,
  RotateCcw,
  MessageSquare,
} from "lucide-react";
import "../team-activity.css";
import LogoLoader from "../components/brand/LogoLoader";
import { useMinimumLoading } from "../hooks/useMinimumLoading";
import { loadUserAccounts } from "../services/userManagementService";
import { getSales, type Sale } from "../services/salesService";
import { getVisits, type VisitRecord } from "../services/visitsService";
import { formatCurrencyNaira } from "../services/teamActivityService";
import {
  getUserScope,
  filterStaffByScope,
  filterSalesByScope,
  filterVisitsByScope,
} from "../services/dataScopeService";

interface TeamDirectoryMember {
  id: string;
  name: string;
  email: string;
  role: string;
  region: string;
  salesCount: number;
  revenue: number;
  lastActivity: string;
  avatarColor: string;
  initials: string;
  isActive: boolean;
}

export default function Staff() {
  const { staff, role } = useAuth();
  const userScope = useMemo(() => getUserScope(staff, role), [staff, role]);

  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const visibleLoading = useMinimumLoading(loading, 800);
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState("All roles");
  const [selectedRegion, setSelectedRegion] = useState("All regions");
  const [sortBy, setSortBy] = useState<"revenue" | "sales" | "name" | "region">("revenue");

  // Pure Supabase data state
  const [members, setMembers] = useState<TeamDirectoryMember[]>([]);
  const [totalSalesCount, setTotalSalesCount] = useState(0);
  const [totalSalesRevenue, setTotalSalesRevenue] = useState(0);
  const [totalAttendanceLogs, setTotalAttendanceLogs] = useState(0);
  const [activeRatePct, setActiveRatePct] = useState(0);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [rawUsers, rawSales, rawVisits] = await Promise.all([
          loadUserAccounts().catch(() => []),
          getSales().catch(() => [] as Sale[]),
          getVisits().catch(() => [] as VisitRecord[]),
        ]);

        const users = filterStaffByScope(rawUsers, userScope);
        const sales = filterSalesByScope(rawSales, userScope);
        const visits = filterVisitsByScope(rawVisits, userScope);

        // Aggregate sales per staff
        const staffSalesMap = new Map<string, { count: number; revenue: number; lastDate: string }>();
        let totalRev = 0;
        sales.forEach((s) => {
          const amt = Number(s.total_amount ?? 0);
          totalRev += amt;
          const keyName = (s.staff || "").toLowerCase();
          const keyId = (s.staff_id || "").toLowerCase();
          const saleDate = s.sale_date || (s.created_at ? s.created_at.slice(0, 10) : "");

          [keyName, keyId].filter(Boolean).forEach((k) => {
            if (!staffSalesMap.has(k)) {
              staffSalesMap.set(k, { count: 0, revenue: 0, lastDate: "" });
            }
            const rec = staffSalesMap.get(k)!;
            rec.count += 1;
            rec.revenue += amt;
            if (saleDate && (!rec.lastDate || saleDate > rec.lastDate)) {
              rec.lastDate = saleDate;
            }
          });
        });

        // Aggregate visits and attendance logs
        const attendanceLogs = visits.filter((v) => v.type === "attendance").length;
        setTotalAttendanceLogs(attendanceLogs);
        setTotalSalesCount(sales.length);
        setTotalSalesRevenue(totalRev);

        // 7-day activity calculation
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysIso = sevenDaysAgo.toISOString().slice(0, 10);

        const activeStaffIn7Days = new Set<string>();
        sales.forEach((s) => {
          const d = (s.sale_date || s.created_at || "").slice(0, 10);
          if (d >= sevenDaysIso && s.staff) activeStaffIn7Days.add(s.staff.toLowerCase());
        });
        visits.forEach((v) => {
          if (v.date >= sevenDaysIso && v.staff) activeStaffIn7Days.add(v.staff.toLowerCase());
        });

        const activeRate = users.length > 0
          ? Math.round((activeStaffIn7Days.size / users.length) * 100)
          : 0;
        setActiveRatePct(activeRate);

        // Map real Supabase user accounts
        const colorPalette = ["#092c1f", "#044e33", "#052e16", "#064e3b", "#0f5132", "#14532d", "#065f46", "#047857"];
        const mappedMembers: TeamDirectoryMember[] = users.map((u, idx) => {
          const nameTrim = (u.name || "").trim();
          const parts = nameTrim.split(" ");
          const initials = parts.length > 1
            ? (parts[0][0] + parts[1][0]).toUpperCase()
            : (parts[0]?.[0] || "U").toUpperCase();

          const sStats = staffSalesMap.get(u.name.toLowerCase()) || staffSalesMap.get(u.id.toLowerCase()) || {
            count: 0,
            revenue: 0,
            lastDate: "",
          };

          let lastAct = "No activity";
          if (sStats.lastDate) {
            const dt = new Date(sStats.lastDate);
            lastAct = dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
          } else if (u.is_active) {
            lastAct = "Active";
          }

          return {
            id: u.id,
            name: u.name || "Staff Member",
            email: u.email || "—",
            role: u.role_key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            region: u.region || "All Region",
            salesCount: sStats.count,
            revenue: sStats.revenue,
            lastActivity: lastAct,
            avatarColor: colorPalette[idx % colorPalette.length],
            initials,
            isActive: u.is_active,
          };
        });

        setMembers(mappedMembers);
      } catch (err) {
        console.error("Error loading team directory from Supabase:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [userScope]);

  // Filter options
  const roles = useMemo(() => {
    const set = new Set<string>();
    members.forEach((m) => {
      if (m.role) set.add(m.role);
    });
    return ["All roles", ...Array.from(set).sort()];
  }, [members]);

  const regions = useMemo(() => {
    const set = new Set<string>();
    members.forEach((m) => {
      if (m.region) set.add(m.region);
    });
    return ["All regions", ...Array.from(set).sort()];
  }, [members]);

  const activeStaffCount = useMemo(() => members.filter((m) => m.isActive).length, [members]);
  const distinctRegionsCount = useMemo(() => {
    const set = new Set<string>();
    members.forEach((m) => {
      if (m.region && m.region !== "All Region" && m.region !== "Unassigned") set.add(m.region);
    });
    return set.size || (members.length > 0 ? 1 : 0);
  }, [members]);

  const hasActiveFilters =
    Boolean(search.trim()) ||
    selectedRole !== "All roles" ||
    selectedRegion !== "All regions";

  // Filtered & sorted members list
  const filteredMembers = useMemo(() => {
    const filtered = members.filter((m) => {
      if (selectedRole !== "All roles" && m.role !== selectedRole) return false;
      if (selectedRegion !== "All regions" && m.region !== selectedRegion) return false;
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matches =
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          m.region.toLowerCase().includes(q) ||
          m.role.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "revenue") return b.revenue - a.revenue || a.name.localeCompare(b.name);
      if (sortBy === "sales") return b.salesCount - a.salesCount || a.name.localeCompare(b.name);
      if (sortBy === "region") return a.region.localeCompare(b.region) || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
  }, [members, selectedRole, selectedRegion, search, sortBy]);

  function handleExportCsv() {
    const headers = ["Name", "Email", "Role", "Region", "Sales Count", "Revenue (NGN)", "Last Activity", "Status"];
    const rows = filteredMembers.map((m) => [
      `"${m.name.replace(/"/g, '""')}"`,
      `"${m.email.replace(/"/g, '""')}"`,
      `"${m.role.replace(/"/g, '""')}"`,
      `"${m.region.replace(/"/g, '""')}"`,
      m.salesCount,
      m.revenue,
      `"${m.lastActivity}"`,
      m.isActive ? "Active" : "Inactive",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pen-edge-team-directory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="team-activity-container">
      {/* ── 1. PAGE HEADER ── */}
      <div className="team-header-box">
        <div>
          <h1 className="team-header-title">
            Team
          </h1>
          <p className="team-header-subtitle">
            Monitor active staff, field activity, and sales contribution by role and region.
          </p>
        </div>

        {/* Primary CTA Button to Activity Summary Report */}
        <button
          type="button"
          onClick={() => navigate("/visits/activity")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "#092c1f",
            color: "#ffffff",
            padding: "10px 18px",
            borderRadius: "8px",
            border: "none",
            fontSize: "13.5px",
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 2px 6px rgba(9, 44, 31, 0.25)",
            transition: "all 0.15s ease",
          }}
        >
          <span>Open activity report</span>
          <ArrowRight size={15} />
        </button>
      </div>

      {/* ── 2. TOP 4 OVERVIEW KPI CARDS ── */}
      <div className="ta-kpi-grid">
        {/* Active staff */}
        <div className="ta-kpi-card">
          <div className="ta-kpi-top">
            <span className="ta-kpi-label">Active staff</span>
            <span className="ta-kpi-icon-pill">
              <Users size={18} />
            </span>
          </div>
          <div className="ta-kpi-bottom">
            <div className="ta-kpi-value">{activeStaffCount}</div>
            <div className="ta-kpi-subtext">Across {distinctRegionsCount} region{distinctRegionsCount === 1 ? "" : "s"}</div>
          </div>
        </div>

        {/* Sales captured */}
        <div className="ta-kpi-card">
          <div className="ta-kpi-top">
            <span className="ta-kpi-label">Sales captured</span>
            <span className="ta-kpi-icon-pill">
              <TrendingUp size={18} />
            </span>
          </div>
          <div className="ta-kpi-bottom">
            <div className="ta-kpi-value">{totalSalesCount}</div>
            <div className="ta-kpi-subtext">{formatCurrencyNaira(totalSalesRevenue)} total value</div>
          </div>
        </div>

        {/* Attendance logs */}
        <div className="ta-kpi-card">
          <div className="ta-kpi-top">
            <span className="ta-kpi-label">Attendance logs</span>
            <span className="ta-kpi-icon-pill">
              <ClipboardCheck size={18} />
            </span>
          </div>
          <div className="ta-kpi-bottom">
            <div className="ta-kpi-value">{totalAttendanceLogs}</div>
            <div className="ta-kpi-subtext">Check-ins on record</div>
          </div>
        </div>

        {/* 7-day activity */}
        <div className="ta-kpi-card">
          <div className="ta-kpi-top">
            <span className="ta-kpi-label">7-day activity</span>
            <span className="ta-kpi-icon-pill">
              <Activity size={18} />
            </span>
          </div>
          <div className="ta-kpi-bottom">
            <div className="ta-kpi-value">{activeRatePct}%</div>
            <div style={{ marginTop: "8px" }}>
              <div className="ta-progress-track" style={{ height: "6px" }}>
                <div className="ta-progress-fill" style={{ width: `${Math.min(100, activeRatePct)}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. TEAM DIRECTORY SECTION ── */}
      <div className="ta-content-card">
        {/* Directory Title & Actions */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
            paddingBottom: "4px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h3 className="team-directory-title" style={{ margin: 0 }}>
              Team directory
            </h3>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                padding: "2px 9px",
                borderRadius: "999px",
                background: "#ecfdf5",
                color: "#065f46",
                border: "1px solid #a7f3d0",
              }}
            >
              {filteredMembers.length} {filteredMembers.length === 1 ? "member" : "members"}
            </span>
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredMembers.length === 0}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 13px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              background: "#ffffff",
              color: "#334155",
              fontSize: "12.5px",
              fontWeight: 600,
              cursor: filteredMembers.length === 0 ? "not-allowed" : "pointer",
            }}
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>

        {/* Search and Filters Bar */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {/* Search bar */}
          <div style={{ flex: "1 1 280px", position: "relative", display: "flex", alignItems: "center" }}>
            <Search size={15} style={{ position: "absolute", left: "12px", color: "#94a3b8" }} />
            <input
              type="text"
              className="ta-search-input"
              style={{ width: "100%", paddingLeft: "36px" }}
              placeholder="Search by name, email, region, or role"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Role Filter */}
          <div className="ta-filter-select-wrapper">
            <select
              className="ta-filter-select"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="ta-select-chevron" />
          </div>

          {/* Region Filter */}
          <div className="ta-filter-select-wrapper">
            <select
              className="ta-filter-select"
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
            >
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="ta-select-chevron" />
          </div>

          {/* Sort By */}
          <div className="ta-filter-select-wrapper">
            <select
              className="ta-filter-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "revenue" | "sales" | "name" | "region")}
              aria-label="Sort team members"
            >
              <option value="revenue">Sort: Top Revenue</option>
              <option value="sales">Sort: Most Sales</option>
              <option value="name">Sort: Name (A–Z)</option>
              <option value="region">Sort: Region</option>
            </select>
            <ChevronDown size={14} className="ta-select-chevron" />
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSelectedRole("All roles");
                setSelectedRegion("All regions");
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                background: "#f8fafc",
                color: "#475569",
                fontSize: "12.5px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Directory Table */}
        <div className="ta-table-scroll-container">
          <table className="ta-table">
            <thead>
              <tr>
                <th style={{ width: "28%" }}>Member</th>
                <th style={{ width: "16%" }}>Role</th>
                <th style={{ width: "16%" }}>Region</th>
                <th style={{ width: "8%", textAlign: "right" }}>Sales</th>
                <th style={{ width: "12%", textAlign: "right" }}>Revenue</th>
                <th style={{ width: "10%", textAlign: "right" }}>Last activity</th>
                <th style={{ width: "10%", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleLoading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "40px" }}>
                    <LogoLoader
                      variant="section"
                      message="Loading team directory"
                      hint="Fetching staff roster, role permissions, and regional assignments"
                    />
                  </td>
                </tr>
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                    No team members match your current filters.
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => (
                  <tr key={member.id}>
                    {/* Member (Avatar + Name + Email) */}
                    <td>
                      <div className="ta-staff-cell">
                        <div
                          className="ta-staff-avatar"
                          style={{ background: member.avatarColor }}
                        >
                          {member.initials}
                        </div>
                        <div className="ta-staff-info">
                          <span className="ta-staff-name" style={{ fontSize: "13.5px" }}>
                            {member.name}
                          </span>
                          <span className="ta-staff-email" style={{ fontSize: "12px" }}>
                            {member.email}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Role Badge */}
                    <td>
                      <span className="ta-badge-role">{member.role}</span>
                    </td>

                    {/* Region */}
                    <td>
                      <span className="ta-member-region" style={{ fontSize: "13px" }}>
                        {member.region}
                      </span>
                    </td>

                    {/* Sales */}
                    <td style={{ textAlign: "right", fontWeight: 600, fontSize: "13px" }}>
                      {member.salesCount}
                    </td>

                    {/* Revenue */}
                    <td style={{ textAlign: "right" }}>
                      <span className="ta-amount-cell" style={{ fontSize: "13px" }}>
                        {member.revenue > 0 ? formatCurrencyNaira(member.revenue) : "₦0"}
                      </span>
                    </td>

                    {/* Last activity */}
                    <td style={{ textAlign: "right", fontSize: "12.5px" }}>
                      <span className="ta-member-last-act">{member.lastActivity}</span>
                    </td>

                    {/* Quick Actions */}
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => navigate("/messages")}
                        title={`Message or call ${member.name}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "5px 10px",
                          borderRadius: "6px",
                          border: "1px solid #cbd5e1",
                          background: "#ffffff",
                          color: "#092c1f",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        <MessageSquare size={12} />
                        <span>Message</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}