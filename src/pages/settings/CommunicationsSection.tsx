import { useEffect, useMemo, useState } from "react";
import {
  MessageSquare,
  Phone,
  Video,
  Radio,
  Mic,
  MapPin,
  Sparkles,
  Volume2,
  Check,
  RotateCcw,
  Bell,
  Lock,
  Plus,
  Trash2,
  Shield,
  Globe,
  Clock,
  FileText,
  Image as ImageIcon,
  UserCheck,
  Search,
  Sliders,
  Eye,
  Ban,
  CheckCircle2,
} from "lucide-react";
import {
  getMessagingSettings,
  saveMessagingSettings,
  resetMessagingSettingsToDefault,
  clearAllCallLogs,
  clearAllMessagesAndCalls,
  playMessageNotificationSound,
  previewTestRingtone,
  getDirectoryUsers,
  COMM_ROLE_CATALOG,
  CALL_MATRIX_PRESETS,
  canUserSeeContact,
  canUserCallTarget,
  canUserSendMessage,
  canUserReceiveMessages,
  canUserReceiveCalls,
  type MessagingModuleSettings,
  type RoleCommunicationPermission,
  type UserCommunicationOverride,
  type ChatUser,
  type DirectoryVisibilityMode,
  type CallingRoutingPolicy,
} from "../../services/messagingService";

type SettingsSectionTab =
  | "all"
  | "visibility_and_regions"
  | "who_can_call_who"
  | "role_and_user_permissions"
  | "simulator"
  | "media_and_compliance";

