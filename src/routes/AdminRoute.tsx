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

  const roleKey = (role?.key || staff?.user_roles?.key || staff?.assigned_role || "").toLowerCase();
  const isAdmin =
    roleKey === "administrator" ||
    roleKey === "admin" ||
    roleKey === "a0000000-0000-4000-8000-000000000001" ||
    role?.hierarchy_level === 1;
  const isBA = roleKey === "brand_ambassador" || roleKey === "ba" || roleKey === "vsr";
  const isExecutive =
    isAdmin ||
    roleKey === "national_sales_manager" ||
    roleKey === "nsm" ||
    roleKey === "hr" ||
    (role?.hierarchy_level === 2 && role?.can_view_all_sales === true);

  if (!isAdmin) {
    return <Navigate to={isBA ? "/check-in" : isExecutive ? "/" : "/sales"} replace />;
  }

  return <>{children}</>;
}
