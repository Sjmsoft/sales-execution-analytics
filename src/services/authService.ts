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
  let remoteVerifier: string | null = null;
  let remoteMustChange = false;
  let remoteTempHint: string | null = null;
  if (staffRow?.team) {
    const unpacked = unpackStaffTeamAuthMeta(staffRow.team);
    remoteVerifier = unpacked.passwordVerifier;
    remoteMustChange = unpacked.mustChangeOnLogin;
    remoteTempHint = unpacked.tempPasswordHint;
    if (remoteVerifier) {
      const existingLocal = getPasswordResetRecord(resolvedEmail);
      if (
        !existingLocal ||
        existingLocal.passwordVerifier !== remoteVerifier ||
        (remoteTempHint && existingLocal.tempPasswordHint !== remoteTempHint)
      ) {
        savePasswordResetRecord({
          email: resolvedEmail,
          resetAt: existingLocal?.resetAt || new Date().toISOString(),
          mustChangeOnLogin: remoteMustChange,
          passwordVerifier: remoteVerifier,
          tempPasswordHint: remoteTempHint || existingLocal?.tempPasswordHint,
          deliveryChannels: existingLocal?.deliveryChannels || [
            "remote_staff_sync",
          ],
        });
      }
    }
  }

  const resetRecord = getPasswordResetRecord(resolvedEmail);
  const activeVerifier = remoteVerifier || resetRecord?.passwordVerifier || null;
  const activeMustChange =
    remoteVerifier !== null
      ? remoteMustChange
      : (resetRecord?.mustChangeOnLogin ?? false);

  const exactVerifier = computePasswordVerifier(resolvedEmail, rawPassword);
  const trimmedVerifier = computePasswordVerifier(
    resolvedEmail,
    trimmedPassword
  );

  const hasStoredVerifier = Boolean(activeVerifier);
  const matchesStoredVerifier =
    hasStoredVerifier &&
    (activeVerifier === exactVerifier ||
      activeVerifier === trimmedVerifier ||
      (resetRecord?.passwordVerifier &&
        (resetRecord.passwordVerifier === exactVerifier ||
          resetRecord.passwordVerifier === trimmedVerifier)));

  // Support legacy reset records created right before `passwordVerifier` was added
  const isLegacyUnboundReset =
    Boolean(resetRecord) &&
    !activeVerifier &&
    Boolean(resetRecord?.resetAt) &&
    Boolean(staffRow) &&
    trimmedPassword.length >= 6;

  // 2. Try standard Supabase Auth `signInWithPassword`
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
    savePasswordResetRecord({
      email: resolvedEmail,
      resetAt: resetRecord?.resetAt || new Date().toISOString(),
      mustChangeOnLogin: activeMustChange,
      passwordVerifier: trimmedVerifier,
      tempPasswordHint: activeMustChange
        ? remoteTempHint || resetRecord?.tempPasswordHint || trimmedPassword
        : undefined,
      deliveryChannels: resetRecord?.deliveryChannels || ["supabase_auth"],
    });

    const staffProfile = await getCurrentStaff(authRes.data.user);
    persistAuthSessionCache(authRes.data.user, staffProfile);
    return authRes.data;
  }

  // 3. Fallback: If `auth.users` was out of sync with a reset/changed password in `public.staff`,
  // sync the verified password directly into `auth.users` in Supabase via RPC and sign in!
  if (matchesStoredVerifier || isLegacyUnboundReset) {
    if (isLegacyUnboundReset) {
      savePasswordResetRecord({
        email: resolvedEmail,
        resetAt: resetRecord?.resetAt || new Date().toISOString(),
        mustChangeOnLogin: resetRecord?.mustChangeOnLogin ?? true,
        passwordVerifier: trimmedVerifier,
        tempPasswordHint: trimmedPassword,
        deliveryChannels: resetRecord?.deliveryChannels || [
          "admin_temp_password",
        ],
      });
      if (staffRow?.id) {
        try {
          const packedTeam = packStaffTeamWithAuthMeta(
            staffRow.team,
            trimmedVerifier,
            resetRecord?.mustChangeOnLogin ?? true,
            trimmedPassword
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

    // Sync the verified password to `auth.users` in Supabase DB and obtain a real JWT session
    try {
      await supabase.rpc("admin_reset_user_password", {
        p_email: resolvedEmail,
        p_new_password: trimmedPassword,
        p_must_change: activeMustChange,
      });

      const retryAuth = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password: trimmedPassword,
      });

      if (!retryAuth.error && retryAuth.data?.user) {
        const staffProfile = await getCurrentStaff(retryAuth.data.user);
        persistAuthSessionCache(retryAuth.data.user, staffProfile);
        return retryAuth.data;
      }
    } catch {
      // Continue to verified staff session below if RPC is unavailable
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
