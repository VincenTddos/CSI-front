import React, { useState, useEffect } from 'react';
import { MonitorSmartphone, Wifi, RefreshCw, Settings2, CheckCircle2, AlertCircle, Radio, Signal, Info, MapPin, Ruler, ShieldCheck, Activity, Zap } from 'lucide-react';
import { cn } from '../lib/utils';

interface DeviceNode {
  name: string;
  room: string;
  status: 'online' | 'offline';
  signal: number;
  cv: number;          // Coefficient of Variation
  baselineNoise: number;
  packetsPerSec: number;
}

const mockDevices: DeviceNode[] = [
  { name: 'CSI-Node-502', room: '502 號房', status: 'online', signal: -42, cv: 0.05, baselineNoise: 0.0012, packetsPerSec: 98 },
  { name: 'CSI-Node-503', room: '503 號房', status: 'online', signal: -48, cv: 0.08, baselineNoise: 0.0018, packetsPerSec: 95 },
  { name: 'CSI-Node-606', room: '606 號房', status: 'online', signal: -55, cv: 0.12, baselineNoise: 0.003, packetsPerSec: 88 },
  { name: 'CSI-Node-5F-Common', room: '5F 交誼廳', status: 'online', signal: -38, cv: 0.04, baselineNoise: 0.0008, packetsPerSec: 100 },
  { name: 'CSI-Node-609', room: '609 號房', status: 'offline', signal: -90, cv: 0, baselineNoise: 0, packetsPerSec: 0 },
];

type CalibPhase = 'idle' | 'gain_lock' | 'band_calibration' | 'done';

function getQuality(cv: number, pps: number): { label: string; color: string } {
  if (pps < 10) return { label: '離線', color: 'text-slate-400 bg-slate-100' };
  if (cv < 0.08 && pps > 90) return { label: '優', color: 'text-green-600 bg-green-50' };
  if (cv < 0.15 && pps > 70) return { label: '良', color: 'text-amber-600 bg-amber-50' };
  return { label: '差', color: 'text-red-600 bg-red-50' };
}

