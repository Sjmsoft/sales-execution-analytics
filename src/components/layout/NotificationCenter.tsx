import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  Trash2,
  Check,
  X,
  Target,
  Radio,
  ClipboardCheck,
  CheckCircle2,
  ChevronRight,
  Settings,
  Sparkles,
} from "lucide-react";
import {
  getNotifications,
  getUnreadNotificationsCount,
  markNotificationAsRead,
  markNotificationAsUnread,
  markAllNotificationsAsRead,
  clearNotification,
  clearAllNotifications,
  subscribeNotifications,
  type NotificationItem,
  type NotificationType,
} from "../../services/notificationService";
import "./NotificationCenter.css";

function formatRelativeTime(isoString: string): string {
  try {
    const timestamp = new Date(isoString).getTime();
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 172800) return "Yesterday";
    return new Date(isoString).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case "target":
      return <Target size={16} />;
    case "broadcast":
      return <Radio size={16} />;
    case "sale":
      return <CheckCircle2 size={16} />;
    case "attendance":
      return <ClipboardCheck size={16} />;
    case "system":
    default:
      return <Bell size={16} />;
  }
}

export default function NotificationCenter() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");
  const [notifications, setNotifications] = useState<NotificationItem[]>(() =>
    getNotifications()
  );
  const [unreadCount, setUnreadCount] = useState<number>(() =>
    getUnreadNotificationsCount()
  );

  const containerRef = useRef<HTMLDivElement>(null);

  // Sync state on change
  useEffect(() => {
    const update = (items: NotificationItem[]) => {
      setNotifications(items);
      setUnreadCount(items.filter((n) => !n.isRead).length);
    };
    const unsub = subscribeNotifications(update);
    return () => unsub();
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const displayedNotifications =
    activeTab === "unread"
      ? notifications.filter((n) => !n.isRead)
      : notifications;

  const handleItemClick = (item: NotificationItem) => {
    if (!item.isRead) {
      markNotificationAsRead(item.id);
    }
    if (item.link) {
      setIsOpen(false);
      navigate(item.link);
    }
  };

  const handleToggleRead = (e: React.MouseEvent, item: NotificationItem) => {
    e.stopPropagation();
    if (item.isRead) {
      markNotificationAsUnread(item.id);
    } else {
      markNotificationAsRead(item.id);
    }
  };

  const handleClear = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    clearNotification(id);
  };

  const handleMarkAllRead = () => {
    markAllNotificationsAsRead();
  };

  const handleClearAll = () => {
    if (window.confirm("Clear all notifications? This cannot be undone.")) {
      clearAllNotifications();
    }
  };

  return (
    <div className="notif-center-wrapper" ref={containerRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        className={`notif-bell-btn ${isOpen ? "active" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
        title="Notifications"
        aria-label={`Notifications (${unreadCount} unread)`}
        aria-expanded={isOpen}
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span className="notif-badge-count">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="notif-dropdown" role="dialog" aria-label="Notifications Panel">
          {/* Header */}
          <div className="notif-dropdown-header">
            <div className="notif-header-title-box">
              <h3>Notifications</h3>
              {unreadCount > 0 && (
                <span className="notif-unread-pill">{unreadCount} new</span>
              )}
            </div>

            <div className="notif-header-actions">
              <button
                type="button"
                className="notif-action-btn"
                onClick={handleMarkAllRead}
                disabled={unreadCount === 0}
                title="Mark all notifications as read"
              >
                <CheckCheck size={13} />
                <span>Mark all read</span>
              </button>

              <button
                type="button"
                className="notif-action-btn btn-clear"
                onClick={handleClearAll}
                disabled={notifications.length === 0}
                title="Clear all notifications"
              >
                <Trash2 size={13} />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="notif-filter-tabs">
            <button
              type="button"
              className={`notif-tab-btn ${activeTab === "all" ? "active" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              <span>All</span>
              <span className="notif-tab-count">{notifications.length}</span>
            </button>
            <button
              type="button"
              className={`notif-tab-btn ${
                activeTab === "unread" ? "active" : ""
              }`}
              onClick={() => setActiveTab("unread")}
            >
              <span>Unread</span>
              <span className="notif-tab-count">{unreadCount}</span>
            </button>
          </div>

          {/* Notifications List */}
          <div className="notif-list">
            {displayedNotifications.length === 0 ? (
              <div className="notif-empty-state">
                <div className="notif-empty-icon">
                  {activeTab === "unread" ? (
                    <Sparkles size={22} />
                  ) : (
                    <Bell size={22} />
                  )}
                </div>
                <h4>
                  {activeTab === "unread"
                    ? "All caught up!"
                    : "No notifications"}
                </h4>
                <p>
                  {activeTab === "unread"
                    ? "You have no unread notifications at this time."
                    : "Cleared notifications will appear here when new alerts are dispatched."}
                </p>
              </div>
            ) : (
              displayedNotifications.map((item) => (
                <div
                  key={item.id}
                  className={`notif-item ${!item.isRead ? "unread" : ""}`}
                  onClick={() => handleItemClick(item)}
                  title={item.link ? `Click to view ${item.title}` : undefined}
                >
                  <div className={`notif-icon-box ${item.type}`}>
                    {getNotificationIcon(item.type)}
                  </div>

                  <div className="notif-content">
                    <div className="notif-title-row">
                      <h5 className="notif-title">{item.title}</h5>
                      <span className="notif-time">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>

                    <p className="notif-message">{item.message}</p>

                    <div className="notif-footer-row">
                      <span className="notif-sender-badge">
                        {item.sender || item.category || "Alert"}
                      </span>

                      <div className="notif-item-actions">
                        <button
                          type="button"
                          className="notif-item-btn btn-read-toggle"
                          onClick={(e) => handleToggleRead(e, item)}
                          title={
                            item.isRead ? "Mark as unread" : "Mark as read"
                          }
                          aria-label={
                            item.isRead ? "Mark as unread" : "Mark as read"
                          }
                        >
                          <Check
                            size={14}
                            color={item.isRead ? "#94a3b8" : "#059669"}
                          />
                        </button>
                        <button
                          type="button"
                          className="notif-item-btn btn-delete"
                          onClick={(e) => handleClear(e, item.id)}
                          title="Clear notification"
                          aria-label="Clear notification"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {!item.isRead && <span className="notif-unread-dot" />}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="notif-dropdown-footer">
            <Link
              to="/settings/notifications"
              className="notif-footer-link"
              onClick={() => setIsOpen(false)}
            >
              <span>Manage Notifications Hub</span>
              <ChevronRight size={13} />
            </Link>

            <Link
              to="/settings"
              className="notif-settings-link"
              onClick={() => setIsOpen(false)}
              title="Alert Preferences"
            >
              <Settings size={13} />
              <span>Settings</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
