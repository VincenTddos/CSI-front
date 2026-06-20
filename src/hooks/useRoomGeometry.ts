import { useEffect, useState } from 'react';
import { DEFAULT_ROOM_GEOMETRY, type RoomGeometry } from '../lib/roomGeometry';
import { getRoomGeometry, ROOM_GEOMETRY_EVENT } from '../services/roomGeometryService';

/**
 * 房間幾何（單一事實來源）。2D 平面圖與 3D 立體圖共用，避免重複定義。
 * 初值為設定預設，掛載後以資料來源覆蓋；空間編輯器存檔（或其他分頁變更）會
 * 透過事件即時重載，全頁同步。
 */
export function useRoomGeometry(roomId?: string) {
  const [geometry, setGeometry] = useState<RoomGeometry>(DEFAULT_ROOM_GEOMETRY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = () =>
      getRoomGeometry(roomId)
        .then((g) => { if (alive) setGeometry(g); })
        .catch(() => { /* 回退預設，UI 不中斷 */ })
        .finally(() => { if (alive) setLoading(false); });

    load();
    // 同分頁存檔 → 自訂事件；跨分頁 → storage 事件
    window.addEventListener(ROOM_GEOMETRY_EVENT, load);
    window.addEventListener('storage', load);
    return () => {
      alive = false;
      window.removeEventListener(ROOM_GEOMETRY_EVENT, load);
      window.removeEventListener('storage', load);
    };
  }, [roomId]);

  return { geometry, loading };
}
