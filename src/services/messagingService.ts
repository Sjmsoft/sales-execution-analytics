import { loadUserAccounts } from "./userManagementService";

export interface ChatUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  roleKey: string;
  roleName: string;
  region: string;
  avatar?: string | null;
  initials: string;
  status: "online" | "away" | "offline";
  lastSeen?: string;
  isTyping?: boolean;
}

export interface MessageAttachment {
  id: string;
  name: string;
  type: "image" | "document" | "location" | "audio";
  url: string;
  size?: string;
  data?: Record<string, any>;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  senderAvatar?: string | null;
  content: string;
  type: "text" | "announcement" | "target_update" | "image" | "file" | "voice_note" | "location_pin" | "call_log";
  priority: "normal" | "urgent" | "broadcast";
  status: "sent" | "delivered" | "read";
  timestamp: string;
  reactions: Record<string, string[]>; // emoji -> [userId1, userId2]
  replyTo?: {
    id: string;
    senderName: string;
    content: string;
  };
  attachments?: MessageAttachment[];
  isPushNotification?: boolean;
  targetScope?: {
    roleKeys?: string[];
    regions?: string[];
  };
  callDetails?: {
    callType: "audio" | "video";
    status: "ended" | "missed" | "declined";
    durationSecs: number;
  };
}

export interface Conversation {
  id: string;
  type: "direct" | "channel" | "announcement";
  title: string;
  description?: string;
  participantIds: string[];
  unreadCount: number;
  lastMessage?: ChatMessage;
  isPinned?: boolean;
  isBroadcast?: boolean;
  channelCategory?: "announcements" | "regions" | "field_operations" | "direct";
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CallSession {
  id: string;
  conversationId?: string;
  callerId: string;
  callerName: string;
  callerRole: string;
  callerAvatar?: string | null;
  receiverId: string;
  receiverName: string;
  receiverRole: string;
  receiverAvatar?: string | null;
  callType: "audio" | "video";
  status: "ringing" | "connected" | "ended" | "missed" | "declined";
  startedAt: string;
  connectedAt?: string;
  endedAt?: string;
  durationSecs: number;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isSpeakerOn: boolean;
}

export const SMART_REPLIES: Record<string, string[]> = {
  announcement: [
    "Understood and acknowledged! 👍",
    "Cascading to the field team now 📋",
    "Checked and active in my territory ✅",
    "Target noted, starting execution 🎯",
  ],
  target_update: [
    "Target directive received, in field! 🚀",
    "Closing my first retail batch now 📦",
    "Outlet visit completed, logged sales ✅",
    "Will beat our daily target! 🏆",
  ],
  default: [
    "Heading to the outlet now 📍",
    "Daily shift started & GPS locked ✅",
    "Stock received and verified 📦",
    "Please call me on voice 📞",
    "All targets completed for today! 🎯",
    "Checking with the store manager 🏪",
  ],
};

export interface MessagingModuleSettings {
  enabled: boolean;
  allowVoiceCalls: boolean;
  allowVideoCalls: boolean;
  allowLocationSharing: boolean;
  allowVoiceNotes: boolean;
  maxVoiceNoteSecs: number;
  allowSmartReplies: boolean;
  smartRepliesList: string[];
  callTimeoutSecs: number;
  callAudioQuality: "low_bandwidth" | "standard" | "high_definition";
  broadcastRolesAllowed: string[];
  soundAlertsEnabled: boolean;
  autoDismissToastSecs: number;
  retentionDays: number;
  recordCallLogsInChat: boolean;
}

export const DEFAULT_MESSAGING_SETTINGS: MessagingModuleSettings = {
  enabled: true,
  allowVoiceCalls: true,
  allowVideoCalls: true,
  allowLocationSharing: true,
  allowVoiceNotes: true,
  maxVoiceNoteSecs: 60,
  allowSmartReplies: true,
  smartRepliesList: [
    "Understood and acknowledged! 👍",
    "Heading to outlet now 📍",
    "Target completed 🎯",
    "Stock received & verified 📦",
    "Need managerial approval ✍️",
    "Will call you back shortly 📞",
    "Shelf audit submitted ✅",
  ],
  callTimeoutSecs: 30,
  callAudioQuality: "standard",
  broadcastRolesAllowed: [
    "administrator",
    "admin",
    "hr",
    "national_sales_manager",
    "nsm",
    "regional_sales_manager",
    "rsm",
    "sales_executive",
    "se",
  ],
  soundAlertsEnabled: true,
  autoDismissToastSecs: 7,
  retentionDays: 90,
  recordCallLogsInChat: true,
};

const STORAGE_KEY_SETTINGS = "penedge_messaging_settings_v1";
const STORAGE_KEY_CONVERSATIONS = "penedge_chat_conversations_v2";
const STORAGE_KEY_MESSAGES = "penedge_chat_messages_v2";
const STORAGE_KEY_ACTIVE_CALL = "penedge_chat_active_call_v2";

export function getMessagingSettings(): MessagingModuleSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_MESSAGING_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.warn("Failed to load messaging settings:", e);
  }
  return { ...DEFAULT_MESSAGING_SETTINGS };
}

