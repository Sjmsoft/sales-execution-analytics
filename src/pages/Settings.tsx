import { useState, useEffect } from "react";
import { Link, Navigate } from "react-router-dom";

import {
  User,
  Lock,
  Bell,
  Palette,
  Globe,
  Shield,
  Check,
  CheckCheck,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Tag,
  Plus,
  Pencil,
  Trash2,
  X,
  Users,
  Wine,
  ShieldCheck,
  MapPin,
  Building2,
  CreditCard,
  CheckCircle2,
  Compass,
  MessageSquare,
  Sun,
  Moon,
  Monitor,
  RotateCcw,
  Sparkles,
  Sliders,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { useAppearance } from "../hooks/useAppearance";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { UserManagementSection } from "./settings/UserManagementSection";
import { DrinksAndProductsSection } from "./settings/DrinksAndProductsSection";
import { RoleManagementSection } from "./settings/RoleManagementSection";
import { RegionsSection } from "./settings/RegionsSection";
import { OutletTypesSection } from "./settings/OutletTypesSection";
import { PaymentMethodsSection } from "./settings/PaymentMethodsSection";
import { VisitOutcomesSection } from "./settings/VisitOutcomesSection";
import { GeofencingSection } from "./settings/GeofencingSection";
import { CommunicationsSection } from "./settings/CommunicationsSection";
import { SettingsSkeleton } from "../components/ui/Skeleton";
import LogoLoader from "../components/brand/LogoLoader";
import { useMinimumLoading } from "../hooks/useMinimumLoading";
import {
  getNotifications,
  getUnreadNotificationsCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  clearNotification,
  clearAllNotifications,
  subscribeNotifications,
  type NotificationItem,
} from "../services/notificationService";

/* ─── Types ─────────────────────────────────────── */

type TabId =
  | "profile"
  | "security"
  | "notifications"
  | "appearance"
  | "regional"
  | "privacy"
  | "drinkCategories"
  | "drinksAndProducts"
  | "users"
  | "roles"
  | "regions"
  | "outletTypes"
  | "paymentMethods"
  | "visitOutcomes"
  | "geofencing"
  | "communications";

type SaveState = "idle" | "saving" | "saved" | "error";

/* ─── Sub-components ─────────────────────────────── */

function Toggle({
  id,
  checked,
  onChange,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`settings-toggle${checked ? " settings-toggle--on" : ""}`}
      type="button"
    >
      <span className="settings-toggle-thumb" />
    </button>
  );
}

const TAB_LABELS: Record<TabId, string> = {
  profile: "Profile",
  security: "Security",
  notifications: "Notifications",
  appearance: "Appearance",
  regional: "Regional & Language",
  privacy: "Privacy & Security",
  drinksAndProducts: "Drinks & Products",
  drinkCategories: "Drink Categories",
  outletTypes: "Outlet Types",
  paymentMethods: "Payment Methods",
  visitOutcomes: "Visit Outcomes",
  regions: "Regions",
  geofencing: "Geofencing & Integrations",
  communications: "Communications & Calls",
  users: "User Management",
  roles: "Role Management",
};

function SubnavButton({
  id,
  icon: Icon,
  label,
  active,
  collapsed = false,
  onClick,
}: {
  id: TabId;
  icon: React.ElementType;
  label: string;
  active: boolean;
  collapsed?: boolean;
  onClick: (id: TabId) => void;
}) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`settings-tab${active ? " settings-tab--active" : ""}${collapsed ? " settings-tab--collapsed" : ""}`}
      type="button"
      title={label}
      aria-label={label}
    >
      <Icon size={16} aria-hidden="true" className="settings-tab-icon" />
      {!collapsed && <span>{label}</span>}
      {collapsed && active && <span className="settings-tab-active-dot" />}
    </button>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="settings-row">
      <div className="settings-row-text">
        <span className="settings-row-label">{label}</span>
        {description && (
          <span className="settings-row-desc">{description}</span>
        )}
      </div>
      <div className="settings-row-control">{children}</div>
    </div>
  );
}


function SaveBar({
  state,
  onSave,
  onReset,
}: {
  state: SaveState;
  onSave: () => void;
  onReset: () => void;
}) {
  if (state === "idle") return null;

  return (
    <div className="settings-savebar">
      {state === "error" && (
        <span className="settings-savebar-error">
          <AlertCircle size={15} /> Something went wrong. Try again.
        </span>
      )}
      {state === "saved" && (
        <span className="settings-savebar-ok">
          <Check size={15} /> Saved successfully.
        </span>
      )}
      <div className="settings-savebar-actions">
        <button
          className="btn-ghost-sm"
          onClick={onReset}
          disabled={state === "saving"}
        >
          Discard
        </button>
        <button
          className="btn-primary-sm"
          onClick={onSave}
          disabled={state === "saving"}
        >
          {state === "saving" ? (
            <>
              <Loader2 size={14} className="spin" /> Saving…
            </>
          ) : (
            "Save changes"
          )}
        </button>
      </div>
    </div>
  );
}

/* ─── Drink Categories Section ────────────────────── */

type DrinkCategory = {
  name: string;            // category string from drink_types table
  drinkCount: number;      // how many drink_types use this category
};

