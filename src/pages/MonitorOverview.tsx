import { useEffect, useState, useCallback } from 'react';
import { fetchRoomOverview, RoomStatus } from '../services/overviewService';

const LIGHT_STYLE: Record<RoomStatus['light'], string> = {
  red:    'border-red-500 bg-red-50 animate-pulse',
  yellow: 'border-amber-400 bg-amber-50',
  green:  'border-emerald-400 bg-emerald-50',
  gray:   'border-slate-200 bg-slate-50 opacity-60',
};
const LIGHT_LABEL: Record<RoomStatus['light'], string> = {
  red: '🔴 警報', yellow: '🟡 注意', green: '🟢 正常', gray: '⚪ 未配置',
};

export function MonitorOverview() {
  const [rooms, setRooms] = useState<RoomStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      setRooms(await fetchRoomOverview());
      setUpdatedAt(new Date());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '載入失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15_000); // 15 秒輪詢
    return () => clearInterval(timer);
  }, [load]);

  const alertCount = rooms.filter(r => r.light === 'red').length;

  return (
    <div className="h-full flex flex-col space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">機構監控總覽</h1>
          <p className="text-sm text-slate-500 mt-1">所有房間的即時紅黃綠狀態（多裝置）</p>
        </div>
        <div className="text-sm text-slate-500 flex items-center gap-3">
          {alertCount > 0 && (
            <span className="font-semibold text-red-600">
              ⚠ {alertCount} 個房間有待處理警報
            </span>
          )}
          {updatedAt && <span>更新於 {updatedAt.toLocaleTimeString()}</span>}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 text-sm">
          {error}
          <button onClick={load} className="underline ml-2">重試</button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border-2 border-slate-100 bg-slate-50 p-4 h-36 animate-pulse" />
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-400">
          尚無房間資料，請先於「區域管理」建立房間與裝置。
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {rooms.map(room => (
            <div key={room.roomId}
                 className={`rounded-xl border-2 p-4 transition ${LIGHT_STYLE[room.light]}`}>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-lg text-slate-800">{room.roomName}</h2>
                <span className="text-sm">{LIGHT_LABEL[room.light]}</span>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {room.residentNames.length
                  ? `住民：${room.residentNames.join('、')}`
                  : '無住民資料'}
              </p>
              <div className="mt-3 text-sm space-y-1 text-slate-600">
                <p>裝置：{room.deviceName ?? '未綁定'}
                   {room.deviceName && (room.deviceOnline ? ' ・ 在線' : ' ・ 離線')}</p>
                {room.latestActivity && <p>最近活動：{room.latestActivity}</p>}
                {room.pendingAlerts > 0 && (
                  <p className="font-semibold text-red-600">
                    待處理警報：{room.pendingAlerts} 件
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
