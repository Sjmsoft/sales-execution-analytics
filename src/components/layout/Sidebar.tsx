import { useMemo, useState, useEffect } from "react";
import { Link, NavLink } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Gauge,
  LayoutDashboard,
  LogOut,
  MapPin,
  MapPinPlus,
  ChartNoAxesCombined,
  MessageSquare,
  Network,
  Search,
  Settings,
  ShoppingCart,
  Store,
  Target,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import type { NavigationItem } from "../../config/navigation";
import { navigationItems } from "../../config/navigation";
import { useAuth } from "../../context/AuthContext";
import BrandLogo3D from "../brand/BrandLogo3D";
import { getUnreadNotificationsCount, subscribeNotifications } from "../../services/notificationService";

type SidebarProps = {
  mobileOpen: boolean;
  onClose: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
};

const navigationIcons: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  messages: MessageSquare,
  attendance: ClipboardCheck,
  sales: ShoppingCart,
  targets: Target,
  outlets: Store,
  visits: MapPin,
  log_visit: MapPinPlus,
  reports: BarChart3,
  tracker: Gauge,
  performance: BriefcaseBusiness,
  analytics: ChartNoAxesCombined,
  vsr: Network,
  ms: UsersRound,
  team: Users,
  activity: Activity,
  settings: Settings,
  notifications: Bell,
};

type NavigationGroup = {
  id: string;
  title: string;
  paths: string[];
};

const navigationGroups: NavigationGroup[] = [
  {
    id: "overview",
    title: "Overview",
    paths: ["/", "/check-in", "/messages", "/attendance"],
  },
  {
    id: "execution",
    title: "Field & Trade",
    paths: ["/sales", "/sales/tracker", "/targets", "/outlets", "/visits"],
  },
  {
    id: "analytics",
    title: "Analytics & Performance",
    paths: [
      "/reports",
      "/reports/field-performance",
    ],
  },
  {
    id: "management",
    title: "Organization & System",
    paths: ["/staff", "/visits/activity", "/settings", "/settings/notifications"],
  },
];

