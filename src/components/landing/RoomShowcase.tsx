import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Rotate3d } from 'lucide-react';
import { DEFAULT_ROOM_GEOMETRY } from '../../lib/roomGeometry';

// 立體圖（three.js）動態載入：配合 App 路由級 code-split，three 成為獨立 async chunk，
// 介紹頁首屏不含 three；且只在捲動進入視窗時才掛載 Canvas（捲走後不在背景空轉）。
const IsometricRoom = lazy(() => import('../IsometricRoom').then(m => ({ default: m.IsometricRoom })));

// 安全遊走範圍（公尺）：刻意避開預設房間的病床（右上）與浴室（左上），
// 人員只在中下方開放區平滑走動，預覽時不會穿牆/穿床。
const SAFE = { minX: 1.2, maxX: 3.8, minY: 2.9, maxY: 4.3 };

/**
 * RoomShowcase — 介紹頁的「互動 3D 房間」預覽。
 * 乾淨白底等角風（非 cinematic），可拖曳旋轉/縮放；人員緩慢遊走，呈現「即時」感。
 */
export default function RoomShowcase() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  const [person, setPerson] = useState({ x: 2.5, y: 3.6 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // 進入視窗才開始遊走；離開即停止計時器（省資源）。
  useEffect(() => {
    if (!inView) return;
    let t = 0;
    const cx = (SAFE.minX + SAFE.maxX) / 2;
    const cy = (SAFE.minY + SAFE.maxY) / 2;
    const ax = (SAFE.maxX - SAFE.minX) / 2;
    const ay = (SAFE.maxY - SAFE.minY) / 2;
    const id = window.setInterval(() => {
      t += 1;
      // 兩個不可公約的低頻 → 緩慢不重複的路徑，恆落在 SAFE 範圍內
      setPerson({
        x: +(cx + ax * Math.sin(t * 0.03) * Math.cos(t * 0.017)).toFixed(3),
        y: +(cy + ay * Math.sin(t * 0.023 + 1.1)).toFixed(3),
      });
    }, 120);
    return () => window.clearInterval(id);
  }, [inView]);

  return (
    <div ref={ref} className="relative">
      <div className="aspect-[4/3] w-full rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 shadow-sm overflow-hidden">
        {inView && (
          <Suspense fallback={<div className="w-full h-full grid place-items-center text-xs text-slate-400">載入立體圖…</div>}>
            <IsometricRoom geometry={DEFAULT_ROOM_GEOMETRY} person={person} interactive />
          </Suspense>
        )}
      </div>
      {/* 互動提示（不擋拖曳） */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur border border-slate-200 text-[11px] font-medium text-slate-500 shadow-sm pointer-events-none">
        <Rotate3d className="w-3.5 h-3.5 text-[#007AFF]" /> 拖曳旋轉 · 滾輪縮放
      </div>
    </div>
  );
}
