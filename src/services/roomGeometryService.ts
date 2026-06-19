import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DEFAULT_ROOM_GEOMETRY, type RoomGeometry } from '../lib/roomGeometry';

// =============================================================================
//  roomGeometryService — 房間幾何資料存取（單一事實來源）
//  • localStorage 模式：csi_room_geometry（種子＝DEFAULT_ROOM_GEOMETRY）。
//  • Supabase 模式：rooms 表提供 width_m/height_m；家具（床/感測器/區域）DB 未建模，
//    沿用設定中的幾何，僅以資料庫尺寸覆蓋房間外框。
//  2D 平面圖與 3D 立體圖都經由本服務取得幾何，避免任何重複來源。
// =============================================================================

const LS_KEY = 'csi_room_geometry';

function lsLoad(): RoomGeometry | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as RoomGeometry) : null;
  } catch {
    return null;
  }
}

function lsSave(g: RoomGeometry): void {
  localStorage.setItem(LS_KEY, JSON.stringify(g));
}

/** 讀取房間幾何。LS 模式回 localStorage（首次以預設種子落地）；Supabase 模式併入 rooms 尺寸。 */
export async function getRoomGeometry(roomId?: string): Promise<RoomGeometry> {
  if (!isSupabaseConfigured) {
    const stored = lsLoad();
    if (stored) return stored;
    lsSave(DEFAULT_ROOM_GEOMETRY); // 種子落地，之後可被編輯/覆蓋
    return DEFAULT_ROOM_GEOMETRY;
  }

  // Supabase：以資料庫房間尺寸覆蓋外框，家具沿用設定（DB 尚未建模家具座標）
  const base = lsLoad() ?? DEFAULT_ROOM_GEOMETRY;
  try {
    let q = supabase.from('rooms').select('id, name, width_m, height_m');
    if (roomId) q = q.eq('id', roomId);
    const { data } = await q.limit(1).maybeSingle();
    if (data) {
      return {
        ...base,
        id: data.id,
        name: data.name ?? base.name,
        width_m: data.width_m ?? base.width_m,
        height_m: data.height_m ?? base.height_m,
      };
    }
  } catch {
    // 取不到就回退設定，UI 不中斷
  }
  return base;
}

/** 儲存房間幾何（localStorage 單一來源；供未來幾何編輯器使用）。 */
export function saveRoomGeometry(g: RoomGeometry): void {
  lsSave(g);
}
