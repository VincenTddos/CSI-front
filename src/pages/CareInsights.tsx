import React, { useEffect, useState } from 'react';
import {
  Brain, Activity, AlertTriangle, TrendingDown, TrendingUp, Minus,
  Moon, Sofa, Sparkles, ShieldAlert, Loader2,
} from 'lucide-react';
import { listResidents } from '../services/residentsService';
import {
  getActivityHeatmap, getBehaviorFlags, getRiskAssessment,
  buildCareReportInput, type HeatRow, type BehaviorFlags, type RiskAssessment,
} from '../services/insightsService';
import { generateCareReport } from '../services/geminiService';
import type { ResidentRow } from '../services/database.types';
import { isSupabaseConfigured } from '../lib/supabase';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function heatColor(v: number): string {
  if (v <= 0) return 'rgba(148,163,184,0.10)';
  const t = Math.min(1, v / 80);
  // 綠 → 黃 → 紅
  const r = t < 0.5 ? Math.round(34 + t * 2 * (245 - 34)) : 245;
  const g = t < 0.5 ? 197 : Math.round(197 - (t - 0.5) * 2 * (197 - 68));
  const b = 68;
  return `rgba(${r},${g},${b},${0.25 + t * 0.7})`;
}

export function CareInsights() {
  const [residents, setResidents] = useState<ResidentRow[]>([]);
  const [residentId, setResidentId] = useState<string>('');
  const [heat, setHeat] = useState<HeatRow[]>([]);
  const [flags, setFlags] = useState<BehaviorFlags | null>(null);
  const [risk, setRisk] = useState<RiskAssessment | null>(null);
  const [loading, setLoading] = useState(true);

  const [report, setReport] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reportErr, setReportErr] = useState('');

  useEffect(() => { listResidents().then(setResidents).catch(() => {}); }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getActivityHeatmap(residentId || undefined, 7),
      getBehaviorFlags(residentId || undefined, 7),
      getRiskAssessment(residentId || undefined, 7),
    ]).then(([h, b, r]) => { setHeat(h); setFlags(b); setRisk(r); })
      .catch(e => console.error('[CareInsights]', e))
      .finally(() => setLoading(false));
    setReport('');
  }, [residentId]);

  const runReport = async () => {
    setReporting(true); setReportErr(''); setReport('');
    try {
      const name = residents.find(r => r.id === residentId)?.name ?? '全體住民';
      const input = await buildCareReportInput(residentId || undefined, name, 7);
      setReport(await generateCareReport(input));
    } catch (e) {
      setReportErr(e instanceof Error ? e.message : String(e));
    } finally {
      setReporting(false);
    }
  };

  const riskColor = risk?.level === '高' ? 'text-red-600 bg-red-50 border-red-200'
    : risk?.level === '中' ? 'text-amber-600 bg-amber-50 border-amber-200'
    : 'text-green-600 bg-green-50 border-green-200';

  const TrendIcon = flags?.trend === 'down' ? TrendingDown : flags?.trend === 'up' ? TrendingUp : Minus;

  return (
    <div className="h-full flex flex-col space-y-5 overflow-y-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Brain className="w-5 h-5 text-[#007AFF]" /> 智慧照護分析
          </h1>
          <p className="text-sm text-slate-500 mt-1">作息行為、健康風險評分與 AI 照護週報（近 7 天）</p>
        </div>
        <select value={residentId} onChange={e => setResidentId(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm">
          <option value="">全體住民</option>
          {residents.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>

      {!isSupabaseConfigured && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-xs">
          尚未連接 Supabase，分析資料為空。連接雲端並累積活動資料後即會顯示。
        </div>
      )}

      {/* 風險評分 + 行為旗標 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 風險評分 */}
        <div className={`rounded-2xl border p-5 ${riskColor}`}>
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="w-5 h-5" />
            <h2 className="text-sm font-bold uppercase tracking-wider">健康風險評分</h2>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-5xl font-black">{risk?.score ?? 0}</span>
            <span className="text-lg font-bold mb-1">/ 100 · {risk?.level ?? '—'}風險</span>
          </div>
          <div className="mt-4 space-y-1.5">
            {risk?.factors.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className={`w-1.5 h-1.5 rounded-full ${f.severity === 'bad' ? 'bg-red-500' : f.severity === 'warn' ? 'bg-amber-500' : 'bg-green-500'}`} />
                <span className="text-slate-600">{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 行為旗標 */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { icon: Activity, label: '平均活動分數', value: flags?.avgActivity ?? 0, tint: 'text-blue-500 bg-blue-50' },
            { icon: Moon, label: '夜間活動次數', value: flags?.nightActivity ?? 0, tint: 'text-purple-500 bg-purple-50', warn: (flags?.nightActivity ?? 0) >= 3 },
            { icon: Sofa, label: '日間最長靜止(時)', value: flags?.longInactiveHours ?? 0, tint: 'text-amber-500 bg-amber-50', warn: (flags?.longInactiveHours ?? 0) >= 4 },
            { icon: TrendIcon, label: '活動趨勢', value: flags?.trend === 'down' ? '下降' : flags?.trend === 'up' ? '上升' : '持平', tint: 'text-green-500 bg-green-50', warn: flags?.trend === 'down' },
          ].map((c) => (
            <div key={c.label} className="bg-white rounded-2xl border border-slate-100 p-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${c.tint}`}>
                <c.icon className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold text-slate-800">{c.value}{c.warn && <AlertTriangle className="inline w-4 h-4 text-amber-500 ml-1 mb-1" />}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 作息熱力圖 */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <h2 className="text-sm font-bold text-slate-600 mb-1">作息活動熱力圖</h2>
        <p className="text-[11px] text-slate-400 mb-4">每格為該小時平均活動分數，越紅代表活動越多（可看出睡眠與活躍時段）</p>
        {heat.length === 0 ? (
          <p className="text-xs text-slate-400 py-8 text-center">尚無活動資料（core_bridge 連雲端並執行後累積）</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="flex items-center gap-1 mb-1 pl-14">
                {HOURS.map(h => <span key={h} className="w-5 text-center text-[8px] text-slate-400">{h}</span>)}
              </div>
              {heat.map(row => (
                <div key={row.date} className="flex items-center gap-1 mb-1">
                  <span className="w-13 pr-1 text-[10px] text-slate-500 text-right shrink-0" style={{ width: 52 }}>{row.date.slice(5)}</span>
                  {row.hours.map((v, h) => (
                    <div key={h} className="w-5 h-5 rounded-sm" style={{ background: heatColor(v) }} title={`${row.date} ${h}:00 · ${v}`} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AI 照護週報 */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-bold text-slate-600 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-500" /> AI 照護週報
          </h2>
          <button onClick={runReport} disabled={reporting}
            className="flex items-center gap-2 bg-gradient-to-r from-[#007AFF] to-purple-600 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50 hover:-translate-y-0.5 transition-transform">
            {reporting ? <><Loader2 className="w-4 h-4 animate-spin" /> 產生中…</> : <><Sparkles className="w-4 h-4" /> 產生 AI 週報</>}
          </button>
        </div>
        {reportErr && <p className="text-xs text-red-500 mb-2">{reportErr}（請確認 .env 已設定 GEMINI_API_KEY 且在 npm run dev 下執行）</p>}
        {report ? (
          <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 border border-slate-100 rounded-xl p-4">{report}</div>
        ) : !reporting && (
          <p className="text-xs text-slate-400 py-6 text-center">點「產生 AI 週報」，AI 會依本週數據撰寫照護摘要與建議。</p>
        )}
      </div>
    </div>
  );
}
