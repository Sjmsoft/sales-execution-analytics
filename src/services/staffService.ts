import { supabase } from "../lib/supabase";

export async function getCurrentStaff() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
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

  // 1. Try finding staff by auth_user_id
  let data: any = null;
  const res1 = await supabase
    .from("staff")
    .select(selectColumns)
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (res1.data) {
    data = res1.data;
  } else if (res1.error) {
    console.warn("getCurrentStaff by auth_user_id notice:", res1.error);
    // Fallback: try querying base staff columns without join
    const fallback = await supabase
      .from("staff")
      .select("id, name, email, phone, region, assigned_regions, reports_to, team, is_active, assigned_role, auth_user_id")
      .eq("auth_user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    if (fallback.data) {
      data = fallback.data;
    }
  }

  // 2. If not found by auth_user_id, try matching by email
  if (!data && user.email) {
    const emailMatch = await supabase
      .from("staff")
      .select(selectColumns)
      .ilike("email", user.email.trim())
      .eq("is_active", true)
      .maybeSingle();

    if (emailMatch.data) {
      data = emailMatch.data;
      // Auto-link auth_user_id to staff record in background
      void supabase
        .from("staff")
        .update({ auth_user_id: user.id })
        .eq("id", data.id);
    } else {
      // Fallback: query without join by email
      const emailFallback = await supabase
        .from("staff")
        .select("id, name, email, phone, region, assigned_regions, reports_to, team, is_active, assigned_role, auth_user_id")
        .ilike("email", user.email.trim())
        .eq("is_active", true)
        .maybeSingle();
      if (emailFallback.data) {
        data = emailFallback.data;
        void supabase
          .from("staff")
          .update({ auth_user_id: user.id })
          .eq("id", data.id);
      }
    }
  }

  if (!data) return null;

  // Ensure user_roles is a single object, not an array
  let roleObj = data.user_roles
    ? Array.isArray(data.user_roles)
      ? data.user_roles[0]
      : data.user_roles
    : null;

  // Fallback: If join did not populate roleObj, fetch or resolve from assigned_role
  if (!roleObj && data.assigned_role) {
    try {
      const { data: fetchedRole } = await supabase
        .from("user_roles")
        .select("id, key, name, hierarchy_level, can_manage_staff, can_assign_targets, can_view_all_sales")
        .eq("id", data.assigned_role)
        .maybeSingle();

      if (fetchedRole) {
        roleObj = fetchedRole;
      }
    } catch (e) {
      console.warn("Direct role fetch notice:", e);
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
    user_roles: roleObj,
  };
}