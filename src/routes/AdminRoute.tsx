import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import LogoLoader from "../components/brand/LogoLoader";
import {
  isAdminRole,
  isExecutiveRole,
  isFieldBaOrVsrRole,
} from "../services/dataScopeService";

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

  const isAdmin = isAdminRole(staff, role);
  const isBA = isFieldBaOrVsrRole(staff, role);
  const isExecutive = isExecutiveRole(staff, role);

  if (!isAdmin) {
    return <Navigate to={isBA ? "/check-in" : isExecutive ? "/" : "/sales"} replace />;
  }

  return <>{children}</>;
}
