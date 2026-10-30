import { supabase } from "../lib/supabase";
import { loadUserAccounts } from "./userManagementService";
import { getRegions } from "./regionService";

export interface ChatUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  roleKey: string;
  roleName: string;
  region: string;
  assignedRegions?: string[];
  reportsToId?: string | null;
  reportsToName?: string | null;
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

export type DirectoryVisibilityMode =
  | "all_regions"
  | "same_region_only"
  | "role_tiered"
  | "reporting_line_only";

export type CallingRoutingPolicy =
  | "open_directory"
  | "matrix_controlled"
  | "hierarchy_and_region"
  | "management_initiated";

export interface RoleCommunicationPermission {
  roleKey: string;
  roleName: string;
  shortName: string;
  canInitiateVoiceCalls: boolean;
  canInitiateVideoCalls: boolean;
  canReceiveCalls: boolean;
  canSendMessages: boolean;
  canReceiveMessages: boolean;
  canSendAttachments: boolean;
  canStartGroupHuddles: boolean;
  canBroadcast: boolean;
  directoryScopeOverride: "inherit" | "all_regions" | "same_region_only" | "reporting_line_only";
}

export interface UserCommunicationOverride {
  userId: string;
  userName: string;
  roleKey: string;
  region: string;
  canCall: "inherit" | "allow" | "deny";
  canReceiveCalls: "inherit" | "allow" | "deny";
  canSendMessages: "inherit" | "allow" | "deny";
  canReceiveMessages: "inherit" | "allow" | "deny";
  directoryScope: "inherit" | "all_regions" | "same_region_only";
  note?: string;
  updatedAt: string;
}

export interface CommRoleMeta {
  key: string;
  name: string;
  shortName: string;
  tier: "national" | "regional" | "field";
  color: string;
  bg: string;
}

export const COMM_ROLE_CATALOG: CommRoleMeta[] = [
  { key: "administrator", name: "System Administrator", shortName: "Admin", tier: "national", color: "#b91c1c", bg: "#fee2e2" },
  { key: "hr", name: "Human Resources (HR)", shortName: "HR", tier: "national", color: "#047857", bg: "#d1fae5" },
  { key: "national_sales_manager", name: "National Sales Manager", shortName: "NSM", tier: "national", color: "#0369a1", bg: "#e0f2fe" },
  { key: "regional_sales_manager", name: "Regional Sales Manager", shortName: "RSM", tier: "regional", color: "#b45309", bg: "#fef3c7" },
  { key: "sales_executive", name: "Sales Executive", shortName: "SE", tier: "regional", color: "#4338ca", bg: "#e0e7ff" },
  { key: "brand_ambassador", name: "Brand Ambassador", shortName: "BA", tier: "field", color: "#059669", bg: "#ecfdf5" },
  { key: "vsr", name: "Van Sales Rep", shortName: "VSR", tier: "field", color: "#c2410c", bg: "#ffedd5" },
];

export const ALL_COMM_ROLE_KEYS = COMM_ROLE_CATALOG.map((r) => r.key);

export const CALL_MATRIX_PRESETS: Record<
  "all_to_all" | "chain_of_command" | "management_top_down" | "peers_and_supervisors",
  { label: string; description: string; matrix: Record<string, string[]> }
> = {
  all_to_all: {
    label: "Open All-to-All Matrix",
    description: "Every role can place calls to every other role across the organization.",
    matrix: {
      administrator: [...ALL_COMM_ROLE_KEYS],
      hr: [...ALL_COMM_ROLE_KEYS],
      national_sales_manager: [...ALL_COMM_ROLE_KEYS],
      regional_sales_manager: [...ALL_COMM_ROLE_KEYS],
      sales_executive: [...ALL_COMM_ROLE_KEYS],
      brand_ambassador: [...ALL_COMM_ROLE_KEYS],
      vsr: [...ALL_COMM_ROLE_KEYS],
    },
  },
  chain_of_command: {
    label: "Standard Chain of Command",
    description: "National & Regional Managers call anyone; Field Reps (BAs/VSRs) call SEs, RSMs, HR, Admin & peers.",
    matrix: {
      administrator: [...ALL_COMM_ROLE_KEYS],
      hr: [...ALL_COMM_ROLE_KEYS],
      national_sales_manager: [...ALL_COMM_ROLE_KEYS],
      regional_sales_manager: [...ALL_COMM_ROLE_KEYS],
      sales_executive: ["administrator", "hr", "regional_sales_manager", "sales_executive", "brand_ambassador", "vsr"],
      brand_ambassador: ["administrator", "hr", "regional_sales_manager", "sales_executive", "brand_ambassador", "vsr"],
      vsr: ["administrator", "hr", "regional_sales_manager", "sales_executive", "brand_ambassador", "vsr"],
    },
  },
  management_top_down: {
    label: "Management & Escalation Only",
    description: "Managers call all field teams; BAs & VSRs can only call their supervisors (SE/RSM) or HR.",
    matrix: {
      administrator: [...ALL_COMM_ROLE_KEYS],
      hr: [...ALL_COMM_ROLE_KEYS],
      national_sales_manager: [...ALL_COMM_ROLE_KEYS],
      regional_sales_manager: ["administrator", "hr", "national_sales_manager", "regional_sales_manager", "sales_executive", "brand_ambassador", "vsr"],
      sales_executive: ["administrator", "hr", "regional_sales_manager", "sales_executive", "brand_ambassador", "vsr"],
      brand_ambassador: ["hr", "regional_sales_manager", "sales_executive"],
      vsr: ["hr", "regional_sales_manager", "sales_executive"],
    },
  },
  peers_and_supervisors: {
    label: "Adjacent Tier & Peers Only",
    description: "Each role can only call their immediate tier above, their own peer role, and their immediate tier below.",
    matrix: {
      administrator: [...ALL_COMM_ROLE_KEYS],
      hr: [...ALL_COMM_ROLE_KEYS],
      national_sales_manager: ["administrator", "hr", "national_sales_manager", "regional_sales_manager"],
      regional_sales_manager: ["administrator", "hr", "national_sales_manager", "regional_sales_manager", "sales_executive"],
      sales_executive: ["hr", "regional_sales_manager", "sales_executive", "brand_ambassador", "vsr"],
      brand_ambassador: ["sales_executive", "brand_ambassador", "vsr"],
      vsr: ["sales_executive", "brand_ambassador", "vsr"],
    },
  },
};

