import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  Trash2,
  Check,
  X,
  Target,
  Radio,
  ClipboardCheck,
  Search,
  Sparkles,
  ArrowRight,
  Send,
} from "lucide-react";
import {
  getNotifications,
  getUnreadNotificationsCount,
  markNotificationAsRead,
  markNotificationAsUnread,
  markAllNotificationsAsRead,
  clearNotification,
  clearAllNotifications,
  clearReadNotifications,
  addNotification,
  subscribeNotifications,
  type NotificationItem,
  type NotificationType,
} from "../services/notificationService";
import { useAuth } from "../context/AuthContext";

function formatDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

export default function Notifications() {
  const navigate = useNavigate();
  const { staff, role } = useAuth();
  const isAdmin =
    role?.key === "administrator" ||
    role?.key === "admin" ||
    role?.hierarchy_level === 1;

  const [notifications, setNotifications] = useState<NotificationItem[]>(() =>
    getNotifications()
  );
  const [unreadCount, setUnreadCount] = useState<number>(() =>
    getUnreadNotificationsCount()
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "unread" | NotificationType>("all");

  // Quick Dispatch Simulation Modal/State for testing
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [testTitle, setTestTitle] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [testType, setTestType] = useState<NotificationType>("broadcast");
  const [testPriority, setTestPriority] = useState<"normal" | "high" | "urgent">("high");

  useEffect(() => {
    const update = (items: NotificationItem[]) => {
      setNotifications(items);
      setUnreadCount(items.filter((n) => !n.isRead).length);
    };
    const unsub = subscribeNotifications(update);
    return () => unsub();
  }, []);

  const filteredNotifications = notifications.filter((item) => {
    if (filterType === "unread" && item.isRead) return false;
    if (filterType !== "all" && filterType !== "unread" && item.type !== filterType) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchMsg = item.message.toLowerCase().includes(q);
      const matchSender = (item.sender || "").toLowerCase().includes(q);
      return matchTitle || matchMsg || matchSender;
    }
    return true;
  });

  const handleMarkAllRead = () => {
    markAllNotificationsAsRead();
  };

  const handleClearRead = () => {
    clearReadNotifications();
  };

  const handleClearAll = () => {
    if (window.confirm("Are you sure you want to clear all notifications?")) {
      clearAllNotifications();
    }
  };

  const handleToggleRead = (item: NotificationItem) => {
    if (item.isRead) {
      markNotificationAsUnread(item.id);
    } else {
      markNotificationAsRead(item.id);
    }
  };

  const handleSendTestNotification = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testTitle.trim() || !testMessage.trim()) return;

    addNotification({
      title: testTitle.trim(),
      message: testMessage.trim(),
      type: testType,
      priority: testPriority,
      sender: staff?.name || "System Admin",
      category: testType.toUpperCase(),
      link: testType === "target" ? "/targets" : testType === "broadcast" ? "/messages" : "/settings",
      actionLabel: "View Details",
    });

    setTestTitle("");
    setTestMessage("");
    setShowDispatchModal(false);
  };

  const targetCount = notifications.filter((n) => n.type === "target").length;
  const broadcastCount = notifications.filter((n) => n.type === "broadcast").length;

  return (
    <div className="notif-hub-container">
      {/* ── Page Header ── */}
      <div className="notif-hub-header">
        <div>
          <div className="notif-hub-header-left">
            <div className="notif-hub-icon">
              <Bell size={20} />
            </div>
            <div>
              <h1 className="notif-hub-title">
                Notifications Hub
              </h1>
              <p className="notif-hub-subtitle">
                Review live push directives, sales quota assignments, and field notifications.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="notif-hub-actions-row">
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowDispatchModal(true)}
              className="notif-hub-btn notif-hub-btn-primary"
            >
              <Send size={14} />
              <span>Broadcast Notification</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
            className="notif-hub-btn notif-hub-btn-secondary"
          >
            <CheckCheck size={15} />
            <span>Mark All as Read</span>
          </button>

          <button
            type="button"
            onClick={handleClearRead}
            disabled={notifications.length === unreadCount}
            className="notif-hub-btn notif-hub-btn-secondary"
            title="Clear all already-read notifications"
          >
            <Trash2 size={15} />
            <span>Clear Read</span>
          </button>

          <button
            type="button"
            onClick={handleClearAll}
            disabled={notifications.length === 0}
            className="notif-hub-btn notif-hub-btn-danger"
            title="Clear all notifications"
          >
            <Trash2 size={15} />
            <span>Clear All</span>
          </button>
        </div>
      </div>

      {/* ── Metric Highlights ── */}
      <div className="notif-hub-metrics-grid">
        <div className="notif-hub-metric-card">
          <div className="notif-hub-metric-label">
            TOTAL ALERTS
          </div>
          <div className="notif-hub-metric-val">
            {notifications.length}
          </div>
        </div>

        <div className={`notif-hub-metric-card ${unreadCount > 0 ? "metric-unread" : ""}`}>
          <div className="notif-hub-metric-label">
            UNREAD NOTIFICATIONS
          </div>
          <div className="notif-hub-metric-val val-unread">
            {unreadCount}
          </div>
        </div>

        <div className="notif-hub-metric-card">
          <div className="notif-hub-metric-label">
            TARGETS &amp; QUOTAS
          </div>
          <div className="notif-hub-metric-val val-target">
            {targetCount}
          </div>
        </div>

        <div className="notif-hub-metric-card">
          <div className="notif-hub-metric-label">
            BROADCASTS &amp; DIRECTIVES
          </div>
          <div className="notif-hub-metric-val val-broadcast">
            {broadcastCount}
          </div>
        </div>
      </div>

      {/* ── Search & Filter Bar ── */}
      <div className="notif-hub-filter-bar">
        <div className="notif-hub-search-box">
          <Search size={16} className="notif-search-icon" />
          <input
            type="text"
            className="notif-hub-search-input"
            placeholder="Search notifications by title, content, or sender..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="notif-search-clear-btn"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="notif-hub-pills-row">
          {[
            { id: "all", label: "All" },
            { id: "unread", label: `Unread (${unreadCount})` },
            { id: "target", label: "Targets" },
            { id: "broadcast", label: "Broadcasts" },
            { id: "attendance", label: "Attendance" },
            { id: "system", label: "System" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id as any)}
              className={`notif-hub-pill ${filterType === tab.id ? "active" : ""}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Notification List ── */}
      <div className="notif-hub-list">
        {filteredNotifications.length === 0 ? (
          <div className="notif-hub-empty-state">
            <div className="notif-hub-empty-icon">
              <Sparkles size={26} />
            </div>
            <h3 className="notif-hub-empty-title">
              {filterType === "unread" ? "All Caught Up!" : "No Notifications Found"}
            </h3>
            <p className="notif-hub-empty-desc">
              {filterType === "unread"
                ? "You have marked all notifications as read."
                : searchQuery
                ? `No notifications matched "${searchQuery}".`
                : "You have cleared all active notifications."}
            </p>
          </div>
        ) : (
          filteredNotifications.map((item) => {
            const isUnread = !item.isRead;
            return (
              <div
                key={item.id}
                className={`notif-hub-card ${isUnread ? "unread" : "read"}`}
              >
                <div className="notif-hub-card-left">
                  {/* Category Icon */}
                  <div className={`notif-hub-card-icon type-${item.type}`}>
                    {item.type === "target" ? (
                      <Target size={20} />
                    ) : item.type === "broadcast" ? (
                      <Radio size={20} />
                    ) : item.type === "attendance" ? (
                      <ClipboardCheck size={20} />
                    ) : (
                      <Bell size={20} />
                    )}
                  </div>

                  <div className="notif-hub-card-body">
                    <div className="notif-hub-card-meta-row">
                      <span className={`notif-hub-type-badge ${isUnread ? "unread" : ""}`}>
                        {item.category || item.type}
                      </span>

                      {item.priority === "urgent" && (
                        <span className="notif-hub-urgent-pill">
                          ⚡ URGENT
                        </span>
                      )}

                      <span className="notif-hub-time">
                        {formatDateTime(item.createdAt)}
                      </span>

                      {isUnread && (
                        <span className="notif-hub-new-pill">
                          New
                        </span>
                      )}
                    </div>

                    <h4 className="notif-hub-card-title">
                      {item.title}
                    </h4>

                    <p className="notif-hub-card-msg">
                      {item.message}
                    </p>

                    <div className="notif-hub-card-footer">
                      {item.sender && (
                        <span className="notif-hub-sender">
                          From: {item.sender}
                        </span>
                      )}

                      {item.link && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!item.isRead) markNotificationAsRead(item.id);
                            navigate(item.link!);
                          }}
                          className="notif-hub-link-action"
                        >
                          <span>{item.actionLabel || "View Action"}</span>
                          <ArrowRight size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Per-item Actions */}
                <div className="notif-hub-card-actions">
                  <button
                    type="button"
                    onClick={() => handleToggleRead(item)}
                    className={`notif-hub-toggle-btn ${item.isRead ? "read" : "unread"}`}
                    title={item.isRead ? "Mark as unread" : "Mark as read"}
                  >
                    <Check size={13} />
                    <span>{item.isRead ? "Mark Unread" : "Mark as Read"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => clearNotification(item.id)}
                    className="notif-hub-dismiss-btn"
                    title="Clear notification"
                    aria-label="Clear notification"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Admin Test Dispatch Modal ── */}
      {showDispatchModal && (
        <div className="notif-modal-backdrop">
          <div className="notif-modal-card">
            <div className="notif-modal-header">
              <h3 className="notif-modal-title">
                Send Broadcast / Test Notification
              </h3>
              <button
                type="button"
                onClick={() => setShowDispatchModal(false)}
                className="notif-modal-close-btn"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSendTestNotification}>
              <div className="notif-modal-field">
                <label>
                  Notification Type
                </label>
                <select
                  value={testType}
                  onChange={(e) => setTestType(e.target.value as NotificationType)}
                  className="notif-modal-input"
                >
                  <option value="broadcast">📢 Management Broadcast</option>
                  <option value="target">🎯 Target & Quota Alert</option>
                  <option value="attendance">📍 GPS Field & Attendance</option>
                  <option value="system">⚙️ System Alert</option>
                </select>
              </div>

              <div className="notif-modal-field">
                <label>
                  Priority Level
                </label>
                <select
                  value={testPriority}
                  onChange={(e) => setTestPriority(e.target.value as any)}
                  className="notif-modal-input"
                >
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">⚡ Urgent Priority</option>
                </select>
              </div>

              <div className="notif-modal-field">
                <label>
                  Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Q4 Malta Gold Sales Incentive Active"
                  value={testTitle}
                  onChange={(e) => setTestTitle(e.target.value)}
                  required
                  className="notif-modal-input"
                />
              </div>

              <div className="notif-modal-field">
                <label>
                  Message Content
                </label>
                <textarea
                  rows={3}
                  placeholder="Type the message dispatched to team members..."
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  required
                  className="notif-modal-input"
                />
              </div>

              <div className="notif-modal-actions">
                <button
                  type="button"
                  onClick={() => setShowDispatchModal(false)}
                  className="notif-modal-btn cancel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="notif-modal-btn submit"
                >
                  Dispatch Live
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
