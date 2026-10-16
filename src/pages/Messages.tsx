import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Phone,
  PhoneCall,
  Video,
  Send,
  Paperclip,
  Smile,
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
} from "lucide-react";
import LogoLoader from "../components/brand/LogoLoader";
import { useAuth } from "../context/AuthContext";
import {
  initializeMessaging,
  getStoredConversations,
  getStoredMessages,
  sendMessage,
  markConversationAsRead,
  toggleMessageReaction,
  createDirectConversation,
  initiateCall,
  formatRoleName,
  SMART_REPLIES,
  messagingEvents,
  getMessagingSettings,
  type MessagingModuleSettings,
  type ChatUser,
  type ChatMessage,
  type Conversation,
  type MessageAttachment,
} from "../services/messagingService";
import { getCurrentPosition } from "./visits/visitsUtils";

const REACTION_EMOJIS = ["👍", "🔥", "🎯", "✅", "❤️", "🙏", "👏"];

export default function Messages() {
  const navigate = useNavigate();
  const { staff, role } = useAuth();
  const currentUserId = staff?.id || "current-user";
  const currentUserRole = (role?.key || staff?.user_roles?.key || staff?.assigned_role || "brand_ambassador").toLowerCase();
  const isAdmin =
    currentUserRole === "administrator" ||
    currentUserRole === "admin" ||
    currentUserRole === "a0000000-0000-4000-8000-000000000001" ||
    role?.hierarchy_level === 1;
  const isManagement = ["administrator", "admin", "hr", "national_sales_manager", "nsm", "regional_sales_manager", "rsm", "sales_executive", "se"].includes(currentUserRole);

  const [moduleSettings, setModuleSettings] = useState<MessagingModuleSettings>(() => getMessagingSettings());
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "direct" | "channel" | "announcement">("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Composer states
  const [inputText, setInputText] = useState("");
  const [priorityMode, setPriorityMode] = useState<"normal" | "urgent" | "broadcast">("normal");
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);

  // Modals
  const [newChatModalOpen, setNewChatModalOpen] = useState(false);
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);
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
        if (data.conversations.length > 0) {
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

  // Voice recording simulation timer
  useEffect(() => {
    if (isRecordingVoice) {
      voiceTimerRef.current = window.setInterval(() => {
        setRecordDuration((d) => d + 1);
      }, 1000);
    } else {
      setRecordDuration(0);
      if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
    }
    return () => {
      if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
    };
  }, [isRecordingVoice]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === selectedConvId) || conversations[0],
    [conversations, selectedConvId],
  );

  const directPartner = useMemo(() => {
    if (!activeConversation || activeConversation.type !== "direct") return null;
    const partnerId = activeConversation.participantIds.find((id) => id !== currentUserId);
    return users.find((u) => u.id === partnerId) || null;
  }, [activeConversation, users, currentUserId]);

  // Filtered conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      if (activeTab !== "all" && c.type !== activeTab) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = c.title.toLowerCase().includes(q);
        const matchesDesc = (c.description || "").toLowerCase().includes(q);
        const matchesMsg = (c.lastMessage?.content || "").toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesMsg) return false;
      }
      if (roleFilter !== "all" && c.type === "direct") {
        const pId = c.participantIds.find((id) => id !== currentUserId);
        const pUser = users.find((u) => u.id === pId);
        if (pUser && pUser.roleKey !== roleFilter) return false;
      }
      return true;
    });
  }, [conversations, activeTab, searchQuery, roleFilter, users, currentUserId]);

  // Smart suggestions relevant to current chat
  const suggestions = useMemo(() => {
    if (moduleSettings.smartRepliesList && moduleSettings.smartRepliesList.length > 0) {
      return moduleSettings.smartRepliesList;
    }
    if (!activeConversation) return SMART_REPLIES.default;
    if (activeConversation.type === "announcement") return SMART_REPLIES.announcement;
    if (activeConversation.lastMessage?.type === "target_update") return SMART_REPLIES.target_update;
    return SMART_REPLIES.default;
  }, [activeConversation, moduleSettings.smartRepliesList]);

  // Send message handler
  async function handleSendMessage(overrideText?: string, attachments?: MessageAttachment[], msgType: ChatMessage["type"] = "text") {
    const textToSend = (overrideText ?? inputText).trim();
    if (!textToSend && (!attachments || attachments.length === 0)) return;
    if (!selectedConvId) return;

    await sendMessage({
      conversationId: selectedConvId,
      senderId: currentUserId,
      senderName: staff?.name || "Staff Member",
      senderRole: formatRoleName(currentUserRole),
      content: textToSend,
      type: msgType,
      priority: priorityMode,
      replyTo: replyTarget
        ? {
            id: replyTarget.id,
            senderName: replyTarget.senderName,
            content: replyTarget.content.slice(0, 70),
          }
        : undefined,
      attachments,
      isPushNotification: priorityMode === "urgent" || priorityMode === "broadcast",
    });

    setInputText("");
    setReplyTarget(null);
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
        "location_pin",
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

  // Handle voice note send
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

      const chirp = ctx.createOscillator();
      const chirpGain = ctx.createGain();
      chirp.type = "sine";
      chirp.frequency.setValueAtTime(1100, now);
      chirp.frequency.exponentialRampToValueAtTime(750, now + 0.08);
      chirpGain.gain.setValueAtTime(0.08, now);
      chirpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      chirp.connect(chirpGain);
      chirpGain.connect(ctx.destination);
      chirp.start(now);
      chirp.stop(now + 0.1);

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

  // Handle calls (Teams / WhatsApp initiate)
  function handleStartCall(callType: "audio" | "video") {
    if (!directPartner) return;
    initiateCall(
      {
        id: currentUserId,
        name: staff?.name || "Staff Member",
        role: formatRoleName(currentUserRole),
      },
      {
        id: directPartner.id,
        name: directPartner.name,
        role: directPartner.roleName,
      },
      callType,
      selectedConvId,
    );
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
        message="Loading messages & communication channels"
        hint="Connecting to field dispatch directory and regional feeds…"
      />
    );
  }

  return (
    <div className="messages-hub-container">
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* LEFT SIDEBAR: Conversations & Directory Search                     */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <aside className={`messages-sidebar ${selectedConvId ? "mobile-hidden" : ""}`}>
        {/* Hub Header */}
        <div className="messages-sidebar-header">
          <div className="messages-header-top">
            <div className="messages-user-profile">
              <div className="messages-avatar user-self">
                {(staff?.name || "PE").slice(0, 2).toUpperCase()}
                <span className="online-dot" />
              </div>
              <div>
                <strong>{staff?.name || "Sales Staff"}</strong>
                <span className="user-role-label">{formatRoleName(currentUserRole)}</span>
              </div>
            </div>

            <div className="messages-header-actions">
              {isAdmin && (
                <button
                  type="button"
                  className="msg-hdr-btn settings-admin"
                  onClick={() => navigate("/settings?tab=communications")}
                  title="Communications & Calling Settings (Admin Only)"
                  style={{
                    background: "#0f172a",
                    color: "#ffffff",
                    borderColor: "#334155",
                    fontWeight: 600,
                  }}
                >
                  <Settings size={14} />
                  <span>Admin Settings</span>
                </button>
              )}
              {isManagement && moduleSettings.broadcastRolesAllowed.includes(currentUserRole) && (
                <button
                  type="button"
                  className="msg-hdr-btn broadcast"
                  onClick={() => setBroadcastModalOpen(true)}
                  title="Push Executive Broadcast / Directive to Field Staff"
                >
                  <Radio size={15} />
                  <span>Broadcast</span>
                </button>
              )}
              <button
                type="button"
                className="msg-hdr-btn"
                onClick={() => setNewChatModalOpen(true)}
                title="Start Direct Message with Staff"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Search box */}
          <div className="messages-search-wrap">
            <Search size={14} className="messages-search-icon" />
            <input
              type="text"
              placeholder="Search chats, staff, regions or keywords…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="messages-search-input"
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery("")} className="search-clear-btn">
                <X size={12} />
              </button>
            )}
          </div>

          {/* Navigation Category Tabs */}
          <div className="messages-nav-tabs">
            <button
              type="button"
              className={`nav-tab ${activeTab === "all" ? "active" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              All
            </button>
            <button
              type="button"
              className={`nav-tab ${activeTab === "announcement" ? "active" : ""}`}
              onClick={() => setActiveTab("announcement")}
            >
              📢 Bulletins
            </button>
            <button
              type="button"
              className={`nav-tab ${activeTab === "channel" ? "active" : ""}`}
              onClick={() => setActiveTab("channel")}
            >
              📍 Territory Hubs
            </button>
            <button
              type="button"
              className={`nav-tab ${activeTab === "direct" ? "active" : ""}`}
              onClick={() => setActiveTab("direct")}
            >
              Direct
            </button>
          </div>

          {/* Role Filter Chips */}
          <div className="messages-role-chips">
            <button
              type="button"
              className={`role-chip ${roleFilter === "all" ? "active" : ""}`}
              onClick={() => setRoleFilter("all")}
            >
              All Roles
            </button>
            <button
              type="button"
              className={`role-chip ${roleFilter === "brand_ambassador" ? "active" : ""}`}
              onClick={() => setRoleFilter(roleFilter === "brand_ambassador" ? "all" : "brand_ambassador")}
            >
              BAs
            </button>
            <button
              type="button"
              className={`role-chip ${roleFilter === "vsr" ? "active" : ""}`}
              onClick={() => setRoleFilter(roleFilter === "vsr" ? "all" : "vsr")}
            >
              VSRs
            </button>
            <button
              type="button"
              className={`role-chip ${roleFilter === "sales_executive" ? "active" : ""}`}
              onClick={() => setRoleFilter(roleFilter === "sales_executive" ? "all" : "sales_executive")}
            >
              SEs
            </button>
            <button
              type="button"
              className={`role-chip ${roleFilter === "regional_sales_manager" ? "active" : ""}`}
              onClick={() => setRoleFilter(roleFilter === "regional_sales_manager" ? "all" : "regional_sales_manager")}
            >
              RSMs
            </button>
          </div>
        </div>

        {/* Conversation List */}
        <div className="messages-list-scroll">
          {filteredConversations.length === 0 ? (
            <div className="messages-empty-list">
              <Users size={32} style={{ opacity: 0.35, marginBottom: 8 }} />
              <p>No conversations found</p>
              <button
                type="button"
                className="empty-cta-btn"
                onClick={() => setNewChatModalOpen(true)}
              >
                Start a New Message
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
                          conv.description || "Start communicating…"
                        )}
                      </span>

                      {conv.isPinned && <Pin size={11} className="pin-icon" />}
                      {hasUnread && <span className="unread-badge">{conv.unreadCount}</span>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MAIN CHAT STAGE: Active Chat, Smart Replies, Calls & Composer      */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <main className={`messages-main-panel ${!selectedConvId ? "mobile-hidden" : ""}`}>
        {activeConversation ? (
          <>
            {/* Stage Header */}
            <header className="chat-stage-header">
              <div className="chat-partner-info">
                {/* Mobile Back Button to Return to Chats List */}
                <button
                  type="button"
                  className="chat-mobile-back-btn"
                  onClick={() => setSelectedConvId("")}
                  title="Back to conversations"
                  aria-label="Back to conversations"
                >
                  <ChevronLeft size={19} />
                  <span>Chats</span>
                </button>

                <div className="chat-header-avatar">
                  {activeConversation.type === "announcement"
                    ? "📢"
                    : activeConversation.type === "channel"
                    ? "📍"
                    : (directPartner?.name || activeConversation.title).slice(0, 2).toUpperCase()}
                  {directPartner?.status === "online" && <span className="online-dot" />}
                </div>

                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <h2 className="chat-header-title">
                      {activeConversation.type === "direct" && directPartner
                        ? directPartner.name
                        : activeConversation.title}
                    </h2>
                    {directPartner && (
                      <span className="chat-header-role-badge">{directPartner.roleName}</span>
                    )}
                  </div>
                  <p className="chat-header-sub">
                    {activeConversation.type === "direct" && directPartner ? (
                      <>
                        <span className="status-label">
                          {directPartner.status === "online" ? "🟢 Active Now" : "⚪ Offline"}
                        </span>
                        {directPartner.region && ` · Territory: ${directPartner.region}`}
                      </>
                    ) : (
                      activeConversation.description
                    )}
                  </p>
                </div>
              </div>

              {/* Header Communication Actions */}
              <div className="chat-header-actions">
                {activeConversation.type === "direct" && directPartner && (
                  <>
                    {moduleSettings.allowVoiceCalls && (
                      <button
                        type="button"
                        className="chat-action-btn call"
                        onClick={() => handleStartCall("audio")}
                        title="Audio Call (Teams / WhatsApp WebRTC)"
                      >
                        <Phone size={16} />
                        <span className="btn-label">Voice Call</span>
                      </button>
                    )}

                    {moduleSettings.allowVideoCalls && (
                      <button
                        type="button"
                        className="chat-action-btn video"
                        onClick={() => handleStartCall("video")}
                        title="Video Call (Teams / WhatsApp WebRTC)"
                      >
                        <Video size={16} />
                        <span className="btn-label">Video Call</span>
                      </button>
                    )}
                  </>
                )}

                <button
                  type="button"
                  className={`chat-action-btn icon-only ${showRightPanel ? "active" : ""}`}
                  onClick={() => setShowRightPanel(!showRightPanel)}
                  title="Toggle Contact & Media Details"
                >
                  <Info size={17} />
                </button>
              </div>
            </header>

            {/* Pinned Broadcast Banner (If Announcement Channel) */}
            {activeConversation.type === "announcement" && (
              <div className="chat-announcement-banner">
                <div className="banner-icon-wrap">
                  <Radio size={16} />
                </div>
                <div className="banner-text">
                  <strong>Official Field Directive Channel</strong>
                  <p>
                    All messages posted here are broadcast in real-time with high-priority push notifications to regional field teams, BAs, and Van Sales Reps.
                  </p>
                </div>
              </div>
            )}

            {/* Messages Scroll Area */}
            <div className="chat-messages-stream">
              <div className="chat-date-divider">
                <span>Today</span>
              </div>

              {messages.length === 0 ? (
                <div className="chat-messages-empty">
                  <Sparkles size={28} color="#059669" />
                  <h3>Start the conversation</h3>
                  <p>Send a direct message, outlet location pin, or voice note below.</p>
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

                        {/* Reply to snippet */}
                        {msg.replyTo && (
                          <div className="msg-reply-snippet">
                            <span className="reply-name">{msg.replyTo.senderName}</span>
                            <span className="reply-content">{msg.replyTo.content}</span>
                          </div>
                        )}

                        {/* Priority Badge */}
                        {msg.priority !== "normal" && (
                          <div className={`msg-priority-tag ${msg.priority}`}>
                            {msg.priority === "broadcast" ? "📢 EXECUTIVE BROADCAST" : "⚡ URGENT DIRECTIVE"}
                          </div>
                        )}

                        {/* Message Content */}
                        <div className="msg-body">
                          {isCallLog ? (
                            <div className="msg-call-log-card">
                              <PhoneCall size={16} color="#059669" />
                              <span>{msg.content}</span>
                            </div>
                          ) : (
                            <p className="msg-text-content">{msg.content}</p>
                          )}

                          {/* Attachment rendering */}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="msg-attachments-container">
                              {msg.attachments.map((att) => (
                                <div key={att.id} className={`msg-attachment-item ${att.type}`}>
                                  {att.type === "location" ? (
                                    <div className="msg-location-card">
                                      <div className="loc-icon-wrap">
                                        <Compass size={18} />
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
                                        onClick={() => handlePlayVoiceNote(att.id, att.url, att.data?.durationSecs || 3)}
                                        title={playingVoiceId === att.id ? "Pause Voice Note" : "Play Voice Note"}
                                        aria-label={playingVoiceId === att.id ? "Pause Voice Note" : "Play Voice Note"}
                                      >
                                        {playingVoiceId === att.id ? (
                                          <Pause size={13} fill="currentColor" />
                                        ) : (
                                          <Play size={13} fill="currentColor" />
                                        )}
                                      </button>
                                      <div className={`voice-waveform-preview ${playingVoiceId === att.id ? "animating" : ""}`}>
                                        <span className="wave-bar h-1" />
                                        <span className="wave-bar h-3" />
                                        <span className="wave-bar h-2" />
                                        <span className="wave-bar h-4" />
                                        <span className="wave-bar h-1" />
                                        <span className="wave-bar h-3" />
                                        <span className="wave-bar h-2" />
                                        <span className="wave-bar h-4" />
                                      </div>
                                      <span className="voice-duration">
                                        {playingVoiceId === att.id
                                          ? `${playbackProgress[att.id] || 0}s / ${att.data?.durationSecs || 3}s`
                                          : `${att.data?.durationSecs || 3}s`}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="msg-file-card">
                                      <FileText size={16} />
                                      <span>{att.name}</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Reactions and Message Footer */}
                        <div className="msg-footer">
                          <span className="msg-timestamp">
                            {new Date(msg.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>

                          {isMe && (
                            <span className="msg-delivery-status">
                              <CheckCheck
                                size={13}
                                className={`check-icon ${msg.status === "read" ? "read" : "delivered"}`}
                              />
                            </span>
                          )}

                          {/* Emoji quick reaction trigger */}
                          <div className="msg-reaction-trigger-wrap">
                            <button
                              type="button"
                              className="msg-reaction-add-btn"
                              onClick={() =>
                                setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)
                              }
                            >
                              <Smile size={12} />
                            </button>

                            {showEmojiPicker === msg.id && (
                              <div className="msg-reaction-picker-popover">
                                {REACTION_EMOJIS.map((emoji) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => {
                                      toggleMessageReaction(msg.id, emoji, currentUserId);
                                      setShowEmojiPicker(null);
                                    }}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Render active reaction chips */}
                        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                          <div className="msg-reactions-row">
                            {Object.entries(msg.reactions).map(([emoji, userIds]) => (
                              <button
                                key={emoji}
                                type="button"
                                className={`reaction-chip ${userIds.includes(currentUserId) ? "mine" : ""}`}
                                onClick={() => toggleMessageReaction(msg.id, emoji, currentUserId)}
                              >
                                <span>{emoji}</span>
                                <span className="reaction-count">{userIds.length}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Smart Reply Quick Response Bar (Teams/WhatsApp AI Suggestions) */}
            {moduleSettings.allowSmartReplies && (
              <div className="chat-smart-replies-bar">
                <span className="smart-replies-label">
                  <Sparkles size={12} color="#059669" /> Quick Smart Replies:
                </span>
                <div className="smart-chips-scroll">
                  {suggestions.map((reply, i) => (
                    <button
                      key={i}
                      type="button"
                      className="smart-reply-chip"
                      onClick={() => handleSendMessage(reply)}
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Composer Container */}
            <div className="chat-composer-wrap">
              {/* Reply Preview */}
              {replyTarget && (
                <div className="composer-reply-banner">
                  <div>
                    <strong>Replying to {replyTarget.senderName}</strong>
                    <p>{replyTarget.content.slice(0, 80)}</p>
                  </div>
                  <button type="button" onClick={() => setReplyTarget(null)}>
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Management Priority Bar */}
              {isManagement && (
                <div className="composer-priority-selector">
                  <span className="priority-label">Message Priority Mode:</span>
                  <button
                    type="button"
                    className={`priority-chip normal ${priorityMode === "normal" ? "active" : ""}`}
                    onClick={() => setPriorityMode("normal")}
                  >
                    Normal
                  </button>
                  <button
                    type="button"
                    className={`priority-chip urgent ${priorityMode === "urgent" ? "active" : ""}`}
                    onClick={() => setPriorityMode("urgent")}
                  >
                    ⚡ Urgent Push Notice
                  </button>
                  <button
                    type="button"
                    className={`priority-chip broadcast ${priorityMode === "broadcast" ? "active" : ""}`}
                    onClick={() => setPriorityMode("broadcast")}
                  >
                    📢 Broadcast Directive
                  </button>
                </div>
              )}

              {/* Main Composer Box */}
              <div className="chat-composer-box">
                {/* Attachments Trigger */}
                <div className="composer-attach-wrapper">
                  <button
                    type="button"
                    className="composer-action-btn"
                    onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                    title="Add Attachment"
                  >
                    <Paperclip size={18} />
                  </button>

                  {showAttachmentMenu && (
                    <div className="composer-attach-popover">
                      {moduleSettings.allowLocationSharing && (
                        <button
                          type="button"
                          onClick={handleShareLocation}
                          className="attach-item location"
                        >
                          <MapPin size={16} />
                          <div>
                            <strong>Current GPS Location</strong>
                            <span>Pin outlet coordinates</span>
                          </div>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="attach-item file"
                      >
                        <FileText size={16} />
                        <div>
                          <strong>Document / Invoice</strong>
                          <span>Upload PDF or spreadsheet</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        className="attach-item photo"
                      >
                        <ImageIcon size={16} />
                        <div>
                          <strong>Photo / Shelf Evidence</strong>
                          <span>Share store image</span>
                        </div>
                      </button>

                      <input
                        ref={fileInputRef}
                        type="file"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleSendMessage(`📎 Uploaded Document: ${file.name}`, [
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
                            handleSendMessage(`🖼️ Uploaded Photo: ${file.name}`, [
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

                {/* Voice Note Recording UI or Textarea */}
                {isRecordingVoice ? (
                  <div className="composer-voice-recording-stage">
                    <span className="voice-pulse-indicator" />
                    <strong>Recording voice note… ({recordDuration}s)</strong>
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
                        <Send size={14} /> Send Note
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <textarea
                      placeholder={`Message ${
                        activeConversation.type === "direct" && directPartner
                          ? directPartner.name
                          : activeConversation.title
                      }… (Press Enter to send)`}
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

                    {/* Voice Recording Button */}
                    {moduleSettings.allowVoiceNotes && (
                      <button
                        type="button"
                        className="composer-action-btn voice"
                        onClick={startVoiceRecording}
                        title="Record Voice Note"
                      >
                        <Mic size={18} />
                      </button>
                    )}

                    {/* Send Button */}
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
            </div>
          </>
        ) : (
          <div className="chat-empty-selection">
            <Users size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
            <h2>Select a conversation or staff member</h2>
            <p>Pick a territory group, all-hands channel, or direct message from the left sidebar.</p>
          </div>
        )}
      </main>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* RIGHT SIDEBAR: Contact Profile, Territory Info & Shared Media      */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {showRightPanel && activeConversation && (
        <aside className="messages-info-panel">
          <div className="info-panel-header">
            <h3>{activeConversation.type === "direct" ? "Contact Details" : "Channel Overview"}</h3>
            <button
              type="button"
              className="info-close-btn"
              onClick={() => setShowRightPanel(false)}
            >
              <X size={15} />
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
                  : "Field Fleet Communications Group"}
              </p>
            </div>

            {/* Quick Actions (Audio / Video Call) */}
            {activeConversation.type === "direct" && directPartner && (
              <div className="info-quick-actions">
                <button
                  type="button"
                  className="quick-call-btn"
                  onClick={() => handleStartCall("audio")}
                >
                  <Phone size={15} />
                  <span>Audio Call</span>
                </button>
                <button
                  type="button"
                  className="quick-call-btn"
                  onClick={() => handleStartCall("video")}
                >
                  <Video size={15} />
                  <span>Video Call</span>
                </button>
              </div>
            )}

            {/* Territory & Contact Metadata */}
            <div className="info-section">
              <span className="info-section-title">Territory &amp; Scope</span>
              <div className="info-detail-row">
                <MapPin size={14} color="#64748b" />
                <span>{directPartner?.region || "National Headquarters & All Regions"}</span>
              </div>
              {directPartner?.phone && (
                <div className="info-detail-row">
                  <Phone size={14} color="#64748b" />
                  <span>{directPartner.phone}</span>
                </div>
              )}
            </div>

            {/* Shared Attachments & Tools */}
            <div className="info-section">
              <span className="info-section-title">Quick Actions</span>
              <button
                type="button"
                className="info-tool-btn"
                onClick={handleShareLocation}
              >
                <MapPin size={14} />
                <span>Share My Current GPS Coordinates</span>
              </button>
              <button
                type="button"
                className="info-tool-btn"
                onClick={() => {
                  const annConv = conversations.find((c) => c.type === "announcement");
                  if (annConv) setSelectedConvId(annConv.id);
                }}
              >
                <Radio size={14} />
                <span>View All-Hands Announcements</span>
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL 1: NEW DIRECT MESSAGE (Select Staff from Directory)           */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {newChatModalOpen && (
        <div className="comm-modal-backdrop">
          <div className="comm-dialog">
            <div className="comm-dialog-header">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Users size={18} color="#059669" />
                <h3 style={{ margin: 0 }}>Start Direct Message</h3>
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
              <p style={{ margin: "0 0 12px 0", fontSize: 13, color: "#64748b" }}>
                Select a staff member from the organization directory to open a 1-on-1 Teams/WhatsApp chat:
              </p>

              <div className="directory-list-scroll">
                {users
                  .filter((u) => u.id !== currentUserId)
                  .map((target) => (
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
                        <span className="dir-role">{target.roleName} · {target.region}</span>
                      </div>
                      <ChevronRight size={16} color="#94a3b8" />
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL 2: EXECUTIVE BROADCAST PUSH MODAL (Admin / HR / RSM / SE)    */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {broadcastModalOpen && (
        <div className="comm-modal-backdrop">
          <div className="comm-dialog broadcast">
            <div className="comm-dialog-header">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Radio size={18} color="#d97706" />
                <h3 style={{ margin: 0 }}>Push Executive Broadcast to Field Staff</h3>
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
              <p style={{ margin: "0 0 14px 0", fontSize: 13, color: "#64748b" }}>
                Send an instant high-priority directive with audio chime and in-app banner to BAs, Van Sales Reps, and Supervisors:
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    Broadcast Headline / Topic
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Q4 Target Directive or Price Adjustment Notice"
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    Target Audience
                  </label>
                  <select
                    value={broadcastTargetRole}
                    onChange={(e) => setBroadcastTargetRole(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                  >
                    <option value="all">Entire Company (All Staff &amp; Roles)</option>
                    <option value="brand_ambassador">All Brand Ambassadors (BAs)</option>
                    <option value="vsr">All Van Sales Reps (VSRs)</option>
                    <option value="sales_executive">All Sales Executives (SEs)</option>
                    <option value="regional_sales_manager">All Regional Sales Managers (RSMs)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    Directive Message Content
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Enter directive instructions, target figures, or instructions..."
                    value={broadcastContent}
                    onChange={(e) => setBroadcastContent(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
                <button
                  type="button"
                  onClick={() => setBroadcastModalOpen(false)}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!broadcastTitle.trim() || !broadcastContent.trim()}
                  onClick={handleSendBroadcast}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 8,
                    border: "none",
                    background: broadcastTitle.trim() && broadcastContent.trim() ? "#d97706" : "#cbd5e1",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: broadcastTitle.trim() && broadcastContent.trim() ? "pointer" : "not-allowed",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Radio size={14} /> Send Live Broadcast
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