export function CommunicationsSection() {
  const [settings, setSettings] = useState<MessagingModuleSettings>(() => getMessagingSettings());
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");
  const [activeSubTab, setActiveSubTab] = useState<SettingsSectionTab>("all");
  const [newChipText, setNewChipText] = useState("");

  // Directory users for per-user overrides and live simulator
  const [directoryUsers, setDirectoryUsers] = useState<ChatUser[]>([]);
  const [selectedOverrideUserId, setSelectedOverrideUserId] = useState<string>("");
  const [overrideNote, setOverrideNote] = useState<string>("");
  const [userSearchQuery, setUserSearchQuery] = useState<string>("");

  // Policy Simulator state
  const [simMode, setSimMode] = useState<"roles" | "users">("roles");
  const [simCallerRole, setSimCallerRole] = useState<string>("brand_ambassador");
  const [simCallerRegion, setSimCallerRegion] = useState<string>("Lekki");
  const [simTargetRole, setSimTargetRole] = useState<string>("regional_sales_manager");
  const [simTargetRegion, setSimTargetRegion] = useState<string>("Lekki");
  const [simSameSupervisor, setSimSameSupervisor] = useState<boolean>(false);
  const [simCallerUserId, setSimCallerUserId] = useState<string>("");
  const [simTargetUserId, setSimTargetUserId] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    getDirectoryUsers().then((users) => {
      if (!mounted) return;
      setDirectoryUsers(users);
      if (users.length >= 2) {
        setSimCallerUserId(users[0].id);
        setSimTargetUserId(users[1].id);
      } else if (users.length === 1) {
        setSimCallerUserId(users[0].id);
        setSimTargetUserId(users[0].id);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const triggerSavedBadge = () => {
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2500);
  };

  const updateSetting = <K extends keyof MessagingModuleSettings>(
    key: K,
    value: MessagingModuleSettings[K],
  ) => {
    const updated = saveMessagingSettings({ [key]: value });
    setSettings(updated);
    triggerSavedBadge();
  };

  // Toggle cell in Who Can Call Who Matrix
  const handleToggleCallMatrixCell = (callerRoleKey: string, receiverRoleKey: string) => {
    const currentMatrix = { ...(settings.whoCanCallWhoMatrix || {}) };
    const currentAllowed = currentMatrix[callerRoleKey] || [];
    const nextAllowed = currentAllowed.includes(receiverRoleKey)
      ? currentAllowed.filter((r) => r !== receiverRoleKey)
      : [...currentAllowed, receiverRoleKey];
    currentMatrix[callerRoleKey] = nextAllowed;
    updateSetting("whoCanCallWhoMatrix", currentMatrix);
  };

  const handleSetRowAllMatrix = (callerRoleKey: string, allowAll: boolean) => {
    const currentMatrix = { ...(settings.whoCanCallWhoMatrix || {}) };
    currentMatrix[callerRoleKey] = allowAll ? COMM_ROLE_CATALOG.map((r) => r.key) : [];
    updateSetting("whoCanCallWhoMatrix", currentMatrix);
  };

  const handleApplyMatrixPreset = (presetKey: keyof typeof CALL_MATRIX_PRESETS) => {
    const preset = CALL_MATRIX_PRESETS[presetKey];
    if (!preset) return;
    const cloned: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(preset.matrix)) {
      cloned[k] = [...v];
    }
    updateSetting("whoCanCallWhoMatrix", cloned);
  };

  // Update Role-level Communication Permission
  const handleUpdateRolePermission = <K extends keyof RoleCommunicationPermission>(
    roleKey: string,
    field: K,
    value: RoleCommunicationPermission[K],
  ) => {
    const currentRolePerms = { ...(settings.rolePermissions || {}) };
    const existing = currentRolePerms[roleKey];
    if (!existing) return;
    currentRolePerms[roleKey] = {
      ...existing,
      [field]: value,
    };

    // Keep broadcastRolesAllowed array synced if canBroadcast is toggled
    let nextBroadcastRoles = [...(settings.broadcastRolesAllowed || [])];
    if (field === "canBroadcast") {
      if (value) {
        if (!nextBroadcastRoles.includes(roleKey)) nextBroadcastRoles.push(roleKey);
      } else {
        nextBroadcastRoles = nextBroadcastRoles.filter((r) => r !== roleKey);
      }
      const updated = saveMessagingSettings({
        rolePermissions: currentRolePerms,
        broadcastRolesAllowed: nextBroadcastRoles,
      });
      setSettings(updated);
      triggerSavedBadge();
      return;
    }

    updateSetting("rolePermissions", currentRolePerms);
  };

  // Add or update individual staff override
  const handleAddUserOverride = () => {
    if (!selectedOverrideUserId) return;
    const staffUser = directoryUsers.find((u) => u.id === selectedOverrideUserId);
    if (!staffUser) return;
    const currentOverrides = { ...(settings.userOverrides || {}) };
    const existing = currentOverrides[staffUser.id];
    currentOverrides[staffUser.id] = existing || {
      userId: staffUser.id,
      userName: staffUser.name,
      roleKey: staffUser.roleKey,
      region: staffUser.region || "National",
      canCall: "inherit",
      canReceiveCalls: "inherit",
      canSendMessages: "inherit",
      canReceiveMessages: "inherit",
      directoryScope: "inherit",
      note: overrideNote.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };
    updateSetting("userOverrides", currentOverrides);
    setSelectedOverrideUserId("");
    setOverrideNote("");
  };

  const handleUpdateUserOverrideField = <K extends keyof UserCommunicationOverride>(
    userId: string,
    field: K,
    value: UserCommunicationOverride[K],
  ) => {
    const currentOverrides = { ...(settings.userOverrides || {}) };
    if (!currentOverrides[userId]) return;
    currentOverrides[userId] = {
      ...currentOverrides[userId],
      [field]: value,
      updatedAt: new Date().toISOString(),
    };
    updateSetting("userOverrides", currentOverrides);
  };

  const handleRemoveUserOverride = (userId: string) => {
    const currentOverrides = { ...(settings.userOverrides || {}) };
    delete currentOverrides[userId];
    updateSetting("userOverrides", currentOverrides);
  };

  const handleToggleBroadcastRole = (roleKey: string) => {
    const current = settings.broadcastRolesAllowed;
    const isNowAllowed = !current.includes(roleKey);
    const next = isNowAllowed
      ? [...current, roleKey]
      : current.filter((r) => r !== roleKey);

    const currentRolePerms = { ...(settings.rolePermissions || {}) };
    if (currentRolePerms[roleKey]) {
      currentRolePerms[roleKey] = {
        ...currentRolePerms[roleKey],
        canBroadcast: isNowAllowed,
      };
    }
    const updated = saveMessagingSettings({
      broadcastRolesAllowed: next,
      rolePermissions: currentRolePerms,
    });
    setSettings(updated);
    triggerSavedBadge();
  };

  const handleAddChip = () => {
    const trimmed = newChipText.trim();
    if (!trimmed) return;
    if (settings.smartRepliesList.includes(trimmed)) return;
    const next = [...settings.smartRepliesList, trimmed];
    updateSetting("smartRepliesList", next);
    setNewChipText("");
  };

  const handleRemoveChip = (chipToRemove: string) => {
    const next = settings.smartRepliesList.filter((c) => c !== chipToRemove);
    updateSetting("smartRepliesList", next);
  };

  const handleResetDefaults = () => {
    if (window.confirm("Reset all Communications & Calling settings back to system defaults?")) {
      const def = resetMessagingSettingsToDefault();
      setSettings(def);
      triggerSavedBadge();
    }
  };

  // Live Policy Simulator Evaluation
  const simulationResult = useMemo(() => {
    let callerObj: {
      id: string;
      name: string;
      roleKey: string;
      region: string;
      assignedRegions: string[];
      reportsToId: string | null;
    };
    let targetObj: ChatUser;

    if (simMode === "users" && directoryUsers.length > 0) {
      const cUser = directoryUsers.find((u) => u.id === simCallerUserId) || directoryUsers[0];
      const tUser = directoryUsers.find((u) => u.id === simTargetUserId) || directoryUsers[0];
      callerObj = {
        id: cUser.id,
        name: cUser.name,
        roleKey: cUser.roleKey,
        region: cUser.region,
        assignedRegions: cUser.assignedRegions || [cUser.region],
        reportsToId: cUser.reportsToId || null,
      };
      targetObj = tUser;
    } else {
      const callerMeta = COMM_ROLE_CATALOG.find((r) => r.key === simCallerRole) || COMM_ROLE_CATALOG[5];
      const targetMeta = COMM_ROLE_CATALOG.find((r) => r.key === simTargetRole) || COMM_ROLE_CATALOG[3];
      callerObj = {
        id: "sim-caller",
        name: `Sample ${callerMeta.shortName}`,
        roleKey: callerMeta.key,
        region: simCallerRegion,
        assignedRegions: [simCallerRegion],
        reportsToId: simSameSupervisor ? "sim-target" : null,
      };
      targetObj = {
        id: "sim-target",
        name: `Sample ${targetMeta.shortName}`,
        email: "target@penedge.com",
        roleKey: targetMeta.key,
        roleName: targetMeta.name,
        region: simTargetRegion,
        assignedRegions: [simTargetRegion],
        reportsToId: null,
        initials: targetMeta.shortName.slice(0, 2),
        status: "online",
      };
    }

    const visibility = canUserSeeContact(callerObj, targetObj, settings);
    const voiceCall = canUserCallTarget(callerObj, targetObj, "audio", settings, false);
    const videoCall = canUserCallTarget(callerObj, targetObj, "video", settings, false);
    const sendMsg = canUserSendMessage(callerObj, null, targetObj, settings);
    const recvMsg = canUserReceiveMessages(targetObj, settings);
    const recvCall = canUserReceiveCalls(targetObj, settings);

    return {
      callerObj,
      targetObj,
      visibility,
      voiceCall,
      videoCall,
      sendMsg,
      recvMsg,
      recvCall,
    };
  }, [
    simMode,
    simCallerRole,
    simCallerRegion,
    simTargetRole,
    simTargetRegion,
    simSameSupervisor,
    simCallerUserId,
    simTargetUserId,
    directoryUsers,
    settings,
  ]);

  const filteredDirectoryForOverrides = useMemo(() => {
    const q = userSearchQuery.trim().toLowerCase();
    return directoryUsers.filter((u) => {
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.roleName.toLowerCase().includes(q) ||
        u.region.toLowerCase().includes(q)
      );
    });
  }, [directoryUsers, userSearchQuery]);

  const showSection = (tab: SettingsSectionTab) => activeSubTab === "all" || activeSubTab === tab;

  return (
    <div className="settings-section-content" style={{ padding: "0 0 40px 0" }}>
      {/* ── Page Header & Save Status ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
              <MessageSquare size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 700, color: "#0f172a" }}>
                Communications &amp; Calling Settings
              </h2>
              <p style={{ margin: "2px 0 0 0", fontSize: "0.85rem", color: "#64748b" }}>
                Enterprise governance for who can call who, regional contact visibility, role messaging permissions, and field compliance.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {saveStatus === "saved" && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                fontWeight: 600,
                color: "#059669",
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                padding: "6px 12px",
                borderRadius: 20,
              }}
            >
              <Check size={14} /> Saved &amp; Synced Live
            </span>
          )}
          <button
            type="button"
            onClick={handleResetDefaults}
            className="btn-ghost-sm"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              cursor: "pointer",
            }}
          >
            <RotateCcw size={13} /> Reset to Defaults
          </button>
        </div>
      </div>

      {/* ── Security / Admin Access Banner ── */}
      <div
        style={{
          background: "linear-gradient(135deg, #0f172a, #1e293b)",
          color: "#ffffff",
          borderRadius: 14,
          padding: "16px 20px",
          marginBottom: 18,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "rgba(16, 185, 129, 0.2)",
              color: "#34d399",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid rgba(52, 211, 153, 0.3)",
            }}
          >
            <Lock size={18} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <strong style={{ fontSize: 14, color: "#f8fafc" }}>Administrator Communications Guard</strong>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  background: "#059669",
                  color: "#ffffff",
                  padding: "2px 8px",
                  borderRadius: 12,
                }}
              >
                Live Enforcement Active
              </span>
            </div>
            <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "#94a3b8" }}>
              All call routing rules, regional contact filters, and send/receive permissions are enforced immediately across all connected devices.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: "#cbd5e1" }}>Master System State:</span>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => updateSetting("enabled", e.target.checked)}
              style={{ width: 18, height: 18, accentColor: "#059669", cursor: "pointer" }}
            />
            <strong style={{ fontSize: 13, color: settings.enabled ? "#34d399" : "#f87171" }}>
              {settings.enabled ? "Active for Organization" : "Disabled Globally"}
            </strong>
          </label>
        </div>
      </div>

      {/* ── Quick Domain Filter Navigation Bar ── */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 22,
          padding: "8px 10px",
          background: "#f8fafc",
          borderRadius: 12,
          border: "1px solid #e2e8f0",
        }}
      >
        {[
          { id: "all", label: "All Settings", icon: Sliders },
          { id: "visibility_and_regions", label: "Region & Contact Visibility", icon: Globe },
          { id: "who_can_call_who", label: "Who Can Call Who Matrix", icon: Phone },
          { id: "role_and_user_permissions", label: "Call / Send / Receive Permissions", icon: Shield },
          { id: "simulator", label: "Live Policy Simulator", icon: Eye },
          { id: "media_and_compliance", label: "Quiet Hours, Media & Audio", icon: Clock },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id as SettingsSectionTab)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 13px",
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 600,
                border: isActive ? "1px solid #059669" : "1px solid transparent",
                background: isActive ? "#059669" : "transparent",
                color: isActive ? "#ffffff" : "#475569",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION A: HOW USERS SEE WHO TO CALL (REGIONAL VS ALL-REGION VISIBILITY) */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {showSection("visibility_and_regions") && (
        <div
          style={{
            background: "#ffffff",
            borderRadius: 14,
            border: "1px solid #e2e8f0",
            padding: 20,
            marginBottom: 20,
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: "#eff6ff",
                  color: "#2563eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Globe size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#0f172a" }}>
                  Directory &amp; Regional Contact Visibility (&ldquo;How Users See Who to Call&rdquo;)
                </h3>
                <p style={{ margin: "2px 0 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                  Determine whether staff see callable contacts only from their assigned region(s), across all regions, or strictly within their reporting line.
                </p>
              </div>
            </div>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: 20,
                background: "#eff6ff",
                color: "#1d4ed8",
                border: "1px solid #bfdbfe",
              }}
            >
              Active Scope:{" "}
              {settings.directoryVisibilityMode === "all_regions"
                ? "All Regions (National)"
                : settings.directoryVisibilityMode === "same_region_only"
                ? "Only User's Assigned Region(s)"
                : settings.directoryVisibilityMode === "reporting_line_only"
                ? "Direct Reporting Line Only"
                : "Role-Tiered (National vs Regional)"}
            </span>
          </div>

          {/* 4 Global Visibility Scope Mode Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 12,
              marginBottom: 18,
            }}
          >
            {[
              {
                mode: "role_tiered" as DirectoryVisibilityMode,
                title: "Role-Tiered Visibility (Recommended)",
                badge: "Enterprise Default",
                desc: "Admin, HR & NSM see all regions nationwide. RSMs, SEs, BAs & VSRs see only staff in their assigned region(s).",
              },
              {
                mode: "same_region_only" as DirectoryVisibilityMode,
                title: "Only Their Assigned Region(s)",
                badge: "Strict Territory Scope",
                desc: "Users only see and call staff members assigned to the same geographical region(s) as themselves.",
              },
              {
                mode: "all_regions" as DirectoryVisibilityMode,
                title: "All Regions (Open Directory)",
                badge: "Company-Wide",
                desc: "All staff members can view and search the complete national directory across every region.",
              },
              {
                mode: "reporting_line_only" as DirectoryVisibilityMode,
                title: "Reporting Line & Immediate Peers",
                badge: "Strict Hierarchy",
                desc: "Users only see their direct supervisor (Reports To), direct subordinates, and same-region role peers.",
              },
            ].map((card) => {
              const selected = settings.directoryVisibilityMode === card.mode;
              return (
                <div
                  key={card.mode}
                  onClick={() => updateSetting("directoryVisibilityMode", card.mode)}
                  style={{
                    padding: "14px 16px",
                    borderRadius: 12,
                    border: selected ? "2px solid #2563eb" : "1px solid #e2e8f0",
                    background: selected ? "#eff6ff" : "#f8fafc",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: 8,
                    transition: "all 0.15s ease",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 6 }}>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: "2px 7px",
                          borderRadius: 10,
                          background: selected ? "#2563eb" : "#e2e8f0",
                          color: selected ? "#ffffff" : "#475569",
                        }}
                      >
                        {card.badge}
                      </span>
                      <input
                        type="radio"
                        checked={selected}
                        onChange={() => updateSetting("directoryVisibilityMode", card.mode)}
                        style={{ width: 16, height: 16, accentColor: "#2563eb", cursor: "pointer" }}
                      />
                    </div>
                    <strong style={{ fontSize: 13.5, color: "#0f172a", display: "block", marginBottom: 4 }}>
                      {card.title}
                    </strong>
                    <p style={{ margin: 0, fontSize: 12, color: "#475569", lineHeight: 1.45 }}>
                      {card.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Visibility Rules & Exceptions Toggles */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 12,
            }}
          >
            <label
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                cursor: "pointer",
              }}
            >
              <div>
                <strong style={{ fontSize: 12.5, color: "#1e293b", display: "block" }}>
                  Always Show National Leadership (Admin, HR, NSM)
                </strong>
                <span style={{ fontSize: 11.5, color: "#64748b" }}>
                  Ensures regional reps can always see HQ support &amp; HR even in &ldquo;Only Their Region&rdquo; mode.
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.alwaysShowNationalLeadership}
                onChange={(e) => updateSetting("alwaysShowNationalLeadership", e.target.checked)}
                style={{ width: 18, height: 18, accentColor: "#059669", flexShrink: 0 }}
              />
            </label>

            <label
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                cursor: "pointer",
              }}
            >
              <div>
                <strong style={{ fontSize: 12.5, color: "#1e293b", display: "block" }}>
                  Always Show Direct Supervisor &amp; Reports
                </strong>
                <span style={{ fontSize: 11.5, color: "#64748b" }}>
                  Staff always see their assigned manager (<code>reports_to</code>) regardless of region.
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.alwaysShowDirectSupervisor}
                onChange={(e) => updateSetting("alwaysShowDirectSupervisor", e.target.checked)}
                style={{ width: 18, height: 18, accentColor: "#059669", flexShrink: 0 }}
              />
            </label>

            <label
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                cursor: "pointer",
              }}
            >
              <div>
                <strong style={{ fontSize: 12.5, color: "#1e293b", display: "block" }}>
                  Filter Territory Hub Channels by User Region
                </strong>
                <span style={{ fontSize: 11.5, color: "#64748b" }}>
                  When enabled, non-national staff only see Territory Hub channels for their own region(s).
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.restrictTerritoryHubsToRegion}
                onChange={(e) => updateSetting("restrictTerritoryHubsToRegion", e.target.checked)}
                style={{ width: 18, height: 18, accentColor: "#059669", flexShrink: 0 }}
              />
            </label>

            <label
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                cursor: "pointer",
              }}
            >
              <div>
                <strong style={{ fontSize: 12.5, color: "#1e293b", display: "block" }}>
                  Show Offline Staff in Call Directory
                </strong>
                <span style={{ fontSize: 11.5, color: "#64748b" }}>
                  Allow users to see and message staff who are currently offline or away.
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.showOfflineUsersInDirectory}
                onChange={(e) => updateSetting("showOfflineUsersInDirectory", e.target.checked)}
                style={{ width: 18, height: 18, accentColor: "#059669", flexShrink: 0 }}
              />
            </label>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION B: WHO CAN CALL WHO (ROUTING POLICY & ROLE-TO-ROLE CALL MATRIX) */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {showSection("who_can_call_who") && (
        <div
          style={{
            background: "#ffffff",
            borderRadius: 14,
            border: "1px solid #e2e8f0",
            padding: 20,
            marginBottom: 20,
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: "#ecfdf5",
                  color: "#059669",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Phone size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#0f172a" }}>
                  Who Can Call Who — Call Routing Policy &amp; Role Matrix
                </h3>
                <p style={{ margin: "2px 0 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                  Define exactly which organizational roles can initiate voice or video calls to other roles, plus regional &amp; supervisory constraints.
                </p>
              </div>
            </div>
          </div>

          {/* Calling Routing Policy Selector */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 8 }}>
              1. Global Call Routing Enforcement Policy:
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10 }}>
              {[
                {
                  key: "matrix_controlled" as CallingRoutingPolicy,
                  title: "Role-to-Role Matrix Policy",
                  desc: "Enforces the interactive Caller → Receiver matrix below alongside the caller's region visibility.",
                },
                {
                  key: "hierarchy_and_region" as CallingRoutingPolicy,
                  title: "Same Region & Reporting Chain",
                  desc: "Users can only call contacts in their own assigned region or direct reporting line (plus HQ).",
                },
                {
                  key: "management_initiated" as CallingRoutingPolicy,
                  title: "Management-Initiated Only",
                  desc: "Only Management (Admin/HR/NSM/RSM/SE) can initiate calls; BAs & VSRs can only call their direct supervisor.",
                },
                {
                  key: "open_directory" as CallingRoutingPolicy,
                  title: "Open Directory Calling",
                  desc: "Anyone with calling enabled for their role can call any visible staff member.",
                },
              ].map((pol) => {
                const active = settings.callingRoutingPolicy === pol.key;
                return (
                  <div
                    key={pol.key}
                    onClick={() => updateSetting("callingRoutingPolicy", pol.key)}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 10,
                      border: active ? "2px solid #059669" : "1px solid #e2e8f0",
                      background: active ? "#ecfdf5" : "#f8fafc",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <strong style={{ fontSize: 13, color: "#0f172a" }}>{pol.title}</strong>
                      <input
                        type="radio"
                        checked={active}
                        onChange={() => updateSetting("callingRoutingPolicy", pol.key)}
                        style={{ accentColor: "#059669" }}
                      />
                    </div>
                    <p style={{ margin: 0, fontSize: 11.5, color: "#475569", lineHeight: 1.4 }}>{pol.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Preset Matrix Buttons */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
              <label style={{ fontSize: 12.5, fontWeight: 700, color: "#334155" }}>
                2. Interactive &ldquo;Who Can Call Who&rdquo; Role-to-Role Matrix (Click any cell to toggle):
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11.5, color: "#64748b", fontWeight: 600 }}>Quick Presets:</span>
                {(
                  Object.keys(CALL_MATRIX_PRESETS) as Array<keyof typeof CALL_MATRIX_PRESETS>
                ).map((presetKey) => (
                  <button
                    key={presetKey}
                    type="button"
                    onClick={() => handleApplyMatrixPreset(presetKey)}
                    title={CALL_MATRIX_PRESETS[presetKey].description}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      color: "#334155",
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {CALL_MATRIX_PRESETS[presetKey].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Role-to-Role Matrix Table */}
            <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720, fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th
                      style={{
                        padding: "10px 14px",
                        textAlign: "left",
                        fontWeight: 700,
                        color: "#0f172a",
                        borderRight: "1px solid #e2e8f0",
                        minWidth: 190,
                      }}
                    >
                      Caller Role (Initiator) ↓ &nbsp;/&nbsp; Target →
                    </th>
                    {COMM_ROLE_CATALOG.map((targetRole) => (
                      <th
                        key={targetRole.key}
                        style={{
                          padding: "10px 8px",
                          textAlign: "center",
                          fontWeight: 700,
                          color: "#334155",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 7px",
                            borderRadius: 6,
                            background: targetRole.bg,
                            color: targetRole.color,
                            fontSize: 11,
                          }}
                        >
                          {targetRole.shortName}
                        </span>
                      </th>
                    ))}
                    <th style={{ padding: "10px 10px", textAlign: "center", fontWeight: 700, color: "#64748b" }}>
                      Row Quick Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMM_ROLE_CATALOG.map((callerRole) => {
                    const allowedTargets = settings.whoCanCallWhoMatrix?.[callerRole.key] || [];
                    const allSelected = COMM_ROLE_CATALOG.every((r) => allowedTargets.includes(r.key));
                    return (
                      <tr key={callerRole.key} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td
                          style={{
                            padding: "10px 14px",
                            borderRight: "1px solid #e2e8f0",
                            background: "#fcfcfd",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span
                              style={{
                                padding: "2px 7px",
                                borderRadius: 6,
                                background: callerRole.bg,
                                color: callerRole.color,
                                fontWeight: 700,
                                fontSize: 11,
                                minWidth: 42,
                                textAlign: "center",
                              }}
                            >
                              {callerRole.shortName}
                            </span>
                            <strong style={{ color: "#1e293b", fontSize: 12.5 }}>{callerRole.name}</strong>
                          </div>
                        </td>

                        {COMM_ROLE_CATALOG.map((receiverRole) => {
                          const isAllowed = allowedTargets.includes(receiverRole.key);
                          return (
                            <td key={receiverRole.key} style={{ padding: "8px 6px", textAlign: "center" }}>
                              <button
                                type="button"
                                onClick={() => handleToggleCallMatrixCell(callerRole.key, receiverRole.key)}
                                title={`${callerRole.name} → ${receiverRole.name}: ${
                                  isAllowed ? "Allowed (Click to Block)" : "Blocked (Click to Allow)"
                                }`}
                                style={{
                                  width: "100%",
                                  maxWidth: 74,
                                  padding: "5px 6px",
                                  borderRadius: 7,
                                  border: isAllowed ? "1px solid #a7f3d0" : "1px solid #fecdd3",
                                  background: isAllowed ? "#ecfdf5" : "#fff1f2",
                                  color: isAllowed ? "#047857" : "#be123c",
                                  fontWeight: 700,
                                  fontSize: 11,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 3,
                                }}
                              >
                                {isAllowed ? "✓ Call" : "✕ Block"}
                              </button>
                            </td>
                          );
                        })}

                        <td style={{ padding: "8px 10px", textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={() => handleSetRowAllMatrix(callerRole.key, !allSelected)}
                            style={{
                              padding: "4px 9px",
                              borderRadius: 6,
                              border: "1px solid #cbd5e1",
                              background: "#f8fafc",
                              color: "#334155",
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            {allSelected ? "Clear All" : "Allow All"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sub-options for Calling */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 12,
              marginTop: 14,
            }}
          >
            <label
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                cursor: "pointer",
              }}
            >
              <div>
                <strong style={{ fontSize: 12.5, color: "#1e293b", display: "block" }}>
                  Management Cross-Region Calling
                </strong>
                <span style={{ fontSize: 11.5, color: "#64748b" }}>
                  Allow RSMs &amp; SEs to call staff across other regions when visible.
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.allowCrossRegionCallsForManagement}
                onChange={(e) => updateSetting("allowCrossRegionCallsForManagement", e.target.checked)}
                style={{ width: 18, height: 18, accentColor: "#059669" }}
              />
            </label>

            <label
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                cursor: "pointer",
              }}
            >
              <div>
                <strong style={{ fontSize: 12.5, color: "#1e293b", display: "block" }}>
                  Allow Group Channel Huddles
                </strong>
                <span style={{ fontSize: 11.5, color: "#64748b" }}>
                  Enable audio/video huddles inside Territory Hubs &amp; Bulletins.
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.allowChannelHuddles}
                onChange={(e) => updateSetting("allowChannelHuddles", e.target.checked)}
                style={{ width: 18, height: 18, accentColor: "#059669" }}
              />
            </label>

            <label
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                cursor: "pointer",
              }}
            >
              <div>
                <strong style={{ fontSize: 12.5, color: "#1e293b", display: "block" }}>
                  Auto-Record Call Logs in Chat
                </strong>
                <span style={{ fontSize: 11.5, color: "#64748b" }}>
                  Automatically post call duration &amp; missed call entries in chat.
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.recordCallLogsInChat}
                onChange={(e) => updateSetting("recordCallLogsInChat", e.target.checked)}
                style={{ width: 18, height: 18, accentColor: "#059669" }}
              />
            </label>

            <div
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>
                Max Call Duration Limit
              </label>
              <select
                value={settings.maxCallDurationMins || 0}
                onChange={(e) => updateSetting("maxCallDurationMins", Number(e.target.value))}
                style={{
                  width: "100%",
                  height: 34,
                  borderRadius: 7,
                  border: "1px solid #cbd5e1",
                  padding: "0 10px",
                  fontSize: 12.5,
                  background: "#ffffff",
                }}
              >
                <option value={0}>Unlimited Duration</option>
                <option value={10}>10 Minutes Max (Quick Standup)</option>
                <option value={15}>15 Minutes Max</option>
                <option value={30}>30 Minutes Max</option>
                <option value={60}>60 Minutes Max</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION C: WHO CAN CALL, SEND & RECEIVE MESSAGES (ROLE & USER MATRIX)   */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {showSection("role_and_user_permissions") && (
        <div
          style={{
            background: "#ffffff",
            borderRadius: 14,
            border: "1px solid #e2e8f0",
            padding: 20,
            marginBottom: 20,
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: "#fef3c7",
                color: "#d97706",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Shield size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#0f172a" }}>
                Role &amp; Staff Permissions — Who Can Call, Send &amp; Receive Messages
              </h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                Granular control per role and per individual staff account over voice calling, video calling, sending/receiving messages, and region visibility.
              </p>
            </div>
          </div>

          {/* Role Permission Matrix Table */}
          <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 12, marginBottom: 22 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860, fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "11px 14px", textAlign: "left", fontWeight: 700, color: "#0f172a" }}>
                    Organization Role
                  </th>
                  <th style={{ padding: "11px 8px", textAlign: "center", fontWeight: 700, color: "#334155" }}>
                    Place Voice Calls
                  </th>
                  <th style={{ padding: "11px 8px", textAlign: "center", fontWeight: 700, color: "#334155" }}>
                    Place Video Calls
                  </th>
                  <th style={{ padding: "11px 8px", textAlign: "center", fontWeight: 700, color: "#334155" }}>
                    Receive Calls
                  </th>
                  <th style={{ padding: "11px 8px", textAlign: "center", fontWeight: 700, color: "#334155" }}>
                    Send Messages
                  </th>
                  <th style={{ padding: "11px 8px", textAlign: "center", fontWeight: 700, color: "#334155" }}>
                    Receive Messages
                  </th>
                  <th style={{ padding: "11px 8px", textAlign: "center", fontWeight: 700, color: "#334155" }}>
                    Send Media/Files
                  </th>
                  <th style={{ padding: "11px 8px", textAlign: "center", fontWeight: 700, color: "#334155" }}>
                    Start Huddles
                  </th>
                  <th style={{ padding: "11px 8px", textAlign: "center", fontWeight: 700, color: "#334155" }}>
                    Broadcast
                  </th>
                  <th style={{ padding: "11px 12px", textAlign: "left", fontWeight: 700, color: "#334155", minWidth: 175 }}>
                    Who They See (Region Scope)
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMM_ROLE_CATALOG.map((roleMeta) => {
                  const perm = settings.rolePermissions?.[roleMeta.key];
                  if (!perm) return null;
                  return (
                    <tr key={roleMeta.key} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span
                            style={{
                              padding: "2px 7px",
                              borderRadius: 6,
                              background: roleMeta.bg,
                              color: roleMeta.color,
                              fontWeight: 700,
                              fontSize: 11,
                              minWidth: 42,
                              textAlign: "center",
                            }}
                          >
                            {roleMeta.shortName}
                          </span>
                          <div>
                            <strong style={{ color: "#0f172a", display: "block", fontSize: 12.5 }}>
                              {roleMeta.name}
                            </strong>
                            <span style={{ fontSize: 10.5, color: "#64748b", textTransform: "capitalize" }}>
                              {roleMeta.tier} Tier
                            </span>
                          </div>
                        </div>
                      </td>

                      {(
                        [
                          "canInitiateVoiceCalls",
                          "canInitiateVideoCalls",
                          "canReceiveCalls",
                          "canSendMessages",
                          "canReceiveMessages",
                          "canSendAttachments",
                          "canStartGroupHuddles",
                          "canBroadcast",
                        ] as const
                      ).map((fieldKey) => {
                        const checked = Boolean(perm[fieldKey]);
                        return (
                          <td key={fieldKey} style={{ padding: "10px 8px", textAlign: "center" }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                handleUpdateRolePermission(roleMeta.key, fieldKey, e.target.checked)
                              }
                              style={{
                                width: 17,
                                height: 17,
                                accentColor: "#059669",
                                cursor: "pointer",
                              }}
                            />
                          </td>
                        );
                      })}

                      <td style={{ padding: "10px 12px" }}>
                        <select
                          value={perm.directoryScopeOverride || "inherit"}
                          onChange={(e) =>
                            handleUpdateRolePermission(
                              roleMeta.key,
                              "directoryScopeOverride",
                              e.target.value as RoleCommunicationPermission["directoryScopeOverride"],
                            )
                          }
                          style={{
                            width: "100%",
                            height: 32,
                            borderRadius: 7,
                            border: "1px solid #cbd5e1",
                            padding: "0 8px",
                            fontSize: 11.5,
                            fontWeight: 600,
                            background:
                              perm.directoryScopeOverride === "all_regions"
                                ? "#eff6ff"
                                : perm.directoryScopeOverride === "same_region_only"
                                ? "#ecfdf5"
                                : "#ffffff",
                            color: "#0f172a",
                          }}
                        >
                          <option value="inherit">Follow Global Policy</option>
                          <option value="all_regions">All Regions (National)</option>
                          <option value="same_region_only">Only Their Region(s)</option>
                          <option value="reporting_line_only">Reporting Line Only</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Individual Staff Member Overrides Sub-Panel */}
          <div
            style={{
              background: "#f8fafc",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              padding: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <UserCheck size={16} color="#059669" />
                <strong style={{ fontSize: 13.5, color: "#0f172a" }}>
                  Individual Staff Communication Overrides (Per-User Exceptions)
                </strong>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 10,
                    background: "#ecfdf5",
                    color: "#047857",
                    border: "1px solid #a7f3d0",
                  }}
                >
                  {Object.keys(settings.userOverrides || {}).length} Active Overrides
                </span>
              </div>
              <span style={{ fontSize: 11.5, color: "#64748b" }}>
                Grant special cross-region calling or mute/restrict specific users without changing their role.
              </span>
            </div>

            {/* Add Override Row */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              <div style={{ position: "relative", minWidth: 200 }}>
                <Search
                  size={13}
                  style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}
                />
                <input
                  type="text"
                  placeholder="Filter staff list…"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  style={{
                    height: 36,
                    padding: "0 10px 0 30px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 12.5,
                    background: "#ffffff",
                    width: 190,
                  }}
                />
              </div>

              <select
                value={selectedOverrideUserId}
                onChange={(e) => setSelectedOverrideUserId(e.target.value)}
                style={{
                  height: 36,
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  padding: "0 10px",
                  fontSize: 12.5,
                  background: "#ffffff",
                  flex: 1,
                  minWidth: 240,
                }}
              >
                <option value="">Select a staff member to add an individual override…</option>
                {filteredDirectoryForOverrides.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.roleName} ({u.region})
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Optional reason/note (e.g. Regional Lead)"
                value={overrideNote}
                onChange={(e) => setOverrideNote(e.target.value)}
                style={{
                  height: 36,
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  padding: "0 10px",
                  fontSize: 12.5,
                  background: "#ffffff",
                  minWidth: 210,
                }}
              />

              <button
                type="button"
                disabled={!selectedOverrideUserId}
                onClick={handleAddUserOverride}
                style={{
                  height: 36,
                  padding: "0 14px",
                  borderRadius: 8,
                  border: "none",
                  background: selectedOverrideUserId ? "#059669" : "#cbd5e1",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: 12.5,
                  cursor: selectedOverrideUserId ? "pointer" : "not-allowed",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Plus size={14} /> Add User Rule
              </button>
            </div>

            {/* Active Overrides Table */}
            {Object.values(settings.userOverrides || {}).length === 0 ? (
              <div
                style={{
                  padding: "14px",
                  textAlign: "center",
                  background: "#ffffff",
                  borderRadius: 8,
                  border: "1px dashed #cbd5e1",
                  color: "#64748b",
                  fontSize: 12,
                }}
              >
                No individual user overrides configured. All staff currently follow their Role Permissions above.
              </div>
            ) : (
              <div style={{ overflowX: "auto", background: "#ffffff", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 720 }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #e2e8f0" }}>
                      <th style={{ padding: "8px 12px", textAlign: "left" }}>Staff Member</th>
                      <th style={{ padding: "8px 8px", textAlign: "left" }}>Outgoing Calls</th>
                      <th style={{ padding: "8px 8px", textAlign: "left" }}>Incoming Calls</th>
                      <th style={{ padding: "8px 8px", textAlign: "left" }}>Send Messages</th>
                      <th style={{ padding: "8px 8px", textAlign: "left" }}>Receive Messages</th>
                      <th style={{ padding: "8px 8px", textAlign: "left" }}>Region Visibility</th>
                      <th style={{ padding: "8px 8px", textAlign: "center" }}>Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(settings.userOverrides || {}).map((ov) => (
                      <tr key={ov.userId} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "8px 12px" }}>
                          <strong style={{ color: "#0f172a", display: "block" }}>{ov.userName}</strong>
                          <span style={{ fontSize: 11, color: "#64748b" }}>
                            {ov.roleKey} · {ov.region}
                            {ov.note ? ` · "${ov.note}"` : ""}
                          </span>
                        </td>
                        {(["canCall", "canReceiveCalls", "canSendMessages", "canReceiveMessages"] as const).map(
                          (field) => (
                            <td key={field} style={{ padding: "8px 8px" }}>
                              <select
                                value={ov[field]}
                                onChange={(e) =>
                                  handleUpdateUserOverrideField(
                                    ov.userId,
                                    field,
                                    e.target.value as "inherit" | "allow" | "deny",
                                  )
                                }
                                style={{
                                  height: 30,
                                  borderRadius: 6,
                                  border: "1px solid #cbd5e1",
                                  fontSize: 11.5,
                                  padding: "0 6px",
                                  background:
                                    ov[field] === "allow"
                                      ? "#ecfdf5"
                                      : ov[field] === "deny"
                                      ? "#fff1f2"
                                      : "#ffffff",
                                  color:
                                    ov[field] === "allow"
                                      ? "#047857"
                                      : ov[field] === "deny"
                                      ? "#be123c"
                                      : "#334155",
                                  fontWeight: 600,
                                }}
                              >
                                <option value="inherit">Role Default</option>
                                <option value="allow">✓ Always Allow</option>
                                <option value="deny">✕ Block / Mute</option>
                              </select>
                            </td>
                          ),
                        )}
                        <td style={{ padding: "8px 8px" }}>
                          <select
                            value={ov.directoryScope}
                            onChange={(e) =>
                              handleUpdateUserOverrideField(
                                ov.userId,
                                "directoryScope",
                                e.target.value as "inherit" | "all_regions" | "same_region_only",
                              )
                            }
                            style={{
                              height: 30,
                              borderRadius: 6,
                              border: "1px solid #cbd5e1",
                              fontSize: 11.5,
                              padding: "0 6px",
                              fontWeight: 600,
                            }}
                          >
                            <option value="inherit">Role Default</option>
                            <option value="all_regions">All Regions</option>
                            <option value="same_region_only">Only Their Region</option>
                          </select>
                        </td>
                        <td style={{ padding: "8px 8px", textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveUserOverride(ov.userId)}
                            style={{
                              border: "none",
                              background: "#fff1f2",
                              color: "#e11d48",
                              borderRadius: 6,
                              padding: "5px 8px",
                              cursor: "pointer",
                            }}
                            title="Remove override"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION D: LIVE POLICY SIMULATOR (TEST CALL & MESSAGE PERMISSIONS)      */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {showSection("simulator") && (
        <div
          style={{
            background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
            borderRadius: 14,
            border: "1px solid #cbd5e1",
            padding: 20,
            marginBottom: 20,
            boxShadow: "0 2px 6px rgba(15, 23, 42, 0.04)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: "#f0fdf4",
                  color: "#15803d",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid #bbf7d0",
                }}
              >
                <Eye size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#0f172a" }}>
                  Interactive Policy Simulator — Verify Who Can See, Call &amp; Message Who
                </h3>
                <p style={{ margin: "2px 0 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                  Test your current rules between any two roles, regions, or real staff accounts to preview exact behavior.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                onClick={() => setSimMode("roles")}
                style={{
                  padding: "5px 12px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  border: simMode === "roles" ? "1px solid #059669" : "1px solid #cbd5e1",
                  background: simMode === "roles" ? "#059669" : "#ffffff",
                  color: simMode === "roles" ? "#ffffff" : "#334155",
                  cursor: "pointer",
                }}
              >
                Simulate by Role &amp; Region
              </button>
              <button
                type="button"
                onClick={() => setSimMode("users")}
                style={{
                  padding: "5px 12px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  border: simMode === "users" ? "1px solid #059669" : "1px solid #cbd5e1",
                  background: simMode === "users" ? "#059669" : "#ffffff",
                  color: simMode === "users" ? "#ffffff" : "#334155",
                  cursor: "pointer",
                }}
              >
                Simulate Real Staff Members
              </button>
            </div>
          </div>

          {/* Simulator Inputs */}
          {simMode === "roles" ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 14,
                marginBottom: 16,
                padding: 14,
                background: "#ffffff",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
              }}
            >
              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                   Initiator (Caller / Sender Role)
                </label>
                <select
                  value={simCallerRole}
                  onChange={(e) => setSimCallerRole(e.target.value)}
                  style={{ width: "100%", height: 36, borderRadius: 8, border: "1px solid #cbd5e1", padding: "0 10px", fontSize: 12.5 }}
                >
                  {COMM_ROLE_CATALOG.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.name} ({r.shortName})
                    </option>
                  ))}
                </select>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#475569", marginTop: 8, marginBottom: 4 }}>
                  Initiator Region
                </label>
                <select
                  value={simCallerRegion}
                  onChange={(e) => setSimCallerRegion(e.target.value)}
                  style={{ width: "100%", height: 34, borderRadius: 8, border: "1px solid #cbd5e1", padding: "0 10px", fontSize: 12 }}
                >
                  {["Lekki", "Ikeja", "Victoria Island", "Edo Region", "Abuja Central", "Port Harcourt", "National"].map((reg) => (
                    <option key={reg} value={reg}>
                      {reg}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                  Target Recipient (Callee / Receiver Role)
                </label>
                <select
                  value={simTargetRole}
                  onChange={(e) => setSimTargetRole(e.target.value)}
                  style={{ width: "100%", height: 36, borderRadius: 8, border: "1px solid #cbd5e1", padding: "0 10px", fontSize: 12.5 }}
                >
                  {COMM_ROLE_CATALOG.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.name} ({r.shortName})
                    </option>
                  ))}
                </select>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#475569", marginTop: 8, marginBottom: 4 }}>
                  Recipient Region
                </label>
                <select
                  value={simTargetRegion}
                  onChange={(e) => setSimTargetRegion(e.target.value)}
                  style={{ width: "100%", height: 34, borderRadius: 8, border: "1px solid #cbd5e1", padding: "0 10px", fontSize: 12 }}
                >
                  {["Lekki", "Ikeja", "Victoria Island", "Edo Region", "Abuja Central", "Port Harcourt", "National"].map((reg) => (
                    <option key={reg} value={reg}>
                      {reg}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "10px 12px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <input
                    type="checkbox"
                    checked={simSameSupervisor}
                    onChange={(e) => setSimSameSupervisor(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: "#059669" }}
                  />
                  <div>
                    <strong style={{ fontSize: 12.5, color: "#1e293b", display: "block" }}>
                      Direct Reporting Line
                    </strong>
                    <span style={{ fontSize: 11, color: "#64748b" }}>
                      Simulate Target as Caller&apos;s direct manager (<code>reports_to</code>)
                    </span>
                  </div>
                </label>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 14,
                marginBottom: 16,
                padding: 14,
                background: "#ffffff",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
              }}
            >
              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                  Caller / Sender Staff Member
                </label>
                <select
                  value={simCallerUserId}
                  onChange={(e) => setSimCallerUserId(e.target.value)}
                  style={{ width: "100%", height: 36, borderRadius: 8, border: "1px solid #cbd5e1", padding: "0 10px", fontSize: 12.5 }}
                >
                  {directoryUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.roleName} · {u.region})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                  Target Recipient Staff Member
                </label>
                <select
                  value={simTargetUserId}
                  onChange={(e) => setSimTargetUserId(e.target.value)}
                  style={{ width: "100%", height: 36, borderRadius: 8, border: "1px solid #cbd5e1", padding: "0 10px", fontSize: 12.5 }}
                >
                  {directoryUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.roleName} · {u.region})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Simulation Diagnostic Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {[
              {
                label: "1. Directory Visibility",
                ok: simulationResult.visibility.visible,
                statusText: simulationResult.visibility.visible ? "Visible in Directory" : "Hidden from Directory",
                reason: simulationResult.visibility.reason,
              },
              {
                label: "2. Voice Call (Audio)",
                ok: simulationResult.voiceCall.allowed,
                statusText: simulationResult.voiceCall.allowed ? "Voice Call Allowed" : "Voice Call Blocked",
                reason: simulationResult.voiceCall.reason,
              },
              {
                label: "3. Video Call (WebRTC)",
                ok: simulationResult.videoCall.allowed,
                statusText: simulationResult.videoCall.allowed ? "Video Call Allowed" : "Video Call Blocked",
                reason: simulationResult.videoCall.reason,
              },
              {
                label: "4. Direct Messaging",
                ok: simulationResult.sendMsg.allowed,
                statusText: simulationResult.sendMsg.allowed ? "Can Send & Receive" : "Messaging Restricted",
                reason: simulationResult.sendMsg.reason,
              },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: item.ok ? "1px solid #a7f3d0" : "1px solid #fecdd3",
                  background: item.ok ? "#f0fdf4" : "#fff1f2",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>{item.label}</span>
                  {item.ok ? (
                    <CheckCircle2 size={15} color="#059669" />
                  ) : (
                    <Ban size={15} color="#e11d48" />
                  )}
                </div>
                <strong
                  style={{
                    display: "block",
                    fontSize: 13,
                    color: item.ok ? "#065f46" : "#9f1239",
                    marginBottom: 4,
                  }}
                >
                  {item.statusText}
                </strong>
                <span style={{ fontSize: 11.5, color: item.ok ? "#047857" : "#be123c", lineHeight: 1.35, display: "block" }}>
                  {item.reason}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION E: CALLING ENGINE, QUIET HOURS, MEDIA & COMPLIANCE              */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {showSection("media_and_compliance") && (
        <>
          {/* ── Calling Engine & Quiet Hours Governance ── */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 14,
              border: "1px solid #e2e8f0",
              padding: 20,
              marginBottom: 20,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "#ecfdf5",
                  color: "#059669",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Phone size={16} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#0f172a" }}>
                  Field Voice &amp; Video Calling Engine + Quiet Hours Schedule
                </h3>
                <p style={{ margin: "2px 0 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                  Configure global WebRTC switches, ringing timeouts, codec profiles, and off-hours calling protection.
                </p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginBottom: 14 }}>
              {/* Allow Voice Calls */}
              <div
                style={{
                  padding: "16px 18px",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  background: settings.allowVoiceCalls ? "#f8fafc" : "#fff1f2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 14,
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 6, background: "#ecfdf5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Phone size={14} color="#059669" />
                    </div>
                    <strong style={{ fontSize: 13.5, color: "#1e293b" }}>Master Voice Calling Switch</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
                    Permit authorized roles to place 1-on-1 audio calls and voice huddles.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.allowVoiceCalls}
                  onChange={(e) => updateSetting("allowVoiceCalls", e.target.checked)}
                  style={{ width: 19, height: 19, accentColor: "#059669", cursor: "pointer", flexShrink: 0 }}
                />
              </div>

              {/* Allow Video Calls */}
              <div
                style={{
                  padding: "16px 18px",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  background: settings.allowVideoCalls ? "#f8fafc" : "#fff1f2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 14,
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 6, background: "#f0f9ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Video size={14} color="#0284c7" />
                    </div>
                    <strong style={{ fontSize: 13.5, color: "#1e293b" }}>Master Video Calling Switch</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
                    Allow live camera video calls for retail shelf inspections, POS audits, and virtual standups.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.allowVideoCalls}
                  onChange={(e) => updateSetting("allowVideoCalls", e.target.checked)}
                  style={{ width: 19, height: 19, accentColor: "#059669", cursor: "pointer", flexShrink: 0 }}
                />
              </div>
            </div>

            {/* Call Quality & Timeouts */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, marginBottom: 14 }}>
              <div
                style={{
                  padding: "16px 18px",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                }}
              >
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                  Call Ringing Timeout Duration
                </label>
                <select
                  value={settings.callTimeoutSecs}
                  onChange={(e) => updateSetting("callTimeoutSecs", Number(e.target.value))}
                  style={{
                    width: "100%",
                    height: 38,
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    padding: "0 12px",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#0f172a",
                    background: "#ffffff",
                  }}
                >
                  <option value={15}>15 Seconds (Quick Disconnect)</option>
                  <option value={30}>30 Seconds (Standard Teams Default)</option>
                  <option value={45}>45 Seconds (Extended Field Ring)</option>
                  <option value={60}>60 Seconds (Maximum Patience)</option>
                </select>
              </div>

              <div
                style={{
                  padding: "16px 18px",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                }}
              >
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                  Bandwidth &amp; Audio Quality Profile
                </label>
                <select
                  value={settings.callAudioQuality}
                  onChange={(e) => updateSetting("callAudioQuality", e.target.value as any)}
                  style={{
                    width: "100%",
                    height: 38,
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    padding: "0 12px",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#0f172a",
                    background: "#ffffff",
                  }}
                >
                  <option value="standard">Standard Adaptive (Recommended for 4G LTE)</option>
                  <option value="low_bandwidth">Low Bandwidth (2G/3G Remote Trade Areas)</option>
                  <option value="high_definition">High Definition (HD Wideband Opus)</option>
                </select>
              </div>
            </div>

            {/* Quiet Hours / Do-Not-Disturb Window */}
            <div
              style={{
                padding: "16px 18px",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                background: settings.quietHoursEnabled ? "#fffbeb" : "#f8fafc",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Clock size={18} color="#d97706" />
                  <div>
                    <strong style={{ fontSize: 13.5, color: "#0f172a", display: "block" }}>
                      Off-Hours Calling Protection (Quiet Hours Window)
                    </strong>
                    <span style={{ fontSize: 12, color: "#64748b" }}>
                      Automatically restrict non-urgent field calls outside active operational business hours.
                    </span>
                  </div>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={settings.quietHoursEnabled}
                    onChange={(e) => updateSetting("quietHoursEnabled", e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: "#d97706" }}
                  />
                  <strong style={{ fontSize: 12.5, color: "#334155" }}>Enable Quiet Hours</strong>
                </label>
              </div>

              {settings.quietHoursEnabled && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: 12,
                    marginTop: 14,
                    paddingTop: 12,
                    borderTop: "1px solid #fde68a",
                  }}
                >
                  <div>
                    <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                      Quiet Hours Start Time
                    </label>
                    <input
                      type="time"
                      value={settings.quietHoursStart}
                      onChange={(e) => updateSetting("quietHoursStart", e.target.value)}
                      style={{ height: 34, padding: "0 10px", borderRadius: 7, border: "1px solid #cbd5e1", width: "100%", background: "#fff" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                      Quiet Hours End Time
                    </label>
                    <input
                      type="time"
                      value={settings.quietHoursEnd}
                      onChange={(e) => updateSetting("quietHoursEnd", e.target.value)}
                      style={{ height: 34, padding: "0 10px", borderRadius: 7, border: "1px solid #cbd5e1", width: "100%", background: "#fff" }}
                    />
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", paddingTop: 16 }}>
                    <input
                      type="checkbox"
                      checked={settings.allowUrgentBypassQuietHours}
                      onChange={(e) => updateSetting("allowUrgentBypassQuietHours", e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: "#059669" }}
                    />
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>
                      Allow Urgent / Executive Override
                    </span>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* ── Smart AI Chips, Attachments & Compliance Governance ── */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 14,
              border: "1px solid #e2e8f0",
              padding: 20,
              marginBottom: 20,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "#fef3c7",
                  color: "#d97706",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Sparkles size={16} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#0f172a" }}>
                  Smart Replies, Media Attachments &amp; Compliance Controls
                </h3>
                <p style={{ margin: "2px 0 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                  Configure voice notes, GPS pins, document/photo uploads, read receipts, and message deletion compliance.
                </p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 18 }}>
              <label
                style={{
                  padding: "14px 16px",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  cursor: "pointer",
                }}
              >
                <div>
                  <strong style={{ fontSize: 13, color: "#1e293b", display: "flex", alignItems: "center", gap: 6 }}>
                    <Sparkles size={14} color="#d97706" /> Smart Reply Chips
                  </strong>
                  <span style={{ fontSize: 11.5, color: "#64748b" }}>1-tap field response chips</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.allowSmartReplies}
                  onChange={(e) => updateSetting("allowSmartReplies", e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "#059669" }}
                />
              </label>

              <label
                style={{
                  padding: "14px 16px",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  cursor: "pointer",
                }}
              >
                <div>
                  <strong style={{ fontSize: 13, color: "#1e293b", display: "flex", alignItems: "center", gap: 6 }}>
                    <Mic size={14} color="#059669" /> Voice Note Memos
                  </strong>
                  <span style={{ fontSize: 11.5, color: "#64748b" }}>Push-to-talk audio notes</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.allowVoiceNotes}
                  onChange={(e) => updateSetting("allowVoiceNotes", e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "#059669" }}
                />
              </label>

              <label
                style={{
                  padding: "14px 16px",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  cursor: "pointer",
                }}
              >
                <div>
                  <strong style={{ fontSize: 13, color: "#1e293b", display: "flex", alignItems: "center", gap: 6 }}>
                    <MapPin size={14} color="#dc2626" /> GPS Location Pins
                  </strong>
                  <span style={{ fontSize: 11.5, color: "#64748b" }}>Share live trade coordinates</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.allowLocationSharing}
                  onChange={(e) => updateSetting("allowLocationSharing", e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "#059669" }}
                />
              </label>

              <label
                style={{
                  padding: "14px 16px",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  cursor: "pointer",
                }}
              >
                <div>
                  <strong style={{ fontSize: 13, color: "#1e293b", display: "flex", alignItems: "center", gap: 6 }}>
                    <FileText size={14} color="#2563eb" /> Document Uploads
                  </strong>
                  <span style={{ fontSize: 11.5, color: "#64748b" }}>Invoices, PDFs &amp; sheets</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.allowFileAttachments}
                  onChange={(e) => updateSetting("allowFileAttachments", e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "#059669" }}
                />
              </label>

              <label
                style={{
                  padding: "14px 16px",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  cursor: "pointer",
                }}
              >
                <div>
                  <strong style={{ fontSize: 13, color: "#1e293b", display: "flex", alignItems: "center", gap: 6 }}>
                    <ImageIcon size={14} color="#7c3aed" /> Store Photo Evidence
                  </strong>
                  <span style={{ fontSize: 11.5, color: "#64748b" }}>Shelf &amp; POS photo sharing</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.allowPhotoAttachments}
                  onChange={(e) => updateSetting("allowPhotoAttachments", e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "#059669" }}
                />
              </label>

              <label
                style={{
                  padding: "14px 16px",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  cursor: "pointer",
                }}
              >
                <div>
                  <strong style={{ fontSize: 13, color: "#1e293b", display: "flex", alignItems: "center", gap: 6 }}>
                    <Check size={14} color="#059669" /> Read Receipts
                  </strong>
                  <span style={{ fontSize: 11.5, color: "#64748b" }}>Show delivered/read ticks</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.readReceiptsEnabled}
                  onChange={(e) => updateSetting("readReceiptsEnabled", e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "#059669" }}
                />
              </label>
            </div>

            {/* Governance Selectors (Deletion Policy & Bulletin Posting) */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12, marginBottom: 18 }}>
              <div style={{ padding: 14, borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8fafc" }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                  Message &amp; Call Log Deletion Policy
                </label>
                <select
                  value={settings.messageDeletionPolicy}
                  onChange={(e) => updateSetting("messageDeletionPolicy", e.target.value as any)}
                  style={{ width: "100%", height: 36, borderRadius: 8, border: "1px solid #cbd5e1", padding: "0 10px", fontSize: 12.5, background: "#fff" }}
                >
                  <option value="sender_and_admin">Sender &amp; Administrator Only (Recommended)</option>
                  <option value="admin_only">Administrator Only (Strict Audit Compliance)</option>
                  <option value="everyone">All Participants</option>
                </select>
              </div>

              <div style={{ padding: 14, borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8fafc" }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                  All-Hands Bulletin Channel Posting Policy
                </label>
                <select
                  value={settings.announcementPostingPolicy}
                  onChange={(e) => updateSetting("announcementPostingPolicy", e.target.value as any)}
                  style={{ width: "100%", height: 36, borderRadius: 8, border: "1px solid #cbd5e1", padding: "0 10px", fontSize: 12.5, background: "#fff" }}
                >
                  <option value="broadcast_roles_only">Authorized Broadcast Roles Only</option>
                  <option value="management_only">Management Roles Only (Admin/HR/NSM/RSM/SE)</option>
                  <option value="everyone">All Staff Members</option>
                </select>
              </div>
            </div>

            {/* Smart Replies Chip Manager */}
            {settings.allowSmartReplies && (
              <div
                style={{
                  background: "#f8fafc",
                  borderRadius: 10,
                  padding: "18px 20px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <strong style={{ fontSize: 13, color: "#0f172a" }}>Active Smart Reply Presets</strong>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#059669", background: "#ecfdf5", border: "1px solid #a7f3d0", padding: "1px 7px", borderRadius: 12 }}>
                      {settings.smartRepliesList.length} Chips Configured
                    </span>
                  </div>
                  <small style={{ color: "#64748b", fontSize: 11 }}>Click &times; on any chip to remove</small>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                  {settings.smartRepliesList.map((chip) => (
                    <span
                      key={chip}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "5px 12px",
                        borderRadius: 20,
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: "#334155",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                      }}
                    >
                      {chip}
                      <button
                        type="button"
                        onClick={() => handleRemoveChip(chip)}
                        style={{
                          border: "none",
                          background: "#f1f5f9",
                          color: "#64748b",
                          cursor: "pointer",
                          padding: "0 4px",
                          borderRadius: 10,
                          fontSize: 13,
                          lineHeight: "16px",
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        title="Remove chip"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 10, maxWidth: 640 }}>
                  <div style={{ position: "relative", flex: 1 }}>
                    <input
                      type="text"
                      placeholder="Add custom smart reply chip (e.g. Price approved 💰)…"
                      value={newChipText}
                      onChange={(e) => setNewChipText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddChip();
                        }
                      }}
                      style={{
                        width: "100%",
                        height: 38,
                        borderRadius: 8,
                        border: "1px solid #cbd5e1",
                        padding: "0 12px",
                        fontSize: 13,
                        background: "#ffffff",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddChip}
                    style={{
                      height: 38,
                      padding: "0 16px",
                      borderRadius: 8,
                      background: "#059669",
                      color: "#ffffff",
                      border: "none",
                      fontWeight: 600,
                      fontSize: 12.5,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      flexShrink: 0,
                    }}
                  >
                    <Plus size={15} /> Add Preset
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Executive Broadcast Directives & Retention ── */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 14,
              border: "1px solid #e2e8f0",
              padding: 20,
              marginBottom: 20,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "#fee2e2",
                  color: "#dc2626",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Radio size={16} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#0f172a" }}>
                  Push Notification Directives, Retention &amp; History Cleanup
                </h3>
                <p style={{ margin: "2px 0 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                  Control which roles can broadcast high-priority alerts and manage message/call retention.
                </p>
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 8 }}>
                Roles Authorized to Broadcast Urgent Directives:
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10 }}>
                {COMM_ROLE_CATALOG.map((role) => {
                  const isChecked = settings.broadcastRolesAllowed.includes(role.key);
                  return (
                    <label
                      key={role.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 14px",
                        borderRadius: 8,
                        border: `1px solid ${isChecked ? "#a7f3d0" : "#e2e8f0"}`,
                        background: isChecked ? "#ecfdf5" : "#ffffff",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleBroadcastRole(role.key)}
                        style={{ width: 16, height: 16, accentColor: "#059669", cursor: "pointer" }}
                      />
                      <div>
                        <strong style={{ fontSize: 13, color: isChecked ? "#065f46" : "#334155" }}>
                          {role.name}
                        </strong>
                        <span style={{ fontSize: 11, color: "#64748b", display: "block" }}>
                          Role Key: <code>{role.key}</code>
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
              <div
                style={{
                  padding: 14,
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                }}
              >
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                  Push Toast Auto-Dismiss Timer
                </label>
                <select
                  value={settings.autoDismissToastSecs}
                  onChange={(e) => updateSetting("autoDismissToastSecs", Number(e.target.value))}
                  style={{
                    width: "100%",
                    height: 38,
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    padding: "0 10px",
                    fontSize: 13,
                    background: "#ffffff",
                    cursor: "pointer",
                  }}
                >
                  <option value={5}>5 Seconds (Brief Alert)</option>
                  <option value={7}>7 Seconds (Standard Default)</option>
                  <option value={10}>10 Seconds (High Visibility)</option>
                  <option value={15}>15 Seconds (Extended Duration)</option>
                  <option value={0}>Persistent (Manual Dismiss Only)</option>
                </select>
              </div>

              <div
                style={{
                  padding: 14,
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                }}
              >
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                  Chat History &amp; Media Retention
                </label>
                <select
                  value={settings.retentionDays}
                  onChange={(e) => updateSetting("retentionDays", Number(e.target.value))}
                  style={{
                    width: "100%",
                    height: 38,
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    padding: "0 10px",
                    fontSize: 13,
                    background: "#ffffff",
                    cursor: "pointer",
                  }}
                >
                  <option value={30}>30 Days (Strict Compliance)</option>
                  <option value={90}>90 Days (Quarterly Audit Trail)</option>
                  <option value={180}>180 Days (Half Year)</option>
                  <option value={365}>365 Days (Full Fiscal Year)</option>
                  <option value={9999}>Indefinite (Keep All History)</option>
                </select>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("Clear all voice and video call logs across all conversations?")) {
                        clearAllCallLogs();
                        triggerSavedBadge();
                      }
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "1px solid #fde68a",
                      background: "#fffbeb",
                      color: "#b45309",
                      cursor: "pointer",
                    }}
                  >
                    <Phone size={13} /> Clear All Call Logs
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          "Clear ALL messages and call logs across all conversations? Channels and contacts will remain intact.",
                        )
                      ) {
                        clearAllMessagesAndCalls();
                        triggerSavedBadge();
                      }
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "1px solid #fecdd3",
                      background: "#fff1f2",
                      color: "#e11d48",
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={13} /> Clear All Messages &amp; Calls
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Interactive Web Audio Synthesizer Testing ── */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 14,
              border: "1px solid #e2e8f0",
              padding: 20,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "#e0e7ff",
                  color: "#4f46e5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Volume2 size={16} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#0f172a" }}>
                  Audio Synthesizer Sandbox &amp; Sound Diagnostics
                </h3>
                <p style={{ margin: "2px 0 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                  Preview real-time call ringtones, message alerts, and urgent chime frequencies generated via Web Audio API.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={settings.soundAlertsEnabled}
                  onChange={(e) => updateSetting("soundAlertsEnabled", e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "#059669", cursor: "pointer" }}
                />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
                  Enable Sound Alerts Globally
                </span>
              </label>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <button
                type="button"
                onClick={previewTestRingtone}
                disabled={!settings.soundAlertsEnabled}
                style={{
                  height: 38,
                  padding: "0 16px",
                  borderRadius: 8,
                  background: "#059669",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: settings.soundAlertsEnabled ? "pointer" : "not-allowed",
                  opacity: settings.soundAlertsEnabled ? 1 : 0.5,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Phone size={14} /> Preview Calling Ringtone (2s)
              </button>

              <button
                type="button"
                onClick={() => playMessageNotificationSound(true)}
                disabled={!settings.soundAlertsEnabled}
                style={{
                  height: 38,
                  padding: "0 16px",
                  borderRadius: 8,
                  background: "#dc2626",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: settings.soundAlertsEnabled ? "pointer" : "not-allowed",
                  opacity: settings.soundAlertsEnabled ? 1 : 0.5,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Radio size={14} /> Preview Urgent Directive Chime
              </button>

              <button
                type="button"
                onClick={() => playMessageNotificationSound(false)}
                disabled={!settings.soundAlertsEnabled}
                style={{
                  height: 38,
                  padding: "0 16px",
                  borderRadius: 8,
                  background: "#0284c7",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: settings.soundAlertsEnabled ? "pointer" : "not-allowed",
                  opacity: settings.soundAlertsEnabled ? 1 : 0.5,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Bell size={14} /> Preview Standard Message Ping
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