export function DeviceManagement() {
  // Calibration state
  const [calibPhase, setCalibPhase] = useState<CalibPhase>('idle');
  const [calibProgress, setCalibProgress] = useState(0);
  const [gainLockResult, setGainLockResult] = useState<{ agc: number; fft: number } | null>(null);
  const [selectedSubcarriers, setSelectedSubcarriers] = useState<number[]>([]);
  const [adaptiveThreshold, setAdaptiveThreshold] = useState<number | null>(null);

  const startCalibration = () => {
    if (calibPhase !== 'idle' && calibPhase !== 'done') return;
    setCalibPhase('gain_lock');
    setCalibProgress(0);
    setGainLockResult(null);
    setSelectedSubcarriers([]);
    setAdaptiveThreshold(null);

    // Phase 1: Gain Lock — 3 seconds
    let progress = 0;
    const gainInterval = setInterval(() => {
      progress += 100 / 30; // 30 ticks for 3 seconds
      setCalibProgress(Math.min(progress, 100));
      if (progress >= 100) {
        clearInterval(gainInterval);
        setGainLockResult({ agc: 42 + Math.round(Math.random() * 10), fft: -3 + Math.round(Math.random() * 3) });
        setCalibPhase('band_calibration');
        setCalibProgress(0);

        // Phase 2: Band Calibration — 7.5 seconds
        let bandProgress = 0;
        const bandInterval = setInterval(() => {
          bandProgress += 100 / 75;
          setCalibProgress(Math.min(bandProgress, 100));
          if (bandProgress >= 100) {
            clearInterval(bandInterval);
            const subs = Array.from({ length: 12 }, () => 12 + Math.floor(Math.random() * 40)).sort((a, b) => a - b);
            setSelectedSubcarriers(subs);
            setAdaptiveThreshold(parseFloat((0.001 + Math.random() * 0.005).toFixed(4)));
            setCalibPhase('done');
          }
        }, 100);
      }
    }, 100);
  };

  return (
    <div className="h-full flex flex-col space-y-5 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">區域管理</h1>
          <p className="text-sm text-slate-500 mt-1">CSI 感測器狀態、訊號品質與環境校正</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ===== 感測器列表 + CSI 品質 ===== */}
        <div className="bg-white rounded-xl border border-slate-100 p-5 flex flex-col gap-4">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <MonitorSmartphone className="w-4 h-4 text-slate-500" /> 感測器列表與訊號品質
          </h2>

          <div className="space-y-3">
            {mockDevices.map((device, i) => {
              const quality = getQuality(device.cv, device.packetsPerSec);
              return (
                <div key={i} className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                        device.status === 'online' ? "bg-green-50" : "bg-slate-200"
                      )}>
                        <Wifi className={cn("w-4 h-4", device.status === 'online' ? "text-green-500" : "text-slate-400")} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 text-sm">{device.name}</h3>
                        <p className="text-[10px] text-slate-500">{device.room}</p>
                      </div>
                    </div>
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", quality.color)}>
                      {quality.label}
                    </span>
                  </div>

                  {device.status === 'online' && (
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div>
                        <p className="text-[9px] text-slate-400 uppercase">RSSI</p>
                        <p className="text-xs font-mono font-bold text-slate-700">{device.signal} dBm</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-400 uppercase">CV 穩定度</p>
                        <p className={cn("text-xs font-mono font-bold", device.cv < 0.08 ? "text-green-600" : device.cv < 0.15 ? "text-amber-600" : "text-red-600")}>
                          {device.cv.toFixed(3)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-400 uppercase">基線噪音</p>
                        <p className="text-xs font-mono font-bold text-slate-700">{device.baselineNoise.toFixed(4)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-400 uppercase">封包/秒</p>
                        <p className={cn("text-xs font-mono font-bold", device.packetsPerSec > 90 ? "text-green-600" : device.packetsPerSec > 70 ? "text-amber-600" : "text-red-600")}>
                          {device.packetsPerSec}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ===== 兩階段校正 ===== */}
        <div className="flex flex-col gap-5">
          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-4">
              <Settings2 className="w-4 h-4 text-[#007AFF]" /> 兩階段環境校正
            </h2>

            {/* Phase indicators */}
            <div className="flex items-center gap-2 mb-4">
              <div className={cn("flex-1 p-2 rounded-lg border text-center text-xs font-medium",
                calibPhase === 'gain_lock' ? "bg-blue-50 border-blue-200 text-blue-700" :
                gainLockResult ? "bg-green-50 border-green-200 text-green-600" : "bg-slate-50 border-slate-200 text-slate-400"
              )}>
                Phase 1: Gain Lock
                {gainLockResult && <CheckCircle2 className="w-3 h-3 inline ml-1" />}
              </div>
              <div className="text-slate-300">→</div>
              <div className={cn("flex-1 p-2 rounded-lg border text-center text-xs font-medium",
                calibPhase === 'band_calibration' ? "bg-blue-50 border-blue-200 text-blue-700" :
                selectedSubcarriers.length > 0 ? "bg-green-50 border-green-200 text-green-600" : "bg-slate-50 border-slate-200 text-slate-400"
              )}>
                Phase 2: Band Calibration
                {selectedSubcarriers.length > 0 && <CheckCircle2 className="w-3 h-3 inline ml-1" />}
              </div>
            </div>

            {/* Current phase details */}
            {calibPhase === 'gain_lock' && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <p className="text-xs text-blue-700 font-medium mb-2">
                  <Zap className="w-3 h-3 inline mr-1" />
                  正在鎖定 AGC/FFT 增益... 收集 300 個封包的中位數
                </p>
                <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 transition-all" style={{ width: `${calibProgress}%` }} />
                </div>
                <p className="text-[10px] text-blue-500 mt-1 font-mono text-right">{Math.round(calibProgress)}%</p>
              </div>
            )}

            {calibPhase === 'band_calibration' && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <p className="text-xs text-blue-700 font-medium mb-2">
                  <Radio className="w-3 h-3 inline mr-1" />
                  NBVI 子載波校準中... 請保持房間無人
                </p>
                <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#007AFF] transition-all" style={{ width: `${calibProgress}%` }} />
                </div>
                <p className="text-[10px] text-blue-500 mt-1 font-mono text-right">{Math.round(calibProgress)}%</p>
              </div>
            )}

            {/* Results */}
            {gainLockResult && (
              <div className="mb-3 p-3 bg-green-50 border border-green-100 rounded-lg text-xs">
                <p className="font-bold text-green-700 mb-1">✓ Gain Lock 完成</p>
                <p className="text-green-600 font-mono">AGC: {gainLockResult.agc} | FFT: {gainLockResult.fft}</p>
              </div>
            )}
            {selectedSubcarriers.length > 0 && (
              <div className="mb-3 p-3 bg-green-50 border border-green-100 rounded-lg text-xs">
                <p className="font-bold text-green-700 mb-1">✓ Band Calibration 完成</p>
                <p className="text-green-600 font-mono">
                  選中子載波: [{selectedSubcarriers.join(', ')}]
                </p>
                {adaptiveThreshold && (
                  <p className="text-green-600 font-mono mt-1">自適應閾值 (P95×1.1): {adaptiveThreshold}</p>
                )}
              </div>
            )}

            <button onClick={startCalibration}
              disabled={calibPhase === 'gain_lock' || calibPhase === 'band_calibration'}
              className={cn("w-full py-2.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2",
                calibPhase === 'gain_lock' || calibPhase === 'band_calibration'
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                  : "bg-[#007AFF] hover:bg-[#0066CC] text-white"
              )}>
              {calibPhase === 'gain_lock' || calibPhase === 'band_calibration' ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> 校正中...</>
              ) : calibPhase === 'done' ? (
                '重新校正'
              ) : (
                '開始兩階段校正 (約 10.5 秒)'
              )}
            </button>

            <p className="text-[10px] text-slate-400 mt-2 text-center">
              Phase 1: Gain Lock ~3s (300 pkt) → Phase 2: NBVI Calibration ~7.5s (750 pkt)
            </p>
          </div>

          {/* ===== 擺放指南 ===== */}
          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-amber-500" /> 感測器最佳擺放指南
            </h2>

            <div className="space-y-3 text-xs">
              {/* Distance */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <p className="font-bold text-slate-700 mb-2 flex items-center gap-1">
                  <Ruler className="w-3 h-3 text-slate-500" /> 與路由器距離
                </p>
                <div className="flex items-center gap-1 mb-1">
                  <div className="flex-1 h-6 rounded-l-md bg-red-100 flex items-center justify-center text-red-500 font-bold">&lt;2m ❌</div>
                  <div className="flex-[2] h-6 bg-green-100 flex items-center justify-center text-green-600 font-bold">3-8m ✅ 最佳</div>
                  <div className="flex-1 h-6 rounded-r-md bg-red-100 flex items-center justify-center text-red-500 font-bold">&gt;10m ❌</div>
                </div>
              </div>

              {/* Height */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                  <p className="font-bold text-green-700 mb-1">✅ 建議</p>
                  <ul className="text-green-600 space-y-0.5 leading-relaxed">
                    <li>• 高度 1-1.5 公尺</li>
                    <li>• 桌面或牆面固定</li>
                    <li>• 使用外接天線</li>
                  </ul>
                </div>
                <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                  <p className="font-bold text-red-700 mb-1">❌ 避免</p>
                  <ul className="text-red-600 space-y-0.5 leading-relaxed">
                    <li>• 金屬障礙物遮擋</li>
                    <li>• 封閉角落或櫃內</li>
                    <li>• 靠近微波爐</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
