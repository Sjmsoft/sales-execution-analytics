import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import MobileNav from "./MobileNav";
import { CheckCircle2, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { navigationItems } from "../../config/navigation";
import LogoLoader from "../brand/LogoLoader";
import GlobalCommunicationOverlay from "../chat/GlobalCommunicationOverlay";
import "../chat/messaging.css";

/** How long the branded logo overlay shows on every page navigation. */
const ROUTE_LOADER_MS = 750;

function getRouteLabel(pathname: string) {
  const match = [...navigationItems]
    .sort((a, b) => b.path.length - a.path.length)
    .find((item) => (item.path === "/" ? pathname === "/" : pathname.startsWith(item.path)));
  return match?.label ?? "workspace";
}

type AppLayoutProps = {
  children: ReactNode;
};

export default function AppLayout({ children }: AppLayoutProps) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const { staff, role } = useAuth();
  const [loginSuccess, setLoginSuccess] = useState(
    () => Boolean(sessionStorage.getItem("login-success")),
  );

  useEffect(() => {
    if (!loginSuccess) return;

    sessionStorage.removeItem("login-success");
    const dismissTimer = window.setTimeout(() => setLoginSuccess(false), 7000);
    return () => window.clearTimeout(dismissTimer);
  }, [loginSuccess]);

  // ── Route transition loader: brief branded pause on each navigation ──
  const { pathname } = useLocation();
  const [prevPath, setPrevPath] = useState(pathname);
  const [routeCycle, setRouteCycle] = useState(0);
  const [completedRouteCycle, setCompletedRouteCycle] = useState(0);

  if (pathname !== prevPath) {
    setPrevPath(pathname);
    setRouteCycle((c) => c + 1);
  }

  useEffect(() => {
    if (routeCycle === 0) return;
    window.scrollTo({ top: 0 });
    const timer = window.setTimeout(() => setCompletedRouteCycle(routeCycle), ROUTE_LOADER_MS);
    return () => window.clearTimeout(timer);
  }, [routeCycle]);

  const routeLoading = completedRouteCycle < routeCycle;

  return (
    <div className="app-shell">
      {/* ── Desktop Sidebar (Hidden on Mobile) ── */}
      <Sidebar
        mobileOpen={false}
        onClose={() => setMobileDrawerOpen(false)}
      />

      <div className="app-main">
        <Header onMenuClick={() => setMobileDrawerOpen(true)} />

        <main className={`app-content ${pathname.startsWith("/messages") ? "messages-route" : ""}`}>
          {loginSuccess && (
            <div className="login-success-toast" role="status">
              <CheckCircle2 className="login-success-icon" size={21} aria-hidden="true" />
              <div>
                <strong>Login successful</strong>
                <p>{staff?.name ?? "Staff member"} · {role?.name ?? "Active account"}</p>
                <small>{staff?.email ?? "Your account is ready"}{staff?.region ? ` · ${staff.region}` : ""}</small>
              </div>
              <button type="button" onClick={() => setLoginSuccess(false)} aria-label="Dismiss login success message">
                <X size={17} />
              </button>
            </div>
          )}
          {children}
          {routeLoading && (
            <LogoLoader
              key={routeCycle}
              variant="overlay"
              message={`Loading ${getRouteLabel(pathname)}`}
            />
          )}
        </main>
      </div>

      {/* ── Modern Mobile Navigation (Bottom Dock, Floating FAB & Sheet) ── */}
      <MobileNav
        isDrawerOpen={mobileDrawerOpen}
        onOpenDrawer={() => setMobileDrawerOpen(true)}
        onCloseDrawer={() => setMobileDrawerOpen(false)}
      />

      {/* ── Global Communication Overlay (Calls, Ringing Modal & Push Banners) ── */}
      <GlobalCommunicationOverlay />
    </div>
  );
}