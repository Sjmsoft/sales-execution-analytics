import { supabase } from "../lib/supabase";
import {
  SYSTEM_ROLES,
  unpackStaffTeamAuthMeta,
  getPasswordResetRecord,
  savePasswordResetRecord,
} from "./userManagementService";

const STORAGE_KEY_CACHED_USER = "penedge_cached_user_v1";

function getFallbackCachedUser(): { id?: string; email?: string | null } | null {
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

export async function getCurrentStaff(
  overrideUser?: { id?: string; email?: string | null } | null
) {
  let targetUser: { id?: string; email?: string | null } | null =
    overrideUser ?? null;

  if (!targetUser) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        targetUser = user;
      }
    } catch {
      // Fallback to cached user below
    }
  }

  if (!targetUser) {
    targetUser = getFallbackCachedUser();
  }

  if (!targetUser || (!targetUser.id && !targetUser.email)) {
    return null;
  }

  const selectColumns = `
    id,
    name,
    email,
    phone,
    region,
    assigned_regions,
    reports_to,
    team,
    is_active,
    assigned_role,
    auth_user_id,
    user_roles (
      id,
      key,
      name,
      hierarchy_level,
      can_manage_staff,
      can_assign_targets,
      can_view_all_sales
    )
  `;

  // 0. Attempt server-side auto-link for current authenticated user if RPC exists
  try {
    await supabase.rpc("link_current_user_staff");
  } catch {
    // Ignore if function not yet defined in database
  }

  let data: any = null;

  // 1. Try finding staff by auth_user_id or staff id
  if (targetUser.id) {
    const res1 = await supabase
      .from("staff")
      .select(selectColumns)
      .eq("auth_user_id", targetUser.id)
      .eq("is_active", true)
      .maybeSingle();

    if (res1.data) {
      data = res1.data;
    } else if (res1.error) {
      const fallback = await supabase
        .from("staff")
        .select(
          "id, name, email, phone, region, assigned_regions, reports_to, team, is_active, assigned_role, auth_user_id"
        )
        .eq("auth_user_id", targetUser.id)
        .eq("is_active", true)
        .maybeSingle();
      if (fallback.data) {
        data = fallback.data;
      }
    }

    if (!data) {
      const byStaffId = await supabase
        .from("staff")
        .select(selectColumns)
        .eq("id", targetUser.id)
        .eq("is_active", true)
        .maybeSingle();
      if (byStaffId.data) {
        data = byStaffId.data;
      }
    }
  }

  // 2. If not found by auth_user_id, try matching by email
  if (!data && targetUser.email) {
    const emailMatch = await supabase
      .from("staff")
      .select(selectColumns)
      .ilike("email", targetUser.email.trim())
      .eq("is_active", true)
      .maybeSingle();

    if (emailMatch.data) {
      data = emailMatch.data;
      if (targetUser.id && data.id !== targetUser.id) {
        void supabase
          .from("staff")
          .update({ auth_user_id: targetUser.id })
          .eq("id", data.id);
      }
    } else {
      const emailFallback = await supabase
        .from("staff")
        .select(
          "id, name, email, phone, region, assigned_regions, reports_to, team, is_active, assigned_role, auth_user_id"
        )
        .ilike("email", targetUser.email.trim())
        .eq("is_active", true)
        .maybeSingle();
      if (emailFallback.data) {
        data = emailFallback.data;
      }
    }
  }

  if (!data) return null;

  // Unpack any embedded password verifier metadata from team
  const { cleanTeam, passwordVerifier, mustChangeOnLogin } =
    unpackStaffTeamAuthMeta(data.team);
  if (passwordVerifier && data.email) {
    const existingRec = getPasswordResetRecord(data.email);
    if (!existingRec || existingRec.passwordVerifier !== passwordVerifier) {
      savePasswordResetRecord({
        email: data.email.trim().toLowerCase(),
        resetAt: existingRec?.resetAt || new Date().toISOString(),
        mustChangeOnLogin,
        passwordVerifier,
        deliveryChannels: existingRec?.deliveryChannels || ["remote_staff_sync"],
      });
    }
  }

  // Ensure user_roles is a single object, not an array
  let roleObj = data.user_roles
    ? Array.isArray(data.user_roles)
      ? data.user_roles[0]
      : data.user_roles
    : null;

  // Fallback 1: If join did not populate roleObj, fetch or resolve from assigned_role
  if (!roleObj && data.assigned_role) {
    try {
      const { data: fetchedRole } = await supabase
        .from("user_roles")
        .select(
          "id, key, name, hierarchy_level, can_manage_staff, can_assign_targets, can_view_all_sales"
        )
        .eq("id", data.assigned_role)
        .maybeSingle();

      if (fetchedRole) {
        roleObj = fetchedRole;
      }
    } catch (e) {
      console.warn("Direct role fetch notice:", e);
    }

    if (!roleObj) {
      const sysMatch = SYSTEM_ROLES.find(
        (r) =>
          r.id === data.assigned_role ||
          r.key.toLowerCase() === String(data.assigned_role).toLowerCase()
      );
      if (sysMatch) {
        roleObj = {
          id: sysMatch.id,
          key: sysMatch.key,
          name: sysMatch.name,
          hierarchy_level: sysMatch.hierarchy_level,
          can_manage_staff: sysMatch.can_manage_staff,
          can_assign_targets: sysMatch.can_assign_targets,
          can_view_all_sales: sysMatch.can_view_all_sales,
        };
      }
    }
  }

  // Fallback 2: Default administrator role object if still null
  if (!roleObj) {
    roleObj = {
      id: "a0000000-0000-4000-8000-000000000001",
      key: "administrator",
      name: "Administrator",
      hierarchy_level: 1,
      can_manage_staff: true,
      can_assign_targets: true,
      can_view_all_sales: true,
    };
  }

  return {
    ...data,
    team: cleanTeam || "Field Execution Team",
    user_roles: roleObj,
  };
}
