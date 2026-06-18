import React, { useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceArea, ReferenceLine,
} from 'recharts';
import { Moon, Upload, AlertTriangle, BedDouble, Activity, RotateCcw } from 'lucide-react';
import {
  parseRecordingJsonl, analyzeSleep,
  type SleepReport, type ScorePoint,
} from '../services/sleepService';

// 睡眠品質報告卡片：上傳 core_bridge --record 的 {ts, score} jsonl → 整夜睡眠分析。
// 演算法在 src/services/sleepService.ts（與 python/sleep_quality.py 對拍一致）。
// 無檔 / 資料不足 → 顯示空狀態或誠實原因，不顯示任何捏造數字。

const MAX_CHART_POINTS = 800;

function hhmm(epochSec: number): string {
  const d = new Date(epochSec * 1000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function isoToEpoch(iso: string): number {
  return Date.parse(iso) / 1000;
}

export function SleepReportCard() {
  const [series, setSeries] = useState<ScorePoint[]>([]);
  const [report, setReport] = useState<SleepReport | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const text = await file.text();
      const parsed = parseRecordingJsonl(text);
      if (parsed.length === 0) {
        setSeries([]); setReport(null); setFileName(file.name);
        setError('檔案中找不到任何有效的 {ts, score} 資料列。');
        return;
      }
      setSeries(parsed);
      setReport(analyzeSleep(parsed));
      setFileName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const reset = () => {
    setSeries([]); setReport(null); setFileName(''); setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  // 圖表資料（過長則等距抽樣，避免渲染過慢）
  const chartData = useMemo(() => {
    if (series.length === 0) return [];
    const stride = Math.max(1, Math.ceil(series.length / MAX_CHART_POINTS));
    const pts: { t: number; score: number }[] = [];
    for (let i = 0; i < series.length; i += stride) {
      pts.push({ t: series[i].ts, score: series[i].score });
    }
    return pts;
  }, [series]);

  const ok = report?.confidence === 'ok';
  const onsetEpoch = ok && report.sleep_onset ? isoToEpoch(report.sleep_onset) : null;
  const wakeEpoch = ok && report.wake_time ? isoToEpoch(report.wake_time) : null;

  const scoreColor = !ok ? 'text-slate-400'
    : (report!.sleep_score ?? 0) >= 70 ? 'text-green-600'
    : (report!.sleep_score ?? 0) >= 50 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h2 className="text-sm font-bold text-slate-600 flex items-center gap-2">
          <Moon className="w-4 h-4 text-indigo-500" /> 睡眠品質報告
        </h2>
        <div className="flex items-center gap-2">
          {fileName && (
            <button onClick={reset}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
              <RotateCcw className="w-3.5 h-3.5" /> 清除
            </button>
          )}
          <label className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 text-sm font-medium px-3 py-2 rounded-lg cursor-pointer transition-colors">
            <Upload className="w-4 h-4" /> 上傳整夜錄製
            <input ref={inputRef} type="file" accept=".jsonl,.json,.txt,.ndjson"
              onChange={handleFile} className="hidden" />
          </label>
        </div>
      </div>
      <p className="text-[11px] text-slate-400 mb-4">
        上傳 <code className="bg-slate-100 px-1 rounded">python core_bridge.py --record night.jsonl</code> 產生的整夜檔，於瀏覽器端離線分析（不上傳雲端）。
      </p>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs mb-3">{error}</div>
      )}

      {/* 空狀態 */}
      {!report && !error && (
        <p className="text-xs text-slate-400 py-10 text-center">
          尚未載入資料。請上傳一晚的 {'{ts, score}'} 錄製檔以產生睡眠報告。
        </p>
      )}

      {/* 資料不足 / 無法判定（誠實原因，不捏造數字） */}
      {report && report.confidence === 'low' && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-700">
            <p className="font-semibold mb-0.5">無法產生可靠的睡眠報告</p>
            <p>{report.reason}</p>
          </div>
        </div>
      )}

      {/* 正常報告 */}
      {ok && report && (
        <div className="space-y-5">
          {/* 分數 + 指標 */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-100 p-4 flex flex-col items-center justify-center">
              <div className="flex items-end gap-1">
                <span className={`text-5xl font-black ${scoreColor}`}>{report.sleep_score}</span>
                <span className="text-sm font-bold text-slate-400 mb-1">/100</span>
              </div>
              <span className="text-xs text-slate-500 mt-1">睡眠品質 · {report.quality_label}</span>
            </div>
            <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Metric icon={BedDouble} tint="text-indigo-500 bg-indigo-50"
                label="入睡 → 起床"
                value={`${report.sleep_onset ? hhmm(isoToEpoch(report.sleep_onset)) : '—'} → ${report.wake_time ? hhmm(isoToEpoch(report.wake_time)) : '—'}`} />
              <Metric icon={Moon} tint="text-blue-500 bg-blue-50"
                label="總睡眠 / 在床(分)"
                value={`${fmt(report.total_sleep_min)} / ${fmt(report.time_in_bed_min)}`} />
              <Metric icon={Activity} tint="text-amber-500 bg-amber-50"
                label="躁動指數"
                value={report.restlessness_index != null ? `${Math.round(report.restlessness_index * 100)}%` : '—'} />
              <Metric icon={RotateCcw} tint="text-purple-500 bg-purple-50"
                label="夜醒次數" value={String(report.awakenings)} />
            </div>
          </div>

          {/* 整夜時間軸 */}
          <div>
            <p className="text-[11px] text-slate-400 mb-2">
              整夜移動分數時間軸（<span className="text-indigo-400">藍底</span> = 睡眠時段，<span className="text-red-400">紅線</span> = 夜醒）
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']}
                  scale="time" tickFormatter={hhmm} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip
                  labelFormatter={(v) => hhmm(Number(v))}
                  formatter={(v: number) => [v.toFixed(1), '移動分數']} />
                {onsetEpoch != null && wakeEpoch != null && (
                  <ReferenceArea x1={onsetEpoch} x2={wakeEpoch} fill="#6366f1" fillOpacity={0.08} />
                )}
                {report.awakening_events.map((ev, i) => (
                  <ReferenceLine key={i} x={isoToEpoch(ev.start)} stroke="#ef4444"
                    strokeDasharray="2 2" strokeOpacity={0.7} />
                ))}
                <Line type="monotone" dataKey="score" stroke="#007AFF" strokeWidth={1.2}
                  dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

function fmt(v: number | null): string {
  return v == null ? '—' : String(Math.round(v));
}

interface MetricProps {
  icon: React.ComponentType<{ className?: string }>;
  tint: string;
  label: string;
  value: string;
}
function Metric({ icon: Icon, tint, label, value }: MetricProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${tint}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-sm font-bold text-slate-800 leading-tight">{value}</p>
      <p className="text-[11px] text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}
