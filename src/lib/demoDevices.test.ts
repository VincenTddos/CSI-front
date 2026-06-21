import { describe, expect, it } from 'vitest';
import { DEMO_DEVICES, isDeviceOffline, getOfflineDevices, DEVICE_STALE_MIN } from './demoDevices';

const base = DEMO_DEVICES[0];

describe('isDeviceOffline', () => {
  it('明確 offline 視為離線', () => {
    expect(isDeviceOffline({ ...base, status: 'offline', lastSeenMin: 0 })).toBe(true);
  });
  it('心跳逾時（online 但 lastSeenMin ≥ 門檻）視為離線', () => {
    expect(isDeviceOffline({ ...base, status: 'online', lastSeenMin: DEVICE_STALE_MIN })).toBe(true);
  });
  it('剛回報的 online 裝置非離線', () => {
    expect(isDeviceOffline({ ...base, status: 'online', lastSeenMin: 0 })).toBe(false);
  });
});

describe('getOfflineDevices（示範資料）', () => {
  it('同時標出「明確離線」與「心跳逾時」裝置', () => {
    const names = getOfflineDevices().map(d => d.name);
    expect(names).toContain('CSI-Node-609'); // 明確 offline
    expect(names).toContain('CSI-Node-611'); // 心跳逾時（stale）
    expect(names.length).toBeGreaterThanOrEqual(2);
  });
});
