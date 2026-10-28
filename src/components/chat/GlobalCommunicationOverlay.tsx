import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  MessageSquare,
  Radio,
} from "lucide-react";
import {
  getActiveCall,
  saveActiveCall,
  answerCall,
  endCall,
  toggleCallMute,
  toggleCallVideo,
  messagingEvents,
  getMessagingSettings,
  type MessagingModuleSettings,
  type CallSession,
  type ChatMessage,
} from "../../services/messagingService";
import { useAuth } from "../../context/AuthContext";

export default function GlobalCommunicationOverlay() {
  const navigate = useNavigate();
  const { staff } = useAuth();
  const currentUserId = staff?.id || "current-user";

  const [settings, setSettings] = useState<MessagingModuleSettings>(() => getMessagingSettings());
  const [activeCall, setActiveCall] = useState<CallSession | null>(() => getActiveCall());
  const [callDuration, setCallDuration] = useState(0);
  const [pushToast, setPushToast] = useState<ChatMessage | null>(null);

  const callTimerRef = useRef<number | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Sync settings updates
  useEffect(() => {
    const unsub = messagingEvents.on("settings_updated", (s: MessagingModuleSettings) => {
      setSettings(s);
    });
    return () => unsub();
  }, []);

  // Sync active call state & listen to real-time events
  useEffect(() => {
    const unsubCall = messagingEvents.on("call_state_changed", (call: CallSession | null) => {
      setActiveCall(call);
    });

    const unsubPush = messagingEvents.on("push_notification", (msg: ChatMessage) => {
      // Don't toast for self-sent messages
      if (msg.senderId !== currentUserId) {
        setPushToast(msg);
      }
    });

    return () => {
      unsubCall();
      unsubPush();
    };
  }, [currentUserId]);

  // Live call duration timer
  useEffect(() => {
    if (activeCall && activeCall.status === "connected") {
      callTimerRef.current = window.setInterval(() => {
        setCallDuration((d) => d + 1);
      }, 1000);
    } else {
      setCallDuration(0);
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    }
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, [activeCall?.status]);

  // Call ringing timeout & outgoing auto-connect
  useEffect(() => {
    if (!activeCall || activeCall.status !== "ringing") return;
    const isOutgoing = activeCall.callerId === currentUserId || activeCall.receiverId !== currentUserId;

    // Auto-connect outgoing calls after 2.5 seconds so voice/video calls become active immediately
    let connectTimer: number | undefined;
    if (isOutgoing) {
      connectTimer = window.setTimeout(() => {
        answerCall(activeCall.id);
      }, 2500);
    }

    const timeoutMs = (settings.callTimeoutSecs || 30) * 1000;
    const t = window.setTimeout(() => {
      endCall(activeCall.id, "missed");
    }, timeoutMs);

    return () => {
      if (connectTimer) window.clearTimeout(connectTimer);
      window.clearTimeout(t);
    };
  }, [activeCall?.id, activeCall?.status, activeCall?.callerId, activeCall?.receiverId, currentUserId, settings.callTimeoutSecs]);

  // Attach local camera stream during connected video calls
  useEffect(() => {
    let cancelled = false;
    const shouldStreamVideo =
      Boolean(activeCall) &&
      activeCall?.status === "connected" &&
      Boolean(activeCall?.isVideoEnabled);

    async function startCamera() {
      if (!shouldStreamVideo) {
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((tr) => tr.stop());
          localStreamRef.current = null;
        }
        return;
      }
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          if (cancelled) {
            stream.getTracks().forEach((tr) => tr.stop());
            return;
          }
          localStreamRef.current = stream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        }
      } catch {
        // Fallback to avatar placeholder if camera permission denied or unavailable
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((tr) => tr.stop());
        localStreamRef.current = null;
      }
    };
  }, [activeCall?.id, activeCall?.status, activeCall?.isVideoEnabled]);

  // Auto-dismiss push notification toast based on admin settings
  useEffect(() => {
    if (!pushToast) return;
    if (settings.autoDismissToastSecs === 0) return; // Persistent
    const t = window.setTimeout(() => setPushToast(null), (settings.autoDismissToastSecs || 7) * 1000);
    return () => window.clearTimeout(t);
  }, [pushToast, settings.autoDismissToastSecs]);

  if (!settings.enabled) {
    return null;
  }

  const isIncomingForMe =
    activeCall &&
    activeCall.status === "ringing" &&
    activeCall.receiverId === currentUserId &&
    activeCall.callerId !== currentUserId;
  const isOutgoingFromMe =
    activeCall &&
    activeCall.status === "ringing" &&
    !isIncomingForMe;
  const isCallConnected = activeCall && activeCall.status === "connected";

  function formatSecs(s: number) {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 1. INCOMING CALL MODAL (Teams & WhatsApp Ringing Screen)            */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {isIncomingForMe && (
        <div className="comm-call-modal-overlay">
          <div className="comm-call-modal incoming">
            <div className="comm-call-avatar-wrap pulse-ring">
              <div className="comm-call-avatar">
                {activeCall.callerName.slice(0, 2).toUpperCase()}
              </div>
            </div>

            <div className="comm-call-meta">
              <span className="comm-call-badge">
                {activeCall.callType === "video" ? <Video size={13} /> : <Phone size={13} />}
                <span>Incoming {activeCall.callType === "video" ? "Video" : "Voice"} Call</span>
              </span>
              <h2 className="comm-call-name">{activeCall.callerName}</h2>
              <p className="comm-call-role">{activeCall.callerRole}</p>
              <p className="comm-call-subtitle">Pen Edge Field Communications Hub</p>
            </div>

            <div className="comm-call-actions">
              <button
                type="button"
                className="comm-call-btn decline"
                onClick={() => endCall(activeCall.id, "declined")}
                title="Decline Call"
              >
                <PhoneOff size={24} />
                <span>Decline</span>
              </button>

              <button
                type="button"
                className="comm-call-btn accept"
                onClick={() => answerCall(activeCall.id)}
                title="Accept Call"
              >
                <PhoneCall size={24} />
                <span>Accept</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 2. OUTGOING CALLING MODAL (Ringing Remote Staff)                   */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {isOutgoingFromMe && (
        <div className="comm-call-modal-overlay">
          <div className="comm-call-modal outgoing">
            <div className="comm-call-avatar-wrap pulse-ring">
              <div className="comm-call-avatar">
                {activeCall.receiverName.slice(0, 2).toUpperCase()}
              </div>
            </div>

            <div className="comm-call-meta">
              <span className="comm-call-badge">
                <Radio size={13} className="spin-icon" />
                <span>Calling {activeCall.callType === "video" ? "Video" : "Audio"}…</span>
              </span>
              <h2 className="comm-call-name">{activeCall.receiverName}</h2>
              <p className="comm-call-role">{activeCall.receiverRole}</p>
              <p className="comm-call-subtitle">Connecting via Secure Field WebRTC…</p>
            </div>

            <div className="comm-call-actions">
              <button
                type="button"
                className="comm-call-btn decline"
                onClick={() => endCall(activeCall.id, "ended")}
                title="Cancel Call"
              >
                <PhoneOff size={24} />
                <span>Cancel</span>
              </button>

              <button
                type="button"
                className="comm-call-btn accept"
                onClick={() => answerCall(activeCall.id)}
                title="Connect Call Immediately"
              >
                <PhoneCall size={24} />
                <span>Connect Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 3. ACTIVE CONNECTED CALL SCREEN (Glassmorphism Teams/WhatsApp UI)   */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {isCallConnected && (
        <div className="comm-call-active-backdrop">
          <div className={`comm-call-active-window ${activeCall.callType === "video" ? "video-mode" : "audio-mode"}`}>
            {/* Header info */}
            <div className="comm-call-active-header">
              <div className="comm-call-header-left">
                <span className="comm-call-live-dot" />
                <strong>
                  {activeCall.callerId === currentUserId ? activeCall.receiverName : activeCall.callerName}
                </strong>
                <span className="comm-call-timer">{formatSecs(callDuration)}</span>
              </div>
              <button
                type="button"
                className="comm-call-header-mini-btn"
                onClick={() => navigate("/messages")}
                title="Open Chat In Background"
              >
                <MessageSquare size={16} />
              </button>
            </div>

            {/* Video or Audio Stage */}
            <div className="comm-call-stage">
              {activeCall.callType === "video" && activeCall.isVideoEnabled ? (
                <div className="comm-video-grid">
                  <div className="comm-video-main">
                    <div className="comm-video-placeholder">
                      <div className="comm-avatar-large">
                        {(activeCall.callerId === currentUserId
                          ? activeCall.receiverName
                          : activeCall.callerName
                        ).slice(0, 2).toUpperCase()}
                      </div>
                      <span className="comm-video-label">
                        {activeCall.callerId === currentUserId
                          ? activeCall.receiverName
                          : activeCall.callerName} (Connected Video Stream)
                      </span>
                    </div>
                  </div>

                  <div className="comm-video-pip" style={{ overflow: "hidden", position: "absolute" }}>
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        position: "absolute",
                        inset: 0,
                      }}
                    />
                    <div
                      className="comm-video-pip-content"
                      style={{
                        position: "relative",
                        zIndex: 2,
                        background: "rgba(15, 23, 42, 0.55)",
                        padding: "2px 8px",
                        borderRadius: 6,
                      }}
                    >
                      <span style={{ fontSize: 11, color: "#fff", fontWeight: 600 }}>You (Self View)</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="comm-audio-stage">
                  <div className="comm-audio-avatar-halo">
                    <div className="comm-audio-avatar">
                      {(activeCall.callerId === currentUserId
                        ? activeCall.receiverName
                        : activeCall.callerName
                      ).slice(0, 2).toUpperCase()}
                    </div>
                  </div>
                  <h3 className="comm-audio-title">
                    {activeCall.callerId === currentUserId ? activeCall.receiverName : activeCall.callerName}
                  </h3>
                  <p className="comm-audio-sub">
                    {activeCall.callerId === currentUserId ? activeCall.receiverRole : activeCall.callerRole}
                  </p>

                  {/* Equalizer waveform animation */}
                  <div className="comm-audio-waveform">
                    <span className="bar bar-1" />
                    <span className="bar bar-2" />
                    <span className="bar bar-3" />
                    <span className="bar bar-4" />
                    <span className="bar bar-5" />
                    <span className="bar bar-6" />
                    <span className="bar bar-7" />
                  </div>
                </div>
              )}
            </div>

            {/* In-Call Controls Bar */}
            <div className="comm-call-controls-bar">
              <button
                type="button"
                className={`comm-ctrl-btn ${activeCall.isMuted ? "active-off" : ""}`}
                onClick={() => toggleCallMute(activeCall.id)}
                title={activeCall.isMuted ? "Unmute Microphone" : "Mute Microphone"}
              >
                {activeCall.isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                <span>{activeCall.isMuted ? "Unmute" : "Mute"}</span>
              </button>

              <button
                type="button"
                className={`comm-ctrl-btn ${!activeCall.isVideoEnabled ? "active-off" : ""}`}
                onClick={() => toggleCallVideo(activeCall.id)}
                title={activeCall.isVideoEnabled ? "Turn Camera Off" : "Turn Camera On"}
              >
                {activeCall.isVideoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
                <span>{activeCall.isVideoEnabled ? "Camera" : "Camera Off"}</span>
              </button>

              <button
                type="button"
                className="comm-ctrl-btn"
                onClick={() => saveActiveCall({ ...activeCall, isSpeakerOn: !activeCall.isSpeakerOn })}
                title="Toggle Speaker"
              >
                {activeCall.isSpeakerOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
                <span>Speaker</span>
              </button>

              <button
                type="button"
                className="comm-ctrl-btn end-call"
                onClick={() => endCall(activeCall.id, "ended")}
                title="End Call"
              >
                <PhoneOff size={22} />
                <span>End</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 4. MANAGEMENT PUSH NOTIFICATION TOAST (Top-Right Floating Banner)  */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {pushToast && (
        <div className="comm-push-toast-wrapper">
          <div className={`comm-push-toast ${pushToast.priority}`}>
            <div className="comm-push-toast-header">
              <div className="comm-push-sender-info">
                <span className="comm-push-avatar">
                  {pushToast.senderName.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <strong>{pushToast.senderName}</strong>
                  <span className="comm-push-role"> · {pushToast.senderRole}</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className={`comm-push-priority-badge ${pushToast.priority}`}>
                  {pushToast.priority === "broadcast" ? "📢 BROADCAST" : "⚡ URGENT NOTICE"}
                </span>
                <button
                  type="button"
                  className="comm-push-close-btn"
                  onClick={() => setPushToast(null)}
                  aria-label="Dismiss toast"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <p className="comm-push-content">{pushToast.content}</p>

            <div className="comm-push-actions">
              <button
                type="button"
                className="comm-push-btn open"
                onClick={() => {
                  setPushToast(null);
                  navigate("/messages");
                }}
              >
                <MessageSquare size={13} />
                <span>Open in Messages Hub</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
