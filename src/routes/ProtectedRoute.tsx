import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import WelcomeLandingPage from "../pages/WelcomeLandingPage";
import LogoLoader from "../components/brand/LogoLoader";
import { useMinimumLoading } from "../hooks/useMinimumLoading";

type ProtectedRouteProps = {
  children: ReactNode;
};

export default function ProtectedRoute({
  children,
}: ProtectedRouteProps) {
  const {
    user,
    staff,
    loading,
  } = useAuth();

  const showLoader = useMinimumLoading(loading, 1200);

  if (showLoader) {
    return (
      <LogoLoader
        variant="fullscreen"
        message="Loading workspace"
        hint="Syncing your sales data securely"
      />
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If authenticated user does not have an active linked staff record yet, show the onboarding landing page
  if (!staff) {
    return <WelcomeLandingPage />;
  }

  return <>{children}</>;
}