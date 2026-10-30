import { useMemo, useState } from "react";
import {
  X,
  Key,
  Mail,
  Check,
  Copy,
  Eye,
  EyeOff,
  ShieldAlert,
  MessageSquare,
  Smartphone,
  Send,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import {
  adminResetUserPassword,
  sendPasswordResetEmail,
  buildPasswordResetShareLinks,
  formatWhatsAppPhone,
  SYSTEM_ROLES,
  type UserAccount,
} from "../../services/userManagementService";
import { addNotification } from "../../services/notificationService";

type ResetPasswordDialogProps = {
  user: UserAccount;
  onClose: () => void;
};

export function ResetPasswordDialog({ user, onClose }: ResetPasswordDialogProps) {
  const [activeTab, setActiveTab] = useState<"temp" | "email">("temp");
  const [tempPassword, setTempPassword] = useState(
    () => "PenEdge" + Math.floor(1000 + Math.random() * 9000) + "!"
  );
  const [phoneInput, setPhoneInput] = useState(user.phone || "");
  const [mustChangeOnLogin, setMustChangeOnLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(true);
  const [copiedPw, setCopiedPw] = useState(false);
  const [copiedCard, setCopiedCard] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailLinkSending, setEmailLinkSending] = useState(false);
  const [passwordWasReset, setPasswordWasReset] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const roleDef = useMemo(
    () => SYSTEM_ROLES.find((r) => r.key === user.role_key),
    [user.role_key]
  );

  const passwordStrength = useMemo(() => {
    const pw = tempPassword;
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 1) return { label: "Weak", color: "#dc2626", bg: "#fef2f2" };
    if (score <= 2) return { label: "Fair", color: "#d97706", bg: "#fffbeb" };
    if (score === 3) return { label: "Good", color: "#0284c7", bg: "#f0f9ff" };
    return { label: "Strong", color: "#059669", bg: "#ecfdf5" };
  }, [tempPassword]);

  const shareLinks = useMemo(
    () =>
      buildPasswordResetShareLinks({
        name: user.name,
        email: user.email,
        phone: phoneInput,
        tempPassword,
        mode: activeTab === "temp" ? "temp_password" : "reset_link",
        mustChangeOnLogin,
      }),
    [user.name, user.email, phoneInput, tempPassword, activeTab, mustChangeOnLogin]
  );

  const formattedWhatsappDigits = useMemo(() => formatWhatsAppPhone(phoneInput), [phoneInput]);

  function handleGeneratePassword() {
    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const lower = "abcdefghijkmnopqrstuvwxyz";
    const nums = "23456789";
    const syms = "!@#$%&*";
    let pass =
      "Pen" +
      upper.charAt(Math.floor(Math.random() * upper.length)) +
      lower.charAt(Math.floor(Math.random() * lower.length));
    for (let i = 0; i < 4; i++) {
      pass += nums.charAt(Math.floor(Math.random() * nums.length));
    }
    pass += syms.charAt(Math.floor(Math.random() * syms.length));
    setTempPassword(pass);
    setPasswordWasReset(false);
  }

  function handleCopyPassword() {
    void navigator.clipboard.writeText(tempPassword);
    setCopiedPw(true);
    setTimeout(() => setCopiedPw(false), 2500);
  }

  function handleCopyFullInstructions() {
    void navigator.clipboard.writeText(shareLinks.plainTextMessage);
    setCopiedCard(true);
    setTimeout(() => setCopiedCard(false), 2500);
  }

  async function handleSetPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    setLoading(true);

    try {
      const res = await adminResetUserPassword(user.email, tempPassword, {
        mustChangeOnLogin,
        phone: phoneInput,
        userId: user.id,
      });
      if (res.success) {
        setPasswordWasReset(true);
        setStatusMsg({
          type: "success",
          text: res.message,
        });
        addNotification({
          title: `Password Reset: ${user.name}`,
          message: `Temporary password set for ${user.name} (${user.email}). Ready to dispatch via Email, WhatsApp, or SMS.`,
          type: "system",
          priority: "high",
        });
      } else {
        setStatusMsg({ type: "error", text: res.message });
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSendEmailLink(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setStatusMsg(null);
    setEmailLinkSending(true);

    try {
      const res = await sendPasswordResetEmail(user.email);
      if (res.success) {
        setStatusMsg({
          type: "success",
          text: `Official password reset link dispatched to ${user.email}. You can also notify ${user.name} on WhatsApp or SMS below.`,
        });
        addNotification({
          title: `Reset Link Sent: ${user.name}`,
          message: `Password recovery link was emailed to ${user.email}.`,
          type: "system",
          priority: "high",
        });
      } else {
        setStatusMsg({ type: "error", text: res.message });
      }
    } finally {
      setEmailLinkSending(false);
    }
  }

  function handleOpenWhatsApp() {
    window.open(shareLinks.whatsappUrl, "_blank", "noopener,noreferrer");
  }

  function handleOpenSms() {
    window.location.href = shareLinks.smsUrl;
  }

  function handleOpenMailClient() {
    window.location.href = shareLinks.mailtoUrl;
  }

  return (
    <div className="new-sale-backdrop" role="presentation" onClick={onClose}>
      <section
        className="user-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-password-title"
        style={{ maxWidth: "560px", width: "95%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="user-modal-header">
          <div>
            <h3 id="reset-password-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Key size={20} style={{ color: "#075544" }} />
              Reset &amp; Dispatch User Password
            </h3>
            <p>Reset credentials and send via Email, Phone SMS, or WhatsApp to {user.name}</p>
          </div>
          <button type="button" className="user-modal-close" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </header>

        <div className="user-modal-body" style={{ maxHeight: "80vh", overflowY: "auto" }}>
          {/* User Identity & Contact Card */}
          <div
            className="user-identity-card"
            style={{
              marginBottom: "1rem",
              display: "flex",
              flexDirection: "column",
              alignItems: "stretch",
              gap: "10px",
              padding: "14px 16px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <strong className="user-identity-name" style={{ fontSize: "0.95rem", color: "#0f172a" }}>
                    {user.name}
                  </strong>
                  {roleDef && (
                    <span
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: "999px",
                        background: roleDef.badgeBg,
                        color: roleDef.badgeText,
                      }}
                    >
                      {roleDef.shortName}
                    </span>
                  )}
                </div>
                <span className="user-identity-email" style={{ fontSize: "0.8rem", color: "#475569" }}>
                  {user.email} {user.region ? `• ${user.region}` : ""}
                </span>
              </div>
              {passwordWasReset && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "0.73rem",
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: "999px",
                    background: "#dcfce7",
                    color: "#166534",
                  }}
                >
                  <CheckCircle2 size={13} /> Password Reset Active
                </span>
              )}
            </div>

            {/* Recipient Phone / WhatsApp Number Input */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <label
                htmlFor="reset-user-phone"
                style={{ fontSize: "0.76rem", fontWeight: 600, color: "#475569", minWidth: "145px" }}
              >
                Phone / WhatsApp Number:
              </label>
              <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
                <Smartphone
                  size={14}
                  style={{
                    position: "absolute",
                    left: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#64748b",
                  }}
                />
                <input
                  id="reset-user-phone"
                  type="tel"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="e.g. +234 803 000 0000 or 08030000000"
                  style={{
                    width: "100%",
                    padding: "7px 10px 7px 30px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.82rem",
                    background: "#ffffff",
                    color: "#0f172a",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              {formattedWhatsappDigits && (
                <span style={{ fontSize: "0.72rem", color: "#059669", fontWeight: 600 }}>
                  +{formattedWhatsappDigits}
                </span>
              )}
            </div>
          </div>

          {/* Action Mode Tabs */}
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              background: "#f1f5f9",
              padding: "4px",
              borderRadius: "10px",
              marginBottom: "1.1rem",
            }}
          >
            <button
              type="button"
              onClick={() => {
                setActiveTab("temp");
                setStatusMsg(null);
              }}
              style={{
                flex: 1,
                padding: "9px 12px",
                border: "none",
                borderRadius: "7px",
                fontSize: "0.83rem",
                fontWeight: 600,
                cursor: "pointer",
                background: activeTab === "temp" ? "#ffffff" : "transparent",
                color: activeTab === "temp" ? "#075544" : "#64748b",
                boxShadow: activeTab === "temp" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              <Key size={14} />
              Set Temporary Password
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("email");
                setStatusMsg(null);
              }}
              style={{
                flex: 1,
                padding: "9px 12px",
                border: "none",
                borderRadius: "7px",
                fontSize: "0.83rem",
                fontWeight: 600,
                cursor: "pointer",
                background: activeTab === "email" ? "#ffffff" : "transparent",
                color: activeTab === "email" ? "#075544" : "#64748b",
                boxShadow: activeTab === "email" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              <Mail size={14} />
              Send Email Reset Link
            </button>
          </div>

          {statusMsg && (
            <div
              className={`user-hierarchy-error-banner ${statusMsg.type === "success" ? "success" : ""}`}
              style={{
                background: statusMsg.type === "success" ? "#f0fdf4" : "#fef2f2",
                borderColor: statusMsg.type === "success" ? "#bbf7d0" : "#fecaca",
                color: statusMsg.type === "success" ? "#166534" : "#991b1b",
                marginBottom: "1rem",
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
              }}
              role="alert"
            >
              {statusMsg.type === "success" ? (
                <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              ) : (
                <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              )}
              <span style={{ fontSize: "0.82rem", lineHeight: 1.45 }}>{statusMsg.text}</span>
            </div>
          )}

          {activeTab === "temp" ? (
            <form onSubmit={handleSetPasswordSubmit}>
              <div className="user-form-section" style={{ marginBottom: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                  <label className="user-field-label" style={{ margin: 0 }}>
                    Temporary / New Password
                  </label>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: "999px",
                      background: passwordStrength.bg,
                      color: passwordStrength.color,
                    }}
                  >
                    Strength: {passwordStrength.label}
                  </span>
                </div>

                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <div style={{ position: "relative", flex: 1 }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      className="user-modal-input"
                      value={tempPassword}
                      onChange={(e) => {
                        setTempPassword(e.target.value);
                        setPasswordWasReset(false);
                      }}
                      required
                      minLength={6}
                      style={{ paddingRight: "36px", fontFamily: "monospace", fontWeight: 600 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: "absolute",
                        right: "10px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        color: "#64748b",
                        cursor: "pointer",
                      }}
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleGeneratePassword}
                    title="Generate New Strong Password"
                    style={{ whiteSpace: "nowrap", padding: "0 12px", fontSize: "0.8rem", display: "inline-flex", alignItems: "center", gap: 5 }}
                  >
                    <RefreshCw size={13} />
                    Generate
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleCopyPassword}
                    title="Copy Password"
                    style={{ whiteSpace: "nowrap", padding: "0 12px" }}
                  >
                    {copiedPw ? <Check size={14} style={{ color: "#16a34a" }} /> : <Copy size={14} />}
                  </button>
                </div>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginTop: "10px",
                    fontSize: "0.81rem",
                    color: "#334155",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={mustChangeOnLogin}
                    onChange={(e) => setMustChangeOnLogin(e.target.checked)}
                    style={{ accentColor: "#075544", width: 15, height: 15 }}
                  />
                  <span>Prompt {user.name} to change this temporary password after signing in</span>
                </label>

                <div style={{ marginTop: "12px", display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={loading || !tempPassword.trim()}
                    style={{ width: "100%", justifyContent: "center", padding: "10px 16px" }}
                  >
                    <Key size={15} />
                    <span>
                      {loading
                        ? "Applying Password Reset..."
                        : passwordWasReset
                          ? "Re-Apply Temporary Password"
                          : `Apply Reset Password for ${user.name}`}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="user-form-section" style={{ marginBottom: "1rem" }}>
              <p style={{ fontSize: "0.85rem", color: "#475569", lineHeight: 1.5, margin: "0 0 12px 0" }}>
                Send an automated password recovery email to <strong>{user.email}</strong>. Clicking the link in the email allows {user.name} to set a new password directly.
              </p>
              <button
                type="button"
                className="primary-button"
                onClick={() => void handleSendEmailLink()}
                disabled={emailLinkSending}
                style={{ width: "100%", justifyContent: "center", padding: "10px 16px" }}
              >
                <Mail size={15} />
                <span>{emailLinkSending ? "Dispatching Reset Email..." : `Send Automated Reset Link to ${user.email}`}</span>
              </button>
            </div>
          )}

          {/* ── Multi-Channel Dispatch Center (Email, WhatsApp, SMS, Copy) ── */}
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              padding: "14px 16px",
              marginTop: "0.5rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Send Reset Credentials to User
              </span>
              <span style={{ fontSize: "0.73rem", color: "#64748b" }}>
                Email • WhatsApp • Phone SMS
              </span>
            </div>

            <p style={{ fontSize: "0.78rem", color: "#475569", margin: "0 0 12px 0", lineHeight: 1.4 }}>
              {activeTab === "temp"
                ? `Deliver the temporary password (${tempPassword}) and sign-in instructions directly to ${user.name}:`
                : `Notify ${user.name} via WhatsApp, SMS, or Email client about their password reset:`}
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: "8px",
                marginBottom: "10px",
              }}
            >
              {/* 1. Send via WhatsApp */}
              <button
                type="button"
                onClick={handleOpenWhatsApp}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1px solid #16a34a",
                  background: "#16a34a",
                  color: "#ffffff",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                title={
                  formattedWhatsappDigits
                    ? `Send via WhatsApp to +${formattedWhatsappDigits}`
                    : "Open WhatsApp to send credentials"
                }
              >
                <MessageSquare size={14} />
                <span>Send to WhatsApp</span>
                <ExternalLink size={11} />
              </button>

              {/* 2. Send via Email */}
              <button
                type="button"
                onClick={handleOpenMailClient}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1px solid #0284c7",
                  background: "#0284c7",
                  color: "#ffffff",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                title={`Email credentials to ${user.email}`}
              >
                <Mail size={14} />
                <span>Send to Email</span>
                <ExternalLink size={11} />
              </button>

              {/* 3. Send via Phone SMS */}
              <button
                type="button"
                onClick={handleOpenSms}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1px solid #0f766e",
                  background: "#0f766e",
                  color: "#ffffff",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                title={
                  formattedWhatsappDigits
                    ? `Send SMS to +${formattedWhatsappDigits}`
                    : "Send SMS message"
                }
              >
                <Send size={14} />
                <span>Send Phone SMS</span>
              </button>
            </div>

            {/* Copy Full Credentials Card */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", paddingTop: "8px", borderTop: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                Or copy the formatted login message to paste anywhere:
              </span>
              <button
                type="button"
                onClick={handleCopyFullInstructions}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "6px 11px",
                  borderRadius: "7px",
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#0f172a",
                  fontSize: "0.76rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {copiedCard ? (
                  <>
                    <Check size={13} style={{ color: "#16a34a" }} />
                    <span style={{ color: "#16a34a" }}>Copied Message!</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>Copy Login Message</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="user-modal-footer" style={{ marginTop: "1rem" }}>
            <button type="button" className="secondary-button" onClick={onClose}>
              Done / Close
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
