// =============================================================================
//  RoomEditorModal — L1 空間編輯器（上傳平面圖/照片當底圖，手動描繪幾何）
//  輸出寫入 roomGeometryService（單一事實來源），2D/3D 立即同步。
//  ⚠️ 隱私：底圖僅在本機暫存供描繪，不會儲存或上傳；存檔只保留「幾何數字」。
// =============================================================================
import { useEffect, useRef, useState } from 'react';
import { Upload, Save, RotateCcw, Plus, Trash2, X, Move, ImageOff } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  DEFAULT_ROOM_GEOMETRY, type RoomGeometry, type Vec2m,
} from '../lib/roomGeometry';
import { saveRoomGeometry } from '../services/roomGeometryService';

const PXM = 76;     // px per meter
const MARGIN = 34;  // 周界留白（讓貼牆/角落標記可拖曳）

type DragKind = 'bed' | 'sensor' | 'anchor' | 'zone';
interface DragRef { kind: DragKind; id: string }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const uid = () => `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

function snapSensor(p: Vec2m, W: number, H: number): { center: Vec2m; mountWall: 'xMin' | 'xMax' | 'yMin' | 'yMax' } {
  const dMin = Math.min(p.x, W - p.x, p.y, H - p.y);
  if (dMin === p.y) return { center: { x: clamp(p.x, 0, W), y: 0 }, mountWall: 'yMin' };
  if (dMin === H - p.y) return { center: { x: clamp(p.x, 0, W), y: H }, mountWall: 'yMax' };
  if (dMin === p.x) return { center: { x: 0, y: clamp(p.y, 0, H) }, mountWall: 'xMin' };
  return { center: { x: W, y: clamp(p.y, 0, H) }, mountWall: 'xMax' };
}

interface RoomEditorModalProps {
  open: boolean;
  onClose: () => void;
  initial: RoomGeometry;
}

export function RoomEditorModal({ open, onClose, initial }: RoomEditorModalProps) {
  const [draft, setDraft] = useState<RoomGeometry>(initial);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageOpacity, setImageOpacity] = useState(0.5);
  const [drag, setDrag] = useState<DragRef | null>(null);
  const [selected, setSelected] = useState<DragRef | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => { if (open) { setDraft(initial); setSelected(null); } }, [open, initial]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const W = draft.width_m;
  const H = draft.height_m;
  const Wpx = W * PXM;
  const Hpx = H * PXM;
  const mx = (m: number) => MARGIN + m * PXM;

  // ---- 不可變更新 ----
  const patchDraft = (p: Partial<RoomGeometry>) => setDraft((d) => ({ ...d, ...p }));
  const updateBed = (id: string, patch: Partial<RoomGeometry['beds'][number]>) =>
    setDraft((d) => ({ ...d, beds: d.beds.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
  const updateAnchor = (id: string, patch: Partial<NonNullable<RoomGeometry['anchors']>[number]>) =>
    setDraft((d) => ({ ...d, anchors: (d.anchors ?? []).map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
  const updateZone = (id: string, patch: Partial<NonNullable<RoomGeometry['zones']>[number]>) =>
    setDraft((d) => ({ ...d, zones: (d.zones ?? []).map((z) => (z.id === id ? { ...z, ...patch } : z)) }));
  const updateSensor = (patch: Partial<RoomGeometry['sensors'][number]>) =>
    setDraft((d) => ({
      ...d,
      sensors: d.sensors.length
        ? d.sensors.map((s, i) => (i === 0 ? { ...s, ...patch } : s))
        : [{ id: 'csi-1', center: { x: d.width_m / 2, y: 0 }, label: 'CSI Sensor', mountWall: 'yMin', ...patch }],
    }));

  // ---- 拖曳 ----
  const pointerToM = (e: React.PointerEvent): Vec2m => {
    const r = svgRef.current!.getBoundingClientRect();
    return {
      x: clamp((e.clientX - r.left - MARGIN) / PXM, 0, W),
      y: clamp((e.clientY - r.top - MARGIN) / PXM, 0, H),
    };
  };
  const startDrag = (e: React.PointerEvent, kind: DragKind, id: string) => {
    e.stopPropagation();
    setDrag({ kind, id });
    setSelected({ kind, id });
    svgRef.current?.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = pointerToM(e);
    if (drag.kind === 'bed') updateBed(drag.id, { center: p });
    else if (drag.kind === 'anchor') updateAnchor(drag.id, { position: p });
    else if (drag.kind === 'sensor') updateSensor({ center: p });
    else if (drag.kind === 'zone') {
      const z = (draft.zones ?? []).find((zz) => zz.id === drag.id);
      if (z) updateZone(drag.id, { origin: { x: clamp(p.x - z.size.w / 2, 0, W - z.size.w), y: clamp(p.y - z.size.d / 2, 0, H - z.size.d) } });
    }
  };
  const onUp = () => {
    if (drag?.kind === 'sensor' && draft.sensors[0]) updateSensor(snapSensor(draft.sensors[0].center, W, H));
    setDrag(null);
  };

  // ---- 新增/刪除 ----
  const addBed = () => setDraft((d) => ({ ...d, beds: [...d.beds, { id: uid(), center: { x: d.width_m / 2, y: d.height_m / 2 }, size: { w: 1.0, d: 2.0 }, label: '病床' }] }));
  const delBed = (id: string) => setDraft((d) => ({ ...d, beds: d.beds.filter((b) => b.id !== id) }));
  const addAnchor = () => setDraft((d) => ({ ...d, anchors: [...(d.anchors ?? []), { id: uid(), ssid: `AP-${(d.anchors?.length ?? 0) + 1}`, position: { x: d.width_m / 2, y: d.height_m / 2 }, height_m: 2.4 }] }));
  const delAnchor = (id: string) => setDraft((d) => ({ ...d, anchors: (d.anchors ?? []).filter((a) => a.id !== id) }));
  const addZone = () => setDraft((d) => ({ ...d, zones: [...(d.zones ?? []), { id: uid(), origin: { x: 0, y: 0 }, size: { w: 2.0, d: 2.0 }, label: '區域', partitionHeight_m: 1.2 }] }));
  const delZone = (id: string) => setDraft((d) => ({ ...d, zones: (d.zones ?? []).filter((z) => z.id !== id) }));

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setImageUrl(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(f); // 僅本機，不上傳
  };

  const handleSave = () => { saveRoomGeometry(draft); onClose(); };

  const anchors = draft.anchors ?? [];
  const zones = draft.zones ?? [];
  const sensor = draft.sensors[0];
  const isSel = (kind: DragKind, id: string) => selected?.kind === kind && selected.id === id;

  const numInput = (value: number, onChange: (n: number) => void, step = 0.1, min = 0) => (
    <input type="number" value={value} step={step} min={min}
      onChange={(e) => onChange(Math.max(min, parseFloat(e.target.value) || 0))}
      className="w-16 px-1.5 py-0.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400" />
  );

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-slate-100 animate-in fade-in duration-150">
      {/* 頂列 */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-200 shrink-0">
        <div>
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2"><Move className="w-4 h-4 text-[#007AFF]" /> 空間編輯器</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">上傳平面圖/照片當底圖，拖曳擺放牆內物件 → 存成幾何（2D/3D 同步）</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setDraft(DEFAULT_ROOM_GEOMETRY)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <RotateCcw className="w-3.5 h-3.5" /> 重設預設
          </button>
          <button onClick={onClose} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">取消</button>
          <button onClick={handleSave} className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#007AFF] hover:bg-[#0066CC] rounded-lg transition-colors">
            <Save className="w-3.5 h-3.5" /> 儲存
          </button>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-lg" title="關閉 (Esc)"><X className="w-5 h-5" /></button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* 畫布 */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-6">
          <svg
            ref={svgRef}
            width={Wpx + 2 * MARGIN} height={Hpx + 2 * MARGIN}
            onPointerMove={onMove} onPointerUp={onUp}
            onPointerDown={() => setSelected(null)}
            className="bg-white rounded-lg shadow-sm ring-1 ring-slate-200 touch-none select-none"
          >
            <defs>
              <pattern id="ed-grid" width={0.5 * PXM} height={0.5 * PXM} patternUnits="userSpaceOnUse">
                <path d={`M ${0.5 * PXM} 0 L 0 0 0 ${0.5 * PXM}`} fill="none" stroke="#eef2f7" strokeWidth="1" />
              </pattern>
            </defs>

            {/* 底圖（拉伸到房間框，半透明描繪用） */}
            {imageUrl && (
              <image href={imageUrl} x={mx(0)} y={mx(0)} width={Wpx} height={Hpx} opacity={imageOpacity} preserveAspectRatio="none" />
            )}
            {/* 房間框 + 網格 */}
            <rect x={mx(0)} y={mx(0)} width={Wpx} height={Hpx} fill={imageUrl ? 'none' : 'url(#ed-grid)'} stroke="#94a3b8" strokeWidth={2} />
            {!imageUrl && <rect x={mx(0)} y={mx(0)} width={Wpx} height={Hpx} fill="url(#ed-grid)" stroke="none" />}

            {/* 區域 */}
            {zones.map((z) => (
              <g key={z.id} onPointerDown={(e) => startDrag(e, 'zone', z.id)} className="cursor-move">
                <rect x={mx(z.origin.x)} y={mx(z.origin.y)} width={z.size.w * PXM} height={z.size.d * PXM}
                  fill="#dbeafe" fillOpacity={0.6} stroke={isSel('zone', z.id) ? '#2563eb' : '#60a5fa'} strokeWidth={isSel('zone', z.id) ? 2.5 : 1.5} strokeDasharray="5 4" />
                <text x={mx(z.origin.x + z.size.w / 2)} y={mx(z.origin.y + z.size.d / 2)} fill="#3b82f6" fontSize={12} textAnchor="middle" dominantBaseline="middle" className="pointer-events-none">{z.label}</text>
              </g>
            ))}

            {/* 病床 */}
            {draft.beds.map((b) => (
              <g key={b.id} transform={`translate(${mx(b.center.x)} ${mx(b.center.y)}) rotate(${b.rotationDeg ?? 0})`}
                onPointerDown={(e) => startDrag(e, 'bed', b.id)} className="cursor-move">
                <rect x={-b.size.w * PXM / 2} y={-b.size.d * PXM / 2} width={b.size.w * PXM} height={b.size.d * PXM} rx={5}
                  fill="#e2e8f0" stroke={isSel('bed', b.id) ? '#2563eb' : '#94a3b8'} strokeWidth={isSel('bed', b.id) ? 2.5 : 1.5} />
                <text x={0} y={5} fill="#64748b" fontSize={11} textAnchor="middle" className="pointer-events-none">{b.label}</text>
              </g>
            ))}

            {/* Wi-Fi AP */}
            {anchors.map((a) => (
              <g key={a.id} transform={`translate(${mx(a.position.x)} ${mx(a.position.y)})`}
                onPointerDown={(e) => startDrag(e, 'anchor', a.id)} className="cursor-move">
                <rect x={-9} y={-9} width={18} height={18} rx={3} fill="#7c3aed" stroke={isSel('anchor', a.id) ? '#facc15' : '#a78bfa'} strokeWidth={isSel('anchor', a.id) ? 2.5 : 1.5} />
                <text x={0} y={26} fill="#7c3aed" fontSize={10} fontWeight={700} textAnchor="middle" className="pointer-events-none">{a.ssid}</text>
              </g>
            ))}

            {/* CSI 感測器 */}
            {sensor && (
              <g transform={`translate(${mx(sensor.center.x)} ${mx(sensor.center.y)})`}
                onPointerDown={(e) => startDrag(e, 'sensor', sensor.id)} className="cursor-move">
                <rect x={-9} y={-9} width={18} height={18} transform="rotate(45)" fill="#007AFF" stroke={isSel('sensor', sensor.id) ? '#facc15' : '#3b82f6'} strokeWidth={isSel('sensor', sensor.id) ? 2.5 : 1.5} />
                <text x={0} y={26} fill="#007AFF" fontSize={10} fontWeight={700} textAnchor="middle" className="pointer-events-none">CSI</text>
              </g>
            )}
          </svg>
        </div>

        {/* 控制面板 */}
        <div className="w-72 shrink-0 bg-white border-l border-slate-200 overflow-y-auto p-4 space-y-5 text-sm">
          {/* 底圖 */}
          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">底圖（描繪用）</h3>
            <label className="flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-lg text-xs text-slate-600 hover:bg-slate-50 cursor-pointer">
              <Upload className="w-3.5 h-3.5" /> 上傳平面圖 / 照片
              <input type="file" accept="image/*" onChange={onUpload} className="hidden" />
            </label>
            {imageUrl && (
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 w-12">透明度</span>
                  <input type="range" min={0.1} max={1} step={0.05} value={imageOpacity} onChange={(e) => setImageOpacity(parseFloat(e.target.value))} className="flex-1" />
                </div>
                <button onClick={() => setImageUrl(null)} className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-red-500"><ImageOff className="w-3.5 h-3.5" /> 清除底圖</button>
              </div>
            )}
            <p className="text-[10px] text-slate-400 mt-2 leading-snug">🔒 底圖僅本機暫存供描繪，不會儲存或上傳；存檔只保留幾何。</p>
          </section>

          {/* 房間尺寸 */}
          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">房間尺寸（公尺）</h3>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-slate-600">寬 {numInput(draft.width_m, (n) => patchDraft({ width_m: Math.max(1, n) }), 0.1, 1)}</label>
              <label className="flex items-center gap-1.5 text-xs text-slate-600">深 {numInput(draft.height_m, (n) => patchDraft({ height_m: Math.max(1, n) }), 0.1, 1)}</label>
            </div>
          </section>

          {/* CSI 感測器 */}
          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">CSI 感測器</h3>
            <p className="text-[11px] text-slate-500">在畫布上拖曳藍色菱形 → 放開會自動貼到最近的牆。</p>
            <p className="text-[11px] text-slate-400 mt-1">目前：{sensor?.mountWall ? `貼牆（${sensor.mountWall}）` : '未設定'}</p>
          </section>

          {/* Wi-Fi AP */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Wi-Fi AP（定位）</h3>
              <button onClick={addAnchor} className="flex items-center gap-1 text-[11px] text-[#007AFF] hover:underline"><Plus className="w-3 h-3" /> 新增</button>
            </div>
            {anchors.length < 3 && <p className="text-[11px] text-amber-600 mb-2">⚠ 三角定位至少需 3 個 AP（目前 {anchors.length}）</p>}
            <div className="space-y-1.5">
              {anchors.map((a) => (
                <div key={a.id} className={cn('flex items-center gap-1.5 p-1.5 rounded border', isSel('anchor', a.id) ? 'border-purple-300 bg-purple-50' : 'border-slate-100')}>
                  <span className="w-2.5 h-2.5 rounded-sm bg-purple-600 shrink-0" />
                  <input value={a.ssid} onChange={(e) => updateAnchor(a.id, { ssid: e.target.value })} className="flex-1 min-w-0 px-1.5 py-0.5 text-xs border border-slate-200 rounded" />
                  <button onClick={() => delAnchor(a.id)} className="p-1 text-slate-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          </section>

          {/* 病床 */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">病床</h3>
              <button onClick={addBed} className="flex items-center gap-1 text-[11px] text-[#007AFF] hover:underline"><Plus className="w-3 h-3" /> 新增</button>
            </div>
            <div className="space-y-2">
              {draft.beds.map((b) => (
                <div key={b.id} className={cn('p-2 rounded border space-y-1.5', isSel('bed', b.id) ? 'border-blue-300 bg-blue-50/50' : 'border-slate-100')}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-600">{b.label}</span>
                    <button onClick={() => delBed(b.id)} className="p-1 text-slate-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    寬 {numInput(b.size.w, (n) => updateBed(b.id, { size: { ...b.size, w: Math.max(0.2, n) } }))}
                    長 {numInput(b.size.d, (n) => updateBed(b.id, { size: { ...b.size, d: Math.max(0.2, n) } }))}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    旋轉 {numInput(b.rotationDeg ?? 0, (n) => updateBed(b.id, { rotationDeg: n }), 15, -360)}°
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 區域 */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">機能區域（浴室等）</h3>
              <button onClick={addZone} className="flex items-center gap-1 text-[11px] text-[#007AFF] hover:underline"><Plus className="w-3 h-3" /> 新增</button>
            </div>
            <div className="space-y-2">
              {zones.map((z) => (
                <div key={z.id} className={cn('p-2 rounded border space-y-1.5', isSel('zone', z.id) ? 'border-blue-300 bg-blue-50/50' : 'border-slate-100')}>
                  <div className="flex items-center justify-between gap-2">
                    <input value={z.label ?? ''} onChange={(e) => updateZone(z.id, { label: e.target.value })} className="flex-1 min-w-0 px-1.5 py-0.5 text-xs border border-slate-200 rounded" />
                    <button onClick={() => delZone(z.id)} className="p-1 text-slate-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    寬 {numInput(z.size.w, (n) => updateZone(z.id, { size: { ...z.size, w: Math.max(0.2, n) } }))}
                    深 {numInput(z.size.d, (n) => updateZone(z.id, { size: { ...z.size, d: Math.max(0.2, n) } }))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
