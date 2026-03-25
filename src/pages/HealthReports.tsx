import React, { useState } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  ResponsiveContainer, 
  Tooltip,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { User, Calendar, RefreshCw, Activity, Pill, Droplet, Scale, LineChart as ChartIcon } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { cn } from '../lib/utils';

const weeklyData = [
  { day: '一', weight: 65.2, bloodSugar: 105 },
  { day: '二', weight: 65.1, bloodSugar: 110 },
  { day: '三', weight: 65.3, bloodSugar: 108 },
  { day: '四', weight: 65.0, bloodSugar: 102 },
  { day: '五', weight: 64.8, bloodSugar: 98 },
  { day: '六', weight: 64.9, bloodSugar: 100 },
  { day: '日', weight: 65.0, bloodSugar: 104 },
];

export function HealthReports() {
  const { user } = useUser();
  const [showTrend, setShowTrend] = useState(false);

  const patientName = user?.role === 'family' ? user.patientName : '李伯伯';

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">健康報表</h1>
          <p className="text-slate-500 text-sm mt-1">
            {user?.role === 'family' ? `${patientName} 的健康日誌` : '個人健康日誌與趨勢分析'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        
        {/* Left Column: Basic Info & Medication */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Basic Info Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-[#2C363F]" />
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-slate-100 overflow-hidden border-2 border-slate-200 shrink-0">
                  <img src={`https://picsum.photos/seed/${patientName}/150/150`} alt="Patient" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    {patientName} <span className="text-sm font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">男</span>
                  </h2>
                  <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-1">
                    <Calendar className="w-4 h-4" />
                    1945 / 08 / 12
                  </div>
                </div>
              </div>
              <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-[#007AFF]" title="切換病患">
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Daily Medication */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex-1 flex flex-col">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
              <Pill className="w-5 h-5 text-[#007AFF]" />
              日常用藥
            </h3>
            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
              {[
                { name: '降血壓藥 (Amlodipine)', time: '早上 08:00', status: '已服用', color: 'bg-[#34C759]/10 text-[#34C759]' },
                { name: '血糖藥 (Metformin)', time: '中午 12:00', status: '未服用', color: 'bg-slate-100 text-slate-500' },
                { name: '保健食品 (維他命B群)', time: '晚上 18:00', status: '未服用', color: 'bg-slate-100 text-slate-500' },
              ].map((med, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-[#007AFF]/30 transition-colors bg-slate-50/50">
                  <div>
                    <p className="font-medium text-slate-800 text-sm">{med.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{med.time}</p>
                  </div>
                  <span className={cn("text-xs font-bold px-2.5 py-1 rounded-full", med.color)}>
                    {med.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Health Data & Trends */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Daily Health Data (Vitals) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#FF3B30]" />
                每日生命徵象
              </h3>
              <span className="text-xs text-slate-400">最後更新：今日 08:30 AM</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Blood Pressure Bar Chart representation */}
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <span className="text-sm font-medium text-slate-500">血壓 (mmHg)</span>
                  <span className="text-2xl font-mono font-bold text-slate-800">128 / 82</span>
                </div>
                <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex">
                  <div className="h-full bg-[#34C759] w-[60%]" title="收縮壓正常範圍" />
                  <div className="h-full bg-[#FFCC00] w-[20%]" title="警戒範圍" />
                  <div className="h-full bg-[#FF3B30] w-[20%]" title="危險範圍" />
                </div>
                <div className="flex justify-between text-xs text-slate-400 font-mono">
                  <span>90</span>
                  <span>120</span>
                  <span>140+</span>
                </div>
              </div>

              {/* Blood Oxygen Gauge representation */}
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <span className="text-sm font-medium text-slate-500">血氧濃度 (SpO2)</span>
                  <span className="text-2xl font-mono font-bold text-[#34C759]">98%</span>
                </div>
                <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#34C759] w-[98%] rounded-full transition-all duration-1000" />
                </div>
                <div className="flex justify-between text-xs text-slate-400 font-mono">
                  <span><span className="text-[#FF3B30]">90%</span> 以下危險</span>
                  <span>正常範圍 95-100%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Daily Checkups & Trends */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Droplet className="w-5 h-5 text-[#007AFF]" />
                日常檢查與趨勢
              </h3>
              <button 
                onClick={() => setShowTrend(!showTrend)}
                className="flex items-center gap-1.5 text-sm font-medium text-[#007AFF] bg-[#007AFF]/10 hover:bg-[#007AFF]/20 px-3 py-1.5 rounded-lg transition-colors"
              >
                <ChartIcon className="w-4 h-4" />
                {showTrend ? '隱藏趨勢圖' : '觀看週趨勢'}
              </button>
            </div>

            {showTrend ? (
              <div className="flex-1 min-h-[250px] animate-in fade-in slide-in-from-bottom-4 duration-300">
                <h4 className="text-sm font-medium text-slate-500 mb-4 text-center">一週血糖變化趨勢 (mg/dL)</h4>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[80, 130]} tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      labelStyle={{ color: '#64748b', fontWeight: 500, marginBottom: '4px' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="bloodSugar" 
                      name="血糖"
                      stroke="#007AFF" 
                      strokeWidth={3} 
                      dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} 
                      activeDot={{ r: 6, fill: '#007AFF', stroke: '#fff', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1 animate-in fade-in duration-300">
                {[
                  { label: '體重', value: '65.2', unit: 'kg', icon: Scale, status: 'normal' },
                  { label: '飯前血糖', value: '105', unit: 'mg/dL', icon: Droplet, status: 'normal' },
                  { label: '糞便檢查', value: '正常', unit: '', icon: Activity, status: 'normal' },
                  { label: '尿液檢查', value: '異常', unit: '蛋白尿', icon: Activity, status: 'warning' },
                ].map((item, i) => (
                  <div key={i} className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 text-slate-500 mb-2">
                      <item.icon className="w-4 h-4" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className={cn(
                        "text-2xl font-bold font-mono",
                        item.status === 'warning' ? "text-[#FFCC00]" : "text-slate-800"
                      )}>
                        {item.value}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">{item.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