function DrinkCategoriesSection() {
  const [categories, setCategories] = useState<DrinkCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const visibleLoading = useMinimumLoading(loading, 600);
  const [error, setError] = useState("");

  // add-new
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  // inline edit
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // delete confirmation
  const [deletingName, setDeletingName] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data, error: err } = await supabase
        .from("drink_types")
        .select("category");
      if (err) throw err;

      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        const cat = (row.category ?? "Uncategorised") as string;
        counts[cat] = (counts[cat] ?? 0) + 1;
      }
      setCategories(
        Object.entries(counts)
          .map(([name, drinkCount]) => ({ name, drinkCount }))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch {
      setError("Failed to load categories.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async load; state updates occur only after awaits
    load();
  }, []);

  async function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) { setAddError("Category name is required."); return; }
    if (categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
      setAddError("A category with that name already exists.");
      return;
    }
    setAdding(true);
    setAddError("");
    try {
      // Insert a placeholder drink_type row so the category exists — or just
      // track categories as a separate concept. Here we add a sentinel row with
      // a distinctive name the user can later populate properly. Alternatively
      // we can create a `drink_categories` table; for now we use a virtual row.
      //
      // Better approach: just record the name in a dedicated table. Since the
      // schema only has drink_types, we'll add it there as a "category only" row
      // (name = trimmed, category = trimmed, price fields = 0).
      const { error: err } = await supabase.from("drink_types").insert({
        name: `[${trimmed}]`,
        category: trimmed,
        bottles_per_case: 0,
        price_per_bottle: 0,
        price_per_case: 0,
      });
      if (err) throw err;
      setNewName("");
      await load();
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : "Failed to add category.");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(cat: DrinkCategory) {
    setEditingName(cat.name);
    setEditValue(cat.name);
    setEditError("");
  }

  async function saveEdit() {
    const trimmed = editValue.trim();
    if (!trimmed) { setEditError("Name cannot be empty."); return; }
    if (trimmed === editingName) { setEditingName(null); return; }
    if (categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
      setEditError("That name is already used by another category.");
      return;
    }
    setEditSaving(true);
    setEditError("");
    try {
      const { error: err } = await supabase
        .from("drink_types")
        .update({ category: trimmed })
        .eq("category", editingName);
      if (err) throw err;
      setEditingName(null);
      await load();
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : "Failed to rename category.");
    } finally {
      setEditSaving(false);
    }
  }

  async function confirmDelete(name: string) {
    try {
      // Nullify category on all drink_types with this category
      const { error: err } = await supabase
        .from("drink_types")
        .update({ category: null })
        .eq("category", name);
      if (err) throw err;
      setDeletingName(null);
      await load();
    } catch {
      setError("Failed to delete category.");
      setDeletingName(null);
    }
  }

  return (
    <div className="settings-form">
      {/* Error banner */}
      {error && (
        <p className="settings-pw-error">
          <AlertCircle size={14} /> {error}
        </p>
      )}

      {/* Category table */}
      {visibleLoading ? (
        <LogoLoader variant="section" message="Loading drink categories" />
      ) : (
        <div className="dc-table-wrap">
          <table className="dc-table">
            <thead>
              <tr>
                <th>Category Name</th>
                <th className="dc-th-count">Drink Types</th>
                <th className="dc-th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 && (
                <tr>
                  <td colSpan={3} className="dc-empty">No categories yet.</td>
                </tr>
              )}
              {categories.map((cat) => (
                <tr key={cat.name} className={deletingName === cat.name ? "dc-row-deleting" : ""}>
                  <td>
                    {editingName === cat.name ? (
                      <div className="dc-edit-inline">
                        <input
                          className="dc-edit-input"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingName(null); }}
                          autoFocus
                        />
                        {editError && <span className="dc-edit-error">{editError}</span>}
                      </div>
                    ) : (
                      <span className="dc-cat-name">
                        <Tag size={13} className="dc-cat-icon" />
                        {cat.name}
                      </span>
                    )}
                  </td>
                  <td className="dc-td-count">
                    <span className="dc-badge">{cat.drinkCount}</span>
                  </td>
                  <td className="dc-td-actions">
                    {deletingName === cat.name ? (
                      <div className="dc-confirm-row">
                        <span className="dc-confirm-label">Delete? This unassigns {cat.drinkCount} drink type{cat.drinkCount !== 1 ? "s" : ""}.</span>
                        <button className="dc-btn-danger" onClick={() => confirmDelete(cat.name)} type="button">Yes, delete</button>
                        <button className="dc-btn-ghost" onClick={() => setDeletingName(null)} type="button"><X size={13} /></button>
                      </div>
                    ) : editingName === cat.name ? (
                      <div className="dc-action-btns">
                        <button className="dc-btn-save" onClick={saveEdit} disabled={editSaving} type="button">
                          {editSaving ? <Loader2 size={13} className="spin" /> : <Check size={13} />} Save
                        </button>
                        <button className="dc-btn-ghost" onClick={() => setEditingName(null)} type="button"><X size={13} /></button>
                      </div>
                    ) : (
                      <div className="dc-action-btns">
                        <button className="dc-btn-edit" onClick={() => startEdit(cat)} type="button" title="Rename">
                          <Pencil size={13} />
                        </button>
                        <button className="dc-btn-delete" onClick={() => setDeletingName(cat.name)} type="button" title="Delete">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add new category */}
      <div className="dc-add-row">
        <div className="dc-add-input-wrap">
          <input
            className="dc-add-input"
            type="text"
            placeholder="New category name…"
            value={newName}
            onChange={(e) => { setNewName(e.target.value); setAddError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          />
          {addError && <span className="dc-add-error">{addError}</span>}
        </div>
        <button
          className="dc-btn-add"
          onClick={handleAdd}
          disabled={adding || !newName.trim()}
          type="button"
        >
          {adding ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
          Add Category
        </button>
      </div>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────── */

export default function Settings() {
  const { user, staff, role, loading: authLoading } = useAuth();
  const roleKey = (role?.key || staff?.user_roles?.key || staff?.assigned_role || "").toLowerCase();
  const isAdmin =
    roleKey === "administrator" ||
    roleKey === "admin" ||
    roleKey === "a0000000-0000-4000-8000-000000000001" ||
    role?.hierarchy_level === 1;

  const searchParams = new URLSearchParams(window.location.search);
  const initialTab = (searchParams.get("tab") as TabId) || "profile";

  /* tab state */
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  /* settings menu sidebar collapse state */
  const [menuSidebarCollapsed, setMenuSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("settings_menu_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const toggleMenuSidebar = () => {
    setMenuSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("settings_menu_collapsed", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  /* settings menu groups collapse state */
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("settings_collapsed_groups");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = { ...prev, [groupId]: !prev[groupId] };
      try {
        localStorage.setItem("settings_collapsed_groups", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  useEffect(() => {
    const group1 = ["profile", "security", "notifications", "appearance", "regional", "privacy"];
    const group2 = ["drinksAndProducts", "drinkCategories", "outletTypes", "paymentMethods", "visitOutcomes", "regions"];
    const group3 = ["geofencing", "communications"];
    const group4 = ["users", "roles"];

    if (group1.includes(activeTab) && collapsedGroups.account) {
      setCollapsedGroups((prev) => ({ ...prev, account: false }));
    } else if (group2.includes(activeTab) && collapsedGroups.catalog) {
      setCollapsedGroups((prev) => ({ ...prev, catalog: false }));
    } else if (group3.includes(activeTab) && collapsedGroups.integrations) {
      setCollapsedGroups((prev) => ({ ...prev, integrations: false }));
    } else if (group4.includes(activeTab) && collapsedGroups.admin) {
      setCollapsedGroups((prev) => ({ ...prev, admin: false }));
    }
  }, [activeTab]);

  if (!authLoading && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  /* ── Profile section ── */
  const [profileName, setProfileName] = useState(staff?.name ?? "");
  const [profilePhone, setProfilePhone] = useState(staff?.phone ?? "");
  const [profileEmail, setProfileEmail] = useState(
    user?.email ?? ""
  );
  const [profileSave, setProfileSave] = useState<SaveState>("idle");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync form fields when auth data loads
    setProfileName(staff?.name ?? "");
    setProfilePhone(staff?.phone ?? "");
    setProfileEmail(user?.email ?? "");
  }, [staff, user]);

  if (authLoading) {
    return (
      <div className="settings-page">
        <SettingsSkeleton />
      </div>
    );
  }

  async function saveProfile() {
    setProfileSave("saving");
    try {
      if (user) {
        await supabase.auth.updateUser({ email: profileEmail });
      }
      setProfileSave("saved");
      setTimeout(() => setProfileSave("idle"), 3000);
    } catch {
      setProfileSave("error");
    }
  }

  /* ── Security section ── */
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [securitySave, setSecuritySave] = useState<SaveState>("idle");
  const [pwError, setPwError] = useState("");

  async function savePassword() {
    setPwError("");
    if (!newPw || newPw.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      setPwError("Passwords do not match.");
      return;
    }
    setSecuritySave("saving");
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPw,
      });
      if (error) throw error;
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setSecuritySave("saved");
      setTimeout(() => setSecuritySave("idle"), 3000);
    } catch {
      setSecuritySave("error");
    }
  }

  /* ── Notifications section ── */
  const [notifSaleAlert, setNotifSaleAlert] = useState(true);
  const [notifTargetAlert, setNotifTargetAlert] = useState(true);
  const [notifWeeklyReport, setNotifWeeklyReport] = useState(false);
  const [notifSystemUpdate, setNotifSystemUpdate] = useState(true);
  const [settingsNotifs, setSettingsNotifs] = useState<NotificationItem[]>(() => getNotifications());
  const [settingsUnreadCount, setSettingsUnreadCount] = useState<number>(() => getUnreadNotificationsCount());

  useEffect(() => {
    const unsub = subscribeNotifications((items) => {
      setSettingsNotifs(items);
      setSettingsUnreadCount(items.filter((n) => !n.isRead).length);
    });
    return () => unsub();
  }, []);

  /* ── Appearance section ── */
  const {
    colorScheme,
    setColorScheme,
    compactMode,
    setCompactMode,
    sidebarCollapsed,
    setSidebarCollapsed,
    resolvedTheme,
    resetToDefaults,
  } = useAppearance();

  /* ── Regional section ── */
  const [currency, setCurrency] = useState("NGN");
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );

  /* ── Privacy section ── */
  const [shareAnalytics, setShareAnalytics] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState("60");

  return (
    <div className="settings-page">
      {/* Page header */}
      <div className="settings-page-header">
        <div>
          <h1 className="settings-page-title">Settings</h1>
          <p className="settings-page-subtitle">
            Manage your account preferences and application settings
          </p>
        </div>
      </div>

      {/* Executive Profile Card at top */}
      <div className="settings-profile-card">
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div className="settings-profile-avatar">
            {(staff?.name ?? user?.email ?? "?")[0].toUpperCase()}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "#ffffff" }}>
                {staff?.name ?? "User"}
              </h3>
              <span className="settings-role-badge">
                {staff?.user_roles?.name ?? "Staff"}
              </span>
            </div>
            <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", opacity: 0.9, color: "#e2e8f0" }}>
              {user?.email ?? "—"} &bull; {staff?.region ? `${staff.region} Region` : "National Level"}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "0.75rem", background: "rgba(255,255,255,0.14)", padding: "4px 10px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.2)" }}>
            ● System Active
          </span>
        </div>
      </div>

      {/* Main layout */}
      <div className={`settings-layout${menuSidebarCollapsed ? " settings-layout--collapsed" : ""}`}>
        <aside
          className={`settings-sidebar${menuSidebarCollapsed ? " settings-sidebar--collapsed" : ""}`}
          aria-label="Settings Navigation"
        >
          {/* Top Collapse/Expand Toggle Header */}
          <div className={`settings-sidebar-header${menuSidebarCollapsed ? " settings-sidebar-header--collapsed" : ""}`}>
            {!menuSidebarCollapsed ? (
              <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
                <span className="settings-sidebar-header-title">Settings Navigation</span>
              </div>
            ) : (
              <span className="settings-sidebar-current-pill">
                {TAB_LABELS[activeTab]}
              </span>
            )}
            <button
              type="button"
              className="settings-sidebar-collapse-btn"
              onClick={toggleMenuSidebar}
              title={menuSidebarCollapsed ? "Expand settings menu" : "Collapse settings menu"}
              aria-label={menuSidebarCollapsed ? "Expand settings menu" : "Collapse settings menu"}
            >
              {menuSidebarCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
            </button>
          </div>

          {/* Group 1: My Account */}
          <div className="settings-sidebar-group">
            {!menuSidebarCollapsed ? (
              <button
                type="button"
                className="settings-sidebar-group-header"
                onClick={() => toggleGroup("account")}
                aria-expanded={!collapsedGroups.account}
              >
                <span className="settings-sidebar-group-title">My Account</span>
                <ChevronDown
                  size={14}
                  className={`settings-group-chevron${collapsedGroups.account ? " settings-group-chevron--collapsed" : ""}`}
                />
              </button>
            ) : (
              <div className="settings-sidebar-divider" title="My Account" />
            )}
            {(!collapsedGroups.account || menuSidebarCollapsed) && (
              <div className="settings-sidebar-group-items">
                <SubnavButton id="profile" icon={User} label="Profile" active={activeTab === "profile"} collapsed={menuSidebarCollapsed} onClick={setActiveTab} />
                <SubnavButton id="security" icon={Lock} label="Security" active={activeTab === "security"} collapsed={menuSidebarCollapsed} onClick={setActiveTab} />
                <SubnavButton id="notifications" icon={Bell} label="Notifications" active={activeTab === "notifications"} collapsed={menuSidebarCollapsed} onClick={setActiveTab} />
                <SubnavButton id="appearance" icon={Palette} label="Appearance" active={activeTab === "appearance"} collapsed={menuSidebarCollapsed} onClick={setActiveTab} />
                <SubnavButton id="regional" icon={Globe} label="Regional & Language" active={activeTab === "regional"} collapsed={menuSidebarCollapsed} onClick={setActiveTab} />
                <SubnavButton id="privacy" icon={Shield} label="Privacy & Security" active={activeTab === "privacy"} collapsed={menuSidebarCollapsed} onClick={setActiveTab} />
              </div>
            )}
          </div>

          {/* Group 2: Product Catalog */}
          <div className="settings-sidebar-group">
            {!menuSidebarCollapsed ? (
              <button
                type="button"
                className="settings-sidebar-group-header"
                onClick={() => toggleGroup("catalog")}
                aria-expanded={!collapsedGroups.catalog}
              >
                <span className="settings-sidebar-group-title">Product Catalog & Regions</span>
                <ChevronDown
                  size={14}
                  className={`settings-group-chevron${collapsedGroups.catalog ? " settings-group-chevron--collapsed" : ""}`}
                />
              </button>
            ) : (
              <div className="settings-sidebar-divider" title="Product Catalog & Regions" />
            )}
            {(!collapsedGroups.catalog || menuSidebarCollapsed) && (
              <div className="settings-sidebar-group-items">
                <SubnavButton id="drinksAndProducts" icon={Wine} label="Drinks & Products" active={activeTab === "drinksAndProducts"} collapsed={menuSidebarCollapsed} onClick={setActiveTab} />
                <SubnavButton id="drinkCategories" icon={Tag} label="Drink Categories" active={activeTab === "drinkCategories"} collapsed={menuSidebarCollapsed} onClick={setActiveTab} />
                <SubnavButton id="outletTypes" icon={Building2} label="Outlet Types" active={activeTab === "outletTypes"} collapsed={menuSidebarCollapsed} onClick={setActiveTab} />
                <SubnavButton id="paymentMethods" icon={CreditCard} label="Payment Methods" active={activeTab === "paymentMethods"} collapsed={menuSidebarCollapsed} onClick={setActiveTab} />
                <SubnavButton id="visitOutcomes" icon={CheckCircle2} label="Visit Outcomes" active={activeTab === "visitOutcomes"} collapsed={menuSidebarCollapsed} onClick={setActiveTab} />
                <SubnavButton id="regions" icon={MapPin} label="Regions" active={activeTab === "regions"} collapsed={menuSidebarCollapsed} onClick={setActiveTab} />
              </div>
            )}
          </div>

          {/* Group 3: Integrations & Field Tracking */}
          <div className="settings-sidebar-group">
            {!menuSidebarCollapsed ? (
              <button
                type="button"
                className="settings-sidebar-group-header"
                onClick={() => toggleGroup("integrations")}
                aria-expanded={!collapsedGroups.integrations}
              >
                <span className="settings-sidebar-group-title">Integrations & Tracking</span>
                <ChevronDown
                  size={14}
                  className={`settings-group-chevron${collapsedGroups.integrations ? " settings-group-chevron--collapsed" : ""}`}
                />
              </button>
            ) : (
              <div className="settings-sidebar-divider" title="Integrations & Tracking" />
            )}
            {(!collapsedGroups.integrations || menuSidebarCollapsed) && (
              <div className="settings-sidebar-group-items">
                <SubnavButton id="geofencing" icon={Compass} label="Geofencing & Integrations" active={activeTab === "geofencing"} collapsed={menuSidebarCollapsed} onClick={setActiveTab} />
                <SubnavButton id="communications" icon={MessageSquare} label="Communications & Calls" active={activeTab === "communications"} collapsed={menuSidebarCollapsed} onClick={setActiveTab} />
              </div>
            )}
          </div>

          {/* Group 4: Administration */}
          {isAdmin && (
            <div className="settings-sidebar-group">
              {!menuSidebarCollapsed ? (
                <button
                  type="button"
                  className="settings-sidebar-group-header"
                  onClick={() => toggleGroup("admin")}
                  aria-expanded={!collapsedGroups.admin}
                >
                  <span className="settings-sidebar-group-title">Administration</span>
                  <ChevronDown
                    size={14}
                    className={`settings-group-chevron${collapsedGroups.admin ? " settings-group-chevron--collapsed" : ""}`}
                  />
                </button>
              ) : (
                <div className="settings-sidebar-divider" title="Administration" />
              )}
              {(!collapsedGroups.admin || menuSidebarCollapsed) && (
                <div className="settings-sidebar-group-items">
                  <SubnavButton id="users" icon={Users} label="User Management" active={activeTab === "users"} collapsed={menuSidebarCollapsed} onClick={setActiveTab} />
                  <SubnavButton id="roles" icon={ShieldCheck} label="Role Management" active={activeTab === "roles"} collapsed={menuSidebarCollapsed} onClick={setActiveTab} />
                </div>
              )}
            </div>
          )}
        </aside>

        <main className={`settings-content ${activeTab === "users" || activeTab === "drinksAndProducts" || activeTab === "roles" || activeTab === "regions" || activeTab === "outletTypes" || activeTab === "paymentMethods" || activeTab === "visitOutcomes" || activeTab === "geofencing" || activeTab === "communications" ? "settings-content--bare" : ""}`}>
          {/* ── Profile ── */}
          {activeTab === "profile" && (
            <div className="settings-section-content">
              <div className="settings-section-titles" style={{ marginBottom: '1.5rem' }}>
                <h3 className="settings-section-title">Profile Information</h3>
                <p className="settings-section-subtitle">Name, email, and contact details</p>
              </div>
          <div className="settings-form">
            <div className="settings-form-grid">
              <div className="settings-field">
                <label htmlFor="sett-name">Full name</label>
                <input
                  id="sett-name"
                  type="text"
                  value={profileName}
                  onChange={(e) => {
                    setProfileName(e.target.value);
                    setProfileSave("idle");
                  }}
                  placeholder="Your name"
                />
              </div>
              <div className="settings-field">
                <label htmlFor="sett-phone">Phone number</label>
                <input
                  id="sett-phone"
                  type="tel"
                  value={profilePhone ?? ""}
                  onChange={(e) => {
                    setProfilePhone(e.target.value);
                    setProfileSave("idle");
                  }}
                  placeholder="+234 800 000 0000"
                />
              </div>
              <div className="settings-field settings-field--full">
                <label htmlFor="sett-email">Email address</label>
                <input
                  id="sett-email"
                  type="email"
                  value={profileEmail}
                  onChange={(e) => {
                    setProfileEmail(e.target.value);
                    setProfileSave("idle");
                  }}
                  placeholder="you@example.com"
                />
              </div>
              {staff && (
                <>
                  <div className="settings-field">
                    <label>Region</label>
                    <input
                      type="text"
                      value={staff.region ?? "—"}
                      readOnly
                      className="settings-field--readonly"
                    />
                  </div>
                  <div className="settings-field">
                    <label>Team</label>
                    <input
                      type="text"
                      value={staff.team ?? "—"}
                      readOnly
                      className="settings-field--readonly"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
          <SaveBar
            state={profileSave}
            onSave={saveProfile}
            onReset={() => {
              setProfileName(staff?.name ?? "");
              setProfilePhone(staff?.phone ?? "");
              setProfileEmail(user?.email ?? "");
              setProfileSave("idle");
            }}
          />
            </div>
          )}

          {/* ── Security ── */}
          {activeTab === "security" && (
            <div className="settings-section-content">
              <div className="settings-section-titles" style={{ marginBottom: '1.5rem' }}>
                <h3 className="settings-section-title">Security</h3>
                <p className="settings-section-subtitle">Password and authentication</p>
              </div>
          <div className="settings-form">
            <p className="settings-section-note">
              Leave the fields empty if you don't want to change your password.
            </p>
            <div className="settings-form-grid">
              <div className="settings-field settings-field--full settings-field--pw">
                <label htmlFor="sett-cur-pw">Current password</label>
                <div className="settings-pw-wrap">
                  <input
                    id="sett-cur-pw"
                    type={showCurrentPw ? "text" : "password"}
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="settings-pw-eye"
                    onClick={() => setShowCurrentPw((v) => !v)}
                    aria-label={showCurrentPw ? "Hide" : "Show"}
                  >
                    {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="settings-field settings-field--pw">
                <label htmlFor="sett-new-pw">New password</label>
                <div className="settings-pw-wrap">
                  <input
                    id="sett-new-pw"
                    type={showNewPw ? "text" : "password"}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="settings-pw-eye"
                    onClick={() => setShowNewPw((v) => !v)}
                    aria-label={showNewPw ? "Hide" : "Show"}
                  >
                    {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="settings-field">
                <label htmlFor="sett-conf-pw">Confirm new password</label>
                <input
                  id="sett-conf-pw"
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </div>
            {pwError && (
              <p className="settings-pw-error">
                <AlertCircle size={14} /> {pwError}
              </p>
            )}
          </div>
          <SaveBar
            state={securitySave}
            onSave={savePassword}
            onReset={() => {
              setCurrentPw("");
              setNewPw("");
              setConfirmPw("");
              setPwError("");
              setSecuritySave("idle");
            }}
          />
            </div>
          )}

          {/* ── Notifications ── */}
          {activeTab === "notifications" && (
            <div className="settings-section-content">
              <div className="settings-section-titles" style={{ marginBottom: '1.5rem' }}>
                <h3 className="settings-section-title">Notifications</h3>
                <p className="settings-section-subtitle">Choose what alerts you receive</p>
              </div>
          <div className="settings-form">
            <SettingRow
              label="Sale confirmation alerts"
              description="Get notified when a sale is recorded successfully"
            >
              <Toggle
                id="notif-sale"
                checked={notifSaleAlert}
                onChange={setNotifSaleAlert}
              />
            </SettingRow>
            <SettingRow
              label="Target milestone alerts"
              description="Receive alerts when you hit 50 %, 75 %, or 100 % of your target"
            >
              <Toggle
                id="notif-target"
                checked={notifTargetAlert}
                onChange={setNotifTargetAlert}
              />
            </SettingRow>
            <SettingRow
              label="Weekly summary report"
              description="A digest of your week's performance sent every Monday"
            >
              <Toggle
                id="notif-weekly"
                checked={notifWeeklyReport}
                onChange={setNotifWeeklyReport}
              />
            </SettingRow>
            <SettingRow
              label="System update announcements"
              description="Be the first to know about new features and improvements"
            >
              <Toggle
                id="notif-system"
                checked={notifSystemUpdate}
                onChange={setNotifSystemUpdate}
              />
            </SettingRow>
          </div>

          {/* ── Active Notifications & Controls Card ── */}
          <div
            style={{
              marginTop: 28,
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: "20px 24px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <h4 style={{ margin: "0 0 4px 0", fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                  Active Notifications & Bulletins
                </h4>
                <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
                  {settingsUnreadCount > 0
                    ? `You have ${settingsUnreadCount} unread notification${settingsUnreadCount > 1 ? "s" : ""}.`
                    : "All notifications are marked as read."}
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => markAllNotificationsAsRead()}
                  disabled={settingsUnreadCount === 0}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "6px 12px",
                    background: "#ecfdf5",
                    color: settingsUnreadCount > 0 ? "#059669" : "#94a3b8",
                    border: "1px solid #a7f3d0",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: settingsUnreadCount > 0 ? "pointer" : "not-allowed",
                  }}
                >
                  <CheckCheck size={14} />
                  <span>Mark All as Read</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Clear all notifications?")) {
                      clearAllNotifications();
                    }
                  }}
                  disabled={settingsNotifs.length === 0}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "6px 12px",
                    background: "#fef2f2",
                    color: settingsNotifs.length > 0 ? "#dc2626" : "#94a3b8",
                    border: "1px solid #fecaca",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: settingsNotifs.length > 0 ? "pointer" : "not-allowed",
                  }}
                >
                  <Trash2 size={14} />
                  <span>Clear All</span>
                </button>

                <Link
                  to="/settings/notifications"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "6px 12px",
                    background: "#059669",
                    color: "#ffffff",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  <span>Open Full Hub</span>
                </Link>
              </div>
            </div>

            {/* Notification items list */}
            {settingsNotifs.length === 0 ? (
              <div
                style={{
                  padding: "30px 16px",
                  textAlign: "center",
                  background: "#f8fafc",
                  borderRadius: 8,
                  color: "#64748b",
                  fontSize: 13,
                }}
              >
                No active notifications. All notifications have been cleared.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {settingsNotifs.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "10px 14px",
                      background: item.isRead ? "#f8fafc" : "#f0fdf4",
                      border: `1px solid ${item.isRead ? "#e2e8f0" : "#bbf7d0"}`,
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                        <strong style={{ fontSize: 13, color: item.isRead ? "#334155" : "#064e3b" }}>
                          {item.title}
                        </strong>
                        {!item.isRead && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              background: "#dcfce7",
                              color: "#15803d",
                              padding: "1px 5px",
                              borderRadius: 4,
                            }}
                          >
                            Unread
                          </span>
                        )}
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 12,
                          color: "#64748b",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {item.message}
                      </p>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => markNotificationAsRead(item.id)}
                        disabled={item.isRead}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "4px 8px",
                          fontSize: 11.5,
                          fontWeight: 600,
                          background: item.isRead ? "#f1f5f9" : "#ffffff",
                          color: item.isRead ? "#94a3b8" : "#059669",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          cursor: item.isRead ? "default" : "pointer",
                        }}
                        title={item.isRead ? "Already read" : "Mark as read"}
                      >
                        <Check size={12} />
                        <span>{item.isRead ? "Read" : "Mark as Read"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => clearNotification(item.id)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 5,
                          background: "#ffffff",
                          color: "#64748b",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          cursor: "pointer",
                        }}
                        title="Clear notification"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ))}
                {settingsNotifs.length > 5 && (
                  <div style={{ textAlign: "center", paddingTop: 8 }}>
                    <Link
                      to="/settings/notifications"
                      style={{ fontSize: 12, fontWeight: 700, color: "#059669", textDecoration: "none" }}
                    >
                      View all {settingsNotifs.length} notifications in Notifications Hub →
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
          </div>
          )}

          {/* ── Appearance ── */}
          {activeTab === "appearance" && (
            <div className="settings-section-content appearance-section-container">
              <div className="appearance-header-banner">
                <div className="settings-section-titles">
                  <h3 className="settings-section-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Palette size={20} style={{ color: "#10b981" }} /> Appearance & Theme
                  </h3>
                  <p className="settings-section-subtitle">
                    Customize display theme, layout density, and desktop navigation preferences
                  </p>
                </div>
                <div className="appearance-status-pill">
                  <CheckCircle2 size={13} />
                  <span>Preferences saved & active</span>
                </div>
              </div>

              {/* Theme Picker Block */}
              <div className="appearance-block">
                <div className="appearance-block-title">
                  <Sparkles size={16} /> Theme & Color Scheme
                </div>
                <p className="appearance-block-desc">
                  Choose your preferred workspace aesthetic. System mode dynamically mirrors your operating system display settings.
                </p>

                <div className="theme-picker-grid">
                  {/* Light Theme Card */}
                  <div
                    className={`theme-card${colorScheme === "light" ? " theme-card--active" : ""}`}
                    onClick={() => setColorScheme("light")}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setColorScheme("light"); }}
                  >
                    <div className="theme-card-preview preview--light">
                      <div className="preview-sidebar" />
                      <div className="preview-body">
                        <div className="preview-header" />
                        <div className="preview-cards">
                          <div className="preview-card" />
                          <div className="preview-card" />
                        </div>
                      </div>
                    </div>
                    <div className="theme-card-info">
                      <div className="theme-card-title-group">
                        <Sun className="theme-card-icon" />
                        <span className="theme-card-title">Light Theme</span>
                      </div>
                      {colorScheme === "light" && (
                        <span className="theme-card-badge">
                          <Check size={11} /> Active
                        </span>
                      )}
                    </div>
                    <p className="theme-card-desc">
                      High-clarity daylight theme with crisp borders and emerald accents.
                    </p>
                  </div>

                  {/* Dark Theme Card */}
                  <div
                    className={`theme-card${colorScheme === "dark" ? " theme-card--active" : ""}`}
                    onClick={() => setColorScheme("dark")}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setColorScheme("dark"); }}
                  >
                    <div className="theme-card-preview preview--dark">
                      <div className="preview-sidebar" />
                      <div className="preview-body">
                        <div className="preview-header" />
                        <div className="preview-cards">
                          <div className="preview-card" />
                          <div className="preview-card" />
                        </div>
                      </div>
                    </div>
                    <div className="theme-card-info">
                      <div className="theme-card-title-group">
                        <Moon className="theme-card-icon" />
                        <span className="theme-card-title">Dark Theme</span>
                      </div>
                      {colorScheme === "dark" && (
                        <span className="theme-card-badge">
                          <Check size={11} /> Active
                        </span>
                      )}
                    </div>
                    <p className="theme-card-desc">
                      Obsidian & deep emerald OLED theme engineered to minimize eye strain.
                    </p>
                  </div>

                  {/* System Theme Card */}
                  <div
                    className={`theme-card${colorScheme === "system" ? " theme-card--active" : ""}`}
                    onClick={() => setColorScheme("system")}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setColorScheme("system"); }}
                  >
                    <div className="theme-card-preview preview--system">
                      <div className="preview-split-box">
                        Auto OS Sync
                      </div>
                    </div>
                    <div className="theme-card-info">
                      <div className="theme-card-title-group">
                        <Monitor className="theme-card-icon" />
                        <span className="theme-card-title">System Auto</span>
                      </div>
                      {colorScheme === "system" && (
                        <span className="theme-card-badge">
                          <Check size={11} /> Active ({resolvedTheme === "dark" ? "Dark" : "Light"})
                        </span>
                      )}
                    </div>
                    <p className="theme-card-desc">
                      Automatically syncs with Windows or macOS daylight and night schedules.
                    </p>
                  </div>
                </div>

                {/* Quick Segmented Switch */}
                <div style={{ marginTop: "12px" }}>
                  <SettingRow
                    label="Quick Scheme Switch"
                    description="Switch active color palette instantly"
                  >
                    <div className="settings-segmented">
                      {(["light", "dark", "system"] as const).map((scheme) => (
                        <button
                          key={scheme}
                          type="button"
                          className={`settings-seg-btn${colorScheme === scheme ? " settings-seg-btn--active" : ""}`}
                          onClick={() => setColorScheme(scheme)}
                        >
                          {scheme === "light" ? "Light" : scheme === "dark" ? "Dark" : "System Sync"}
                        </button>
                      ))}
                    </div>
                  </SettingRow>
                </div>
              </div>

              {/* Information Density / Compact Mode Block */}
              <div className="appearance-block">
                <div className="appearance-block-title">
                  <Sliders size={16} /> Information Density
                </div>
                <p className="appearance-block-desc">
                  Adjust interface padding and table spacing according to your monitor size and reading preferences.
                </p>

                <div className="density-card-container">
                  {/* Comfortable */}
                  <div
                    className={`density-option-card${!compactMode ? " density-option-card--active" : ""}`}
                    onClick={() => setCompactMode(false)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setCompactMode(false); }}
                  >
                    <div className="density-preview-mockup">
                      <div className="density-preview-row">
                        <span className="density-dot" />
                        <span className="density-line" />
                        <span className="density-tag" />
                      </div>
                      <div className="density-preview-row">
                        <span className="density-dot" />
                        <span className="density-line" style={{ width: "60%" }} />
                        <span className="density-tag" />
                      </div>
                    </div>
                    <div className="theme-card-info">
                      <strong className="theme-card-title">Comfortable (Standard)</strong>
                      {!compactMode && (
                        <span className="theme-card-badge"><Check size={11} /> Active</span>
                      )}
                    </div>
                    <p className="theme-card-desc">
                      Standard spacious padding, ideal for everyday browsing and touch displays.
                    </p>
                  </div>

                  {/* Compact */}
                  <div
                    className={`density-option-card compact-active${compactMode ? " density-option-card--active" : ""}`}
                    onClick={() => setCompactMode(true)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setCompactMode(true); }}
                  >
                    <div className="density-preview-mockup">
                      <div className="density-preview-row">
                        <span className="density-dot" />
                        <span className="density-line" />
                        <span className="density-tag" />
                      </div>
                      <div className="density-preview-row">
                        <span className="density-dot" />
                        <span className="density-line" style={{ width: "60%" }} />
                        <span className="density-tag" />
                      </div>
                    </div>
                    <div className="theme-card-info">
                      <strong className="theme-card-title">Compact (High Density)</strong>
                      {compactMode && (
                        <span className="theme-card-badge"><Check size={11} /> Active</span>
                      )}
                    </div>
                    <p className="theme-card-desc">
                      Tighter padding and smaller row heights. Shows up to 35% more data per screen.
                    </p>
                  </div>
                </div>

                <div style={{ marginTop: "12px" }}>
                  <SettingRow
                    label="Compact mode"
                    description="Toggle compact table rows and reduced card padding across all pages"
                  >
                    <Toggle
                      id="compact-mode"
                      checked={compactMode}
                      onChange={setCompactMode}
                    />
                  </SettingRow>
                </div>
              </div>

              {/* Desktop Sidebar Layout Behavior */}
              <div className="appearance-block">
                <div className="appearance-block-title">
                  {sidebarCollapsed ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />} Desktop Navigation
                </div>
                <p className="appearance-block-desc">
                  Choose your default desktop sidebar behavior. You can also toggle this at any time using <strong>Ctrl+B</strong> or the header button.
                </p>

                <SettingRow
                  label="Sidebar default state"
                  description="Choose whether the sidebar opens in full width or compact icon-rail mode"
                >
                  <div className="settings-segmented">
                    <button
                      type="button"
                      className={`settings-seg-btn${!sidebarCollapsed ? " settings-seg-btn--active" : ""}`}
                      onClick={() => setSidebarCollapsed(false)}
                    >
                      Expanded
                    </button>
                    <button
                      type="button"
                      className={`settings-seg-btn${sidebarCollapsed ? " settings-seg-btn--active" : ""}`}
                      onClick={() => setSidebarCollapsed(true)}
                    >
                      Collapsed (Rail)
                    </button>
                  </div>
                </SettingRow>
              </div>

              {/* Actions Footer */}
              <div className="appearance-actions-bar">
                <button
                  type="button"
                  className="appearance-reset-btn"
                  onClick={resetToDefaults}
                  title="Reset appearance to application defaults"
                >
                  <RotateCcw size={14} />
                  <span>Reset to System Defaults</span>
                </button>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  Active profile: <strong>{resolvedTheme === "dark" ? "Dark Mode" : "Light Mode"}</strong> &bull; {compactMode ? "Compact" : "Standard"} Density
                </div>
              </div>
            </div>
          )}

          {/* ── Regional ── */}
          {activeTab === "regional" && (
            <div className="settings-section-content">
              <div className="settings-section-titles" style={{ marginBottom: '1.5rem' }}>
                <h3 className="settings-section-title">Regional & Language</h3>
                <p className="settings-section-subtitle">Currency, date format, and timezone</p>
              </div>
          <div className="settings-form">
            <div className="settings-form-grid">
              <div className="settings-field">
                <label htmlFor="sett-currency">Currency</label>
                <select
                  id="sett-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option value="NGN">Nigerian Naira (₦)</option>
                  <option value="USD">US Dollar ($)</option>
                  <option value="GBP">British Pound (£)</option>
                  <option value="EUR">Euro (€)</option>
                </select>
              </div>
              <div className="settings-field">
                <label htmlFor="sett-date-fmt">Date format</label>
                <select
                  id="sett-date-fmt"
                  value={dateFormat}
                  onChange={(e) => setDateFormat(e.target.value)}
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>
              <div className="settings-field settings-field--full">
                <label htmlFor="sett-tz">Timezone</label>
                <input
                  id="sett-tz"
                  type="text"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="Africa/Lagos"
                />
              </div>
            </div>
          </div>
          </div>
          )}

          {/* ── Privacy ── */}
          {activeTab === "privacy" && (
            <div className="settings-section-content">
              <div className="settings-section-titles" style={{ marginBottom: '1.5rem' }}>
                <h3 className="settings-section-title">Privacy & Security</h3>
                <p className="settings-section-subtitle">Session management and data sharing</p>
              </div>
          <div className="settings-form">
            <SettingRow
              label="Share usage analytics"
              description="Help improve the app by sharing anonymous usage data"
            >
              <Toggle
                id="share-analytics"
                checked={shareAnalytics}
                onChange={setShareAnalytics}
              />
            </SettingRow>
            <SettingRow
              label="Session timeout"
              description="Automatically sign out after inactivity"
            >
              <select
                id="session-timeout"
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(e.target.value)}
                className="settings-select-sm"
              >
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="120">2 hours</option>
                <option value="480">8 hours</option>
                <option value="never">Never</option>
              </select>
            </SettingRow>

            <div className="settings-danger-zone">
              <p className="settings-danger-label">Danger zone</p>
              <button className="btn-danger-outline" type="button">
                Sign out of all devices
              </button>
            </div>
          </div>
          </div>
          )}

          {/* ── Drink Categories ── */}
          {activeTab === "drinkCategories" && (
            <div className="settings-section-content">
              <div className="settings-section-titles" style={{ marginBottom: '1.5rem' }}>
                <h3 className="settings-section-title">Drink Categories</h3>
                <p className="settings-section-subtitle">Manage the category labels used to group drink types</p>
              </div>
          <DrinkCategoriesSection />
          </div>
          )}

          {/* ── Drinks & Products ── */}
          {activeTab === "drinksAndProducts" && (
            <div className="settings-section-content" style={{ padding: 0, background: "transparent", border: "none", boxShadow: "none" }}>
              <DrinksAndProductsSection />
            </div>
          )}

          {/* ── User Management (Admin only) ── */}
          {activeTab === "users" && isAdmin && (
            <div className="settings-section-content" style={{ padding: 0, background: "transparent", border: "none", boxShadow: "none" }}>
              <UserManagementSection />
            </div>
          )}

          {/* ── Role Management ── */}
          {activeTab === "roles" && (
            <div className="settings-section-content" style={{ padding: 0, background: "transparent", border: "none", boxShadow: "none" }}>
              <RoleManagementSection />
            </div>
          )}

          {/* ── Regions ── */}
          {activeTab === "regions" && (
            <div className="settings-section-content" style={{ padding: 0, background: "transparent", border: "none", boxShadow: "none" }}>
              <RegionsSection />
            </div>
          )}

          {/* ── Outlet Types ── */}
          {activeTab === "outletTypes" && (
            <div className="settings-section-content" style={{ padding: 0, background: "transparent", border: "none", boxShadow: "none" }}>
              <OutletTypesSection />
            </div>
          )}

          {/* ── Payment Methods ── */}
          {activeTab === "paymentMethods" && (
            <div className="settings-section-content" style={{ padding: 0, background: "transparent", border: "none", boxShadow: "none" }}>
              <PaymentMethodsSection />
            </div>
          )}

          {/* ── Visit Outcomes ── */}
          {activeTab === "visitOutcomes" && (
            <div className="settings-section-content" style={{ padding: 0, background: "transparent", border: "none", boxShadow: "none" }}>
              <VisitOutcomesSection />
            </div>
          )}

          {/* ── Geofencing & 3rd-Party Integrations (Jibble-Style) ── */}
          {activeTab === "geofencing" && (
            <div className="settings-section-content" style={{ padding: 0, background: "transparent", border: "none", boxShadow: "none" }}>
              <GeofencingSection />
            </div>
          )}

          {/* ── In-App Communications & Calls Module Settings (Admin Only) ── */}
          {activeTab === "communications" && (
            <div className="settings-section-content" style={{ padding: 0, background: "transparent", border: "none", boxShadow: "none" }}>
              <CommunicationsSection />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}