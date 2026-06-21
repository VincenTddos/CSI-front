import { useEffect, useMemo, useState } from 'react';
import { SlidersHorizontal, ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { cn } from '../lib/utils';
import type { Patient } from '../types';
import type { FallEventRow } from '../services/database.types';
import { listAlerts } from '../services/alertsService';
import { recommendSensitivity, type SensitivityRec } from '../lib/feedback';

interface RoomFeedback {
  key: string;
  label: string;        // 住民 + 房號（或感測區）
  confirmed: number;
  falseAlarms: number;
  processed: number;
  falseRate: number;    // 0–100
  rec: SensitivityRec;
  rationale: string;
}

const REC_META: Record<SensitivityRec, { text: string; icon: typeof ArrowDown; cls: string }> = {
  lower: { text: '建議調低靈敏度', icon: ArrowDown, cls: 'text-amber-600 bg-amber-50 border-amber-200' },
  raise: { text: '建議略升靈敏度', icon: ArrowUp, cls: 'text-blue-600 bg-blue-50 border-blue-200' },
  keep: { text: '維持目前設定', icon: Minus, cls: 'text-green-600 bg-green-50 border-green-200' },
};

/**
 * FeedbackSensitivity — 誤報回饋閉環。
 * 護理人員對警報的「確認 / 誤報」標記 → 依各房間誤報率，回推靈敏度調整建議。
 * refreshKey 改變時重新讀取（讓同頁標記後即時更新）。
 */
export function FeedbackSensitivity({ residents, refreshKey = 0 }: { residents: Patient[]; refreshKey?: number }) {
  const [alerts, setAlerts] = useState<FallEventRow[]>([]);

  useEffect(() => {
    listAlerts(500).then(setAlerts).catch((e) => console.error('[FeedbackSensitivity]', e));
  }, [refreshKey]);

  const rows = useMemo<RoomFeedback[]>(() => {
    const nameOf = (id: string | null) => residents.find((r) => r.id === id);
    const byKey = new Map<string, RoomFeedback>();
    for (const a of alerts) {
      if (a.status !== 'confirmed' && a.status !== 'false_alarm') continue; // 只看已回饋的
      const res = nameOf(a.resident_id);
      const key = a.resident_id ?? '未指派';
      const label = res ? `${res.name} · ${res.roomNumber} 號房` : '未指派感測區';
      const cur = byKey.get(key) ?? { key, label, confirmed: 0, falseAlarms: 0, processed: 0, falseRate: 0, rec: 'keep' as SensitivityRec, rationale: '' };
      if (a.status === 'confirmed') cur.confirmed += 1;
      else cur.falseAlarms += 1;
      byKey.set(key, cur);
    }
    const out = [...byKey.values()].map((r) => {
      r.processed = r.confirmed + r.falseAlarms;
      r.falseRate = r.processed > 0 ? Math.round((r.falseAlarms / r.processed) * 100) : 0;
      const { rec, rationale } = recommendSensitivity(r.confirmed, r.falseAlarms);
      r.rec = rec;
      r.rationale = rationale;
      return r;
    });
    return out.sort((a, b) => b.falseRate - a.falseRate || b.processed - a.processed);
  }, [alerts, residents]);

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-5">
      <h2 className="text-sm font-bold text-slate-600 flex items-center gap-2 mb-1">
        <SlidersHorizontal className="w-4 h-4 text-[#007AFF]" /> 回饋驅動的靈敏度建議
      </h2>
      <p className="text-[11px] text-slate-400 mb-4">
        依各房間「確認 / 誤報」回饋自動計算誤報率，回推靈敏度調整方向，降低 alert fatigue
      </p>

      {rows.length === 0 ? (
        <p className="text-xs text-slate-400 py-6 text-center">
          尚無已回饋的警報。請對「待處理」警報標記「確認 / 誤報」，這裡就會給出每間房的調整建議。
        </p>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r) => {
            const meta = REC_META[r.rec];
            const Icon = meta.icon;
            return (
              <div key={r.key} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                <div className="w-32 shrink-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{r.label}</p>
                  <p className="text-[10px] text-slate-400">確認 {r.confirmed} · 誤報 {r.falseAlarms}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', r.falseRate >= 50 ? 'bg-amber-500' : r.falseRate > 0 ? 'bg-amber-300' : 'bg-green-500')}
                        style={{ width: `${Math.max(4, r.falseRate)}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-mono text-slate-500 w-12 text-right">誤{r.falseRate}%</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 truncate">{r.rationale}</p>
                </div>
                <span className={cn('flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border shrink-0', meta.cls)}>
                  <Icon className="w-3.5 h-3.5" /> {meta.text}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
