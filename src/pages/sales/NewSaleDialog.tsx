import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { createMultipleSales } from "../../services/salesService";
import { getOutlets, getDrinkTypes, createOutlet } from "../../services/referenceService";
import { getActiveVisit, createVisit, type ActiveVisit } from "../../services/visitsService";
import { getUserScope, filterOutletsByScope } from "../../services/dataScopeService";
import { getCurrentPosition, formatGpsError } from "../visits/visitsUtils";
import {
  UNIT_TYPE_VALUES,
  PAYMENT_METHOD_VALUES,
} from "../../config/choices";
import { useDragPosition } from "../visits/useDragPosition";
import {
  AlertCircle,
  Banknote,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Coins,
  CreditCard,
  DollarSign,
  Info,
  Minus,
  Package,
  Plus,
  QrCode,
  Store,
  Trash2,
  X,
  Zap,
} from "lucide-react";

type OutletOption = {
  id: string;
  name: string;
  address?: string | null;
  state?: string | null;
  region_id?: string | null;
};

type DrinkTypeOption = {
  id: string;
  name: string;
  category?: string | null;
  bottles_per_case: number;
  price_per_bottle?: number | null;
  price_per_case?: number | null;
};

export type SaleItemEntry = {
  id: string;
  drinkTypeId: string;
  unitType: number;
  quantity: string;
  unitPrice: number;
  totalAmount: number;
};

type NewSaleDialogProps = {
  /** Called after the sale is saved successfully, before the dialog closes. */
  onSaved: (successMessage: string) => void;
  onClose: () => void;
};

