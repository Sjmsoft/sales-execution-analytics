import { messagingEvents, type ChatMessage } from "./messagingService";

export type NotificationType =
  | "target"
  | "broadcast"
  | "sale"
  | "visit"
  | "attendance"
  | "system";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  createdAt: string; // ISO string
  isRead: boolean;
  link?: string;
  actionLabel?: string;
  category?: string;
  sender?: string;
};

const STORAGE_KEY = "pen_edge_notifications_v1";

type NotificationListener = (notifications: NotificationItem[]) => void;
const listeners: Set<NotificationListener> = new Set();

function notifyListeners(notifications: NotificationItem[]) {
  listeners.forEach((listener) => {
    try {
      listener(notifications);
    } catch (e) {
      console.error("Error in notification listener:", e);
    }
  });
}

export function getNotifications(): NotificationItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    // Filter out any legacy demo notifications
    const clean = parsed.filter(
      (item: NotificationItem) => item && typeof item.id === "string" && !item.id.startsWith("notif-seed-")
    );
    if (clean.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    }
    return clean;
  } catch (e) {
    console.error("Failed to parse notifications from localStorage:", e);
    return [];
  }
}

export function saveNotifications(items: NotificationItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    notifyListeners(items);
  } catch (e) {
    console.error("Failed to save notifications to localStorage:", e);
  }
}

export function getUnreadNotificationsCount(): number {
  const items = getNotifications();
  return items.filter((n) => !n.isRead).length;
}

export function markNotificationAsRead(id: string): void {
  const items = getNotifications();
  const next = items.map((item) =>
    item.id === id ? { ...item, isRead: true } : item
  );
  saveNotifications(next);
}

export function markNotificationAsUnread(id: string): void {
  const items = getNotifications();
  const next = items.map((item) =>
    item.id === id ? { ...item, isRead: false } : item
  );
  saveNotifications(next);
}

export function markAllNotificationsAsRead(): void {
  const items = getNotifications();
  const next = items.map((item) => ({ ...item, isRead: true }));
  saveNotifications(next);
}

export function clearNotification(id: string): void {
  const items = getNotifications();
  const next = items.filter((item) => item.id !== id);
  saveNotifications(next);
}

export function clearAllNotifications(): void {
  saveNotifications([]);
}

export function clearReadNotifications(): void {
  const items = getNotifications();
  const next = items.filter((item) => !item.isRead);
  saveNotifications(next);
}

export function addNotification(
  payload: Omit<NotificationItem, "id" | "createdAt" | "isRead"> & {
    id?: string;
    createdAt?: string;
    isRead?: boolean;
  }
): NotificationItem {
  const items = getNotifications();
  const newItem: NotificationItem = {
    id: payload.id || `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    title: payload.title,
    message: payload.message,
    type: payload.type || "system",
    priority: payload.priority || "normal",
    createdAt: payload.createdAt || new Date().toISOString(),
    isRead: payload.isRead ?? false,
    link: payload.link,
    actionLabel: payload.actionLabel,
    category: payload.category,
    sender: payload.sender,
  };

  const next = [newItem, ...items];
  saveNotifications(next);
  return newItem;
}

export function subscribeNotifications(
  listener: NotificationListener
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Automatically bind incoming real-time push notifications into our Notification center
if (typeof window !== "undefined") {
  messagingEvents.on("push_notification", (msg: ChatMessage) => {
    addNotification({
      title: msg.priority === "broadcast" ? "📢 Management Broadcast" : "⚡ Urgent Notice",
      message: `${msg.senderName}: ${msg.content}`,
      type: "broadcast",
      priority: msg.priority === "broadcast" ? "high" : "urgent",
      link: "/messages",
      actionLabel: "Open Messages",
      category: "Broadcast",
      sender: msg.senderName,
    });
  });
}
