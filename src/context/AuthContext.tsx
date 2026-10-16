import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";

import type { User } from "@supabase/supabase-js";

import { supabase } from "../lib/supabase";
import { getCurrentStaff } from "../services/staffService";

type StaffRole = {
  id: string;
  key: string;
  name: string;
  hierarchy_level: number;
  can_manage_staff: boolean;
  can_assign_targets: boolean;
  can_view_all_sales: boolean;
};

type Staff = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  region: string | null;
  team: string | null;
  is_active: boolean;
  assigned_role: string;
  auth_user_id: string;
  user_roles: StaffRole | null;
};

type AuthContextType = {
  user: User | null;
  staff: Staff | null;
  role: StaffRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshStaff: () => Promise<void>;
};

/* eslint-disable react-refresh/only-export-components -- context + hook intentionally live together */
const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadUser() {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user);

      if (user) {
        const currentStaff = await getCurrentStaff();

        setStaff(currentStaff as Staff | null);
      } else {
        setStaff(null);
      }
    } catch (error) {
      console.error("Authentication loading error:", error);

      setUser(null);
      setStaff(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async load; state updates occur only after awaits
    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);

        if (session?.user) {
          try {
            const currentStaff = await getCurrentStaff();

            setStaff(currentStaff as Staff | null);
          } catch (error) {
            console.error(
              "Unable to load staff after authentication:",
              error
            );

            setStaff(null);
          }
        } else {
          setStaff(null);
        }

        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();

    setUser(null);
    setStaff(null);
  }

  async function refreshStaff() {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);
      if (currentUser) {
        const currentStaff = await getCurrentStaff();
        setStaff(currentStaff as Staff | null);
      } else {
        setStaff(null);
      }
    } catch (e) {
      console.error("refreshStaff error:", e);
    }
  }

  const role = staff?.user_roles ?? null;

  return (
    <AuthContext.Provider
      value={{
        user,
        staff,
        role,
        loading,
        signOut,
        refreshStaff,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}