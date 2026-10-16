import { useMemo, useState, useEffect } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  BarChart3,
  Bell,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Gauge,
  Grid,
  History,
  LayoutDashboard,
  LogOut,
  MapPin,
  MapPinPlus,
  MessageSquare,
  Plus,
  Search,
  Settings,
  ShoppingCart,
  Store,
  Target,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getUnreadNotificationsCount, subscribeNotifications } from "../../services/notificationService";

type MobileNavProps = {
  isDrawerOpen: boolean;
  onOpenDrawer: () => void;
  onCloseDrawer: () => void;
};

export default function MobileNav({
  isDrawerOpen,
  onOpenDrawer,
  onCloseDrawer,
}: MobileNavProps) {
  const location = useLocation();
  const { staff, role, signOut } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [showQuickActionModal, setShowQuickActionModal] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(() => getUnreadNotificationsCount());

  useEffect(() => {
    const unsub = subscribeNotifications((items) => {
      setUnreadNotifCount(items.filter((n) => !n.isRead).length);
    });
    return () => unsub();
  }, []);

  // Calculate user initials
  const initials = useMemo(() => {
    if (!staff?.name) return "PE";
    const parts = staff.name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return staff.name.slice(0, 2).toUpperCase();
  }, [staff?.name]);

  const roleKey = (role?.key || staff?.user_roles?.key || staff?.assigned_role || "").toLowerCase();
  const isAdmin = roleKey === "administrator" || roleKey === "admin" || role?.hierarchy_level === 1;
  const isExecutive =
    isAdmin ||
    roleKey === "national_sales_manager" ||
    roleKey === "nsm" ||
    roleKey === "hr";
  const isBA = roleKey === "brand_ambassador" || roleKey === "ba" || roleKey === "vsr";
  const isAttendanceExcluded =
    roleKey === "regional_sales_manager" ||
    roleKey === "rsm" ||
    roleKey === "sales_executive" ||
    roleKey === "se" ||
    roleKey === "national_sales_manager" ||
    roleKey === "nsm";

  // Main drawer navigation groups
  const navSections = useMemo(
    () => [
      {
        title: "Field & Trade Operations",
        items: [
          ...(isExecutive ? [{ label: "Dashboard", path: "/", icon: LayoutDashboard, badge: "Home" }] : []),
          { label: "Messages & Calls", path: "/messages", icon: MessageSquare, badge: "Live" },
          { label: "Notifications Hub", path: "/notifications", icon: Bell, badge: unreadNotifCount > 0 ? `${unreadNotifCount}` : null },
          { label: "Check-In & Attendance", path: "/check-in", icon: ClipboardCheck, badge: "GPS" },
          { label: "Visits & Attendance History", path: "/visits", icon: History, badge: null },
          ...(!isBA ? [{ label: "Outlets Directory", path: "/outlets", icon: Store, badge: null }] : []),
          { label: "Sales Transactions", path: "/sales", icon: ShoppingCart, badge: null },
          { label: "Record New Sale", path: "/sales/new", icon: Plus, badge: "Action" },
          { label: "Sales Targets", path: "/targets", icon: Target, badge: null },
        ],
      },
      ...(!isBA
        ? [
            {
              title: "Analytics & Performance",
              items: [
                { label: "Performance Reports", path: "/reports", icon: BarChart3, badge: null },
                { label: "Field Team Performance", path: "/reports/field-performance", icon: Users, badge: null },
                { label: "Sales Execution Tracker", path: "/sales/tracker", icon: Gauge, badge: null },
              ],
            },
            {
              title: "Team & Configuration",
              items: [
                { label: "Field Team Directory", path: "/staff", icon: Users, badge: null },
                ...(isAdmin
                  ? [{ label: "System Settings", path: "/settings", icon: Settings, badge: null }]
                  : []),
              ],
            },
          ]
        : []),
    ],
    [isAdmin, isExecutive, isBA, isAttendanceExcluded, unreadNotifCount],
  );

  // Filtered drawer items for search
  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return navSections;
    return navSections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            section.title.toLowerCase().includes(q),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [navSections, searchQuery]);

  return (
    <>
      {/* ── 1. Modern Mobile Bottom Navigation Dock ──────────────── */}
      <nav className="mobile-bottom-nav" aria-label="Mobile Bottom Navigation">
        <div className="mobile-bottom-nav-inner">
          {/* 1. Tab 1: Executive Home or Field Sales */}
          <NavLink
            to={isExecutive ? "/" : "/sales"}
            end={isExecutive}
            className={({ isActive }) =>
              `mobile-nav-tab ${isActive ? "active" : ""}`
            }
            aria-label={isExecutive ? "Dashboard" : "Sales"}
          >
            <div className="tab-icon-wrap">
              {isExecutive ? <LayoutDashboard size={20} /> : <ShoppingCart size={20} />}
            </div>
            <span className="tab-label">{isExecutive ? "Home" : "Sales"}</span>
          </NavLink>

          {/* 2. Tab 2: Unified Check-In & Attendance (All Roles) */}
          <NavLink
            to="/check-in"
            className={({ isActive }) =>
              `mobile-nav-tab ${isActive || location.pathname.startsWith("/attendance") ? "active" : ""}`
            }
            aria-label="Check-In & Attendance"
          >
            <div className="tab-icon-wrap">
              <CalendarCheck size={20} />
            </div>
            <span className="tab-label">Check-In</span>
          </NavLink>

          {/* 3. Elevated Center Floating Action Button (Quick Check-In) */}
          <div className="mobile-nav-fab-container">
            <Link
              to="/check-in"
              className={`mobile-nav-fab ${
                location.pathname.startsWith("/check-in") ||
                location.pathname.startsWith("/attendance") ||
                location.pathname.startsWith("/visits/check-in")
                  ? "active"
                  : ""
              }`}
              aria-label="Quick Check-In"
            >
              <div className="fab-inner">
                <MapPinPlus size={22} className="fab-icon" />
              </div>
              <span className="fab-pulse-ring" aria-hidden="true" />
            </Link>
            <span className="fab-label">Check-In</span>
          </div>

          {/* 4. Visits History Tab */}
          <NavLink
            to="/visits"
            className={({ isActive }) =>
              `mobile-nav-tab ${isActive ? "active" : ""}`
            }
            aria-label="Outlet Visits History"
          >
            <div className="tab-icon-wrap">
              <Store size={20} />
            </div>
            <span className="tab-label">Visits</span>
          </NavLink>

          {/* 5. More Menu Tab */}
          <button
            type="button"
            className={`mobile-nav-tab mobile-nav-more-tab ${
              isDrawerOpen ? "active" : ""
            }`}
            onClick={onOpenDrawer}
            aria-label="Open Full Navigation Menu"
            aria-expanded={isDrawerOpen}
          >
            <div className="tab-icon-wrap">
              <Grid size={20} />
            </div>
            <span className="tab-label">More</span>
          </button>
        </div>
      </nav>

      {/* ── 2. Quick Check-In Modal / Sheet ──────────────────────── */}
      {showQuickActionModal && (
        <div
          className="mobile-quick-action-backdrop"
          onClick={() => setShowQuickActionModal(false)}
        >
          <div
            className="mobile-quick-action-sheet"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Choose Check-In Type"
          >
            <div className="sheet-drag-handle" aria-hidden="true" />
            <div className="quick-action-header">
              <div className="quick-action-title">
                <div className="quick-action-icon-badge">
                  <MapPinPlus size={20} />
                </div>
                <div>
                  <h4>Quick Field Check-In</h4>
                  <p>Select your operational activity to log GPS &amp; evidence</p>
                </div>
              </div>
              <button
                type="button"
                className="sheet-close-btn"
                onClick={() => setShowQuickActionModal(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="quick-action-cards">
              <Link
                to="/visits/check-in"
                className="quick-action-card highlight-outlet"
                onClick={() => setShowQuickActionModal(false)}
              >
                <div className="qa-card-icon">
                  <Store size={22} />
                </div>
                <div className="qa-card-copy">
                  <div className="qa-card-badge">Primary</div>
                  <strong>Outlet Visit Check-In</strong>
                  <span>Audit store inventory, verify GPS location &amp; log visit outcome</span>
                </div>
                <ChevronRight size={18} className="qa-arrow" />
              </Link>

              {!isAttendanceExcluded && (
                <Link
                  to="/attendance"
                  className="quick-action-card highlight-shift"
                  onClick={() => setShowQuickActionModal(false)}
                >
                  <div className="qa-card-icon icon-shift">
                    <ClipboardCheck size={22} />
                  </div>
                  <div className="qa-card-copy">
                    <div className="qa-card-badge badge-shift">Shift</div>
                    <strong>Daily Attendance Check-In</strong>
                    <span>Clock into daily work shift with location verification &amp; selfie photo</span>
                  </div>
                  <ChevronRight size={18} className="qa-arrow" />
                </Link>
              )}

              <Link
                to="/sales/new"
                className="quick-action-card highlight-sale"
                onClick={() => setShowQuickActionModal(false)}
              >
                <div className="qa-card-icon icon-sale">
                  <ShoppingCart size={22} />
                </div>
                <div className="qa-card-copy">
                  <div className="qa-card-badge badge-sale">Sales</div>
                  <strong>Record New Sale</strong>
                  <span>Create direct retail sale receipt for an outlet</span>
                </div>
                <ChevronRight size={18} className="qa-arrow" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. Modern Full Mobile Drawer (Bottom Sheet Style) ─────── */}
      {isDrawerOpen && (
        <div
          className="mobile-drawer-backdrop"
          onClick={onCloseDrawer}
          aria-hidden="true"
        >
          <aside
            className="mobile-drawer-sheet"
            onClick={(e) => e.stopPropagation()}
            aria-label="Mobile Full Navigation"
          >
            {/* Sheet Handle */}
            <div className="sheet-drag-handle" aria-hidden="true" />

            {/* Header with User Info */}
            <div className="mobile-drawer-header">
              <div className="drawer-user-block">
                <div className="drawer-avatar">{initials}</div>
                <div className="drawer-user-meta">
                  <strong>{staff?.name ?? "Sales Staff"}</strong>
                  <div className="drawer-tags-row">
                    <span className="drawer-role-pill">{role?.name ?? "Field Rep"}</span>
                    {staff?.region && (
                      <span className="drawer-region-pill">
                        <MapPin size={10} />
                        {staff.region}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="drawer-close-icon-btn"
                onClick={onCloseDrawer}
                aria-label="Close navigation sheet"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search Navigation Items */}
            <div className="drawer-search-wrap">
              <Search size={15} className="drawer-search-icon" />
              <input
                type="text"
                placeholder="Search pages, reports &amp; actions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="drawer-search-input"
                aria-label="Search navigation"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="drawer-search-clear"
                  onClick={() => setSearchQuery("")}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Navigation Lists */}
            <div className="drawer-scroll-body">
              {filteredSections.map((section) => (
                <div key={section.title} className="drawer-nav-section">
                  <h5 className="drawer-section-title">{section.title}</h5>
                  <div className="drawer-nav-grid">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive =
                        item.path === "/"
                          ? location.pathname === "/"
                          : location.pathname.startsWith(item.path);

                      return (
                        <NavLink
                          key={item.path + item.label}
                          to={item.path}
                          onClick={onCloseDrawer}
                          end={item.path === "/"}
                          className={`drawer-nav-item ${isActive ? "active" : ""}`}
                        >
                          <div className="drawer-item-left">
                            <div className="drawer-item-icon-box">
                              <Icon size={17} />
                            </div>
                            <span className="drawer-item-label">{item.label}</span>
                          </div>

                          <div className="drawer-item-right">
                            {item.badge && (
                              <span className="drawer-item-badge">{item.badge}</span>
                            )}
                            {isActive ? (
                              <CheckCircle2 size={14} className="drawer-active-check" />
                            ) : (
                              <ChevronRight size={14} className="drawer-chevron" />
                            )}
                          </div>
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer with Sign Out */}
            <div className="drawer-footer">
              <button
                type="button"
                className="drawer-signout-btn"
                onClick={() => {
                  onCloseDrawer();
                  signOut();
                }}
              >
                <LogOut size={16} />
                <span>Sign Out of Account</span>
              </button>
              <div className="drawer-meta-text">
                <span>Pen Edge Sales Execution</span>
                <span>v1.0.0</span>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
