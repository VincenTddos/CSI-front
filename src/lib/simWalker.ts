// =============================================================================
//  simWalker — 模擬模式的純邏輯（無 React）：移動分數生成 + 障礙感知路徑行走。
//  從 RealtimeMonitoring 抽出，方便單元測試（不穿牆/不穿床的保證以測試固定）。
//  座標皆為公尺，與 roomGeometry / 2D 平面圖同座標系（原點左上、x 右、y 下）。
// =============================================================================
import type { RoomGeometry } from './roomGeometry';

export const clampScore = (score: number) => Math.min(100, Math.max(0, Math.round(score)));

/** 模擬移動分數：跌倒尖峰 / 靜止 / 一般走動（依靈敏度調整起伏）。 */
export const generateSimulatedMovementScore = (
  time: number,
  isFall: boolean,
  sensitivity: number,
  manualState: 'safe' | 'fall' | null,
) => {
  if (isFall) {
    return clampScore(88 + Math.sin(time / 2) * 5 + Math.random() * 7);
  }
  if (manualState === 'safe') {
    return clampScore(8 + Math.sin(time / 12) * 4 + Math.random() * 6);
  }
  const base = 12 + sensitivity * 18;
  const walkingPulse = Math.max(0, Math.sin(time / 8)) * (18 + sensitivity * 16);
  const noise = (Math.random() - 0.5) * (10 + sensitivity * 14);
  return clampScore(base + walkingPulse + noise);
};

// ── 障礙感知的路徑行走（不穿牆、不穿床）──────────────────────────────
export type Rect = { minX: number; minY: number; maxX: number; maxY: number };

export const PERSON_RADIUS = 0.28; // 人員碰撞半徑（公尺）
export const WALK_STEP = 0.08;     // 每 100ms 位移（≈0.8 m/s，長者步速）

export interface WalkerState {
  pos: { x: number; y: number };
  target: { x: number; y: number };
  dwell: number;
}

// 把房間幾何展開成「人員不可進入」的矩形：病床 + 有隔間矮牆的機能區域（如浴室）。
// 全部往外膨脹 pad（人員半徑），確保不會貼著床/牆穿過去。純地面標記（無隔間牆）不擋。
export function buildObstacles(g: RoomGeometry, pad: number): Rect[] {
  const rects: Rect[] = [];
  for (const b of g.beds) {
    const r = (b.rotationDeg ?? 0) * (Math.PI / 180);
    const c = Math.abs(Math.cos(r)), s = Math.abs(Math.sin(r));
    const hw = b.size.w / 2, hd = b.size.d / 2;
    const ex = hw * c + hd * s + pad; // 旋轉後外接框半寬
    const ey = hw * s + hd * c + pad; // 旋轉後外接框半高
    rects.push({ minX: b.center.x - ex, maxX: b.center.x + ex, minY: b.center.y - ey, maxY: b.center.y + ey });
  }
  for (const z of g.zones ?? []) {
    if ((z.partitionHeight_m ?? 0) > 0) {
      rects.push({ minX: z.origin.x - pad, maxX: z.origin.x + z.size.w + pad, minY: z.origin.y - pad, maxY: z.origin.y + z.size.d + pad });
    }
  }
  return rects;
}

export const inAnyRect = (rects: Rect[], x: number, y: number) =>
  rects.some(r => x >= r.minX && x <= r.maxX && y >= r.minY && y <= r.maxY);

// 直線段是否完全避開所有障礙（取樣檢測；只在挑新目標時呼叫，非每幀）
export function segmentClear(rects: Rect[], ax: number, ay: number, bx: number, by: number): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.12));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (inAnyRect(rects, ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
  }
  return true;
}

// 房間可行走範圍內挑一個自由點（避開障礙與牆邊 margin）
export function pickFreePoint(g: RoomGeometry, rects: Rect[], margin: number): { x: number; y: number } {
  for (let i = 0; i < 40; i++) {
    const x = margin + Math.random() * (g.width_m - 2 * margin);
    const y = margin + Math.random() * (g.height_m - 2 * margin);
    if (!inAnyRect(rects, x, y)) return { x, y };
  }
  return { x: g.width_m / 2, y: g.height_m / 2 };
}

// 從目前位置挑「直線可達」的下一個目標（夠遠且整段路徑不穿障礙）
export function pickReachableTarget(g: RoomGeometry, rects: Rect[], margin: number, from: { x: number; y: number }) {
  for (let i = 0; i < 40; i++) {
    const p = pickFreePoint(g, rects, margin);
    if (Math.hypot(p.x - from.x, p.y - from.y) > 0.8 && segmentClear(rects, from.x, from.y, p.x, p.y)) return p;
  }
  return pickFreePoint(g, rects, margin);
}

/** 推進一步：朝目標直線前進，抵達就（可能原地駐足後）換下一個可達目標。 */
export function stepWalker(prev: WalkerState | null, g: RoomGeometry): WalkerState {
  const margin = Math.max(PERSON_RADIUS, Math.min(0.6, g.width_m * 0.12, g.height_m * 0.12));
  const rects = buildObstacles(g, PERSON_RADIUS);
  if (!prev) {
    const pos = pickFreePoint(g, rects, margin);
    return { pos, target: pickReachableTarget(g, rects, margin, pos), dwell: 0 };
  }
  if (prev.dwell > 0) return { ...prev, dwell: prev.dwell - 1 };
  const dx = prev.target.x - prev.pos.x, dy = prev.target.y - prev.pos.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= WALK_STEP) {
    // 抵達目標：50% 機率原地停留 0.5–2.5 秒（像在床邊/窗邊駐足），再挑下一個目標
    const dwell = Math.random() < 0.5 ? 5 + Math.floor(Math.random() * 20) : 0;
    return { pos: prev.target, target: pickReachableTarget(g, rects, margin, prev.target), dwell };
  }
  return { pos: { x: prev.pos.x + (dx / dist) * WALK_STEP, y: prev.pos.y + (dy / dist) * WALK_STEP }, target: prev.target, dwell: 0 };
}