export function saveMessagingSettings(updates: Partial<MessagingModuleSettings>): MessagingModuleSettings {
  const current = getMessagingSettings();
  const merged: MessagingModuleSettings = { ...current, ...updates };
  try {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(merged));
  } catch (e) {
    console.error("Failed to save messaging settings:", e);
  }
  messagingEvents.emit("settings_updated", merged);
  return merged;
}

export function resetMessagingSettingsToDefault(): MessagingModuleSettings {
  try {
    localStorage.removeItem(STORAGE_KEY_SETTINGS);
  } catch {}
  messagingEvents.emit("settings_updated", { ...DEFAULT_MESSAGING_SETTINGS });
  return { ...DEFAULT_MESSAGING_SETTINGS };
}

type EventCallback<T = any> = (data: T) => void;

class MessagingEventEmitter {
  private listeners: Record<string, EventCallback[]> = {};

  on(event: string, callback: EventCallback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => this.off(event, callback);
  }

  off(event: string, callback: EventCallback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
  }

  emit(event: string, data?: any) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach((cb) => {
      try {
        cb(data);
      } catch (err) {
        console.error("MessagingEventEmitter error:", err);
      }
    });
  }
}

export const messagingEvents = new MessagingEventEmitter();

// Web Audio sound generator for rings and message alerts
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      void audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

export function playMessageNotificationSound(isUrgent = false) {
  const settings = getMessagingSettings();
  if (!settings.soundAlertsEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = isUrgent ? "triangle" : "sine";
    osc.frequency.setValueAtTime(isUrgent ? 880 : 587.33, now); // A5 or D5
    osc.frequency.exponentialRampToValueAtTime(isUrgent ? 1174.66 : 880, now + 0.12);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.3);
  } catch { }
}

let ringInterval: number | null = null;

export function startRingingSound() {
  stopRingingSound();
  const settings = getMessagingSettings();
  if (!settings.soundAlertsEnabled) return;
  const playChime = () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.frequency.setValueAtTime(440, now);
      osc2.frequency.setValueAtTime(480, now);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.2);
      osc2.stop(now + 1.2);
    } catch { }
  };

  playChime();
  ringInterval = window.setInterval(playChime, 2400);
}

export function stopRingingSound() {
  if (ringInterval !== null) {
    clearInterval(ringInterval);
    ringInterval = null;
  }
}

export function previewTestRingtone() {
  startRingingSound();
  setTimeout(() => {
    stopRingingSound();
  }, 2200);
}

// ── Initial Seed Data Generator ──────────────────────────────────────────────

function generateInitials(name: string): string {
  if (!name) return "PE";
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

export async function getDirectoryUsers(_currentUserId?: string): Promise<ChatUser[]> {
  try {
    const accounts = await loadUserAccounts();
    return accounts.map((u, idx) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      roleKey: u.role_key,
      roleName: formatRoleName(u.role_key),
      region: u.region || "National",
      avatar: u.avatar_url || null,
      initials: generateInitials(u.name),
      status: idx % 3 === 0 ? "online" : idx % 3 === 1 ? "away" : "offline",
      lastSeen: new Date(Date.now() - (idx * 14 + 5) * 60000).toISOString(),
    }));
  } catch (err) {
    console.warn("Failed to load accounts for directory:", err);
    return getFallbackDirectoryUsers();
  }
}

