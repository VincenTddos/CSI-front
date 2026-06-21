// =============================================================================
//  useTrackHistory — 動線軌跡 / 停留熱力圖 / 跌倒回放緩衝（從 RealtimeMonitoring 抽出）。
//  輸入即時座標與分數，累積成軌跡、熱力網格與滾動緩衝；跌倒上升邊緣時擷取回放事件。
// =============================================================================
import { useEffect, useRef, useState } from 'react';
import type { RoomGeometry } from '../lib/roomGeometry';
import type { FallReplayEvent, ReplayFrame } from '../components/FallReplayModal';
import { HEAT_GX, HEAT_GY } from '../lib/trackingViz';

const TRAIL_MAX = 60;          // 動線軌跡保留點數
const BUFFER_MAX = 200;        // 回放滾動緩衝（≈20s @10Hz）
const REPLAY_FRAMES = 150;     // 跌倒回放擷取影格數（≈15s）
const LAST_FALL_KEY = 'csi_last_fall_replay';

function loadLastFall(): FallReplayEvent | null {
  try { const r = localStorage.getItem(LAST_FALL_KEY); return r ? JSON.parse(r) as FallReplayEvent : null; }
  catch { return null; }
}

export interface TrackHistory {
  trail: { x: number; y: number }[];
  heatGrid: number[];
  lastFall: FallReplayEvent | null;
}

export interface TrackHistoryInput {
  x: number | null;
  y: number | null;
  score: number;
  fallVisible: boolean;
  area: string;
  geometry: RoomGeometry;
  active: boolean; // 是否有即時資料（模擬或實機）；皆無時清空
}

export function useTrackHistory({ x, y, score, fallVisible, area, geometry, active }: TrackHistoryInput): TrackHistory {
  const [trail, setTrail] = useState<{ x: number; y: number }[]>([]);
  const [heatGrid, setHeatGrid] = useState<number[]>([]);
  const [lastFall, setLastFall] = useState<FallReplayEvent | null>(loadLastFall);
  const histBufferRef = useRef<ReplayFrame[]>([]);
  const prevAlarmRef = useRef(false);
  // 房間尺寸用 ref 讀取，避免把 geometry 放進每幀的 capture 依賴
  const geometryRef = useRef(geometry);
  useEffect(() => { geometryRef.current = geometry; }, [geometry]);

  // 擷取每一筆人員座標 → 軌跡、熱力網格、回放緩衝（約 10Hz，有定位才記）
  useEffect(() => {
    if (x === null || y === null) return;
    const g = geometryRef.current;
    setTrail(prev => {
      const next = [...prev, { x, y }];
      return next.length > TRAIL_MAX ? next.slice(-TRAIL_MAX) : next;
    });
    setHeatGrid(prev => {
      const grid = prev.length === HEAT_GX * HEAT_GY ? prev.slice() : new Array(HEAT_GX * HEAT_GY).fill(0);
      const cx = Math.min(HEAT_GX - 1, Math.max(0, Math.floor((x / g.width_m) * HEAT_GX)));
      const cy = Math.min(HEAT_GY - 1, Math.max(0, Math.floor((y / g.height_m) * HEAT_GY)));
      grid[cy * HEAT_GX + cx] += 1;
      return grid;
    });
    const buf = histBufferRef.current;
    buf.push({ t: Date.now(), x, y, score });
    if (buf.length > BUFFER_MAX) buf.splice(0, buf.length - BUFFER_MAX);
  }, [x, y, score]);

  // 切換區域、或無任何即時資料時，清空軌跡/熱力圖/緩衝（避免殘留前一情境）
  useEffect(() => {
    setTrail([]); setHeatGrid([]); histBufferRef.current = [];
  }, [area]);
  useEffect(() => {
    if (!active) { setTrail([]); setHeatGrid([]); histBufferRef.current = []; }
  }, [active]);

  // 跌倒「上升邊緣」→ 擷取緩衝最後數秒成為可回放事件（存 localStorage 供重整後仍可看）
  useEffect(() => {
    if (fallVisible && !prevAlarmRef.current) {
      const frames = histBufferRef.current.slice(-REPLAY_FRAMES).map(f => ({ ...f }));
      if (frames.length >= 5) {
        const ev: FallReplayEvent = { at: Date.now(), area, frames };
        setLastFall(ev);
        try { localStorage.setItem(LAST_FALL_KEY, JSON.stringify(ev)); } catch { /* 容量/隱私模式忽略 */ }
      }
    }
    prevAlarmRef.current = fallVisible;
  }, [fallVisible, area]);

  return { trail, heatGrid, lastFall };
}
