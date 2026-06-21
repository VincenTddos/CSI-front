import { describe, expect, it } from 'vitest';
import { DEFAULT_ROOM_GEOMETRY } from './roomGeometry';
import {
  clampScore, generateSimulatedMovementScore, buildObstacles, inAnyRect,
  segmentClear, stepWalker, PERSON_RADIUS, type WalkerState,
} from './simWalker';

const G = DEFAULT_ROOM_GEOMETRY;

describe('clampScore', () => {
  it('夾在 0..100 並四捨五入', () => {
    expect(clampScore(-5)).toBe(0);
    expect(clampScore(150)).toBe(100);
    expect(clampScore(42.6)).toBe(43);
  });
});

describe('generateSimulatedMovementScore', () => {
  it('跌倒 → 高分（≥80）', () => {
    for (let t = 0; t < 50; t++) {
      expect(generateSimulatedMovementScore(t, true, 0.5, null)).toBeGreaterThanOrEqual(80);
    }
  });
  it('安靜 → 低分（<30）', () => {
    for (let t = 0; t < 50; t++) {
      expect(generateSimulatedMovementScore(t, false, 0.5, 'safe')).toBeLessThan(30);
    }
  });
  it('永遠落在 0..100', () => {
    for (let t = 0; t < 300; t++) {
      const s = generateSimulatedMovementScore(t, false, 1, null);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });
});

describe('stepWalker — 障礙感知（不穿牆/床）', () => {
  // 未膨脹的真實障礙：人員中心永遠不得落入
  const realObstacles = buildObstacles(G, 0);

  it('5000 步皆不進入病床/浴室，且不超出房間邊界', () => {
    let w: WalkerState | null = null;
    for (let i = 0; i < 5000; i++) {
      w = stepWalker(w, G);
      const { x, y } = w.pos;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(G.width_m);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(G.height_m);
      expect(inAnyRect(realObstacles, x, y)).toBe(false);
    }
  });

  it('會移動（不會卡在單一點）', () => {
    let w: WalkerState | null = null;
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      w = stepWalker(w, G);
      seen.add(`${w.pos.x.toFixed(1)},${w.pos.y.toFixed(1)}`);
    }
    expect(seen.size).toBeGreaterThan(5);
  });
});

describe('segmentClear', () => {
  const rects = buildObstacles(G, PERSON_RADIUS);
  it('穿過病床的線段應被擋下', () => {
    // 病床中心約 (4.75, 1.2)，垂直線段會穿過
    expect(segmentClear(rects, 4.75, 0, 4.75, 3)).toBe(false);
  });
  it('開放空間的線段可通行', () => {
    expect(segmentClear(rects, 1.5, 3.0, 3.5, 4.0)).toBe(true);
  });
});
