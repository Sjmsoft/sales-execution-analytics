import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import LogoLoader from "../components/brand/LogoLoader";

type AdminRouteProps = {
  children: ReactNode;
};

export default function AdminRoute({ children }: AdminRouteProps) {
  const { user, staff, role, loading } = useAuth();

  if (loading) {
    return <LogoLoader variant="page" message="Verifying administrative privileges" />;
  }

  if (!user || !staff) {
    return <Navigate to="/login" replace />;
  }

  const roleKey = (role?.key || staff?.user_roles?.key || "").toLowerCase();
  const isAdmin = roleKey === "administrator" || role?.hierarchy_level === 1;

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
