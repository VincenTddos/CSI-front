// =============================================================================
//  roomGeometry — 房間幾何「單一事實來源 (SSOT)」
//  2D 平面圖與 3D 立體圖共用同一份幾何（房間尺寸、牆、床、感測器、區域）。
//
//  座標系：與 2D 平面圖一致 —— 原點在左上角，單位公尺。
//    x → 向右（0 … width_m）
//    y → 向下（0 … height_m）   ← 注意是「深度」方向，非高度
//  人員即時座標 locationData.{x,y} 也用這個座標系，3D 場景負責換算到 three.js。
// =============================================================================

/** 平面座標（公尺），原點左上、x 向右、y 向下，與 2D 平面圖一致。 */
export interface Vec2m {
  x: number;
  y: number;
}

/** 病床（可多張）。 */
export interface BedGeometry {
  id: string;
  /** 中心座標（公尺） */
  center: Vec2m;
  /** 尺寸（公尺）：w = 沿 x 寬、d = 沿 y 長 */
  size: { w: number; d: number };
  /** 繞垂直軸旋轉（度，順時針），預設 0 */
  rotationDeg?: number;
  label?: string;
}

/** CSI 感測器標記。 */
export interface SensorGeometry {
  id: string;
  /** 平面座標（公尺） */
  center: Vec2m;
  /** 離地高度（公尺），預設 1.8 */
  height_m?: number;
  label?: string;
}

/** 機能區域（如浴室）：以左上角 + 尺寸描述，可選矮牆隔間。 */
export interface ZoneGeometry {
  id: string;
  /** 區域左上角（公尺） */
  origin: Vec2m;
  size: { w: number; d: number };
  label?: string;
  /** 隔間矮牆高（公尺），>0 才畫牆 */
  partitionHeight_m?: number;
}

/** 一個房間的完整幾何設定。 */
export interface RoomGeometry {
  id: string;
  name: string;
  /** 房間寬（公尺，x 方向） */
  width_m: number;
  /** 房間深（公尺，y 方向） */
  height_m: number;
  /** 外牆高（公尺） */
  wallHeight_m: number;
  beds: BedGeometry[];
  sensors: SensorGeometry[];
  zones?: ZoneGeometry[];
}

/**
 * 預設病房幾何（Stage 1 的可設定示範資料）。
 * 尺寸刻意維持 6.0 × 5.0，與 2D 平面圖綠點換算（原本寫死的 roomWidth/roomHeight）一致，
 * 改接後 2D 不變形。版面對應 2D 預設房間：病床右上、浴室左上、感測器置中。
 */
export const DEFAULT_ROOM_GEOMETRY: RoomGeometry = {
  id: 'room-default',
  name: '病房',
  width_m: 6.0,
  height_m: 5.0,
  wallHeight_m: 2.6,
  beds: [
    { id: 'bed-1', center: { x: 4.75, y: 1.2 }, size: { w: 1.1, d: 2.0 }, label: '病床' },
  ],
  sensors: [
    { id: 'csi-1', center: { x: 3.0, y: 2.5 }, height_m: 1.8, label: 'CSI Sensor' },
  ],
  zones: [
    { id: 'bath', origin: { x: 0, y: 0 }, size: { w: 2.2, d: 2.2 }, label: '浴室', partitionHeight_m: 1.2 },
  ],
};
