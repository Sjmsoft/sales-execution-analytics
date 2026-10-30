import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LogOut, MapPin, Menu, MessageSquare, PanelLeftClose, PanelLeftOpen, Download, WifiOff, Sun, Moon, KeyRound } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import BrandLogo3D from "../brand/BrandLogo3D";
import { getUnreadMessagesCount, messagingEvents } from "../../services/messagingService";
import NotificationCenter from "./NotificationCenter";
import { usePWA } from "../../hooks/usePWA";
import { useAppearance } from "../../hooks/useAppearance";

const ROUTE_TITLES: Record<string, { title: string; section: string }> = {
  "/": { title: "Executive Command Center", section: "Overview" },
  "/messages": { title: "Messages & Calls", section: "Communications" },
  "/notifications": { title: "Notifications Hub", section: "Overview" },
  "/check-in": { title: "Check-In & Attendance", section: "Field Operations" },
  "/attendance": { title: "Daily Attendance", section: "Field Operations" },
  "/visits/check-in": { title: "Outlet Visit Check-In", section: "Field Operations" },
  "/visits/activity": { title: "Team Activity", section: "Analytics & Tracking" },
  "/visits": { title: "Outlet Visits History", section: "Field Operations" },
  "/outlets": { title: "Outlets Directory", section: "Trade Network" },
  "/sales/new": { title: "Record New Sale", section: "Sales Execution" },
  "/sales": { title: "Sales Transactions", section: "Sales Execution" },
  "/targets": { title: "Sales Targets", section: "Revenue Planning" },
  "/reports/field-performance": { title: "Field Team Performance", section: "Analytics" },
  "/reports": { title: "Performance Reports", section: "Analytics" },
  "/staff": { title: "Field Team Directory", section: "Organization" },
  "/settings": { title: "System Settings", section: "Administration" },
};

type HeaderProps = {
  onMenuClick: () => void;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
};