export const DEFAULT_ROLE_COMM_PERMISSIONS: Record<string, RoleCommunicationPermission> = {
  administrator: {
    roleKey: "administrator",
    roleName: "System Administrator",
    shortName: "Admin",
    canInitiateVoiceCalls: true,
    canInitiateVideoCalls: true,
    canReceiveCalls: true,
    canSendMessages: true,
    canReceiveMessages: true,
    canSendAttachments: true,
    canStartGroupHuddles: true,
    canBroadcast: true,
    directoryScopeOverride: "all_regions",
  },
  hr: {
    roleKey: "hr",
    roleName: "Human Resources (HR)",
    shortName: "HR",
    canInitiateVoiceCalls: true,
    canInitiateVideoCalls: true,
    canReceiveCalls: true,
    canSendMessages: true,
    canReceiveMessages: true,
    canSendAttachments: true,
    canStartGroupHuddles: true,
    canBroadcast: true,
    directoryScopeOverride: "all_regions",
  },
  national_sales_manager: {
    roleKey: "national_sales_manager",
    roleName: "National Sales Manager",
    shortName: "NSM",
    canInitiateVoiceCalls: true,
    canInitiateVideoCalls: true,
    canReceiveCalls: true,
    canSendMessages: true,
    canReceiveMessages: true,
    canSendAttachments: true,
    canStartGroupHuddles: true,
    canBroadcast: true,
    directoryScopeOverride: "all_regions",
  },
  regional_sales_manager: {
    roleKey: "regional_sales_manager",
    roleName: "Regional Sales Manager",
    shortName: "RSM",
    canInitiateVoiceCalls: true,
    canInitiateVideoCalls: true,
    canReceiveCalls: true,
    canSendMessages: true,
    canReceiveMessages: true,
    canSendAttachments: true,
    canStartGroupHuddles: true,
    canBroadcast: true,
    directoryScopeOverride: "inherit",
  },
  sales_executive: {
    roleKey: "sales_executive",
    roleName: "Sales Executive",
    shortName: "SE",
    canInitiateVoiceCalls: true,
    canInitiateVideoCalls: true,
    canReceiveCalls: true,
    canSendMessages: true,
    canReceiveMessages: true,
    canSendAttachments: true,
    canStartGroupHuddles: true,
    canBroadcast: true,
    directoryScopeOverride: "inherit",
  },
  brand_ambassador: {
    roleKey: "brand_ambassador",
    roleName: "Brand Ambassador",
    shortName: "BA",
    canInitiateVoiceCalls: true,
    canInitiateVideoCalls: true,
    canReceiveCalls: true,
    canSendMessages: true,
    canReceiveMessages: true,
    canSendAttachments: true,
    canStartGroupHuddles: false,
    canBroadcast: false,
    directoryScopeOverride: "inherit",
  },
  vsr: {
    roleKey: "vsr",
    roleName: "Van Sales Rep",
    shortName: "VSR",
    canInitiateVoiceCalls: true,
    canInitiateVideoCalls: true,
    canReceiveCalls: true,
    canSendMessages: true,
    canReceiveMessages: true,
    canSendAttachments: true,
    canStartGroupHuddles: false,
    canBroadcast: false,
    directoryScopeOverride: "inherit",
  },
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

  // ── Directory & Contact Visibility Scope ("How users see who to call: from only their regions or all regions") ──
  directoryVisibilityMode: DirectoryVisibilityMode;
  alwaysShowNationalLeadership: boolean;
  alwaysShowDirectSupervisor: boolean;
  restrictTerritoryHubsToRegion: boolean;
  showOfflineUsersInDirectory: boolean;

  // ── Call Routing & "Who Can Call Who" Governance ──
  callingRoutingPolicy: CallingRoutingPolicy;
  whoCanCallWhoMatrix: Record<string, string[]>;
  allowCrossRegionCallsForManagement: boolean;
  allowChannelHuddles: boolean;
  maxCallDurationMins: number;

  // ── Role-Based Calling, Messaging & Visibility Permissions ──
  rolePermissions: Record<string, RoleCommunicationPermission>;

  // ── Individual Staff Overrides & Access Controls ──
  userOverrides: Record<string, UserCommunicationOverride>;

  // ── Enterprise Compliance, Attachments & Quiet Hours ──
  allowFileAttachments: boolean;
  allowPhotoAttachments: boolean;
  readReceiptsEnabled: boolean;
  messageDeletionPolicy: "everyone" | "sender_and_admin" | "admin_only";
  announcementPostingPolicy: "broadcast_roles_only" | "management_only" | "everyone";
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  allowUrgentBypassQuietHours: boolean;
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

  // Directory & Region Visibility Defaults
  directoryVisibilityMode: "role_tiered",
  alwaysShowNationalLeadership: true,
  alwaysShowDirectSupervisor: true,
  restrictTerritoryHubsToRegion: false,
  showOfflineUsersInDirectory: true,

  // Calling Routing & Who Can Call Who Defaults
  callingRoutingPolicy: "matrix_controlled",
  whoCanCallWhoMatrix: { ...CALL_MATRIX_PRESETS.all_to_all.matrix },
  allowCrossRegionCallsForManagement: true,
  allowChannelHuddles: true,
  maxCallDurationMins: 0,

  // Role Permissions Defaults
  rolePermissions: { ...DEFAULT_ROLE_COMM_PERMISSIONS },

  // Individual User Overrides Defaults
  userOverrides: {},

  // Enterprise Compliance & Quiet Hours Defaults
  allowFileAttachments: true,
  allowPhotoAttachments: true,
  readReceiptsEnabled: true,
  messageDeletionPolicy: "sender_and_admin",
  announcementPostingPolicy: "broadcast_roles_only",
  quietHoursEnabled: false,
  quietHoursStart: "21:00",
  quietHoursEnd: "06:30",
  allowUrgentBypassQuietHours: true,
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
      const mergedRolePerms: Record<string, RoleCommunicationPermission> = {
        ...DEFAULT_ROLE_COMM_PERMISSIONS,
      };
      if (parsed.rolePermissions && typeof parsed.rolePermissions === "object") {
        for (const key of Object.keys(DEFAULT_ROLE_COMM_PERMISSIONS)) {
          if (parsed.rolePermissions[key]) {
            mergedRolePerms[key] = {
              ...DEFAULT_ROLE_COMM_PERMISSIONS[key],
              ...parsed.rolePermissions[key],
            };
          }
        }
      }
      const mergedMatrix: Record<string, string[]> = {
        ...CALL_MATRIX_PRESETS.all_to_all.matrix,
        ...(parsed.whoCanCallWhoMatrix || {}),
      };
      return {
        ...DEFAULT_MESSAGING_SETTINGS,
        ...parsed,
        rolePermissions: mergedRolePerms,
        whoCanCallWhoMatrix: mergedMatrix,
        userOverrides: parsed.userOverrides || {},
      };
    }
  } catch (e) {
    console.warn("Failed to load messaging settings:", e);
  }
  return {
    ...DEFAULT_MESSAGING_SETTINGS,
    rolePermissions: { ...DEFAULT_ROLE_COMM_PERMISSIONS },
    whoCanCallWhoMatrix: { ...CALL_MATRIX_PRESETS.all_to_all.matrix },
    userOverrides: {},
  };
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
  broadcastRealtimeEvent("settings_updated", { settings: merged });
  return merged;
}