export function formatRoleName(roleKey: string): string {
  switch (roleKey) {
    case "administrator":
      return "Administrator";
    case "hr":
      return "Human Resources";
    case "national_sales_manager":
      return "National Sales Manager";
    case "regional_sales_manager":
      return "Regional Sales Manager";
    case "sales_executive":
      return "Sales Executive";
    case "brand_ambassador":
      return "Brand Ambassador";
    case "vsr":
      return "Van Sales Rep";
    default:
      return roleKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function getFallbackDirectoryUsers(): ChatUser[] {
  return [];
}

function seedDefaultConversations(_currentUserId: string, allUsers: ChatUser[]): {
  conversations: Conversation[];
  messages: ChatMessage[];
} {
  const now = Date.now();
  const iso = (minsAgo: number) => new Date(now - minsAgo * 60000).toISOString();

  // Company Announcements (Broadcast channel)
  const convAnnouncements: Conversation = {
    id: "conv-announcements-all-hands",
    type: "announcement",
    title: "📢 Pen Edge All-Hands & Field Bulletins",
    description: "Official executive announcements, target directives & policy alerts.",
    participantIds: allUsers.map((u) => u.id),
    unreadCount: 0,
    isPinned: true,
    isBroadcast: true,
    channelCategory: "announcements",
    createdAt: iso(0),
    updatedAt: iso(0),
  };

  return {
    conversations: [convAnnouncements],
    messages: [],
  };
}

// ── Service Core Methods ─────────────────────────────────────────────────────

export function getStoredConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONVERSATIONS);
    if (raw) {
      const convs: Conversation[] = JSON.parse(raw);
      // Clean up legacy mock conversations and mock lastMessage
      const cleaned = convs
        .filter((c) => !c.id.includes("a0000000-0000-4000-8000-"))
        .map((c) => {
          if (
            c.lastMessage &&
            (c.lastMessage.id?.startsWith("msg-ann-") ||
              c.lastMessage.id?.startsWith("msg-lagos-") ||
              c.lastMessage.id?.startsWith("msg-dm-"))
          ) {
            return { ...c, lastMessage: undefined, unreadCount: 0 };
          }
          return c;
        });
      if (cleaned.length !== convs.length) {
        localStorage.setItem(STORAGE_KEY_CONVERSATIONS, JSON.stringify(cleaned));
      }
      return cleaned;
    }
  } catch { }
  return [];
}

export function saveStoredConversations(convs: Conversation[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_CONVERSATIONS, JSON.stringify(convs));
    messagingEvents.emit("conversations_updated", convs);
  } catch { }
}

export function getStoredMessages(conversationId?: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MESSAGES);
    if (raw) {
      const all: ChatMessage[] = JSON.parse(raw);
      // Clean up legacy demo messages
      const clean = all.filter(
        (m) =>
          m &&
          !m.id?.startsWith("msg-ann-") &&
          !m.id?.startsWith("msg-lagos-") &&
          !m.id?.startsWith("msg-dm-")
      );
      if (clean.length !== all.length) {
        localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(clean));
      }
      if (conversationId) {
        return clean.filter((m) => m.conversationId === conversationId);
      }
      return clean;
    }
  } catch { }
  return [];
}

export function saveStoredMessages(messages: ChatMessage[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
    messagingEvents.emit("messages_updated", messages);
  } catch { }
}

export async function initializeMessaging(currentUserId: string): Promise<{
  users: ChatUser[];
  conversations: Conversation[];
}> {
  const users = await getDirectoryUsers(currentUserId);
  let convs = getStoredConversations();
  let msgs = getStoredMessages();

  if (convs.length === 0) {
    const seeded = seedDefaultConversations(currentUserId, users);
    convs = seeded.conversations;
    msgs = seeded.messages;
    saveStoredConversations(convs);
    saveStoredMessages(msgs);
  }

  return { users, conversations: convs };
}

export function getUnreadMessagesCount(_currentUserId?: string): number {
  const convs = getStoredConversations();
  return convs.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
}

export interface SendMessagePayload {
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  senderAvatar?: string | null;
  content: string;
  type?: ChatMessage["type"];
  priority?: ChatMessage["priority"];
  replyTo?: ChatMessage["replyTo"];
  attachments?: MessageAttachment[];
  isPushNotification?: boolean;
  targetScope?: ChatMessage["targetScope"];
}

