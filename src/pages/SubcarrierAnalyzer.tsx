import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell, ReferenceLine } from 'recharts';
import { Radio, Zap, Info, RefreshCw, Shield } from 'lucide-react';
import { cn } from '../lib/utils';

// Generate 64 HT20 subcarriers with realistic-looking data
function generateSubcarriers(seed: number = 0) {
  const guardLow = 11;
  const guardHigh = 52;
  const dcSubcarrier = 32;
  const subs = [];
  for (let i = 0; i < 64; i++) {
    const isGuard = i < guardLow || i > guardHigh;
    const isDC = i === dcSubcarrier;
    const baseAmp = isGuard ? 2 + Math.random() * 3 : isDC ? 1 + Math.random() * 2 : 15 + Math.random() * 35;
    const nbvi = isGuard || isDC ? 0.9 + Math.random() * 0.3 : 0.02 + Math.random() * 0.25;
    subs.push({ index: i, amplitude: baseAmp, nbvi, isGuard, isDC });
  }
  return subs;
}

// Select 12 best subcarriers by lowest NBVI with spacing
function selectBest12(subs: any[]) {
  const valid = subs.filter(s => !s.isGuard && !s.isDC).sort((a, b) => a.nbvi - b.nbvi);
  const selected: number[] = [];
  for (const sub of valid) {
    if (selected.length >= 12) break;
    if (selected.every(s => Math.abs(s - sub.index) >= 2)) {
      selected.push(sub.index);
    }
  }
  return new Set(selected);
}

export function SubcarrierAnalyzer() {
  const [subcarriers, setSubcarriers] = useState(generateSubcarriers());
  const [selected, setSelected] = useState(new Set<number>());
  const [viewMode, setViewMode] = useState<'amplitude' | 'nbvi'>('amplitude');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    setSelected(selectBest12(subcarriers));
  }, [subcarriers]);

  const reAnalyze = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      setSubcarriers(generateSubcarriers(Date.now()));
      setIsAnalyzing(false);
    }, 1500);
  };

  const validCount = subcarriers.filter(s => !s.isGuard && !s.isDC).length;

  const chartData = subcarriers.map(s => ({
    index: s.index,
    value: viewMode === 'amplitude' ? s.amplitude : s.nbvi,
    isGuard: s.isGuard,
    isDC: s.isDC,
    isSelected: selected.has(s.index),
    nbvi: s.nbvi,
    amplitude: s.amplitude,
  }));

  const getBarColor = (entry: any) => {
    if (entry.isGuard) return '#e2e8f0';
    if (entry.isDC) return '#fbbf24';
    if (entry.isSelected) return '#007AFF';
    return '#94a3b8';
  };

  return (
    <div className="h-full flex flex-col space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">子載波頻譜分析</h1>
          <p className="text-sm text-slate-500 mt-1">HT20 模式下 64 個 OFDM 子載波的振幅與選擇狀態</p>
        </div>
        <button onClick={reAnalyze} disabled={isAnalyzing}
          className="flex items-center gap-2 bg-[#007AFF] hover:bg-[#0066CC] text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium disabled:opacity-50">
          <RefreshCw className={cn("w-4 h-4", isAnalyzing && "animate-spin")} />
          {isAnalyzing ? '分析中...' : '重新分析'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white p-3 rounded-xl border border-slate-100">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">總子載波</p>
          <p className="text-lg font-bold text-slate-800 font-mono">64</p>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-100">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Guard Band</p>
          <p className="text-lg font-bold text-slate-400 font-mono">0-10, 53-63</p>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-100">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">DC 子載波</p>
          <p className="text-lg font-bold text-amber-500 font-mono">#32</p>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-100">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">可用子載波</p>
          <p className="text-lg font-bold text-slate-600 font-mono">{validCount}</p>
        </div>
        <div className="bg-white p-3 rounded-xl border border-blue-100">
          <p className="text-[10px] text-blue-500 uppercase tracking-wider">NBVI 選中</p>
          <p className="text-lg font-bold text-[#007AFF] font-mono">{selected.size}</p>
        </div>
      </div>

      {/* Toggle */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">檢視模式：</span>
        {(['amplitude', 'nbvi'] as const).map(mode => (
          <button key={mode} onClick={() => setViewMode(mode)}
            className={cn("px-3 py-1 rounded-full text-xs font-medium transition-colors",
              viewMode === mode ? "bg-[#007AFF] text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            )}>
            {mode === 'amplitude' ? '振幅 (Amplitude)' : 'NBVI 指數'}
          </button>
        ))}
      </div>

      {/* Main Chart */}
      <div className="bg-white rounded-xl border border-slate-100 p-5 flex-1 flex flex-col min-h-[280px]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-600 flex items-center gap-2">
            <Radio className="w-4 h-4 text-[#007AFF]" />
            {viewMode === 'amplitude' ? '各子載波振幅' : 'NBVI 穩定指標 (越低越好)'}
          </h3>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1"><span className="w-3 h-2 bg-[#007AFF] rounded-sm inline-block" /> 選中 (12)</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 bg-slate-400 rounded-sm inline-block" /> 未選中</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 bg-slate-200 rounded-sm inline-block" /> Guard Band</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 bg-amber-400 rounded-sm inline-block" /> DC</span>
          </div>
        </div>
        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="index" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={3} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-white shadow-lg rounded-lg border border-slate-100 p-3 text-xs">
                      <p className="font-bold text-slate-700 mb-1">子載波 #{d.index}</p>
                      <p>振幅: <span className="font-mono font-bold">{d.amplitude.toFixed(1)}</span></p>
                      <p>NBVI: <span className="font-mono font-bold">{d.nbvi.toFixed(4)}</span></p>
                      <p className="mt-1">
                        {d.isGuard ? '⬜ Guard Band' : d.isDC ? '🟡 DC 子載波' : d.isSelected ? '🔵 已選中' : '⬜ 未選中'}
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="value" radius={[2, 2, 0, 0]} barSize={8}>
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fill={getBarColor(entry)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Selected Subcarriers List */}
      <div className="bg-white rounded-xl border border-slate-100 p-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-[#007AFF]" /> NBVI 選中的 12 個子載波
        </h3>
        <div className="flex flex-wrap gap-2">
          {Array.from(selected).sort((a, b) => a - b).map(idx => {
            const sub = subcarriers[idx];
            return (
              <div key={idx} className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5 text-xs">
                <span className="font-bold text-[#007AFF]">#{idx}</span>
                <span className="text-slate-400 ml-1.5">NBVI: {sub.nbvi.toFixed(4)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Algorithm Explanation */}
      <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
        <h3 className="text-sm font-bold text-blue-800 mb-1 flex items-center gap-2">
          <Info className="w-4 h-4" /> NBVI 子載波自動選擇演算法
        </h3>
        <p className="text-xs text-blue-700 leading-relaxed">
          <strong>NBVI (Normalized Baseline Variability Index)</strong> 會在校正階段分析每個子載波在無人狀態下的穩定度。
          公式：<code className="bg-blue-100 px-1 rounded">NBVI = α × (σ/μ²) + (1-α) × (σ/μ)</code>，其中 α = 0.5。
          選擇 NBVI 值最低的 12 個非連續子載波，確保頻譜多樣性與抗干擾能力。
          排除 Guard Band (0-10, 53-63) 和 DC 子載波 (#32)。
        </p>
      </div>
    </div>
  );
}
