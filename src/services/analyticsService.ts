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

/** 每日活動量趨勢 */
export async function getDailyActivity(residentId?: string, sinceDays = 30): Promise<DailyActivityRow[]> {
  if (!isSupabaseConfigured) return [];
  const since = new Date(Date.now() - sinceDays * 86400000).toISOString();
  let q = supabase.from('v_daily_activity').select('*').gte('day', since).order('day', { ascending: true });
  if (residentId) q = q.eq('resident_id', residentId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

/** 裝置在線率 */
export async function getDeviceHealth(): Promise<DeviceHealthRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('v_device_health').select('*');
  if (error) throw error;
  return data ?? [];
}