export async function sendMessage(payload: SendMessagePayload): Promise<ChatMessage> {
  const allMessages = getStoredMessages();
  const allConvs = getStoredConversations();

  const newMsg: ChatMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    conversationId: payload.conversationId,
    senderId: payload.senderId,
    senderName: payload.senderName,
    senderRole: payload.senderRole,
    senderAvatar: payload.senderAvatar,
    content: payload.content.trim(),
    type: payload.type || "text",
    priority: payload.priority || "normal",
    status: "sent",
    timestamp: new Date().toISOString(),
    reactions: {},
    replyTo: payload.replyTo,
    attachments: payload.attachments,
    isPushNotification: payload.isPushNotification ?? (payload.priority === "urgent" || payload.priority === "broadcast"),
    targetScope: payload.targetScope,
  };

  const updatedMessages = [...allMessages, newMsg];
  saveStoredMessages(updatedMessages);

  // Update conversation lastMessage & move to top
  const convIndex = allConvs.findIndex((c) => c.id === payload.conversationId);
  if (convIndex !== -1) {
    const targetConv = { ...allConvs[convIndex] };
    targetConv.lastMessage = newMsg;
    targetConv.updatedAt = newMsg.timestamp;
    allConvs.splice(convIndex, 1);
    allConvs.unshift(targetConv);
  } else {
    // New conversation
    allConvs.unshift({
      id: payload.conversationId,
      type: "direct",
      title: "Conversation",
      participantIds: [payload.senderId],
      unreadCount: 0,
      lastMessage: newMsg,
      createdAt: newMsg.timestamp,
      updatedAt: newMsg.timestamp,
    });
  }

  saveStoredConversations(allConvs);

  // Play notification sound & trigger real-time event
  playMessageNotificationSound(newMsg.priority === "urgent");
  messagingEvents.emit("new_message", newMsg);

  if (newMsg.isPushNotification) {
    messagingEvents.emit("push_notification", newMsg);
  }

  // Simulate remote peer delivery check mark after 400ms
  setTimeout(() => {
    const list = getStoredMessages();
    const idx = list.findIndex((m) => m.id === newMsg.id);
    if (idx !== -1) {
      list[idx].status = "delivered";
      saveStoredMessages(list);
    }
  }, 400);

  return newMsg;
}

export function markConversationAsRead(conversationId: string): void {
  const allConvs = getStoredConversations();
  const conv = allConvs.find((c) => c.id === conversationId);
  if (conv && conv.unreadCount > 0) {
    conv.unreadCount = 0;
    saveStoredConversations([...allConvs]);
  }

  const msgs = getStoredMessages();
  let modified = false;
  msgs.forEach((m) => {
    if (m.conversationId === conversationId && m.status !== "read") {
      m.status = "read";
      modified = true;
    }
  });
  if (modified) {
    saveStoredMessages(msgs);
  }
}

export function toggleMessageReaction(messageId: string, emoji: string, userId: string): void {
  const msgs = getStoredMessages();
  const target = msgs.find((m) => m.id === messageId);
  if (!target) return;

  if (!target.reactions) target.reactions = {};
  const currentUsers = target.reactions[emoji] || [];

  if (currentUsers.includes(userId)) {
    target.reactions[emoji] = currentUsers.filter((id) => id !== userId);
    if (target.reactions[emoji].length === 0) {
      delete target.reactions[emoji];
    }
  } else {
    target.reactions[emoji] = [...currentUsers, userId];
  }

  saveStoredMessages(msgs);
}

export async function createDirectConversation(
  currentUserId: string,
  targetUser: ChatUser,
): Promise<Conversation> {
  const allConvs = getStoredConversations();
  const existing = allConvs.find(
    (c) =>
      c.type === "direct" &&
      c.participantIds.includes(currentUserId) &&
      c.participantIds.includes(targetUser.id),
  );

  if (existing) {
    return existing;
  }

  const newConv: Conversation = {
    id: `conv-dm-${[currentUserId, targetUser.id].sort().join("-")}`,
    type: "direct",
    title: targetUser.name,
    description: `${targetUser.roleName} · ${targetUser.region}`,
    participantIds: [currentUserId, targetUser.id],
    unreadCount: 0,
    channelCategory: "direct",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  allConvs.unshift(newConv);
  saveStoredConversations(allConvs);
  return newConv;
}

export async function createGroupChannel(
  title: string,
  description: string,
  participantIds: string[],
  category: "announcements" | "regions" | "field_operations" = "field_operations",
): Promise<Conversation> {
  const allConvs = getStoredConversations();
  const newConv: Conversation = {
    id: `conv-group-${Date.now()}`,
    type: category === "announcements" ? "announcement" : "channel",
    title,
    description,
    participantIds,
    unreadCount: 0,
    channelCategory: category,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  allConvs.unshift(newConv);
  saveStoredConversations(allConvs);
  return newConv;
}

// ── Call Management (WhatsApp / Teams Calling System) ────────────────────────

export function getActiveCall(): CallSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACTIVE_CALL);
    if (raw) return JSON.parse(raw);
  } catch { }
  return null;
}

