import React, { useState } from 'react';
import { MonitorSmartphone, Wifi, RefreshCw, Settings2, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

export function DeviceManagement() {
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);

  const startCalibration = () => {
    if (isCalibrating) return;
    setIsCalibrating(true);
    setCalibrationProgress(0);

    const interval = setInterval(() => {
      setCalibrationProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setIsCalibrating(false), 1000);
          return 100;
        }
        return prev + (100 / 30); // 30 seconds total
      });
    }, 1000);
  };

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">設備管理</h1>
          <p className="text-slate-500 text-sm mt-1">CSI 感測器狀態與校正</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
        
        {/* Device List & Status */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col gap-6">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <MonitorSmartphone className="w-5 h-5 text-[#2C363F]" />
            感測器列表
          </h2>

          <div className="space-y-4 flex-1 overflow-y-auto pr-2">
            {[
              { name: 'CSI-Node-204', room: '204 號房', status: 'online', signal: -45 },
              { name: 'CSI-Node-205', room: '205 號房', status: 'online', signal: -52 },
              { name: 'CSI-Node-Living', room: '交誼廳', status: 'offline', signal: -90 },
            ].map((device, i) => (
              <div key={i} className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center justify-between hover:border-[#007AFF]/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                    device.status === 'online' ? "bg-[#34C759]/10" : "bg-slate-200"
                  )}>
                    <Wifi className={cn("w-5 h-5", device.status === 'online' ? "text-[#34C759]" : "text-slate-400")} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">{device.name}</h3>
                    <p className="text-xs text-slate-500 font-medium">{device.room}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs text-slate-500 font-medium mb-1">訊號強度 (RSSI)</p>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className={cn("h-full rounded-full", device.signal > -60 ? "bg-[#34C759]" : device.signal > -80 ? "bg-[#FFCC00]" : "bg-[#FF3B30]")}
                          style={{ width: `${Math.max(0, 100 - Math.abs(device.signal))}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-700">{device.signal} dBm</span>
                    </div>
                  </div>
                  <button className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-400 hover:text-slate-700" title="重啟設備">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Calibration & Settings */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col gap-6">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-[#007AFF]" />
            環境基準線校正 (Baseline Calibration)
          </h2>
          
          <div className="bg-blue-50/50 rounded-xl p-5 border border-blue-100">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="w-5 h-5 text-[#007AFF] shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-slate-800 text-sm">為什麼需要校正？</h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  espectre 系統需要知道無人狀態下的背景 Wi-Fi 訊號特徵。當環境發生重大改變（如移動大型傢俱）時，請重新執行校正以確保 AI 判斷的準確性。
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <button 
                onClick={startCalibration}
                disabled={isCalibrating}
                className={cn(
                  "w-full py-3 rounded-xl font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2",
                  isCalibrating 
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                    : "bg-[#007AFF] hover:bg-blue-600 text-white shadow-md hover:shadow-lg"
                )}
              >
                {isCalibrating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    校正中... 請保持房間無人
                  </>
                ) : (
                  <>開始校正 (需 30 秒)</>
                )}
              </button>

              {isCalibrating && (
                <div className="space-y-2 animate-in fade-in duration-300">
                  <div className="flex justify-between text-xs font-medium text-slate-500 font-mono">
                    <span>掃描空房間訊號</span>
                    <span>{Math.round(calibrationProgress)}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#007AFF] transition-all duration-1000 ease-linear"
                      style={{ width: `${calibrationProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {calibrationProgress === 100 && !isCalibrating && (
                <div className="flex items-center gap-2 text-[#34C759] text-sm font-bold justify-center animate-in fade-in zoom-in duration-300">
                  <CheckCircle2 className="w-5 h-5" />
                  校正完成，AI 基準線已更新
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
