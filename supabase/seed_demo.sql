-- =============================================================================
--  seed_demo.sql — 智慧照護分析「示範資料」（選用）
--
--  目的：在尚未累積真實感測資料前，先灌入一週的示範活動/跌倒/健康資料，
--        讓「智慧分析」「管理報表」頁有東西可展示（口試 demo 用）。
--
--  執行：Supabase SQL Editor 貼上 → Run。可重複執行（每次新增一位示範長輩）。
--  清除：delete from residents where notes = '種子示範資料';（連動資料會一併刪除）
-- =============================================================================

-- 1) 建立示範裝置 + 示範住民，並灌入 7 天 × 每小時 活動資料
with dev as (
  insert into public.devices (name, status, last_seen_at)
  values ('示範裝置-客廳', 'online', now())
  returning id
),
res as (
  insert into public.residents (name, gender, birth_date, notes)
  values ('示範長輩', '女', '1945-03-12', '種子示範資料')
  returning id
),
hours as (
  select ts, extract(hour from ts)::int as h
  from generate_series(date_trunc('hour', now()) - interval '6 days',
                       date_trunc('hour', now()), interval '1 hour') as ts
),
scored as (
  select ts, greatest(0, round(
    (case
       when h between 0 and 5  then 3
       when h between 6 and 7  then 22
       when h between 8 and 10 then 48
       when h between 11 and 12 then 33
       when h between 13 and 16 then 52
       when h between 17 and 19 then 42
       when h between 20 and 21 then 28
       else 7
     end)
    + (random() * 12 - 6)
    + case when h between 1 and 3 and random() < 0.4 then 35 else 0 end  -- 偶發夜間活動
  ))::int as score
  from hours
)
insert into public.activity_summaries
  (device_id, resident_id, bucket_time, activity_level, avg_score, max_score, sample_count)
select (select id from dev), (select id from res), ts,
  case when score < 5 then '睡眠'
       when score < 15 then '靜坐'
       when score < 35 then '輕微活動'
       when score < 65 then '行走'
       else '激烈活動' end,
  score, least(100, round(score * 1.4)::int), 60
from scored;

-- 2) 幾筆跌倒事件（含已確認 / 誤報）
insert into public.fall_events
  (device_id, resident_id, movement_score, event_type, confidence, status, detected_at)
select d.id, r.id, v.score, '跌倒風險', v.conf, v.status::alert_status, v.t
from (select id from public.devices   where name = '示範裝置-客廳' order by created_at desc limit 1) d,
     (select id from public.residents where notes = '種子示範資料' order by created_at desc limit 1) r,
     (values
        (128, 95, 'confirmed',   now() - interval '2 days'),
        (115, 88, 'false_alarm', now() - interval '4 days'),
        (140, 97, 'confirmed',   now() - interval '5 days' + interval '3 hours')
     ) as v(score, conf, status, t);

-- 3) 日常健康記錄（血壓 / 血氧；故意有偏高/偏低觸發風險因子）
insert into public.daily_health_records
  (resident_id, record_date, record_time, bp_sys, bp_dia, blood_oxygen)
select r.id, v.d::date, time '08:00', v.sys, v.dia, v.spo2
from (select id from public.residents where notes = '種子示範資料' order by created_at desc limit 1) r,
     (values
        (now() - interval '1 day', 138, 86, 94),
        (now() - interval '3 day', 142, 90, 93),
        (now() - interval '5 day', 135, 85, 96)
     ) as v(d, sys, dia, spo2);

-- 4) 例行健檢（體重 / 血糖）
insert into public.routine_checkups
  (resident_id, record_date, weight, blood_sugar, urine_status, stool_status)
select r.id, v.d::date, v.w, v.sugar, 'normal'::checkup_status, 'normal'::checkup_status
from (select id from public.residents where notes = '種子示範資料' order by created_at desc limit 1) r,
     (values
        (now() - interval '1 day', 58.5, 110),
        (now() - interval '4 day', 59.0, 125)
     ) as v(d, w, sugar);

-- 完成：到「智慧分析」頁選「示範長輩」即可看到熱力圖、風險評分與 AI 週報。
