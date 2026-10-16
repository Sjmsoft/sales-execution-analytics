import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import "./App.css";

import Login from "./pages/Login";
import WelcomeLandingPage from "./pages/WelcomeLandingPage";

import Dashboard from "./pages/Dashboard";
import Sales from "./pages/Sales";
import Outlets from "./pages/Outlets";
import Visits from "./pages/Visits";
import CheckIn from "./pages/CheckIn";
import Targets from "./pages/Targets";
import Reports from "./pages/Reports";
import FieldPerformance from "./pages/FieldPerformance";
import Staff from "./pages/Staff";
import TeamActivity from "./pages/TeamActivity";
import Settings from "./pages/Settings";
import NewSalePage from "./pages/NewSalePage";
import Messages from "./pages/Messages";
import Notifications from "./pages/Notifications";

import {
  AuthProvider,
  useAuth,
} from "./context/AuthContext";

import AppLayout from "./components/layout/AppLayout";
import ProtectedRoute from "./routes/ProtectedRoute";
import AdminRoute from "./routes/AdminRoute";

function ExecutiveRoute({ children }: { children: React.ReactNode }) {
  const { staff, role, loading } = useAuth();
  if (loading) return null;
  const roleKey = (role?.key || staff?.user_roles?.key || staff?.assigned_role || "").toLowerCase();
  const isExecutive =
    roleKey === "administrator" ||
    roleKey === "admin" ||
    roleKey === "national_sales_manager" ||
    roleKey === "nsm" ||
    roleKey === "hr" ||
    role?.hierarchy_level === 1 ||
    (role?.hierarchy_level === 2 && role?.can_view_all_sales === true);

  if (!isExecutive) {
    if (roleKey === "brand_ambassador" || roleKey === "ba" || roleKey === "vsr") {
      return <Navigate to="/check-in" replace />;
    }
    return <Navigate to="/sales" replace />;
  }
  return <>{children}</>;
}



function BaRestrictedRoute({ children }: { children: React.ReactNode }) {
  const { staff, role, loading } = useAuth();
  if (loading) return null;
  const roleKey = (role?.key || staff?.user_roles?.key || staff?.assigned_role || "").toLowerCase();
  const isBA = roleKey === "brand_ambassador" || roleKey === "ba" || roleKey === "vsr";

  if (isBA) {
    return <Navigate to="/check-in" replace />;
  }
  return <>{children}</>;
}

function ApplicationRoutes() {
  const { user, staff, role } = useAuth();
  const roleKey = (role?.key || staff?.user_roles?.key || staff?.assigned_role || "").toLowerCase();
  const isBA = roleKey === "brand_ambassador" || roleKey === "ba" || roleKey === "vsr";
  const isExecutive =
    roleKey === "administrator" ||
    roleKey === "admin" ||
    roleKey === "national_sales_manager" ||
    roleKey === "nsm" ||
    roleKey === "hr" ||
    role?.hierarchy_level === 1 ||
    (role?.hierarchy_level === 2 && role?.can_view_all_sales === true);

  return (
    <Routes>
      <Route
        path="/login"
        element={
          user ? (
            <Navigate to="/welcome" replace />
          ) : (
            <Login />
          )
        }
      />

      <Route
        path="/welcome"
        element={
          user ? (
            <WelcomeLandingPage />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Routes>
                {/* Executive Command Center: Admin, NSM, and HR only */}
                <Route
                  path="/"
                  element={
                    <ExecutiveRoute>
                      <Dashboard />
                    </ExecutiveRoute>
                  }
                />

                {/* Unified Field Check-In & Attendance (All Roles) */}
                <Route
                  path="/check-in"
                  element={<CheckIn />}
                />
                <Route
                  path="/attendance"
                  element={<CheckIn />}
                />
                <Route
                  path="/visits/check-in"
                  element={<CheckIn />}
                />
                <Route
                  path="/visits/new"
                  element={<CheckIn />}
                />
                <Route
                  path="/new-visit"
                  element={<CheckIn />}
                />
                <Route
                  path="/outlet-visit"
                  element={<CheckIn />}
                />

                {/* In-App Communications & Calls (Teams & WhatsApp Hub) */}
                <Route
                  path="/messages"
                  element={<Messages />}
                />

                {/* Sales: Available to BA, sales reps, and managers */}
                <Route
                  path="/sales"
                  element={<Sales />}
                />

                <Route
                  path="/sales/tracker"
                  element={<Sales />}
                />

                <Route
                  path="/sales/new"
                  element={<NewSalePage />}
                />

                <Route
                  path="/new-sale"
                  element={<NewSalePage />}
                />

                {/* Outlets Directory: Restricted from BA */}
                <Route
                  path="/outlets"
                  element={
                    <BaRestrictedRoute>
                      <Outlets />
                    </BaRestrictedRoute>
                  }
                />

                {/* Visits / Attendance History */}
                <Route
                  path="/visits"
                  element={<Visits />}
                />

                {/* Targets: Available to BA (sees respective targets) */}
                <Route
                  path="/targets"
                  element={<Targets />}
                />

                <Route
                  path="/reports"
                  element={
                    <BaRestrictedRoute>
                      <Reports />
                    </BaRestrictedRoute>
                  }
                />
                <Route
                  path="/reports/field-performance"
                  element={
                    <BaRestrictedRoute>
                      <FieldPerformance />
                    </BaRestrictedRoute>
                  }
                />

                <Route
                  path="/staff"
                  element={
                    <BaRestrictedRoute>
                      <Staff />
                    </BaRestrictedRoute>
                  }
                />
                <Route
                  path="/team"
                  element={
                    <BaRestrictedRoute>
                      <Staff />
                    </BaRestrictedRoute>
                  }
                />
                <Route
                  path="/visits/activity"
                  element={
                    <BaRestrictedRoute>
                      <TeamActivity />
                    </BaRestrictedRoute>
                  }
                />
                <Route
                  path="/team/activity"
                  element={
                    <BaRestrictedRoute>
                      <TeamActivity />
                    </BaRestrictedRoute>
                  }
                />
                <Route
                  path="/team-activity"
                  element={
                    <BaRestrictedRoute>
                      <TeamActivity />
                    </BaRestrictedRoute>
                  }
                />

                <Route
                  path="/settings"
                  element={
                    <AdminRoute>
                      <Settings />
                    </AdminRoute>
                  }
                />

                <Route
                  path="/settings/notifications"
                  element={<Notifications />}
                />

                <Route
                  path="/notifications"
                  element={<Notifications />}
                />

                <Route
                  path="*"
                  element={
                    <Navigate
                      to={isBA ? "/check-in" : isExecutive ? "/" : "/sales"}
                      replace
                    />
                  }
                />
              </Routes>
            </AppLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ApplicationRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;