export default function Sidebar({
  mobileOpen,
  onClose,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const { staff, role, signOut } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [unreadNotifCount, setUnreadNotifCount] = useState(() => getUnreadNotificationsCount());

  useEffect(() => {
    const unsub = subscribeNotifications((items) => {
      setUnreadNotifCount(items.filter((n) => !n.isRead).length);
    });
    return () => unsub();
  }, []);

  const roleKey = (role?.key || staff?.user_roles?.key || staff?.assigned_role || "").toLowerCase();
  const isAdmin = roleKey === "administrator" || roleKey === "admin" || role?.hierarchy_level === 1;
  const isExecutive =
    isAdmin ||
    roleKey === "national_sales_manager" ||
    roleKey === "nsm" ||
    roleKey === "hr" ||
    (role?.hierarchy_level === 2 && role?.can_view_all_sales === true);
  const isBA = roleKey === "brand_ambassador" || roleKey === "ba" || roleKey === "vsr";

  // Filter items visible to this role
  const visibleItems = useMemo(
    () =>
      navigationItems.filter((item) => {
        // Unified Check-In & Attendance and Outlet Visits History are enabled for all users across the organization
        if (item.path === "/check-in" || item.path === "/attendance" || item.path === "/visits") {
          return true;
        }
        // Messages & Calls is enabled for all users across the organization
        if (item.path === "/messages") {
          return true;
        }
        // BA & VSR roles see: Check-In, Sales, Targets, and Outlet Visits History
        if (isBA) {
          return (
            item.path === "/check-in" ||
            item.path === "/attendance" ||
            item.path === "/sales" ||
            item.path === "/targets" ||
            item.path === "/visits"
          );
        }
        // Executive Command Center dashboard only visible to admin, NSM and HR
        if (item.path === "/") {
          return isExecutive;
        }
        if (item.path.startsWith("/settings")) {
          return isAdmin;
        }
        return roleKey ? item.roles.includes(roleKey) : true;
      }),
    [roleKey, isAdmin, isExecutive, isBA]
  );

  // Filter items by search query if user is searching
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return visibleItems;
    return visibleItems.filter((item) =>
      item.label.toLowerCase().includes(q)
    );
  }, [visibleItems, searchQuery]);

  // Group items into logical sections
  const groupedSections = useMemo(() => {
    const itemsByPath = new Map<string, NavigationItem>();
    filteredItems.forEach((item) => itemsByPath.set(item.path, item));

    const assignedPaths = new Set<string>();

    const groups = navigationGroups
      .map((grp) => {
        const items = grp.paths
          .map((p) => itemsByPath.get(p))
          .filter((item): item is NavigationItem => Boolean(item));

        items.forEach((item) => assignedPaths.add(item.path));
        return {
          id: grp.id,
          title: grp.title,
          items,
        };
      })
      .filter((grp) => grp.items.length > 0);

    // Any remaining items not explicitly in groups
    const remaining = filteredItems.filter((item) => !assignedPaths.has(item.path));
    if (remaining.length > 0) {
      groups.push({
        id: "additional",
        title: "Additional Links",
        items: remaining,
      });
    }

    return groups;
  }, [filteredItems]);

  // Calculate initials for avatar
  const initials = useMemo(() => {
    if (!staff?.name) return "PE";
    const parts = staff.name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return staff.name.slice(0, 2).toUpperCase();
  }, [staff?.name]);

  return (
    <>
      {mobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`sidebar ${mobileOpen ? "sidebar-open" : ""} ${collapsed ? "collapsed" : ""}`}
        aria-label="Main Navigation"
      >
        {/* ── Brand Logo Header ── */}
        <div className="sidebar-logo">
          <Link
            to="/"
            className="sidebar-brand-wrapper"
            onClick={onClose}
            title={collapsed ? "Pen Edge Sales Dashboard" : undefined}
          >
            <BrandLogo3D size={collapsed ? 34 : 44} tone="dark" motion="sway" />

            {!collapsed && (
              <div className="sidebar-brand-text">
                <strong>Pen Edge</strong>
                <span>SALES DASHBOARD</span>
              </div>
            )}
          </Link>

          {onToggleCollapse && (
            <button
              type="button"
              className="sidebar-collapse-toggle-btn desktop-only"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleCollapse();
              }}
              title={collapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
            </button>
          )}

          {mobileOpen && (
            <button
              type="button"
              className="sidebar-close-btn"
              onClick={onClose}
              aria-label="Close navigation"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* ── Quick Search Filter ── */}
        {!collapsed && (
          <div className="sidebar-search-container">
            <div className="sidebar-search-wrap">
              <Search className="sidebar-search-icon" size={14} aria-hidden="true" />
              <input
                type="text"
                className="sidebar-search-input"
                placeholder="Find menu item..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search navigation items"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="sidebar-search-clear"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Navigation Tree ── */}
        <nav className="sidebar-nav">
          {groupedSections.length === 0 ? (
            <div style={{ padding: "20px 16px", textAlign: "center", color: "#64748b", fontSize: "12px" }}>
              No matches for "{searchQuery}"
            </div>
          ) : (
            groupedSections.map((group) => (
              <div key={group.id} className="sidebar-group">
                <div className="sidebar-group-title">
                  <span>{group.title}</span>
                  <span style={{ fontSize: "9px", opacity: 0.6 }}>{group.items.length}</span>
                </div>

                <ul className="sidebar-group-items">
                  {group.items.map((item) => {
                    const Icon = navigationIcons[item.icon] ?? LayoutDashboard;

                    return (
                      <li key={`${item.path}-${item.label}`}>
                        <NavLink
                          to={item.path}
                          onClick={onClose}
                          end={item.path === "/"}
                          className={({ isActive }) =>
                            `nav-item ${isActive ? "nav-item-active" : ""}`
                          }
                          data-tooltip={item.label}
                          title={collapsed ? item.label : undefined}
                        >
                          {({ isActive }) => (
                            <>
                              <div className="nav-item-left">
                                <Icon className="nav-icon" aria-hidden="true" />
                                <span>{isBA && item.path === "/check-in" ? "Daily Attendance" : item.label}</span>
                                {item.path === "/settings/notifications" && unreadNotifCount > 0 && (
                                  <span
                                    className="nav-item-badge"
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 800,
                                      background: "#059669",
                                      color: "#ffffff",
                                      padding: "1px 6px",
                                      borderRadius: 999,
                                      marginLeft: 6,
                                    }}
                                  >
                                    {unreadNotifCount}
                                  </span>
                                )}
                              </div>
                              {isActive && <span className="nav-active-pip" aria-hidden="true" />}
                            </>
                          )}
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </nav>

        {/* ── Sidebar Footer & User Profile Card ── */}
        <div className="sidebar-footer">
          <div className="sidebar-profile-card">
            <div
              className="sidebar-profile-user"
              title={`${staff?.name ?? "Active Staff"} (${role?.name ?? "Sales Staff"})`}
            >
              <div className="sidebar-profile-avatar" aria-hidden="true">
                {initials}
              </div>
              {!collapsed && (
                <div className="sidebar-profile-meta">
                  <span className="sidebar-profile-name" title={staff?.name ?? "User"}>
                    {staff?.name ?? "Active Staff"}
                  </span>
                  <span className="sidebar-profile-role" title={role?.name ?? "Staff Role"}>
                    {role?.name ?? "Sales Staff"}
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              className="sidebar-signout-btn"
              onClick={signOut}
              title="Sign Out"
              aria-label="Sign out of account"
            >
              <LogOut size={15} />
            </button>
          </div>

          {!collapsed && (
            <div className="sidebar-app-meta">
              <span>Sales Execution</span>
              <span>v1.0.0</span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}