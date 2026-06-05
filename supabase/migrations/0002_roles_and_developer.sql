-- =============================================================================
--  Migration 0002 — 新增「開發者」最高角色 + 權限強化
--
--  ⚠️ 執行方式（Supabase SQL Editor）：
--     1) 先單獨執行【第一段】ALTER TYPE，按 Run（PostgreSQL 規定新增的 enum 值
--        必須先 commit 才能在同一交易使用）。
--     2) 再執行【第二段】其餘所有 SQL。
-- =============================================================================


-- ========================= 第一段（先單獨執行） =========================
alter type user_role add value if not exists 'developer';


-- ========================= 第二段（接著執行） ===========================

-- 開發者信箱白名單（與前端 src/lib/roles.ts 保持一致）
-- 要新增開發者，改這個函式回傳的陣列即可。
create or replace function public.developer_emails()
returns text[] language sql immutable as $$
  select array['vincent6244@gmail.com'];
$$;

-- 權限輔助函式
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()) in ('admin','developer'), false);
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()) in ('admin','medical','developer'), false);
$$;

-- ---- 重建 RLS 政策，改用 is_admin()/is_staff()（讓 developer 享 admin 級權限）----
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles
  for all using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists rooms_write on public.rooms;
create policy rooms_write on public.rooms
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists devices_write on public.devices;
create policy devices_write on public.devices
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists device_settings_rw on public.device_settings;
create policy device_settings_rw on public.device_settings
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists residents_read on public.residents;
create policy residents_read on public.residents
  for select using (public.is_staff() or family_user_id = auth.uid());
drop policy if exists residents_write on public.residents;
create policy residents_write on public.residents
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists fall_events_read on public.fall_events;
create policy fall_events_read on public.fall_events
  for select using (
    public.is_staff()
    or resident_id in (select id from public.residents where family_user_id = auth.uid())
  );
drop policy if exists fall_events_write on public.fall_events;
create policy fall_events_write on public.fall_events
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists activity_read on public.activity_summaries;
create policy activity_read on public.activity_summaries
  for select using (
    public.is_staff()
    or resident_id in (select id from public.residents where family_user_id = auth.uid())
  );
drop policy if exists activity_write on public.activity_summaries;
create policy activity_write on public.activity_summaries
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists daily_health_read on public.daily_health_records;
create policy daily_health_read on public.daily_health_records
  for select using (
    public.is_staff()
    or resident_id in (select id from public.residents where family_user_id = auth.uid())
  );
drop policy if exists daily_health_write on public.daily_health_records;
create policy daily_health_write on public.daily_health_records
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists checkup_read on public.routine_checkups;
create policy checkup_read on public.routine_checkups
  for select using (
    public.is_staff()
    or resident_id in (select id from public.residents where family_user_id = auth.uid())
  );
drop policy if exists checkup_write on public.routine_checkups;
create policy checkup_write on public.routine_checkups
  for all using (public.is_staff()) with check (public.is_staff());

-- ---- 註冊時自動指派角色：開發者信箱 → developer；其餘預設 family ----
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta_role user_role;
  final_role user_role;
begin
  meta_role := (new.raw_user_meta_data->>'role')::user_role;
  if new.email = any(public.developer_emails()) then
    final_role := 'developer';
  else
    final_role := coalesce(meta_role, 'family');  -- Google 註冊無 metadata → 最低權限
  end if;

  insert into public.profiles (id, real_name, role, unit_code, family_code)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'real_name', new.email),
    final_role,
    new.raw_user_meta_data->>'unit_code',
    new.raw_user_meta_data->>'family_code'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---- 防自我提權：非 admin/developer 不得變更自己的 role ----
create or replace function public.guard_role_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role then
    -- 允許：操作者本身是 admin/developer（含 SQL editor / service_role：auth.uid() 為 null）
    if auth.uid() is not null and not public.is_admin() then
      raise exception '權限不足：不可變更角色';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_role_change on public.profiles;
create trigger trg_guard_role_change
  before update on public.profiles
  for each row execute function public.guard_role_change();

-- ---- 一次性：把白名單信箱的既有帳號提升為 developer ----
update public.profiles p
set role = 'developer'
from auth.users u
where p.id = u.id
  and u.email = any(public.developer_emails())
  and p.role <> 'developer';

-- =============================================================================
--  完成。開發者帳號（vincent6244@gmail.com）登入後即為最高權限。
-- =============================================================================