export default function Header({
  onMenuClick,
  sidebarCollapsed = false,
  onToggleSidebar,
}: HeaderProps) {
  const location = useLocation();
  const { staff, role, signOut } = useAuth();
  const { isInstallable, isOffline, installApp } = usePWA();
  const { resolvedTheme, setColorScheme } = useAppearance();

  const currentRouteMeta = useMemo(() => {
    const exact = ROUTE_TITLES[location.pathname];
    if (exact) return exact;
    const matchKey = Object.keys(ROUTE_TITLES)
      .filter((k) => k !== "/")
      .sort((a, b) => b.length - a.length)
      .find((k) => location.pathname.startsWith(k));
    return matchKey
      ? ROUTE_TITLES[matchKey]
      : { title: "Sales Execution Analytics", section: "Workspace" };
  }, [location.pathname]);

  const initials = useMemo(() => {
    if (!staff?.name) return "PE";
    const parts = staff.name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return staff.name.slice(0, 2).toUpperCase();
  }, [staff?.name]);

  const [unreadCount, setUnreadCount] = useState(() => getUnreadMessagesCount());

  useEffect(() => {
    const updateCount = () => setUnreadCount(getUnreadMessagesCount());
    const unsub1 = messagingEvents.on("new_message", updateCount);
    const unsub2 = messagingEvents.on("conversations_updated", updateCount);
    const unsub3 = messagingEvents.on("messages_updated", updateCount);
    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, []);

  return (
    <header className="app-header">
      {/* ── Mobile Header Brand Block & Menu Button ── */}
      <div className="mobile-header-brand" style={{ gap: 10 }}>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onMenuClick();
          }}
          aria-label="Open navigation menu"
          title="Open navigation menu"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: 8,
            border: "1px solid var(--border-default, #e2e8f0)",
            background: "var(--surface-subtle, #f8fafc)",
            color: "var(--text-main, #0f172a)",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <Menu size={18} />
        </button>

        <Link to="/" className="mobile-brand-link" aria-label="Go to dashboard">
          <BrandLogo3D size={34} tone="light" motion="sway" />
          <div className="mobile-brand-copy">
            <strong>Pen Edge</strong>
            <span>Field Analytics</span>
          </div>
        </Link>
      </div>

      {/* ── Desktop Left Cluster: Sidebar Toggle & Title ── */}
      <div className="header-left-cluster">
        {onToggleSidebar && (
          <button
            type="button"
            className="desktop-sidebar-toggle-btn"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleSidebar();
            }}
            title={sidebarCollapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        )}

        <div className="header-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1 style={{ margin: 0 }}>{currentRouteMeta.title}</h1>
          <span
            style={{
              fontSize: "0.7rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              padding: "2px 8px",
              borderRadius: 999,
              background: "var(--surface-subtle, #f1f5f9)",
              color: "var(--text-muted, #64748b)",
              border: "1px solid var(--border-default, #e2e8f0)",
            }}
          >
            {currentRouteMeta.section}
          </span>
        </div>
      </div>

      {/* ── Header Right: User Info & Actions ── */}
      <div className="header-user">
        {/* Quick Theme Toggle (Light / Dark) */}
        <button
          type="button"
          onClick={() => setColorScheme(resolvedTheme === "dark" ? "light" : "dark")}
          title={resolvedTheme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          aria-label={resolvedTheme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "var(--surface-subtle, #f1f5f9)",
            color: "var(--text-main, #334155)",
            border: "1px solid var(--border-default, #e2e8f0)",
            cursor: "pointer",
            marginRight: 2,
            transition: "all 0.15s ease",
          }}
        >
          {resolvedTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Quick Change Password / Security Settings Link */}
        <Link
          to="/settings?tab=security"
          title="Account Security & Change Password"
          aria-label="Account security and change password"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "var(--surface-subtle, #f1f5f9)",
            color: "var(--text-main, #334155)",
            border: "1px solid var(--border-default, #e2e8f0)",
            textDecoration: "none",
            marginRight: 2,
            transition: "all 0.15s ease",
          }}
        >
          <KeyRound size={15} />
        </Link>

        {/* Messages & Calls Quick Link */}
        <Link
          to="/messages"
          className="header-messages-link"
          title="Messages & Calls (Teams & WhatsApp Hub)"
          aria-label="Open messages and calls"
          style={{
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "var(--surface-subtle, #f1f5f9)",
            color: "var(--text-main, #334155)",
            border: "1px solid var(--border-default, #e2e8f0)",
            textDecoration: "none",
            marginRight: 4,
            transition: "all 0.15s ease",
          }}
        >
          <MessageSquare size={16} />
          {unreadCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: -2,
                right: -2,
                background: "#059669",
                color: "#ffffff",
                fontSize: 10,
                fontWeight: 800,
                padding: "1px 5px",
                borderRadius: 9999,
                border: "2px solid #ffffff",
                minWidth: 15,
                textAlign: "center",
              }}
            >
              {unreadCount}
            </span>
          )}
        </Link>

        {/* Offline Status Indicator */}
        {isOffline && (
          <span
            className="pwa-offline-pill"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 8px",
              background: "#fef3c7",
              border: "1px solid #fde68a",
              color: "#92400e",
              borderRadius: 20,
              fontSize: "0.75rem",
              fontWeight: 600,
            }}
            title="Working offline with cached data"
          >
            <WifiOff size={13} />
            <span className="desktop-only">Offline</span>
          </span>
        )}

        {/* Install PWA Button */}
        {isInstallable && (
          <button
            type="button"
            className="pwa-install-header-btn desktop-only"
            onClick={installApp}
            title="Install Pen Edge App to desktop or device"
            aria-label="Install App"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              background: "#075544",
              color: "#ffffff",
              border: "none",
              borderRadius: 8,
              fontSize: "0.78rem",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
              transition: "all 0.15s ease",
            }}
          >
            <Download size={14} />
            <span>Install App</span>
          </button>
        )}

        {/* Notifications Center Quick Trigger */}
        <NotificationCenter />

        <div className="user-info">
          <strong>{staff?.name ?? "Sales Staff"}</strong>
          <div className="user-meta-line">
            <span>{role?.name ?? "Active Account"}</span>
            {staff?.region && (
              <span className="user-region-badge">
                <MapPin size={10} />
                {staff.region}
              </span>
            )}
          </div>
        </div>

        {/* Desktop Sign Out Button */}
        <button
          type="button"
          className="logout-button desktop-only"
          onClick={signOut}
          title="Sign out"
          aria-label="Sign out of your account"
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>

        {/* Mobile User Avatar Trigger Button */}
        <button
          type="button"
          className="mobile-user-avatar-btn"
          onClick={onMenuClick}
          aria-label="Open navigation menu and profile"
        >
          <div className="mobile-avatar-circle">{initials}</div>
          <span className="online-indicator-dot" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}