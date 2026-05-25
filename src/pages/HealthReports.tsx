import React, { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, BarChart, Bar
} from 'recharts';
import { Activity, Pill, Droplet, Scale, LineChart as ChartIcon, HeartPulse, ClipboardList, RefreshCw } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { cn } from '../lib/utils';
import { Patient } from '../types';
import { mockPatients } from '../lib/mockData';

const PATIENTS_KEY = 'csi_patients';
const DAILY_KEY = 'csi_daily_health';
const CHECKUP_KEY = 'csi_routine_checkup';
const ALERTS_KEY = 'csi_alerts';

function load(key: string) {
  const saved = localStorage.getItem(key);
  if (saved) { try { return JSON.parse(saved); } catch { /* */ } }
  return null;
}

// Generate mock weekly trend data for a patient
function generateWeeklyTrend(patientId: string) {
  const days = ['一', '二', '三', '四', '五', '六', '日'];
  // Use patientId hash to create deterministic but varied data
  const seed = patientId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return days.map((day, i) => ({
    day,
    bloodPressureSys: 120 + Math.round(Math.sin(seed + i) * 15),
    bloodPressureDia: 78 + Math.round(Math.cos(seed + i) * 10),
    bloodOxygen: 95 + Math.round(Math.abs(Math.sin(seed + i * 2)) * 4),
    weight: 60 + (seed % 20) + Math.round(Math.sin(i) * 2 * 10) / 10,
    bloodSugar: 95 + Math.round(Math.sin(seed + i * 1.5) * 20),
  }));
}