export function resetMessagingSettingsToDefault(): MessagingModuleSettings {
  try {
    localStorage.removeItem(STORAGE_KEY_SETTINGS);
  } catch {}
  const fresh = getMessagingSettings();
  messagingEvents.emit("settings_updated", fresh);
  broadcastRealtimeEvent("settings_updated", { settings: fresh });
  return fresh;
}

// ── Policy & Permission Evaluation Engine ───────────────────────────────────

export function normalizeCommRoleKey(rawRole?: string | null): string {
  const clean = (rawRole || "").trim().toLowerCase();
  if (!clean) return "brand_ambassador";
  if (clean === "admin" || clean === "administrator" || clean === "a0000000-0000-4000-8000-000000000001") {
    return "administrator";
  }
  if (clean === "hr" || clean.includes("human_resource") || clean === "a0000000-0000-4000-8000-000000000002") {
    return "hr";
  }
  if (clean === "nsm" || clean === "national_sales_manager" || clean === "a0000000-0000-4000-8000-000000000003") {
    return "national_sales_manager";
  }
  if (clean === "rsm" || clean === "regional_sales_manager" || clean === "a0000000-0000-4000-8000-000000000005") {
    return "regional_sales_manager";
  }
  if (clean === "se" || clean === "sales_executive" || clean === "a0000000-0000-4000-8000-000000000004") {
    return "sales_executive";
  }
  if (clean === "ba" || clean === "brand_ambassador" || clean === "a0000000-0000-4000-8000-000000000006") {
    return "brand_ambassador";
  }
  if (clean === "vsr" || clean === "van_sales_rep" || clean === "a0000000-0000-4000-8000-000000000007") {
    return "vsr";
  }
  return clean;
}

export function isNationalLeadershipRole(roleKey?: string | null): boolean {
  const norm = normalizeCommRoleKey(roleKey);
  return norm === "administrator" || norm === "hr" || norm === "national_sales_manager";
}

export function isManagementCommRole(roleKey?: string | null): boolean {
  const norm = normalizeCommRoleKey(roleKey);
  return (
    norm === "administrator" ||
    norm === "hr" ||
    norm === "national_sales_manager" ||
    norm === "regional_sales_manager" ||
    norm === "sales_executive"
  );
}

export function getEffectiveRolePermission(
  roleKey: string,
  settings: MessagingModuleSettings = getMessagingSettings(),
): RoleCommunicationPermission {
  const norm = normalizeCommRoleKey(roleKey);
  return (
    settings.rolePermissions?.[norm] ||
    DEFAULT_ROLE_COMM_PERMISSIONS[norm] ||
    DEFAULT_ROLE_COMM_PERMISSIONS.brand_ambassador
  );
}

export function getEffectiveDirectoryScopeForUser(
  viewer: { id?: string; roleKey: string },
  settings: MessagingModuleSettings = getMessagingSettings(),
): "all_regions" | "same_region_only" | "reporting_line_only" {
  // 1. Check individual user override first
  if (viewer.id && settings.userOverrides?.[viewer.id]) {
    const uOverride = settings.userOverrides[viewer.id].directoryScope;
    if (uOverride === "all_regions" || uOverride === "same_region_only") {
      return uOverride;
    }
  }

  // 2. Check role-specific override
  const normRole = normalizeCommRoleKey(viewer.roleKey);
  const rolePerm = getEffectiveRolePermission(normRole, settings);
  if (rolePerm.directoryScopeOverride && rolePerm.directoryScopeOverride !== "inherit") {
    return rolePerm.directoryScopeOverride;
  }

  // 3. Evaluate global directoryVisibilityMode
  const globalMode = settings.directoryVisibilityMode || "role_tiered";
  if (globalMode === "all_regions") return "all_regions";
  if (globalMode === "same_region_only") return "same_region_only";
  if (globalMode === "reporting_line_only") return "reporting_line_only";

  // "role_tiered": National roles see all regions; Regional & Field roles see their assigned region(s)
  if (isNationalLeadershipRole(normRole)) {
    return "all_regions";
  }
  return "same_region_only";
}

export function collectUserRegions(user: { region?: string | null; assignedRegions?: string[] | null }): string[] {
  const list: string[] = [];
  if (user.region && user.region.trim() && user.region.trim().toLowerCase() !== "national") {
    list.push(user.region.trim().toLowerCase());
  }
  if (Array.isArray(user.assignedRegions)) {
    for (const r of user.assignedRegions) {
      if (r && r.trim() && r.trim().toLowerCase() !== "national") {
        const lower = r.trim().toLowerCase();
        if (!list.includes(lower)) list.push(lower);
      }
    }
  }
  return list;
}

