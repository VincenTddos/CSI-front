import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { DeviceRow, DeviceHealthRow } from './database.types';

// =============================================================================
//  devicesService — 感測裝置 (devices) 與在線健康狀態 (v_device_health)
// =============================================================================

const LS_KEY = 'csi_devices';

function lsLoad(): DeviceRow[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}
function lsSave(rows: DeviceRow[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(rows));
}

export async function listDevices(): Promise<DeviceRow[]> {
  if (!isSupabaseConfigured) return lsLoad();
  const { data, error } = await supabase.from('devices').select('*').order('name');
  if (error) throw error;
  return data ?? [];
}

export async function listDeviceHealth(): Promise<DeviceHealthRow[]> {
  if (!isSupabaseConfigured) {
    return lsLoad().map(d => ({
      id: d.id, name: d.name, status: d.status, last_seen_at: d.last_seen_at,
      is_live: d.status === 'online',
    }));
  }
  const { data, error } = await supabase.from('v_device_health').select('*');
  if (error) throw error;
  return data ?? [];
}

export async function createDevice(input: Partial<DeviceRow>): Promise<DeviceRow> {
  if (!isSupabaseConfigured) {
    const row: DeviceRow = {
      id: crypto.randomUUID(),
      name: input.name ?? '新裝置',
      room_id: input.room_id ?? null,
      mac_address: input.mac_address ?? null,
      firmware: input.firmware ?? 'ESPectre v2.7.0',
      status: input.status ?? 'offline',
      last_seen_at: input.last_seen_at ?? null,
      created_at: new Date().toISOString(),
    };
    lsSave([...lsLoad(), row]);
    return row;
  }
  const { data, error } = await supabase.from('devices').insert(input).select().single();
  if (error) throw error;
  return data;
}
