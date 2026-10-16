import { useState, useEffect } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Activity,
  MapPin,
  AlertCircle,
  X,
  Loader2,
  KeyRound,
  CheckCircle2,
  Sparkles,
  Shield,
  Zap,
} from "lucide-react";
import { signIn } from "../services/authService";
import { sendPasswordResetEmail } from "../services/userManagementService";
import "./Login.css";
import BrandLogo3D from "../components/brand/BrandLogo3D";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [capsLockActive, setCapsLockActive] = useState(false);

  // Forgot password modal state
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotStatus, setForgotStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Restore saved remember-me email on mount
  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem("pen_remembered_email");
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Handle password keydown to detect caps lock
  function handlePasswordKeyUp(e: KeyboardEvent<HTMLInputElement>) {
    if (e.getModifierState) {
      setCapsLockActive(e.getModifierState("CapsLock"));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter both your email/staff ID and password.");
      return;
    }

    setLoading(true);

    try {
      const result = await signIn(email.trim(), password);

      if (rememberMe) {
        try {
          localStorage.setItem("pen_remembered_email", email.trim());
        } catch {
          // Ignore storage write issues
        }
      } else {
        try {
          localStorage.removeItem("pen_remembered_email");
        } catch {
          // Ignore
        }
      }

      sessionStorage.setItem(
        "login-success",
        JSON.stringify({
          email: result.user?.email ?? email,
          signedInAt: new Date().toISOString(),
        })
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Invalid credentials. Please verify your email and password."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSendResetLink(e: FormEvent) {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setForgotStatus({ type: "error", msg: "Please enter your registered staff email address." });
      return;
    }

    setForgotLoading(true);
    setForgotStatus(null);

    try {
      const res = await sendPasswordResetEmail(forgotEmail.trim());
      if (res.success) {
        setForgotStatus({
          type: "success",
          msg: `Password reset link has been dispatched to ${forgotEmail}. Please check your inbox.`,
        });
      } else {
        setForgotStatus({
          type: "error",
          msg: res.message || "Unable to send reset email. Please contact your system administrator.",
        });
      }
    } catch (err: unknown) {
      setForgotStatus({
        type: "error",
        msg: err instanceof Error ? err.message : "Failed to trigger reset email.",
      });
    } finally {
      setForgotLoading(false);
    }
  }

  return (
    <div className="pen-login-page">
      <div className="pen-login-shell">
        {/* =========================================================
            LEFT PANEL: BRAND IDENTITY & LIVE ANALYTICS SHOWCASE
            ========================================================= */}
        <section className="pen-showcase-pane" aria-label="Pen Edge Platform Overview">
          {/* Top Brand Bar */}
          <div>
            <div className="pen-brand-header">
              <div className="pen-brand-logo">
                <div className="pen-logo-emblem" aria-hidden="true">
                  <BrandLogo3D size={34} tone="dark" motion="sway" />
                </div>
                <div className="pen-brand-text">
                  <strong>Pen Edge</strong>
                  <span>Enterprise Sales</span>
                </div>
              </div>

              <div className="pen-status-pill" title="All backend services active">
                <span className="pen-pulse-dot" />
                <span>Live System Synced</span>
              </div>
            </div>

            {/* Hero Pitch */}
            <div className="pen-showcase-hero">
              <div className="pen-showcase-tag">
                <Sparkles size={14} />
                <span>Sales Execution Intelligence</span>
              </div>
              <h2>
                Empower your field force with{" "}
                <span className="highlight-gradient">real-time precision</span>.
              </h2>
              <p>
                Seamlessly track retail execution, monitor geofenced store visits,
                and drive peak revenue targets across your entire regional network.
              </p>
            </div>

            {/* Live Interactive Preview Cards */}
            <div className="pen-showcase-cards">
              {/* Card 1: Revenue Momentum */}
              <div className="pen-metric-card">
                <div className="pen-metric-left">
                  <div className="pen-metric-icon-wrap sales" aria-hidden="true">
                    <TrendingUp size={18} />
                  </div>
                  <div className="pen-metric-info">
                    <span className="pen-metric-label">Sales Target Realization</span>
                    <span className="pen-metric-val">
                      ₦24.85M <small style={{ color: "#34d399", fontSize: "11px", fontWeight: 600 }}>• 88.4% of quota</small>
                    </span>
                  </div>
                </div>
                <span className="pen-metric-badge green">+18.2% vs target</span>
              </div>

              {/* Card 2: Field Force Live Attendance */}
              <div className="pen-metric-card">
                <div className="pen-metric-left">
                  <div className="pen-metric-icon-wrap activity" aria-hidden="true">
                    <Activity size={18} />
                  </div>
                  <div className="pen-metric-info">
                    <span className="pen-metric-label">Field Force Live Activity</span>
                    <span className="pen-metric-val">54 Active Reps On Route</span>
                  </div>
                </div>
                <span className="pen-metric-badge blue">168 Visits Today</span>
              </div>

              {/* Card 3: Geofence Verification */}
              <div className="pen-metric-card">
                <div className="pen-metric-left">
                  <div className="pen-metric-icon-wrap geo" aria-hidden="true">
                    <MapPin size={18} />
                  </div>
                  <div className="pen-metric-info">
                    <span className="pen-metric-label">Geofence GPS Verification</span>
                    <span className="pen-metric-val">99.4% Outlet Accuracy</span>
                  </div>
                </div>
                <span className="pen-metric-badge purple">Verified</span>
              </div>
            </div>
          </div>

          {/* Bottom Trust Assurance */}
          <div className="pen-showcase-trust">
            <div className="pen-trust-item">
              <ShieldCheck size={14} />
              <span>256-Bit SSL Encryption</span>
            </div>
            <div className="pen-trust-item">
              <Shield size={14} />
              <span>Role-Based Access (RBAC)</span>
            </div>
            <div className="pen-trust-item">
              <Zap size={14} />
              <span>Supabase Cloud Secured</span>
            </div>
          </div>
        </section>

        {/* =========================================================
            RIGHT PANEL: STREAMLINED MODERN SIGN-IN CONTAINER
            ========================================================= */}
        <section className="pen-auth-pane" aria-label="Staff Sign In Form">
          {/* Mobile-only logo */}
          <div className="pen-auth-mobile-brand">
            <div className="pen-logo-emblem" aria-hidden="true">
              <BrandLogo3D size={34} tone="dark" motion="sway" />
            </div>
            <div className="pen-brand-text">
              <strong>Pen Edge</strong>
              <span>Sales Execution</span>
            </div>
          </div>

          {/* Card Header */}
          <div className="pen-auth-header">
            <div className="pen-auth-badge">
              <KeyRound size={12} />
              <span>Staff Authentication</span>
            </div>
            <h1>Welcome back</h1>
            <p>Enter your staff credentials to access your sales workspace.</p>
          </div>

          {/* Sign In Form */}
          <form className="pen-auth-form" onSubmit={handleSubmit} noValidate>
            {/* Error Banner */}
            {error && (
              <div className="pen-error-banner" role="alert">
                <AlertCircle size={18} aria-hidden="true" />
                <div style={{ flex: 1 }}>{error}</div>
                <button
                  type="button"
                  onClick={() => setError("")}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#fca5a5",
                    cursor: "pointer",
                    padding: 0,
                  }}
                  aria-label="Dismiss error"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Email / Staff ID Field */}
            <div className="pen-field-group">
              <label htmlFor="staff-email-input" className="pen-field-label">
                Staff Email or ID
              </label>
              <div className="pen-input-box">
                <span className="pen-input-leading-icon" aria-hidden="true">
                  <Mail size={17} />
                </span>
                <input
                  id="staff-email-input"
                  type="email"
                  className="pen-text-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com or Staff ID"
                  autoComplete="email"
                  autoCapitalize="none"
                  required
                />
                {email && (
                  <button
                    type="button"
                    className="pen-input-trailing-btn"
                    onClick={() => setEmail("")}
                    aria-label="Clear email"
                    title="Clear input"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Password Field */}
            <div className="pen-field-group">
              <div className="pen-field-header">
                <label htmlFor="staff-password-input" className="pen-field-label">
                  Password
                </label>
                <button
                  type="button"
                  className="pen-forgot-link"
                  onClick={() => {
                    setForgotEmail(email);
                    setForgotStatus(null);
                    setForgotModalOpen(true);
                  }}
                >
                  Forgot password?
                </button>
              </div>

              <div className="pen-input-box">
                <span className="pen-input-leading-icon" aria-hidden="true">
                  <Lock size={17} />
                </span>
                <input
                  id="staff-password-input"
                  type={showPassword ? "text" : "password"}
                  className="pen-text-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyUp={handlePasswordKeyUp}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="pen-input-trailing-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>

              {capsLockActive && (
                <div className="pen-caps-warning">
                  <AlertCircle size={13} />
                  <span>Caps Lock is ON</span>
                </div>
              )}
            </div>

            {/* Remember Me Toggle */}
            <div className="pen-form-row">
              <label className="pen-remember-control">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span className="pen-custom-checkbox" aria-hidden="true">
                  <CheckCircle2 size={13} strokeWidth={3} />
                </span>
                <span className="pen-remember-text">Remember me on this device</span>
              </label>
            </div>

            {/* Submit CTA */}
            <button
              type="submit"
              className="pen-submit-btn"
              disabled={loading}
              id="login-submit-btn"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          {/* Card Footer */}
          <footer className="pen-auth-footer">
            <ShieldCheck size={13} style={{ color: "#10b981" }} />
            <span>Encrypted Connection</span>
            <span>•</span>
            <span>Pen Edge Analytics v1.0</span>
          </footer>
        </section>
      </div>

      {/* =========================================================
          FORGOT PASSWORD MODAL DIALOG
          ========================================================= */}
      {forgotModalOpen && (
        <div
          className="pen-modal-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setForgotModalOpen(false);
          }}
        >
          <div
            className="pen-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="forgot-modal-title"
          >
            <div className="pen-modal-header">
              <div className="pen-modal-title">
                <KeyRound size={20} style={{ color: "#38bdf8" }} />
                <h3 id="forgot-modal-title">Reset Your Password</h3>
              </div>
              <button
                type="button"
                className="pen-modal-close"
                onClick={() => setForgotModalOpen(false)}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <p className="pen-modal-desc">
              Enter your registered staff email address. We will send you a secure verification link to set up a new password.
            </p>

            {forgotStatus && (
              <div
                className={`pen-error-banner ${
                  forgotStatus.type === "success" ? "success-banner" : ""
                }`}
                style={{
                  background:
                    forgotStatus.type === "success"
                      ? "rgba(16, 185, 129, 0.15)"
                      : "rgba(239, 68, 68, 0.15)",
                  borderColor:
                    forgotStatus.type === "success"
                      ? "rgba(16, 185, 129, 0.4)"
                      : "rgba(239, 68, 68, 0.4)",
                  color: forgotStatus.type === "success" ? "#6ee7b7" : "#fca5a5",
                  marginBottom: "16px",
                }}
                role="alert"
              >
                {forgotStatus.type === "success" ? (
                  <CheckCircle2 size={18} style={{ color: "#10b981", flexShrink: 0 }} />
                ) : (
                  <AlertCircle size={18} style={{ color: "#ef4444", flexShrink: 0 }} />
                )}
                <div style={{ flex: 1 }}>{forgotStatus.msg}</div>
              </div>
            )}

            <form onSubmit={handleSendResetLink}>
              <div className="pen-field-group">
                <label htmlFor="reset-email-input" className="pen-field-label">
                  Staff Email Address
                </label>
                <div className="pen-input-box">
                  <span className="pen-input-leading-icon" aria-hidden="true">
                    <Mail size={17} />
                  </span>
                  <input
                    id="reset-email-input"
                    type="email"
                    className="pen-text-input"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="name@company.com"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="pen-modal-actions">
                <button
                  type="button"
                  className="pen-modal-cancel"
                  onClick={() => setForgotModalOpen(false)}
                  disabled={forgotLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="pen-modal-submit"
                  disabled={forgotLoading || !forgotEmail.trim()}
                >
                  {forgotLoading ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Mail size={15} />
                      <span>Send Reset Link</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}