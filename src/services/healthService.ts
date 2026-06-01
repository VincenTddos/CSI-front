import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { DailyHealthRow, RoutineCheckupRow } from './database.types';

// =============================================================================
//  healthService — 日常健康記錄 (daily_health_records) 與例行健檢 (routine_checkups)
// =============================================================================

const LS_DAILY = 'csi_daily_health';
const LS_CHECKUP = 'csi_routine_checkup';

function lsLoad<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}
function lsSave<T>(key: string, rows: T[]) {
  localStorage.setItem(key, JSON.stringify(rows));
}

// ---- 日常健康（血壓 / 血氧）----
export async function listDailyHealth(residentId?: string): Promise<DailyHealthRow[]> {
  if (!isSupabaseConfigured) {
    const all = lsLoad<DailyHealthRow>(LS_DAILY);
    return residentId ? all.filter(r => r.resident_id === residentId) : all;
  }
  let q = supabase.from('daily_health_records').select('*').order('record_date', { ascending: false });
  if (residentId) q = q.eq('resident_id', residentId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function createDailyHealth(input: Partial<DailyHealthRow>): Promise<DailyHealthRow> {
  if (!isSupabaseConfigured) {
    const row = {
      id: crypto.randomUUID(),
      resident_id: input.resident_id ?? '',
      record_date: input.record_date ?? new Date().toISOString().slice(0, 10),
      record_time: input.record_time ?? null,
      bp_sys: input.bp_sys ?? null,
      bp_dia: input.bp_dia ?? null,
      blood_oxygen: input.blood_oxygen ?? null,
      recorded_by: input.recorded_by ?? null,
      created_at: new Date().toISOString(),
    } as DailyHealthRow;
    lsSave(LS_DAILY, [row, ...lsLoad<DailyHealthRow>(LS_DAILY)]);
    return row;
  }
  const { data, error } = await supabase.from('daily_health_records').insert(input).select().single();
  if (error) throw error;
  return data;
}

// ---- 例行健檢（體重 / 血糖 / 排泄）----
export async function listCheckups(residentId?: string): Promise<RoutineCheckupRow[]> {
  if (!isSupabaseConfigured) {
    const all = lsLoad<RoutineCheckupRow>(LS_CHECKUP);
    return residentId ? all.filter(r => r.resident_id === residentId) : all;
  }
  let q = supabase.from('routine_checkups').select('*').order('record_date', { ascending: false });
  if (residentId) q = q.eq('resident_id', residentId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function createCheckup(input: Partial<RoutineCheckupRow>): Promise<RoutineCheckupRow> {
  if (!isSupabaseConfigured) {
    const row = {
      id: crypto.randomUUID(),
      resident_id: input.resident_id ?? '',
      record_date: input.record_date ?? new Date().toISOString().slice(0, 10),
      weight: input.weight ?? null,
      blood_sugar: input.blood_sugar ?? null,
      urine_status: input.urine_status ?? '',
      stool_status: input.stool_status ?? '',
      recorded_by: input.recorded_by ?? null,
      created_at: new Date().toISOString(),
    } as RoutineCheckupRow;
    lsSave(LS_CHECKUP, [row, ...lsLoad<RoutineCheckupRow>(LS_CHECKUP)]);
    return row;
  }
  const { data, error } = await supabase.from('routine_checkups').insert(input).select().single();
  if (error) throw error;
  return data;
}
