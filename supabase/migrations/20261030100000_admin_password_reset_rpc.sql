-- Migration: Admin Password Reset & User Password Change RPCs
-- Description:
-- 1. Enables pgcrypto extension if not already enabled.
-- 2. Creates security-definer RPC `public.admin_reset_user_password(p_email, p_new_password)`
--    allowing administrators (verified via public.is_admin(auth.uid())) to directly reset
--    any existing user's password in `auth.users`.
-- 3. Adds optional `must_change_password` and `password_reset_at` tracking columns on `public.staff`.

create extension if not exists pgcrypto with schema extensions;

alter table public.staff
  add column if not exists must_change_password boolean default false,
  add column if not exists password_reset_at timestamptz;

create or replace function public.admin_reset_user_password(
  p_email text,
  p_new_password text,
  p_must_change boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_caller_uid uuid := auth.uid();
  v_target_uid uuid;
  v_clean_email text := lower(trim(p_email));
begin
  if v_caller_uid is null then
    return jsonb_build_object('success', false, 'message', 'Authentication required.');
  end if;

  if not public.is_admin(v_caller_uid) then
    return jsonb_build_object('success', false, 'message', 'Only administrators can reset user passwords.');
  end if;

  if p_new_password is null or length(p_new_password) < 6 then
    return jsonb_build_object('success', false, 'message', 'Password must be at least 6 characters long.');
  end if;

  select id into v_target_uid
  from auth.users
  where lower(email) = v_clean_email
  limit 1;

  if v_target_uid is null then
    return jsonb_build_object(
      'success', false,
      'code', 'USER_NOT_IN_AUTH',
      'message', 'User does not have an auth.users record yet; fallback to signUp provisioning.'
    );
  end if;

  update auth.users
  set encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now()
  where id = v_target_uid;

  update public.staff
  set auth_user_id = coalesce(auth_user_id, v_target_uid),
      must_change_password = coalesce(p_must_change, true),
      password_reset_at = now()
  where lower(email) = v_clean_email;

  return jsonb_build_object(
    'success', true,
    'user_id', v_target_uid,
    'message', 'Password updated in Supabase Auth.'
  );
end;
$$;

grant execute on function public.admin_reset_user_password(text, text, boolean) to authenticated;

