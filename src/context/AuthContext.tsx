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

const STORAGE_KEY_CACHED_STAFF = "penedge_cached_staff_v1";
const STORAGE_KEY_CACHED_USER = "penedge_cached_user_v1";

function getCachedStaff(): Staff | null {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY_CACHED_STAFF) : null;
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getCachedUser(): User | null {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY_CACHED_USER) : null;
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCachedStaff(staff: Staff | null) {
  try {
    if (typeof localStorage === "undefined") return;
    if (staff) {
      localStorage.setItem(STORAGE_KEY_CACHED_STAFF, JSON.stringify(staff));
    } else {
      localStorage.removeItem(STORAGE_KEY_CACHED_STAFF);
    }
  } catch {}
}

function setCachedUser(user: User | null) {
  try {
    if (typeof localStorage === "undefined") return;
    if (user) {
      localStorage.setItem(STORAGE_KEY_CACHED_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY_CACHED_USER);
    }
  } catch {}
}

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<User | null>(() => getCachedUser());
  const [staff, setStaff] = useState<Staff | null>(() => getCachedStaff());
  const [loading, setLoading] = useState(true);

  async function loadUser() {
    try {
      setLoading(true);

      // Check local session first without forcing remote network request
      const { data: sessionData } = await supabase.auth.getSession();
      const localUser = sessionData?.session?.user ?? getCachedUser();

      if (navigator.onLine) {
        try {
          const {
            data: { user: remoteUser },
          } = await supabase.auth.getUser();

          if (remoteUser) {
            setUser(remoteUser);
            setCachedUser(remoteUser);

            const currentStaff = await getCurrentStaff();
            setStaff(currentStaff as Staff | null);
            setCachedStaff(currentStaff as Staff | null);
            return;
          }
        } catch (networkErr) {
          console.warn("Remote auth check notice (falling back to offline cached session):", networkErr);
        }
      }

      // Offline / network fallback: preserve local session & cached staff profile
      if (localUser) {
        setUser(localUser);
        setCachedUser(localUser);

        const cachedStaff = getCachedStaff();
        if (cachedStaff) {
          setStaff(cachedStaff);
        } else {
          try {
            const currentStaff = await getCurrentStaff();
            if (currentStaff) {
              setStaff(currentStaff as Staff | null);
              setCachedStaff(currentStaff as Staff | null);
            }
          } catch {}
        }
      } else {
        setUser(null);
        setStaff(null);
      }
    } catch (error) {
      console.error("Authentication loading notice:", error);
      const fallbackUser = getCachedUser();
      const fallbackStaff = getCachedStaff();
      if (fallbackUser) {
        setUser(fallbackUser);
        setStaff(fallbackStaff);
      } else {
        setUser(null);
        setStaff(null);
      }
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
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        setCachedUser(currentUser);

        if (currentUser) {
          try {
            const currentStaff = await getCurrentStaff();
            setStaff(currentStaff as Staff | null);
            setCachedStaff(currentStaff as Staff | null);
          } catch (error) {
            console.error(
              "Unable to load staff after authentication notice:",
              error
            );
            const cached = getCachedStaff();
            if (cached) setStaff(cached);
          }
        } else if (_event === "SIGNED_OUT") {
          setStaff(null);
          setCachedStaff(null);
          setCachedUser(null);
        }

        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    setCachedUser(null);
    setCachedStaff(null);

    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Sign out notice:", err);
    }

    setUser(null);
    setStaff(null);
  }

  async function refreshStaff() {
    try {
      if (navigator.onLine) {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        setUser(currentUser);
        setCachedUser(currentUser);
        if (currentUser) {
          const currentStaff = await getCurrentStaff();
          setStaff(currentStaff as Staff | null);
          setCachedStaff(currentStaff as Staff | null);
        } else {
          setStaff(null);
        }
      } else {
        const cached = getCachedStaff();
        if (cached) setStaff(cached);
      }
    } catch (e) {
      console.warn("refreshStaff notice:", e);
      const cached = getCachedStaff();
      if (cached) setStaff(cached);
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