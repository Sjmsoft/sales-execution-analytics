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
    <div style={{ padding: "24px 28px", maxWidth: 1200, margin: "0 auto" }}>
      {/* ── Page Header ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "#ecfdf5",
                color: "#059669",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Bell size={20} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a" }}>
                Notifications Hub
              </h1>
              <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
                Review live push directives, sales quota assignments, and field notifications.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowDispatchModal(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                background: "#059669",
                color: "#ffffff",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 1px 3px rgba(5, 150, 105, 0.3)",
              }}
            >
              <Send size={14} />
              <span>Broadcast Notification</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              background: "#ffffff",
              color: unreadCount > 0 ? "#059669" : "#94a3b8",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: unreadCount > 0 ? "pointer" : "not-allowed",
            }}
          >
            <CheckCheck size={15} />
            <span>Mark All as Read</span>
          </button>

          <button
            type="button"
            onClick={handleClearRead}
            disabled={notifications.length === unreadCount}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              background: "#ffffff",
              color: "#475569",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
            title="Clear all already-read notifications"
          >
            <Trash2 size={15} />
            <span>Clear Read</span>
          </button>

          <button
            type="button"
            onClick={handleClearAll}
            disabled={notifications.length === 0}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              background: "#fee2e2",
              color: "#dc2626",
              border: "1px solid #fecaca",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: notifications.length > 0 ? "pointer" : "not-allowed",
            }}
            title="Clear all notifications"
          >
            <Trash2 size={15} />
            <span>Clear All</span>
          </button>
        </div>
      </div>

      {/* ── Metric Highlights ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: "16px 20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 6 }}>
            TOTAL ALERTS
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#0f172a" }}>
            {notifications.length}
          </div>
        </div>

        <div
          style={{
            background: unreadCount > 0 ? "#ecfdf5" : "#ffffff",
            border: `1px solid ${unreadCount > 0 ? "#a7f3d0" : "#e2e8f0"}`,
            borderRadius: 12,
            padding: "16px 20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: unreadCount > 0 ? "#047857" : "#64748b", marginBottom: 6 }}>
            UNREAD NOTIFICATIONS
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: unreadCount > 0 ? "#059669" : "#0f172a" }}>
            {unreadCount}
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: "16px 20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 6 }}>
            TARGETS & QUOTAS
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#059669" }}>
            {targetCount}
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: "16px 20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 6 }}>
            BROADCASTS & DIRECTIVES
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#e11d48" }}>
            {broadcastCount}
          </div>
        </div>
      </div>

      {/* ── Search & Filter Bar ── */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: "12px 18px",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 260 }}>
          <Search size={16} color="#94a3b8" />
          <input
            type="text"
            placeholder="Search notifications by title, content, or sender..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              border: "none",
              outline: "none",
              width: "100%",
              fontSize: 13,
              color: "#1e293b",
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "#94a3b8",
                padding: 2,
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
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
              style={{
                padding: "6px 12px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: filterType === tab.id ? 700 : 500,
                background: filterType === tab.id ? "#059669" : "#f1f5f9",
                color: filterType === tab.id ? "#ffffff" : "#475569",
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Notification List ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filteredNotifications.length === 0 ? (
          <div
            style={{
              background: "#ffffff",
              border: "1px dashed #cbd5e1",
              borderRadius: 16,
              padding: "60px 24px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: "#f1f5f9",
                color: "#94a3b8",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 12,
              }}
            >
              <Sparkles size={26} />
            </div>
            <h3 style={{ margin: "0 0 6px 0", fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
              {filterType === "unread" ? "All Caught Up!" : "No Notifications Found"}
            </h3>
            <p style={{ margin: "0 0 16px 0", fontSize: 13, color: "#64748b" }}>
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
                style={{
                  background: isUnread ? "#fafffd" : "#ffffff",
                  border: `1px solid ${isUnread ? "#a7f3d0" : "#e2e8f0"}`,
                  borderRadius: 12,
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 16,
                  transition: "all 0.15s ease",
                  boxShadow: isUnread ? "0 2px 6px rgba(16, 185, 129, 0.06)" : "0 1px 2px rgba(0,0,0,0.02)",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flex: 1 }}>
                  {/* Category Icon */}
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      background:
                        item.type === "target"
                          ? "#ecfdf5"
                          : item.type === "broadcast"
                          ? "#fff1f2"
                          : item.type === "attendance"
                          ? "#f0fdf4"
                          : "#f8fafc",
                      color:
                        item.type === "target"
                          ? "#059669"
                          : item.type === "broadcast"
                          ? "#e11d48"
                          : item.type === "attendance"
                          ? "#16a34a"
                          : "#64748b",
                    }}
                  >
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

                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          padding: "1px 7px",
                          borderRadius: 4,
                          background: isUnread ? "#ecfdf5" : "#f1f5f9",
                          color: isUnread ? "#059669" : "#64748b",
                        }}
                      >
                        {item.category || item.type}
                      </span>

                      {item.priority === "urgent" && (
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 800,
                            padding: "1px 6px",
                            borderRadius: 4,
                            background: "#fee2e2",
                            color: "#dc2626",
                          }}
                        >
                          ⚡ URGENT
                        </span>
                      )}

                      <span style={{ fontSize: 11.5, color: "#94a3b8" }}>
                        {formatDateTime(item.createdAt)}
                      </span>

                      {isUnread && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#059669",
                            background: "#d1fae5",
                            padding: "1px 6px",
                            borderRadius: 999,
                          }}
                        >
                          New
                        </span>
                      )}
                    </div>

                    <h4
                      style={{
                        margin: "0 0 6px 0",
                        fontSize: 15,
                        fontWeight: isUnread ? 800 : 700,
                        color: isUnread ? "#064e3b" : "#0f172a",
                      }}
                    >
                      {item.title}
                    </h4>

                    <p style={{ margin: "0 0 10px 0", fontSize: 13, color: "#475569", lineHeight: 1.5 }}>
                      {item.message}
                    </p>

                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      {item.sender && (
                        <span style={{ fontSize: 11.5, color: "#64748b", fontWeight: 600 }}>
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
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            background: "transparent",
                            border: "none",
                            padding: 0,
                            fontSize: 12.5,
                            fontWeight: 700,
                            color: "#059669",
                            cursor: "pointer",
                          }}
                        >
                          <span>{item.actionLabel || "View Action"}</span>
                          <ArrowRight size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Per-item Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => handleToggleRead(item)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "6px 10px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      background: item.isRead ? "#f1f5f9" : "#ecfdf5",
                      color: item.isRead ? "#64748b" : "#059669",
                      border: `1px solid ${item.isRead ? "#e2e8f0" : "#a7f3d0"}`,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    title={item.isRead ? "Mark as unread" : "Mark as read"}
                  >
                    <Check size={13} />
                    <span>{item.isRead ? "Mark Unread" : "Mark as Read"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => clearNotification(item.id)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      background: "#f8fafc",
                      color: "#64748b",
                      border: "1px solid #e2e8f0",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
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
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 16,
              width: "100%",
              maxWidth: 520,
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 18,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0f172a" }}>
                Send Broadcast / Test Notification
              </h3>
              <button
                type="button"
                onClick={() => setShowDispatchModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748b",
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSendTestNotification}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                  Notification Type
                </label>
                <select
                  value={testType}
                  onChange={(e) => setTestType(e.target.value as NotificationType)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                  }}
                >
                  <option value="broadcast">📢 Management Broadcast</option>
                  <option value="target">🎯 Target & Quota Alert</option>
                  <option value="attendance">📍 GPS Field & Attendance</option>
                  <option value="system">⚙️ System Alert</option>
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                  Priority Level
                </label>
                <select
                  value={testPriority}
                  onChange={(e) => setTestPriority(e.target.value as any)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                  }}
                >
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">⚡ Urgent Priority</option>
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                  Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Q4 Malta Gold Sales Incentive Active"
                  value={testTitle}
                  onChange={(e) => setTestTitle(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                  Message Content
                </label>
                <textarea
                  rows={3}
                  placeholder="Type the message dispatched to team members..."
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    boxSizing: "border-box",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowDispatchModal(false)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: "8px 18px",
                    borderRadius: 8,
                    border: "none",
                    background: "#059669",
                    color: "#ffffff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
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
