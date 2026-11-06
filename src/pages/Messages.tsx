import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Phone,
  PhoneCall,
  Video,
  Send,
  Paperclip,
  Mic,
  Pin,
  CheckCheck,
  Radio,
  MapPin,
  FileText,
  Image as ImageIcon,
  Sparkles,
  Users,
  Plus,
  X,
  Info,
  ChevronRight,
  ChevronLeft,
  Play,
  Pause,
  Compass,
  Settings,
  Trash2,
  Lock,
  MoreVertical,
} from "lucide-react";
import LogoLoader from "../components/brand/LogoLoader";
import { useAuth } from "../context/AuthContext";
import {
  initializeMessaging,
  getStoredConversations,
  getStoredMessages,
  sendMessage,
  markConversationAsRead,
  deleteMessage,
  clearConversationMessages,
  clearConversationCallLogs,
  clearAllCallLogs,
  clearAllMessagesAndCalls,
  createDirectConversation,
  initiateCall,
  formatRoleName,
  messagingEvents,
  getMessagingSettings,
  canUserSeeContact,
  filterDirectoryUsersForViewer,
  canUserCallTarget,
  canUserSendMessage,
  canUserReceiveMessages,
  canUserDeleteMessage,
  getEffectiveRolePermission,
  isNationalLeadershipRole,
  doRegionsOverlap,
  type MessagingModuleSettings,
  type ChatUser,
  type ChatMessage,
  type Conversation,
  type MessageAttachment,
} from "../services/messagingService";
import { getCurrentPosition } from "./visits/visitsUtils";

