import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { BarChart3, AlertTriangle, CheckCircle, Activity, Cpu, Download } from 'lucide-react';
import { getDailyFallStats, getDailyActivity, getDeviceHealth } from '../services/analyticsService';
import { exportToCsv, exportToJson, timestampedName } from '../services/exportService';
import type { DailyFallStatRow, DailyActivityRow, DeviceHealthRow } from '../services/database.types';
import { useData } from '../contexts/DataContext';

export function Analytics() {
  const { residents } = useData(); // 住民下拉與其他頁面共用同一份資料
  const [residentId, setResidentId] = useState<string>('');
  const [fallStats, setFallStats] = useState<DailyFallStatRow[]>([]);
  const [activity, setActivity] = useState<DailyActivityRow[]>([]);
  const [devices, setDevices] = useState<DeviceHealthRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getDailyFallStats(residentId || undefined, 30),
      getDailyActivity(residentId || undefined, 30),
      getDeviceHealth(),
    ])
      .then(([f, a, d]) => { setFallStats(f); setActivity(a); setDevices(d); })
      .catch((e) => console.error('[Analytics]', e))
      .finally(() => setLoading(false));
  }, [residentId]);

  // ---- 彙整統計 ----
  const totalEvents = fallStats.reduce((s, r) => s + r.total_events, 0);
  const pendingEvents = fallStats.reduce((s, r) => s + r.pending_events, 0);
  const confirmedEvents = fallStats.reduce((s, r) => s + r.confirmed_events, 0);
  const falseAlarms = fallStats.reduce((s, r) => s + r.false_alarms, 0);
  const falseRate = totalEvents > 0 ? Math.round((falseAlarms / totalEvents) * 100) : 0;
  const liveDevices = devices.filter(d => d.is_live).length;

  const fallChartData = [...fallStats]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map(r => ({ day: r.day.slice(5, 10), 確認: r.confirmed_events, 誤報: r.false_alarms, 待確認: r.pending_events }));

  const activityChartData = activity.map(r => ({ day: r.day.slice(5, 10), 平均活動: r.avg_activity, 尖峰: r.peak_activity }));

  const cards = [
    { label: '總跌倒事件', value: totalEvents, icon: AlertTriangle, color: 'text-red-500 bg-red-50' },
    { label: '待確認', value: pendingEvents, icon: Activity, color: 'text-amber-500 bg-amber-50' },
    { label: '誤報率', value: `${falseRate}%`, icon: CheckCircle, color: 'text-green-500 bg-green-50' },
    { label: '在線裝置', value: `${liveDevices}/${devices.length}`, icon: Cpu, color: 'text-blue-500 bg-blue-50' },
  ];

  const handleExport = (fmt: 'csv' | 'json') => {
    const payload = { resident_id: residentId || 'all', fall_stats: fallStats, activity, devices };
    if (fmt === 'csv') exportToCsv(fallStats as unknown as Record<string, unknown>[], timestampedName('wicare_fall_stats', 'csv'));
    else exportToJson(payload, timestampedName('wicare_report', 'json'));
  };

  return (
    <div className="h-full flex flex-col space-y-5 overflow-y-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#007AFF]" /> 管理報表與數據分析
          </h1>
          <p className="text-sm text-slate-500 mt-1">跌倒事件統計、活動量趨勢與裝置在線率（近 30 天）</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={residentId} onChange={e => setResidentId(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm">
            <option value="">全部住民</option>
            {residents.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <button onClick={() => handleExport('csv')}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm">
            <Download className="w-4 h-4" /> CSV
          </button>
          <button onClick={() => handleExport('json')}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm">
            <Download className="w-4 h-4" /> JSON
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${c.color}`}>
              <c.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400">{c.label}</p>
              <p className="text-xl font-bold text-slate-800">{c.value}</p>
            </div>
          </div>
        ))}
      </div>

      {loading && <p className="text-sm text-slate-400">載入中…</p>}

      {/* 跌倒事件統計 */}
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <h2 className="text-sm font-bold text-slate-600 mb-4">跌倒事件統計（每日）</h2>
        {fallChartData.length === 0 ? (
          <p className="text-xs text-slate-400 py-8 text-center">尚無資料（連線 Supabase 並累積事件後顯示）</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={fallChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="確認" stackId="a" fill="#ef4444" />
              <Bar dataKey="待確認" stackId="a" fill="#f59e0b" />
              <Bar dataKey="誤報" stackId="a" fill="#94a3b8" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 活動量趨勢 */}
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <h2 className="text-sm font-bold text-slate-600 mb-4">活動量趨勢（每日平均 / 尖峰）</h2>
        {activityChartData.length === 0 ? (
          <p className="text-xs text-slate-400 py-8 text-center">尚無資料（core_bridge 寫入活動彙整後顯示）</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={activityChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="平均活動" stroke="#007AFF" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="尖峰" stroke="#a855f7" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 裝置在線率 */}
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <h2 className="text-sm font-bold text-slate-600 mb-4">裝置在線狀態</h2>
        {devices.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">尚無裝置資料</p>
        ) : (
          <div className="space-y-2">
            {devices.map(d => (
              <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${d.is_live ? 'bg-green-500' : 'bg-slate-300'}`} />
                  <span className="text-sm font-medium text-slate-700">{d.name}</span>
                </div>
                <span className="text-xs text-slate-400">
                  {d.is_live ? '在線' : '離線'}
                  {d.last_seen_at ? ` · ${new Date(d.last_seen_at).toLocaleString('zh-TW')}` : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
