-- =============================================================================
--  Wi-Care 智慧長照監控系統 — 資料庫 Schema (PostgreSQL / Supabase)
--  Migration 0001: 初始化所有資料表、關聯、權限 (RLS) 與分析檢視表
--
--  此檔即論文的「實體關聯模型 (ER Model)」來源。
--  套用方式：Supabase Dashboard → SQL Editor 貼上執行，
--           或 `supabase db push`（已安裝 Supabase CLI 時）。
-- =============================================================================

-- 啟用 UUID 產生函式 (Supabase 預設已啟用 pgcrypto)
create extension if not exists "pgcrypto";

-- =============================================================================
--  ENUM 型別定義
-- =============================================================================
do $$ begin
  create type user_role         as enum ('medical', 'family', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type gender_type        as enum ('男', '女');
exception when duplicate_object then null; end $$;

do $$ begin
  create type device_status      as enum ('online', 'offline', 'error');
exception when duplicate_object then null; end $$;

do $$ begin
  create type alert_status       as enum ('pending', 'confirmed', 'false_alarm');
exception when duplicate_object then null; end $$;

do $$ begin
  create type checkup_status     as enum ('normal', 'abnormal', 'warning', '');
exception when duplicate_object then null; end $$;


-- =============================================================================
--  1. rooms (房間 / 病房)
-- =============================================================================
create table if not exists public.rooms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                 -- 例：'204 號房'
  width_m     numeric(4,1) default 6.0,      -- 房間寬 (公尺) — Wi-Fi 定位用
  height_m    numeric(4,1) default 5.0,      -- 房間長 (公尺)
  created_at  timestamptz not null default now()
);

-- =============================================================================
--  2. profiles (使用者個人資料 — 接 Supabase auth.users)
--     密碼、Email 由 Supabase Auth 管理 (自動雜湊)，此表僅存業務欄位
-- =============================================================================
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  real_name    text not null,
  role         user_role not null default 'medical',
  unit_code    text,                          -- 醫護人員單位代號
  family_code  text,                          -- 家屬代碼
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- =============================================================================
--  3. devices (ESP32-S3 感測裝置 — 多裝置核心)
-- =============================================================================
create table if not exists public.devices (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,                -- 例：'客廳-01'
  room_id       uuid references public.rooms(id) on delete set null,
  mac_address   text unique,
  firmware      text default 'ESPectre v2.7.0',
  status        device_status not null default 'offline',
  last_seen_at  timestamptz,                  -- 心跳：最後一次回報時間
  created_at    timestamptz not null default now()
);

-- =============================================================================
--  4. residents (被照護者 / 住民)
-- =============================================================================
create table if not exists public.residents (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  gender          gender_type,
  birth_date      date,
  room_id         uuid references public.rooms(id) on delete set null,
  contact_name    text,
  contact_phone   text,
  medications     text[] default '{}',        -- 用藥清單
  medical_history text[] default '{}',        -- 病史清單
  notes           text,
  family_user_id  uuid references public.profiles(id) on delete set null, -- 綁定家屬 (RLS 用)
  created_at      timestamptz not null default now()
);

-- =============================================================================
--  5. fall_events (跌倒 / 警報事件 — core_bridge 推送 + 前端確認)
-- =============================================================================
create table if not exists public.fall_events (
  id              uuid primary key default gen_random_uuid(),
  device_id       uuid references public.devices(id) on delete set null,
  resident_id     uuid references public.residents(id) on delete set null,
  movement_score  numeric(6,2),
  location_x      numeric(6,2),
  location_y      numeric(6,2),
  event_type      text default '跌倒風險',     -- '跌倒風險' | '異常震盪'
  confidence      numeric(5,2),                -- 信心 0-100
  status          alert_status not null default 'pending',
  feedback_note   text,
  acknowledged_by uuid references public.profiles(id) on delete set null,
  detected_at     timestamptz not null default now()
);
create index if not exists idx_fall_events_detected_at on public.fall_events(detected_at desc);
create index if not exists idx_fall_events_resident    on public.fall_events(resident_id);