export function doRegionsOverlap(
  userA: { region?: string | null; assignedRegions?: string[] | null },
  userB: { region?: string | null; assignedRegions?: string[] | null },
): boolean {
  const regsA = collectUserRegions(userA);
  const regsB = collectUserRegions(userB);
  if (regsA.length === 0 || regsB.length === 0) return false;
  return regsA.some((ra) =>
    regsB.some((rb) => ra === rb || ra.includes(rb) || rb.includes(ra)),
  );
}

export function isWithinQuietHours(settings: MessagingModuleSettings = getMessagingSettings()): boolean {
  if (!settings.quietHoursEnabled) return false;
  try {
    const now = new Date();
    const curMins = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = (settings.quietHoursStart || "21:00").split(":").map(Number);
    const [eh, em] = (settings.quietHoursEnd || "06:30").split(":").map(Number);
    const startMins = (sh || 0) * 60 + (sm || 0);
    const endMins = (eh || 0) * 60 + (em || 0);
    if (startMins <= endMins) {
      return curMins >= startMins && curMins <= endMins;
    } else {
      // Crosses midnight (e.g. 21:00 to 06:30)
      return curMins >= startMins || curMins <= endMins;
    }
  } catch {
    return false;
  }
}

export function canUserSeeContact(
  viewer: {
    id: string;
    roleKey: string;
    region?: string | null;
    assignedRegions?: string[] | null;
    reportsToId?: string | null;
  },
  target: ChatUser,
  settings: MessagingModuleSettings = getMessagingSettings(),
): { visible: boolean; reason: string } {
  if (viewer.id === target.id) {
    return { visible: true, reason: "Self profile" };
  }

  // Offline filter if disabled by admin
  if (!settings.showOfflineUsersInDirectory && target.status === "offline") {
    return { visible: false, reason: "Offline users are hidden by directory settings" };
  }

  const viewerRole = normalizeCommRoleKey(viewer.roleKey);
  const targetRole = normalizeCommRoleKey(target.roleKey);

  // Admin always sees everyone
  if (viewerRole === "administrator") {
    return { visible: true, reason: "Administrator has unrestricted national directory visibility" };
  }

  // Check if target is National Leadership and alwaysShowNationalLeadership is enabled
  if (settings.alwaysShowNationalLeadership && isNationalLeadershipRole(targetRole)) {
    return { visible: true, reason: "National Leadership & Support roles are visible across all regions" };
  }

  // Check direct reporting line (supervisor or subordinate)
  const isDirectSupervisorOrReport =
    Boolean(viewer.reportsToId && viewer.reportsToId === target.id) ||
    Boolean(target.reportsToId && target.reportsToId === viewer.id);
  if (settings.alwaysShowDirectSupervisor && isDirectSupervisorOrReport) {
    return { visible: true, reason: "Direct reporting chain supervisor/subordinate" };
  }

  const effectiveScope = getEffectiveDirectoryScopeForUser(viewer, settings);

  if (effectiveScope === "all_regions") {
    return { visible: true, reason: "All Regions directory scope enabled for your role" };
  }

  if (effectiveScope === "reporting_line_only") {
    if (isDirectSupervisorOrReport) {
      return { visible: true, reason: "Direct reporting line match" };
    }
    if (doRegionsOverlap(viewer, target) && viewerRole === targetRole) {
      return { visible: true, reason: "Same region & peer role" };
    }
    return {
      visible: false,
      reason: `Restricted to direct reporting line only (${target.name} is outside your reporting chain)`,
    };
  }

  // effectiveScope === "same_region_only"
  const viewerRegs = collectUserRegions(viewer);
  if (viewerRegs.length === 0) {
    // If viewer has no specific region assigned (e.g. National), allow visibility
    return { visible: true, reason: "Viewer has national/unassigned territory scope" };
  }

  if (doRegionsOverlap(viewer, target)) {
    return { visible: true, reason: `Shared territory (${target.region})` };
  }

  return {
    visible: false,
    reason: `Restricted to your assigned region(s) only (${viewer.region || viewerRegs.join(", ")}) — ${target.name} is in ${target.region}`,
  };
}

export function filterDirectoryUsersForViewer(
  allUsers: ChatUser[],
  viewer: {
    id: string;
    roleKey: string;
    region?: string | null;
    assignedRegions?: string[] | null;
    reportsToId?: string | null;
  },
  settings: MessagingModuleSettings = getMessagingSettings(),
): ChatUser[] {
  return allUsers.filter((target) => canUserSeeContact(viewer, target, settings).visible);
}

export function canUserReceiveCalls(
  user: { id?: string; roleKey: string },
  settings: MessagingModuleSettings = getMessagingSettings(),
): { allowed: boolean; reason: string } {
  if (!settings.enabled) {
    return { allowed: false, reason: "Communications system is globally disabled" };
  }
  if (user.id && settings.userOverrides?.[user.id]) {
    const ov = settings.userOverrides[user.id].canReceiveCalls;
    if (ov === "deny") {
      return { allowed: false, reason: "User is blocked from receiving calls by an individual Admin override" };
    }
    if (ov === "allow") {
      return { allowed: true, reason: "Explicitly allowed by individual Admin override" };
    }
  }
  const rolePerm = getEffectiveRolePermission(user.roleKey, settings);
  if (!rolePerm.canReceiveCalls) {
    return { allowed: false, reason: `${rolePerm.roleName} role is configured to not receive incoming calls` };
  }
  return { allowed: true, reason: `${rolePerm.roleName} can receive calls` };
}

