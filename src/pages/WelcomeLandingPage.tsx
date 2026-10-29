import { Link, useNavigate } from "react-router-dom";
import {
  Sparkles,
  LogOut,
  ShoppingCart,
  MapPin,
  Target,
  Users,
  ArrowRight,
  ShieldCheck,
  BarChart3,
  Layers,
  LayoutDashboard,
  FileSpreadsheet,
  ClipboardCheck,
  MessageSquare,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useUserLocation } from "../hooks/useUserLocation";
import "./WelcomeLandingPage.css";
import BrandLogo3D from "../components/brand/BrandLogo3D";

export default function WelcomeLandingPage() {
  const { user, staff, role, signOut, refreshStaff } = useAuth();
  const { userLocation, isLocating } = useUserLocation(staff?.id);
  const navigate = useNavigate();

  const roleKey = (role?.key || staff?.user_roles?.key || staff?.assigned_role || "").toLowerCase();
  const isBA = roleKey === "brand_ambassador" || roleKey === "ba" || roleKey === "vsr";
  const isExecutive =
    roleKey === "administrator" ||
    roleKey === "admin" ||
    roleKey === "national_sales_manager" ||
    roleKey === "nsm" ||
    roleKey === "hr";
  const isAttendanceExcluded =
    roleKey === "regional_sales_manager" ||
    roleKey === "rsm" ||
    roleKey === "sales_executive" ||
    roleKey === "se" ||
    roleKey === "national_sales_manager" ||
    roleKey === "nsm";

  const displayName =
    staff?.name ||
    (user?.email
      ? user.email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : "Staff Member");

  const initials = (displayName || user?.email || "PE")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="pen-landing-page">
      {/* ── Top Navbar ── */}
      <header className="pen-landing-navbar">
        <div className="pen-landing-brand">
          <div className="pen-logo-emblem" aria-hidden="true">
            <BrandLogo3D size={34} tone="dark" motion="sway" />
          </div>
          <div className="pen-brand-text">
            <strong>Pen Edge</strong>
            <span>Enterprise Sales</span>
          </div>
        </div>

        <div className="pen-landing-nav-actions">
          <div className="pen-user-badge-pill">
            <span className="pen-user-avatar-mini">{initials}</span>
            <span>{user?.email}</span>
          </div>

          <button
            type="button"
            className="pen-signout-btn"
            onClick={() => void signOut()}
            title="Sign out of your session"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* ── Main Landing Body ── */}
      <main className="pen-landing-content">
        {!staff && (
          <div
            style={{
              background: "rgba(245, 158, 11, 0.12)",
              border: "1px solid rgba(245, 158, 11, 0.35)",
              borderRadius: "12px",
              padding: "14px 18px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ color: "#fde68a", fontSize: "13.5px" }}>
              <strong>Staff profile linking in progress:</strong> Your account ({user?.email}) is authenticated, and your staff directory profile is being synchronized.
            </div>
            <button
              type="button"
              onClick={() => void refreshStaff()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "#f59e0b",
                color: "#0f172a",
                border: "none",
                borderRadius: "8px",
                padding: "8px 14px",
                fontSize: "12.5px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <RefreshCw size={14} />
              <span>Sync Staff Profile</span>
            </button>
          </div>
        )}
        {/* Hero Welcome Banner */}
        <section className="pen-landing-hero">
          <div className="pen-hero-left">
            <div className="pen-hero-tag">
              <Sparkles size={14} />
              <span>Workspace Authenticated</span>
            </div>
            <h1>
              Welcome to <span className="highlight-name">Pen Edge Sales Execution</span>
            </h1>
            <p>
              {isBA
                ? "Your field session is active. Check in your daily shift attendance and review your shift records."
                : "Your session is active and verified. Choose an action below to proceed into your sales workspace."}
            </p>

            {/* Direct Action Launch Bar */}
            <div style={{ display: "flex", gap: "12px", marginTop: "24px", flexWrap: "wrap" }}>
              {isBA ? (
                <>
                  <button
                    type="button"
                    className="pen-setup-primary-btn"
                    onClick={() => navigate("/attendance")}
                    style={{ height: "46px", fontSize: "14px", padding: "0 20px" }}
                  >
                    <ClipboardCheck size={18} />
                    <span>Daily Attendance</span>
                    <ArrowRight size={16} />
                  </button>
                  <button
                    type="button"
                    className="pen-signout-btn"
                    onClick={() => navigate("/sales")}
                    style={{
                      background: "rgba(59, 130, 246, 0.15)",
                      color: "#93c5fd",
                      borderColor: "rgba(59, 130, 246, 0.35)",
                      height: "46px",
                      fontSize: "13.5px",
                      padding: "0 18px",
                    }}
                  >
                    <ShoppingCart size={16} />
                    <span>Sales Orders</span>
                  </button>
                  <button
                    type="button"
                    className="pen-signout-btn"
                    onClick={() => navigate("/targets")}
                    style={{
                      background: "rgba(245, 158, 11, 0.15)",
                      color: "#fcd34d",
                      borderColor: "rgba(245, 158, 11, 0.35)",
                      height: "46px",
                      fontSize: "13.5px",
                      padding: "0 18px",
                    }}
                  >
                    <Target size={16} />
                    <span>My Targets</span>
                  </button>
                  <button
                    type="button"
                    className="pen-signout-btn"
                    onClick={() => navigate("/visits")}
                    style={{
                      background: "rgba(16, 185, 129, 0.15)",
                      color: "#6ee7b7",
                      borderColor: "rgba(16, 185, 129, 0.35)",
                      height: "46px",
                      fontSize: "13.5px",
                      padding: "0 18px",
                    }}
                  >
                    <BarChart3 size={16} />
                    <span>Attendance History</span>
                  </button>
                </>
              ) : isExecutive ? (
                <>
                  <button
                    type="button"
                    className="pen-setup-primary-btn"
                    onClick={() => navigate("/")}
                    style={{ height: "46px", fontSize: "14px", padding: "0 22px" }}
                  >
                    <LayoutDashboard size={18} />
                    <span>Launch Executive Command Center</span>
                    <ArrowRight size={16} />
                  </button>
                  {!isAttendanceExcluded && (
                    <button
                      type="button"
                      className="pen-signout-btn"
                      onClick={() => navigate("/attendance")}
                      style={{
                        background: "rgba(16, 185, 129, 0.15)",
                        color: "#6ee7b7",
                        borderColor: "rgba(16, 185, 129, 0.35)",
                        height: "46px",
                        fontSize: "13.5px",
                        padding: "0 18px",
                      }}
                    >
                      <ClipboardCheck size={16} />
                      <span>Daily Attendance</span>
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="pen-setup-primary-btn"
                    onClick={() => navigate("/sales")}
                    style={{ height: "46px", fontSize: "14px", padding: "0 22px" }}
                  >
                    <ShoppingCart size={18} />
                    <span>Field Sales Orders</span>
                    <ArrowRight size={16} />
                  </button>
                  {!isAttendanceExcluded && (
                    <button
                      type="button"
                      className="pen-signout-btn"
                      onClick={() => navigate("/attendance")}
                      style={{
                        background: "rgba(16, 185, 129, 0.15)",
                        color: "#6ee7b7",
                        borderColor: "rgba(16, 185, 129, 0.35)",
                        height: "46px",
                        fontSize: "13.5px",
                        padding: "0 18px",
                      }}
                    >
                      <ClipboardCheck size={16} />
                      <span>Daily Attendance</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="pen-hero-user-card">
            <div className="pen-user-card-header">
              <div className="pen-user-card-avatar">{initials}</div>
              <div className="pen-user-card-meta">
                <strong>{displayName}</strong>
                <span>{staff?.user_roles?.name || "Sales Staff"}</span>
              </div>
            </div>
            <div className="pen-user-card-status">
              <span>Status: Authenticated</span>
              <span style={{ color: "#34d399", fontWeight: 700 }}>● Online</span>
            </div>
            <div
              style={{
                marginTop: 10,
                paddingTop: 10,
                borderTop: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 11.5,
                gap: 8,
              }}
            >
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#94a3b8" }}>
                <MapPin size={12} style={{ color: "#38bdf8" }} />
                <span>
                  {isLocating
                    ? "Acquiring live GPS…"
                    : userLocation
                      ? `${userLocation.latitude.toFixed(4)}° N, ${userLocation.longitude.toFixed(4)}° E`
                      : staff?.region
                        ? `${staff.region} Region`
                        : "Location Ready"}
                </span>
              </div>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: userLocation ? "#34d399" : "#60a5fa",
                  background: userLocation ? "rgba(16, 185, 129, 0.12)" : "rgba(37, 99, 235, 0.12)",
                  padding: "2px 7px",
                  borderRadius: 4,
                  border: userLocation ? "1px solid rgba(52, 211, 153, 0.3)" : "1px solid rgba(96, 165, 250, 0.3)",
                }}
              >
                {userLocation ? "📍 Live Location" : "Assigned Scope"}
              </span>
            </div>
          </div>
        </section>

        {/* ── Feature Modules Quick Explorer / Action Grid ── */}
        <section>
          <div className="pen-section-header">
            <div className="pen-section-title">
              <Layers size={20} style={{ color: "#38bdf8" }} />
              <div>
                <h2>Choose an Action to Proceed</h2>
                <p>Select any module below to launch directly into your sales execution workspace.</p>
              </div>
            </div>
          </div>

          <div className="pen-modules-grid">
            {isBA ? (
              <>
                {/* Module for BA: Attendance Check-In */}
                <Link to="/attendance" className="pen-module-card">
                  <div>
                    <div className="pen-module-icon-wrap green">
                      <ClipboardCheck size={22} />
                    </div>
                    <h3>Daily Attendance</h3>
                    <p>Clock in on-site at your assigned shift location with GPS verification and take end-of-shift photo proof.</p>
                  </div>
                  <div className="pen-module-cta">
                    <span>Proceed to Clock-In</span>
                    <ArrowRight size={14} />
                  </div>
                </Link>

                {/* Module for BA: Attendance History */}
                <Link to="/visits" className="pen-module-card">
                  <div>
                    <div className="pen-module-icon-wrap blue">
                      <BarChart3 size={22} />
                    </div>
                    <h3>Attendance History</h3>
                    <p>Review your past shift logs, total hours worked, verified GPS coordinates, and shift close photo evidence.</p>
                  </div>
                  <div className="pen-module-cta">
                    <span>View Attendance History</span>
                    <ArrowRight size={14} />
                  </div>
                </Link>

                {/* Module for BA: Sales */}
                <Link to="/sales" className="pen-module-card">
                  <div>
                    <div className="pen-module-icon-wrap blue">
                      <ShoppingCart size={22} />
                    </div>
                    <h3>Sales Orders</h3>
                    <p>Create and log sales orders, manage customer balances, record new transactions, and print receipts.</p>
                  </div>
                  <div className="pen-module-cta">
                    <span>Proceed to Sales</span>
                    <ArrowRight size={14} />
                  </div>
                </Link>

                {/* Module for BA: Targets */}
                <Link to="/targets" className="pen-module-card">
                  <div>
                    <div className="pen-module-icon-wrap amber">
                      <Target size={22} />
                    </div>
                    <h3>My Targets</h3>
                    <p>Track your assigned monthly, weekly, and daily case targets, realization rates, and performance progress.</p>
                  </div>
                  <div className="pen-module-cta">
                    <span>View My Targets</span>
                    <ArrowRight size={14} />
                  </div>
                </Link>

                {/* Module for BA: Messages & Calls */}
                <Link to="/messages" className="pen-module-card">
                  <div>
                    <div className="pen-module-icon-wrap cyan">
                      <MessageSquare size={22} />
                    </div>
                    <h3>Messages & Calls</h3>
                    <p>Communicate with field supervisors, receive broadcast directives, and place audio or video calls.</p>
                  </div>
                  <div className="pen-module-cta">
                    <span>Open Messages & Calls</span>
                    <ArrowRight size={14} />
                  </div>
                </Link>
              </>
            ) : (
              <>
                {/* Module 1: Dashboard (Executives only) */}
                {isExecutive && (
                  <Link to="/" className="pen-module-card">
                    <div>
                      <div className="pen-module-icon-wrap green">
                        <BarChart3 size={22} />
                      </div>
                      <h3>Executive Command Center</h3>
                      <p>High-level view of revenue realization, cases sold, top reps, and monthly targets across all regions.</p>
                    </div>
                    <div className="pen-module-cta">
                      <span>Proceed to Command Center</span>
                      <ArrowRight size={14} />
                    </div>
                  </Link>
                )}

                {/* Module: Daily Attendance (hidden for RSM, SE, and NSM) */}
                {!isAttendanceExcluded && (
                  <Link to="/attendance" className="pen-module-card">
                    <div>
                      <div className="pen-module-icon-wrap green">
                        <ClipboardCheck size={22} />
                      </div>
                      <h3>Daily Attendance</h3>
                      <p>Shift clock-in, geofenced GPS verification, and shift duration tracking.</p>
                    </div>
                    <div className="pen-module-cta">
                      <span>Proceed to Attendance</span>
                      <ArrowRight size={14} />
                    </div>
                  </Link>
                )}

                {/* Module 2: Field Sales */}
                <Link to="/sales" className="pen-module-card">
                  <div>
                    <div className="pen-module-icon-wrap blue">
                      <ShoppingCart size={22} />
                    </div>
                    <h3>Sales Transactions & Orders</h3>
                    <p>Create and log point-of-sale orders, manage customer balances, and print invoices.</p>
                  </div>
                  <div className="pen-module-cta">
                    <span>Proceed to Sales</span>
                    <ArrowRight size={14} />
                  </div>
                </Link>

                {/* Module 3: Outlet Visits */}
                <Link to="/visits/check-in" className="pen-module-card">
                  <div>
                    <div className="pen-module-icon-wrap purple">
                      <MapPin size={22} />
                    </div>
                    <h3>Geofenced Visit Check-In</h3>
                    <p>GPS verified outlet visits, photographic store audits, and field execution logs.</p>
                  </div>
                  <div className="pen-module-cta">
                    <span>Proceed to Visit Check-In</span>
                    <ArrowRight size={14} />
                  </div>
                </Link>

                {/* Module 4: Targets */}
                <Link to="/targets" className="pen-module-card">
                  <div>
                    <div className="pen-module-icon-wrap amber">
                      <Target size={22} />
                    </div>
                    <h3>Targets & Quotas</h3>
                    <p>Set regional target cases, track achievement rates, and analyze sales variances.</p>
                  </div>
                  <div className="pen-module-cta">
                    <span>Proceed to Targets</span>
                    <ArrowRight size={14} />
                  </div>
                </Link>

                {/* Module 5: Team Activity */}
                <Link to="/team/activity" className="pen-module-card">
                  <div>
                    <div className="pen-module-icon-wrap cyan">
                      <Users size={22} />
                    </div>
                    <h3>Team & Field Force Activity</h3>
                    <p>Monitor live shift attendance, route execution, rep leaderboards, and staff profiles.</p>
                  </div>
                  <div className="pen-module-cta">
                    <span>Proceed to Team Activity</span>
                    <ArrowRight size={14} />
                  </div>
                </Link>

                {/* Module 6: Reports */}
                <Link to="/reports" className="pen-module-card">
                  <div>
                    <div className="pen-module-icon-wrap indigo">
                      <FileSpreadsheet size={22} />
                    </div>
                    <h3>Reports & Analytics</h3>
                    <p>Export executive summaries, brand volume analysis, and historical performance charts.</p>
                  </div>
                  <div className="pen-module-cta">
                    <span>Proceed to Reports</span>
                    <ArrowRight size={14} />
                  </div>
                </Link>

                {/* Module 7: Messages & Calls */}
                <Link to="/messages" className="pen-module-card">
                  <div>
                    <div className="pen-module-icon-wrap cyan">
                      <MessageSquare size={22} />
                    </div>
                    <h3>Messages & Calls</h3>
                    <p>Collaborate with regional hubs, broadcast executive bulletins, and place instant audio or video calls.</p>
                  </div>
                  <div className="pen-module-cta">
                    <span>Open Messages & Calls</span>
                    <ArrowRight size={14} />
                  </div>
                </Link>
              </>
            )}
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="pen-landing-footer">
          <div className="pen-landing-footer-left">
            <ShieldCheck size={14} style={{ color: "#10b981" }} />
            <span>Pen Edge Sales Intelligence Platform • Enterprise Edition</span>
          </div>

          <div className="pen-landing-footer-right">
            <span>Logged in as {user?.email}</span>
            <span>•</span>
            <a href="mailto:support@penedge.com" style={{ color: "#94a3b8", textDecoration: "none" }}>
              Contact Support
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}
