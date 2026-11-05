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
    const raw =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(STORAGE_KEY_CACHED_STAFF)
        : null;
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getCachedUser(): User | null {
  try {
    const raw =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(STORAGE_KEY_CACHED_USER)
        : null;
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

      const { data: sessionData } = await supabase.auth.getSession();
      const cachedUser = getCachedUser();
      const localUser = sessionData?.session?.user ?? cachedUser;

      if (navigator.onLine) {
        try {
          const {
            data: { user: remoteUser },
          } = await supabase.auth.getUser();

          if (
            remoteUser &&
            (!cachedUser ||
              remoteUser.email?.toLowerCase() ===
                cachedUser.email?.toLowerCase())
          ) {
            setUser(remoteUser);
            setCachedUser(remoteUser);

            const currentStaff = await getCurrentStaff(remoteUser);
            setStaff(currentStaff as Staff | null);
            setCachedStaff(currentStaff as Staff | null);
            return;
          }
        } catch (networkErr) {
          console.warn(
            "Remote auth check notice (falling back to cached session):",
            networkErr
          );
        }
      }

      if (localUser) {
        setUser(localUser);
        setCachedUser(localUser);

        try {
          const currentStaff = await getCurrentStaff(localUser);
          if (currentStaff) {
            setStaff(currentStaff as Staff | null);
            setCachedStaff(currentStaff as Staff | null);
          } else {
            const cachedStaff = getCachedStaff();
            if (cachedStaff) setStaff(cachedStaff);
          }
        } catch {
          const cachedStaff = getCachedStaff();
          if (cachedStaff) setStaff(cachedStaff);
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

    function handleCustomAuthUpdate(e: Event) {
      const customEvent = e as CustomEvent<{
        user: User | null;
        staff: Staff | null;
      }>;
      if (customEvent.detail !== undefined) {
        setUser(customEvent.detail.user);
        setStaff(customEvent.detail.staff);
        setLoading(false);
      }
    }

    window.addEventListener("penedge:auth-updated", handleCustomAuthUpdate);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;

      if (currentUser) {
        setUser(currentUser);
        setCachedUser(currentUser);

        try {
          const currentStaff = await getCurrentStaff(currentUser);
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
        const activeCachedUser = getCachedUser();
        if (!activeCachedUser) {
          setUser(null);
          setStaff(null);
        }
      } else {
        // INITIAL_SESSION with no Supabase session: preserve verified staff session if present
        const activeCachedUser = getCachedUser();
        if (activeCachedUser) {
          setUser(activeCachedUser);
          const cached = getCachedStaff();
          if (cached) setStaff(cached);
        }
      }

      setLoading(false);
    });

    return () => {
      window.removeEventListener(
        "penedge:auth-updated",
        handleCustomAuthUpdate
      );
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
      const cachedUser = getCachedUser();
      if (navigator.onLine) {
        const {
          data: { user: remoteUser },
        } = await supabase.auth.getUser();
        const effectiveUser = remoteUser ?? cachedUser;
        if (effectiveUser) {
          setUser(effectiveUser);
          setCachedUser(effectiveUser);
          const currentStaff = await getCurrentStaff(effectiveUser);
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
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