export function canUserCallTarget(
  caller: {
    id: string;
    roleKey: string;
    region?: string | null;
    assignedRegions?: string[] | null;
    reportsToId?: string | null;
  },
  target: {
    id: string;
    name?: string;
    roleKey: string;
    region?: string | null;
    assignedRegions?: string[] | null;
    reportsToId?: string | null;
  },
  callType: "audio" | "video" = "audio",
  settings: MessagingModuleSettings = getMessagingSettings(),
  isGroupHuddle = false,
): { allowed: boolean; reason: string } {
  if (!settings.enabled) {
    return { allowed: false, reason: "Communications & Calling system is currently disabled by Administrator." };
  }
  if (callType === "audio" && !settings.allowVoiceCalls) {
    return { allowed: false, reason: "Voice calling is disabled globally in Communications Settings." };
  }
  if (callType === "video" && !settings.allowVideoCalls) {
    return { allowed: false, reason: "Video calling is disabled globally in Communications Settings." };
  }

  const callerRole = normalizeCommRoleKey(caller.roleKey);
  const targetRole = normalizeCommRoleKey(target.roleKey);
  const callerPerm = getEffectiveRolePermission(callerRole, settings);
  const targetPerm = getEffectiveRolePermission(targetRole, settings);

  // Quiet Hours check
  if (settings.quietHoursEnabled && isWithinQuietHours(settings) && callerRole !== "administrator") {
    if (!settings.allowUrgentBypassQuietHours) {
      return {
        allowed: false,
        reason: `Quiet Hours are active (${settings.quietHoursStart} – ${settings.quietHoursEnd}). Outgoing calls are paused.`,
      };
    }
  }

  // Individual caller override
  const callerOverride = caller.id ? settings.userOverrides?.[caller.id] : undefined;
  if (callerOverride?.canCall === "deny") {
    return {
      allowed: false,
      reason: "Your calling privilege has been restricted by an Administrator override.",
    };
  }

  // Role-level caller check (unless individual override explicitly allows)
  if (callerOverride?.canCall !== "allow") {
    if (callType === "audio" && !callerPerm.canInitiateVoiceCalls) {
      return {
        allowed: false,
        reason: `Your role (${callerPerm.roleName}) is not permitted to initiate voice calls.`,
      };
    }
    if (callType === "video" && !callerPerm.canInitiateVideoCalls) {
      return {
        allowed: false,
        reason: `Your role (${callerPerm.roleName}) is not permitted to initiate video calls.`,
      };
    }
  }

  // Group Huddle check
  if (isGroupHuddle) {
    if (!settings.allowChannelHuddles) {
      return { allowed: false, reason: "Channel & Bulletin group huddles are disabled by Administrator." };
    }
    if (!callerPerm.canStartGroupHuddles && callerOverride?.canCall !== "allow") {
      return {
        allowed: false,
        reason: `Your role (${callerPerm.roleName}) is not authorized to start group channel huddles.`,
      };
    }
    return { allowed: true, reason: "Authorized to start group channel huddle" };
  }

  // Target receive calls check
  const targetRecvCheck = canUserReceiveCalls({ id: target.id, roleKey: targetRole }, settings);
  if (!targetRecvCheck.allowed) {
    return {
      allowed: false,
      reason: target.name
        ? `${target.name} cannot receive calls (${targetRecvCheck.reason}).`
        : targetRecvCheck.reason,
    };
  }

  // Administrator can always call anyone who can receive calls
  if (callerRole === "administrator") {
    return { allowed: true, reason: "Administrator has full calling authority" };
  }

  // Routing Policy 1: Management Initiated Only
  if (settings.callingRoutingPolicy === "management_initiated") {
    const isDirectSupervisor = Boolean(caller.reportsToId && caller.reportsToId === target.id);
    if (!isManagementCommRole(callerRole) && !isDirectSupervisor && callerOverride?.canCall !== "allow") {
      return {
        allowed: false,
        reason: "Calling policy is set to Management-Initiated Only (Field reps may only call their direct supervisor).",
      };
    }
  }

  // Check "Who Can Call Who" Role-to-Role Matrix (applies in matrix_controlled, hierarchy_and_region, management_initiated)
  if (settings.callingRoutingPolicy !== "open_directory") {
    const allowedTargets = settings.whoCanCallWhoMatrix?.[callerRole] || [];
    if (!allowedTargets.includes(targetRole) && callerOverride?.canCall !== "allow") {
      return {
        allowed: false,
        reason: `Call Matrix Policy: ${callerPerm.roleName} is not permitted to call ${targetPerm.roleName}.`,
      };
    }
  }

  // Check Region / Hierarchy Scope
  const isDirectReportingChain =
    Boolean(caller.reportsToId && caller.reportsToId === target.id) ||
    Boolean(target.reportsToId && target.reportsToId === caller.id);
  const isTargetNational = isNationalLeadershipRole(targetRole) && settings.alwaysShowNationalLeadership;
  const isCallerNational = isNationalLeadershipRole(callerRole);

  if (settings.callingRoutingPolicy === "hierarchy_and_region") {
    const sameReg = doRegionsOverlap(caller, target);
    const mgmtCrossRegionAllowed = settings.allowCrossRegionCallsForManagement && isManagementCommRole(callerRole);
    if (!sameReg && !isDirectReportingChain && !isTargetNational && !isCallerNational && !mgmtCrossRegionAllowed) {
      return {
        allowed: false,
        reason: `Hierarchy & Region Policy: You can only call staff within your assigned region (${caller.region || "Territory"}) or reporting line.`,
      };
    }
  } else {
    // Also respect the caller's Directory Visibility Scope unless management cross-region calling is enabled
    const callerScope = getEffectiveDirectoryScopeForUser(caller, settings);
    if (callerScope === "same_region_only") {
      const sameReg = doRegionsOverlap(caller, target) || collectUserRegions(caller).length === 0;
      const mgmtCrossRegionAllowed = settings.allowCrossRegionCallsForManagement && isManagementCommRole(callerRole);
      if (
        !sameReg &&
        !(settings.alwaysShowDirectSupervisor && isDirectReportingChain) &&
        !isTargetNational &&
        !mgmtCrossRegionAllowed
      ) {
        return {
          allowed: false,
          reason: `Region Scope Policy: Calling is restricted to contacts in your region (${caller.region || "Assigned Region"}).`,
        };
      }
    }
  }

  return {
    allowed: true,
    reason: `${callerPerm.shortName} → ${targetPerm.shortName} calling permitted`,
  };
}

export function canUserReceiveMessages(
  user: { id?: string; roleKey: string },
  settings: MessagingModuleSettings = getMessagingSettings(),
): { allowed: boolean; reason: string } {
  if (!settings.enabled) {
    return { allowed: false, reason: "Communications system is globally disabled" };
  }
  if (user.id && settings.userOverrides?.[user.id]) {
    const ov = settings.userOverrides[user.id].canReceiveMessages;
    if (ov === "deny") {
      return { allowed: false, reason: "User is restricted from receiving messages by an Administrator override" };
    }
    if (ov === "allow") {
      return { allowed: true, reason: "Explicitly allowed by individual Admin override" };
    }
  }
  const rolePerm = getEffectiveRolePermission(user.roleKey, settings);
  if (!rolePerm.canReceiveMessages) {
    return { allowed: false, reason: `${rolePerm.roleName} role is configured to not receive messages` };
  }
  return { allowed: true, reason: `${rolePerm.roleName} can receive messages` };
}

