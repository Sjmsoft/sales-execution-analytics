import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { getSales, updateSale, deleteSale, type Sale } from "../services/salesService";
import { getOutlets } from "../services/referenceService";
import {
  getUserScope,
  filterSalesByScope,
  filterOutletsByScope,
  filterStaffByScope,
} from "../services/dataScopeService";
import { NewSaleDialog } from "./sales/NewSaleDialog";
import { TableSkeleton } from "../components/ui/Skeleton";
import { useMinimumLoading } from "../hooks/useMinimumLoading";
import "../sales-tracker.css";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Coins,
  Copy,
  CreditCard,
  DollarSign,
  Download,
  FileText,
  Flame,
  MapPin,
  Package,
  Pencil,
  PieChart,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingCart,
  Sparkles,
  Store,
  Trash2,
  TrendingUp,
  Trophy,
  User,
  Users,
  Wallet,
  X,
} from "lucide-react";

function getUnitLabel(unitType: number | null) {
  return unitType === 2 ? "Cases" : "Bottles";
}

function getPaymentStatusLabel(status: number | null) {
  if (status === 2) return "Paid";
  if (status === 1) return "Partially Paid";
  return "Credit (Unpaid)";
}

function getPeriodDateRange(periodKey: string): { start: string; end: string } {
  const now = new Date();
  const formatYmd = (d: Date) => d.toISOString().split("T")[0];

  switch (periodKey) {
    case "today": {
      const todayStr = formatYmd(now);
      return { start: todayStr, end: todayStr };
    }
    case "yesterday": {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = formatYmd(yesterday);
      return { start: yStr, end: yStr };
    }
    case "this_week": {
      const day = now.getDay();
      const diffToMonday = (day === 0 ? -6 : 1) - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMonday);
      return { start: formatYmd(monday), end: formatYmd(now) };
    }
    case "last_week": {
      const day = now.getDay();
      const diffToMonday = (day === 0 ? -6 : 1) - day - 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { start: formatYmd(monday), end: formatYmd(sunday) };
    }
    case "this_month": {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: formatYmd(firstDay), end: formatYmd(now) };
    }
    case "last_month": {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: formatYmd(firstDay), end: formatYmd(lastDay) };
    }
    case "this_quarter": {
      const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
      const firstDay = new Date(now.getFullYear(), quarterMonth, 1);
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

export default function Sales() {
  const { staff, role } = useAuth();
  const userScope = useMemo(() => getUserScope(staff, role), [staff, role]);

  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const visibleLoading = useMinimumLoading(loading, 800);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Reference lists for filter options
  const [outletsList, setOutletsList] = useState<
    { id: string; name: string; region_id?: string | null; state?: string | null }[]
  >([]);
  const [staffList, setStaffList] = useState<
    { id: string; name: string; role_key?: string; role_name?: string; region?: string }[]
  >([]);

  // View mode switcher: Complete Overview | Visual Tracker & Charts | Transaction Ledger
  const [viewMode, setViewMode] = useState<"complete" | "tracker" | "ledger">("complete");

  // Chart state
  const [chartMetric, setChartMetric] = useState<"revenue" | "units">("revenue");
  const [hoveredTimelineBar, setHoveredTimelineBar] = useState<number | null>(null);

  // Filter state
  const [statusTab, setStatusTab] = useState<"all" | "paid" | "partial" | "unpaid">("all");
  const [outletFilter, setOutletFilter] = useState("all");
  const [repFilter, setRepFilter] = useState("all");
  const [staffFilter, setStaffFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Dialogs & Modals
  const [newSaleOpen, setNewSaleOpen] = useState(false);
  const [newSaleSuccess, setNewSaleSuccess] = useState("");
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<Sale | null>(null);
  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  // Admin role check (for edit/delete privileges)
  const isAdmin = useMemo(() => {
    const key = (role?.key || staff?.user_roles?.key || staff?.assigned_role || "").toLowerCase();
    return (
      key === "administrator" ||
      key === "admin" ||
      role?.hierarchy_level === 1
    );
  }, [role, staff]);

  // Edit Sale modal state (Admin only)
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editFormData, setEditFormData] = useState({
    saleDate: "",
    outlet: "",
    drinkType: "",
    quantity: 1,
    unitType: 1,
    totalAmount: 0,
    amountPaid: 0,
    notes: "",
  });

  const handleOpenEditSale = (sale: Sale) => {
    if (!isAdmin) {
      alert("Only administrators can edit sales.");
      return;
    }
    setEditingSale(sale);
    setEditFormData({
      saleDate: sale.sale_date || new Date().toISOString().split("T")[0],
      outlet: sale.outlet || "",
      drinkType: sale.drink_type || "",
      quantity: Number(sale.quantity || 1),
      unitType: sale.unit_type === 2 ? 2 : 1,
      totalAmount: Number(sale.total_amount || 0),
      amountPaid: Number(sale.amount_paid || 0),
      notes: sale.notes || "",
    });
  };

  const handleSaveEditSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !editingSale) return;
    setIsSubmittingEdit(true);
    try {
      const balance = Math.max(0, editFormData.totalAmount - editFormData.amountPaid);
      const paymentStatus =
        editFormData.amountPaid >= editFormData.totalAmount && editFormData.totalAmount > 0
          ? 2
          : editFormData.amountPaid > 0
          ? 1
          : 0;

      await updateSale(editingSale.id, {
        sale_date: editFormData.saleDate,
        outlet: editFormData.outlet,
        drink_type: editFormData.drinkType,
        quantity: editFormData.quantity,
        unit_type: editFormData.unitType,
        total_amount: editFormData.totalAmount,
        amount_paid: editFormData.amountPaid,
        balance,
        payment_status: paymentStatus,
        notes: editFormData.notes,
      });

      setSales((prev) =>
        prev.map((s) =>
          s.id === editingSale.id
            ? {
                ...s,
                sale_date: editFormData.saleDate,
                outlet: editFormData.outlet,
                drink_type: editFormData.drinkType,
                quantity: editFormData.quantity,
                unit_type: editFormData.unitType,
                total_amount: editFormData.totalAmount,
                amount_paid: editFormData.amountPaid,
                balance,
                payment_status: paymentStatus,
                notes: editFormData.notes,
              }
            : s
        )
      );

      setEditingSale(null);
    } catch (err) {
      console.error("Failed to update sale:", err);
      alert("Failed to update sale.");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleDeleteSale = async (sale: Sale) => {
    if (!isAdmin) {
      alert("Only administrators can delete sales.");
      return;
    }
    const ref = sale.reference || sale.transaction_id || sale.id;
    if (
      !window.confirm(
        `Are you sure you want to delete this sale transaction (Ref: ${ref})? This action cannot be undone.`
      )
    ) {
      return;
    }
    try {
      await deleteSale(sale.id);
      setSales((prev) => prev.filter((s) => s.id !== sale.id));
      if (selectedSaleDetail?.id === sale.id) {
        setSelectedSaleDetail(null);
      }
    } catch (err) {
      console.error("Failed to delete sale:", err);
      alert("Failed to delete sale.");
    }
  };

  // Load reference data
  useEffect(() => {
    void getOutlets()
      .then((data) => {
        const scopedOutlets = filterOutletsByScope(data, userScope);
        setOutletsList(
          scopedOutlets.map((o) => ({
            id: o.id,
            name: o.name,
            region_id: o.region_id,
            state: o.state,
          }))
        );
      })
      .catch((err) => {
        console.warn("Could not load outlets reference for filters:", err);
      });

    void supabase
      .from("staff")
      .select("id, name, region, assigned_regions, assigned_role, user_roles ( key, name )")
      .order("name")
      .then(({ data, error }) => {
        if (!error && data) {
          const scopedStaffList = filterStaffByScope(data as any[], userScope);
          setStaffList(
            scopedStaffList.map((s: any) => {
              const roleRel = s.user_roles
                ? Array.isArray(s.user_roles)
                  ? s.user_roles[0]
                  : s.user_roles
                : null;
              return {
                id: s.id,
                name: s.name,
                role_key: (roleRel?.key ?? s.assigned_role ?? "").toLowerCase(),
                role_name: roleRel?.name ?? s.assigned_role,
                region: s.region,
              };
            })
          );
        }
      });
  }, [userScope]);

  // Main loader
  const loadSales = useCallback(
    async (isManual = false) => {
      try {
        if (isManual) setRefreshing(true);
        else setLoading(true);
        setError("");

        const data = await getSales(startDate || undefined, endDate || undefined);
        const scoped = filterSalesByScope((data as Sale[]) || [], userScope);
        setSales(scoped);
      } catch (err: unknown) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Unable to load sales ledger.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [startDate, endDate, userScope]
  );

  // Auto-subscribe to changes and periodic sync
  useEffect(() => {
    void loadSales(false);

    const channel = supabase
      .channel("sales-live-ledger-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () =>
        void loadSales(true)
      )
      .subscribe();

    const refreshInterval = window.setInterval(() => void loadSales(true), 35_000);

    return () => {
      window.clearInterval(refreshInterval);
      void supabase.removeChannel(channel);
    };
  }, [startDate, endDate]);

  // Derived options for dropdown filters
  const outletsOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    outletsList.forEach((o) => {
      if (o.id && o.name) map.set(o.id, { id: o.id, name: o.name });
    });
    sales.forEach((s) => {
      if (s.outlet_id && s.outlet && !map.has(s.outlet_id)) {
        map.set(s.outlet_id, { id: s.outlet_id, name: s.outlet });
      } else if (s.outlet && !s.outlet_id && !map.has(s.outlet)) {
        map.set(s.outlet, { id: s.outlet, name: s.outlet });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [outletsList, sales]);

  const repsOptions = useMemo(() => {
    const repRoleKeys = new Set(["brand_ambassador", "vsr", "sales_executive"]);
    const map = new Map<string, { id: string; name: string; role_name?: string }>();

    staffList.forEach((s) => {
      if (repRoleKeys.has(s.role_key || "")) {
        map.set(s.id, { id: s.id, name: s.name, role_name: s.role_name });
      }
    });

    sales.forEach((s) => {
      if (
        s.staff_role &&
        repRoleKeys.has(s.staff_role.toLowerCase()) &&
        s.staff_id &&
        s.staff &&
        !map.has(s.staff_id)
      ) {
        map.set(s.staff_id, { id: s.staff_id, name: s.staff, role_name: s.staff_role });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [staffList, sales]);

  const regionOptions = useMemo(() => {
    const set = new Set<string>();
    outletsList.forEach((o) => {
      if (o.region_id) set.add(o.region_id);
      if (o.state) set.add(o.state);
    });
    staffList.forEach((s) => {
      if (s.region) set.add(s.region);
    });
    sales.forEach((s) => {
      if (s.outlet_region) set.add(s.outlet_region);
      if (s.staff_region) set.add(s.staff_region);
      if (s.outlet_state) set.add(s.outlet_state);
    });
    return Array.from(set).filter(Boolean).sort();
  }, [outletsList, staffList, sales]);

  // Handle period change
  function handlePeriodChange(newPeriod: string) {
    setPeriodFilter(newPeriod);
    if (newPeriod === "all") {
      setStartDate("");
      setEndDate("");
    } else {
      const bounds = getPeriodDateRange(newPeriod);
      setStartDate(bounds.start);
      setEndDate(bounds.end);
    }
  }

  // Clear all filters
  function handleClearFilters() {
    setStatusTab("all");
    setOutletFilter("all");
    setRepFilter("all");
    setStaffFilter("all");
    setPeriodFilter("all");
    setRegionFilter("all");
    setStartDate("");
    setEndDate("");
    setSearch("");
    setCurrentPage(1);
  }

  // Active filter count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (statusTab !== "all") count++;
    if (outletFilter !== "all") count++;
    if (repFilter !== "all") count++;
    if (staffFilter !== "all") count++;
    if (periodFilter !== "all") count++;
    if (regionFilter !== "all") count++;
    if (startDate || endDate) count++;
    if (search.trim()) count++;
    return count;
  }, [statusTab, outletFilter, repFilter, staffFilter, periodFilter, regionFilter, startDate, endDate, search]);

  // Filtering engine
  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      // 1. Status Tab Filter
      if (statusTab !== "all") {
        const total = Number(sale.total_amount ?? 0);
        const paid = Number(sale.amount_paid ?? 0);
        const bal = Number(sale.balance ?? total - paid);
        const isPaid = paid >= total || bal <= 0;
        const isPartial = paid > 0 && bal > 0;

        if (statusTab === "paid" && !isPaid) return false;
        if (statusTab === "partial" && !isPartial) return false;
        if (statusTab === "unpaid" && (isPaid || isPartial)) return false;
      }

      // 2. Outlet
      if (outletFilter !== "all") {
        if (sale.outlet_id !== outletFilter && sale.outlet !== outletFilter) return false;
      }

      // 3. Rep
      if (repFilter !== "all") {
        if (sale.staff_id !== repFilter && sale.staff !== repFilter) return false;
      }

      // 4. Staff
      if (staffFilter !== "all") {
        if (sale.staff_id !== staffFilter && sale.staff !== staffFilter) return false;
      }

      // 5. Region
      if (regionFilter !== "all") {
        const matchReg =
          sale.outlet_region === regionFilter ||
          sale.staff_region === regionFilter ||
          sale.outlet_state === regionFilter;
        if (!matchReg) return false;
      }

      // 6. Date Range
      if (startDate && sale.sale_date && sale.sale_date < startDate) return false;
      if (endDate && sale.sale_date && sale.sale_date > endDate) return false;

      // 7. Search text
      if (search.trim()) {
        const query = search.toLowerCase();
        const haystack = [
          sale.id,
          sale.reference,
          sale.transaction_id,
          sale.staff,
          sale.outlet,
          sale.drink_type,
          sale.outlet_region,
          sale.staff_region,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [sales, statusTab, outletFilter, repFilter, staffFilter, regionFilter, startDate, endDate, search]);

  // Aggregate calculations for filtered set
  const totalGrossRevenue = useMemo(() => {
    return filteredSales.reduce((sum, s) => sum + Number(s.total_amount ?? 0), 0);
  }, [filteredSales]);

  const totalUnitsDistributed = useMemo(() => {
    return filteredSales.reduce((sum, s) => sum + Number(s.quantity ?? 0), 0);
  }, [filteredSales]);

  const casesCount = useMemo(() => {
    return filteredSales
      .filter((s) => s.unit_type === 2)
      .reduce((sum, s) => sum + Number(s.quantity ?? 0), 0);
  }, [filteredSales]);

  const bottlesCount = useMemo(() => {
    return filteredSales
      .filter((s) => s.unit_type !== 2)
      .reduce((sum, s) => sum + Number(s.quantity ?? 0), 0);
  }, [filteredSales]);

  const totalCashRealized = useMemo(() => {
    return filteredSales.reduce((sum, s) => sum + Number(s.amount_paid ?? 0), 0);
  }, [filteredSales]);

  const totalTradeReceivables = useMemo(() => {
    return filteredSales.reduce((sum, s) => sum + Number(s.balance ?? 0), 0);
  }, [filteredSales]);

  const overallCollectionRate = totalGrossRevenue > 0
    ? Math.min(100, Math.round((totalCashRealized / totalGrossRevenue) * 100))
    : 100;

  const averageOrderValue = filteredSales.length > 0
    ? Math.round(totalGrossRevenue / filteredSales.length)
    : 0;

  const averageUnitsPerOrder = filteredSales.length > 0
    ? Math.round((totalUnitsDistributed / filteredSales.length) * 10) / 10
    : 0;

  const uniqueActiveOutlets = useMemo(() => {
    return new Set(filteredSales.map((s) => s.outlet || s.outlet_id).filter(Boolean)).size;
  }, [filteredSales]);

  // Status breakdown counts
  const paidCount = useMemo(() => {
    return sales.filter((s) => Number(s.balance ?? 0) <= 0 || Number(s.amount_paid ?? 0) >= Number(s.total_amount ?? 0)).length;
  }, [sales]);

  const partialCount = useMemo(() => {
    return sales.filter((s) => Number(s.amount_paid ?? 0) > 0 && Number(s.balance ?? 0) > 0).length;
  }, [sales]);

  const unpaidCount = useMemo(() => {
    return sales.filter((s) => Number(s.amount_paid ?? 0) === 0 && Number(s.balance ?? 0) > 0).length;
  }, [sales]);

  // ── ADVANCED ANALYTICS COMPUTATIONS FOR CHARTS ──

  // 1. Timeline Velocity Data (Grouped chronologically by date)
  const timelineData = useMemo(() => {
    const map = new Map<
      string,
      {
        date: string;
        displayDate: string;
        revenue: number;
        units: number;
        paid: number;
        balance: number;
        count: number;
      }
    >();

    filteredSales.forEach((s) => {
      const rawDate = s.sale_date || (s.created_at ? s.created_at.split("T")[0] : "Recent");
      if (!map.has(rawDate)) {
        let display = rawDate;
        try {
          const d = new Date(rawDate);
          display = d.toLocaleDateString("en-NG", { month: "short", day: "numeric" });
        } catch {
          display = rawDate;
        }

        map.set(rawDate, {
          date: rawDate,
          displayDate: display,
          revenue: 0,
          units: 0,
          paid: 0,
          balance: 0,
          count: 0,
        });
      }

      const item = map.get(rawDate)!;
      item.revenue += Number(s.total_amount ?? 0);
      item.units += Number(s.quantity ?? 0);
      item.paid += Number(s.amount_paid ?? 0);
      item.balance += Number(s.balance ?? 0);
      item.count += 1;
    });

    const sorted = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
    return sorted.slice(-14); // Keep last 14 active days for sharp, clean timeline rendering
  }, [filteredSales]);

  // 2. Beverage Product Contribution Breakdown
  const productContribution = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        revenue: number;
        units: number;
        cases: number;
        bottles: number;
        count: number;
      }
    >();

    filteredSales.forEach((s) => {
      const name = s.drink_type || "Premium Beverage";
      if (!map.has(name)) {
        map.set(name, {
          name,
          revenue: 0,
          units: 0,
          cases: 0,
          bottles: 0,
          count: 0,
        });
      }
      const item = map.get(name)!;
      item.revenue += Number(s.total_amount ?? 0);
      item.units += Number(s.quantity ?? 0);
      if (s.unit_type === 2) item.cases += Number(s.quantity ?? 0);
      else item.bottles += Number(s.quantity ?? 0);
      item.count += 1;
    });

    const sorted = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
    const totalRev = totalGrossRevenue || 1;

    return sorted.map((p, idx) => ({
      ...p,
      sharePct: Math.round((p.revenue / totalRev) * 100),
      rank: idx + 1,
    }));
  }, [filteredSales, totalGrossRevenue]);

  // 3. Payment Settlement Donut Breakdown
  const paymentSettlementMix = useMemo(() => {
    let cashTotal = 0;
    let transferTotal = 0;
    let posTotal = 0;
    let creditTotal = 0;

    filteredSales.forEach((s) => {
      const paid = Number(s.amount_paid ?? 0);
      const bal = Number(s.balance ?? 0);
      const method = Number(s.payment_method ?? 1);

      if (method === 1) cashTotal += paid;
      else if (method === 2) transferTotal += paid;
      else if (method === 3) posTotal += paid;
      else cashTotal += paid;

      creditTotal += bal;
    });

    const gross = totalGrossRevenue || 1;
    return [
      { label: "Cash on Delivery", amount: cashTotal, pct: Math.round((cashTotal / gross) * 100), color: "#10b981", icon: DollarSign },
      { label: "Bank Transfer", amount: transferTotal, pct: Math.round((transferTotal / gross) * 100), color: "#0284c7", icon: CreditCard },
      { label: "POS Terminal", amount: posTotal, pct: Math.round((posTotal / gross) * 100), color: "#8b5cf6", icon: Wallet },
      { label: "Credit Receivables", amount: creditTotal, pct: Math.round((creditTotal / gross) * 100), color: "#f59e0b", icon: AlertCircle },
    ];
  }, [filteredSales, totalGrossRevenue]);

  // 4. Regional Territory Sales Distribution
  const regionalDistribution = useMemo(() => {
    const map = new Map<
      string,
      {
        region: string;
        revenue: number;
        units: number;
        outlets: Set<string>;
      }
    >();

    filteredSales.forEach((s) => {
      const reg = s.outlet_region || s.staff_region || s.outlet_state || "National Direct";
      if (!map.has(reg)) {
        map.set(reg, {
          region: reg,
          revenue: 0,
          units: 0,
          outlets: new Set(),
        });
      }
      const item = map.get(reg)!;
      item.revenue += Number(s.total_amount ?? 0);
      item.units += Number(s.quantity ?? 0);
      const outKey = s.outlet || s.outlet_id;
      if (outKey) item.outlets.add(outKey);
    });

    const totalRev = totalGrossRevenue || 1;
    return Array.from(map.values())
      .map((r) => ({
        region: r.region,
        revenue: r.revenue,
        units: r.units,
        outletsCount: r.outlets.size,
        sharePct: Math.round((r.revenue / totalRev) * 100),
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales, totalGrossRevenue]);

  // 5. Sales Representatives Execution Leaderboard
  const repLeaderboard = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        role: string;
        revenue: number;
        units: number;
        paid: number;
        count: number;
      }
    >();

    filteredSales.forEach((s) => {
      const repName = s.staff || "Direct Sales Rep";
      if (!map.has(repName)) {
        map.set(repName, {
          name: repName,
          role: s.staff_role || "Representative",
          revenue: 0,
          units: 0,
          paid: 0,
          count: 0,
        });
      }
      const item = map.get(repName)!;
      item.revenue += Number(s.total_amount ?? 0);
      item.units += Number(s.quantity ?? 0);
      item.paid += Number(s.amount_paid ?? 0);
      item.count += 1;
    });

    return Array.from(map.values())
      .map((r, idx) => ({
        ...r,
        collectionRate: r.revenue > 0 ? Math.round((r.paid / r.revenue) * 100) : 100,
        rank: idx + 1,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);
  }, [filteredSales]);

  // Pagination calculations
  const totalSalesCount = filteredSales.length;
  const totalPages = Math.max(1, Math.ceil(totalSalesCount / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startRecord = totalSalesCount === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endRecord = Math.min(safeCurrentPage * pageSize, totalSalesCount);

  const paginatedSales = useMemo(() => {
    const from = (safeCurrentPage - 1) * pageSize;
    return filteredSales.slice(from, from + pageSize);
  }, [filteredSales, safeCurrentPage, pageSize]);

  // Copy reference ID handler
  const handleCopyReference = (refText: string) => {
    void navigator.clipboard.writeText(refText);
    setCopiedRef(refText);
    setTimeout(() => setCopiedRef(null), 2500);
  };

  // Export filtered CSV handler
  const handleExportCSV = () => {
    if (filteredSales.length === 0) return;

    const headers = [
      "Reference",
      "Transaction ID",
      "Sale Date",
      "Retail Outlet",
      "Region / Territory",
      "Beverage Product",
      "Unit Type",
      "Quantity",
      "Total Amount (NGN)",
      "Amount Paid (NGN)",
      "Balance Due (NGN)",
      "Payment Status",
      "Sales Representative",
    ];

    const rows = filteredSales.map((s) => [
      `"${s.reference || s.id}"`,
      `"${s.transaction_id || "-"}"`,
      `"${s.sale_date || s.created_at || "-"}"`,
      `"${(s.outlet || "Unknown").replace(/"/g, '""')}"`,
      `"${s.outlet_region || s.outlet_state || "National"}"`,
      `"${(s.drink_type || "Beverage").replace(/"/g, '""')}"`,
      `"${getUnitLabel(s.unit_type)}"`,
      s.quantity ?? 0,
      s.total_amount ?? 0,
      s.amount_paid ?? 0,
      s.balance ?? 0,
      `"${getPaymentStatusLabel(s.payment_status)}"`,
      `"${(s.staff || "Rep").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `penedge_sales_tracker_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (value: string | null) => {
    if (!value) return "-";
    try {
      return new Date(value).toLocaleDateString("en-NG", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return value;
    }
  };

  // Compute SVG max dimensions for timeline chart
  const maxTimelineMetric = useMemo(() => {
    if (timelineData.length === 0) return 100;
    const maxVal = Math.max(
      ...timelineData.map((d) => (chartMetric === "revenue" ? d.revenue : d.units))
    );
    return maxVal > 0 ? maxVal : 100;
  }, [timelineData, chartMetric]);

  return (
    <div className="page sales-ledger-page">
      {/* ── 1. Modern Command Header & Mode Switcher ── */}
      <div className="sales-command-header">
        <div className="sales-title-block">
          <div className="sales-title-icon">
            <BarChart3 size={24} />
          </div>
          <div>
            <div className="sales-title-row">
              <h2>Sales Execution & Commercial Tracker</h2>
              <span className="live-ledger-pill">
                <span className="live-pulse-dot" />
                {sales.length} Invoices Synchronized
              </span>
            </div>
            <p className="sales-subtitle">
              Live commercial performance analytics, beverage volume velocity, retailer settlements & ledger audit
            </p>
          </div>
        </div>

        <div className="sales-header-actions">
          {/* View Mode Switcher Pills */}
          <div className="view-mode-pill-group">
            <button
              type="button"
              className={`view-mode-btn ${viewMode === "complete" ? "mode-active" : ""}`}
              onClick={() => setViewMode("complete")}
              title="View full charts and transaction ledger"
            >
              <Sparkles size={13} />
              <span>Complete View</span>
            </button>
            <button
              type="button"
              className={`view-mode-btn ${viewMode === "tracker" ? "mode-active" : ""}`}
              onClick={() => setViewMode("tracker")}
              title="Focus on KPI summaries and visual charts"
            >
              <BarChart3 size={13} />
              <span>KPI Charts</span>
            </button>
            <button
              type="button"
              className={`view-mode-btn ${viewMode === "ledger" ? "mode-active" : ""}`}
              onClick={() => setViewMode("ledger")}
              title="Focus on granular transactions ledger"
            >
              <FileText size={13} />
              <span>Transactions</span>
            </button>
          </div>

          <button
            type="button"
            className="sales-action-btn export-btn"
            onClick={handleExportCSV}
            disabled={filteredSales.length === 0}
            title="Export filtered records to CSV spreadsheet"
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            className={`sales-action-btn refresh-btn ${refreshing ? "spinning" : ""}`}
            onClick={() => void loadSales(true)}
            title="Reload live ledger"
            aria-label="Refresh sales records"
          >
            <RefreshCw size={15} />
          </button>

          <button
            type="button"
            className="sales-action-btn primary-new-sale-btn"
            onClick={() => setNewSaleOpen(true)}
          >
            <Plus size={16} />
            <span>Record New Sale</span>
          </button>
        </div>
      </div>

      {newSaleSuccess && (
        <div className="sales-success-banner" role="status">
          <CheckCircle2 size={16} />
          <span>{newSaleSuccess}</span>
          <button type="button" onClick={() => setNewSaleSuccess("")} className="banner-close-btn">
            <X size={14} />
          </button>
        </div>
      )}

      {error && (
        <div className="sales-error-banner" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button type="button" onClick={() => void loadSales(true)} className="banner-retry-btn">
            Retry
          </button>
        </div>
      )}

      {/* ── 2. Strategic Sales KPI Health Deck (6 Strategic Metrics) ── */}
      <div className="sales-tracker-kpi-grid">
        {/* KPI 1: Gross Revenue */}
        <div className="tracker-kpi-card card-revenue">
          <div className="kpi-top">
            <span className="kpi-label">Gross Revenue Turnover</span>
            <div className="kpi-icon-pill icon-revenue">
              <DollarSign size={16} />
            </div>
          </div>
          <strong className="kpi-value">{formatCurrency(totalGrossRevenue)}</strong>
          <div className="kpi-footer">
            <span className="kpi-sub-text">{filteredSales.length} Total Transactions</span>
            <span className="kpi-chip chip-success">Avg {formatCurrency(averageOrderValue)}</span>
          </div>
        </div>

        {/* KPI 2: Volume Flow & Units Breakdown */}
        <div className="tracker-kpi-card card-volume">
          <div className="kpi-top">
            <span className="kpi-label">Volume Distributed</span>
            <div className="kpi-icon-pill icon-volume">
              <Package size={16} />
            </div>
          </div>
          <strong className="kpi-value">{totalUnitsDistributed.toLocaleString()} Units</strong>
          <div className="kpi-footer">
            <span className="kpi-sub-text">
              {casesCount.toLocaleString()} Cases · {bottlesCount.toLocaleString()} Bottles
            </span>
            <span className="kpi-chip chip-info">{averageUnitsPerOrder} / Order</span>
          </div>
        </div>

        {/* KPI 3: Cash Realized */}
        <div className="tracker-kpi-card card-cash">
          <div className="kpi-top">
            <span className="kpi-label">Liquid Cash Collected</span>
            <div className="kpi-icon-pill icon-cash">
              <CreditCard size={16} />
            </div>
          </div>
          <strong className="kpi-value">{formatCurrency(totalCashRealized)}</strong>
          <div className="kpi-footer">
            <div className="kpi-progress-wrap">
              <div className="kpi-progress-bar" style={{ width: `${overallCollectionRate}%` }} />
            </div>
            <span className="kpi-chip chip-success">{overallCollectionRate}% Efficiency</span>
          </div>
        </div>

        {/* KPI 4: Trade Receivables */}
        <div className="tracker-kpi-card card-credit">
          <div className="kpi-top">
            <span className="kpi-label">Trade Credit Receivables</span>
            <div className="kpi-icon-pill icon-credit">
              <AlertCircle size={16} />
            </div>
          </div>
          <strong className="kpi-value">{formatCurrency(totalTradeReceivables)}</strong>
          <div className="kpi-footer">
            <span className="kpi-sub-text">{unpaidCount + partialCount} Pending Stores</span>
            <span className={`kpi-chip ${totalTradeReceivables > 0 ? "chip-warning" : "chip-success"}`}>
              {totalTradeReceivables > 0 ? "Credit Exposure" : "Zero Debt"}
            </span>
          </div>
        </div>

        {/* KPI 5: Active Retail Network */}
        <div className="tracker-kpi-card card-outlets">
          <div className="kpi-top">
            <span className="kpi-label">Active Buying Outlets</span>
            <div className="kpi-icon-pill icon-outlets">
              <Store size={16} />
            </div>
          </div>
          <strong className="kpi-value">{uniqueActiveOutlets} Stores</strong>
          <div className="kpi-footer">
            <span className="kpi-sub-text">Across registered trade routes</span>
            <span className="kpi-chip chip-brand">
              {uniqueActiveOutlets > 0 && filteredSales.length > 0
                ? `${(filteredSales.length / uniqueActiveOutlets).toFixed(1)} Orders/Store`
                : "1.0 Orders/Store"}
            </span>
          </div>
        </div>

        {/* KPI 6: Sales Velocity & Rep Attainment */}
        <div className="tracker-kpi-card card-velocity">
          <div className="kpi-top">
            <span className="kpi-label">Commercial Velocity</span>
            <div className="kpi-icon-pill icon-velocity">
              <Flame size={16} />
            </div>
          </div>
          <strong className="kpi-value">
            {timelineData.length > 0
              ? `${Math.round(totalGrossRevenue / Math.max(1, timelineData.length) / 1000)}k / Day`
              : `${Math.round(totalGrossRevenue / 1000)}k Total`}
          </strong>
          <div className="kpi-footer">
            <span className="kpi-sub-text">{repLeaderboard.length} Active Field Agents</span>
            <span className="kpi-chip chip-success">Top Run-Rate</span>
          </div>
        </div>
      </div>

      {/* ── 3. VISUAL CHARTS & ANALYTICS SUITE (Rendered in 'complete' and 'tracker' views) ── */}
      {viewMode !== "ledger" && (
        <div className="sales-charts-suite">
          {/* Top Charts Row: Timeline Velocity + Payment Donut */}
          <div className="charts-main-grid">
            {/* Chart 1: Sales Velocity & Revenue Timeline (Interactive SVG) */}
            <div className="sales-chart-card timeline-chart-card">
              <div className="chart-card-header">
                <div className="chart-title-wrap">
                  <div className="chart-icon-box">
                    <TrendingUp size={16} />
                  </div>
                  <div>
                    <h3 className="chart-title">Commercial Velocity & Run-Rate Timeline</h3>
                    <span className="chart-subtitle">
                      Daily temporal distribution of revenue and volume flow across posting periods
                    </span>
                  </div>
                </div>

                <div className="chart-controls-group">
                  <div className="chart-metric-toggle">
                    <button
                      type="button"
                      className={`metric-toggle-btn ${chartMetric === "revenue" ? "active" : ""}`}
                      onClick={() => setChartMetric("revenue")}
                    >
                      Revenue (₦)
                    </button>
                    <button
                      type="button"
                      className={`metric-toggle-btn ${chartMetric === "units" ? "active" : ""}`}
                      onClick={() => setChartMetric("units")}
                    >
                      Units
                    </button>
                  </div>
                </div>
              </div>

              <div className="chart-card-body">
                {timelineData.length === 0 ? (
                  <div className="chart-empty-state">
                    <Activity size={32} />
                    <p>No sales activity recorded in the selected period.</p>
                  </div>
                ) : (
                  <div className="timeline-svg-container">
                    <svg viewBox="0 0 760 220" className="timeline-svg" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="salesBarGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#075544" stopOpacity="0.95" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0.65" />
                        </linearGradient>
                        <linearGradient id="salesAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Horizontal Grid lines */}
                      <line x1="40" y1="20" x2="740" y2="20" stroke="#f1f5f9" strokeDasharray="3 3" />
                      <line x1="40" y1="70" x2="740" y2="70" stroke="#f1f5f9" strokeDasharray="3 3" />
                      <line x1="40" y1="120" x2="740" y2="120" stroke="#f1f5f9" strokeDasharray="3 3" />
                      <line x1="40" y1="170" x2="740" y2="170" stroke="#e2e8f0" />

                      {/* Y-Axis Labels */}
                      <text x="35" y="24" textAnchor="end" className="chart-axis-label">
                        {chartMetric === "revenue"
                          ? `₦${(maxTimelineMetric / 1000).toFixed(0)}k`
                          : maxTimelineMetric}
                      </text>
                      <text x="35" y="99" textAnchor="end" className="chart-axis-label">
                        {chartMetric === "revenue"
                          ? `₦${(maxTimelineMetric / 2000).toFixed(0)}k`
                          : Math.round(maxTimelineMetric / 2)}
                      </text>
                      <text x="35" y="174" textAnchor="end" className="chart-axis-label">
                        0
                      </text>

                      {/* Timeline Bars */}
                      {timelineData.map((d, i) => {
                        const count = timelineData.length;
                        const slotWidth = (700 - 40) / Math.max(1, count);
                        const x = 50 + i * slotWidth;
                        const barWidth = Math.max(14, slotWidth * 0.55);
                        const val = chartMetric === "revenue" ? d.revenue : d.units;
                        const height = Math.max(6, (val / maxTimelineMetric) * 145);
                        const y = 170 - height;
                        const isHovered = hoveredTimelineBar === i;

                        return (
                          <g
                            key={d.date}
                            className="timeline-bar-group"
                            onMouseEnter={() => setHoveredTimelineBar(i)}
                            onMouseLeave={() => setHoveredTimelineBar(null)}
                          >
                            <rect
                              x={x}
                              y={y}
                              width={barWidth}
                              height={height}
                              rx="4"
                              ry="4"
                              fill="url(#salesBarGrad)"
                              className={`svg-bar-rect ${isHovered ? "bar-hovered" : ""}`}
                            />
                            {/* X-axis date text */}
                            <text
                              x={x + barWidth / 2}
                              y="192"
                              textAnchor="middle"
                              className="chart-axis-date"
                            >
                              {d.displayDate}
                            </text>
                          </g>
                        );
                      })}
                    </svg>

                    {/* Interactive Floating Hover Card */}
                    {hoveredTimelineBar !== null && timelineData[hoveredTimelineBar] && (
                      <div className="timeline-tooltip-card">
                        <div className="tooltip-date">
                          📅 {timelineData[hoveredTimelineBar].displayDate}
                        </div>
                        <div className="tooltip-row">
                          <span>Gross Turnover:</span>
                          <strong>{formatCurrency(timelineData[hoveredTimelineBar].revenue)}</strong>
                        </div>
                        <div className="tooltip-row">
                          <span>Volume Flow:</span>
                          <strong>{timelineData[hoveredTimelineBar].units.toLocaleString()} Units</strong>
                        </div>
                        <div className="tooltip-row">
                          <span>Transactions:</span>
                          <strong>{timelineData[hoveredTimelineBar].count} Invoices</strong>
                        </div>
                        <div className="tooltip-row">
                          <span>Cash Settled:</span>
                          <span style={{ color: "#10b981", fontWeight: 700 }}>
                            {formatCurrency(timelineData[hoveredTimelineBar].paid)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Chart 2: Payment Settlement & Liquidity Mix (Donut & Proportions) */}
            <div className="sales-chart-card payment-donut-card">
              <div className="chart-card-header">
                <div className="chart-title-wrap">
                  <div className="chart-icon-box">
                    <PieChart size={16} />
                  </div>
                  <div>
                    <h3 className="chart-title">Payment Settlement Mix</h3>
                    <span className="chart-subtitle">Settlement liquidity vs trade receivables</span>
                  </div>
                </div>
              </div>

              <div className="chart-card-body payment-donut-body">
                <div className="donut-visual-wrap">
                  <svg viewBox="0 0 160 160" className="donut-svg">
                    <circle
                      cx="80"
                      cy="80"
                      r="60"
                      fill="none"
                      stroke="#f1f5f9"
                      strokeWidth="18"
                    />
                    {(() => {
                      const total = totalGrossRevenue || 1;
                      let accumulatedPct = 0;
                      const circumference = 2 * Math.PI * 60; // 376.99

                      return paymentSettlementMix.map((seg) => {
                        const pct = Math.max(0, seg.amount / total);
                        const strokeLength = pct * circumference;
                        const strokeOffset = -(accumulatedPct * circumference);
                        accumulatedPct += pct;

                        return (
                          <circle
                            key={seg.label}
                            cx="80"
                            cy="80"
                            r="60"
                            fill="none"
                            stroke={seg.color}
                            strokeWidth="18"
                            strokeDasharray={`${strokeLength} ${circumference - strokeLength}`}
                            strokeDashoffset={strokeOffset}
                            transform="rotate(-90 80 80)"
                            style={{ transition: "all 0.6s ease" }}
                          />
                        );
                      });
                    })()}
                  </svg>
                  <div className="donut-center-info">
                    <strong className="donut-center-value">{overallCollectionRate}%</strong>
                    <span className="donut-center-sub">Collected</span>
                  </div>
                </div>

                <div className="donut-legend-list">
                  {paymentSettlementMix.map((item) => (
                    <div className="donut-legend-item" key={item.label}>
                      <div className="legend-item-left">
                        <span className="legend-dot" style={{ background: item.color }} />
                        <span className="legend-label">{item.label}</span>
                      </div>
                      <div className="legend-item-right">
                        <strong className="legend-amount">{formatCurrency(item.amount)}</strong>
                        <span className="legend-pct">({item.pct}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Analytics Grid (3 Columns: Product Matrix, Territory Distribution, Rep Leaderboard) */}
          <div className="charts-secondary-grid">
            {/* Chart 3: Top Beverage Brand Contribution Matrix */}
            <div className="sales-chart-card product-matrix-card">
              <div className="chart-card-header">
                <div className="chart-title-wrap">
                  <div className="chart-icon-box">
                    <Package size={16} />
                  </div>
                  <div>
                    <h3 className="chart-title">Beverage Brand Contribution</h3>
                    <span className="chart-subtitle">Ranked volume velocity & revenue turnover</span>
                  </div>
                </div>
              </div>

              <div className="chart-card-body">
                {productContribution.length === 0 ? (
                  <div className="chart-empty-state">
                    <Package size={28} />
                    <p>No beverage sales data available.</p>
                  </div>
                ) : (
                  <div className="product-rank-list">
                    {productContribution.slice(0, 5).map((prod) => (
                      <div className="product-rank-item" key={prod.name}>
                        <div className="prod-rank-header">
                          <div className="prod-rank-title">
                            <span className="rank-num">#{prod.rank}</span>
                            <strong>{prod.name}</strong>
                          </div>
                          <div className="prod-rank-values">
                            <strong>{formatCurrency(prod.revenue)}</strong>
                            <span className="prod-share-badge">{prod.sharePct}% Share</span>
                          </div>
                        </div>

                        <div className="prod-progress-track">
                          <div
                            className="prod-progress-fill"
                            style={{
                              width: `${Math.max(8, prod.sharePct)}%`,
                              background:
                                prod.rank === 1
                                  ? "#075544"
                                  : prod.rank === 2
                                  ? "#0284c7"
                                  : prod.rank === 3
                                  ? "#10b981"
                                  : "#64748b",
                            }}
                          />
                        </div>

                        <div className="prod-meta-footer">
                          <span>{prod.units.toLocaleString()} Total Units</span>
                          <span>
                            {prod.cases > 0 && `${prod.cases} Cases`}
                            {prod.cases > 0 && prod.bottles > 0 && " · "}
                            {prod.bottles > 0 && `${prod.bottles} Bottles`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Chart 4: Regional Territory Sales Distribution */}
            <div className="sales-chart-card territory-matrix-card">
              <div className="chart-card-header">
                <div className="chart-title-wrap">
                  <div className="chart-icon-box">
                    <MapPin size={16} />
                  </div>
                  <div>
                    <h3 className="chart-title">Regional Footprint & Density</h3>
                    <span className="chart-subtitle">Territory revenue distribution & outlet depth</span>
                  </div>
                </div>
              </div>

              <div className="chart-card-body">
                {regionalDistribution.length === 0 ? (
                  <div className="chart-empty-state">
                    <MapPin size={28} />
                    <p>No regional transaction data available.</p>
                  </div>
                ) : (
                  <div className="territory-rank-list">
                    {regionalDistribution.slice(0, 5).map((reg, idx) => (
                      <div className="territory-rank-item" key={reg.region}>
                        <div className="territory-item-top">
                          <div className="territory-name-wrap">
                            <span className="territory-dot" />
                            <strong>{reg.region}</strong>
                          </div>
                          <div className="territory-amount-wrap">
                            <strong>{formatCurrency(reg.revenue)}</strong>
                            <span className="territory-share">{reg.sharePct}%</span>
                          </div>
                        </div>

                        <div className="territory-bar-track">
                          <div
                            className="territory-bar-fill"
                            style={{
                              width: `${Math.max(10, reg.sharePct)}%`,
                              background: idx === 0 ? "#075544" : "#0d9488",
                            }}
                          />
                        </div>

                        <div className="territory-item-footer">
                          <span>📍 {reg.outletsCount} Purchasing Stores</span>
                          <span>📦 {reg.units.toLocaleString()} Units</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Chart 5: Top Sales Reps Leaderboard */}
            <div className="sales-chart-card rep-leaderboard-card">
              <div className="chart-card-header">
                <div className="chart-title-wrap">
                  <div className="chart-icon-box">
                    <Trophy size={16} />
                  </div>
                  <div>
                    <h3 className="chart-title">Top Sales Rep Leaderboard</h3>
                    <span className="chart-subtitle">Field execution velocity & collection rate</span>
                  </div>
                </div>
              </div>

              <div className="chart-card-body">
                {repLeaderboard.length === 0 ? (
                  <div className="chart-empty-state">
                    <Users size={28} />
                    <p>No sales rep performance records found.</p>
                  </div>
                ) : (
                  <div className="rep-leaderboard-list">
                    {repLeaderboard.map((rep) => (
                      <div className="rep-leader-item" key={rep.name}>
                        <div className="rep-rank-medal">
                          {rep.rank === 1 ? "🥇" : rep.rank === 2 ? "🥈" : rep.rank === 3 ? "🥉" : `#${rep.rank}`}
                        </div>

                        <div className="rep-info-col">
                          <strong className="rep-name">{rep.name}</strong>
                          <span className="rep-role-tag">{rep.role} · {rep.count} Deals</span>
                        </div>

                        <div className="rep-figures-col">
                          <strong className="rep-rev-val">{formatCurrency(rep.revenue)}</strong>
                          <span
                            className={`rep-collect-chip ${
                              rep.collectionRate >= 90
                                ? "chip-green"
                                : rep.collectionRate >= 70
                                ? "chip-blue"
                                : "chip-amber"
                            }`}
                          >
                            {rep.collectionRate}% Paid
                          </span>
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

      {/* ── 4. MODERN SALES INTELLIGENCE & FILTER SUITE ── */}
      <div className="sales-filter-suite-pro">
        {/* Status Filter Tabs */}
        <div className="sales-status-tabs-row">
          <div className="status-tabs-group">
            <button
              type="button"
              className={`status-tab-btn ${statusTab === "all" ? "tab-active" : ""}`}
              onClick={() => setStatusTab("all")}
            >
              <span>All Transactions</span>
              <span className="tab-count">{sales.length}</span>
            </button>
            <button
              type="button"
              className={`status-tab-btn ${statusTab === "paid" ? "tab-active" : ""}`}
              onClick={() => setStatusTab("paid")}
            >
              <CheckCircle2 size={13} className="tab-icon paid-color" />
              <span>Paid in Full</span>
              <span className="tab-count count-paid">{paidCount}</span>
            </button>
            <button
              type="button"
              className={`status-tab-btn ${statusTab === "partial" ? "tab-active" : ""}`}
              onClick={() => setStatusTab("partial")}
            >
              <Coins size={13} className="tab-icon partial-color" />
              <span>Partially Paid</span>
              <span className="tab-count count-partial">{partialCount}</span>
            </button>
            <button
              type="button"
              className={`status-tab-btn ${statusTab === "unpaid" ? "tab-active" : ""}`}
              onClick={() => setStatusTab("unpaid")}
            >
              <AlertCircle size={13} className="tab-icon unpaid-color" />
              <span>Credit / Unpaid</span>
              <span className="tab-count count-unpaid">{unpaidCount}</span>
            </button>
          </div>

          {activeFiltersCount > 0 && (
            <button
              type="button"
              className="clear-filters-link-btn"
              onClick={handleClearFilters}
            >
              <RotateCcw size={13} />
              <span>Clear All Filters ({activeFiltersCount})</span>
            </button>
          )}
        </div>

        {/* Multi-Parameter Search & Control Grid */}
        <div className="sales-filter-controls-grid">
          {/* Search Box */}
          <div className="filter-search-box">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              placeholder="Search outlet, beverage, rep, ref ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="search-clear-btn">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Period Presets */}
          <div className="filter-select-wrap">
            <Calendar size={14} className="select-icon" />
            <select
              value={periodFilter}
              onChange={(e) => handlePeriodChange(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Posting Periods</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="last_week">Last Week</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="this_quarter">This Quarter</option>
              <option value="this_year">This Year</option>
            </select>
            <ChevronDown size={13} className="select-chevron" />
          </div>

          {/* Outlet Selector */}
          <div className="filter-select-wrap">
            <Store size={14} className="select-icon" />
            <select
              value={outletFilter}
              onChange={(e) => setOutletFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Retail Outlets</option>
              {outletsOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <ChevronDown size={13} className="select-chevron" />
          </div>

          {/* Sales Rep Selector */}
          <div className="filter-select-wrap">
            <User size={14} className="select-icon" />
            <select
              value={repFilter}
              onChange={(e) => setRepFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Sales Reps</option>
              {repsOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.role_name ? `(${r.role_name})` : ""}
                </option>
              ))}
            </select>
            <ChevronDown size={13} className="select-chevron" />
          </div>

          {/* Territory / Region Selector */}
          <div className="filter-select-wrap">
            <MapPin size={14} className="select-icon" />
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Regions / States</option>
              {regionOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <ChevronDown size={13} className="select-chevron" />
          </div>
        </div>

        {/* Active Filter Chips */}
        {activeFiltersCount > 0 && (
          <div className="active-filter-chips-bar">
            <span className="chips-label">Active Filters:</span>
            {statusTab !== "all" && (
              <span className="filter-chip">
                Status: {statusTab}
                <button type="button" onClick={() => setStatusTab("all")}>×</button>
              </span>
            )}
            {periodFilter !== "all" && (
              <span className="filter-chip">
                Period: {periodFilter.replace("_", " ")}
                <button type="button" onClick={() => handlePeriodChange("all")}>×</button>
              </span>
            )}
            {outletFilter !== "all" && (
              <span className="filter-chip">
                Outlet: {outletsOptions.find((o) => o.id === outletFilter)?.name || outletFilter}
                <button type="button" onClick={() => setOutletFilter("all")}>×</button>
              </span>
            )}
            {repFilter !== "all" && (
              <span className="filter-chip">
                Rep: {repsOptions.find((r) => r.id === repFilter)?.name || repFilter}
                <button type="button" onClick={() => setRepFilter("all")}>×</button>
              </span>
            )}
            {regionFilter !== "all" && (
              <span className="filter-chip">
                Region: {regionFilter}
                <button type="button" onClick={() => setRegionFilter("all")}>×</button>
              </span>
            )}
            {search && (
              <span className="filter-chip">
                Query: "{search}"
                <button type="button" onClick={() => setSearch("")}>×</button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── 5. HIGH-DENSITY EXECUTIVE SALES LEDGER TABLE (Rendered in 'complete' and 'ledger' views) ── */}
      {viewMode !== "tracker" && (
        <div className="sales-table-card">
          <div className="table-header-indicator-bar">
            <div className="indicator-left">
              <FileText size={15} />
              <strong className="indicator-title">Itemized Commercial Transactions Ledger</strong>
              <span className="indicator-count">({filteredSales.length} Invoices)</span>
            </div>
            <span className="indicator-sum">
              Total Filtered Volume: <strong>{totalUnitsDistributed.toLocaleString()} Units</strong> ({formatCurrency(totalGrossRevenue)})
            </span>
          </div>

          {visibleLoading ? (
            <div style={{ padding: 24 }}>
              <TableSkeleton rows={8} cols={7} />
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="sales-empty-state">
              <ShoppingCart size={40} />
              <h4>No sales transactions matched your criteria</h4>
              <p>Try adjusting your search terms, changing the date range, or record a new transaction.</p>
              <button
                type="button"
                className="sales-action-btn primary-new-sale-btn"
                onClick={() => setNewSaleOpen(true)}
                style={{ marginTop: 8 }}
              >
                <Plus size={15} />
                <span>Record New Sale</span>
              </button>
            </div>
          ) : (
            <div className="table-responsive-container">
              <table className="sales-ledger-table">
                <thead>
                  <tr>
                    <th>Ref / TXN ID</th>
                    <th>Sale Date</th>
                    <th>Retail Outlet</th>
                    <th>Beverage Item</th>
                    <th>Sales Rep</th>
                    <th style={{ textAlign: "right" }}>Total Amount</th>
                    <th style={{ textAlign: "right" }}>Settlement</th>
                    <th>Payment Status</th>
                    <th style={{ textAlign: "center", width: isAdmin ? 175 : 90 }}>
                      {isAdmin ? "Actions" : "Receipt"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSales.map((sale) => {
                    const total = Number(sale.total_amount ?? 0);
                    const paid = Number(sale.amount_paid ?? 0);
                    const bal = Number(sale.balance ?? total - paid);
                    const isPaid = paid >= total || bal <= 0;
                    const isPartial = paid > 0 && bal > 0;
                    const refCode = sale.reference || sale.id.slice(0, 8).toUpperCase();

                    return (
                      <tr key={sale.id} className="ledger-table-row">
                        {/* Ref ID */}
                        <td>
                          <button
                            type="button"
                            className="ref-code-pill"
                            onClick={() => handleCopyReference(refCode)}
                            title="Click to copy Reference ID"
                          >
                            <span>{refCode}</span>
                            {copiedRef === refCode ? <Check size={11} /> : <Copy size={11} />}
                          </button>
                        </td>

                        {/* Date */}
                        <td>
                          <span className="cell-date-text">{formatDate(sale.sale_date || sale.created_at || null)}</span>
                        </td>

                        {/* Outlet */}
                        <td>
                          <div className="cell-outlet-wrap">
                            <Store size={14} className="cell-store-icon" />
                            <div>
                              <strong className="cell-store-name">{sale.outlet || "Direct Retail Store"}</strong>
                              {sale.outlet_region && (
                                <span className="cell-store-region">{sale.outlet_region}</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Product & Volume */}
                        <td>
                          <div className="cell-product-wrap">
                            <strong className="cell-drink-name">{sale.drink_type || "Beverage Product"}</strong>
                            <span className="cell-unit-tag">
                              {Number(sale.quantity ?? 0).toLocaleString()} {getUnitLabel(sale.unit_type)}
                            </span>
                          </div>
                        </td>

                        {/* Sales Rep */}
                        <td>
                          <div className="cell-rep-wrap">
                            <div className="cell-rep-avatar">
                              {sale.staff ? sale.staff.slice(0, 2).toUpperCase() : "SR"}
                            </div>
                            <div>
                              <span className="cell-rep-name">{sale.staff || "Sales Rep"}</span>
                              {sale.staff_role && (
                                <span className="cell-rep-role">{sale.staff_role}</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Total Amount */}
                        <td style={{ textAlign: "right" }}>
                          <strong className="cell-total-amount">{formatCurrency(total)}</strong>
                        </td>

                        {/* Settlement */}
                        <td style={{ textAlign: "right" }}>
                          <div className="cell-settle-wrap">
                            <span className="cell-paid-amount">Paid: {formatCurrency(paid)}</span>
                            {bal > 0 ? (
                              <span className="cell-bal-due">Due: {formatCurrency(bal)}</span>
                            ) : (
                              <span className="cell-bal-zero">₦0 Due</span>
                            )}
                          </div>
                        </td>

                        {/* Payment Status Badge */}
                        <td>
                          <span
                            className={`ledger-status-chip ${
                              isPaid
                                ? "status-chip-paid"
                                : isPartial
                                ? "status-chip-partial"
                                : "status-chip-credit"
                            }`}
                          >
                            {isPaid ? "Paid" : isPartial ? "Partial" : "Credit"}
                          </span>
                        </td>

                        {/* Action Buttons */}
                        <td style={{ textAlign: "center" }}>
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              justifyContent: "center",
                            }}
                          >
                            <button
                              type="button"
                              className="table-view-btn"
                              onClick={() => setSelectedSaleDetail(sale)}
                              title="View detailed receipt slip"
                            >
                              <FileText size={13} />
                              <span>Receipt</span>
                            </button>

                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleOpenEditSale(sale)}
                                style={{
                                  background: "#eff6ff",
                                  border: "1px solid #bfdbfe",
                                  color: "#1d4ed8",
                                  cursor: "pointer",
                                  padding: "4px 8px",
                                  borderRadius: 6,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 3,
                                  fontSize: 11,
                                  fontWeight: 600,
                                }}
                                title="Edit sale (Admin only)"
                              >
                                <Pencil size={11} />
                                <span>Edit</span>
                              </button>
                            )}

                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => void handleDeleteSale(sale)}
                                style={{
                                  background: "#fef2f2",
                                  border: "1px solid #fecaca",
                                  color: "#dc2626",
                                  cursor: "pointer",
                                  padding: "4px 6px",
                                  borderRadius: 6,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 3,
                                  fontSize: 11,
                                  fontWeight: 600,
                                }}
                                title="Delete sale (Admin only)"
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Table Footer & Smart Pagination Controls */}
          <div className="sales-table-footer">
            <div className="footer-left-info">
              <span className="showing-records-text">
                Showing <strong>{startRecord}</strong> to <strong>{endRecord}</strong> of{" "}
                <strong>{totalSalesCount}</strong> transactions
              </span>
              <span className="footer-aggregate-badge">
                Filtered Sum: <strong>{formatCurrency(totalGrossRevenue)}</strong> ({totalUnitsDistributed.toLocaleString()} Units)
              </span>
            </div>

            <div className="footer-right-controls">
              {/* Page Size Picker */}
              <div className="page-size-selector">
                <span>Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="page-size-select"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              {/* Pagination Buttons */}
              <div className="pagination-btn-group">
                <button
                  type="button"
                  className="pagination-arrow-btn"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safeCurrentPage <= 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>

                <span className="pagination-page-indicator">
                  Page <strong>{safeCurrentPage}</strong> of <strong>{totalPages}</strong>
                </span>

                <button
                  type="button"
                  className="pagination-arrow-btn"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage >= totalPages}
                  aria-label="Next page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 6. TRANSACTION INVOICE / RECEIPT MODAL DRAWER ── */}
      {selectedSaleDetail && (
        <div
          className="receipt-modal-backdrop"
          onClick={() => setSelectedSaleDetail(null)}
          role="presentation"
        >
          <div
            className="receipt-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="receipt-title"
          >
            <div className="receipt-header">
              <div className="receipt-brand">
                <div className="receipt-logo-mark">PE</div>
                <div>
                  <h3 id="receipt-title">Pen Edge Commercial Invoicing</h3>
                  <span>Official Sales Execution Receipt Slip</span>
                </div>
              </div>

              <button
                type="button"
                className="receipt-close-btn"
                onClick={() => setSelectedSaleDetail(null)}
                aria-label="Close receipt"
              >
                <X size={18} />
              </button>
            </div>

            <div className="receipt-body">
              {/* Receipt Reference Bar */}
              <div className="receipt-meta-grid">
                <div className="receipt-meta-item">
                  <span className="receipt-meta-label">Reference ID:</span>
                  <strong className="receipt-meta-val">
                    {selectedSaleDetail.reference || selectedSaleDetail.id}
                  </strong>
                </div>
                <div className="receipt-meta-item">
                  <span className="receipt-meta-label">Posting Date:</span>
                  <strong className="receipt-meta-val">
                    {formatDate(selectedSaleDetail.sale_date || selectedSaleDetail.created_at || null)}
                  </strong>
                </div>
                <div className="receipt-meta-item">
                  <span className="receipt-meta-label">Retail Account:</span>
                  <strong className="receipt-meta-val">{selectedSaleDetail.outlet || "Direct Store"}</strong>
                </div>
                <div className="receipt-meta-item">
                  <span className="receipt-meta-label">Sales Representative:</span>
                  <strong className="receipt-meta-val">{selectedSaleDetail.staff || "Sales Representative"}</strong>
                </div>
              </div>

              {/* Itemized Table */}
              <table className="receipt-items-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Package Unit</th>
                    <th style={{ textAlign: "center" }}>Qty</th>
                    <th style={{ textAlign: "right" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>{selectedSaleDetail.drink_type || "Beverage Product"}</strong>
                    </td>
                    <td>{getUnitLabel(selectedSaleDetail.unit_type)}</td>
                    <td style={{ textAlign: "center" }}>{selectedSaleDetail.quantity}</td>
                    <td style={{ textAlign: "right" }}>
                      <strong>{formatCurrency(Number(selectedSaleDetail.total_amount ?? 0))}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Settlement Summary */}
              <div className="receipt-financial-box">
                <div className="receipt-fin-row">
                  <span>Gross Order Amount:</span>
                  <strong>{formatCurrency(Number(selectedSaleDetail.total_amount ?? 0))}</strong>
                </div>
                <div className="receipt-fin-row">
                  <span>Amount Settled / Paid:</span>
                  <strong className="paid-text">
                    {formatCurrency(Number(selectedSaleDetail.amount_paid ?? 0))}
                  </strong>
                </div>
                <div className="receipt-fin-row total-row">
                  <span>Remaining Balance Due:</span>
                  <strong className={Number(selectedSaleDetail.balance ?? 0) > 0 ? "balance-due-text" : "balance-zero-text"}>
                    {formatCurrency(Number(selectedSaleDetail.balance ?? 0))}
                  </strong>
                </div>
                <div className="receipt-fin-row" style={{ marginTop: 6, paddingTop: 6, borderTop: "1px dashed #e2e8f0" }}>
                  <span>Settlement Status:</span>
                  <span className="receipt-status-pill">
                    {getPaymentStatusLabel(selectedSaleDetail.payment_status)}
                  </span>
                </div>
              </div>
            </div>

            <div className="receipt-footer">
              <button
                type="button"
                className="receipt-btn receipt-print-btn"
                onClick={() => window.print()}
              >
                <Printer size={15} />
                <span>Print Invoice</span>
              </button>

              {isAdmin && (
                <button
                  type="button"
                  className="receipt-btn"
                  style={{
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    color: "#1d4ed8",
                  }}
                  onClick={() => {
                    const toEdit = selectedSaleDetail;
                    setSelectedSaleDetail(null);
                    handleOpenEditSale(toEdit);
                  }}
                  title="Edit sale transaction"
                >
                  <Pencil size={14} />
                  <span>Edit</span>
                </button>
              )}

              {isAdmin && (
                <button
                  type="button"
                  className="receipt-btn"
                  style={{
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    color: "#dc2626",
                  }}
                  onClick={() => {
                    void handleDeleteSale(selectedSaleDetail);
                  }}
                  title="Delete sale transaction"
                >
                  <Trash2 size={14} />
                  <span>Delete</span>
                </button>
              )}

              <button
                type="button"
                className="receipt-btn receipt-done-btn"
                onClick={() => setSelectedSaleDetail(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 6.5. EDIT SALE MODAL (ADMIN ONLY) ── */}
      {isAdmin && editingSale && (
        <div
          className="tgt-modal-overlay"
          onClick={() => setEditingSale(null)}
          role="presentation"
        >
          <div
            className="tgt-modal-card"
            style={{ maxWidth: 540 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="tgt-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>
                  Edit Sale Transaction
                </h3>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "#6b7280" }}>
                  Ref: {editingSale.reference || editingSale.transaction_id || editingSale.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingSale(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#6b7280",
                  padding: 4,
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEditSale}>
              <div className="tgt-modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* 1. Retail Outlet */}
                <div className="tgt-field-group">
                  <span className="tgt-field-label">Retail Outlet</span>
                  <input
                    type="text"
                    className="targets-select-filter"
                    value={editFormData.outlet}
                    onChange={(e) =>
                      setEditFormData((prev) => ({ ...prev, outlet: e.target.value }))
                    }
                    placeholder="Enter outlet or store name"
                    required
                  />
                </div>

                {/* 2. Beverage Item */}
                <div className="tgt-field-group">
                  <span className="tgt-field-label">Beverage Product Name</span>
                  <input
                    type="text"
                    className="targets-select-filter"
                    value={editFormData.drinkType}
                    onChange={(e) =>
                      setEditFormData((prev) => ({ ...prev, drinkType: e.target.value }))
                    }
                    placeholder="e.g. Energy Drink 500ml"
                    required
                  />
                </div>

                {/* 3. Quantity & Unit Type */}
                <div className="tgt-dates-row">
                  <div className="tgt-field-group">
                    <span className="tgt-field-label">Quantity</span>
                    <input
                      type="number"
                      min={1}
                      className="targets-select-filter"
                      value={editFormData.quantity}
                      onChange={(e) =>
                        setEditFormData((prev) => ({
                          ...prev,
                          quantity: Math.max(1, parseInt(e.target.value) || 1),
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="tgt-field-group">
                    <span className="tgt-field-label">Unit Type</span>
                    <select
                      className="targets-select-filter"
                      value={editFormData.unitType}
                      onChange={(e) =>
                        setEditFormData((prev) => ({
                          ...prev,
                          unitType: parseInt(e.target.value) || 1,
                        }))
                      }
                    >
                      <option value={1}>Bottles</option>
                      <option value={2}>Cases</option>
                    </select>
                  </div>
                </div>

                {/* 4. Total Amount & Amount Paid */}
                <div className="tgt-dates-row">
                  <div className="tgt-field-group">
                    <span className="tgt-field-label">Total Amount (₦)</span>
                    <input
                      type="number"
                      min={0}
                      className="targets-select-filter"
                      value={editFormData.totalAmount}
                      onChange={(e) =>
                        setEditFormData((prev) => ({
                          ...prev,
                          totalAmount: Math.max(0, parseFloat(e.target.value) || 0),
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="tgt-field-group">
                    <span className="tgt-field-label">Amount Paid (₦)</span>
                    <input
                      type="number"
                      min={0}
                      className="targets-select-filter"
                      value={editFormData.amountPaid}
                      onChange={(e) =>
                        setEditFormData((prev) => ({
                          ...prev,
                          amountPaid: Math.max(0, parseFloat(e.target.value) || 0),
                        }))
                      }
                      required
                    />
                  </div>
                </div>

                {/* 5. Sale Date */}
                <div className="tgt-field-group">
                  <span className="tgt-field-label">Sale Date</span>
                  <input
                    type="date"
                    className="targets-select-filter"
                    value={editFormData.saleDate}
                    onChange={(e) =>
                      setEditFormData((prev) => ({ ...prev, saleDate: e.target.value }))
                    }
                    required
                  />
                </div>

                {/* Settlement Summary Pill */}
                <div
                  style={{
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    padding: "10px 14px",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      color: "#166534",
                    }}
                  >
                    <span>Remaining Balance:</span>
                    <strong>
                      ₦
                      {Math.max(
                        0,
                        editFormData.totalAmount - editFormData.amountPaid
                      ).toLocaleString()}
                    </strong>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      color: "#166534",
                      marginTop: 4,
                    }}
                  >
                    <span>Calculated Settlement:</span>
                    <strong style={{ textTransform: "uppercase" }}>
                      {editFormData.amountPaid >= editFormData.totalAmount &&
                      editFormData.totalAmount > 0
                        ? "Paid (Complete)"
                        : editFormData.amountPaid > 0
                        ? "Partially Paid"
                        : "Credit (Unpaid)"}
                    </strong>
                  </div>
                </div>

                {/* 6. Notes */}
                <div className="tgt-field-group">
                  <span className="tgt-field-label">Notes (Optional)</span>
                  <input
                    type="text"
                    className="targets-select-filter"
                    value={editFormData.notes}
                    onChange={(e) =>
                      setEditFormData((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    placeholder="Transaction remarks or invoice notes"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="tgt-modal-footer">
                <button
                  type="button"
                  className="btn-secondary-target"
                  onClick={() => setEditingSale(null)}
                  style={{ padding: "9px 14px" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="tgt-submit-btn"
                  style={{ width: "auto", minWidth: 140 }}
                  disabled={isSubmittingEdit}
                >
                  {isSubmittingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 7. NEW SALE MODAL TRIGGER ── */}
      {newSaleOpen && (
        <NewSaleDialog
          onSaved={(msg) => {
            setNewSaleSuccess(msg);
            void loadSales(true);
          }}
          onClose={() => setNewSaleOpen(false)}
        />
      )}
    </div>
  );
}