export default function Messages() {
  const navigate = useNavigate();
  const { staff, role } = useAuth();
  const currentUserId = staff?.id || "current-user";
  const currentUserRole = (
    role?.key ||
    staff?.user_roles?.key ||
    staff?.assigned_role ||
    "brand_ambassador"
  ).toLowerCase();

  const isAdmin =
    currentUserRole === "administrator" ||
    currentUserRole === "admin" ||
    currentUserRole === "a0000000-0000-4000-8000-000000000001" ||
    role?.hierarchy_level === 1;

  const isManagement = [
    "administrator",
    "admin",
    "hr",
    "national_sales_manager",
    "nsm",
    "regional_sales_manager",
    "rsm",
    "sales_executive",
    "se",
  ].includes(currentUserRole);

  const [moduleSettings, setModuleSettings] = useState<MessagingModuleSettings>(() =>
    getMessagingSettings()
  );
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "direct" | "channel" | "announcement">("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Dropdown menus
  const [sidebarMenuOpen, setSidebarMenuOpen] = useState(false);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const sidebarMenuRef = useRef<HTMLDivElement>(null);
  const chatMenuRef = useRef<HTMLDivElement>(null);

  // Composer states
  const [inputText, setInputText] = useState("");
  const [priorityMode, setPriorityMode] = useState<"normal" | "urgent" | "broadcast">("normal");
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [showRightPanel, setShowRightPanel] = useState(false);

  // Modals
  const [newChatModalOpen, setNewChatModalOpen] = useState(false);
  const [directoryRegionFilter, setDirectoryRegionFilter] = useState<string>("all");
  const [directorySearchQuery, setDirectorySearchQuery] = useState<string>("");
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);
  const [clearHistoryModalOpen, setClearHistoryModalOpen] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastContent, setBroadcastContent] = useState("");
  const [broadcastTargetRole, setBroadcastTargetRole] = useState("all");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const voiceTimerRef = useRef<number | null>(null);

  // Audio playback state for voice notes
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState<Record<string, number>>({});
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const synthAudioRef = useRef<{ stop: () => void } | null>(null);
  const playbackTimerRef = useRef<number | null>(null);

  // Audio recording state
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordedBlobUrlRef = useRef<string | null>(null);

  // Close menus on outside click
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (sidebarMenuRef.current && !sidebarMenuRef.current.contains(e.target as Node)) {
        setSidebarMenuOpen(false);
      }
      if (chatMenuRef.current && !chatMenuRef.current.contains(e.target as Node)) {
        setChatMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Stop playback when leaving page or changing chat
  useEffect(() => {
    return () => {
      stopCurrentPlayback();
    };
  }, [selectedConvId]);

  // Load initial conversations & directory
  useEffect(() => {
    let active = true;
    async function loadData() {
      const data = await initializeMessaging(currentUserId);
      if (active) {
        setUsers(data.users);
        setConversations(data.conversations);
        // On desktop (> 768px), auto-select the first conversation; on mobile, show the inbox list first
        const isMobileViewport = typeof window !== "undefined" && window.innerWidth <= 768;
        if (!isMobileViewport && data.conversations.length > 0) {
          setSelectedConvId(data.conversations[0].id);
        }
        setLoading(false);
      }
    }
    void loadData();
    return () => {
      active = false;
    };
  }, [currentUserId]);

  // Load messages for selected conversation
  useEffect(() => {
    if (!selectedConvId) return;
    const msgs = getStoredMessages(selectedConvId);
    setMessages(msgs);
    markConversationAsRead(selectedConvId);
    setConversations(getStoredConversations());
  }, [selectedConvId]);

  // Real-time listener for incoming messages and updates
  useEffect(() => {
    const unsubMsg = messagingEvents.on("new_message", (msg: ChatMessage) => {
      if (msg.conversationId === selectedConvId) {
        setMessages((prev) => [...prev, msg]);
        markConversationAsRead(selectedConvId);
      }
      setConversations(getStoredConversations());
    });

    const unsubConvs = messagingEvents.on("conversations_updated", (convs: Conversation[]) => {
      setConversations(convs);
    });

    const unsubMsgs = messagingEvents.on("messages_updated", (all: ChatMessage[]) => {
      if (selectedConvId) {
        setMessages(all.filter((m) => m.conversationId === selectedConvId));
      }
    });

    return () => {
      unsubMsg();
      unsubConvs();
      unsubMsgs();
    };
  }, [selectedConvId]);

  // Sync module settings changes in real time
  useEffect(() => {
    const unsubSettings = messagingEvents.on("settings_updated", (s: MessagingModuleSettings) => {
      setModuleSettings(s);
    });
    return () => unsubSettings();
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Voice recording simulation timer (enforces maxVoiceNoteSecs)
  useEffect(() => {
    if (isRecordingVoice) {
      voiceTimerRef.current = window.setInterval(() => {
        setRecordDuration((d) => {
          const next = d + 1;
          if (moduleSettings.maxVoiceNoteSecs && next >= moduleSettings.maxVoiceNoteSecs) {
            void handleFinishVoiceRecording();
          }
          return next;
        });
      }, 1000);
    } else {
      setRecordDuration(0);
      if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
    }
    return () => {
      if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
    };
  }, [isRecordingVoice, moduleSettings.maxVoiceNoteSecs]);

  // Current user's scope & permissions context
  const viewerContext = useMemo(() => {
    const selfFromDir = users.find((u) => u.id === currentUserId);
    const assignedRegs = Array.isArray((staff as any)?.assigned_regions)
      ? (staff as any).assigned_regions
      : selfFromDir?.assignedRegions || (staff?.region ? [staff.region] : []);
    return {
      id: currentUserId,
      roleKey: currentUserRole,
      region: staff?.region || selfFromDir?.region || "National",
      assignedRegions: assignedRegs,
      reportsToId:
        (staff as any)?.reports_to_id ||
        (staff as any)?.reports_to ||
        selfFromDir?.reportsToId ||
        null,
    };
  }, [currentUserId, currentUserRole, staff, users]);

  const myRolePermission = useMemo(
    () => getEffectiveRolePermission(currentUserRole, moduleSettings),
    [currentUserRole, moduleSettings]
  );

  // Filter callable/messageable contacts according to Admin Directory & Region Visibility settings
  const visibleDirectoryUsers = useMemo(() => {
    return filterDirectoryUsersForViewer(
      users.filter((u) => u.id !== currentUserId),
      viewerContext,
      moduleSettings
    );
  }, [users, currentUserId, viewerContext, moduleSettings]);

  const modalFilteredDirectoryUsers = useMemo(() => {
    return visibleDirectoryUsers.filter((u) => {
      if (directoryRegionFilter === "my_region") {
        if (!doRegionsOverlap(viewerContext, u)) return false;
      } else if (directoryRegionFilter !== "all") {
        if (u.region.toLowerCase() !== directoryRegionFilter.toLowerCase()) return false;
      }
      if (directorySearchQuery.trim()) {
        const q = directorySearchQuery.toLowerCase();
        return (
          u.name.toLowerCase().includes(q) ||
          u.roleName.toLowerCase().includes(q) ||
          u.region.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [visibleDirectoryUsers, directoryRegionFilter, directorySearchQuery, viewerContext]);

  const availableDirectoryRegions = useMemo(() => {
    const set = new Set<string>();
    visibleDirectoryUsers.forEach((u) => {
      if (u.region && u.region.trim()) set.add(u.region.trim());
    });
    return Array.from(set).sort();
  }, [visibleDirectoryUsers]);

  // Filtered conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      if (activeTab !== "all" && c.type !== activeTab) {
        return false;
      }

      if (
        c.type === "channel" &&
        c.channelCategory === "regions" &&
        moduleSettings.restrictTerritoryHubsToRegion &&
        !isNationalLeadershipRole(currentUserRole)
      ) {
        const hubRegionName = c.title
          .replace(/^📍\s*/i, "")
          .replace(/\s*Territory Hub$/i, "")
          .trim();
        if (hubRegionName && !doRegionsOverlap(viewerContext, { region: hubRegionName })) {
          return false;
        }
      }

      if (c.type === "direct") {
        const pId = c.participantIds.find((id) => id !== currentUserId && id !== "current-user");
        const pUser =
          users.find((u) => u.id === pId) ||
          users.find((u) => u.name.toLowerCase() === c.title.toLowerCase());
        if (pUser) {
          const vis = canUserSeeContact(viewerContext, pUser, moduleSettings);
          if (!vis.visible) return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = c.title.toLowerCase().includes(q);
        const matchesDesc = (c.description || "").toLowerCase().includes(q);
        const matchesMsg = (c.lastMessage?.content || "").toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesMsg) return false;
      }
      if (roleFilter !== "all") {
        if (c.type !== "direct") return false;
        const pId = c.participantIds.find((id) => id !== currentUserId && id !== "current-user");
        const pUser =
          users.find((u) => u.id === pId) ||
          users.find((u) => u.name.toLowerCase() === c.title.toLowerCase());
        if (!pUser || pUser.roleKey !== roleFilter) return false;
      }
      return true;
    });
  }, [
    conversations,
    activeTab,
    searchQuery,
    roleFilter,
    users,
    currentUserId,
    currentUserRole,
    viewerContext,
    moduleSettings,
  ]);

  const totalUnreadCount = useMemo(
    () => conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
    [conversations]
  );

  const activeConversation = useMemo(
    () =>
      selectedConvId
        ? filteredConversations.find((c) => c.id === selectedConvId) ||
          conversations.find((c) => c.id === selectedConvId) ||
          null
        : null,
    [filteredConversations, conversations, selectedConvId]
  );

  const directPartner = useMemo(() => {
    if (!activeConversation || activeConversation.type !== "direct") return null;
    const partnerId = activeConversation.participantIds.find(
      (id) => id !== currentUserId && id !== "current-user"
    );
    return (
      users.find((u) => u.id === partnerId) ||
      users.find((u) => u.name.toLowerCase() === activeConversation.title.toLowerCase()) ||
      null
    );
  }, [activeConversation, users, currentUserId]);

  const activeCallTargetMeta = useMemo(() => {
    if (directPartner) {
      return {
        target: directPartner,
        isGroupHuddle: false,
      };
    }
    return {
      target: {
        id: activeConversation?.id || "channel-huddle",
        name: activeConversation?.title || "Channel Huddle",
        roleKey: "regional_sales_manager",
        region: viewerContext.region,
      },
      isGroupHuddle: true,
    };
  }, [directPartner, activeConversation, viewerContext.region]);

  const activeVoiceCallPermission = useMemo(
    () =>
      canUserCallTarget(
        viewerContext,
        activeCallTargetMeta.target,
        "audio",
        moduleSettings,
        activeCallTargetMeta.isGroupHuddle
      ),
    [viewerContext, activeCallTargetMeta, moduleSettings]
  );

  const activeVideoCallPermission = useMemo(
    () =>
      canUserCallTarget(
        viewerContext,
        activeCallTargetMeta.target,
        "video",
        moduleSettings,
        activeCallTargetMeta.isGroupHuddle
      ),
    [viewerContext, activeCallTargetMeta, moduleSettings]
  );

  const activeSendPermission = useMemo(
    () => canUserSendMessage(viewerContext, activeConversation ?? undefined, directPartner, moduleSettings),
    [viewerContext, activeConversation, directPartner, moduleSettings]
  );

  const activeReceivePermission = useMemo(
    () => canUserReceiveMessages(viewerContext, moduleSettings),
    [viewerContext, moduleSettings]
  );

  // Send message handler
  async function handleSendMessage(
    overrideText?: string,
    attachments?: MessageAttachment[],
    msgType: ChatMessage["type"] = "text"
  ) {
    const sendCheck = canUserSendMessage(
      viewerContext,
      activeConversation ?? undefined,
      directPartner,
      moduleSettings
    );
    if (!sendCheck.allowed) {
      alert(sendCheck.reason);
      return;
    }
    if (attachments && attachments.length > 0 && !myRolePermission.canSendAttachments) {
      alert(`Your role (${myRolePermission.roleName}) is not permitted to send media or file attachments.`);
      return;
    }
    const textToSend = (overrideText ?? inputText).trim();
    if (!textToSend && (!attachments || attachments.length === 0)) return;
    const targetConvId = selectedConvId || activeConversation?.id;
    if (!targetConvId) return;

    await sendMessage({
      conversationId: targetConvId,
      senderId: currentUserId,
      senderName: staff?.name || "Staff Member",
      senderRole: formatRoleName(currentUserRole),
      content: textToSend,
      type: msgType,
      priority: priorityMode,
      attachments,
      isPushNotification: priorityMode === "urgent" || priorityMode === "broadcast",
    });

    setInputText("");
    setPriorityMode("normal");
    setShowAttachmentMenu(false);
  }

  // Handle location pin sharing
  async function handleShareLocation() {
    try {
      const pos = await getCurrentPosition({ timeoutMs: 7000 });
      const lat = Number(pos.coords.latitude.toFixed(5));
      const lng = Number(pos.coords.longitude.toFixed(5));
      const locationAttachment: MessageAttachment = {
        id: `loc-${Date.now()}`,
        name: `GPS Location (${lat}°, ${lng}°)`,
        type: "location",
        url: `https://www.google.com/maps?q=${lat},${lng}`,
        data: { latitude: lat, longitude: lng },
      };

      await handleSendMessage(
        `📍 Live Trade Location Shared: ${lat}°, ${lng}°`,
        [locationAttachment],
        "location_pin"
      );
    } catch {
      alert("Unable to acquire GPS coordinates. Please ensure location permissions are enabled.");
    }
  }

  // Handle voice recording start
  async function startVoiceRecording() {
    setIsRecordingVoice(true);
    setRecordDuration(0);
    audioChunksRef.current = [];
    recordedBlobUrlRef.current = null;

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        mediaRecorder.onstop = () => {
          stream.getTracks().forEach((track) => track.stop());
          if (audioChunksRef.current.length > 0) {
            const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
            const blobUrl = URL.createObjectURL(blob);
            recordedBlobUrlRef.current = blobUrl;
          }
        };

        mediaRecorder.start();
      }
    } catch (err) {
      console.warn("Microphone access denied or simulated:", err);
    }
  }

  function handleCancelVoiceRecording() {
    setIsRecordingVoice(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    audioChunksRef.current = [];
    recordedBlobUrlRef.current = null;
  }

  async function handleFinishVoiceRecording() {
    setIsRecordingVoice(false);
    const secs = recordDuration || 3;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }

    setTimeout(async () => {
      const audioUrl = recordedBlobUrlRef.current || "#";
      const voiceAttachment: MessageAttachment = {
        id: `voice-${Date.now()}`,
        name: `Voice Note (${secs}s)`,
        type: "audio",
        url: audioUrl,
        size: `${Math.max(12, secs * 16)} KB`,
        data: { durationSecs: secs },
      };

      await handleSendMessage(`🎤 Voice Note (${secs}s)`, [voiceAttachment], "voice_note");
    }, 150);
  }

  function stopCurrentPlayback() {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    if (synthAudioRef.current) {
      synthAudioRef.current.stop();
      synthAudioRef.current = null;
    }
    if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
    setPlayingVoiceId(null);
  }

  function handlePlayVoiceNote(attachmentId: string, url: string, durationSecs = 3) {
    if (playingVoiceId === attachmentId) {
      stopCurrentPlayback();
      return;
    }

    stopCurrentPlayback();
    setPlayingVoiceId(attachmentId);
    setPlaybackProgress((prev) => ({ ...prev, [attachmentId]: 0 }));

    const maxSec = durationSecs || 3;

    if (url && url !== "#" && !url.startsWith("http://localhost") && url.length > 5) {
      const audio = new Audio(url);
      activeAudioRef.current = audio;

      audio.ontimeupdate = () => {
        setPlaybackProgress((prev) => ({
          ...prev,
          [attachmentId]: Math.floor(audio.currentTime),
        }));
      };

      audio.onended = () => {
        stopCurrentPlayback();
      };

      audio.onerror = () => {
        playSynthesizedVoiceNote(attachmentId, maxSec);
      };

      audio.play().catch(() => {
        playSynthesizedVoiceNote(attachmentId, maxSec);
      });
    } else {
      playSynthesizedVoiceNote(attachmentId, maxSec);
    }
  }

  function playSynthesizedVoiceNote(attachmentId: string, maxSec: number) {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === "suspended") void ctx.resume();

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(145, now + 0.12);
      for (let t = 0.2; t < maxSec; t += 0.25) {
        osc.frequency.setValueAtTime(135 + Math.sin(t * 5) * 30, now + t);
      }

      filter.type = "bandpass";
      filter.frequency.setValueAtTime(950, now);
      filter.Q.setValueAtTime(3.5, now);

      gain.gain.setValueAtTime(0.05, now + 0.12);
      gain.gain.setValueAtTime(0.05, now + maxSec - 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + maxSec);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + 0.12);
      osc.stop(now + maxSec);

      synthAudioRef.current = {
        stop: () => {
          try {
            osc.stop();
            void ctx.close();
          } catch {}
        },
      };

      let elapsed = 0;
      playbackTimerRef.current = window.setInterval(() => {
        elapsed += 1;
        setPlaybackProgress((prev) => ({ ...prev, [attachmentId]: elapsed }));
        if (elapsed >= maxSec) {
          stopCurrentPlayback();
        }
      }, 1000);
    } catch {
      stopCurrentPlayback();
    }
  }

  // Handle calls
  function handleStartCall(
    callType: "audio" | "video",
    targetOverride?: ChatUser,
    convIdOverride?: string
  ) {
    try {
      const targetConvId = convIdOverride || selectedConvId || activeConversation?.id;
      const targetEntity = targetOverride || directPartner;
      const isGroupHuddle =
        !targetEntity && Boolean(activeConversation && activeConversation.type !== "direct");

      const checkTarget = targetEntity
        ? targetEntity
        : {
            id: activeConversation?.id || "channel-huddle",
            name: activeConversation?.title || "Channel Huddle",
            roleKey: "regional_sales_manager",
            region: viewerContext.region,
          };

      const callPerm = canUserCallTarget(
        viewerContext,
        checkTarget,
        callType,
        moduleSettings,
        isGroupHuddle
      );
      if (!callPerm.allowed) {
        alert(callPerm.reason);
        return;
      }

      const receiver = targetOverride
        ? {
            id: targetOverride.id,
            name: targetOverride.name,
            role: targetOverride.roleName,
          }
        : directPartner
        ? {
            id: directPartner.id,
            name: directPartner.name,
            role: directPartner.roleName,
          }
        : activeConversation
        ? {
            id: activeConversation.id,
            name:
              activeConversation.title.replace(/^[^\w\s]+/u, "").trim() ||
              activeConversation.title,
            role:
              activeConversation.type === "announcement"
                ? "All-Hands Fleet Huddle"
                : activeConversation.type === "channel"
                ? "Territory Hub Huddle"
                : activeConversation.description || "Field Staff",
          }
        : null;

      if (!receiver) return;

      initiateCall(
        {
          id: currentUserId,
          name: staff?.name || "Staff Member",
          role: formatRoleName(currentUserRole),
        },
        receiver,
        callType,
        targetConvId
      );
    } catch (err: any) {
      alert(err?.message || "Unable to start call. Please check Communications & Calling settings.");
    }
  }

  // Handle creating executive broadcast
  async function handleSendBroadcast() {
    if (!broadcastTitle.trim() || !broadcastContent.trim()) return;
    const annConv = conversations.find((c) => c.type === "announcement") || conversations[0];
    if (!annConv) return;

    await sendMessage({
      conversationId: annConv.id,
      senderId: currentUserId,
      senderName: staff?.name || "Executive Management",
      senderRole: formatRoleName(currentUserRole),
      content: `📢 [${broadcastTitle.trim()}]\n${broadcastContent.trim()}`,
      type: "announcement",
      priority: "broadcast",
      isPushNotification: true,
      targetScope: {
        roleKeys: broadcastTargetRole === "all" ? undefined : [broadcastTargetRole],
      },
    });

    setBroadcastModalOpen(false);
    setBroadcastTitle("");
    setBroadcastContent("");
    setSelectedConvId(annConv.id);
  }

  if (loading) {
    return (
      <LogoLoader
        variant="page"
        message="Loading messages & calls"
        hint="Connecting to team conversations…"
      />
    );
  }

  return (
    <div className="messages-hub-container">
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* LEFT SIDEBAR: Clean Inbox & Compact Filter Dropdowns               */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <aside className={`messages-sidebar ${selectedConvId ? "mobile-hidden" : ""}`}>
        <div className="messages-sidebar-header">
          {/* Row 1: Title + Primary New Button + More Dropdown */}
          <div className="messages-header-top">
            <div className="messages-title-group">
              <h2 className="messages-sidebar-title">Messages &amp; Calls</h2>
              {totalUnreadCount > 0 && (
                <span className="messages-unread-total-pill">{totalUnreadCount}</span>
              )}
            </div>

            <div className="messages-header-actions">
              <button
                type="button"
                className="msg-hdr-btn primary-new"
                onClick={() => setNewChatModalOpen(true)}
                title="New Message or Call"
              >
                <Plus size={15} />
                <span>New Chat</span>
              </button>

              <div className="msg-dropdown-wrap" ref={sidebarMenuRef}>
                <button
                  type="button"
                  className="msg-icon-menu-btn"
                  onClick={() => setSidebarMenuOpen((v) => !v)}
                  title="More options"
                  aria-label="More options"
                >
                  <MoreVertical size={17} />
                </button>

                {sidebarMenuOpen && (
                  <div className="msg-dropdown-menu">
                    {isManagement && moduleSettings.broadcastRolesAllowed.includes(currentUserRole) && (
                      <button
                        type="button"
                        className="msg-dropdown-item"
                        onClick={() => {
                          setSidebarMenuOpen(false);
                          setBroadcastModalOpen(true);
                        }}
                      >
                        <Radio size={14} color="#d97706" />
                        <span>Send Broadcast</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="msg-dropdown-item"
                      onClick={() => {
                        setSidebarMenuOpen(false);
                        setClearHistoryModalOpen(true);
                      }}
                    >
                      <Trash2 size={14} color="#e11d48" />
                      <span>Clear History…</span>
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        className="msg-dropdown-item"
                        onClick={() => {
                          setSidebarMenuOpen(false);
                          navigate("/settings?tab=communications");
                        }}
                      >
                        <Settings size={14} color="#475569" />
                        <span>Messaging Settings</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Search Box */}
          <div className="messages-search-wrap">
            <Search size={14} className="messages-search-icon" />
            <input
              type="text"
              placeholder="Search chats or staff…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="messages-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="search-clear-btn"
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Row 3: Compact Filter Dropdowns (Replaces crowded multi-row tabs & chips) */}
          <div className="messages-filter-dropdowns">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as typeof activeTab)}
              className="messages-compact-select"
              aria-label="Filter by conversation type"
            >
              <option value="all">All Chats ({conversations.length})</option>
              <option value="direct">Direct Messages</option>
              <option value="channel">📍 Territory Hubs</option>
              <option value="announcement">📢 Bulletins</option>
            </select>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="messages-compact-select"
              aria-label="Filter by staff role"
            >
              <option value="all">All Roles</option>
              <option value="brand_ambassador">Brand Ambassadors (BAs)</option>
              <option value="vsr">Van Sales Reps (VSRs)</option>
              <option value="sales_executive">Sales Executives (SEs)</option>
              <option value="regional_sales_manager">Regional Managers (RSMs)</option>
            </select>
          </div>
        </div>

        {/* Conversation List */}
        <div className="messages-list-scroll">
          {filteredConversations.length === 0 ? (
            <div className="messages-empty-list">
              <Users size={30} style={{ opacity: 0.35, marginBottom: 8 }} />
              <p>No conversations match your filter</p>
              <button
                type="button"
                className="empty-cta-btn"
                onClick={() => setNewChatModalOpen(true)}
              >
                Start a New Chat
              </button>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = conv.id === selectedConvId;
              const hasUnread = (conv.unreadCount || 0) > 0;
              const isDirect = conv.type === "direct";
              const partner = isDirect
                ? users.find((u) => u.id === conv.participantIds.find((id) => id !== currentUserId))
                : null;

              return (
                <div
                  key={conv.id}
                  className={`conversation-item ${isSelected ? "selected" : ""} ${hasUnread ? "unread" : ""}`}
                  onClick={() => setSelectedConvId(conv.id)}
                >
                  <div className="conv-avatar-wrap">
                    {conv.type === "announcement" ? (
                      <div className="conv-avatar announcement">📢</div>
                    ) : conv.type === "channel" ? (
                      <div className="conv-avatar channel">📍</div>
                    ) : (
                      <div className="conv-avatar direct">
                        {(partner?.name || conv.title).slice(0, 2).toUpperCase()}
                        {partner?.status === "online" && <span className="online-dot" />}
                      </div>
                    )}
                  </div>

                  <div className="conv-content-meta">
                    <div className="conv-title-row">
                      <strong className="conv-title">
                        {conv.type === "direct" && partner ? partner.name : conv.title}
                      </strong>
                      <span className="conv-time">
                        {conv.lastMessage
                          ? new Date(conv.lastMessage.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </span>
                    </div>

                    <div className="conv-preview-row">
                      <span className="conv-preview-text">
                        {conv.lastMessage ? (
                          <>
                            {conv.lastMessage.senderId === currentUserId && (
                              <CheckCheck size={12} className="delivery-ticks delivered" />
                            )}
                            {conv.lastMessage.type === "call_log" ? "📞 " : ""}
                            {conv.lastMessage.content}
                          </>
                        ) : (
                          conv.description || "Tap to start chatting…"
                        )}
                      </span>

                      <div style={{ display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                        {conv.isPinned && <Pin size={11} className="pin-icon" />}
                        {hasUnread && <span className="unread-badge">{conv.unreadCount}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MAIN CHAT STAGE: Clean Header, Messages Stream & Simple Composer   */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <main className={`messages-main-panel ${!selectedConvId ? "mobile-hidden" : ""}`}>
        {activeConversation ? (
          <>
            {/* Stage Header */}
            <header className="chat-stage-header">
              <div className="chat-partner-info">
                <button
                  type="button"
                  className="chat-mobile-back-btn"
                  onClick={() => setSelectedConvId("")}
                  title="Back to chats"
                  aria-label="Back to chats"
                >
                  <ChevronLeft size={20} />
                </button>

                <div className="chat-header-avatar">
                  {activeConversation.type === "announcement"
                    ? "📢"
                    : activeConversation.type === "channel"
                    ? "📍"
                    : (directPartner?.name || activeConversation.title).slice(0, 2).toUpperCase()}
                  {directPartner?.status === "online" && <span className="online-dot" />}
                </div>

                <div style={{ minWidth: 0 }}>
                  <h2 className="chat-header-title">
                    {activeConversation.type === "direct" && directPartner
                      ? directPartner.name
                      : activeConversation.title}
                  </h2>
                  <p className="chat-header-sub">
                    {activeConversation.type === "direct" && directPartner ? (
                      <>
                        <span className="status-label">
                          {directPartner.status === "online" ? "Online" : "Offline"}
                        </span>
                        {` · ${directPartner.roleName}`}
                        {directPartner.region ? ` (${directPartner.region})` : ""}
                      </>
                    ) : (
                      activeConversation.description || "Group Channel"
                    )}
                  </p>
                </div>
              </div>

              {/* Header Actions: Audio Call, Video Call, and More Menu */}
              <div className="chat-header-actions">
                {moduleSettings.allowVoiceCalls && (
                  <button
                    type="button"
                    className="chat-action-btn call"
                    onClick={() => handleStartCall("audio")}
                    disabled={!activeVoiceCallPermission.allowed}
                    title={
                      activeVoiceCallPermission.allowed
                        ? "Voice Call"
                        : activeVoiceCallPermission.reason
                    }
                  >
                    {activeVoiceCallPermission.allowed ? <Phone size={16} /> : <Lock size={14} />}
                    <span className="btn-label">Call</span>
                  </button>
                )}

                {moduleSettings.allowVideoCalls && (
                  <button
                    type="button"
                    className="chat-action-btn video"
                    onClick={() => handleStartCall("video")}
                    disabled={!activeVideoCallPermission.allowed}
                    title={
                      activeVideoCallPermission.allowed
                        ? "Video Call"
                        : activeVideoCallPermission.reason
                    }
                  >
                    {activeVideoCallPermission.allowed ? <Video size={16} /> : <Lock size={14} />}
                    <span className="btn-label">Video</span>
                  </button>
                )}

                <div className="msg-dropdown-wrap" ref={chatMenuRef}>
                  <button
                    type="button"
                    className="msg-icon-menu-btn"
                    onClick={() => setChatMenuOpen((v) => !v)}
                    title="Chat options"
                    aria-label="Chat options"
                  >
                    <MoreVertical size={17} />
                  </button>

                  {chatMenuOpen && (
                    <div className="msg-dropdown-menu right">
                      <button
                        type="button"
                        className="msg-dropdown-item"
                        onClick={() => {
                          setChatMenuOpen(false);
                          setShowRightPanel((v) => !v);
                        }}
                      >
                        <Info size={14} color="#059669" />
                        <span>{showRightPanel ? "Hide Info Panel" : "Contact / Channel Info"}</span>
                      </button>

                      {moduleSettings.allowLocationSharing && activeSendPermission.allowed && (
                        <button
                          type="button"
                          className="msg-dropdown-item"
                          onClick={() => {
                            setChatMenuOpen(false);
                            void handleShareLocation();
                          }}
                        >
                          <MapPin size={14} color="#0284c7" />
                          <span>Share GPS Location</span>
                        </button>
                      )}

                      <button
                        type="button"
                        className="msg-dropdown-item"
                        onClick={() => {
                          setChatMenuOpen(false);
                          if (window.confirm(`Clear call logs in "${activeConversation.title}"?`)) {
                            clearConversationCallLogs(activeConversation.id);
                          }
                        }}
                      >
                        <Phone size={14} color="#d97706" />
                        <span>Clear Call Logs</span>
                      </button>

                      <button
                        type="button"
                        className="msg-dropdown-item"
                        onClick={() => {
                          setChatMenuOpen(false);
                          if (window.confirm(`Clear all messages in "${activeConversation.title}"?`)) {
                            clearConversationMessages(activeConversation.id);
                          }
                        }}
                      >
                        <Trash2 size={14} color="#e11d48" />
                        <span>Clear Chat Messages</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </header>

            {/* Messages Scroll Area */}
            <div className="chat-messages-stream">
              {messages.length === 0 ? (
                <div className="chat-messages-empty">
                  <Sparkles size={26} color="#059669" />
                  <h3>No messages yet</h3>
                  <p>Send a message, voice note, or attachment below.</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.senderId === currentUserId;
                  const isCallLog = msg.type === "call_log";
                  const isAnnouncement = msg.type === "announcement";

                  return (
                    <div
                      key={msg.id}
                      className={`chat-message-row ${isMe ? "me" : "them"} ${isAnnouncement ? "announcement" : ""}`}
                    >
                      {!isMe && (
                        <div className="msg-sender-avatar">
                          {msg.senderName.slice(0, 2).toUpperCase()}
                        </div>
                      )}

                      <div className="msg-bubble-wrap">
                        {!isMe && (
                          <div className="msg-sender-name">
                            <strong>{msg.senderName}</strong>
                            <span className="msg-sender-role"> · {msg.senderRole}</span>
                          </div>
                        )}

                        {msg.priority !== "normal" && (
                          <div className={`msg-priority-tag ${msg.priority}`}>
                            {msg.priority === "broadcast" ? "📢 BROADCAST" : "⚡ URGENT"}
                          </div>
                        )}

                        <div className="msg-body">
                          {isCallLog ? (
                            <div className="msg-call-log-card">
                              <PhoneCall size={15} color="#059669" />
                              <span>{msg.content}</span>
                            </div>
                          ) : (
                            <p className="msg-text-content">{msg.content}</p>
                          )}

                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="msg-attachments-container">
                              {msg.attachments.map((att) => (
                                <div key={att.id} className={`msg-attachment-item ${att.type}`}>
                                  {att.type === "location" ? (
                                    <div className="msg-location-card">
                                      <div className="loc-icon-wrap">
                                        <Compass size={17} />
                                      </div>
                                      <div className="loc-details">
                                        <strong>{att.name}</strong>
                                        <a
                                          href={att.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="loc-link"
                                        >
                                          Open in Maps ↗
                                        </a>
                                      </div>
                                    </div>
                                  ) : att.type === "audio" ? (
                                    <div className={`msg-voice-card ${playingVoiceId === att.id ? "playing" : ""}`}>
                                      <button
                                        type="button"
                                        className={`voice-play-btn ${playingVoiceId === att.id ? "active" : ""}`}
                                        onClick={() =>
                                          handlePlayVoiceNote(att.id, att.url, att.data?.durationSecs || 3)
                                        }
                                        aria-label={playingVoiceId === att.id ? "Pause" : "Play"}
                                      >
                                        {playingVoiceId === att.id ? (
                                          <Pause size={13} fill="currentColor" />
                                        ) : (
                                          <Play size={13} fill="currentColor" />
                                        )}
                                      </button>
                                      <div
                                        className={`voice-waveform-preview ${
                                          playingVoiceId === att.id ? "animating" : ""
                                        }`}
                                      >
                                        <span className="wave-bar h-1" />
                                        <span className="wave-bar h-3" />
                                        <span className="wave-bar h-2" />
                                        <span className="wave-bar h-4" />
                                        <span className="wave-bar h-1" />
                                        <span className="wave-bar h-3" />
                                      </div>
                                      <span className="voice-duration">
                                        {playingVoiceId === att.id
                                          ? `${playbackProgress[att.id] || 0}s / ${att.data?.durationSecs || 3}s`
                                          : `${att.data?.durationSecs || 3}s`}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="msg-file-card">
                                      <FileText size={15} />
                                      <span>{att.name}</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="msg-footer">
                          <span className="msg-timestamp">
                            {new Date(msg.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>

                          {isMe && moduleSettings.readReceiptsEnabled && (
                            <span className="msg-delivery-status">
                              <CheckCheck
                                size={13}
                                className={`check-icon ${msg.status === "read" ? "read" : "delivered"}`}
                              />
                            </span>
                          )}

                          {canUserDeleteMessage(viewerContext, msg, moduleSettings) && (
                            <button
                              type="button"
                              className="msg-reaction-add-btn"
                              onClick={() => deleteMessage(msg.id)}
                              title="Delete"
                              style={{ marginLeft: 2, color: isMe ? "rgba(255,255,255,0.75)" : "#94a3b8" }}
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Streamlined Composer */}
            <div className="chat-composer-wrap">
              {!activeReceivePermission.allowed && (
                <div className="composer-notice-bar warning">
                  <Lock size={13} />
                  <span>{activeReceivePermission.reason}</span>
                </div>
              )}

              {!activeSendPermission.allowed ? (
                <div className="composer-notice-bar readonly">
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Lock size={14} color="#64748b" />
                    <span>Read-Only: {activeSendPermission.reason}</span>
                  </div>
                </div>
              ) : (
                <div className="chat-composer-box">
                  {/* Attachments Trigger */}
                  {myRolePermission.canSendAttachments && (
                    <div className="composer-attach-wrapper">
                      <button
                        type="button"
                        className="composer-action-btn"
                        onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                        title="Attach Photo, File or Location"
                      >
                        <Paperclip size={18} />
                      </button>

                      {showAttachmentMenu && (
                        <div className="composer-attach-popover">
                          {moduleSettings.allowPhotoAttachments !== false && (
                            <button
                              type="button"
                              onClick={() => imageInputRef.current?.click()}
                              className="attach-item photo"
                            >
                              <ImageIcon size={16} />
                              <div>
                                <strong>Photo</strong>
                                <span>Share image</span>
                              </div>
                            </button>
                          )}

                          {moduleSettings.allowFileAttachments !== false && (
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="attach-item file"
                            >
                              <FileText size={16} />
                              <div>
                                <strong>Document</strong>
                                <span>Upload file or PDF</span>
                              </div>
                            </button>
                          )}

                          {moduleSettings.allowLocationSharing && (
                            <button
                              type="button"
                              onClick={() => {
                                setShowAttachmentMenu(false);
                                void handleShareLocation();
                              }}
                              className="attach-item location"
                            >
                              <MapPin size={16} />
                              <div>
                                <strong>GPS Location</strong>
                                <span>Pin current coordinates</span>
                              </div>
                            </button>
                          )}

                          <input
                            ref={fileInputRef}
                            type="file"
                            style={{ display: "none" }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                void handleSendMessage(`📎 Document: ${file.name}`, [
                                  {
                                    id: `file-${Date.now()}`,
                                    name: file.name,
                                    type: "document",
                                    url: "#",
                                    size: `${Math.round(file.size / 1024)} KB`,
                                  },
                                ]);
                              }
                            }}
                          />
                          <input
                            ref={imageInputRef}
                            type="file"
                            accept="image/*"
                            style={{ display: "none" }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                void handleSendMessage(`🖼️ Photo: ${file.name}`, [
                                  {
                                    id: `img-${Date.now()}`,
                                    name: file.name,
                                    type: "image",
                                    url: "#",
                                    size: `${Math.round(file.size / 1024)} KB`,
                                  },
                                ]);
                              }
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Compact Priority Dropdown for Management */}
                  {isManagement && !isRecordingVoice && (
                    <select
                      value={priorityMode}
                      onChange={(e) => setPriorityMode(e.target.value as typeof priorityMode)}
                      className={`composer-priority-select ${priorityMode}`}
                      title="Message priority"
                    >
                      <option value="normal">Normal</option>
                      <option value="urgent">⚡ Urgent</option>
                      {myRolePermission.canBroadcast && (
                        <option value="broadcast">📢 Broadcast</option>
                      )}
                    </select>
                  )}

                  {/* Voice Recording or Text Input */}
                  {isRecordingVoice ? (
                    <div className="composer-voice-recording-stage">
                      <span className="voice-pulse-indicator" />
                      <strong>Recording ({recordDuration}s)…</strong>
                      <div className="voice-stage-actions">
                        <button
                          type="button"
                          className="voice-cancel-btn"
                          onClick={handleCancelVoiceRecording}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="voice-send-btn"
                          onClick={handleFinishVoiceRecording}
                        >
                          <Send size={13} /> Send
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <textarea
                        placeholder="Type a message…"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void handleSendMessage();
                          }
                        }}
                        rows={1}
                        className="composer-textarea"
                      />

                      {moduleSettings.allowVoiceNotes &&
                        myRolePermission.canSendAttachments &&
                        !inputText.trim() && (
                          <button
                            type="button"
                            className="composer-action-btn voice"
                            onClick={startVoiceRecording}
                            title="Record Voice Note"
                          >
                            <Mic size={18} />
                          </button>
                        )}

                      <button
                        type="button"
                        className="composer-send-btn"
                        disabled={!inputText.trim()}
                        onClick={() => void handleSendMessage()}
                        title="Send Message"
                      >
                        <Send size={16} />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="chat-empty-selection">
            <Users size={42} style={{ opacity: 0.3, marginBottom: 10 }} />
            <h2>Select a conversation</h2>
            <p>Choose a chat from the list or start a new conversation.</p>
          </div>
        )}
      </main>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* OPTIONAL DRAWER: Contact / Channel Details                         */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {showRightPanel && activeConversation && (
        <aside className="messages-info-panel">
          <div className="info-panel-header">
            <h3>{activeConversation.type === "direct" ? "Contact Info" : "Channel Info"}</h3>
            <button
              type="button"
              className="info-close-btn"
              onClick={() => setShowRightPanel(false)}
            >
              <X size={16} />
            </button>
          </div>

          <div className="info-panel-body">
            <div className="info-profile-card">
              <div className="info-avatar">
                {activeConversation.type === "announcement"
                  ? "📢"
                  : activeConversation.type === "channel"
                  ? "📍"
                  : (directPartner?.name || activeConversation.title).slice(0, 2).toUpperCase()}
              </div>
              <h3 className="info-name">
                {activeConversation.type === "direct" && directPartner
                  ? directPartner.name
                  : activeConversation.title}
              </h3>
              <p className="info-role">
                {activeConversation.type === "direct" && directPartner
                  ? directPartner.roleName
                  : activeConversation.description || "Communications Channel"}
              </p>
            </div>

            <div className="info-section">
              <span className="info-section-title">Details</span>
              <div className="info-detail-row">
                <MapPin size={14} color="#64748b" />
                <span>{directPartner?.region || "All Regions"}</span>
              </div>
              {directPartner?.phone && (
                <div className="info-detail-row">
                  <Phone size={14} color="#64748b" />
                  <span>{directPartner.phone}</span>
                </div>
              )}
            </div>
          </div>
        </aside>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL 1: NEW DIRECT MESSAGE / CALL                                 */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {newChatModalOpen && (
        <div className="comm-modal-backdrop" onClick={() => setNewChatModalOpen(false)}>
          <div className="comm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="comm-dialog-header">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Users size={18} color="#059669" />
                <h3 style={{ margin: 0, fontSize: 16 }}>New Chat or Call</h3>
              </div>
              <button
                type="button"
                onClick={() => setNewChatModalOpen(false)}
                className="dialog-close-btn"
              >
                <X size={16} />
              </button>
            </div>

            <div className="comm-dialog-body">
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <div style={{ position: "relative", flex: "1 1 180px" }}>
                  <Search
                    size={13}
                    style={{
                      position: "absolute",
                      left: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#94a3b8",
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Search staff name or role…"
                    value={directorySearchQuery}
                    onChange={(e) => setDirectorySearchQuery(e.target.value)}
                    style={{
                      width: "100%",
                      height: 36,
                      padding: "0 10px 0 30px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: 12.5,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <select
                  value={directoryRegionFilter}
                  onChange={(e) => setDirectoryRegionFilter(e.target.value)}
                  style={{
                    height: 36,
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    padding: "0 10px",
                    fontSize: 12.5,
                    background: "#ffffff",
                  }}
                >
                  <option value="all">All Regions ({visibleDirectoryUsers.length})</option>
                  <option value="my_region">My Region ({viewerContext.region})</option>
                  {availableDirectoryRegions.map((reg) => (
                    <option key={reg} value={reg}>
                      {reg}
                    </option>
                  ))}
                </select>
              </div>

              <div className="directory-list-scroll">
                {modalFilteredDirectoryUsers.length === 0 ? (
                  <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontSize: 13 }}>
                    No matching staff contacts found.
                  </div>
                ) : (
                  modalFilteredDirectoryUsers.map((target) => {
                    const audioPerm = canUserCallTarget(
                      viewerContext,
                      target,
                      "audio",
                      moduleSettings,
                      false
                    );
                    const videoPerm = canUserCallTarget(
                      viewerContext,
                      target,
                      "video",
                      moduleSettings,
                      false
                    );
                    return (
                      <div
                        key={target.id}
                        className="directory-user-card"
                        onClick={async () => {
                          const conv = await createDirectConversation(currentUserId, target);
                          setConversations(getStoredConversations());
                          setSelectedConvId(conv.id);
                          setNewChatModalOpen(false);
                        }}
                      >
                        <div className="dir-avatar">
                          {target.name.slice(0, 2).toUpperCase()}
                          {target.status === "online" && <span className="online-dot" />}
                        </div>
                        <div className="dir-meta">
                          <strong>{target.name}</strong>
                          <span className="dir-role">
                            {target.roleName} · {target.region}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {moduleSettings.allowVoiceCalls && (
                            <button
                              type="button"
                              disabled={!audioPerm.allowed}
                              title={audioPerm.allowed ? `Call ${target.name}` : audioPerm.reason}
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!audioPerm.allowed) return;
                                const conv = await createDirectConversation(currentUserId, target);
                                setConversations(getStoredConversations());
                                setSelectedConvId(conv.id);
                                setNewChatModalOpen(false);
                                handleStartCall("audio", target, conv.id);
                              }}
                              className="dir-call-icon-btn audio"
                            >
                              {audioPerm.allowed ? <Phone size={14} /> : <Lock size={12} />}
                            </button>
                          )}
                          {moduleSettings.allowVideoCalls && (
                            <button
                              type="button"
                              disabled={!videoPerm.allowed}
                              title={videoPerm.allowed ? `Video Call ${target.name}` : videoPerm.reason}
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!videoPerm.allowed) return;
                                const conv = await createDirectConversation(currentUserId, target);
                                setConversations(getStoredConversations());
                                setSelectedConvId(conv.id);
                                setNewChatModalOpen(false);
                                handleStartCall("video", target, conv.id);
                              }}
                              className="dir-call-icon-btn video"
                            >
                              {videoPerm.allowed ? <Video size={14} /> : <Lock size={12} />}
                            </button>
                          )}
                          <ChevronRight size={15} color="#94a3b8" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL 2: SEND BROADCAST                                            */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {broadcastModalOpen && (
        <div className="comm-modal-backdrop" onClick={() => setBroadcastModalOpen(false)}>
          <div className="comm-dialog broadcast" onClick={(e) => e.stopPropagation()}>
            <div className="comm-dialog-header">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Radio size={18} color="#d97706" />
                <h3 style={{ margin: 0, fontSize: 16 }}>Send Broadcast</h3>
              </div>
              <button
                type="button"
                onClick={() => setBroadcastModalOpen(false)}
                className="dialog-close-btn"
              >
                <X size={16} />
              </button>
            </div>

            <div className="comm-dialog-body">
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    Topic
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Monthly Target Update"
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    Audience
                  </label>
                  <select
                    value={broadcastTargetRole}
                    onChange={(e) => setBroadcastTargetRole(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                    }}
                  >
                    <option value="all">All Staff &amp; Roles</option>
                    <option value="brand_ambassador">Brand Ambassadors (BAs)</option>
                    <option value="vsr">Van Sales Reps (VSRs)</option>
                    <option value="sales_executive">Sales Executives (SEs)</option>
                    <option value="regional_sales_manager">Regional Managers (RSMs)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    Message
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Write your announcement..."
                    value={broadcastContent}
                    onChange={(e) => setBroadcastContent(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => setBroadcastModalOpen(false)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!broadcastTitle.trim() || !broadcastContent.trim()}
                  onClick={handleSendBroadcast}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "none",
                    background:
                      broadcastTitle.trim() && broadcastContent.trim() ? "#d97706" : "#cbd5e1",
                    color: "#fff",
                    fontWeight: 700,
                    cursor:
                      broadcastTitle.trim() && broadcastContent.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  Send Broadcast
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL 3: CLEAR CALLS & MESSAGES HISTORY                            */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {clearHistoryModalOpen && (
        <div className="comm-modal-backdrop" onClick={() => setClearHistoryModalOpen(false)}>
          <div className="comm-dialog" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="comm-dialog-header">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Trash2 size={18} color="#e11d48" />
                <h3 style={{ margin: 0, fontSize: 16 }}>Clear History</h3>
              </div>
              <button
                type="button"
                onClick={() => setClearHistoryModalOpen(false)}
                className="dialog-close-btn"
              >
                <X size={16} />
              </button>
            </div>

            <div className="comm-dialog-body">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {activeConversation && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        clearConversationCallLogs(activeConversation.id);
                        setClearHistoryModalOpen(false);
                      }}
                      className="clear-history-option-btn"
                    >
                      <div>
                        <strong>Clear Call Logs in Current Chat</strong>
                        <span>Only removes call entries in {activeConversation.title}</span>
                      </div>
                      <Phone size={15} />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        clearConversationMessages(activeConversation.id);
                        setClearHistoryModalOpen(false);
                      }}
                      className="clear-history-option-btn danger-soft"
                    >
                      <div>
                        <strong>Clear Current Chat</strong>
                        <span>Empties messages &amp; calls in {activeConversation.title}</span>
                      </div>
                      <Trash2 size={15} />
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Clear all call logs across all conversations?")) {
                      clearAllCallLogs();
                      setClearHistoryModalOpen(false);
                    }
                  }}
                  className="clear-history-option-btn"
                >
                  <div>
                    <strong>Clear All Call Logs</strong>
                    <span>Deletes call history across all chats</span>
                  </div>
                  <PhoneCall size={15} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Clear ALL messages and call logs across every chat?")) {
                      clearAllMessagesAndCalls();
                      setClearHistoryModalOpen(false);
                    }
                  }}
                  className="clear-history-option-btn danger"
                >
                  <div>
                    <strong>Clear All Messages &amp; Calls</strong>
                    <span>Resets all conversation histories</span>
                  </div>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