export function HealthReports() {
  const { user } = useUser();
  const patients: Patient[] = load(PATIENTS_KEY) || mockPatients;
  const dailyRecords: any[] = load(DAILY_KEY) || [];
  const checkupRecords: any[] = load(CHECKUP_KEY) || [];
  const alerts: any[] = load(ALERTS_KEY) || [];

  const [selectedPatientIndex, setSelectedPatientIndex] = useState(0);
  const [activeChart, setActiveChart] = useState<'bp' | 'sugar' | 'weight'>('bp');

  const patient = patients[selectedPatientIndex];
  const daily = dailyRecords.find((r: any) => r.patientId === patient?.id);
  const checkup = checkupRecords.find((r: any) => r.patientId === patient?.id);
  const weeklyData = patient ? generateWeeklyTrend(patient.id) : [];

  const patientAlerts = alerts.filter((a: any) => a.room?.includes(patient?.roomNumber));

  const handleSwitchPatient = () => {
    setSelectedPatientIndex(prev => (prev + 1) % patients.length);
  };

  const renderStatus = (status: string) => {
    switch (status) {
      case 'normal': return <span className="text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded text-xs">正常</span>;
      case 'warning': return <span className="text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded text-xs">留意</span>;
      case 'abnormal': return <span className="text-red-600 font-medium bg-red-50 px-2 py-0.5 rounded text-xs">異常</span>;
      default: return <span className="text-slate-400 text-xs">未紀錄</span>;
    }
  };

  if (!patient) {
    return <div className="flex items-center justify-center h-full text-slate-400">尚無受護者資料</div>;
  }

  return (
    <div className="h-full flex flex-col space-y-5">
      {/* 標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">健康報表</h1>
          <p className="text-sm text-slate-500 mt-1">綜合檢視受護者的健康數據、趨勢圖表與相關警報</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-0">

        {/* ===== 左欄：個人資料 + 用藥 ===== */}
        <div className="lg:col-span-4 flex flex-col gap-5">

          {/* 個人資料卡 */}
          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">受護者資料</h2>
              <button onClick={handleSwitchPatient}
                className="flex items-center gap-1 text-xs text-[#007AFF] hover:bg-blue-50 px-2 py-1 rounded transition-colors">
                <RefreshCw className="w-3 h-3" /> 切換
              </button>
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-[#007AFF] text-xl font-bold">
                {patient.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">{patient.name} <span className="text-sm font-normal text-slate-500">{patient.gender}</span></h3>
                <p className="text-xs text-slate-500">{patient.birthDate} ({patient.age}歲) ・ {patient.roomNumber} 號房</p>
              </div>
            </div>
            {patient.medicalHistory.length > 0 && (
              <div className="text-xs text-slate-500">
                <span className="font-medium">病史：</span>{patient.medicalHistory.join('、')}
              </div>
            )}
          </div>

          {/* 日常用藥 */}
          <div className="bg-white rounded-xl border border-slate-100 p-5 flex-1">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Pill className="w-4 h-4 text-[#007AFF]" /> 日常用藥
            </h3>
            {patient.medications.length > 0 ? (
              <div className="space-y-2">
                {patient.medications.map((med, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-sm font-medium text-slate-700">{med}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 py-4 text-center">目前無用藥紀錄</p>
            )}
          </div>

          {/* 相關警報 */}
          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-red-500" /> 相關警報
            </h3>
            {patientAlerts.length > 0 ? (
              <div className="space-y-2">
                {patientAlerts.slice(0, 3).map((a: any, i: number) => (
                  <div key={i} className={cn(
                    "p-2 rounded-lg border text-xs",
                    a.status === 'pending' ? "bg-red-50/50 border-red-100" : "bg-slate-50 border-slate-100"
                  )}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-700">{a.type}</span>
                      <span className={cn("font-bold",
                        a.status === 'pending' ? "text-red-500" : a.status === 'confirmed' ? "text-green-500" : "text-slate-400"
                      )}>
                        {a.status === 'pending' ? '待處理' : a.status === 'confirmed' ? '已確認' : '誤報'}
                      </span>
                    </div>
                    <p className="text-slate-400 mt-0.5">{a.time}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 py-2 text-center">此房號無警報紀錄</p>
            )}
          </div>
        </div>

        {/* ===== 右欄：即時數據 + 趨勢圖 ===== */}
        <div className="lg:col-span-8 flex flex-col gap-5">

          {/* 最新量測數據 */}
          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <HeartPulse className="w-4 h-4 text-rose-500" /> 最新量測數據
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {/* 血壓 */}
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">血壓 (mmHg)</span>
                <span className="text-xl font-bold font-mono text-slate-800">
                  {daily?.bloodPressureSys || '-'}<span className="text-slate-300 mx-0.5">/</span>{daily?.bloodPressureDia || '-'}
                </span>
              </div>
              {/* 血氧 */}
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">血氧 (%)</span>
                <span className={cn("text-xl font-bold font-mono",
                  daily?.bloodOxygen && Number(daily.bloodOxygen) >= 95 ? "text-green-600" : daily?.bloodOxygen ? "text-amber-600" : "text-slate-800"
                )}>
                  {daily?.bloodOxygen || '-'}
                </span>
              </div>
              {/* 體重 */}
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">體重 (kg)</span>
                <span className="text-xl font-bold font-mono text-slate-800">{checkup?.weight || '-'}</span>
              </div>
              {/* 血糖 */}
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">血糖 (mg/dL)</span>
                <span className="text-xl font-bold font-mono text-slate-800">{checkup?.bloodSugar || '-'}</span>
              </div>
              {/* 排泄 */}
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">排泄狀態</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-slate-400">尿</span>{renderStatus(checkup?.urineStatus)}
                  <span className="text-[10px] text-slate-400">便</span>{renderStatus(checkup?.stoolStatus)}
                </div>
              </div>
            </div>
            {daily?.measureTime && (
              <p className="text-[10px] text-slate-400 mt-3 text-right">量測時間：{daily.measureTime}</p>
            )}
          </div>

          {/* 趨勢圖表 */}
          <div className="bg-white rounded-xl border border-slate-100 p-5 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <ChartIcon className="w-4 h-4 text-[#007AFF]" /> 一週趨勢圖
              </h3>
              <div className="flex gap-1">
                {([
                  ['bp', '血壓'],
                  ['sugar', '血糖'],
                  ['weight', '體重']
                ] as [typeof activeChart, string][]).map(([key, label]) => (
                  <button key={key} onClick={() => setActiveChart(key)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                      activeChart === key ? "bg-[#007AFF] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    )}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 min-h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                {activeChart === 'bp' ? (
                  <LineChart data={weeklyData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[60, 160]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }} />
                    <Line type="monotone" dataKey="bloodPressureSys" name="收縮壓" stroke="#FF3B30" strokeWidth={2}
                      dot={{ r: 3, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="bloodPressureDia" name="舒張壓" stroke="#007AFF" strokeWidth={2}
                      dot={{ r: 3, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 5 }} />
                  </LineChart>
                ) : activeChart === 'sugar' ? (
                  <BarChart data={weeklyData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[60, 140]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }} />
                    <Bar dataKey="bloodSugar" name="血糖 (mg/dL)" fill="#007AFF" radius={[4, 4, 0, 0]} barSize={32} />
                  </BarChart>
                ) : (
                  <LineChart data={weeklyData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }} />
                    <Line type="monotone" dataKey="weight" name="體重 (kg)" stroke="#34C759" strokeWidth={2}
                      dot={{ r: 3, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 5 }} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>

            <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
              <p className="text-xs text-slate-500">
                {activeChart === 'bp' && '📊 血壓趨勢：紅線為收縮壓、藍線為舒張壓。正常範圍 120/80 mmHg 以下。'}
                {activeChart === 'sugar' && '📊 血糖趨勢：飯前血糖正常值 70-100 mg/dL。超過 126 mg/dL 為糖尿病標準。'}
                {activeChart === 'weight' && '📊 體重趨勢：關注變化幅度，每週波動超過 2kg 建議諮詢醫師。'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
