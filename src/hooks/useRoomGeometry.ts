import { useEffect, useState } from 'react';
import { DEFAULT_ROOM_GEOMETRY, type RoomGeometry } from '../lib/roomGeometry';
import { getRoomGeometry } from '../services/roomGeometryService';

/**
 * 房間幾何（單一事實來源）。2D 平面圖與 3D 立體圖共用，避免重複定義。
 * 初值為設定預設，掛載後以資料來源覆蓋，因此回傳的 geometry 永遠可用（無 null 分支）。
 */
export function useRoomGeometry(roomId?: string) {
  const [geometry, setGeometry] = useState<RoomGeometry>(DEFAULT_ROOM_GEOMETRY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getRoomGeometry(roomId)
      .then((g) => { if (alive) setGeometry(g); })
      .catch(() => { /* 回退預設，UI 不中斷 */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [roomId]);

  return { geometry, loading };
}
