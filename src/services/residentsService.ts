import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { ResidentRow } from './database.types';

// =============================================================================
//  residentsService — 住民（被照護者）資料存取
//  已設定 Supabase → 雲端資料庫；未設定 → localStorage fallback（開發用）
// =============================================================================

const LS_KEY = 'csi_residents';

function lsLoad(): ResidentRow[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}
function lsSave(rows: ResidentRow[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(rows));
}

export async function listResidents(): Promise<ResidentRow[]> {
  if (!isSupabaseConfigured) return lsLoad();
  const { data, error } = await supabase
    .from('residents')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createResident(input: Partial<ResidentRow>): Promise<ResidentRow> {
  if (!isSupabaseConfigured) {
    const row: ResidentRow = {
      id: crypto.randomUUID(),
      name: input.name ?? '',
      gender: input.gender ?? null,
      birth_date: input.birth_date ?? null,
      room_id: input.room_id ?? null,
      contact_name: input.contact_name ?? null,
      contact_phone: input.contact_phone ?? null,
      medications: input.medications ?? [],
      medical_history: input.medical_history ?? [],
      notes: input.notes ?? null,
      family_user_id: input.family_user_id ?? null,
      created_at: new Date().toISOString(),
    };
    lsSave([row, ...lsLoad()]);
    return row;
  }
  const { data, error } = await supabase.from('residents').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateResident(id: string, patch: Partial<ResidentRow>): Promise<void> {
  if (!isSupabaseConfigured) {
    lsSave(lsLoad().map(r => (r.id === id ? { ...r, ...patch } : r)));
    return;
  }
  const { error } = await supabase.from('residents').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteResident(id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    lsSave(lsLoad().filter(r => r.id !== id));
    return;
  }
  const { error } = await supabase.from('residents').delete().eq('id', id);
  if (error) throw error;
}
