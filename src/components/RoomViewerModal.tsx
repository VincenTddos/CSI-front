// =============================================================================
//  RoomViewerModal — 全螢幕「點進去看」檢視器
//  2D（幾何驅動的俯視圖）/ 3D（醫療深藍科技風立體圖）可切換，兩者皆來自
//  同一份 roomGeometry 與同一條 CSI 即時座標（單一事實來源）。
// =============================================================================
import { useEffect } from 'react';
import { X, MapPin, Box, Radio, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import { IsometricRoom, type PersonPoint } from './IsometricRoom';
import type { RoomGeometry } from '../lib/roomGeometry';

const SCALE = 92; // px per meter（2D 俯視圖）
const CYAN = '#22d3ee';
const GREEN = '#34d399';
const RED = '#FF3B30';

interface RoomViewerModalProps {
  open: boolean;
  onClose: () => void;
  geometry: RoomGeometry;
  person?: PersonPoint | null;
  /** 跌倒警報：受測者轉紅 + 衝擊波 + 全螢幕警報橫幅/紅框。 */
  alert?: boolean;
  areaLabel?: string;
  view: '2d' | '3d';
  onViewChange: (v: '2d' | '3d') => void;
}

/** 幾何驅動的 2D 俯視圖（深藍科技風），與 3D 共用同一份 geometry/person。 */
function TopDown2D({ geometry: g, person, alert = false }: { geometry: RoomGeometry; person?: PersonPoint | null; alert?: boolean }) {
  const W = g.width_m * SCALE;
  const H = g.height_m * SCALE;
  const M = 48; // 邊界留白，避免周界 AP 標記被裁掉
  return (
    <svg
      viewBox={`${-M} ${-M} ${W + 2 * M} ${H + 2 * M}`}
      className="max-h-full max-w-full drop-shadow-[0_0_40px_rgba(34,211,238,0.15)]"
      style={{ width: W + 2 * M, height: H + 2 * M }}
    >
      <defs>
        <pattern id="grid" width={0.5 * SCALE} height={0.5 * SCALE} patternUnits="userSpaceOnUse">
          <path d={`M ${0.5 * SCALE} 0 L 0 0 0 ${0.5 * SCALE}`} fill="none" stroke="#16324e" strokeWidth="1" />
        </pattern>
      </defs>

      {/* 房間外框 + 網格 */}
      <rect x={0} y={0} width={W} height={H} fill="#0a1628" stroke={CYAN} strokeWidth={3} rx={6} />
      <rect x={0} y={0} width={W} height={H} fill="url(#grid)" />

      {/* 三角定位距離圈：每個 AP 一圈，半徑＝到受測者距離，三圈交於受測者 */}
      {person && g.anchors?.map((a) => {
        const r = Math.hypot(person.x - a.position.x, person.y - a.position.y) * SCALE;
        return (
          <circle key={a.id} cx={a.position.x * SCALE} cy={a.position.y * SCALE} r={r}
            fill="none" stroke={CYAN} strokeWidth={1.5} strokeOpacity={0.3} strokeDasharray="5 5" />
        );
      })}

      {/* 機能區域 */}
      {g.zones?.map((z) => (
        <g key={z.id}>
          <rect
            x={z.origin.x * SCALE} y={z.origin.y * SCALE}
            width={z.size.w * SCALE} height={z.size.d * SCALE}
            fill="#0e3a4a" fillOpacity={0.55} stroke="#1f6f8b" strokeWidth={2} strokeDasharray="6 4"
          />
          {z.label && (
            <text x={(z.origin.x + z.size.w / 2) * SCALE} y={(z.origin.y + z.size.d / 2) * SCALE}
              fill="#7dd3fc" fontSize={13} textAnchor="middle" dominantBaseline="middle">{z.label}</text>
          )}
        </g>
      ))}

      {/* 病床 */}
      {g.beds.map((b) => {
        const cx = b.center.x * SCALE;
        const cy = b.center.y * SCALE;
        const w = b.size.w * SCALE;
        const d = b.size.d * SCALE;
        return (
          <g key={b.id} transform={`translate(${cx} ${cy}) rotate(${b.rotationDeg ?? 0})`}>
            <rect x={-w / 2} y={-d / 2} width={w} height={d} rx={6} fill="#16263d" stroke="#2b5e7a" strokeWidth={2} />
            {/* 枕頭端 */}
            <rect x={-w * 0.35} y={-d / 2 + 4} width={w * 0.7} height={d * 0.18} rx={4} fill="#2e5675" />
            {b.label && <text x={0} y={6} fill="#94a3b8" fontSize={12} textAnchor="middle">{b.label}</text>}
          </g>
        );
      })}

      {/* CSI 感測器（菱形） */}
      {g.sensors.map((s) => {
        const cx = s.center.x * SCALE;
        const cy = s.center.y * SCALE;
        return (
          <g key={s.id}>
            <circle cx={cx} cy={cy} r={26} fill="none" stroke={CYAN} strokeWidth={1.5} opacity={0.35}>
              <animate attributeName="r" from="10" to="46" dur="2.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" from="0.5" to="0" dur="2.4s" repeatCount="indefinite" />
            </circle>
            <rect x={cx - 9} y={cy - 9} width={18} height={18} transform={`rotate(45 ${cx} ${cy})`}
              fill={CYAN} className="drop-shadow-[0_0_6px_#22d3ee]" />
            {s.label && <text x={cx} y={cy + 38} fill="#67e8f9" fontSize={11} fontWeight={700}
              textAnchor="middle" letterSpacing={0.5}>{s.label}</text>}
          </g>
        );
      })}

      {/* Wi-Fi 定位 AP（≥3，紫色） */}
      {g.anchors?.map((a) => {
        const cx = a.position.x * SCALE;
        const cy = a.position.y * SCALE;
        return (
          <g key={a.id}>
            <rect x={cx - 9} y={cy - 9} width={18} height={18} rx={3} fill="#7c3aed"
              stroke="#a78bfa" strokeWidth={1.5} className="drop-shadow-[0_0_6px_#a78bfa]" />
            <line x1={cx} y1={cy - 9} x2={cx} y2={cy - 19} stroke="#a78bfa" strokeWidth={2} />
            <text x={cx} y={cy + 26} fill="#c4b5fd" fontSize={10} fontWeight={700} textAnchor="middle">{a.ssid}</text>
          </g>
        );
      })}

      {/* 受測者：正常綠色脈衝；跌倒＝紅色急促衝擊波 + 警示標籤 */}
      {person && (
        <g transform={`translate(${person.x * SCALE} ${person.y * SCALE})`} style={{ transition: 'transform 1s ease' }}>
          {alert ? (
            <>
              <circle r={28} fill={RED} fillOpacity={0.22}>
                <animate attributeName="r" from="12" to="70" dur="1s" repeatCount="indefinite" />
                <animate attributeName="fill-opacity" from="0.5" to="0" dur="1s" repeatCount="indefinite" />
              </circle>
              <circle r={28} fill={RED} fillOpacity={0.22}>
                <animate attributeName="r" from="12" to="70" dur="1s" begin="0.5s" repeatCount="indefinite" />
                <animate attributeName="fill-opacity" from="0.5" to="0" dur="1s" begin="0.5s" repeatCount="indefinite" />
              </circle>
              <circle r={13} fill={RED} className="drop-shadow-[0_0_14px_#FF3B30]">
                <animate attributeName="r" values="11;15;11" dur="0.6s" repeatCount="indefinite" />
              </circle>
              <text x={0} y={-26} fill="#fff" fontSize={13} fontWeight={800} textAnchor="middle"
                style={{ paintOrder: 'stroke', stroke: RED, strokeWidth: 6, strokeLinejoin: 'round' }}>
                ⚠ 跌倒警報
              </text>
            </>
          ) : (
            <>
              <circle r={22} fill={GREEN} fillOpacity={0.18}>
                <animate attributeName="r" from="14" to="34" dur="1.6s" repeatCount="indefinite" />
                <animate attributeName="fill-opacity" from="0.4" to="0" dur="1.6s" repeatCount="indefinite" />
              </circle>
              <circle r={10} fill={GREEN} className="drop-shadow-[0_0_10px_#34d399]" />
              <text x={0} y={-22} fill="#6ee7b7" fontSize={12} fontWeight={700} fontFamily="monospace" textAnchor="middle">
                ({person.x.toFixed(1)}, {person.y.toFixed(1)})
              </text>
            </>
          )}
        </g>
      )}
    </svg>
  );
}

function LegendRow({ color, label, square }: { color: string; label: string; square?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-slate-300">
      <span
        className={square ? 'w-2.5 h-2.5 rounded-[2px]' : 'w-2.5 h-2.5 rounded-full'}
        style={{ background: color, boxShadow: `0 0 6px ${color}` }}
      />
      {label}
    </div>
  );
}

export function RoomViewerModal({ open, onClose, geometry, person, alert = false, areaLabel, view, onViewChange }: RoomViewerModalProps) {
  // Esc 關閉
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#070d18]/95 backdrop-blur-sm animate-in fade-in duration-200">
      {/* 頂部列 */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-cyan-500/15">
        <div className="flex items-center gap-2 text-cyan-100">
          <Radio className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-bold tracking-wide">區域檢視</h2>
          {areaLabel && (
            <span className="text-[11px] font-medium text-cyan-300/80 bg-cyan-500/10 ring-1 ring-cyan-400/20 px-2 py-0.5 rounded">
              {areaLabel}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* 2D / 3D 切換 */}
          <div className="flex items-center gap-1 bg-slate-800/60 ring-1 ring-cyan-500/15 rounded-lg p-1">
            <button
              onClick={() => onViewChange('2d')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all',
                view === '2d' ? 'bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-400/30' : 'text-slate-400 hover:text-slate-200',
              )}
            >
              <MapPin className="w-3.5 h-3.5" /> 平面圖
            </button>
            <button
              onClick={() => onViewChange('3d')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all',
                view === '3d' ? 'bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-400/30' : 'text-slate-400 hover:text-slate-200',
              )}
            >
              <Box className="w-3.5 h-3.5" /> 立體圖
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="關閉 (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 內容 */}
      <div className="flex-1 relative min-h-0">
        {view === '3d' ? (
          <IsometricRoom geometry={geometry} person={person} alert={alert} cinematic interactive />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-8 overflow-hidden">
            <TopDown2D geometry={geometry} person={person} alert={alert} />
          </div>
        )}

        {/* 跌倒警報：紅色脈動邊框（vignette）+ 頂部橫幅，全螢幕震撼提示 */}
        {alert && (
          <>
            <div className="absolute inset-0 pointer-events-none ring-[6px] ring-inset ring-red-500/70 animate-pulse" />
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(255,59,48,0.22)_100%)]" />
            <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none">
              <div className="flex items-center gap-2.5 bg-[#FF3B30] text-white font-extrabold tracking-wide px-5 py-2.5 rounded-xl shadow-[0_0_30px_rgba(255,59,48,0.6)] animate-pulse">
                <AlertTriangle className="w-5 h-5" />
                <span className="text-base">跌倒警報</span>
                {areaLabel && <span className="text-sm font-bold opacity-90">· {areaLabel}</span>}
              </div>
            </div>
          </>
        )}

        {/* HUD：固定在角落（非 3D 飄字，不會卡）—— 即時座標 + 圖例 */}
        <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none select-none">
          <div className={cn(
            'rounded-lg px-3 py-2 backdrop-blur-sm ring-1',
            alert ? 'bg-red-950/70 ring-red-400/50' : 'bg-slate-900/70 ring-emerald-400/30',
          )}>
            <div className={cn('text-[10px] uppercase tracking-wider', alert ? 'text-red-300/90' : 'text-emerald-300/70')}>
              {alert ? '⚠ 跌倒位置' : '受測者位置'}
            </div>
            <div className={cn('text-base font-mono font-bold', alert ? 'text-red-300' : 'text-emerald-300')}>
              {person ? `(${person.x.toFixed(1)}, ${person.y.toFixed(1)}) m` : '— 無定位 —'}
            </div>
          </div>
          <div className="bg-slate-900/60 ring-1 ring-cyan-400/20 rounded-lg px-3 py-2 backdrop-blur-sm space-y-1.5">
            <LegendRow color={GREEN} label="受測者" />
            <LegendRow color="#7c3aed" label={`Wi-Fi AP × ${geometry.anchors?.length ?? 0}（三角定位）`} square />
            <LegendRow color={CYAN} label="CSI 感測器（貼牆）" />
            {geometry.beds.length > 0 && <LegendRow color="#2b5e7a" label="病床" square />}
            {geometry.zones && geometry.zones.length > 0 && <LegendRow color="#1f6f8b" label="浴室 / 機能區" square />}
          </div>
        </div>

        {/* 底部提示 */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] text-cyan-200/50 select-none">
          {view === '3d' ? '拖曳旋轉 ・ 滾輪縮放 ・ 無攝影機影像' : '幾何來自設定資料 ・ 無攝影機影像'}
        </div>
      </div>
    </div>
  );
}
