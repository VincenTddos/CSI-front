// =============================================================================
//  demoDevices — 感測裝置示範清單（單一來源，供 區域管理 與 全站離線告警 共用）
//  真實部署時，離線判定改以 devices.last_seen_at 心跳的「過期」為準（同一條規則）。
// =============================================================================

export interface DemoDevice {
  name: string;
  room: string;
  status: 'online' | 'offline';
  signal: number;          // RSSI dBm
  cv: number;              // Coefficient of Variation（訊號穩定度）
  baselineNoise: number;
  packetsPerSec: number;
  /** 距今最後一次心跳的分鐘數（對應 last_seen_at） */
  lastSeenMin: number;
}

/** 超過此分鐘數無心跳即視為離線（last_seen_at 過期門檻）。 */
export const DEVICE_STALE_MIN = 5;

export const DEMO_DEVICES: DemoDevice[] = [
  { name: 'CSI-Node-502', room: '502 號房', status: 'online', signal: -42, cv: 0.05, baselineNoise: 0.0012, packetsPerSec: 98, lastSeenMin: 0 },
  { name: 'CSI-Node-503', room: '503 號房', status: 'online', signal: -48, cv: 0.08, baselineNoise: 0.0018, packetsPerSec: 95, lastSeenMin: 1 },
  { name: 'CSI-Node-606', room: '606 號房', status: 'online', signal: -55, cv: 0.12, baselineNoise: 0.003, packetsPerSec: 88, lastSeenMin: 2 },
  { name: 'CSI-Node-5F-Common', room: '5F 交誼廳', status: 'online', signal: -38, cv: 0.04, baselineNoise: 0.0008, packetsPerSec: 100, lastSeenMin: 0 },
  // 心跳逾時（status 仍寫 online，但超過門檻無封包）→ 由過期規則判離線，示範 last_seen_at 偵測
  { name: 'CSI-Node-611', room: '611 號房', status: 'online', signal: -61, cv: 0.10, baselineNoise: 0.0025, packetsPerSec: 0, lastSeenMin: 9 },
  { name: 'CSI-Node-609', room: '609 號房', status: 'offline', signal: -90, cv: 0, baselineNoise: 0, packetsPerSec: 0, lastSeenMin: 14 },
];

/** 離線判定：明確 offline，或心跳逾期（last_seen_at 超過門檻）。 */
export function isDeviceOffline(d: DemoDevice, staleMin: number = DEVICE_STALE_MIN): boolean {
  return d.status === 'offline' || d.lastSeenMin >= staleMin;
}

export function getOfflineDevices(staleMin: number = DEVICE_STALE_MIN): DemoDevice[] {
  return DEMO_DEVICES.filter((d) => isDeviceOffline(d, staleMin));
}