-- =============================================================================
--  6. activity_summaries (活動量彙整 — 每分鐘一筆，供報表；不存 10Hz 原始)
-- =============================================================================
create table if not exists public.activity_summaries (
  id              uuid primary key default gen_random_uuid(),
  device_id       uuid references public.devices(id) on delete cascade,
  resident_id     uuid references public.residents(id) on delete set null,
  bucket_time     timestamptz not null,        -- 該分鐘的時間桶
  activity_level  text,                         -- 睡眠/靜坐/輕微活動/行走/激烈活動
  avg_score       numeric(6,2),
  max_score       numeric(6,2),
  sample_count    int default 0,
  created_at      timestamptz not null default now()
);
create index if not exists idx_activity_bucket on public.activity_summaries(bucket_time desc);
create unique index if not exists uq_activity_device_bucket
  on public.activity_summaries(device_id, bucket_time);

-- =============================================================================
--  7. daily_health_records (日常健康記錄 — 血壓 / 血氧)
-- =============================================================================
create table if not exists public.daily_health_records (
  id            uuid primary key default gen_random_uuid(),
  resident_id   uuid not null references public.residents(id) on delete cascade,
  record_date   date not null default current_date,
  record_time   time,
  bp_sys        int,                            -- 收縮壓
  bp_dia        int,                            -- 舒張壓
  blood_oxygen  int,                            -- 血氧飽和度 %
  recorded_by   uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_daily_health_resident_date
  on public.daily_health_records(resident_id, record_date desc);

-- =============================================================================
--  8. routine_checkups (例行健檢 — 體重 / 血糖 / 排泄)
-- =============================================================================
create table if not exists public.routine_checkups (
  id            uuid primary key default gen_random_uuid(),
  resident_id   uuid not null references public.residents(id) on delete cascade,
  record_date   date not null default current_date,
  weight        numeric(5,1),                   -- 體重 kg
  blood_sugar   int,                            -- 血糖 mg/dL
  urine_status  checkup_status default '',
  stool_status  checkup_status default '',
  recorded_by   uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_checkup_resident_date
  on public.routine_checkups(resident_id, record_date desc);

-- =============================================================================
--  9. device_settings (每裝置演算法設定 — 取代記憶體 settings)
-- =============================================================================
create table if not exists public.device_settings (
  device_id            uuid primary key references public.devices(id) on delete cascade,
  algorithm            text default 'mvs',      -- 'mvs' | 'ml'
  threshold_mode       text default 'auto',     -- 'auto' | 'min' | 'manual'
  manual_threshold     numeric,
  sensitivity          int  default 75,
  line_notify_enabled  boolean default true,
  adaptive_filter      boolean default true,
  hampel_filter        boolean default true,
  smoothing            boolean default true,
  updated_at           timestamptz not null default now()
);


-- =============================================================================
--  分析檢視表 (Analytics Views) — 供管理報表頁查詢，展現後端彙整邏輯
-- =============================================================================

-- 每位住民每日跌倒事件統計
create or replace view public.v_daily_fall_stats as
select
  resident_id,
  date_trunc('day', detected_at)                          as day,
  count(*)                                                as total_events,
  count(*) filter (where status = 'confirmed')            as confirmed_events,
  count(*) filter (where status = 'false_alarm')          as false_alarms,
  count(*) filter (where status = 'pending')              as pending_events
from public.fall_events
group by resident_id, date_trunc('day', detected_at);

-- 每位住民每日活動量趨勢
create or replace view public.v_daily_activity as
select
  resident_id,
  date_trunc('day', bucket_time)  as day,
  round(avg(avg_score), 2)        as avg_activity,
  max(max_score)                  as peak_activity,
  sum(sample_count)               as total_samples
from public.activity_summaries
group by resident_id, date_trunc('day', bucket_time);

-- 裝置在線率 (最近一次心跳 5 分鐘內視為 online)
create or replace view public.v_device_health as
select
  d.id,
  d.name,
  d.status,
  d.last_seen_at,
  (d.last_seen_at is not null and d.last_seen_at > now() - interval '5 minutes') as is_live
from public.devices d;


-- =============================================================================
--  Row-Level Security (RLS) — 角色權限控管
--  admin：全權；medical：可讀寫業務資料；family：僅能看綁定的住民
-- =============================================================================

-- 取得目前登入者角色的輔助函式
create or replace function public.current_role()
returns user_role
language sql stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- 開啟 RLS
alter table public.rooms                enable row level security;
alter table public.profiles             enable row level security;
alter table public.devices              enable row level security;
alter table public.residents            enable row level security;
alter table public.fall_events          enable row level security;
alter table public.activity_summaries   enable row level security;
alter table public.daily_health_records enable row level security;
alter table public.routine_checkups     enable row level security;
alter table public.device_settings      enable row level security;

-- profiles：本人可讀寫自己；admin 可讀全部
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles
  for all using (id = auth.uid() or public.current_role() = 'admin')
  with check (id = auth.uid() or public.current_role() = 'admin');

-- 通用「已登入即可讀」的參照表 (rooms / devices / device_settings)
drop policy if exists rooms_read on public.rooms;
create policy rooms_read on public.rooms
  for select using (auth.uid() is not null);
drop policy if exists rooms_write on public.rooms;
create policy rooms_write on public.rooms
  for all using (public.current_role() in ('admin','medical'))
  with check (public.current_role() in ('admin','medical'));

drop policy if exists devices_read on public.devices;
create policy devices_read on public.devices
  for select using (auth.uid() is not null);
drop policy if exists devices_write on public.devices;
create policy devices_write on public.devices
  for all using (public.current_role() in ('admin','medical'))
  with check (public.current_role() in ('admin','medical'));

drop policy if exists device_settings_rw on public.device_settings;
create policy device_settings_rw on public.device_settings
  for all using (public.current_role() in ('admin','medical'))
  with check (public.current_role() in ('admin','medical'));

-- residents：admin/medical 全看；family 只能看自己綁定的住民
drop policy if exists residents_read on public.residents;
create policy residents_read on public.residents
  for select using (
    public.current_role() in ('admin','medical')
    or family_user_id = auth.uid()
  );
drop policy if exists residents_write on public.residents;
create policy residents_write on public.residents
  for all using (public.current_role() in ('admin','medical'))
  with check (public.current_role() in ('admin','medical'));

-- 業務資料表的共用 family 可見性：限其綁定住民
-- fall_events
drop policy if exists fall_events_read on public.fall_events;
create policy fall_events_read on public.fall_events
  for select using (
    public.current_role() in ('admin','medical')
    or resident_id in (select id from public.residents where family_user_id = auth.uid())
  );
drop policy if exists fall_events_write on public.fall_events;
create policy fall_events_write on public.fall_events
  for all using (public.current_role() in ('admin','medical'))
  with check (public.current_role() in ('admin','medical'));

-- activity_summaries
drop policy if exists activity_read on public.activity_summaries;
create policy activity_read on public.activity_summaries
  for select using (
    public.current_role() in ('admin','medical')
    or resident_id in (select id from public.residents where family_user_id = auth.uid())
  );
drop policy if exists activity_write on public.activity_summaries;
create policy activity_write on public.activity_summaries
  for all using (public.current_role() in ('admin','medical'))
  with check (public.current_role() in ('admin','medical'));

-- daily_health_records
drop policy if exists daily_health_read on public.daily_health_records;
create policy daily_health_read on public.daily_health_records
  for select using (
    public.current_role() in ('admin','medical')
    or resident_id in (select id from public.residents where family_user_id = auth.uid())
  );
drop policy if exists daily_health_write on public.daily_health_records;
create policy daily_health_write on public.daily_health_records
  for all using (public.current_role() in ('admin','medical'))
  with check (public.current_role() in ('admin','medical'));

-- routine_checkups
drop policy if exists checkup_read on public.routine_checkups;
create policy checkup_read on public.routine_checkups
  for select using (
    public.current_role() in ('admin','medical')
    or resident_id in (select id from public.residents where family_user_id = auth.uid())
  );
drop policy if exists checkup_write on public.routine_checkups;
create policy checkup_write on public.routine_checkups
  for all using (public.current_role() in ('admin','medical'))
  with check (public.current_role() in ('admin','medical'));

-- =============================================================================
--  自動建立 profile：使用者註冊時，依 auth metadata 建立 profiles 一筆
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, real_name, role, unit_code, family_code)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'real_name', new.email),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'medical'),
    new.raw_user_meta_data->>'unit_code',
    new.raw_user_meta_data->>'family_code'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
--  完成。下一步：Supabase Dashboard → SQL Editor 執行本檔。
-- =============================================================================
