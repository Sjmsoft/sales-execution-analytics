import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import {
  Activity,
  Calendar,
  Users,
  TrendingUp,
} from "lucide-react";
import "../team-activity.css";
import LogoLoader from "../components/brand/LogoLoader";
import { useMinimumLoading } from "../hooks/useMinimumLoading";

import {
  fetchTeamActivityData,
  exportActivitiesToCsv,
  exportDailyToCsv,
  exportTeamComparisonToCsv,
  exportSalesSummaryToCsv,
  type TeamFilterOptions,
  type TeamActivityMetrics,
  type ActivityItem,
  type DailyActivitySummary,
  type TeamMemberComparison,
  type SalesTargetSummary,
} from "../services/teamActivityService";
import { getUserScope } from "../services/dataScopeService";

import TeamActivityHeader from "../components/team-activity/TeamActivityHeader";
import TeamActivityKpiCards from "../components/team-activity/TeamActivityKpiCards";
import TabActivitySummary from "../components/team-activity/TabActivitySummary";
import TabDailyActivity from "../components/team-activity/TabDailyActivity";
import TabTeamComparison from "../components/team-activity/TabTeamComparison";
import TabSalesSummary from "../components/team-activity/TabSalesSummary";
import ActivityDetailModal from "../components/team-activity/ActivityDetailModal";

type ActiveTab = "activity" | "daily" | "comparison" | "sales";

export default function TeamActivity() {
  const { staff, role } = useAuth();
  const userScope = useMemo(() => getUserScope(staff, role), [staff, role]);

  const [activeTab, setActiveTab] = useState<ActiveTab>("activity");
  const [loading, setLoading] = useState(true);
  const visibleLoading = useMinimumLoading(loading, 800);

  // Filters State
  const [filters, setFilters] = useState<TeamFilterOptions>({
    region: "All Regions",
    staffStatus: "Active Staff",
    memberId: "All Members",
    activityType: "All Types",
    dateRange: "30d",
  });

  // Analytics Data State (Initialized to zero, loaded from Supabase)
  const [metrics, setMetrics] = useState<TeamActivityMetrics>({
    totalRevenue: 0,
    salesCount: 0,
    unitsMovedTotal: 0,
    bottlesCount: 0,
    casesCount: 0,
    attendanceRatePercent: 0,
    shiftsCompleted: 0,
    shiftsTotal: 0,
    visitsCount: 0,
    successfulVisitsCount: 0,
    visitSuccessRatePercent: 0,
    activeMembersCount: 0,
    totalMembersCount: 0,
    totalSalesCases: 0,
    totalTargetCases: 0,
    targetVarianceCases: 0,
    targetAttainmentPercent: 0,
    dateRangeLabel: "Last 30 Days",
  });

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [dailySummaries, setDailySummaries] = useState<DailyActivitySummary[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberComparison[]>([]);
  const [salesSummaries, setSalesSummaries] = useState<SalesTargetSummary[]>([]);
  const [regions, setRegions] = useState<string[]>(["All Regions"]);
  const [staffNames, setStaffNames] = useState<string[]>(["All Members"]);

  // Detail Modal State
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);

  // Load Data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTeamActivityData(filters, userScope);
      setMetrics(data.metrics);
      setActivities(data.activities);
      setDailySummaries(data.dailySummaries);
      setTeamMembers(data.teamMembers);
      setSalesSummaries(data.salesSummaries);
      setRegions(data.regions);
      setStaffNames(data.staffNames);
    } catch (err) {
      console.error("Failed to load team activity:", err);
    } finally {
      setLoading(false);
    }
  }, [filters, userScope]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle filter changes
  const handleFilterChange = (newFilters: Partial<TeamFilterOptions>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  // Export handling
  const handleExport = (format: "csv" | "excel" | "print") => {
    if (format === "print") {
      window.print();
      return;
    }

    if (activeTab === "activity") {
      exportActivitiesToCsv(activities);
    } else if (activeTab === "daily") {
      exportDailyToCsv(dailySummaries);
    } else if (activeTab === "comparison") {
      exportTeamComparisonToCsv(teamMembers);
    } else if (activeTab === "sales") {
      exportSalesSummaryToCsv(salesSummaries);
    }
  };

  return (
    <div className="team-activity-container">
      {/* 1. Header & Global Filters */}
      <TeamActivityHeader
        filters={filters}
        onFilterChange={handleFilterChange}
        regions={regions}
        staffNames={staffNames}
        activeMembersCount={metrics.activeMembersCount}
        dateRangeLabel={metrics.dateRangeLabel}
        onRefresh={loadData}
        loading={loading}
        onExport={handleExport}
      />

      {/* 2. Top 4 KPI Metric Cards (Only shown when not in sales target tab or always visible for high-level context) */}
      {activeTab !== "sales" && (
        <TeamActivityKpiCards metrics={metrics} loading={loading} />
      )}

      {/* 3. Navigation Tabs */}
      <div className="ta-tabs-nav">
        <button
          type="button"
          className={`ta-tab-btn ${activeTab === "activity" ? "active" : ""}`}
          onClick={() => setActiveTab("activity")}
        >
          <Activity size={15} />
          <span>Activity Summary</span>
        </button>

        <button
          type="button"
          className={`ta-tab-btn ${activeTab === "daily" ? "active" : ""}`}
          onClick={() => setActiveTab("daily")}
        >
          <Calendar size={15} />
          <span>Daily Activity</span>
        </button>

        <button
          type="button"
          className={`ta-tab-btn ${activeTab === "comparison" ? "active" : ""}`}
          onClick={() => setActiveTab("comparison")}
        >
          <Users size={15} />
          <span>Team Comparison</span>
        </button>

        <button
          type="button"
          className={`ta-tab-btn ${activeTab === "sales" ? "active" : ""}`}
          onClick={() => setActiveTab("sales")}
        >
          <TrendingUp size={15} />
          <span>Sales Summary</span>
        </button>
      </div>

      {/* 4. Tab Views Content */}
      {visibleLoading ? (
        <LogoLoader
          variant="section"
          message="Loading team activity"
          hint="Aggregating rep visits, check-ins, and daily schedules"
        />
      ) : (
        <>
          {activeTab === "activity" && (
            <TabActivitySummary
              activities={activities}
              onSelectActivity={(act) => setSelectedActivity(act)}
            />
          )}

          {activeTab === "daily" && (
            <TabDailyActivity dailySummaries={dailySummaries} />
          )}

          {activeTab === "comparison" && (
            <TabTeamComparison teamMembers={teamMembers} />
          )}

          {activeTab === "sales" && (
            <TabSalesSummary
              salesSummaries={salesSummaries}
              metrics={metrics}
            />
          )}
        </>
      )}

      {/* Detail Slideover Modal */}
      <ActivityDetailModal
        activity={selectedActivity}
        onClose={() => setSelectedActivity(null)}
      />
    </div>
  );
}
