import { useEffect, useState, useMemo } from "react";
import {
  Wine,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Calendar,
  Search,
  Tag,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  getDrinkTypes,
  createDrinkType,
  updateDrinkType,
  deleteDrinkType,
  type DrinkType,
  type CreateDrinkTypeInput,
} from "../../services/referenceService";
import LogoLoader from "../../components/brand/LogoLoader";
import { useMinimumLoading } from "../../hooks/useMinimumLoading";

export function DrinksAndProductsSection() {
  const { staff, user } = useAuth();
  const currentUserName = staff?.name || user?.email || "System Admin";

  const [drinks, setDrinks] = useState<DrinkType[]>([]);
  const [loading, setLoading] = useState(true);
  const visibleLoading = useMinimumLoading(loading, 600);
  const [error, setError] = useState("");
  const [notification, setNotification] = useState("");

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDrink, setEditingDrink] = useState<DrinkType | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [category, setCategory] = useState("No category");
  const [customCategory, setCustomCategory] = useState("");
  const [pricePerBottle, setPricePerBottle] = useState<number | "">("");
  const [pricePerCase, setPricePerCase] = useState<number | "">("");
  const [bottlesPerCase, setBottlesPerCase] = useState<number | "">(12);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Delete Confirmation State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadDrinks() {
    setLoading(true);
    setError("");
    try {
      const data = await getDrinkTypes();
      setDrinks(data);
    } catch (err: any) {
      console.error("Failed to load drink types:", err);
      setError(err?.message || "Failed to load drinks list from database.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDrinks();
  }, []);

  // Filtered items
  const filteredDrinks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return drinks.filter((d) => {
      if (selectedCategory !== "all") {
        const dCat = d.category || "Uncategorised";
        if (dCat !== selectedCategory) return false;
      }
      if (q) {
        return (
          d.name.toLowerCase().includes(q) ||
          (d.category || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [drinks, searchQuery, selectedCategory]);

  // Reset page to 1 if page exceeds total pages after drink removal or filter
  const totalItems = filteredDrinks.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  
  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  // Paginated items
  const paginatedDrinks = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredDrinks.slice(start, start + pageSize);
  }, [filteredDrinks, page, pageSize]);

  // Category counts for filter pills
  const categoryStats = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of drinks) {
      const cat = d.category || "Uncategorised";
      map[cat] = (map[cat] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [drinks]);

  // Derive unique categories from existing drinks plus default options
  const categoryOptions = Array.from(
    new Set([
      "Spirits",
      "Beer",
      "Wine",
      "Liquor",
      "Champagne",
      "Non-Alcoholic",
      ...drinks.map((d) => d.category).filter((c): c is string => Boolean(c)),
    ])
  ).sort();

  function handleOpenCreateModal() {
    setEditingDrink(null);
    setName("");
    setCategory("No category");
    setCustomCategory("");
    setPricePerBottle(0);
    setPricePerCase(0);
    setBottlesPerCase(12);
    setFormError("");
    setModalOpen(true);
  }

  function handleOpenEditModal(drink: DrinkType) {
    setEditingDrink(drink);
    setName(drink.name);
    setCategory(drink.category || "No category");
    setCustomCategory("");
    setPricePerBottle(drink.price_per_bottle ?? 0);
    setPricePerCase(drink.price_per_case ?? 0);
    setBottlesPerCase(drink.bottles_per_case ?? 12);
    setFormError("");
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!name.trim()) {
      setFormError("Drink Name is required.");
      return;
    }

    const bPerCase = Number(bottlesPerCase);
    if (isNaN(bPerCase) || bPerCase < 1) {
      setFormError("Bottles per Case must be at least 1.");
      return;
    }

    const resolvedCategory =
      category === "__custom__"
        ? customCategory.trim() || null
        : category === "No category"
        ? null
        : category;

    setSubmitting(true);

    const inputData: CreateDrinkTypeInput = {
      name: name.trim(),
      category: resolvedCategory,
      price_per_bottle: Number(pricePerBottle) || 0,
      price_per_case: Number(pricePerCase) || 0,
      bottles_per_case: bPerCase,
      created_by: currentUserName,
    };

    try {
      if (editingDrink) {
        const updated = await updateDrinkType(editingDrink.id, inputData);
        setNotification(`Successfully updated "${updated.name}".`);
      } else {
        const created = await createDrinkType(inputData);
        setNotification(`Successfully added "${created.name}".`);
      }

      await loadDrinks();
      setModalOpen(false);
      setTimeout(() => setNotification(""), 4000);
    } catch (err: any) {
      setFormError(formatDrinkError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string, drinkName: string) {
    try {
      await deleteDrinkType(id);
      await loadDrinks();
      setNotification(`Deleted "${drinkName}".`);
      setDeletingId(null);
      setTimeout(() => setNotification(""), 4000);
    } catch (err: any) {
      setError(formatDrinkError(err));
      setDeletingId(null);
    }
  }

  function formatDrinkError(err: any): string {
    if (!err) return "An unexpected error occurred.";
    const text = typeof err === "string" ? err : `${err?.message || ""} ${err?.details || ""}`;

    if (err?.code === "23503" || /foreign key constraint|fk_sales_drink_type/i.test(text)) {
      return "Cannot delete or modify this drink product because it has existing recorded sales or targets linked to it.";
    }

    if (err?.code === "23505" || /already exists|unique constraint/i.test(text)) {
      return "A drink product with this name already exists in the catalog.";
    }

    if (err?.code === "42501" || /row-level security/i.test(text)) {
      return "Permission denied. You do not have permission to modify drink products.";
    }

    return err?.message || String(err);
  }

  function formatNaira(amount: number) {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    })
      .format(amount)
      .replace("NGN", "₦")
      .trim();
  }

  function formatDate(dateStr?: string | null) {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "—";
      return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  }

  const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalItems);

  return (
    <div className="dp-container" style={{ padding: "1.5rem", background: "#f9fafb", borderRadius: "12px" }}>
      {/* ── Section Header ── */}
      <div
        className="dp-header-row"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: "#e6f4f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#075544",
            }}
          >
            <Wine size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#111827", margin: 0 }}>
              Drinks &amp; Products
            </h2>
            <p style={{ fontSize: "0.875rem", color: "#6b7280", margin: "2px 0 0 0" }}>
              Manage drink types available in the system
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateModal}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            background: "#075544",
            color: "#ffffff",
            border: "none",
            borderRadius: "8px",
            padding: "8px 16px",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
            transition: "background 0.15s ease",
          }}
        >
          <Plus size={16} />
          <span>Add Drink</span>
        </button>
      </div>

      {/* ── Notification Alert ── */}
      {notification && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            color: "#166534",
            padding: "10px 14px",
            borderRadius: "8px",
            marginBottom: "1rem",
            fontSize: "0.875rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <CheckCircle2 size={18} />
            <span>{notification}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification("")}
            style={{ background: "none", border: "none", color: "#166534", cursor: "pointer" }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {error && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            padding: "10px 14px",
            borderRadius: "8px",
            marginBottom: "1rem",
            fontSize: "0.875rem",
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* ── Search & Category Filter Toolbar ── */}
      {drinks.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "1rem",
            background: "#ffffff",
            padding: "12px 16px",
            borderRadius: "10px",
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory("all");
                setPage(1);
              }}
              style={{
                padding: "5px 12px",
                borderRadius: "999px",
                fontSize: "0.78rem",
                fontWeight: 600,
                border: selectedCategory === "all" ? "1px solid #075544" : "1px solid #e5e7eb",
                background: selectedCategory === "all" ? "#075544" : "#f9fafb",
                color: selectedCategory === "all" ? "#ffffff" : "#374151",
                cursor: "pointer",
              }}
            >
              All ({drinks.length})
            </button>
            {categoryStats.map(([cat, count]) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat);
                  setPage(1);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "5px 12px",
                  borderRadius: "999px",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  border: selectedCategory === cat ? "1px solid #075544" : "1px solid #e5e7eb",
                  background: selectedCategory === cat ? "#e6f4f0" : "#f9fafb",
                  color: selectedCategory === cat ? "#075544" : "#4b5563",
                  cursor: "pointer",
                }}
              >
                <Tag size={11} />
                {cat} ({count})
              </button>
            ))}
          </div>

          <div style={{ position: "relative", minWidth: "240px", flex: "0 1 280px" }}>
            <Search
              size={15}
              style={{
                position: "absolute",
                left: "11px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#9ca3af",
                pointerEvents: "none",
              }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search drink name or category..."
              style={{
                width: "100%",
                padding: "7px 28px 7px 32px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                fontSize: "0.83rem",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: "8px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "#6b7280",
                  cursor: "pointer",
                  padding: 2,
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Drinks Table Container ── */}
      <div
        className="dp-table-scroll-container"
        style={{
          background: "#ffffff",
          borderRadius: "10px",
          border: "1px solid #e5e7eb",
          overflowX: "auto",
          width: "100%",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        {visibleLoading ? (
          <LogoLoader variant="section" message="Loading drink products" hint="Fetching catalog items and SKU pricing" />
        ) : drinks.length === 0 ? (
          <div style={{ padding: "3rem 1.5rem", textAlign: "center", color: "#6b7280" }}>
            <Wine size={32} style={{ color: "#9ca3af", margin: "0 auto 12px auto" }} />
            <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "#374151", margin: 0 }}>No drinks added yet</h3>
            <p style={{ fontSize: "0.875rem", color: "#6b7280", margin: "4px 0 16px 0" }}>
              Get started by adding drink products to your inventory catalog.
            </p>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              style={{
                background: "#075544",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "8px 14px",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              + Add Drink
            </button>
          </div>
        ) : (
          <>
            <table style={{ width: "100%", minWidth: "920px", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ background: "#ffffff", borderBottom: "1px solid #e5e7eb", color: "#374151" }}>
                  <th style={{ padding: "12px 14px", fontWeight: 600, minWidth: "160px" }}>Name</th>
                  <th style={{ padding: "12px 14px", fontWeight: 600, minWidth: "110px" }}>Category</th>
                  <th style={{ padding: "12px 14px", fontWeight: 600, textAlign: "right", minWidth: "100px", whiteSpace: "nowrap" }}>Price/Bottle</th>
                  <th style={{ padding: "12px 14px", fontWeight: 600, textAlign: "right", minWidth: "110px", whiteSpace: "nowrap" }}>Price/Case</th>
                  <th style={{ padding: "12px 14px", fontWeight: 600, textAlign: "center", minWidth: "90px", whiteSpace: "nowrap" }}>Bottles/Case</th>
                  <th style={{ padding: "12px 14px", fontWeight: 600, minWidth: "110px", whiteSpace: "nowrap" }}>Date Created</th>
                  <th style={{ padding: "12px 14px", fontWeight: 600, minWidth: "120px", whiteSpace: "nowrap" }}>Created By</th>
                  <th style={{ padding: "12px 14px", fontWeight: 600, textAlign: "right", minWidth: "90px", whiteSpace: "nowrap" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDrinks.map((drink) => (
                  <tr
                    key={drink.id}
                    style={{
                      borderBottom: "1px solid #f3f4f6",
                      transition: "background 0.12s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {/* Name */}
                    <td style={{ padding: "14px 16px", fontWeight: 600, color: "#111827" }}>
                      {drink.name}
                    </td>

                    {/* Category */}
                    <td style={{ padding: "14px 16px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 10px",
                          borderRadius: "9999px",
                          fontSize: "0.75rem",
                          fontWeight: 500,
                          background: "#ffffff",
                          border: "1px solid #e5e7eb",
                          color: "#4b5563",
                        }}
                      >
                        {drink.category || "No category"}
                      </span>
                    </td>

                    {/* Price per Bottle */}
                    <td style={{ padding: "14px 16px", textAlign: "right", color: "#374151" }}>
                      {formatNaira(drink.price_per_bottle)}
                    </td>

                    {/* Price per Case */}
                    <td style={{ padding: "14px 16px", textAlign: "right", color: "#374151" }}>
                      {formatNaira(drink.price_per_case)}
                    </td>

                    {/* Bottles per Case */}
                    <td style={{ padding: "14px 16px", textAlign: "center", color: "#374151" }}>
                      {drink.bottles_per_case}
                    </td>

                    {/* Date Created */}
                    <td style={{ padding: "14px 16px", color: "#6b7280", fontSize: "0.8rem" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <Calendar size={13} style={{ color: "#9ca3af" }} />
                        <span>{formatDate(drink.created_at)}</span>
                      </div>
                    </td>

                    {/* Created By */}
                    <td style={{ padding: "14px 16px", color: "#4b5563", fontSize: "0.8rem" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <UserCheck size={13} style={{ color: "#075544" }} />
                        <span>{drink.created_by || "System Admin"}</span>
                      </div>
                    </td>

                    {/* Actions Column (Edit & Delete icons) */}
                    <td style={{ padding: "14px 16px", textAlign: "right" }}>
                      {deletingId === drink.id ? (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "0.75rem", color: "#dc2626", fontWeight: 500 }}>Confirm?</span>
                          <button
                            type="button"
                            onClick={() => handleDelete(drink.id, drink.name)}
                            style={{
                              padding: "3px 8px",
                              fontSize: "0.75rem",
                              borderRadius: "4px",
                              background: "#fee2e2",
                              color: "#dc2626",
                              border: "none",
                              cursor: "pointer",
                              fontWeight: 600,
                            }}
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingId(null)}
                            style={{
                              padding: "3px 6px",
                              fontSize: "0.75rem",
                              borderRadius: "4px",
                              background: "#f3f4f6",
                              color: "#4b5563",
                              border: "none",
                              cursor: "pointer",
                            }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(drink)}
                            title="Edit Drink"
                            style={{
                              background: "#f3f4f6",
                              border: "1px solid #e5e7eb",
                              color: "#374151",
                              cursor: "pointer",
                              padding: "6px",
                              borderRadius: "6px",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "all 0.15s ease",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "#e6f4f0";
                              e.currentTarget.style.borderColor = "#075544";
                              e.currentTarget.style.color = "#075544";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "#f3f4f6";
                              e.currentTarget.style.borderColor = "#e5e7eb";
                              e.currentTarget.style.color = "#374151";
                            }}
                          >
                            <Pencil size={15} />
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeletingId(drink.id)}
                            title="Delete Drink"
                            style={{
                              background: "#f3f4f6",
                              border: "1px solid #e5e7eb",
                              color: "#374151",
                              cursor: "pointer",
                              padding: "6px",
                              borderRadius: "6px",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "all 0.15s ease",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "#fef2f2";
                              e.currentTarget.style.borderColor = "#fecaca";
                              e.currentTarget.style.color = "#dc2626";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "#f3f4f6";
                              e.currentTarget.style.borderColor = "#e5e7eb";
                              e.currentTarget.style.color = "#374151";
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ── Pagination Bar ── */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                borderTop: "1px solid #e5e7eb",
                background: "#ffffff",
                fontSize: "0.85rem",
                color: "#4b5563",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span>
                  Showing <strong>{startItem}</strong>–<strong>{endItem}</strong> of <strong>{totalItems}</strong> drinks
                </span>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <label htmlFor="dp-page-size-select" style={{ fontSize: "0.8rem" }}>Per page:</label>
                  <select
                    id="dp-page-size-select"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    style={{
                      padding: "4px 8px",
                      borderRadius: "6px",
                      border: "1px solid #d1d5db",
                      background: "#ffffff",
                      fontSize: "0.8rem",
                      outline: "none",
                      color: "#374151",
                    }}
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              {/* Pagination Controls */}
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "32px",
                    height: "32px",
                    borderRadius: "6px",
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    color: page === 1 ? "#9ca3af" : "#374151",
                    cursor: page === 1 ? "not-allowed" : "pointer",
                  }}
                  title="Previous Page"
                >
                  <ChevronLeft size={16} />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setPage(pageNum)}
                    style={{
                      minWidth: "32px",
                      height: "32px",
                      padding: "0 6px",
                      borderRadius: "6px",
                      border: pageNum === page ? "1px solid #075544" : "1px solid #d1d5db",
                      background: pageNum === page ? "#075544" : "#ffffff",
                      color: pageNum === page ? "#ffffff" : "#374151",
                      fontWeight: pageNum === page ? 600 : 400,
                      cursor: "pointer",
                      fontSize: "0.8rem",
                    }}
                  >
                    {pageNum}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "32px",
                    height: "32px",
                    borderRadius: "6px",
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    color: page === totalPages ? "#9ca3af" : "#374151",
                    cursor: page === totalPages ? "not-allowed" : "pointer",
                  }}
                  title="Next Page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Add / Edit Drink Modal (Matching Screenshot 2) ── */}
      {modalOpen && (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(17, 24, 39, 0.4)",
            backdropFilter: "blur(2px)",
            display: "grid",
            placeItems: "center",
            padding: "16px",
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="drink-modal-title"
            style={{
              background: "#f7faf8",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "480px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              border: "1px solid #e5e7eb",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <header
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                padding: "20px 24px 12px 24px",
              }}
            >
              <div>
                <h3
                  id="drink-modal-title"
                  style={{ fontSize: "1.2rem", fontWeight: 700, color: "#111827", margin: 0 }}
                >
                  {editingDrink ? "Edit Drink" : "Add New Drink"}
                </h3>
                <p style={{ fontSize: "0.875rem", color: "#6b7280", margin: "4px 0 0 0" }}>
                  {editingDrink ? "Update existing drink details" : "Add a new drink to the system"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close dialog"
                style={{
                  background: "none",
                  border: "none",
                  color: "#6b7280",
                  cursor: "pointer",
                  padding: "4px",
                  borderRadius: "6px",
                }}
              >
                <X size={20} />
              </button>
            </header>

            {/* Modal Form Body */}
            <form onSubmit={handleSubmit}>
              <div style={{ padding: "0 24px 20px 24px" }}>
                {formError && (
                  <div
                    style={{
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      color: "#991b1b",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      fontSize: "0.85rem",
                      marginBottom: "16px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <AlertCircle size={15} />
                    <span>{formError}</span>
                  </div>
                )}

                {/* 1. Drink Name */}
                <div style={{ marginBottom: "16px" }}>
                  <label
                    htmlFor="dp-name-input"
                    style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "#111827", marginBottom: "6px" }}
                  >
                    Drink Name *
                  </label>
                  <input
                    id="dp-name-input"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Heineken"
                    required
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      border: "1.5px solid #075544",
                      outline: "none",
                      fontSize: "0.9rem",
                      background: "#ffffff",
                      boxShadow: "0 0 0 1px rgba(7, 85, 68, 0.1)",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* 2. Category */}
                <div style={{ marginBottom: "16px" }}>
                  <label
                    htmlFor="dp-category-select"
                    style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "#111827", marginBottom: "6px" }}
                  >
                    Category
                  </label>
                  <select
                    id="dp-category-select"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      outline: "none",
                      fontSize: "0.9rem",
                      background: "#ffffff",
                      boxSizing: "border-box",
                      color: "#374151",
                    }}
                  >
                    <option value="No category">No category</option>
                    {categoryOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                    <option value="__custom__">+ Create new category...</option>
                  </select>
                  {category === "__custom__" && (
                    <input
                      type="text"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder="Enter new category name (e.g., Cider, Energy Drink)"
                      style={{
                        marginTop: "8px",
                        width: "100%",
                        padding: "9px 14px",
                        borderRadius: "8px",
                        border: "1px solid #075544",
                        outline: "none",
                        fontSize: "0.875rem",
                        background: "#ffffff",
                        boxSizing: "border-box",
                      }}
                    />
                  )}
                </div>

                {/* 3. Price per Bottle & Price per Case (Row) */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                  <div>
                    <label
                      htmlFor="dp-price-bottle-input"
                      style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "#111827", marginBottom: "6px" }}
                    >
                      Price per Bottle (₦)
                    </label>
                    <input
                      id="dp-price-bottle-input"
                      type="number"
                      min="0"
                      value={pricePerBottle}
                      onChange={(e) => setPricePerBottle(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="0"
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1px solid #d1d5db",
                        outline: "none",
                        fontSize: "0.9rem",
                        background: "#ffffff",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="dp-price-case-input"
                      style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "#111827", marginBottom: "6px" }}
                    >
                      Price per Case (₦)
                    </label>
                    <input
                      id="dp-price-case-input"
                      type="number"
                      min="0"
                      value={pricePerCase}
                      onChange={(e) => setPricePerCase(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="0"
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1px solid #d1d5db",
                        outline: "none",
                        fontSize: "0.9rem",
                        background: "#ffffff",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>

                {/* 4. Bottles per Case */}
                <div style={{ marginBottom: "20px" }}>
                  <label
                    htmlFor="dp-bottles-case-input"
                    style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "#111827", marginBottom: "6px" }}
                  >
                    Bottles per Case *
                  </label>
                  <input
                    id="dp-bottles-case-input"
                    type="number"
                    min="1"
                    value={bottlesPerCase}
                    onChange={(e) => setBottlesPerCase(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="12"
                    required
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      outline: "none",
                      fontSize: "0.9rem",
                      background: "#ffffff",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* Modal Footer Actions */}
              <footer
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: "10px",
                  padding: "16px 24px",
                  background: "#ffffff",
                  borderTop: "1px solid #e5e7eb",
                }}
              >
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={submitting}
                  style={{
                    padding: "9px 18px",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    color: "#374151",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "9px 20px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#075544",
                    color: "#ffffff",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                  }}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      <span>{editingDrink ? "Save Changes" : "Create"}</span>
                    </>
                  )}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
