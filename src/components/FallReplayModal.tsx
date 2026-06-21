import { useEffect, useRef, useState } from 'react';
import { X, Play, Pause, RotateCcw, AlertTriangle, User } from 'lucide-react';
import { cn } from '../lib/utils';
import type { RoomGeometry } from '../lib/roomGeometry';

/** 單一回放影格：時間、座標（公尺）、移動分數。 */
export interface ReplayFrame { t: number; x: number; y: number; score: number; }
/** 一次跌倒事件的回放快照（跌倒前緩衝的數秒）。 */
export interface FallReplayEvent { at: number; area: string; frames: ReplayFrame[]; }

/**
 * FallReplayModal — 跌倒事件回放。
 * 把跌倒前緩衝的「移動分數 + 定位」逐格重播：地圖上人員沿軌跡移動、波形游標同步前進，
 * 末段轉紅標示跌倒時刻。資料來自即時監控的滾動緩衝（模擬/實機皆可）。
 */
export function FallReplayModal({ open, onClose, geometry, event }: {
  open: boolean; onClose: () => void; geometry: RoomGeometry; event: FallReplayEvent | null;
}) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const timerRef = useRef<number | null>(null);
  const frames = event?.frames ?? [];
  const n = frames.length;

  // Esc 關閉
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // 開啟（或換事件）→ 從頭自動播放
  useEffect(() => { if (open) { setIdx(0); setPlaying(true); } }, [open, event]);

  // 播放計時器（到底自動停）
  useEffect(() => {
    if (!open || !playing || n === 0) return;
    timerRef.current = window.setInterval(() => {
      setIdx((i) => { if (i >= n - 1) { setPlaying(false); return i; } return i + 1; });
    }, 80);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [open, playing, n]);

  if (!open || !event || n === 0) return null;

  const cur = frames[Math.min(idx, n - 1)];
  const W = geometry.width_m, H = geometry.height_m;
  const px = (x: number) => (x / W) * 100;
  const py = (y: number) => (y / H) * 100;
  const isFallMoment = idx >= n - Math.max(3, Math.floor(n * 0.12)); // 末段視為跌倒時刻
  const maxScore = Math.max(1, ...frames.map((f) => f.score));
  const elapsedSec = (cur.t - frames[0].t) / 1000;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#070d18]/95 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
        <div className="flex items-center gap-2 text-white">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <h2 className="text-sm font-bold">跌倒事件回放</h2>
          <span className="text-[11px] text-slate-300 bg-white/10 px-2 py-0.5 rounded">
            {event.area} · {new Date(event.at).toLocaleString('zh-TW', { hour12: false })}
          </span>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10" title="關閉 (Esc)">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 min-h-0 grid lg:grid-cols-2 gap-6 p-6 overflow-auto">
        {/* 房間地圖：軌跡 + 人員 */}
        <div className="flex items-center justify-center">
          <div className="relative w-full max-w-md aspect-square rounded-xl border-2 border-white/15 bg-[#0a1628] overflow-hidden">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
              <polyline
                points={frames.slice(0, idx + 1).map((f) => `${px(f.x)},${py(f.y)}`).join(' ')}
                fill="none" stroke="#34d399" strokeOpacity={0.55} strokeWidth={1} strokeLinejoin="round" strokeLinecap="round"
              />
            </svg>
            <div className="absolute transition-all duration-75" style={{ left: `${px(cur.x)}%`, top: `${py(cur.y)}%`, transform: 'translate(-50%,-50%)' }}>
              <div className={cn('w-5 h-5 rounded-full border-2 border-white flex items-center justify-center shadow-lg', isFallMoment ? 'bg-[#FF3B30]' : 'bg-[#34C759]')}>
                {isFallMoment ? <AlertTriangle className="w-2.5 h-2.5 text-white" /> : <User className="w-2.5 h-2.5 text-white" />}
              </div>
              {isFallMoment && <div className="absolute inset-[-6px] bg-[#FF3B30]/40 rounded-full animate-ping" />}
            </div>
          </div>
        </div>

        {/* 波形 + 讀數 + 控制 */}
        <div className="flex flex-col justify-center gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-400">移動分數</p>
            <p className={cn('text-5xl font-black tabular-nums', isFallMoment ? 'text-red-400' : 'text-emerald-300')}>{Math.round(cur.score)}</p>
            <p className="text-xs text-slate-400 mt-1">座標 ({cur.x.toFixed(1)}, {cur.y.toFixed(1)}) m · 第 {elapsedSec.toFixed(1)} 秒</p>
          </div>
          <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-24 bg-white/5 rounded-lg">
            <polyline
              points={frames.map((f, i) => `${(i / Math.max(1, n - 1)) * 100},${30 - (f.score / maxScore) * 28}`).join(' ')}
              fill="none" stroke="#60a5fa" strokeWidth={0.8}
            />
            <line x1={(idx / Math.max(1, n - 1)) * 100} y1={0} x2={(idx / Math.max(1, n - 1)) * 100} y2={30}
              stroke={isFallMoment ? '#FF3B30' : '#94a3b8'} strokeWidth={0.6} />
          </svg>
          <div className="flex items-center gap-3">
            <button onClick={() => { if (idx >= n - 1) setIdx(0); setPlaying((p) => !p); }}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              {playing ? <><Pause className="w-4 h-4" /> 暫停</> : <><Play className="w-4 h-4" /> 播放</>}
            </button>
            <button onClick={() => { setIdx(0); setPlaying(true); }} title="重播"
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
              <RotateCcw className="w-4 h-4" />
            </button>
            <input type="range" min={0} max={n - 1} value={idx}
              onChange={(e) => { setPlaying(false); setIdx(Number(e.target.value)); }}
              className="flex-1 accent-[#FF3B30]" />
          </div>
          <p className="text-[11px] text-slate-500">
            回放資料為跌倒前約 {((frames[n - 1].t - frames[0].t) / 1000).toFixed(0)} 秒的移動分數與定位緩衝。
          </p>
        </div>
      </div>
    </div>
  );
}
