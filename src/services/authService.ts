import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { getCurrentStaff } from "./staffService";
import {
  computePasswordVerifier,
  ensureValidUuid,
  getPasswordResetRecord,
  isUuid,
  packStaffTeamWithAuthMeta,
  savePasswordResetRecord,
  unpackStaffTeamAuthMeta,
} from "./userManagementService";

const STORAGE_KEY_CACHED_STAFF = "penedge_cached_staff_v1";
const STORAGE_KEY_CACHED_USER = "penedge_cached_user_v1";

function persistAuthSessionCache(user: User | null, staff: any | null) {
  try {
    if (typeof localStorage === "undefined") return;
    if (user) {
      localStorage.setItem(STORAGE_KEY_CACHED_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY_CACHED_USER);
    }
    if (staff) {
      localStorage.setItem(STORAGE_KEY_CACHED_STAFF, JSON.stringify(staff));
    } else {
      localStorage.removeItem(STORAGE_KEY_CACHED_STAFF);
    }
  } catch {
    // ignore storage errors
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("penedge:auth-updated", {
        detail: { user, staff },
      })
    );
  }
}

export async function signIn(emailOrId: string, password: string) {
  const rawIdentifier = emailOrId.trim();
  const rawPassword = password;
  const trimmedPassword = password.trim();

  if (!rawIdentifier || !rawPassword) {
    throw new Error("Please enter both your email/staff ID and password.");
  }

  // 1. Look up staff record by email or ID so we can resolve Staff ID -> Email,
  // check active status, and sync any remote password reset metadata.
  let staffRow: any = null;
  try {
    if (rawIdentifier.includes("@")) {
      const { data } = await supabase
        .from("staff")
        .select("*")
        .ilike("email", rawIdentifier)
        .maybeSingle();
      staffRow = data;
    } else if (isUuid(rawIdentifier)) {
      const { data } = await supabase
        .from("staff")
        .select("*")
        .eq("id", rawIdentifier)
        .maybeSingle();
      staffRow = data;
    } else {
      const { data } = await supabase
        .from("staff")
        .select("*")
        .or(`email.ilike.${rawIdentifier}%,name.ilike.${rawIdentifier}`)
        .limit(1)
        .maybeSingle();
      staffRow = data;
    }
  } catch (err) {
    console.warn("Staff lookup during signIn notice:", err);
  }

  if (staffRow && staffRow.is_active === false) {
    throw new Error(
      "Your staff account has been deactivated. Please contact your System Administrator."
    );
  }

  const resolvedEmail = (staffRow?.email || rawIdentifier).trim().toLowerCase();

  // Sync any password verifier stored in `public.staff.team` metadata
  if (staffRow?.team) {
    const { passwordVerifier, mustChangeOnLogin } = unpackStaffTeamAuthMeta(
      staffRow.team
    );
    if (passwordVerifier) {
      const existingLocal = getPasswordResetRecord(resolvedEmail);
      if (
        !existingLocal ||
        existingLocal.passwordVerifier !== passwordVerifier
      ) {
        savePasswordResetRecord({
          email: resolvedEmail,
          resetAt: existingLocal?.resetAt || new Date().toISOString(),
          mustChangeOnLogin,
          passwordVerifier,
          deliveryChannels: existingLocal?.deliveryChannels || [
            "remote_staff_sync",
          ],
        });
      }
    }
  }

  const resetRecord = getPasswordResetRecord(resolvedEmail);
  const exactVerifier = computePasswordVerifier(resolvedEmail, rawPassword);
  const trimmedVerifier = computePasswordVerifier(
    resolvedEmail,
    trimmedPassword
  );

  const hasStoredVerifier = Boolean(resetRecord?.passwordVerifier);
  const matchesStoredVerifier =
    hasStoredVerifier &&
    (resetRecord?.passwordVerifier === exactVerifier ||
      resetRecord?.passwordVerifier === trimmedVerifier);

  // Support legacy reset records created right before `passwordVerifier` was added
  const isLegacyUnboundReset =
    Boolean(resetRecord) &&
    !resetRecord?.passwordVerifier &&
    Boolean(resetRecord?.resetAt) &&
    Boolean(staffRow) &&
    trimmedPassword.length >= 6;

  // 2. Try standard Supabase Auth `signInWithPassword`
  // Note: If the user's password was explicitly reset/changed (hasStoredVerifier is true)
  // and the entered password does NOT match the new verifier (unless reset via email link),
  // reject the old superseded password so old credentials cannot be reused after a reset.
  const isEmailLinkReset = Boolean(
    resetRecord?.deliveryChannels?.includes("email_link")
  );
  const shouldRejectSupersededPassword =
    hasStoredVerifier && !matchesStoredVerifier && !isEmailLinkReset;

  if (!shouldRejectSupersededPassword) {
    let authRes = await supabase.auth.signInWithPassword({
      email: resolvedEmail,
      password: rawPassword,
    });

    if (authRes.error && trimmedPassword !== rawPassword) {
      authRes = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password: trimmedPassword,
      });
    }

    if (!authRes.error && authRes.data?.user) {
      // Lock in the working password verifier so future checks stay in sync
      savePasswordResetRecord({
        email: resolvedEmail,
        resetAt: resetRecord?.resetAt || new Date().toISOString(),
        mustChangeOnLogin: resetRecord?.mustChangeOnLogin ?? false,
        passwordVerifier: trimmedVerifier,
        deliveryChannels: resetRecord?.deliveryChannels || ["supabase_auth"],
      });

      const staffProfile = await getCurrentStaff(authRes.data.user);
      persistAuthSessionCache(authRes.data.user, staffProfile);
      return authRes.data;
    }
  }

  // 3. Fallback: If Supabase Auth rejected the password (e.g., because `auth.users` still
  // holds the previous password when the admin reset RPC migration hasn't been executed yet,
  // or email confirmation is pending), verify against the active Reset / Changed password record!
  if (matchesStoredVerifier || isLegacyUnboundReset) {
    if (isLegacyUnboundReset) {
      savePasswordResetRecord({
        email: resolvedEmail,
        resetAt: resetRecord?.resetAt || new Date().toISOString(),
        mustChangeOnLogin: resetRecord?.mustChangeOnLogin ?? true,
        passwordVerifier: trimmedVerifier,
        deliveryChannels: resetRecord?.deliveryChannels || [
          "admin_temp_password",
        ],
      });
      if (staffRow?.id) {
        try {
          const packedTeam = packStaffTeamWithAuthMeta(
            staffRow.team,
            trimmedVerifier,
            resetRecord?.mustChangeOnLogin ?? true
          );
          await supabase
            .from("staff")
            .update({ team: packedTeam })
            .eq("id", staffRow.id);
        } catch {
          // non-fatal
        }
      }
    }

    // Attempt to sign up in Supabase Auth in case the user never had an auth.users record
    try {
      const signUpRes = await supabase.auth.signUp({
        email: resolvedEmail,
        password: trimmedPassword,
      });
      if (!signUpRes.error && signUpRes.data?.session?.user) {
        const staffProfile = await getCurrentStaff(signUpRes.data.session.user);
        persistAuthSessionCache(signUpRes.data.session.user, staffProfile);
        return {
          user: signUpRes.data.session.user,
          session: signUpRes.data.session,
        };
      }
    } catch {
      // Continue to verified staff session below
    }

    // Construct verified authenticated User session backed by the staff record
    const verifiedUser: User = {
      id:
        staffRow?.auth_user_id ||
        staffRow?.id ||
        ensureValidUuid(resolvedEmail),
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: {
        name: staffRow?.name || resolvedEmail,
        staff_id: staffRow?.id,
      },
      aud: "authenticated",
      created_at: staffRow?.created_at || new Date().toISOString(),
      email: resolvedEmail,
      role: "authenticated",
    } as User;

    const staffProfile = await getCurrentStaff(verifiedUser);
    persistAuthSessionCache(verifiedUser, staffProfile);

    return {
      user: verifiedUser,
      session: null,
    };
  }

  throw new Error(
    "Invalid login credentials. Please check your email and password (or ask an Administrator to reset your password)."
  );
}

export async function signOut() {
  persistAuthSessionCache(null, null);
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

export async function getCurrentUser() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) return user;
  } catch {
    // fallback to cached user
  }

  try {
    const raw =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(STORAGE_KEY_CACHED_USER)
        : null;
    if (raw) return JSON.parse(raw) as User;
  } catch {
    // ignore
  }

  return null;
}
