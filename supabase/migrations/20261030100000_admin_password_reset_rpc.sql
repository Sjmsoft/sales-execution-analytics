-- Migration: Admin Password Reset & User Password Change RPCs
-- Description:
-- 1. Enables pgcrypto extension if not already enabled.
-- 2. Creates security-definer RPC `public.admin_reset_user_password(p_email, p_new_password, p_must_change)`
--    allowing password resets and generated passwords to be authenticated directly in `auth.users`
--    (creating the `auth.users` + `auth.identities` record if the staff member does not yet have one).
-- 3. Creates security-definer RPC `public.user_change_own_password(p_email, p_new_password)`
--    allowing users to update their password in `auth.users` and `public.staff`.
-- 4. Adds optional `must_change_password` and `password_reset_at` tracking columns on `public.staff`.

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
  v_target_uid uuid;
  v_clean_email text := lower(trim(p_email));
  v_clean_pw text := trim(p_new_password);
  v_has_identity boolean := false;
begin
  if v_clean_email is null or v_clean_email = '' then
    return jsonb_build_object('success', false, 'message', 'Email is required.');
  end if;

  if v_clean_pw is null or length(v_clean_pw) < 6 then
    return jsonb_build_object('success', false, 'message', 'Password must be at least 6 characters long.');
  end if;

  select id into v_target_uid
  from auth.users
  where lower(email) = v_clean_email
  limit 1;

  if v_target_uid is not null then
    update auth.users
    set encrypted_password = extensions.crypt(v_clean_pw, extensions.gen_salt('bf', 10)),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        confirmation_token = coalesce(confirmation_token, ''),
        recovery_token = coalesce(recovery_token, ''),
        email_change_token_new = coalesce(email_change_token_new, ''),
        email_change = coalesce(email_change, ''),
        raw_app_meta_data = coalesce(raw_app_meta_data, '{"provider":"email","providers":["email"]}'::jsonb),
        raw_user_meta_data = coalesce(
          raw_user_meta_data,
          jsonb_build_object(
            'sub', v_target_uid::text,
            'email', v_clean_email,
            'email_verified', true,
            'phone_verified', false
          )
        ),
        updated_at = now()
    where id = v_target_uid;

    select exists(
      select 1 from auth.identities where user_id = v_target_uid and provider = 'email'
    ) into v_has_identity;

    if not v_has_identity then
      insert into auth.identities (
        id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) values (
        extensions.gen_random_uuid(),
        v_target_uid,
        v_target_uid::text,
        jsonb_build_object(
          'sub', v_target_uid::text,
          'email', v_clean_email,
          'email_verified', true,
          'phone_verified', false
        ),
        'email',
        now(),
        now(),
        now()
      );
    end if;
  else
    v_target_uid := extensions.gen_random_uuid();

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      is_sso_user,
      is_anonymous
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_target_uid,
      'authenticated',
      'authenticated',
      v_clean_email,
      extensions.crypt(v_clean_pw, extensions.gen_salt('bf', 10)),
      now(),
      '',
      '',
      '',
      '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'sub', v_target_uid::text,
        'email', v_clean_email,
        'email_verified', true,
        'phone_verified', false
      ),
      now(),
      now(),
      false,
      false
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      extensions.gen_random_uuid(),
      v_target_uid,
      v_target_uid::text,
      jsonb_build_object(
        'sub', v_target_uid::text,
        'email', v_clean_email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      now(),
      now(),
      now()
    );
  end if;

  update public.staff
  set auth_user_id = v_target_uid,
      must_change_password = coalesce(p_must_change, true),
      password_reset_at = now()
  where lower(email) = v_clean_email;

  return jsonb_build_object(
    'success', true,
    'user_id', v_target_uid,
    'message', 'Password updated and authenticated in Supabase database.'
  );
end;
$$;

grant execute on function public.admin_reset_user_password(text, text, boolean) to authenticated, anon;

create or replace function public.user_change_own_password(
  p_email text,
  p_new_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return public.admin_reset_user_password(p_email, p_new_password, false);
end;
$$;

grant execute on function public.user_change_own_password(text, text) to authenticated, anon;

-- Also create a security-definer helper to update staff password metadata safely
create or replace function public.sync_staff_password_meta(
  p_email text,
  p_team text,
  p_phone text default null,
  p_must_change boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean_email text := lower(trim(p_email));
begin
  update public.staff
  set team = coalesce(p_team, team),
      phone = case when p_phone is not null and trim(p_phone) <> '' then trim(p_phone) else phone end,
      must_change_password = coalesce(p_must_change, must_change_password, false),
      password_reset_at = now()
  where lower(email) = v_clean_email;

  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.sync_staff_password_meta(text, text, text, boolean) to authenticated, anon;
