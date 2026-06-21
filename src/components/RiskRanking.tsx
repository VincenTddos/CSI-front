import { useEffect, useState } from 'react';
import { ListOrdered, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../lib/utils';
import type { Patient } from '../types';
import type { FallEventRow } from '../services/database.types';
import { listAlerts } from '../services/alertsService';
import { rankResidentsByRisk, type ResidentRisk } from '../services/riskService';

const LEVEL_STYLE: Record<ResidentRisk['level'], { bar: string; badge: string }> = {
  高: { bar: 'bg-red-500', badge: 'text-red-600 bg-red-50 border-red-200' },
  中: { bar: 'bg-amber-500', badge: 'text-amber-600 bg-amber-50 border-amber-200' },
  低: { bar: 'bg-green-500', badge: 'text-green-600 bg-green-50 border-green-200' },
};

/**
 * RiskRanking — 全體住民跌倒風險排行（規則式評分）。
 * 資料：住民（props）+ 警報事件（alertsService，種子示範資料可運作）。
 */
export function RiskRanking({ residents }: { residents: Patient[] }) {
  const [alerts, setAlerts] = useState<FallEventRow[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    listAlerts(500).then(setAlerts).catch((e) => console.error('[RiskRanking]', e));
  }, []);

  const ranked = rankResidentsByRisk(residents, alerts);
  const highCount = ranked.filter((r) => r.level === '高').length;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-bold text-slate-600 flex items-center gap-2">
          <ListOrdered className="w-4 h-4 text-[#007AFF]" /> 全體住民跌倒風險排行
        </h2>
        {highCount > 0 && (
          <span className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
            {highCount} 位高風險
          </span>
        )}
      </div>
      <p className="text-[11px] text-slate-400 mb-4">
        規則式評分（近 14 天事件 + 年齡/病史），用於排定關注優先順序，非醫療診斷
      </p>

      <div className="space-y-2">
        {ranked.map((r, i) => {
          const st = LEVEL_STYLE[r.level];
          const open = expanded === r.resident.id;
          return (
            <div key={r.resident.id} className="rounded-xl border border-slate-100 overflow-hidden">
              <button
                onClick={() => setExpanded(open ? null : r.resident.id)}
                className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors text-left"
              >
                <span className={cn(
                  'w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold',
                  i === 0 ? 'bg-red-100 text-red-600' : i === 1 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500',
                )}>
                  {i + 1}
                </span>
                <div className="w-24 shrink-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{r.resident.name}</p>
                  <p className="text-[10px] text-slate-400">{r.resident.roomNumber} 號房 · {r.resident.age} 歲</p>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all', st.bar)} style={{ width: `${r.score}%` }} />
                  </div>
                </div>
                <span className="w-9 text-right text-sm font-bold text-slate-700 tabular-nums">{r.score}</span>
                <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full border shrink-0', st.badge)}>
                  {r.level}
                </span>
                {open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
              </button>
              {open && (
                <div className="px-4 pb-3 pt-1 bg-slate-50/60 border-t border-slate-100">
                  <div className="flex flex-wrap gap-1.5">
                    {r.factors.map((f, idx) => (
                      <span key={idx} className="text-[11px] text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                        {f}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">
                    確認跌倒 {r.confirmedFalls} · 待處理 {r.pending} · 誤報 {r.falseAlarms}
                  </p>
                </div>
              )}
            </div>
          );
        })}
        {ranked.length === 0 && (
          <p className="text-xs text-slate-400 py-6 text-center">尚無住民資料</p>
        )}
      </div>
    </div>
  );
}
