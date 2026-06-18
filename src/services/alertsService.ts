import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { FallEventRow, AlertStatus } from './database.types';
import { seedAlerts } from '../lib/seedData';

// =============================================================================
//  alertsService — 跌倒 / 警報事件 (fall_events)
//  全系統唯一的警報資料來源（localStorage 模式：csi_alerts_v2）。
//  core_bridge.py 寫入；前端讀取與「確認 / 誤報」狀態更新。
//  resident_id 為指向住民的外鍵，刪除住民時由 DataContext 連動清除。
// =============================================================================

const LS_KEY = 'csi_alerts_v2';
const LS_SEEDED = 'csi_alerts_v2_seeded';

function lsLoad(): FallEventRow[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}
function lsSave(rows: FallEventRow[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(rows));
}

/** 首次啟動時注入示範警報（只做一次；之後即使被清空也不再自動補種）。 */
export function seedAlertsIfEmpty(): void {
  if (isSupabaseConfigured) return;
  if (localStorage.getItem(LS_SEEDED)) return;
  if (lsLoad().length === 0) lsSave(seedAlerts);
  localStorage.setItem(LS_SEEDED, '1');
}

/** 參照完整性：刪除住民時連動移除其名下警報（localStorage 模式）。 */
export function deleteAlertsByResident(residentId: string): void {
  if (isSupabaseConfigured) return; // 雲端由 FK ON DELETE CASCADE 處理
  lsSave(lsLoad().filter(a => a.resident_id !== residentId));
}

export async function listAlerts(limit = 200): Promise<FallEventRow[]> {
  if (!isSupabaseConfigured) return lsLoad();
  const { data, error } = await supabase
    .from('fall_events')
    .select('*')
    .order('detected_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function createAlert(input: Partial<FallEventRow>): Promise<FallEventRow> {
  if (!isSupabaseConfigured) {
    const row: FallEventRow = {
      id: crypto.randomUUID(),
      device_id: input.device_id ?? null,
      resident_id: input.resident_id ?? null,
      movement_score: input.movement_score ?? null,
      location_x: input.location_x ?? null,
      location_y: input.location_y ?? null,
      event_type: input.event_type ?? '跌倒風險',
      confidence: input.confidence ?? null,
      status: input.status ?? 'pending',
      feedback_note: input.feedback_note ?? null,
      acknowledged_by: input.acknowledged_by ?? null,
      detected_at: input.detected_at ?? new Date().toISOString(),
    };
    lsSave([row, ...lsLoad()]);
    return row;
  }
  const { data, error } = await supabase.from('fall_events').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateAlertStatus(
  id: string,
  status: AlertStatus,
  feedbackNote?: string,
): Promise<void> {
  const patch: Partial<FallEventRow> = { status };
  if (feedbackNote !== undefined) patch.feedback_note = feedbackNote;

  if (!isSupabaseConfigured) {
    lsSave(lsLoad().map(a => (a.id === id ? { ...a, ...patch } : a)));
    return;
  }
  const { error } = await supabase.from('fall_events').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteAlert(id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    lsSave(lsLoad().filter(a => a.id !== id));
    return;
  }
  const { error } = await supabase.from('fall_events').delete().eq('id', id);
  if (error) throw error;
}

/** 即時訂閱新警報（Supabase Realtime）。回傳取消訂閱函式。 */
export function subscribeNewAlerts(onInsert: (row: FallEventRow) => void): () => void {
  if (!isSupabaseConfigured) return () => {};
  const channel = supabase
    .channel('fall_events_inserts')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'fall_events' },
      (payload) => onInsert(payload.new as FallEventRow),
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
