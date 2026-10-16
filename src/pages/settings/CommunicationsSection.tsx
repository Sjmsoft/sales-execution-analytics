import { useState } from "react";
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
} from "lucide-react";
import {
  getMessagingSettings,
  saveMessagingSettings,
  resetMessagingSettingsToDefault,
  playMessageNotificationSound,
  previewTestRingtone,
  type MessagingModuleSettings,
} from "../../services/messagingService";

const AVAILABLE_BROADCAST_ROLES = [
  { key: "administrator", name: "System Administrator" },
  { key: "hr", name: "Human Resources (HR)" },
  { key: "national_sales_manager", name: "National Sales Manager (NSM)" },
  { key: "regional_sales_manager", name: "Regional Sales Manager (RSM)" },
  { key: "sales_executive", name: "Sales Executive (SE)" },
];

export function CommunicationsSection() {
  const [settings, setSettings] = useState<MessagingModuleSettings>(() => getMessagingSettings());
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");
  const [newChipText, setNewChipText] = useState("");

  const updateSetting = <K extends keyof MessagingModuleSettings>(
    key: K,
    value: MessagingModuleSettings[K],
  ) => {
    const updated = saveMessagingSettings({ [key]: value });
    setSettings(updated);
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2500);
  };

  const handleToggleBroadcastRole = (roleKey: string) => {
    const current = settings.broadcastRolesAllowed;
    const next = current.includes(roleKey)
      ? current.filter((r) => r !== roleKey)
      : [...current, roleKey];
    updateSetting("broadcastRolesAllowed", next);
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
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
    }
  };

  return (
    <div className="settings-section-content" style={{ padding: "0 0 40px 0" }}>
      {/* ── Page Header & Save Status ── */}
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
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
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
                Communications & Calling Settings
              </h2>
              <p style={{ margin: "2px 0 0 0", fontSize: "0.85rem", color: "#64748b" }}>
                Admin governance for real-time Teams/WhatsApp messaging, voice &amp; video calls, smart chips, and executive directives.
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
          marginBottom: 24,
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
              <strong style={{ fontSize: 14, color: "#f8fafc" }}>Administrator Guard Active</strong>
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
                Admin Restricted
              </span>
            </div>
            <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "#94a3b8" }}>
              Only Administrator accounts can configure field calling parameters, role permissions, and retention rules.
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
              {settings.enabled ? "Active for All Users" : "Disabled Globally"}
            </strong>
          </label>
        </div>
      </div>

      {/* ── Section 1: Calling Capabilities (Audio / Video / Quality) ── */}
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
              Field Voice &amp; Video Calling Engine
            </h3>
            <p style={{ margin: "2px 0 0 0", fontSize: "0.8rem", color: "#64748b" }}>
              Configure peer-to-peer WebRTC calls between managers and field reps (BAs/VSRs/SEs).
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {/* Allow Voice Calls */}
          <div
            style={{
              padding: 16,
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              background: settings.allowVoiceCalls ? "#f8fafc" : "#fff1f2",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Phone size={15} color="#059669" />
                <strong style={{ fontSize: 13, color: "#1e293b" }}>Voice Calling</strong>
              </div>
              <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#64748b" }}>
                Permit field reps &amp; managers to place 1-on-1 audio calls with active waveform equalizers.
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.allowVoiceCalls}
              onChange={(e) => updateSetting("allowVoiceCalls", e.target.checked)}
              style={{ width: 18, height: 18, accentColor: "#059669", cursor: "pointer", marginTop: 2 }}
            />
          </div>

          {/* Allow Video Calls */}
          <div
            style={{
              padding: 16,
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              background: settings.allowVideoCalls ? "#f8fafc" : "#fff1f2",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Video size={15} color="#0284c7" />
                <strong style={{ fontSize: 13, color: "#1e293b" }}>Video Calling</strong>
              </div>
              <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#64748b" }}>
                Allow video calls for live retail shelf inspections, POS audits, and virtual standups.
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.allowVideoCalls}
              onChange={(e) => updateSetting("allowVideoCalls", e.target.checked)}
              style={{ width: 18, height: 18, accentColor: "#059669", cursor: "pointer", marginTop: 2 }}
            />
          </div>

          {/* Ringing Timeout Duration */}
          <div
            style={{
              padding: 16,
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
            }}
          >
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
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
                padding: "0 10px",
                fontSize: 13,
                background: "#ffffff",
                cursor: "pointer",
              }}
            >
              <option value={15}>15 Seconds (Quick Disconnect)</option>
              <option value={30}>30 Seconds (Standard Teams Default)</option>
              <option value={45}>45 Seconds (Extended Field Ring)</option>
              <option value={60}>60 Seconds (Maximum Patience)</option>
            </select>
            <span style={{ fontSize: 11, color: "#64748b", marginTop: 4, display: "block" }}>
              Call cancels automatically if unanswered by remote party.
            </span>
          </div>

          {/* Audio Bitrate / Quality Mode */}
          <div
            style={{
              padding: 16,
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
            }}
          >
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
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
                padding: "0 10px",
                fontSize: 13,
                background: "#ffffff",
                cursor: "pointer",
              }}
            >
              <option value="low_bandwidth">Low Bandwidth (2G/3G Remote Trade Areas)</option>
              <option value="standard">Standard Adaptive (Recommended for 4G LTE)</option>
              <option value="high_definition">High Definition (HD Wideband Opus)</option>
            </select>
            <span style={{ fontSize: 11, color: "#64748b", marginTop: 4, display: "block" }}>
              Optimizes codec packet size for trade territories with spotty data.
            </span>
          </div>
        </div>
      </div>

      {/* ── Section 2: Smart AI Chips & Media Capabilities ── */}
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
              Smart Replies, Voice Notes &amp; GPS Pin Sharing
            </h3>
            <p style={{ margin: "2px 0 0 0", fontSize: "0.8rem", color: "#64748b" }}>
              Configure operational shortcuts that make trade communication fast and effortless for reps on foot.
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginBottom: 18 }}>
          {/* Allow Smart Replies */}
          <div
            style={{
              padding: 14,
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <strong style={{ fontSize: 13, color: "#1e293b", display: "flex", alignItems: "center", gap: 6 }}>
                <Sparkles size={14} color="#d97706" /> Smart Reply Chips
              </strong>
              <span style={{ fontSize: 11, color: "#64748b" }}>Shows 1-tap fast response chips</span>
            </div>
            <input
              type="checkbox"
              checked={settings.allowSmartReplies}
              onChange={(e) => updateSetting("allowSmartReplies", e.target.checked)}
              style={{ width: 18, height: 18, accentColor: "#059669", cursor: "pointer" }}
            />
          </div>

          {/* Allow Voice Notes */}
          <div
            style={{
              padding: 14,
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <strong style={{ fontSize: 13, color: "#1e293b", display: "flex", alignItems: "center", gap: 6 }}>
                <Mic size={14} color="#059669" /> Voice Note Audio
              </strong>
              <span style={{ fontSize: 11, color: "#64748b" }}>Push-to-talk audio memos</span>
            </div>
            <input
              type="checkbox"
              checked={settings.allowVoiceNotes}
              onChange={(e) => updateSetting("allowVoiceNotes", e.target.checked)}
              style={{ width: 18, height: 18, accentColor: "#059669", cursor: "pointer" }}
            />
          </div>

          {/* Allow Location Sharing */}
          <div
            style={{
              padding: 14,
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <strong style={{ fontSize: 13, color: "#1e293b", display: "flex", alignItems: "center", gap: 6 }}>
                <MapPin size={14} color="#dc2626" /> GPS Location Pins
              </strong>
              <span style={{ fontSize: 11, color: "#64748b" }}>Share trade coordinates in chat</span>
            </div>
            <input
              type="checkbox"
              checked={settings.allowLocationSharing}
              onChange={(e) => updateSetting("allowLocationSharing", e.target.checked)}
              style={{ width: 18, height: 18, accentColor: "#059669", cursor: "pointer" }}
            />
          </div>
        </div>

        {/* Smart Replies Chip Manager */}
        {settings.allowSmartReplies && (
          <div
            style={{
              background: "#f8fafc",
              borderRadius: 10,
              padding: 16,
              border: "1px solid #e2e8f0",
            }}
          >
            <strong style={{ fontSize: 13, color: "#0f172a", display: "block", marginBottom: 8 }}>
              Active Smart Reply Presets (Click &times; to remove):
            </strong>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {settings.smartRepliesList.map((chip) => (
                <span
                  key={chip}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    borderRadius: 20,
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#334155",
                  }}
                >
                  {chip}
                  <button
                    type="button"
                    onClick={() => handleRemoveChip(chip)}
                    style={{
                      border: "none",
                      background: "none",
                      color: "#94a3b8",
                      cursor: "pointer",
                      padding: 0,
                      fontSize: 14,
                      lineHeight: 1,
                      fontWeight: 700,
                    }}
                    title="Remove chip"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, maxWidth: 500 }}>
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
                  flex: 1,
                  height: 36,
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  padding: "0 10px",
                  fontSize: 13,
                }}
              />
              <button
                type="button"
                onClick={handleAddChip}
                style={{
                  height: 36,
                  padding: "0 14px",
                  borderRadius: 8,
                  background: "#059669",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Plus size={14} /> Add Chip
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Section 3: Executive Broadcast Directives & Role Access ── */}
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
              Push Notification Directives &amp; Role Permissions
            </h3>
            <p style={{ margin: "2px 0 0 0", fontSize: "0.8rem", color: "#64748b" }}>
              Control which leadership roles are authorized to push high-priority alerts to the field fleet.
            </p>
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 8 }}>
            Roles Authorized to Broadcast Urgent Directives:
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
            {AVAILABLE_BROADCAST_ROLES.map((role) => {
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
                      Key: <code>{role.key}</code>
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
          {/* Toast Auto Dismiss Duration */}
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

          {/* Retention Policy */}
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
          </div>
        </div>
      </div>

      {/* ── Section 4: Interactive Web Audio Synthesizer Testing ── */}
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
    </div>
  );
}
