import { useEffect, useState } from "react";
import {
  MapPin,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  X,
  Loader2,
  AlertTriangle,
  Search,
} from "lucide-react";
import {
  type RegionItem,
  getRegions,
  deleteRegion,
  checkRegionChildDependencies,
} from "../../services/regionService";
import { RegionDialog } from "./RegionDialog";
import LogoLoader from "../../components/brand/LogoLoader";
import { useMinimumLoading } from "../../hooks/useMinimumLoading";

export function RegionsSection() {
  const [regions, setRegions] = useState<RegionItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const visibleLoading = useMinimumLoading(loading, 600);
  const [notification, setNotification] = useState("");
  const [error, setError] = useState("");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRegion, setEditingRegion] = useState<RegionItem | null>(null);

  // Delete & Child Constraint Modal State
  const [deletingRegion, setDeletingRegion] = useState<RegionItem | null>(null);
  const [childErrorMsg, setChildErrorMsg] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const data = await getRegions();
      setRegions(data);
    } catch (e: any) {
      setError(e?.message || "Failed to load sales regions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  function handleOpenCreate() {
    setEditingRegion(null);
    setDialogOpen(true);
  }

  function handleOpenEdit(reg: RegionItem, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingRegion(reg);
    setDialogOpen(true);
  }

  async function handleOpenDelete(reg: RegionItem, e: React.MouseEvent) {
    e.stopPropagation();
    setDeletingRegion(reg);
    setChildErrorMsg("");
    setDeleteLoading(true);

    // Check if region has linked child entities (staff members or outlets)
    const check = await checkRegionChildDependencies(reg.name, reg.id);
    setDeleteLoading(false);

    if (check.hasChildren) {
      setChildErrorMsg(check.message);
    }
  }

  async function confirmDelete() {
    if (!deletingRegion) return;
    setDeleteLoading(true);

    const res = await deleteRegion(deletingRegion.id, deletingRegion.name);
    setDeleteLoading(false);

    if (res.success) {
      setRegions((prev) => prev.filter((r) => r.id !== deletingRegion.id));
      setNotification(`Region "${deletingRegion.name}" deleted successfully.`);
      setDeletingRegion(null);
      setChildErrorMsg("");
      setTimeout(() => setNotification(""), 4000);
    } else {
      setChildErrorMsg(res.message);
    }
  }

  function handleSaveSuccess(saved: RegionItem) {
    setRegions((prev) => {
      const idx = prev.findIndex((r) => r.id === saved.id || r.name.toLowerCase() === saved.name.toLowerCase());
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = saved;
        return copy;
      }
      return [...prev, saved];
    });

    setDialogOpen(false);
    setEditingRegion(null);
    setNotification(`Region "${saved.name}" saved successfully.`);
    setTimeout(() => setNotification(""), 4000);
  }

  const filteredRegions = regions.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.code.toLowerCase().includes(q) ||
      r.state.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q)
    );
  });

  const totalCount = regions.length;
  const activeCount = regions.filter((r) => r.is_active).length;
  const stateCount = new Set(regions.map((r) => r.state)).size;

  return (
    <div className="user-management-container" style={{ padding: "1.5rem", background: "#f9fafb", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
      {/* ── Header Bar (Matching Image 1) ── */}
      <div className="um-header-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", flexWrap: "wrap", gap: "12px" }}>
        <div className="um-title-with-icon" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ background: "#e6f4f0", padding: "8px", borderRadius: "10px", display: "flex" }}>
            <MapPin size={24} style={{ color: "#075544" }} />
          </div>
          <div>
            <h2 className="um-title" style={{ fontSize: "1.25rem", fontWeight: 700, color: "#111827", margin: 0 }}>
              Regions
            </h2>
            <p className="um-subtitle" style={{ fontSize: "0.85rem", color: "#6b7280", margin: "2px 0 0 0" }}>
              Manage sales regions and territories
            </p>
          </div>
        </div>

        <div className="um-header-actions" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            className="primary-button um-add-user-btn"
            onClick={handleOpenCreate}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "9px 18px", borderRadius: "8px", background: "#075544", color: "#ffffff", fontWeight: 600, fontSize: "0.875rem", border: "none", cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}
          >
            <Plus size={16} />
            <span>Add Region</span>
          </button>
        </div>
      </div>

      {/* ── Banners ── */}
      {notification && (
        <div style={{ margin: "0 0 1.25rem 0", display: "flex", alignItems: "center", gap: "8px", background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d", padding: "10px 14px", borderRadius: "8px", fontSize: "0.85rem" }} role="status">
          <CheckCircle2 size={18} />
          <span style={{ flex: 1 }}>{notification}</span>
          <button type="button" onClick={() => setNotification("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#15803d" }}>
            <X size={16} />
          </button>
        </div>
      )}

      {error && (
        <div style={{ margin: "0 0 1.25rem 0", display: "flex", alignItems: "center", gap: "8px", background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", padding: "10px 14px", borderRadius: "8px", fontSize: "0.85rem" }}>
          <span style={{ flex: 1 }}>{error}</span>
          <button type="button" onClick={() => setError("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#b91c1c" }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="um-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "1.25rem" }}>
        <div className="um-kpi-card" style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px 20px" }}>
          <span className="um-kpi-label" style={{ fontSize: "0.78rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Total Regions</span>
          <strong className="um-kpi-value" style={{ fontSize: "1.6rem", fontWeight: 800, color: "#111827", margin: "4px 0", display: "block" }}>{totalCount}</strong>
          <span className="um-kpi-caption" style={{ fontSize: "0.78rem", color: "#6b7280" }}>Configured sales territories.</span>
        </div>

        <div className="um-kpi-card" style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px 20px" }}>
          <span className="um-kpi-label" style={{ fontSize: "0.78rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Active Territories</span>
          <strong className="um-kpi-value" style={{ fontSize: "1.6rem", fontWeight: 800, color: "#075544", margin: "4px 0", display: "block" }}>{activeCount}</strong>
          <span className="um-kpi-caption" style={{ fontSize: "0.78rem", color: "#6b7280" }}>Operational sales regions.</span>
        </div>

        <div className="um-kpi-card" style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px 20px" }}>
          <span className="um-kpi-label" style={{ fontSize: "0.78rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>States Covered</span>
          <strong className="um-kpi-value" style={{ fontSize: "1.6rem", fontWeight: 800, color: "#111827", margin: "4px 0", display: "block" }}>{stateCount}</strong>
          <span className="um-kpi-caption" style={{ fontSize: "0.78rem", color: "#6b7280" }}>Distinct state geographical coverage.</span>
        </div>
      </div>

      {/* ── Search Bar ── */}
      <div style={{ marginBottom: "1.25rem", position: "relative", maxWidth: "360px" }}>
        <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
        <input
          type="text"
          className="um-search-input"
          placeholder="Filter regions by name, code, or state..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: "100%", height: "38px", paddingLeft: "36px", paddingRight: "12px", borderRadius: "8px", fontSize: "0.85rem", outline: "none", boxSizing: "border-box" }}
        />
      </div>

      {/* ── Regions Table (Matching Image 1) ── */}
      <div className="um-table-container" style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
        {visibleLoading ? (
          <LogoLoader variant="section" message="Loading regions" hint="Fetching territorial divisions" />
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="um-table" style={{ width: "100%", minWidth: "850px", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ background: "#ffffff", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "14px 18px", fontWeight: 600, color: "#374151", width: "26%" }}>Region Name</th>
                  <th style={{ padding: "14px 18px", fontWeight: 600, color: "#374151", width: "12%" }}>Code</th>
                  <th style={{ padding: "14px 18px", fontWeight: 600, color: "#374151", width: "18%" }}>State</th>
                  <th style={{ padding: "14px 18px", fontWeight: 600, color: "#374151", width: "24%" }}>Description</th>
                  <th style={{ padding: "14px 18px", fontWeight: 600, color: "#374151", width: "10%" }}>Status</th>
                  <th style={{ padding: "14px 18px", fontWeight: 600, color: "#374151", width: "10%", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRegions.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: "30px", textAlign: "center", color: "#6b7280" }}>
                      No regions match your search filter.
                    </td>
                  </tr>
                ) : (
                  filteredRegions.map((reg) => (
                    <tr key={reg.id} style={{ borderBottom: "1px solid #f3f4f6", transition: "background 0.12s ease" }}>
                      {/* Region Name */}
                      <td style={{ padding: "16px 18px", fontWeight: 700, color: "#111827", fontSize: "0.92rem" }}>
                        {reg.name}
                      </td>

                      {/* Code Badge */}
                      <td style={{ padding: "16px 18px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 10px",
                            borderRadius: "16px",
                            border: "1px solid #d1d5db",
                            background: "#ffffff",
                            color: "#4b5563",
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            fontFamily: "monospace",
                            letterSpacing: "0.02em",
                          }}
                        >
                          {reg.code}
                        </span>
                      </td>

                      {/* State */}
                      <td style={{ padding: "16px 18px", color: "#4b5563", fontSize: "0.85rem" }}>
                        {reg.state}
                      </td>

                      {/* Description */}
                      <td style={{ padding: "16px 18px", color: "#6b7280", fontSize: "0.82rem" }}>
                        {reg.description || "-"}
                      </td>

                      {/* Status */}
                      <td style={{ padding: "16px 18px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "4px 12px",
                            borderRadius: "20px",
                            background: reg.is_active ? "#075544" : "#fee2e2",
                            color: reg.is_active ? "#ffffff" : "#b91c1c",
                            fontSize: "0.78rem",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {reg.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "16px 18px", textAlign: "right" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
                          <button
                            type="button"
                            onClick={(e) => handleOpenEdit(reg, e)}
                            title="Edit Region"
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#4b5563", padding: "6px", borderRadius: "6px", display: "flex", alignItems: "center" }}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleOpenDelete(reg, e)}
                            title="Delete Region"
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: "6px", borderRadius: "6px", display: "flex", alignItems: "center" }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add / Edit Region Dialog ── */}
      {dialogOpen && (
        <RegionDialog
          region={editingRegion}
          onSave={handleSaveSuccess}
          onClose={() => {
            setDialogOpen(false);
            setEditingRegion(null);
          }}
        />
      )}

      {/* ── Delete Confirmation & Child Constraint Error Modal ── */}
      {deletingRegion && (
        <div className="new-sale-backdrop" role="presentation">
          <div className="user-modal-dialog" style={{ maxWidth: "460px", width: "100%", padding: "20px", borderRadius: "16px" }}>
            {childErrorMsg ? (
              // Child Dependency Error Banner / Modal
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#b91c1c", marginBottom: "10px" }}>
                  <AlertTriangle size={24} />
                  <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>
                    Cannot Delete Region
                  </h3>
                </div>
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", padding: "14px", color: "#991b1b", fontSize: "0.85rem", lineHeight: "1.45", marginBottom: "16px" }}>
                  {childErrorMsg}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => {
                      setDeletingRegion(null);
                      setChildErrorMsg("");
                    }}
                    style={{ background: "#075544", padding: "8px 18px" }}
                  >
                    Understand & Close
                  </button>
                </div>
              </div>
            ) : (
              // Safe Delete Confirmation
              <div>
                <h3 style={{ margin: "0 0 8px 0", fontSize: "1.1rem", color: "#111827", fontWeight: 700 }}>
                  Delete Region: "{deletingRegion.name}"?
                </h3>
                <p style={{ margin: "0 0 16px 0", fontSize: "0.85rem", color: "#4b5563", lineHeight: 1.4 }}>
                  Are you sure you want to delete this sales territory? This action will remove the region entry from the catalog.
                </p>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setDeletingRegion(null)}
                    disabled={deleteLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={confirmDelete}
                    disabled={deleteLoading}
                    style={{ background: "#dc2626" }}
                  >
                    {deleteLoading ? <Loader2 size={14} className="spin" /> : "Delete Region"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
