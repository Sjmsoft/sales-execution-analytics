import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Flame,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  User,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import LogoLoader from "../components/brand/LogoLoader";
import { useMinimumLoading } from "../hooks/useMinimumLoading";
import {
  calculateTargetsProgress,
  createMultiDrinkTargets,
  deleteTarget,
  fetchAvailableDrinks,
  fetchStaffForTargets,
  fetchTargets,
  getBAMetrics,
  updateTarget,
  getPushNotificationLogs,
  savePushNotificationLog,
  type DrinkTargetItem,
  type PushNotificationRecord,
  type TargetRecord,
  type TargetStatus,
  type TargetType,
  type TargetUnit,
} from "../services/targetsService";
import { getSales, createSale, type Sale } from "../services/salesService";
import { getOutlets, type Outlet } from "../services/referenceService";
import {
  getUserScope,
  filterTargetsByScope,
  filterStaffByScope,
} from "../services/dataScopeService";
import { addNotification } from "../services/notificationService";

export default function Targets() {
  const { staff, role } = useAuth();
  const userScope = useMemo(() => getUserScope(staff, role), [staff, role]);

  // Role permissions: Only NSM and Admins can create and push targets
  const canCreateAndPush = useMemo(() => {
    const key = role?.key?.toLowerCase() || "";
    return (
      key === "administrator" ||
      key === "national_sales_manager" ||
      role?.can_assign_targets === true
    );
  }, [role]);

  // Admin role check (for edit/delete privileges)
  const isAdmin = useMemo(() => {
    const key = (role?.key || staff?.user_roles?.key || staff?.assigned_role || "").toLowerCase();
    return (
      key === "administrator" ||
      key === "admin" ||
      role?.hierarchy_level === 1
    );
  }, [role, staff]);

  // Is current staff a Brand Ambassador?
  const isBrandAmbassador = useMemo(() => {
    const key = role?.key?.toLowerCase() || "";
    const roleName = role?.name?.toLowerCase() || "";
    return key.includes("ambassador") || roleName.includes("ambassador");
  }, [role]);

  // Targets state
  const [targets, setTargets] = useState<TargetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const visibleLoading = useMinimumLoading(loading, 800);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Filter state (matching Image 1)
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All Status");
  const [typeFilter, setTypeFilter] = useState<string>("All Types");
  const [staffFilter, setStaffFilter] = useState<string>("All Staff");
  const [regionFilter, setRegionFilter] = useState<string>("All Regions");
  const [dateFilter, setDateFilter] = useState<string>("All dates");

  // Create Quick Targets Modal state (matching Image 3)
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [staffList, setStaffList] = useState<
    Array<{ id: string; name: string; region: string; role: string; roleKey: string }>
  >([]);
  const [availableDrinks, setAvailableDrinks] = useState<
    Array<{ id: string; name: string; bottles_per_case?: number }>
  >([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [staffSearchQuery, setStaffSearchQuery] = useState("");
  const [drinkRows, setDrinkRows] = useState<
    Array<{ id: string; drinkId: string; unit: TargetUnit; qty: number }>
  >([{ id: "row-1", drinkId: "", unit: "Cases", qty: 20 }]);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [createStartDate, setCreateStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [createEndDate, setCreateEndDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [createTargetType, setCreateTargetType] = useState<TargetType>("Weekly Cases");
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // Push Targets Modal state (for NSM and Admins)
  const [pushModalOpen, setPushModalOpen] = useState(false);
  const [pushTemplate, setPushTemplate] = useState("Monthly Sales Target");
  const [pushRecipientRole, setPushRecipientRole] = useState("Brand Ambassador");
  const [pushNotificationType, setPushNotificationType] = useState<
    "Email" | "SMS" | "In-App" | "Push"
  >("In-App");
  const [pushTiming, setPushTiming] = useState<"Immediate" | "Scheduled">("Immediate");
  const [pushScheduledDate, setPushScheduledDate] = useState("2026-10-06T09:00");
  const [pushLogs, setPushLogs] = useState<PushNotificationRecord[]>([]);
  const [notificationToast, setNotificationToast] = useState<string | null>(null);

  // Sales ledger & Outlets state
  const [salesList, setSalesList] = useState<Sale[]>([]);
  const [outletsList, setOutletsList] = useState<Outlet[]>([]);

  // Record Individual Sale Modal state
  const [recordSaleTarget, setRecordSaleTarget] = useState<TargetRecord | null>(null);
  const [recordOutletId, setRecordOutletId] = useState("");
  const [recordCustomOutlet, setRecordCustomOutlet] = useState("");
  const [recordDrinkName, setRecordDrinkName] = useState("");
  const [recordQty, setRecordQty] = useState(1);
  const [recordUnit, setRecordUnit] = useState<TargetUnit>("Cases");
  const [recordSaleDate, setRecordSaleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [recordUnitPrice, setRecordUnitPrice] = useState(70000);
  const [isSubmittingSale, setIsSubmittingSale] = useState(false);

  // Edit Target Modal state (Admin only)
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editStaffId, setEditStaffId] = useState("");
  const [editQuantity, setEditQuantity] = useState(20);
  const [editUnit, setEditUnit] = useState<TargetUnit>("Cases");
  const [editTargetType, setEditTargetType] = useState<TargetType>("Weekly Cases");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editStatus, setEditStatus] = useState<TargetStatus>("Active");
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const handleOpenEditModal = (tgt: TargetRecord) => {
    if (!isAdmin) return;
    setEditingTargetId(tgt.id);
    setEditTitle(tgt.title);
    setEditStaffId(tgt.salesRep.id);
    setEditQuantity(tgt.targetQuantity);
    setEditUnit(tgt.unit);
    setEditTargetType(tgt.targetType);
    setEditStartDate(tgt.startDate);
    setEditEndDate(tgt.endDate);
    setEditStatus(tgt.status);
    setEditModalOpen(true);
  };

  const handleEditTargetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !editingTargetId) return;

    const matchedStaff = staffList.find((s) => s.id === editStaffId);

    setIsSubmittingEdit(true);
    try {
      await updateTarget(editingTargetId, {
        title: editTitle,
        productName: editTitle,
        targetQuantity: editQuantity,
        unit: editUnit,
        targetType: editTargetType,
        startDate: editStartDate,
        endDate: editEndDate,
        status: editStatus,
        salesRep: matchedStaff
          ? {
              id: matchedStaff.id,
              name: matchedStaff.name,
              region: matchedStaff.region,
              role: matchedStaff.role,
            }
          : undefined,
      });

      await loadTargetsData(true);
      setEditModalOpen(false);
      setNotificationToast(`Target "${editTitle}" updated successfully.`);
      setTimeout(() => setNotificationToast(null), 5000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update target.");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Load targets and individual sales
  const loadTargetsData = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const [rawTargets, allSales, drinksList, outletsData] = await Promise.all([
        fetchTargets(),
        getSales().catch(() => []),
        fetchAvailableDrinks().catch(() => []),
        getOutlets().catch(() => []),
      ]);
      setSalesList(allSales);
      setAvailableDrinks(drinksList);
      setOutletsList(outletsData);

      const computed = calculateTargetsProgress(rawTargets, allSales, drinksList);
      const scoped = filterTargetsByScope(computed, userScope);
      setTargets(scoped);

      const logs = await getPushNotificationLogs();
      setPushLogs(logs);
    } catch (e) {
      console.error("Targets load error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userScope]);

  useEffect(() => {
    void loadTargetsData();
    void fetchStaffForTargets().then((staffData) => {
      const scopedStaff = filterStaffByScope(staffData as any[], userScope);
      setStaffList(scopedStaff as any[]);
    });
  }, [loadTargetsData, userScope]);

  // Toggle accordion row
  const toggleRow = (id: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Available unique regions across targets and staff for filter dropdown
  const availableRegions = useMemo(() => {
    const set = new Set<string>();
    targets.forEach((t) => {
      if (t.salesRep?.region && t.salesRep.region.trim()) set.add(t.salesRep.region.trim());
    });
    staffList.forEach((s) => {
      if (s.region && s.region.trim()) set.add(s.region.trim());
    });
    return Array.from(set).sort();
  }, [targets, staffList]);

  // Filtered targets
  const filteredTargets = useMemo(() => {
    return targets.filter((t) => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchRep = t.salesRep.name.toLowerCase().includes(q);
        const matchDrink = t.bundledDrinks?.some((d) => d.toLowerCase().includes(q));
        if (!matchTitle && !matchRep && !matchDrink) return false;
      }

      // Status
      if (statusFilter !== "All Status" && t.status !== statusFilter) {
        return false;
      }

      // Target Type
      if (typeFilter !== "All Types" && t.targetType !== typeFilter) {
        return false;
      }

      // Staff
      if (staffFilter !== "All Staff" && t.salesRep.name !== staffFilter) {
        return false;
      }

      // Region
      if (regionFilter !== "All Regions" && !t.salesRep.region.toLowerCase().includes(regionFilter.toLowerCase())) {
        return false;
      }

      // Date window filter (dynamic calculation)
      if (dateFilter === "This Month") {
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        return t.startDate.slice(0, 7) === currentMonth || t.endDate.slice(0, 7) === currentMonth;
      }
      if (dateFilter === "Last Month") {
        const now = new Date();
        now.setMonth(now.getMonth() - 1);
        const lastMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        return t.startDate.slice(0, 7) === lastMonth || t.endDate.slice(0, 7) === lastMonth;
      }
      if (dateFilter === "Q4 2026") {
        const isQ4 = (d: string) => {
          const ym = d.slice(0, 7);
          return ym >= "2026-10" && ym <= "2026-12";
        };
        return isQ4(t.startDate) || isQ4(t.endDate);
      }

      return true;
    });
  }, [targets, searchQuery, statusFilter, typeFilter, staffFilter, regionFilter, dateFilter]);

  // Aggregate KPI summary metrics (matching Image 1)
  const totalTargetVolume = useMemo(
    () => filteredTargets.reduce((sum, t) => sum + (t.targetQuantity || 0), 0),
    [filteredTargets]
  );

  const totalAchievedVolume = useMemo(
    () => filteredTargets.reduce((sum, t) => sum + (t.achievedQuantity || 0), 0),
    [filteredTargets]
  );

  const overallProgressPct =
    totalTargetVolume > 0 ? Math.round((totalAchievedVolume / totalTargetVolume) * 100) : 0;

  const activeTargetsCount = useMemo(
    () => filteredTargets.filter((t) => t.status === "Active").length,
    [filteredTargets]
  );

  const completedTargetsCount = useMemo(
    () => filteredTargets.filter((t) => t.status === "Completed").length,
    [filteredTargets]
  );

  const coveredRepsCount = useMemo(() => {
    const repSet = new Set(filteredTargets.map((t) => t.salesRep.name));
    return repSet.size;
  }, [filteredTargets]);

  // BA personal progress metrics
  const baMetrics = useMemo(() => {
    return getBAMetrics(staff?.id, staff?.name, salesList);
  }, [staff, salesList]);

  // Open Log Sale modal for specific target
  const handleOpenRecordSaleModal = (tgt: TargetRecord) => {
    setRecordSaleTarget(tgt);
    const initialDrink = tgt.bundledDrinks && tgt.bundledDrinks.length > 0 ? tgt.bundledDrinks[0] : tgt.productName || tgt.title;
    setRecordDrinkName(initialDrink);
    setRecordUnit(tgt.unit || "Cases");
    setRecordQty(1);
    setRecordSaleDate(new Date().toISOString().slice(0, 10));
    setRecordOutletId(outletsList[0]?.id || "");
    setRecordCustomOutlet(outletsList[0]?.name || "Local Retail Outlet");
    setRecordUnitPrice(tgt.unit === "Cases" ? 70000 : 7000);
  };

  // Submit individual sale against target
  const handleRecordSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordSaleTarget) return;

    setIsSubmittingSale(true);
    try {
      const totalAmount = recordQty * recordUnitPrice;

      const matchedDrink = availableDrinks.find(
        (d) => d.name.toLowerCase() === recordDrinkName.toLowerCase()
      );
      const drinkId = matchedDrink?.id || recordDrinkName;

      await createSale({
        outletId: recordOutletId || "outlet-1",
        drinkTypeId: drinkId,
        quantity: recordQty,
        unitType: recordUnit === "Cases" ? 2 : 1,
        unitPrice: recordUnitPrice,
        totalAmount,
        amountPaid: totalAmount,
        paymentStatus: 2,
        saleDate: recordSaleDate,
        paymentMethod: 1,
        staffName: recordSaleTarget.salesRep.name,
        staffId: recordSaleTarget.salesRep.id,
        drinkName: recordDrinkName,
      });

      // Reload sales and target progress
      await loadTargetsData(true);
      setRecordSaleTarget(null);

      setNotificationToast(
        `Recorded sale of ${recordQty} ${recordUnit} for ${recordSaleTarget.salesRep.name}! Target progress updated.`
      );
      setTimeout(() => setNotificationToast(null), 5000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to record sale.");
    } finally {
      setIsSubmittingSale(false);
    }
  };

  // Delete target handler (Admin only)
  const handleDeleteTarget = async (id: string, title: string) => {
    if (!isAdmin) {
      alert("Only system administrators can delete sales targets.");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete target "${title}"?`)) return;
    try {
      await deleteTarget(id);
      await loadTargetsData(true);
      setNotificationToast(`Target "${title}" removed.`);
      setTimeout(() => setNotificationToast(null), 4000);
    } catch (err) {
      console.error("Error deleting target:", err);
      alert(err instanceof Error ? err.message : "Failed to delete target.");
    }
  };

  // Clear report filters
  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilter("All Status");
    setTypeFilter("All Types");
    setStaffFilter("All Staff");
    setRegionFilter("All Regions");
    setDateFilter("All dates");
  };

  // Export List as CSV
  const handleExportCSV = () => {
    if (filteredTargets.length === 0) {
      alert("No target records to export.");
      return;
    }
    const headers = [
      "Product Name",
      "Sales Rep",
      "Region",
      "Target Quantity",
      "Unit",
      "Achieved",
      "Progress %",
      "Period Start",
      "Period End",
      "Status",
      "Created Date",
      "Created By",
    ];

    const rows = filteredTargets.map((t) => [
      `"${t.title.replace(/"/g, '""')}"`,
      `"${t.salesRep.name}"`,
      `"${t.salesRep.region}"`,
      t.targetQuantity,
      t.unit,
      t.achievedQuantity,
      `${t.progressPercent}%`,
      t.startDate,
      t.endDate,
      t.status,
      t.createdAt,
      `"${t.createdBy}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `penedge_targets_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export PDF / Print
  const handleExportPDF = () => {
    window.print();
  };

  // ── Multi-Drink Modal Handlers ──────────────────────────────────────────

  const handleOpenCreateModal = useCallback(() => {
    setSelectedStaffIds([]);
    setDrinkRows([{ id: "row-1", drinkId: "", unit: "Cases", qty: 20 }]);
    setSummaryExpanded(false);
    setCreateModalOpen(true);
  }, []);

  const filteredStaffList = useMemo(() => {
    if (!staffSearchQuery.trim()) return staffList;
    const q = staffSearchQuery.toLowerCase();
    return staffList.filter(
      (s) => s.name.toLowerCase().includes(q) || s.role.toLowerCase().includes(q)
    );
  }, [staffList, staffSearchQuery]);

  const toggleSelectStaff = (id: string) => {
    setSelectedStaffIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleAddDrinkRow = () => {
    setDrinkRows((prev) => [
      ...prev,
      { id: `row-${Date.now()}`, drinkId: "", unit: "Cases", qty: 20 },
    ]);
  };

  const handleRemoveDrinkRow = (id: string) => {
    if (drinkRows.length === 1) return;
    setDrinkRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleDrinkChange = (rowId: string, drinkId: string) => {
    setDrinkRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, drinkId } : r))
    );
  };

  const handleUnitChange = (rowId: string, unit: TargetUnit) => {
    setDrinkRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, unit } : r))
    );
  };

  const handleQtyChange = (rowId: string, qty: number) => {
    setDrinkRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, qty: Math.max(1, qty) } : r))
    );
  };

  // Selected drinks list to prevent duplicates
  const alreadySelectedDrinkIds = useMemo(() => {
    return drinkRows.map((r) => r.drinkId).filter(Boolean);
  }, [drinkRows]);

  // Rollup calculations
  const totalCartonsRollup = useMemo(() => {
    return drinkRows.reduce((sum, r) => sum + (Number(r.qty) || 0), 0);
  }, [drinkRows]);

  const handleCreateTargetsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStaffIds.length === 0) {
      alert("Please select at least one staff member.");
      return;
    }

    const validDrinks = drinkRows
      .filter((r) => r.drinkId)
      .map((r) => {
        const item = availableDrinks.find((d) => d.id === r.drinkId);
        return {
          drinkId: r.drinkId,
          drinkName: item?.name || "Product",
          quantity: r.qty,
          unit: r.unit,
        } as DrinkTargetItem;
      });

    if (validDrinks.length === 0) {
      alert("Please select at least one product in the drink rows.");
      return;
    }

    const chosenStaff = staffList.filter((s) => selectedStaffIds.includes(s.id));

    setIsSubmittingCreate(true);
    try {
      await createMultiDrinkTargets({
        staffMembers: chosenStaff,
        drinks: validDrinks,
        startDate: createStartDate,
        endDate: createEndDate,
        targetType: createTargetType,
        creatorName: staff?.name || "Administrator",
        creatorId: staff?.id,
      });

      // Reload live data directly from Supabase
      await loadTargetsData(true);
      // Clear filters so new targets immediately appear
      handleClearFilters();
      setCreateModalOpen(false);
      // Reset form
      setSelectedStaffIds([]);
      setDrinkRows([{ id: "row-1", drinkId: "", unit: "Cases", qty: 20 }]);

      addNotification({
        title: `🎯 Target Created: ${validDrinks.length > 1 ? `${validDrinks.length} Products Bundled` : validDrinks[0].drinkName}`,
        message: `Assigned to ${chosenStaff.length} staff member(s). Target cycle: ${createTargetType}.`,
        type: "target",
        priority: "normal",
        sender: staff?.name || "Administrator",
        link: "/targets",
        actionLabel: "View Targets",
        category: "Targets",
      });

      setNotificationToast(
        `Successfully created ${validDrinks.length * chosenStaff.length} target(s) across ${chosenStaff.length} staff member(s). Notification dispatched!`
      );
      setTimeout(() => setNotificationToast(null), 6000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create targets.");
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // ── Push Targets Modal Handlers ─────────────────────────────────────────

  const handlePushTargetsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const targetStaffNames = staffList
      .filter((s) =>
        pushRecipientRole === "All" ||
        s.role.toLowerCase().includes(pushRecipientRole.toLowerCase())
      )
      .map((s) => s.name);

    const log: PushNotificationRecord = {
      id: `push-${Date.now()}`,
      template: pushTemplate,
      targetType: "Weekly Cases",
      recipientsRole: pushRecipientRole,
      recipientNames: targetStaffNames.slice(0, 4),
      notificationType: pushNotificationType,
      timing: pushTiming,
      scheduledFor: pushTiming === "Scheduled" ? pushScheduledDate : undefined,
      status: pushTiming === "Scheduled" ? "Scheduled" : "Delivered",
      sentAt: new Date().toISOString().replace("T", " ").slice(0, 16),
      sentBy: staff?.name || "National Sales Manager",
    };

    const updated = await savePushNotificationLog(log);
    setPushLogs(updated);
    setPushModalOpen(false);

    addNotification({
      title: `🎯 Target Quota Broadcast: ${pushTemplate}`,
      message: `Dispatched to ${targetStaffNames.length} team members via ${pushNotificationType}. Target cycle: Weekly Cases.`,
      type: "target",
      priority: "high",
      sender: staff?.name || "National Sales Manager",
      link: "/targets",
      actionLabel: "View Targets",
      category: "Targets",
    });

    setNotificationToast(
      `Push Notification "${pushTemplate}" broadcasted via ${pushNotificationType} to ${targetStaffNames.length} team members!`
    );
    setTimeout(() => setNotificationToast(null), 6000);
  };

  return (
    <div className="targets-page-container">
      {/* Toast notification banner */}
      {notificationToast && (
        <div
          style={{
            background: "#ecfdf5",
            border: "1px solid #10b981",
            color: "#065f46",
            padding: "12px 18px",
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircle2 size={16} />
            <span>{notificationToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotificationToast(null)}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "#065f46" }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* ── Top Header Bar ── */}
      <div className="targets-header-row">
        <div className="targets-header-text">
          <h2>Targets</h2>
          <p>Monthly sales targets and progress</p>
        </div>

        <div className="targets-header-actions">
          {/* Create Target Button (NSM & Admin only) */}
          {canCreateAndPush && (
            <button
              type="button"
              className="btn-primary-target"
              onClick={handleOpenCreateModal}
            >
              <Plus size={15} />
              Create Target
            </button>
          )}

          {/* Push Targets Button (NSM & Admin only) */}
          {canCreateAndPush && (
            <button
              type="button"
              className="btn-secondary-target"
              onClick={() => setPushModalOpen(true)}
              title="Push targets broadcast to team members"
            >
              <Send size={14} />
              Push Targets
            </button>
          )}

          {/* Refresh button */}
          <button
            type="button"
            className="btn-secondary-target"
            onClick={() => void loadTargetsData(true)}
            title="Refresh targets data"
          >
            <RefreshCw size={14} className={refreshing ? "spinning" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── BA Target Progress Tracker (Featured for Brand Ambassadors) ── */}
      {isBrandAmbassador && (
        <div className="ba-progress-tracker-wrap">
          <div className="ba-tracker-header">
            <h3>
              <Sparkles size={16} color="#059669" />
              Brand Ambassador Performance Tracker
            </h3>
            <span style={{ fontSize: "11px", color: "#065f46", fontWeight: 600 }}>
              Live Target Pacing
            </span>
          </div>

          <div className="ba-tracker-grid">
            <div className="ba-tracker-metric">
              <span>Daily Progress (Min: 4 Bottles)</span>
              <strong>{baMetrics.dailyBottlesSold} / 4 Bottles</strong>
              <div style={{ width: "100%", height: 6, background: "#edf1ef", borderRadius: 6, marginTop: 4 }}>
                <div
                  style={{
                    width: `${baMetrics.dailyProgressPct}%`,
                    height: "100%",
                    background: "#083e32",
                    borderRadius: 6,
                  }}
                />
              </div>
            </div>

            <div className="ba-tracker-metric">
              <span>Monthly Target Realization</span>
              <strong>{baMetrics.monthlyTargetPct}% Achieved</strong>
              <span style={{ fontSize: "10px", color: "#059669" }}>On track to meet goal</span>
            </div>

            <div className="ba-tracker-metric">
              <span>Sales Streak</span>
              <strong>
                <Flame size={16} color="#d97706" style={{ display: "inline", verticalAlign: "middle" }} />{" "}
                {baMetrics.salesStreakDays} Days
              </strong>
              <span style={{ fontSize: "10px", color: "#68746f" }}>Consecutive quota days</span>
            </div>

            <div className="ba-tracker-metric">
              <span>Attendance Rate</span>
              <strong>{baMetrics.attendanceRatePct}%</strong>
              <span style={{ fontSize: "10px", color: "#68746f" }}>Completed field shifts</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Filter Bar (Matching Image 1) ── */}
      <div className="targets-filter-bar">
        <div className="targets-search-wrap">
          <Search size={14} className="targets-search-icon" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className="targets-select-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="All Status">All Status</option>
          <option value="Active">Active</option>
          <option value="Completed">Completed</option>
          <option value="Behind Pace">Behind Pace</option>
        </select>

        <select
          className="targets-select-filter"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="All Types">All Types</option>
          <option value="Weekly Cases">Weekly Cases</option>
          <option value="Daily Bottles">Daily Bottles</option>
          <option value="Monthly Revenue">Monthly Revenue</option>
          <option value="Visit Targets">Visit Targets</option>
        </select>

        <select
          className="targets-select-filter"
          value={staffFilter}
          onChange={(e) => setStaffFilter(e.target.value)}
        >
          <option value="All Staff">All Staff</option>
          {staffList.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          className="targets-select-filter"
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
        >
          <option value="All Regions">All Regions</option>
          {availableRegions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        <select
          className="targets-select-filter"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
        >
          <option value="All dates">All dates</option>
          <option value="This Month">This Month</option>
          <option value="Last Month">Last Month</option>
          <option value="Q4 2026">Q4 2026</option>
        </select>
      </div>

      {/* ── KPI Summary Grid (4 KPI Cards + 1 Focus Export Card matching Image 1) ── */}
      <div className="targets-kpi-grid">
        {/* Card 1: Total target volume */}
        <div className="tgt-kpi-card">
          <div className="tgt-kpi-header">
            <span>Total target volume</span>
            <Target size={16} className="tgt-icon" />
          </div>
          <strong className="tgt-kpi-val">{totalTargetVolume.toLocaleString()}</strong>
          <span className="tgt-kpi-sub">Across {filteredTargets.length} target sets</span>
        </div>

        {/* Card 2: Achieved volume */}
        <div className="tgt-kpi-card">
          <div className="tgt-kpi-header">
            <span>Achieved volume</span>
            <TrendingUp size={16} className="tgt-icon" />
          </div>
          <strong className="tgt-kpi-val">{totalAchievedVolume.toLocaleString()}</strong>
          <span className="tgt-kpi-sub">{overallProgressPct}% overall progress</span>
        </div>

        {/* Card 3: Active targets */}
        <div className="tgt-kpi-card">
          <div className="tgt-kpi-header">
            <span>Active targets</span>
            <Clock size={16} className="tgt-icon" />
          </div>
          <strong className="tgt-kpi-val">{activeTargetsCount}</strong>
          <span className="tgt-kpi-sub">{completedTargetsCount} completed</span>
        </div>

        {/* Card 4: Sales reps covered */}
        <div className="tgt-kpi-card">
          <div className="tgt-kpi-header">
            <span>Sales reps covered</span>
            <User size={16} className="tgt-icon" />
          </div>
          <strong className="tgt-kpi-val">{coveredRepsCount}</strong>
          <span className="tgt-kpi-sub">Current export scope</span>
        </div>

        {/* Card 5: Export and focus card */}
        <div className="tgt-export-card">
          <div className="tgt-export-top">
            <div className="tgt-export-title-wrap">
              <h4>Export and focus</h4>
              <p>Use the current filters to export exactly what you are viewing.</p>
            </div>
            <div className="tgt-export-btns">
              <button type="button" className="tgt-export-btn" onClick={handleExportCSV}>
                <Download size={13} />
                Export list
              </button>
              <button type="button" className="tgt-export-btn" onClick={handleExportPDF}>
                <Download size={13} />
                Export PDF
              </button>
            </div>
          </div>

          <div className="tgt-export-meta-row">
            <div className="tgt-meta-pill-box">
              <small>Scope</small>
              <strong>all visible</strong>
            </div>
            <div className="tgt-meta-pill-box">
              <small>Date window</small>
              <strong>{dateFilter === "All dates" ? "Any → Any" : dateFilter}</strong>
            </div>
            <div className="tgt-meta-pill-box">
              <small>Results</small>
              <strong>{filteredTargets.length} target rows ready</strong>
            </div>
          </div>
        </div>
      </div>

      {/* ── Individual Targets Summary Report Bar (matching Image 1) ── */}
      <div className="tgt-report-subbar">
        <div className="tgt-report-subbar-text">
          <h4>Individual Targets Summary Report</h4>
          <p>
            Review individual target coverage, achieved volume, variance, and target list filtering for the selected date window.
          </p>
        </div>

        <div className="tgt-report-subbar-actions">
          <button
            type="button"
            className="btn-secondary-target"
            onClick={handleClearFilters}
          >
            <X size={13} />
            Clear report filters
          </button>
          <button
            type="button"
            className="btn-secondary-target"
            onClick={handleExportCSV}
          >
            <Download size={13} />
            Export report
          </button>
        </div>
      </div>

      {/* ── Targets Table (matching Image 2) ── */}
      <div className="targets-table-card">
        {visibleLoading ? (
          <LogoLoader
            variant="section"
            message="Loading sales targets"
            hint="Calculating quota, team performance, and representative targets"
          />
        ) : filteredTargets.length === 0 ? (
          <div className="dashboard-empty-state" style={{ minHeight: 220 }}>
            <div>
              <Target size={32} color="#94a3b8" style={{ marginBottom: 8 }} />
              <p>No target records match your filter criteria.</p>
              <button
                type="button"
                className="btn-secondary-target"
                onClick={handleClearFilters}
                style={{ marginTop: 8 }}
              >
                Reset Filters
              </button>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="targets-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }} />
                  <th>Product Name</th>
                  <th>Sales Rep</th>
                  <th>Target</th>
                  <th>Period</th>
                  <th>Progress vs Target</th>
                  <th>Status</th>
                  <th>Created</th>
                  {(canCreateAndPush || isAdmin) && (
                    <th style={{ width: 140, textAlign: "center" }}>Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredTargets.map((tgt) => {
                  const isExpanded = Boolean(expandedRows[tgt.id]);
                  return (
                    <Fragment key={tgt.id}>
                      <tr>
                      {/* Accordion toggle */}
                      <td>
                        <button
                          type="button"
                          onClick={() => toggleRow(tgt.id)}
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            color: "#68746f",
                            display: "flex",
                            alignItems: "center",
                          }}
                          aria-label="Toggle details"
                        >
                          {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        </button>
                      </td>

                      {/* Product Name */}
                      <td>
                        <div className="tgt-product-cell">
                          <div className="tgt-product-avatar" aria-hidden="true">
                            {tgt.title.charAt(0).toUpperCase() || "F"}
                          </div>
                          <div className="tgt-product-info">
                            <strong>{tgt.title}</strong>
                            <span>
                              {tgt.bundledDrinks && tgt.bundledDrinks.length > 0
                                ? tgt.bundledDrinks.join(", ")
                                : tgt.productName}
                            </span>
                            {/* Expanded bundle items list */}
                            {isExpanded && tgt.bundledDrinks && (
                              <div
                                style={{
                                  marginTop: 8,
                                  padding: "8px 10px",
                                  background: "#f4f8f6",
                                  borderRadius: 6,
                                  fontSize: 11,
                                  color: "#064e3b",
                                }}
                              >
                                <strong>Bundle Product Details:</strong>
                                <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                                  {tgt.bundledDrinks.map((d, idx) => (
                                    <li key={idx}>{d}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Sales Rep */}
                      <td>
                        <div className="tgt-rep-info">
                          <User size={15} color="#68746f" />
                          <div className="tgt-rep-texts">
                            <strong>{tgt.salesRep.name}</strong>
                            <span>{tgt.salesRep.region}</span>
                          </div>
                        </div>
                      </td>

                      {/* Target */}
                      <td>
                        <strong>
                          {tgt.targetQuantity} {tgt.unit}
                        </strong>
                        <div style={{ fontSize: 11, color: "#68746f" }}>
                          {tgt.isBundle ? `${tgt.bundleCount || 4} products in bundle` : "Single Product"}
                        </div>
                      </td>

                      {/* Period */}
                      <td>
                        <span style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>
                          {tgt.startDate.slice(5)} - {tgt.endDate.slice(5)}
                        </span>
                      </td>

                      {/* Progress bar */}
                      <td>
                        <div className="tgt-progress-meter">
                          <div className="tgt-meter-bar-track">
                            <div
                              className="tgt-meter-bar-fill"
                              style={{
                                width: `${Math.min(100, tgt.progressPercent)}%`,
                                background:
                                  tgt.progressPercent >= 100
                                    ? "#059669"
                                    : tgt.status === "Behind Pace"
                                    ? "#d97706"
                                    : "#083e32",
                              }}
                            />
                          </div>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                            <span style={{ fontSize: 12.5, fontWeight: 700 }}>
                              {tgt.progressPercent}%
                            </span>
                            <span style={{ fontSize: 11, color: "#68746f" }}>
                              ({tgt.achievedQuantity} of {tgt.targetQuantity} {tgt.unit})
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        <span
                          className={
                            tgt.status === "Completed"
                              ? "tgt-badge-completed"
                              : tgt.status === "Behind Pace"
                              ? "tgt-badge-behind"
                              : "tgt-badge-active"
                          }
                        >
                          {tgt.status}
                        </span>
                      </td>

                      {/* Created */}
                      <td>
                        <span style={{ fontSize: 12.5, display: "block" }}>{tgt.createdAt}</span>
                        <small style={{ color: "#68746f", fontSize: 11 }}>
                          by {tgt.createdBy}
                        </small>
                      </td>

                      {/* Actions */}
                      {(canCreateAndPush || isAdmin) && (
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                            {canCreateAndPush && (
                              <button
                                type="button"
                                onClick={() => handleOpenRecordSaleModal(tgt)}
                                style={{
                                  background: "#ecfdf5",
                                  border: "1px solid #a7f3d0",
                                  color: "#065f46",
                                  cursor: "pointer",
                                  padding: "4px 8px",
                                  borderRadius: 6,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 3,
                                  fontSize: 11,
                                  fontWeight: 600,
                                }}
                                title="Record individual sale against this target"
                              >
                                <Plus size={11} /> Sale
                              </button>
                            )}

                            {/* Edit Target - Admin Only */}
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(tgt)}
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
                                title="Edit target (Admin only)"
                              >
                                <Pencil size={11} /> Edit
                              </button>
                            )}

                            {/* Delete Target - Admin Only */}
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleDeleteTarget(tgt.id, tgt.title)}
                                style={{
                                  background: "#fef2f2",
                                  border: "1px solid #fecaca",
                                  color: "#dc2626",
                                  cursor: "pointer",
                                  padding: "4px 6px",
                                  borderRadius: 6,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                                title="Delete target (Admin only)"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>

                    {/* Expanded Individual Sales & Variance Breakdown */}
                    {isExpanded && (
                      <tr key={`${tgt.id}-expanded`}>
                        <td
                          colSpan={canCreateAndPush ? 9 : 8}
                          style={{
                            padding: "14px 20px 20px",
                            background: "#f8faf9",
                            borderTop: "1px dashed #d1e2da",
                            borderBottom: "1px solid #e2e8e5",
                          }}
                        >
                          <div>
                            {/* Header Bar */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                flexWrap: "wrap",
                                gap: 10,
                                marginBottom: 12,
                              }}
                            >
                              <div>
                                <h5 style={{ margin: "0 0 3px", fontSize: 13.5, fontWeight: 700, color: "#0c2b20" }}>
                                  Individual Sales & Variance for {tgt.salesRep.name}
                                </h5>
                                <p style={{ margin: 0, fontSize: 11.5, color: "#64748b" }}>
                                  Target Window: <strong>{tgt.startDate}</strong> to <strong>{tgt.endDate}</strong> · Quota:{" "}
                                  <strong>{tgt.targetQuantity} {tgt.unit}</strong>
                                </p>
                              </div>

                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: (tgt.variance ?? 0) <= 0 ? "#059669" : "#b45309",
                                    padding: "4px 9px",
                                    background: (tgt.variance ?? 0) <= 0 ? "#ecfdf5" : "#fffbeb",
                                    border: `1px solid ${(tgt.variance ?? 0) <= 0 ? "#a7f3d0" : "#fde68a"}`,
                                    borderRadius: 6,
                                  }}
                                >
                                  {(tgt.variance ?? 0) <= 0
                                    ? `Target Reached (+${Math.abs(tgt.variance ?? 0)} surplus)`
                                    : `${tgt.variance} ${tgt.unit} remaining`}
                                </span>
                                <button
                                  type="button"
                                  className="btn-secondary-target"
                                  onClick={() => handleOpenRecordSaleModal(tgt)}
                                  style={{ fontSize: 11, padding: "5px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}
                                >
                                  <Plus size={12} /> Log Sale
                                </button>
                              </div>
                            </div>

                            {/* Summary Metrics Cards */}
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                                gap: 10,
                                marginBottom: 14,
                              }}
                            >
                              <div style={{ padding: "10px 14px", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                                <span style={{ fontSize: 10.5, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                                  Target Quota
                                </span>
                                <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginTop: 2 }}>
                                  {tgt.targetQuantity} {tgt.unit}
                                </div>
                              </div>
                              <div style={{ padding: "10px 14px", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                                <span style={{ fontSize: 10.5, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                                  Achieved Volume
                                </span>
                                <div style={{ fontSize: 16, fontWeight: 800, color: "#059669", marginTop: 2 }}>
                                  {tgt.achievedQuantity} {tgt.unit}
                                </div>
                              </div>
                              <div style={{ padding: "10px 14px", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                                <span style={{ fontSize: 10.5, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                                  Variance
                                </span>
                                <div
                                  style={{
                                    fontSize: 16,
                                    fontWeight: 800,
                                    color: (tgt.variance ?? 0) <= 0 ? "#059669" : "#dc2626",
                                    marginTop: 2,
                                  }}
                                >
                                  {(tgt.variance ?? 0) <= 0
                                    ? `+${Math.abs(tgt.variance ?? 0)} ${tgt.unit}`
                                    : `-${tgt.variance} ${tgt.unit}`}
                                </div>
                              </div>
                              <div style={{ padding: "10px 14px", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                                <span style={{ fontSize: 10.5, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                                  Sales Recorded
                                </span>
                                <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginTop: 2 }}>
                                  {tgt.matchingSales?.length || 0} transaction(s)
                                </div>
                              </div>
                            </div>

                            {/* Contributing Sales Table */}
                            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
                              <div
                                style={{
                                  padding: "9px 14px",
                                  background: "#f8fafc",
                                  borderBottom: "1px solid #e2e8f0",
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: "#1e293b",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                }}
                              >
                                <span>Individual Sales Ledger Entries</span>
                                <small style={{ color: "#64748b", fontWeight: 500 }}>
                                  {tgt.matchingSales?.length || 0} matched
                                </small>
                              </div>
                              {!tgt.matchingSales || tgt.matchingSales.length === 0 ? (
                                <div style={{ padding: "18px", textAlign: "center", color: "#64748b", fontSize: 12 }}>
                                  No individual sales recorded for this sales representative matching this product bundle yet.
                                </div>
                              ) : (
                                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                                  <thead>
                                    <tr style={{ background: "#f8fafc", color: "#64748b", textAlign: "left" }}>
                                      <th style={{ padding: "8px 14px" }}>Date</th>
                                      <th style={{ padding: "8px 14px" }}>Outlet</th>
                                      <th style={{ padding: "8px 14px" }}>Product</th>
                                      <th style={{ padding: "8px 14px" }}>Quantity</th>
                                      <th style={{ padding: "8px 14px" }}>Amount</th>
                                      <th style={{ padding: "8px 14px" }}>Reference</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {tgt.matchingSales.map((sale) => (
                                      <tr key={sale.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                                        <td style={{ padding: "8px 14px", color: "#0f172a", whiteSpace: "nowrap" }}>
                                          {sale.sale_date}
                                        </td>
                                        <td style={{ padding: "8px 14px", fontWeight: 600, color: "#0f172a" }}>
                                          {sale.outlet || "Direct Sale"}
                                        </td>
                                        <td style={{ padding: "8px 14px", color: "#065f46" }}>
                                          {sale.drink_type}
                                        </td>
                                        <td style={{ padding: "8px 14px", fontWeight: 700 }}>
                                          {sale.quantity} {sale.unit_type === 2 ? "Cases" : "Bottles"}
                                        </td>
                                        <td style={{ padding: "8px 14px", color: "#0f172a", whiteSpace: "nowrap" }}>
                                          ₦{Number(sale.total_amount || 0).toLocaleString()}
                                        </td>
                                        <td style={{ padding: "8px 14px", color: "#94a3b8", fontSize: 11 }}>
                                          {sale.reference || "N/A"}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── CREATE QUICK TARGETS MODAL (Matching Image 3) ── */}
      {createModalOpen && (
        <div className="tgt-modal-backdrop" role="dialog" aria-modal="true">
          <div className="tgt-modal-dialog">
            {/* Modal Header */}
            <div className="tgt-modal-header">
              <div className="tgt-modal-header-text">
                <div style={{ textAlign: "center", marginBottom: 4, color: "#94a3b8" }}>
                  <Layers size={16} />
                </div>
                <h3>Create Quick Targets</h3>
                <p>Add products, review the carton rollup, select staff, then set the period.</p>
              </div>
              <button
                type="button"
                className="tgt-modal-close"
                onClick={() => setCreateModalOpen(false)}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTargetsSubmit}>
              <div className="tgt-modal-body">
                {/* 1. Assign staff */}
                <div className="tgt-field-group">
                  <div className="tgt-field-label">
                    <span>Assign staff</span>
                    <small style={{ color: "#075544", cursor: "pointer" }} onClick={() => setSelectedStaffIds(staffList.map((s) => s.id))}>
                      Select all
                    </small>
                  </div>

                  <div className="tgt-staff-picker-wrap">
                    <div style={{ padding: "8px 10px", borderBottom: "1px solid #e2e8e5", position: "relative" }}>
                      <Search size={13} style={{ position: "absolute", left: 16, top: 16, color: "#94a3b8" }} />
                      <input
                        type="text"
                        placeholder="Search staff..."
                        value={staffSearchQuery}
                        onChange={(e) => setStaffSearchQuery(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "6px 10px 6px 28px",
                          borderRadius: 6,
                          border: "1px solid #d4ded9",
                          fontSize: 12,
                          outline: "none",
                        }}
                      />
                    </div>

                    <div className="tgt-staff-scroll-box">
                      <span style={{ fontSize: 11, color: "#68746f", padding: "2px 6px" }}>
                        Tap names to select one or more staff ({selectedStaffIds.length} selected):
                      </span>
                      {filteredStaffList.map((s) => {
                        const isSelected = selectedStaffIds.includes(s.id);
                        return (
                          <div
                            key={s.id}
                            className={`tgt-staff-check-row ${isSelected ? "selected" : ""}`}
                            onClick={() => toggleSelectStaff(s.id)}
                          >
                            <span>
                              {s.name} ({s.role})
                            </span>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              style={{ cursor: "pointer" }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 2. Products */}
                <div className="tgt-field-group">
                  <div className="tgt-field-label">
                    <span>Products</span>
                    <button
                      type="button"
                      className="btn-secondary-target"
                      onClick={handleAddDrinkRow}
                      style={{ padding: "3px 8px", fontSize: 11 }}
                    >
                      <Plus size={12} /> Add
                    </button>
                  </div>

                  <div>
                    {drinkRows.map((row) => (
                      <div key={row.id} className="tgt-drink-row-item">
                        <select
                          value={row.drinkId}
                          onChange={(e) => handleDrinkChange(row.id, e.target.value)}
                          required
                        >
                          <option value="">Select product</option>
                          {availableDrinks.map((d) => {
                            const isAlreadyChosen =
                              alreadySelectedDrinkIds.includes(d.id) && d.id !== row.drinkId;
                            return (
                              <option key={d.id} value={d.id} disabled={isAlreadyChosen}>
                                {d.name} {isAlreadyChosen ? "(Selected)" : ""}
                              </option>
                            );
                          })}
                        </select>

                        <select
                          value={row.unit}
                          onChange={(e) => handleUnitChange(row.id, e.target.value as TargetUnit)}
                        >
                          <option value="Bottles">Bottles</option>
                          <option value="Cases">Cases</option>
                        </select>

                        <input
                          type="number"
                          min={1}
                          placeholder="Qty"
                          value={row.qty}
                          onChange={(e) => handleQtyChange(row.id, parseInt(e.target.value) || 0)}
                          required
                        />

                        {drinkRows.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => handleRemoveDrinkRow(row.id)}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "#dc2626",
                              cursor: "pointer",
                              padding: 4,
                            }}
                            title="Remove row"
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : (
                          <div />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Compact summary */}
                <div className="tgt-compact-summary-box">
                  <div className="tgt-compact-header">
                    <span>Compact summary</span>
                    <button
                      type="button"
                      onClick={() => setSummaryExpanded((prev) => !prev)}
                    >
                      {summaryExpanded ? "Hide" : "Show"}
                    </button>
                  </div>

                  {!summaryExpanded ? (
                    <div className="tgt-compact-desc">
                      Summary collapsed. Tap show to review carton totals and conversions.
                    </div>
                  ) : (
                    <div style={{ marginTop: 8, fontSize: 11.5, color: "#17201d" }}>
                      <div>Total Products In Bundle: <strong>{drinkRows.filter((r) => r.drinkId).length}</strong></div>
                      <div>Total Volume Rollup: <strong>{totalCartonsRollup} Units</strong> per staff</div>
                      <div>Staff Assigned: <strong>{selectedStaffIds.length} Rep(s)</strong></div>
                      <div style={{ color: "#065f46", fontWeight: 700, marginTop: 4 }}>
                        Grand Total Target: {totalCartonsRollup * Math.max(1, selectedStaffIds.length)} Units
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Target Type & Date Window */}
                <div className="tgt-field-group">
                  <span className="tgt-field-label">Target Cadence</span>
                  <select
                    className="targets-select-filter"
                    value={createTargetType}
                    onChange={(e) => setCreateTargetType(e.target.value as TargetType)}
                  >
                    <option value="Weekly Cases">Weekly Cases (Standard)</option>
                    <option value="Daily Bottles">Daily Bottles (Default: min 4/day)</option>
                    <option value="Monthly Revenue">Monthly Revenue Target</option>
                    <option value="Visit Targets">Visit Requirements</option>
                  </select>
                </div>

                <div className="tgt-dates-row">
                  <div className="tgt-field-group">
                    <span className="tgt-field-label">From</span>
                    <input
                      type="date"
                      value={createStartDate}
                      onChange={(e) => setCreateStartDate(e.target.value)}
                      className="targets-select-filter"
                      required
                    />
                  </div>
                  <div className="tgt-field-group">
                    <span className="tgt-field-label">To</span>
                    <input
                      type="date"
                      value={createEndDate}
                      onChange={(e) => setCreateEndDate(e.target.value)}
                      className="targets-select-filter"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="tgt-modal-footer">
                <button
                  type="submit"
                  className="tgt-submit-btn"
                  disabled={isSubmittingCreate || selectedStaffIds.length === 0}
                >
                  {isSubmittingCreate
                    ? "Creating targets..."
                    : `Create Target(s) for ${selectedStaffIds.length || 0} Staff`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── PUSH TARGETS BROADCAST MODAL (NSM & Admin only) ── */}
      {pushModalOpen && (
        <div className="tgt-modal-backdrop" role="dialog" aria-modal="true">
          <div className="tgt-modal-dialog">
            <div className="tgt-modal-header">
              <div className="tgt-modal-header-text">
                <div style={{ textAlign: "center", marginBottom: 4, color: "#083e32" }}>
                  <Send size={16} />
                </div>
                <h3>Push Targets to Team</h3>
                <p>Broadcast sales quotas, templates, and multi-channel notifications.</p>
              </div>
              <button
                type="button"
                className="tgt-modal-close"
                onClick={() => setPushModalOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePushTargetsSubmit}>
              <div className="tgt-modal-body">
                {/* 1. Template */}
                <div className="tgt-field-group">
                  <span className="tgt-field-label">Select Target Template</span>
                  <select
                    className="targets-select-filter"
                    value={pushTemplate}
                    onChange={(e) => setPushTemplate(e.target.value)}
                  >
                    <option value="Monthly Sales Target">Monthly Sales Target (Volume Rollup)</option>
                    <option value="Weekly Visit Requirement">Weekly Visit Requirement (Coverage)</option>
                    <option value="Quarterly Revenue Target">Quarterly Revenue Target</option>
                    <option value="Outlet Coverage Target">Outlet Coverage & Placement Target</option>
                  </select>
                </div>

                {/* 2. Choose team members by role */}
                <div className="tgt-field-group">
                  <span className="tgt-field-label">Target Audience / Role</span>
                  <select
                    className="targets-select-filter"
                    value={pushRecipientRole}
                    onChange={(e) => setPushRecipientRole(e.target.value)}
                  >
                    <option value="Brand Ambassador">Brand Ambassadors (BA)</option>
                    <option value="Sales Executive">Sales Executives (SE)</option>
                    <option value="Regional Sales Manager">Regional Sales Managers (RSM)</option>
                    <option value="VSR">Van Sales Representatives (VSR)</option>
                    <option value="All">All Field Staff</option>
                  </select>
                </div>

                {/* 3. Notification Type */}
                <div className="tgt-field-group">
                  <span className="tgt-field-label">Notification Channel</span>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                    {(["In-App", "Email", "SMS", "Push"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setPushNotificationType(type)}
                        className={`btn-secondary-target ${
                          pushNotificationType === type ? "btn-primary-target" : ""
                        }`}
                        style={{ justifyContent: "center", fontSize: 12, padding: "8px 6px" }}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Delivery Timing */}
                <div className="tgt-field-group">
                  <span className="tgt-field-label">Delivery Timing</span>
                  <div style={{ display: "flex", gap: 12 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="timing"
                        checked={pushTiming === "Immediate"}
                        onChange={() => setPushTiming("Immediate")}
                      />
                      Immediate Broadcast
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="timing"
                        checked={pushTiming === "Scheduled"}
                        onChange={() => setPushTiming("Scheduled")}
                      />
                      Scheduled
                    </label>
                  </div>

                  {pushTiming === "Scheduled" && (
                    <input
                      type="datetime-local"
                      value={pushScheduledDate}
                      onChange={(e) => setPushScheduledDate(e.target.value)}
                      className="targets-select-filter"
                      style={{ marginTop: 8 }}
                      required
                    />
                  )}
                </div>

                {/* Recent Notifications Log */}
                <div style={{ marginTop: 6, paddingTop: 10, borderTop: "1px solid #edf1ef" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#17201d", display: "block", marginBottom: 6 }}>
                    Recent Push Notifications ({pushLogs.length})
                  </span>
                  <div style={{ maxHeight: 110, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                    {pushLogs.slice(0, 3).map((log) => (
                      <div
                        key={log.id}
                        style={{
                          padding: "6px 10px",
                          background: "#f9faf9",
                          border: "1px solid #edf1ef",
                          borderRadius: 6,
                          fontSize: 11,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <strong>{log.template}</strong> · {log.recipientsRole}
                          <div style={{ color: "#68746f" }}>{log.sentAt} via {log.notificationType}</div>
                        </div>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: log.status === "Delivered" ? "#059669" : "#d97706",
                            background: log.status === "Delivered" ? "#ecfdf5" : "#fffbeb",
                            padding: "2px 6px",
                            borderRadius: 6,
                          }}
                        >
                          {log.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="tgt-modal-footer">
                <button type="submit" className="tgt-submit-btn">
                  Push Target Notification
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── RECORD SALE AGAINST TARGET MODAL ── */}
      {recordSaleTarget && (
        <div className="tgt-modal-backdrop" role="dialog" aria-modal="true">
          <div className="tgt-modal-dialog" style={{ maxWidth: 520 }}>
            <div className="tgt-modal-header">
              <div className="tgt-modal-header-text">
                <div style={{ textAlign: "center", marginBottom: 4, color: "#065f46" }}>
                  <TrendingUp size={16} />
                </div>
                <h3>Record Sale Against Target</h3>
                <p>
                  Log an individual sale contributing to <strong>{recordSaleTarget.salesRep.name}</strong>'s quota ({recordSaleTarget.targetQuantity} {recordSaleTarget.unit}).
                </p>
              </div>
              <button
                type="button"
                className="tgt-modal-close"
                onClick={() => setRecordSaleTarget(null)}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRecordSaleSubmit}>
              <div className="tgt-modal-body">
                {/* 1. Target Product */}
                <div className="tgt-field-group">
                  <span className="tgt-field-label">Target Product</span>
                  {recordSaleTarget.bundledDrinks && recordSaleTarget.bundledDrinks.length > 0 ? (
                    <select
                      className="targets-select-filter"
                      value={recordDrinkName}
                      onChange={(e) => setRecordDrinkName(e.target.value)}
                      required
                    >
                      {recordSaleTarget.bundledDrinks.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="targets-select-filter"
                      value={recordDrinkName}
                      readOnly
                      style={{ background: "#f8fafc" }}
                    />
                  )}
                </div>

                {/* 2. Outlet */}
                <div className="tgt-field-group">
                  <span className="tgt-field-label">Retail Outlet</span>
                  {outletsList.length > 0 ? (
                    <select
                      className="targets-select-filter"
                      value={recordOutletId}
                      onChange={(e) => setRecordOutletId(e.target.value)}
                      required
                    >
                      {outletsList.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name} {o.state ? `(${o.state})` : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="targets-select-filter"
                      placeholder="Enter outlet or store name"
                      value={recordCustomOutlet}
                      onChange={(e) => setRecordCustomOutlet(e.target.value)}
                      required
                    />
                  )}
                </div>

                {/* 3. Quantity & Unit */}
                <div className="tgt-dates-row">
                  <div className="tgt-field-group">
                    <span className="tgt-field-label">Quantity</span>
                    <input
                      type="number"
                      min={1}
                      className="targets-select-filter"
                      value={recordQty}
                      onChange={(e) => setRecordQty(Math.max(1, parseInt(e.target.value) || 1))}
                      required
                    />
                  </div>
                  <div className="tgt-field-group">
                    <span className="tgt-field-label">Unit Type</span>
                    <select
                      className="targets-select-filter"
                      value={recordUnit}
                      onChange={(e) => setRecordUnit(e.target.value as TargetUnit)}
                    >
                      <option value="Cases">Cases</option>
                      <option value="Bottles">Bottles</option>
                    </select>
                  </div>
                </div>

                {/* 4. Sale Date & Price */}
                <div className="tgt-dates-row">
                  <div className="tgt-field-group">
                    <span className="tgt-field-label">Sale Date</span>
                    <input
                      type="date"
                      className="targets-select-filter"
                      value={recordSaleDate}
                      onChange={(e) => setRecordSaleDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="tgt-field-group">
                    <span className="tgt-field-label">Unit Price (₦)</span>
                    <input
                      type="number"
                      min={0}
                      step={500}
                      className="targets-select-filter"
                      value={recordUnitPrice}
                      onChange={(e) => setRecordUnitPrice(Math.max(0, parseInt(e.target.value) || 0))}
                      required
                    />
                  </div>
                </div>

                {/* Rollup Summary */}
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "10px 14px", borderRadius: 8, fontSize: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#166534" }}>
                    <span>Total Transaction Value:</span>
                    <strong>₦{(recordQty * recordUnitPrice).toLocaleString()}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#166534", marginTop: 4 }}>
                    <span>Sales Progress Impact:</span>
                    <strong>+{recordQty} {recordUnit} toward quota</strong>
                  </div>
                </div>
              </div>

              <div className="tgt-modal-footer">
                <button
                  type="button"
                  className="btn-secondary-target"
                  onClick={() => setRecordSaleTarget(null)}
                  style={{ padding: "9px 14px" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="tgt-submit-btn"
                  style={{ width: "auto", minWidth: 160 }}
                  disabled={isSubmittingSale}
                >
                  {isSubmittingSale ? "Recording sale..." : "Save & Update Progress"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT TARGET MODAL (Admin Only) ── */}
      {isAdmin && editModalOpen && (
        <div className="tgt-modal-backdrop" role="dialog" aria-modal="true">
          <div className="tgt-modal-dialog">
            <div className="tgt-modal-header">
              <div className="tgt-modal-header-text">
                <div style={{ textAlign: "center", marginBottom: 4, color: "#1d4ed8" }}>
                  <Pencil size={18} />
                </div>
                <h3>Edit Sales Target</h3>
                <p>Modify quota parameters, assigned personnel, cadence, and timeline.</p>
              </div>
              <button
                type="button"
                className="tgt-modal-close"
                onClick={() => setEditModalOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditTargetSubmit}>
              <div className="tgt-modal-body">
                {/* 1. Target Title / Product */}
                <div className="tgt-field-group">
                  <span className="tgt-field-label">Target Name / Product</span>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="targets-select-filter"
                    required
                  />
                </div>

                {/* 2. Assigned Staff Member */}
                <div className="tgt-field-group">
                  <span className="tgt-field-label">Assigned Representative</span>
                  <select
                    className="targets-select-filter"
                    value={editStaffId}
                    onChange={(e) => setEditStaffId(e.target.value)}
                    required
                  >
                    <option value="">Select sales representative</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.role} · {s.region})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Target Quantity & Unit */}
                <div className="tgt-dates-row">
                  <div className="tgt-field-group">
                    <span className="tgt-field-label">Target Quantity</span>
                    <input
                      type="number"
                      min={1}
                      value={editQuantity}
                      onChange={(e) => setEditQuantity(parseInt(e.target.value) || 0)}
                      className="targets-select-filter"
                      required
                    />
                  </div>
                  <div className="tgt-field-group">
                    <span className="tgt-field-label">Unit</span>
                    <select
                      className="targets-select-filter"
                      value={editUnit}
                      onChange={(e) => setEditUnit(e.target.value as TargetUnit)}
                    >
                      <option value="Cases">Cases</option>
                      <option value="Bottles">Bottles</option>
                    </select>
                  </div>
                </div>

                {/* 4. Target Cadence & Status */}
                <div className="tgt-dates-row">
                  <div className="tgt-field-group">
                    <span className="tgt-field-label">Target Cadence</span>
                    <select
                      className="targets-select-filter"
                      value={editTargetType}
                      onChange={(e) => setEditTargetType(e.target.value as TargetType)}
                    >
                      <option value="Weekly Cases">Weekly Cases (Standard)</option>
                      <option value="Daily Bottles">Daily Bottles</option>
                      <option value="Monthly Revenue">Monthly Revenue</option>
                      <option value="Visit Targets">Visit Requirements</option>
                    </select>
                  </div>
                  <div className="tgt-field-group">
                    <span className="tgt-field-label">Status</span>
                    <select
                      className="targets-select-filter"
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as TargetStatus)}
                    >
                      <option value="Active">Active</option>
                      <option value="Completed">Completed</option>
                      <option value="Behind Pace">Behind Pace</option>
                      <option value="Pending">Pending</option>
                    </select>
                  </div>
                </div>

                {/* 5. Date Window */}
                <div className="tgt-dates-row">
                  <div className="tgt-field-group">
                    <span className="tgt-field-label">Start Date</span>
                    <input
                      type="date"
                      value={editStartDate}
                      onChange={(e) => setEditStartDate(e.target.value)}
                      className="targets-select-filter"
                      required
                    />
                  </div>
                  <div className="tgt-field-group">
                    <span className="tgt-field-label">End Date</span>
                    <input
                      type="date"
                      value={editEndDate}
                      onChange={(e) => setEditEndDate(e.target.value)}
                      className="targets-select-filter"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="tgt-modal-footer">
                <button
                  type="button"
                  className="btn-secondary-target"
                  onClick={() => setEditModalOpen(false)}
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
                  {isSubmittingEdit ? "Updating..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}