export function saveActiveCall(call: CallSession | null): void {
  try {
    if (!call) {
      localStorage.removeItem(STORAGE_KEY_ACTIVE_CALL);
      stopRingingSound();
    } else {
      localStorage.setItem(STORAGE_KEY_ACTIVE_CALL, JSON.stringify(call));
    }
    messagingEvents.emit("call_state_changed", call);
  } catch { }
}

export function initiateCall(
  caller: { id: string; name: string; role: string; avatar?: string | null },
  receiver: { id: string; name: string; role: string; avatar?: string | null },
  callType: "audio" | "video",
  conversationId?: string,
): CallSession {
  const settings = getMessagingSettings();
  if (!settings.enabled) {
    throw new Error("Field calling system is currently disabled by administrator.");
  }
  if (callType === "audio" && !settings.allowVoiceCalls) {
    throw new Error("Voice calling is currently disabled by administrator.");
  }
  if (callType === "video" && !settings.allowVideoCalls) {
    throw new Error("Video calling is currently disabled by administrator.");
  }

  const session: CallSession = {
    id: `call-${Date.now()}`,
    conversationId,
    callerId: caller.id,
    callerName: caller.name,
    callerRole: caller.role,
    callerAvatar: caller.avatar,
    receiverId: receiver.id,
    receiverName: receiver.name,
    receiverRole: receiver.role,
    receiverAvatar: receiver.avatar,
    callType,
    status: "ringing",
    startedAt: new Date().toISOString(),
    durationSecs: 0,
    isMuted: false,
    isVideoEnabled: callType === "video",
    isSpeakerOn: true,
  };

  saveActiveCall(session);
  startRingingSound();
  messagingEvents.emit("incoming_call", session);
  return session;
}

export function answerCall(callId: string): CallSession | null {
  const current = getActiveCall();
  if (!current || current.id !== callId) return null;

  stopRingingSound();
  const updated: CallSession = {
    ...current,
    status: "connected",
    connectedAt: new Date().toISOString(),
  };

  saveActiveCall(updated);
  return updated;
}

export function endCall(callId: string, reason: "ended" | "missed" | "declined" = "ended"): void {
  const current = getActiveCall();
  stopRingingSound();

  if (current && current.id === callId) {
    const now = new Date().toISOString();
    const duration = current.connectedAt
      ? Math.max(1, Math.round((new Date(now).getTime() - new Date(current.connectedAt).getTime()) / 1000))
      : 0;

    // Log call entry to chat conversation if exists
    if (current.conversationId) {
      void sendMessage({
        conversationId: current.conversationId,
        senderId: current.callerId,
        senderName: current.callerName,
        senderRole: current.callerRole,
        content: `${current.callType === "video" ? "📹 Video Call" : "📞 Voice Call"} — ${
          reason === "ended"
            ? `Duration: ${Math.floor(duration / 60)}m ${duration % 60}s`
            : reason === "missed"
            ? "Missed Call"
            : "Call Declined"
        }`,
        type: "call_log",
        priority: "normal",
      });
    }

    saveActiveCall(null);
  }
}

export function toggleCallMute(callId: string): void {
  const current = getActiveCall();
  if (current && current.id === callId) {
    saveActiveCall({ ...current, isMuted: !current.isMuted });
  }
}

export function toggleCallVideo(callId: string): void {
  const current = getActiveCall();
  if (current && current.id === callId) {
    saveActiveCall({ ...current, isVideoEnabled: !current.isVideoEnabled });
  }
}