export function NewSaleDialog({ onSaved, onClose }: NewSaleDialogProps) {
  const { staff, role } = useAuth();
  const { position, startDrag } = useDragPosition();

  // Role detection & Scope
  const userScope = useMemo(() => getUserScope(staff, role), [staff, role]);
  const roleKey = (role?.key || staff?.user_roles?.key || staff?.assigned_role || "").toLowerCase();
  const isBrandAmbassador = roleKey === "brand_ambassador" || roleKey === "ba";
  const isVsr = roleKey === "vsr";
  const canRecordWithoutCheckIn = true; // Direct sales entry enabled for BA and field reps

  // Reference data
  const [outlets, setOutlets] = useState<OutletOption[]>([]);
  const [drinkTypes, setDrinkTypes] = useState<DrinkTypeOption[]>([]);
  const [activeVisit, setActiveVisit] = useState<ActiveVisit | null>(null);

  // Transaction header state
  const [outletId, setOutletId] = useState("");
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState<number | string>(PAYMENT_METHOD_VALUES.cash);
  const [amountPaid, setAmountPaid] = useState("");
  const [isManualPaidEntry, setIsManualPaidEntry] = useState(false);

  // Multiple sales entries
  const [items, setItems] = useState<SaleItemEntry[]>([
    {
      id: "item-1",
      drinkTypeId: "",
      unitType: isBrandAmbassador ? UNIT_TYPE_VALUES.bottles : UNIT_TYPE_VALUES.cases,
      quantity: "1",
      unitPrice: 0,
      totalAmount: 0,
    },
  ]);

  // VSR Quick Create Outlet form state
  const [showCreateOutlet, setShowCreateOutlet] = useState(false);
  const [newOutletName, setNewOutletName] = useState("");
  const [newOutletType, setNewOutletType] = useState("1"); // 1 = On-Trade, 2 = Off-Trade
  const [newOutletAddress, setNewOutletAddress] = useState("");
  const [newOutletState, setNewOutletState] = useState("Lagos");
  const [newOutletPhone, setNewOutletPhone] = useState("");
  const [savingNewOutlet, setSavingNewOutlet] = useState(false);
  const [quickCheckinLoading, setQuickCheckinLoading] = useState(false);

  // Dialog status
  const [loading, setLoading] = useState(false);
  const [loadingReferences, setLoadingReferences] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  /* Load reference data and active check-in */
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const [outletData, drinkData, active] = await Promise.all([
          getOutlets(),
          getDrinkTypes(),
          staff?.id ? getActiveVisit(staff.id) : Promise.resolve(null),
        ]);

        if (cancelled) return;

        const scopedOutlets = filterOutletsByScope(outletData, userScope);
        setOutlets(scopedOutlets);
        setDrinkTypes(drinkData);
        setActiveVisit(active);

        // Pre-select outlet if checked in
        if (active) {
          const matched = scopedOutlets.find(
            (o) => o.id === active.outletId || o.name === active.outlet
          );
          if (matched) {
            setOutletId(matched.id);
          } else if (active.outletId) {
            setOutletId(active.outletId);
          }
        }
      } catch (err: unknown) {
        console.error(err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load sales reference data.");
        }
      } finally {
        if (!cancelled) setLoadingReferences(false);
      }
    }

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [staff?.id]);

  // Keyboard shortcut listener (Esc to close, Ctrl+Enter to submit)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading && !savingNewOutlet) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, loading, savingNewOutlet]);

  const filteredOutlets = useMemo(() => {
    return [...outlets].sort((a, b) => a.name.localeCompare(b.name));
  }, [outlets]);

  const selectedOutletObj = useMemo(() => {
    return outlets.find((o) => o.id === outletId);
  }, [outlets, outletId]);

  /* Helper to calculate item price and total */
  function computeItemPrice(drinkId: string, unitType: number) {
    const drink = drinkTypes.find((d) => d.id === drinkId);
    if (!drink) return 0;
    if (unitType === UNIT_TYPE_VALUES.bottles) {
      const bottlePrice = Number(drink.price_per_bottle ?? 0);
      if (bottlePrice > 0) return bottlePrice;
      const casePrice = Number(drink.price_per_case ?? 0);
      const bpc = Number(drink.bottles_per_case) || 1;
      return casePrice > 0 ? Math.round(casePrice / bpc) : 0;
    }
    const casePrice = Number(drink.price_per_case ?? 0);
    if (casePrice > 0) return casePrice;
    const bottlePrice = Number(drink.price_per_bottle ?? 0);
    const bpc = Number(drink.bottles_per_case) || 1;
    return bottlePrice > 0 ? bottlePrice * bpc : 0;
  }

  /* Aggregate financials */
  const aggregateTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.totalAmount, 0);
  }, [items]);

  const totalUnits = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  }, [items]);

  // Brand Ambassadors have payment marked as paid automatically
  const effectivePaid = useMemo(() => {
    if (isBrandAmbassador) return aggregateTotal;
    if (!isManualPaidEntry && amountPaid === "") return aggregateTotal; // Default to 100% paid if untouched
    return Number(amountPaid || 0);
  }, [isBrandAmbassador, isManualPaidEntry, amountPaid, aggregateTotal]);

  const balance = Math.max(0, aggregateTotal - effectivePaid);

  /* Quick Payment Shortcut Helpers */
  const handleSetFullPayment = () => {
    setIsManualPaidEntry(true);
    setAmountPaid(String(aggregateTotal));
    setError("");
  };

  const handleSetHalfPayment = () => {
    setIsManualPaidEntry(true);
    setAmountPaid(String(Math.round(aggregateTotal / 2)));
    setError("");
  };

  const handleSetZeroPayment = () => {
    setIsManualPaidEntry(true);
    setAmountPaid("0");
    setError("");
  };

  /* Handle Item Field Changes */
  function handleItemChange(id: string, field: keyof SaleItemEntry, value: any) {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id !== id) return item;

        const updated = { ...item, [field]: value };

        if (field === "unitPrice") {
          const price = Math.max(0, Number(value || 0));
          const qty = Math.max(0, Number(updated.quantity || 0));
          updated.unitPrice = price;
          updated.totalAmount = qty * price;
          return updated;
        }

        if (field === "quantity") {
          const qty = Math.max(0, Number(value || 0));
          updated.totalAmount = qty * (Number(updated.unitPrice) || 0);
          return updated;
        }

        if (field === "drinkTypeId" || field === "unitType") {
          const price = computeItemPrice(updated.drinkTypeId, updated.unitType);
          const qty = Math.max(0, Number(updated.quantity || 0));
          updated.unitPrice = price;
          updated.totalAmount = qty * price;
        }

        return updated;
      })
    );
  }

  /* Quick Quantity Increment / Presets */
  function handleAdjustQty(id: string, delta: number) {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id !== id) return item;
        const current = Number(item.quantity || 0);
        const nextQty = Math.max(1, current + delta);
        const price = item.unitPrice > 0 ? item.unitPrice : computeItemPrice(item.drinkTypeId, item.unitType);

        return {
          ...item,
          quantity: String(nextQty),
          unitPrice: price,
          totalAmount: nextQty * price,
        };
      })
    );
  }

  function handleSetQtyPreset(id: string, presetQty: number) {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id !== id) return item;
        const price = item.unitPrice > 0 ? item.unitPrice : computeItemPrice(item.drinkTypeId, item.unitType);

        return {
          ...item,
          quantity: String(presetQty),
          unitPrice: price,
          totalAmount: presetQty * price,
        };
      })
    );
  }

  /* Add new sale entry */
  function handleAddItem() {
    const newId = `item-${Date.now()}-${items.length + 1}`;
    setItems((prev) => [
      ...prev,
      {
        id: newId,
        drinkTypeId: "",
        unitType: isBrandAmbassador ? UNIT_TYPE_VALUES.bottles : UNIT_TYPE_VALUES.cases,
        quantity: "1",
        unitPrice: 0,
        totalAmount: 0,
      },
    ]);
  }

  /* Remove sale entry */
  function handleRemoveItem(id: string) {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  /* Quick-create outlet handler for VSR */
  async function handleCreateNewOutlet(e: FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");

    if (!newOutletName.trim()) {
      setError("Please provide an outlet name.");
      return;
    }

    if (!newOutletAddress.trim()) {
      setError("Please provide an address for the outlet.");
      return;
    }

    setSavingNewOutlet(true);
    try {
      const region = staff?.region || newOutletState || "Lagos Central";
      const created = await createOutlet({
        name: newOutletName.trim(),
        outletType: newOutletType,
        listingStatus: "1",
        regionId: region,
        address: newOutletAddress.trim(),
        state: newOutletState,
        lga: "Central",
        latitude: null,
        longitude: null,
        accuracy: null,
        capturedOn: null,
        contactName: "",
        contactPhone: newOutletPhone.trim(),
        contactEmail: "",
        assignedManager: staff?.id || "",
        remarks: "Created on the fly during sales entry",
      });

      const newOption: OutletOption = {
        id: created.id,
        name: created.name,
        address: created.address,
        state: created.state,
        region_id: created.region_id,
      };

      setOutlets((prev) => [newOption, ...prev]);
      setOutletId(created.id);
      setShowCreateOutlet(false);
      setNotice(`Outlet "${created.name}" created! You can now record sales.`);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unable to create outlet.");
    } finally {
      setSavingNewOutlet(false);
    }
  }

  /* Quick GPS Check-In for VSR / BA on created or selected outlet */
  async function handleQuickCheckin() {
    if (!outletId || !staff?.id) return;
    const selected = outlets.find((o) => o.id === outletId);
    if (!selected) return;

    setQuickCheckinLoading(true);
    setError("");
    setNotice("");

    try {
      const pos = await getCurrentPosition();
      const currentCoords = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? null,
      };

      const visit = await createVisit({
        outletId: selected.id,
        staffId: staff.id,
        latitude: currentCoords.latitude,
        longitude: currentCoords.longitude,
        accuracy: currentCoords.accuracy,
        distance: 10,
        visitType: "outlet",
      });

      setActiveVisit({
        ...visit,
        outletId: selected.id,
        outlet: selected.name,
        checkInAt: new Date().toISOString(),
      });

      setNotice(`Checked in to ${selected.name} successfully! Location verified.`);
    } catch (err: unknown) {
      console.error(err);
      setError(`GPS check-in failed: ${formatGpsError(err)}. Please ensure location permissions are enabled.`);
    } finally {
      setQuickCheckinLoading(false);
    }
  }

  /* Form submission handler */
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setNotice("");

    if (!staff) {
      setError("Your staff profile could not be found.");
      return;
    }

    if (!outletId) {
      setError("Please select a target retail outlet.");
      return;
    }

    // Role check-in constraints
    if (isVsr && !activeVisit) {
      setError("Van Sales Representatives must be checked in to an outlet to record sales.");
      return;
    }

    // Line items validation
    if (!items.length) {
      setError("Please add at least one sale item.");
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.drinkTypeId) {
        setError(`Item #${i + 1}: Please select a beverage from the list.`);
        return;
      }
      const qty = Number(item.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        setError(`Item #${i + 1}: Quantity must be at least 1.`);
        return;
      }
      if (!Number.isInteger(qty)) {
        setError(`Item #${i + 1}: Quantity must be a whole number.`);
        return;
      }
      if (!Number.isFinite(item.unitPrice) || item.unitPrice <= 0) {
        setError(`Item #${i + 1}: No valid unit price found for the selected beverage.`);
        return;
      }
      if (isBrandAmbassador && item.unitType !== UNIT_TYPE_VALUES.bottles) {
        setError("Brand Ambassadors can only record sales in bottles.");
        return;
      }
    }

    // Payment validation
    if (!isBrandAmbassador) {
      if (effectivePaid < 0) {
        setError("Amount paid cannot be negative.");
        return;
      }
      if (effectivePaid > aggregateTotal) {
        setError("Amount paid cannot be greater than the total amount.");
        return;
      }
      if (effectivePaid > 0 && !paymentMethod) {
        setError("Please select a valid payment method.");
        return;
      }
    }

    if (!saleDate) {
      setError("Please select a valid sale date.");
      return;
    }

    try {
      setLoading(true);

      const saleItemsPayload = items.map((item) => ({
        drinkTypeId: item.drinkTypeId,
        quantity: Number(item.quantity),
        unitType: isBrandAmbassador ? UNIT_TYPE_VALUES.bottles : item.unitType,
        unitPrice: item.unitPrice,
        totalAmount: item.totalAmount,
      }));

      await createMultipleSales({
        outletId,
        saleDate,
        paymentMethod: isBrandAmbassador
          ? PAYMENT_METHOD_VALUES.cash
          : typeof paymentMethod === "number"
          ? paymentMethod
          : Number(paymentMethod) || 1,
        amountPaid: effectivePaid,
        items: saleItemsPayload,
      });

      onSaved(
        items.length === 1
          ? "Sales transaction recorded successfully!"
          : `${items.length} beverage sale items recorded successfully!`
      );
      onClose();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unable to save sales transaction.");
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (loadingReferences) {
    return (
      <div className="new-sale-backdrop" role="presentation">
        <div className="new-sale-dialog new-sale-dialog-loading">
          <div className="new-sale-spinner" aria-hidden="true" />
          <span>Loading sales catalog and store directory...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="new-sale-backdrop" role="presentation" onClick={(e) => {
      if (e.target === e.currentTarget && !loading) onClose();
    }}>
      <section
        className="new-sale-dialog-modern"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-sale-title"
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
      >
        {/* ── Dialog Drag Handle & Header ── */}
        <header className="new-sale-header-pro" onPointerDown={startDrag}>
          <div className="header-pro-left">
            <div className="header-pro-icon">
              <Store size={20} />
            </div>
            <div>
              <div className="header-pro-title-row">
                <h3 id="new-sale-title">Record New Sale</h3>
                <span className="cart-count-pill">{items.length} {items.length === 1 ? "Item" : "Items"}</span>
              </div>
              <p className="header-pro-subtitle">
                Commercial billing, beverage line items & instant settlement
              </p>
            </div>
          </div>

          <div className="header-pro-actions" onPointerDown={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="dialog-close-btn-pro"
              onClick={onClose}
              disabled={loading}
              aria-label="Close sale dialog"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* ── Active Staff & Check-In Presence Strip ── */}
        <div className="new-sale-presence-strip">
          <div className="presence-rep-meta">
            <div className="presence-avatar">{staff?.name ? staff.name.slice(0, 2).toUpperCase() : "PE"}</div>
            <div className="presence-rep-details">
              <strong>{staff?.name ?? "Sales Representative"}</strong>
              <span>{role?.name ?? "Sales Staff"} {staff?.region ? `· ${staff.region}` : ""}</span>
            </div>
          </div>

          {activeVisit ? (
            <div className="presence-status-badge badge-active-checkin">
              <span className="live-pulse-dot" />
              <span>Checked in at: <strong>{activeVisit.outlet}</strong></span>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="presence-status-badge badge-direct-entry">
                <Info size={13} />
                <span>{canRecordWithoutCheckIn ? "Direct Sales Entry Enabled" : "No Active Visit Check-in"}</span>
              </div>
              {outletId && (
                <button
                  type="button"
                  onClick={() => void handleQuickCheckin()}
                  disabled={quickCheckinLoading}
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    padding: "3px 8px",
                    borderRadius: "6px",
                    background: "#075544",
                    color: "#ffffff",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {quickCheckinLoading ? "Checking in..." : "GPS Check-In"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Alert Notices ── */}
        {error && (
          <div className="dialog-alert-box alert-error" role="alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}
        {notice && (
          <div className="dialog-alert-box alert-success" role="status">
            <CheckCircle2 size={16} />
            <span>{notice}</span>
          </div>
        )}

        {/* ── Main Form ── */}
        <form onSubmit={handleSubmit} className="new-sale-form-body">
          {/* ── SECTION 1: STORE & TRANSACTION CONTEXT ── */}
          <div className="sale-form-section">
            <div className="section-label-row">
              <span className="section-step-num">1</span>
              <span className="section-title">Retail Account & Transaction Date</span>
            </div>

            <div className="form-two-col-grid">
              {/* Outlet Dropdown */}
              <div className="form-field-group">
                <div className="field-label-with-action">
                  <label htmlFor="sale-outlet">Retail Outlet *</label>
                  {!showCreateOutlet && isVsr && (
                    <button
                      type="button"
                      className="inline-action-link"
                      onClick={() => setShowCreateOutlet(true)}
                    >
                      <Plus size={12} />
                      + New Store
                    </button>
                  )}
                </div>

                <div className="select-with-icon-wrap">
                  <Store size={15} className="input-prefix-icon" />
                  <select
                    id="sale-outlet"
                    className="modern-form-input has-prefix"
                    value={outletId}
                    onChange={(e) => setOutletId(e.target.value)}
                    disabled={Boolean(isBrandAmbassador && activeVisit)}
                    required
                  >
                    <option value="">Select transacting retail store...</option>
                    {filteredOutlets.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name} {o.state ? `(${o.state})` : ""}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="input-suffix-icon" />
                </div>

                {selectedOutletObj && (
                  <span className="field-hint-text">
                    📍 {selectedOutletObj.address || selectedOutletObj.state || "Registered Direct Account"}
                  </span>
                )}
              </div>

              {/* Transaction Date */}
              <div className="form-field-group">
                <label htmlFor="sale-date">Sale Date *</label>
                <div className="select-with-icon-wrap">
                  <Calendar size={15} className="input-prefix-icon" />
                  <input
                    type="date"
                    id="sale-date"
                    className="modern-form-input has-prefix"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    required
                  />
                </div>
                <span className="field-hint-text">Posting period date</span>
              </div>
            </div>

            {/* VSR Inline Outlet Quick-Creator */}
            {showCreateOutlet && (
              <div className="inline-create-outlet-panel">
                <div className="inline-panel-header">
                  <div className="inline-title-wrap">
                    <Building2 size={16} />
                    <strong>Quick Register New Store</strong>
                  </div>
                  <button
                    type="button"
                    className="inline-close-btn"
                    onClick={() => setShowCreateOutlet(false)}
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="inline-panel-fields">
                  <div className="inline-row">
                    <input
                      type="text"
                      placeholder="Store Name (e.g., Crown Lounge)"
                      value={newOutletName}
                      onChange={(e) => setNewOutletName(e.target.value)}
                      className="inline-input"
                    />
                    <select
                      value={newOutletType}
                      onChange={(e) => setNewOutletType(e.target.value)}
                      className="inline-input inline-select"
                    >
                      <option value="1">On-Trade (Bar / Lounge)</option>
                      <option value="2">Off-Trade (Store / Depot)</option>
                    </select>
                  </div>
                  <div className="inline-row">
                    <input
                      type="text"
                      placeholder="Store Address / Street"
                      value={newOutletAddress}
                      onChange={(e) => setNewOutletAddress(e.target.value)}
                      className="inline-input"
                    />
                    <input
                      type="text"
                      placeholder="State (e.g. Lagos)"
                      value={newOutletState}
                      onChange={(e) => setNewOutletState(e.target.value)}
                      className="inline-input"
                    />
                    <input
                      type="tel"
                      placeholder="Manager Phone"
                      value={newOutletPhone}
                      onChange={(e) => setNewOutletPhone(e.target.value)}
                      className="inline-input"
                    />
                  </div>
                </div>

                <div className="inline-panel-actions">
                  <button
                    type="button"
                    className="inline-save-btn"
                    onClick={handleCreateNewOutlet}
                    disabled={savingNewOutlet}
                  >
                    {savingNewOutlet ? "Registering..." : "Save & Select Store"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── SECTION 2: BEVERAGE PRODUCT BASKET ── */}
          <div className="sale-form-section">
            <div className="section-label-row">
              <span className="section-step-num">2</span>
              <div className="section-title-wrap">
                <span className="section-title">Beverage Line Items Basket</span>
                <span className="section-subtext">Add drinks, unit package types & quantity</span>
              </div>
            </div>

            <div className="line-items-container">
              {items.map((item, index) => {
                const currentQty = Number(item.quantity) || 0;

                return (
                  <div className="line-item-card-pro" key={item.id}>
                    <div className="item-card-header">
                      <div className="item-num-chip">Item #{index + 1}</div>
                      {items.length > 1 && (
                        <button
                          type="button"
                          className="item-delete-btn"
                          onClick={() => handleRemoveItem(item.id)}
                          title="Remove item"
                        >
                          <Trash2 size={14} />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>

                    <div className="item-card-grid">
                      {/* Product Selector */}
                      <div className="item-field-product">
                        <label className="item-mini-label">Select Beverage *</label>
                        <select
                          className="modern-form-input item-product-select"
                          value={item.drinkTypeId}
                          onChange={(e) => handleItemChange(item.id, "drinkTypeId", e.target.value)}
                          required
                        >
                          <option value="">Choose drink...</option>
                          {drinkTypes.map((drink) => (
                            <option key={drink.id} value={drink.id}>
                              {drink.name} {drink.category ? `(${drink.category})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Package Unit Type */}
                      <div className="item-field-unit">
                        <label className="item-mini-label">Package Unit</label>
                        <div className="unit-toggle-pill-group">
                          <button
                            type="button"
                            className={`unit-toggle-btn ${
                              item.unitType === UNIT_TYPE_VALUES.cases ? "unit-active" : ""
                            }`}
                            onClick={() => handleItemChange(item.id, "unitType", UNIT_TYPE_VALUES.cases)}
                          >
                            <Package size={13} />
                            <span>Cases</span>
                          </button>
                          <button
                            type="button"
                            className={`unit-toggle-btn ${
                              item.unitType === UNIT_TYPE_VALUES.bottles ? "unit-active" : ""
                            }`}
                            onClick={() => handleItemChange(item.id, "unitType", UNIT_TYPE_VALUES.bottles)}
                          >
                            <Coins size={13} />
                            <span>Bottles</span>
                          </button>
                        </div>
                      </div>

                      {/* Quantity Stepper & Presets */}
                      <div className="item-field-qty">
                        <label className="item-mini-label">Quantity</label>
                        <div className="qty-stepper-wrap">
                          <button
                            type="button"
                            className="qty-step-btn"
                            onClick={() => handleAdjustQty(item.id, -1)}
                            disabled={currentQty <= 1}
                          >
                            <Minus size={13} />
                          </button>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(item.id, "quantity", e.target.value)}
                            className="qty-number-input"
                            required
                          />
                          <button
                            type="button"
                            className="qty-step-btn"
                            onClick={() => handleAdjustQty(item.id, 1)}
                          >
                            <Plus size={13} />
                          </button>
                        </div>

                        {/* Quick Presets */}
                        <div className="qty-presets-row">
                          <button type="button" onClick={() => handleSetQtyPreset(item.id, 1)} className="preset-pill">
                            1
                          </button>
                          <button type="button" onClick={() => handleSetQtyPreset(item.id, 5)} className="preset-pill">
                            5
                          </button>
                          <button type="button" onClick={() => handleSetQtyPreset(item.id, 10)} className="preset-pill">
                            10
                          </button>
                          <button type="button" onClick={() => handleSetQtyPreset(item.id, 20)} className="preset-pill">
                            20
                          </button>
                        </div>
                      </div>

                      {/* Line Item Total */}
                      <div className="item-field-total">
                        <label className="item-mini-label">Item Total</label>
                        <div className="item-total-display">
                          <strong>{formatCurrency(item.totalAmount)}</strong>
                          <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 2 }}>
                            <span style={{ fontSize: 11, color: "#64748b" }}>₦</span>
                            <input
                              type="number"
                              min="0"
                              step="100"
                              value={item.unitPrice || ""}
                              placeholder="0"
                              title="Click to edit unit price"
                              onChange={(e) => handleItemChange(item.id, "unitPrice", e.target.value)}
                              style={{
                                width: 78,
                                height: 20,
                                fontSize: 11,
                                padding: "0 4px",
                                border: "1px solid #cbd5e1",
                                borderRadius: 4,
                                background: "#ffffff",
                                color: "#0f172a",
                                fontWeight: 600,
                              }}
                            />
                            <span style={{ fontSize: 11, color: "#64748b" }}>
                              /{item.unitType === UNIT_TYPE_VALUES.cases ? "cs" : "btl"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Item Trigger */}
            <div className="add-item-bar">
              <button
                type="button"
                className="add-item-btn-pro"
                onClick={handleAddItem}
              >
                <Plus size={14} />
                <span>+ Add Another Beverage Item</span>
              </button>
            </div>
          </div>

          {/* ── SECTION 3: SETTLEMENT & PAYMENT ENGINE ── */}
          <div className="sale-form-section">
            <div className="section-label-row">
              <span className="section-step-num">3</span>
              <div className="section-title-wrap">
                <span className="section-title">Order Total & Settlement</span>
                <span className="section-subtext">Payment collection method, deposits or trade credit</span>
              </div>
            </div>

            <div className="settlement-container">
              {/* Grand Total Highlight Box */}
              <div className="grand-total-hero-card">
                <div className="grand-total-left">
                  <span className="grand-total-title">Total Transaction Value</span>
                  <strong className="grand-total-value">{formatCurrency(aggregateTotal)}</strong>
                  <span className="grand-total-meta">
                    {items.length} {items.length === 1 ? "Line Item" : "Line Items"} · {totalUnits} Total Units
                  </span>
                </div>

                {!isBrandAmbassador && (
                  <div className="grand-total-shortcuts">
                    <span className="shortcuts-title">1-Click Settlement:</span>
                    <div className="shortcuts-btn-group">
                      <button
                        type="button"
                        className="shortcut-btn shortcut-full"
                        onClick={handleSetFullPayment}
                        title="Set amount paid to 100%"
                      >
                        <Check size={12} />
                        100% Paid
                      </button>
                      <button
                        type="button"
                        className="shortcut-btn shortcut-half"
                        onClick={handleSetHalfPayment}
                        title="Set amount paid to 50%"
                      >
                        50% Deposit
                      </button>
                      <button
                        type="button"
                        className="shortcut-btn shortcut-zero"
                        onClick={handleSetZeroPayment}
                        title="Set as 100% credit"
                      >
                        Credit (₦0)
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {!isBrandAmbassador ? (
                <div className="payment-options-grid">
                  {/* Amount Paid input */}
                  <div className="form-field-group">
                    <label htmlFor="amount-paid">Amount Paid by Retailer (₦) *</label>
                    <div className="select-with-icon-wrap">
                      <DollarSign size={15} className="input-prefix-icon" />
                      <input
                        type="number"
                        id="amount-paid"
                        min="0"
                        max={aggregateTotal}
                        value={isManualPaidEntry ? amountPaid : aggregateTotal}
                        onChange={(e) => {
                          setIsManualPaidEntry(true);
                          setAmountPaid(e.target.value);
                        }}
                        className="modern-form-input has-prefix"
                        placeholder="0.00"
                        required
                      />
                    </div>
                    <div className="balance-indicator-row">
                      <span>Remaining Balance: <strong>{formatCurrency(balance)}</strong></span>
                      <span className={`settle-chip ${balance === 0 ? "chip-paid" : balance < aggregateTotal ? "chip-partial" : "chip-credit"}`}>
                        {balance === 0 ? "Fully Paid" : balance < aggregateTotal ? "Partial Deposit" : "100% Credit"}
                      </span>
                    </div>
                  </div>

                  {/* Payment Method Selector */}
                  <div className="form-field-group">
                    <label>Payment Channel *</label>
                    <div className="payment-channels-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                      <button
                        type="button"
                        className={`channel-pill ${paymentMethod === PAYMENT_METHOD_VALUES.cash ? "channel-active" : ""}`}
                        onClick={() => setPaymentMethod(PAYMENT_METHOD_VALUES.cash)}
                      >
                        <Banknote size={14} />
                        <span>Cash</span>
                      </button>
                      <button
                        type="button"
                        className={`channel-pill ${paymentMethod === PAYMENT_METHOD_VALUES.bank_transfer ? "channel-active" : ""}`}
                        onClick={() => setPaymentMethod(PAYMENT_METHOD_VALUES.bank_transfer)}
                      >
                        <CreditCard size={14} />
                        <span>Transfer</span>
                      </button>
                      <button
                        type="button"
                        className={`channel-pill ${paymentMethod === PAYMENT_METHOD_VALUES.pos ? "channel-active" : ""}`}
                        onClick={() => setPaymentMethod(PAYMENT_METHOD_VALUES.pos)}
                      >
                        <QrCode size={14} />
                        <span>POS</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="ba-settlement-notice">
                  <CheckCircle2 size={16} />
                  <span>
                    Brand Ambassador Mode: Retail bottle sales are marked as <strong>Fully Settled in Cash</strong> automatically.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── SECTION 4: DIALOG FOOTER & ACTIONS ── */}
          <footer className="new-sale-footer-pro">
            <button
              type="button"
              className="dialog-cancel-btn-pro"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>

            <button
              id="confirm-record-sale-btn"
              type="submit"
              className="dialog-submit-btn-pro"
              disabled={
                loading ||
                !outletId ||
                items.length === 0 ||
                items.some((item) => !item.drinkTypeId || Number(item.quantity) <= 0)
              }
            >
              {loading ? (
                <>
                  <div className="btn-spinner" />
                  <span>Recording Transaction...</span>
                </>
              ) : (
                <>
                  <Zap size={16} />
                  <span>Confirm Sale & Record Receipt ({formatCurrency(aggregateTotal)})</span>
                </>
              )}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
