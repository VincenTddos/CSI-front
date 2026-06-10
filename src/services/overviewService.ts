import { supabase, isSupabaseConfigured } from '../lib/supabase';

// =============================================================================
//  overviewService — 機構級多房間監控總覽
//  彙整 rooms + devices(心跳) + residents + fall_events(待處理) + activity_summaries
//  已設定 Supabase → 雲端查詢；未設定 → 展示用 demo 資料
// =============================================================================

export interface RoomStatus {
  roomId: string;
  roomName: string;
  deviceName: string | null;
  deviceOnline: boolean;
  lastSeenAt: string | null;
  residentNames: string[];
  pendingAlerts: number;          // 待處理跌倒/異常事件數
  latestActivity: string | null;  // 最近一筆活動等級
  light: 'red' | 'yellow' | 'green' | 'gray';
}

const ONLINE_WINDOW_MS = 90_000; // 心跳 30 秒一次，90 秒沒心跳視為離線

export async function fetchRoomOverview(): Promise<RoomStatus[]> {
  if (!isSupabaseConfigured) return demoOverview(); // 無金鑰時的展示資料

  // 三段查詢平行發出
  const [roomsQ, alertsQ, actQ] = await Promise.all([
    supabase.from('rooms').select(`
      id, name,
      devices ( id, name, status, last_seen_at ),
      residents ( name )
    `),
    supabase.from('fall_events')
      .select('device_id')
      .eq('status', 'pending'),
    supabase.from('activity_summaries')
      .select('device_id, activity_level, bucket_time')
      .order('bucket_time', { ascending: false })
      .limit(50),
  ]);

  if (roomsQ.error) throw roomsQ.error;

  const pendingByDevice = new Map<string, number>();
  for (const row of alertsQ.data ?? []) {
    if (!row.device_id) continue;
    pendingByDevice.set(row.device_id, (pendingByDevice.get(row.device_id) ?? 0) + 1);
  }
  const latestActByDevice = new Map<string, string>();
  for (const row of actQ.data ?? []) {
    if (row.device_id && row.activity_level && !latestActByDevice.has(row.device_id)) {
      latestActByDevice.set(row.device_id, row.activity_level);
    }
  }

  const now = Date.now();
  return (roomsQ.data ?? []).map((room: any): RoomStatus => {
    const device = room.devices?.[0] ?? null;
    const online = device?.last_seen_at
      ? now - new Date(device.last_seen_at).getTime() < ONLINE_WINDOW_MS
      : false;
    const pending = device ? (pendingByDevice.get(device.id) ?? 0) : 0;

    let light: RoomStatus['light'] = 'gray';
    if (device) {
      if (pending > 0) light = 'red';
      else if (!online) light = 'yellow';
      else light = 'green';
    }

    return {
      roomId: room.id,
      roomName: room.name,
      deviceName: device?.name ?? null,
      deviceOnline: online,
      lastSeenAt: device?.last_seen_at ?? null,
      residentNames: (room.residents ?? []).map((r: any) => r.name),
      pendingAlerts: pending,
      latestActivity: device ? (latestActByDevice.get(device.id) ?? null) : null,
      light,
    };
  });
}

function demoOverview(): RoomStatus[] {
  const nowIso = new Date().toISOString();
  return [
    { roomId: '1', roomName: '204 號房', deviceName: '客廳-01', deviceOnline: true,
      lastSeenAt: nowIso, residentNames: ['王小明'],
      pendingAlerts: 0, latestActivity: '靜坐', light: 'green' },
    { roomId: '2', roomName: '205 號房', deviceName: '臥室-02', deviceOnline: true,
      lastSeenAt: nowIso, residentNames: ['林美麗'],
      pendingAlerts: 1, latestActivity: '激烈活動', light: 'red' },
    { roomId: '3', roomName: '206 號房', deviceName: null, deviceOnline: false,
      lastSeenAt: null, residentNames: [], pendingAlerts: 0,
      latestActivity: null, light: 'gray' },
  ];
}
