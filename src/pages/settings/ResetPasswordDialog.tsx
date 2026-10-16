import { useState } from "react";
import { X, Key, Mail, Check, Copy, Eye, EyeOff, ShieldAlert } from "lucide-react";
import {
  adminResetUserPassword,
  sendPasswordResetEmail,
  type UserAccount,
} from "../../services/userManagementService";

type ResetPasswordDialogProps = {
  user: UserAccount;
  onClose: () => void;
};

export function ResetPasswordDialog({ user, onClose }: ResetPasswordDialogProps) {
  const [activeTab, setActiveTab] = useState<"temp" | "email">("temp");
  const [tempPassword, setTempPassword] = useState("Penedge" + Math.floor(1000 + Math.random() * 9000) + "!");
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function handleGeneratePassword() {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
    let pass = "Pen";
    for (let i = 0; i < 8; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setTempPassword(pass);
  }

  function handleCopyPassword() {
    void navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  async function handleSetPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    setLoading(true);

    try {
      const res = await adminResetUserPassword(user.email, tempPassword);
      if (res.success) {
        setStatusMsg({
          type: "success",
          text: `Password for ${user.name} has been set to: ${tempPassword}`,
        });
      } else {
        setStatusMsg({ type: "error", text: res.message });
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSendEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    setLoading(true);

    try {
      const res = await sendPasswordResetEmail(user.email);
      if (res.success) {
        setStatusMsg({
          type: "success",
          text: `Password reset email sent to ${user.email}.`,
        });
      } else {
        setStatusMsg({ type: "error", text: res.message });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="new-sale-backdrop" role="presentation">
      <section
        className="user-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-password-title"
        style={{ maxWidth: "480px" }}
      >
        <header className="user-modal-header">
          <div>
            <h3 id="reset-password-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Key size={20} style={{ color: "#075544" }} />
              Reset User Password
            </h3>
            <p>Update credentials or trigger a password reset link for {user.name}</p>
          </div>
          <button type="button" className="user-modal-close" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </header>

        <div className="user-modal-body">
          {/* User info card */}
          <div className="user-identity-card" style={{ marginBottom: "1.25rem" }}>
            <div>
              <strong className="user-identity-name">{user.name}</strong>
              <span className="user-identity-email">{user.email}</span>
            </div>
          </div>

          {/* Action Mode Tabs */}
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              background: "#f1f5f9",
              padding: "4px",
              borderRadius: "8px",
              marginBottom: "1.25rem",
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
                padding: "8px 12px",
                border: "none",
                borderRadius: "6px",
                fontSize: "0.85rem",
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
                padding: "8px 12px",
                border: "none",
                borderRadius: "6px",
                fontSize: "0.85rem",
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
              Send Reset Email
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
              }}
              role="alert"
            >
              <ShieldAlert size={16} />
              <span>{statusMsg.text}</span>
            </div>
          )}

          {activeTab === "temp" ? (
            <form onSubmit={handleSetPasswordSubmit}>
              <div className="user-form-section">
                <label className="user-field-label">New Password</label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <div style={{ position: "relative", flex: 1 }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      className="user-modal-input"
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                      required
                      minLength={6}
                      style={{ paddingRight: "36px" }}
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
                    title="Generate Random Password"
                    style={{ whiteSpace: "nowrap", padding: "0 12px", fontSize: "0.8rem" }}
                  >
                    Generate
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleCopyPassword}
                    title="Copy Password"
                    style={{ whiteSpace: "nowrap", padding: "0 12px" }}
                  >
                    {copied ? <Check size={14} style={{ color: "#16a34a" }} /> : <Copy size={14} />}
                  </button>
                </div>
                <p className="user-field-hint" style={{ marginTop: "4px" }}>
                  Share this temporary password with {user.name} so they can log in and update their password.
                </p>
              </div>

              <div className="user-modal-footer">
                <button type="button" className="secondary-button" onClick={onClose} disabled={loading}>
                  Close
                </button>
                <button type="submit" className="primary-button" disabled={loading || !tempPassword.trim()}>
                  <Key size={14} />
                  <span>{loading ? "Updating..." : "Update Password"}</span>
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSendEmailSubmit}>
              <div className="user-form-section">
                <p style={{ fontSize: "0.88rem", color: "#475569", lineHeight: 1.5, margin: 0 }}>
                  A password reset email with a secure link will be sent to <strong>{user.email}</strong>. The user can click the link to set their new password.
                </p>
              </div>

              <div className="user-modal-footer">
                <button type="button" className="secondary-button" onClick={onClose} disabled={loading}>
                  Close
                </button>
                <button type="submit" className="primary-button" disabled={loading}>
                  <Mail size={14} />
                  <span>{loading ? "Sending Email..." : "Send Reset Email"}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
