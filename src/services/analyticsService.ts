import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { DailyFallStatRow, DailyActivityRow, DeviceHealthRow } from './database.types';
import { listAlerts } from './alertsService';

// =============================================================================
//  analyticsService — 管理報表查詢（跌倒統計 / 活動量趨勢 / 裝置在線率）
//  以 Postgres 檢視表 (v_daily_fall_stats / v_daily_activity / v_device_health)
//  為後端彙整邏輯來源。
// =============================================================================

/** 每日跌倒事件統計（可選某住民、最近 N 天） */
export async function getDailyFallStats(residentId?: string, sinceDays = 30): Promise<DailyFallStatRow[]> {
  if (!isSupabaseConfigured) {
    // fallback：用 alerts 即時彙整
    const alerts = await listAlerts(1000);
    const byDay = new Map<string, DailyFallStatRow>();
    for (const a of alerts) {
      if (residentId && a.resident_id !== residentId) continue;
      const day = a.detected_at.slice(0, 10);
      const key = `${a.resident_id}|${day}`;
      const cur = byDay.get(key) ?? {
        resident_id: a.resident_id ?? '', day,
        total_events: 0, confirmed_events: 0, false_alarms: 0, pending_events: 0,
      };
      cur.total_events += 1;
      if (a.status === 'confirmed') cur.confirmed_events += 1;
      else if (a.status === 'false_alarm') cur.false_alarms += 1;
      else cur.pending_events += 1;
      byDay.set(key, cur);
    }
    return [...byDay.values()];
  }
  const since = new Date(Date.now() - sinceDays * 86400000).toISOString();
  let q = supabase.from('v_daily_fall_stats').select('*').gte('day', since).order('day', { ascending: false });
  if (residentId) q = q.eq('resident_id', residentId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

// 模擬模式：以 residentId 為種子產生穩定（每次相同）的每日活動量趨勢，讓 demo 不空白
function synthDailyActivity(residentId: string | undefined, days: number): DailyActivityRow[] {
  const seed = (residentId ?? 'all').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const out: DailyActivityRow[] = [];
  const now = new Date();
  for (let d = days - 1; d >= 0; d--) {
    const dt = new Date(now); dt.setDate(now.getDate() - d);
    const wave = Math.abs(Math.sin((seed + d) * 0.6));
    const avg = Math.round(25 + wave * 35);
    const peak = Math.min(100, Math.round(avg + 20 + wave * 30));
    out.push({ resident_id: residentId ?? '', day: dt.toISOString().slice(0, 10), avg_activity: avg, peak_activity: peak, total_samples: 240 });
  }
  return out;
}

/** 每日活動量趨勢 */
export async function getDailyActivity(residentId?: string, sinceDays = 30): Promise<DailyActivityRow[]> {
  if (!isSupabaseConfigured) return synthDailyActivity(residentId, sinceDays);
  const since = new Date(Date.now() - sinceDays * 86400000).toISOString();
  let q = supabase.from('v_daily_activity').select('*').gte('day', since).order('day', { ascending: true });
  if (residentId) q = q.eq('resident_id', residentId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

// 模擬模式：示範裝置在線狀態
function synthDevices(): DeviceHealthRow[] {
  const now = new Date().toISOString();
  return [
    { id: 'dev-1', name: '客廳 ESP32-S3', status: 'online', last_seen_at: now, is_live: true },
    { id: 'dev-2', name: '臥室 ESP32-S3', status: 'online', last_seen_at: now, is_live: true },
    { id: 'dev-3', name: '浴室 ESP32-S3', status: 'offline', last_seen_at: new Date(Date.now() - 3600000).toISOString(), is_live: false },
  ];
}

/** 裝置在線率 */
export async function getDeviceHealth(): Promise<DeviceHealthRow[]> {
  if (!isSupabaseConfigured) return synthDevices();
  const { data, error } = await supabase.from('v_device_health').select('*');
  if (error) throw error;
  return data ?? [];
}