export function canUserSendMessage(
  sender: { id: string; roleKey: string },
  conversation?: Conversation | null,
  targetPartner?: ChatUser | null,
  settings: MessagingModuleSettings = getMessagingSettings(),
): { allowed: boolean; reason: string } {
  if (!settings.enabled) {
    return { allowed: false, reason: "Communications & Messaging system is disabled by Administrator." };
  }

  const senderRole = normalizeCommRoleKey(sender.roleKey);
  const senderPerm = getEffectiveRolePermission(senderRole, settings);
  const senderOverride = sender.id ? settings.userOverrides?.[sender.id] : undefined;

  if (senderOverride?.canSendMessages === "deny") {
    return {
      allowed: false,
      reason: "Your messaging access is currently set to Read-Only by an Administrator override.",
    };
  }

  if (senderOverride?.canSendMessages !== "allow" && !senderPerm.canSendMessages) {
    return {
      allowed: false,
      reason: `Your role (${senderPerm.roleName}) is configured as Read-Only and cannot send messages.`,
    };
  }

  // If posting to an Announcement channel, check announcementPostingPolicy
  if (conversation?.type === "announcement") {
    const policy = settings.announcementPostingPolicy || "broadcast_roles_only";
    if (policy === "broadcast_roles_only") {
      const canBroadcast =
        senderPerm.canBroadcast ||
        settings.broadcastRolesAllowed.includes(senderRole) ||
        settings.broadcastRolesAllowed.includes(sender.roleKey);
      if (!canBroadcast && senderRole !== "administrator") {
        return {
          allowed: false,
          reason: "Only roles with Broadcast Directive permission can post in the All-Hands Bulletin channel.",
        };
      }
    } else if (policy === "management_only") {
      if (!isManagementCommRole(senderRole)) {
        return {
          allowed: false,
          reason: "Only Management roles can post in the All-Hands Bulletin channel.",
        };
      }
    }
  }

  // If direct message, check if target partner is allowed to receive messages
  if ((!conversation || conversation.type === "direct") && targetPartner) {
    const recvCheck = canUserReceiveMessages(
      { id: targetPartner.id, roleKey: targetPartner.roleKey },
      settings,
    );
    if (!recvCheck.allowed) {
      return {
        allowed: false,
        reason: `${targetPartner.name} cannot receive direct messages (${recvCheck.reason}).`,
      };
    }
  }

  return { allowed: true, reason: `${senderPerm.roleName} is authorized to send messages` };
}

