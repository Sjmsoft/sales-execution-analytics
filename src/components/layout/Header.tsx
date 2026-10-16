import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LogOut, MapPin, MessageSquare } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import BrandLogo3D from "../brand/BrandLogo3D";
import { getUnreadMessagesCount, messagingEvents } from "../../services/messagingService";
import NotificationCenter from "./NotificationCenter";

type HeaderProps = {
  onMenuClick: () => void;
};

export default function Header({ onMenuClick }: HeaderProps) {
  const { staff, role, signOut } = useAuth();

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
      {/* ── Mobile Header Brand Block ── */}
      <div className="mobile-header-brand">
        <Link to="/" className="mobile-brand-link" aria-label="Go to dashboard">
          <BrandLogo3D size={34} tone="light" motion="sway" />
          <div className="mobile-brand-copy">
            <strong>Pen Edge</strong>
            <span>Field Analytics</span>
          </div>
        </Link>
      </div>

      {/* ── Desktop Header Title ── */}
      <div className="header-title">
        <h1>Sales Execution Analytics</h1>
      </div>

      {/* ── Header Right: User Info & Actions ── */}
      <div className="header-user">
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
            background: "#f1f5f9",
            color: "#334155",
            border: "1px solid #e2e8f0",
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