export function canUserDeleteMessage(
  user: { id: string; roleKey: string },
  message: ChatMessage,
  settings: MessagingModuleSettings = getMessagingSettings(),
): boolean {
  const roleNorm = normalizeCommRoleKey(user.roleKey);
  if (roleNorm === "administrator") return true;
  const policy = settings.messageDeletionPolicy || "sender_and_admin";
  if (policy === "admin_only") return false;
  if (policy === "sender_and_admin") return message.senderId === user.id;
  return true; // "everyone"
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

// ── Real-Time Cross-Tab & Supabase Broadcast Synchronization ─────────────────
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
const CLIENT_INSTANCE_ID = `client-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function ensureRealtimeSync() {
  if (typeof window === "undefined") return;
  if (realtimeChannel) return;

  try {
    realtimeChannel = supabase.channel("penedge-communications-hub", {
      config: { broadcast: { self: false } },
    });

    realtimeChannel
      .on("broadcast", { event: "new_message" }, ({ payload }) => {
        if (!payload || payload._origin === CLIENT_INSTANCE_ID) return;
        const msg = payload.message as ChatMessage;
        if (!msg || !msg.id) return;

        const existingMsgs = getStoredMessages();
        if (!existingMsgs.some((m) => m.id === msg.id)) {
          const nextMsgs = [...existingMsgs, msg];
          localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(nextMsgs));
          messagingEvents.emit("messages_updated", nextMsgs);
        }

        const convs = getStoredConversations();
        const idx = convs.findIndex((c) => c.id === msg.conversationId);
        if (idx !== -1) {
          const updated = { ...convs[idx] };
          updated.lastMessage = msg;
          updated.updatedAt = msg.timestamp;
          updated.unreadCount = (updated.unreadCount || 0) + 1;
          convs.splice(idx, 1);
          convs.unshift(updated);
          localStorage.setItem(STORAGE_KEY_CONVERSATIONS, JSON.stringify(convs));
          messagingEvents.emit("conversations_updated", convs);
        }

        playMessageNotificationSound(msg.priority === "urgent");
        messagingEvents.emit("new_message", msg);
        if (msg.isPushNotification) {
          messagingEvents.emit("push_notification", msg);
        }
      })
      .on("broadcast", { event: "call_state_changed" }, ({ payload }) => {
        if (!payload || payload._origin === CLIENT_INSTANCE_ID) return;
        const call = (payload.call ?? null) as CallSession | null;
        if (!call) {
          localStorage.removeItem(STORAGE_KEY_ACTIVE_CALL);
          stopRingingSound();
        } else {
          localStorage.setItem(STORAGE_KEY_ACTIVE_CALL, JSON.stringify(call));
          if (call.status === "ringing") {
            startRingingSound();
            messagingEvents.emit("incoming_call", call);
          } else {
            stopRingingSound();
          }
        }
        messagingEvents.emit("call_state_changed", call);
      })
      .on("broadcast", { event: "messages_synced" }, ({ payload }) => {
        if (!payload || payload._origin === CLIENT_INSTANCE_ID) return;
        if (Array.isArray(payload.messages)) {
          localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(payload.messages));
          messagingEvents.emit("messages_updated", payload.messages);
        }
        if (Array.isArray(payload.conversations)) {
          localStorage.setItem(STORAGE_KEY_CONVERSATIONS, JSON.stringify(payload.conversations));
          messagingEvents.emit("conversations_updated", payload.conversations);
        }
      })
      .on("broadcast", { event: "settings_updated" }, ({ payload }) => {
        if (!payload || payload._origin === CLIENT_INSTANCE_ID) return;
        if (payload.settings) {
          localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(payload.settings));
          messagingEvents.emit("settings_updated", getMessagingSettings());
        }
      })
      .subscribe();
  } catch (err) {
    console.warn("Realtime channel setup notice:", err);
  }

  // Cross-tab storage listener
  window.addEventListener("storage", (e: StorageEvent) => {
    if (e.key === STORAGE_KEY_MESSAGES) {
      const msgs = getStoredMessages();
      messagingEvents.emit("messages_updated", msgs);
      if (msgs.length > 0) {
        messagingEvents.emit("new_message", msgs[msgs.length - 1]);
      }
    } else if (e.key === STORAGE_KEY_CONVERSATIONS) {
      messagingEvents.emit("conversations_updated", getStoredConversations());
    } else if (e.key === STORAGE_KEY_ACTIVE_CALL) {
      const call = getActiveCall();
      if (!call || call.status !== "ringing") {
        stopRingingSound();
      }
      messagingEvents.emit("call_state_changed", call);
    } else if (e.key === STORAGE_KEY_SETTINGS) {
      messagingEvents.emit("settings_updated", getMessagingSettings());
    }
  });
}

function broadcastRealtimeEvent(event: string, data: Record<string, any>) {
  ensureRealtimeSync();
  if (!realtimeChannel) return;
  try {
    void realtimeChannel.send({
      type: "broadcast",
      event,
      payload: { ...data, _origin: CLIENT_INSTANCE_ID },
    });
  } catch {}
}

if (typeof window !== "undefined") {
  ensureRealtimeSync();
}

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
      assignedRegions: Array.isArray(u.assigned_regions) ? u.assigned_regions : u.region ? [u.region] : [],
      reportsToId: u.reports_to_id || null,
      reportsToName: u.reports_to_name || null,
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
  ensureRealtimeSync();
  const users = await getDirectoryUsers(currentUserId);
  let convs = getStoredConversations();
  const msgs = getStoredMessages();

  if (convs.length === 0) {
    const seeded = seedDefaultConversations(currentUserId, users);
    convs = seeded.conversations;
  }

  let modified = false;
  const nowIso = new Date().toISOString();

  // 1. Ensure All-Hands Bulletin exists and has all participants
  const annIndex = convs.findIndex((c) => c.id === "conv-announcements-all-hands" || c.type === "announcement");
  if (annIndex === -1) {
    convs.unshift({
      id: "conv-announcements-all-hands",
      type: "announcement",
      title: "📢 Pen Edge All-Hands & Field Bulletins",
      description: "Official executive announcements, target directives & policy alerts.",
      participantIds: users.map((u) => u.id),
      unreadCount: 0,
      isPinned: true,
      isBroadcast: true,
      channelCategory: "announcements",
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    modified = true;
  } else {
    const ann = convs[annIndex];
    const allIds = users.map((u) => u.id);
    if (ann.participantIds.length !== allIds.length) {
      convs[annIndex] = { ...ann, participantIds: allIds };
      modified = true;
    }
  }

  // 2. Sync Territory Hub channels from active regions & staff assignments
  try {
    const regions = await getRegions();
    const activeRegions = regions.filter((r) => r.is_active);
    for (const reg of activeRegions) {
      const slug = reg.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const channelId = `conv-hub-${slug}`;
      const regionMembers = users
        .filter(
          (u) =>
            u.region.toLowerCase() === reg.name.toLowerCase() ||
            u.region === "National" ||
            u.roleKey === "administrator" ||
            u.roleKey === "national_sales_manager" ||
            u.roleKey === "hr"
        )
        .map((u) => u.id);
      if (currentUserId && !regionMembers.includes(currentUserId)) {
        regionMembers.push(currentUserId);
      }

      const existingIdx = convs.findIndex((c) => c.id === channelId);
      if (existingIdx === -1) {
        convs.push({
          id: channelId,
          type: "channel",
          title: `📍 ${reg.name} Territory Hub`,
          description: reg.description || `Field coordination, visits & sales execution for ${reg.name}.`,
          participantIds: regionMembers,
          unreadCount: 0,
          channelCategory: "regions",
          createdAt: nowIso,
          updatedAt: nowIso,
        });
        modified = true;
      }
    }
  } catch (err) {
    console.warn("Failed to sync territory hub channels:", err);
  }

  // 3. Sync Direct 1-on-1 conversations for every active staff member in directory
  const effectiveSelfId = currentUserId || "current-user";
  for (const target of users) {
    if (target.id === effectiveSelfId) continue;

    // Remove any stale placeholder conversation created with "current-user" if real user ID is now known
    if (effectiveSelfId !== "current-user") {
      const staleId = `conv-dm-${["current-user", target.id].sort().join("-")}`;
      const realId = `conv-dm-${[effectiveSelfId, target.id].sort().join("-")}`;
      const staleIdx = convs.findIndex((c) => c.id === staleId);
      if (staleIdx !== -1 && staleId !== realId) {
        const staleConv = convs[staleIdx];
        if (!convs.some((c) => c.id === realId)) {
          convs[staleIdx] = {
            ...staleConv,
            id: realId,
            participantIds: [effectiveSelfId, target.id],
          };
        } else {
          convs.splice(staleIdx, 1);
        }
        modified = true;
      }
    }

    const dmId = `conv-dm-${[effectiveSelfId, target.id].sort().join("-")}`;
    const existingDmIdx = convs.findIndex(
      (c) =>
        c.id === dmId ||
        (c.type === "direct" &&
          c.participantIds.includes(effectiveSelfId) &&
          c.participantIds.includes(target.id))
    );

    if (existingDmIdx === -1) {
      const lastMsg = [...msgs].reverse().find((m) => m.conversationId === dmId);
      convs.push({
        id: dmId,
        type: "direct",
        title: target.name,
        description: `${target.roleName} · ${target.region}`,
        participantIds: [effectiveSelfId, target.id],
        unreadCount: 0,
        lastMessage: lastMsg,
        channelCategory: "direct",
        createdAt: nowIso,
        updatedAt: lastMsg?.timestamp || nowIso,
      });
      modified = true;
    } else {
      const existingDm = convs[existingDmIdx];
      const expectedDesc = `${target.roleName} · ${target.region}`;
      if (existingDm.title !== target.name || existingDm.description !== expectedDesc) {
        convs[existingDmIdx] = {
          ...existingDm,
          title: target.name,
          description: expectedDesc,
        };
        modified = true;
      }
    }
  }

  // Sort conversations: pinned first, then those with messages by updatedAt desc, then direct/channels
  convs.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    if (a.lastMessage && !b.lastMessage) return -1;
    if (!a.lastMessage && b.lastMessage) return 1;
    if (a.lastMessage && b.lastMessage) {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }
    if (a.type === "direct" && b.type !== "direct") return -1;
    if (a.type !== "direct" && b.type === "direct") return 1;
    return a.title.localeCompare(b.title);
  });

  if (modified) {
    saveStoredConversations(convs);
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

  // Update conversation lastMessage & move to top (keeping pinned announcement at top if applicable)
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

  // Play notification sound & trigger real-time event locally and via Supabase Broadcast
  playMessageNotificationSound(newMsg.priority === "urgent");
  messagingEvents.emit("new_message", newMsg);
  broadcastRealtimeEvent("new_message", { message: newMsg });

  if (newMsg.isPushNotification) {
    messagingEvents.emit("push_notification", newMsg);
  }

  // Update delivery & read status ticks
  setTimeout(() => {
    const list = getStoredMessages();
    const idx = list.findIndex((m) => m.id === newMsg.id);
    if (idx !== -1 && list[idx].status === "sent") {
      list[idx].status = "delivered";
      saveStoredMessages(list);
    }
  }, 350);

  setTimeout(() => {
    const list = getStoredMessages();
    const idx = list.findIndex((m) => m.id === newMsg.id);
    if (idx !== -1) {
      list[idx].status = "read";
      saveStoredMessages(list);
    }
  }, 1200);

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

export function deleteMessage(messageId: string): void {
  const allMessages = getStoredMessages();
  const targetMsg = allMessages.find((m) => m.id === messageId);
  if (!targetMsg) return;

  const remaining = allMessages.filter((m) => m.id !== messageId);
  saveStoredMessages(remaining);

  const allConvs = getStoredConversations();
  const convIdx = allConvs.findIndex((c) => c.id === targetMsg.conversationId);
  if (convIdx !== -1) {
    const convRemaining = remaining.filter((m) => m.conversationId === targetMsg.conversationId);
    const latest = convRemaining.length > 0 ? convRemaining[convRemaining.length - 1] : undefined;
    allConvs[convIdx] = {
      ...allConvs[convIdx],
      lastMessage: latest,
      updatedAt: latest?.timestamp || allConvs[convIdx].createdAt,
    };
    saveStoredConversations(allConvs);
  }

  broadcastRealtimeEvent("messages_synced", {
    messages: remaining,
    conversations: allConvs,
  });
}

export function clearConversationMessages(conversationId: string): void {
  const allMessages = getStoredMessages();
  const remaining = allMessages.filter((m) => m.conversationId !== conversationId);
  saveStoredMessages(remaining);

  const allConvs = getStoredConversations();
  const convIdx = allConvs.findIndex((c) => c.id === conversationId);
  if (convIdx !== -1) {
    allConvs[convIdx] = {
      ...allConvs[convIdx],
      lastMessage: undefined,
      unreadCount: 0,
    };
    saveStoredConversations(allConvs);
  }

  broadcastRealtimeEvent("messages_synced", {
    messages: remaining,
    conversations: allConvs,
  });
}

export function clearConversationCallLogs(conversationId: string): void {
  const allMessages = getStoredMessages();
  const remaining = allMessages.filter(
    (m) => !(m.conversationId === conversationId && m.type === "call_log"),
  );
  saveStoredMessages(remaining);

  const allConvs = getStoredConversations();
  const convIdx = allConvs.findIndex((c) => c.id === conversationId);
  if (convIdx !== -1) {
    const convRemaining = remaining.filter((m) => m.conversationId === conversationId);
    const latest = convRemaining.length > 0 ? convRemaining[convRemaining.length - 1] : undefined;
    allConvs[convIdx] = {
      ...allConvs[convIdx],
      lastMessage: latest,
      updatedAt: latest?.timestamp || allConvs[convIdx].createdAt,
    };
    saveStoredConversations(allConvs);
  }

  broadcastRealtimeEvent("messages_synced", {
    messages: remaining,
    conversations: allConvs,
  });
}

export function clearAllCallLogs(): void {
  const allMessages = getStoredMessages();
  const remaining = allMessages.filter((m) => m.type !== "call_log");
  saveStoredMessages(remaining);

  const allConvs = getStoredConversations().map((conv) => {
    const convRemaining = remaining.filter((m) => m.conversationId === conv.id);
    const latest = convRemaining.length > 0 ? convRemaining[convRemaining.length - 1] : undefined;
    return {
      ...conv,
      lastMessage: latest,
      updatedAt: latest?.timestamp || conv.createdAt,
    };
  });
  saveStoredConversations(allConvs);
  saveActiveCall(null);

  broadcastRealtimeEvent("messages_synced", {
    messages: remaining,
    conversations: allConvs,
  });
}

export function clearAllMessagesAndCalls(): void {
  saveStoredMessages([]);

  const allConvs = getStoredConversations().map((conv) => ({
    ...conv,
    lastMessage: undefined,
    unreadCount: 0,
  }));
  saveStoredConversations(allConvs);
  saveActiveCall(null);

  broadcastRealtimeEvent("messages_synced", {
    messages: [],
    conversations: allConvs,
  });
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
    broadcastRealtimeEvent("call_state_changed", { call });
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

    const settings = getMessagingSettings();
    // Log call entry to chat conversation if exists and enabled
    if (current.conversationId && settings.recordCallLogsInChat !== false) {
      void sendMessage({
        conversationId: current.conversationId,
        senderId: current.callerId,
        senderName: current.callerName,
        senderRole: current.callerRole,
        content: `${current.callType === "video" ? "📹 Video Call" : "📞 Voice Call"} with ${current.receiverName} — ${
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
