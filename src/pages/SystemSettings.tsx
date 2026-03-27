import React, { useState } from 'react';
import { Settings, MessageSquare, SlidersHorizontal, Save, ShieldCheck, Terminal, Shield, Download, FileJson, FileText, Lock, Eye, EyeOff, BrainCircuit, Gauge, Zap } from 'lucide-react';
import { SettingsModal } from '../components/SettingsModal';
import { cn } from '../lib/utils';

type DetectionAlgorithm = 'mvs' | 'ml';
type ThresholdMode = 'auto' | 'min' | 'manual';

export function SystemSettings() {
  const [sensitivity, setSensitivity] = useState(75);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [algorithm, setAlgorithm] = useState<DetectionAlgorithm>('mvs');
  const [thresholdMode, setThresholdMode] = useState<ThresholdMode>('auto');
  const [manualThreshold, setManualThreshold] = useState('0.003');
  const [showToken, setShowToken] = useState(false);
  const [showSavedMsg, setShowSavedMsg] = useState(false);

  const flash = () => { setShowSavedMsg(true); setTimeout(() => setShowSavedMsg(false), 2000); };

  return (
    <div className="h-full flex flex-col space-y-5 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">系統設定</h1>
          <p className="text-sm text-slate-500 mt-1">全域參數、AI 演算法與第三方整合</p>
        </div>
        <button onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg transition-all text-sm font-medium">
          <Terminal className="w-4 h-4" /> 開發者選項
        </button>
      </div>

      {showSavedMsg && (
        <div className="p-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-xs max-w-xs">✓ 設定已儲存</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ===== 偵測演算法切換 ===== */}
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-4">
            <BrainCircuit className="w-4 h-4 text-[#007AFF]" /> 偵測演算法選擇
          </h2>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <button onClick={() => setAlgorithm('mvs')}
              className={cn("p-4 rounded-xl border text-left transition-all",
                algorithm === 'mvs' ? "bg-blue-50 border-[#007AFF] ring-2 ring-[#007AFF]/20" : "bg-slate-50 border-slate-200 hover:border-slate-300"
              )}>
              <div className="flex items-center gap-2 mb-2">
                <Gauge className="w-4 h-4 text-[#007AFF]" />
                <span className="text-sm font-bold text-slate-800">MVS 模式</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">Moving Variance Segmentation — 傳統數學方法，需要校正 (10.5秒)，穩定可靠</p>
            </button>
            <button onClick={() => setAlgorithm('ml')}
              className={cn("p-4 rounded-xl border text-left transition-all relative overflow-hidden",
                algorithm === 'ml' ? "bg-purple-50 border-purple-400 ring-2 ring-purple-400/20" : "bg-slate-50 border-slate-200 hover:border-slate-300"
              )}>
              <span className="absolute top-1 right-1 text-[8px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-bold">實驗性</span>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-bold text-slate-800">ML 模式</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">Neural Network MLP 12→16→8→1 — 免校正，3 秒啟動，F1 97-100%</p>
            </button>
          </div>

          {/* Comparison table */}
          <div className="border border-slate-100 rounded-lg overflow-hidden text-[10px]">
            <table className="w-full">
              <thead><tr className="bg-slate-50">
                <th className="text-left px-3 py-1.5 text-slate-400 font-bold"></th>
                <th className="text-center px-3 py-1.5 text-[#007AFF] font-bold">MVS</th>
                <th className="text-center px-3 py-1.5 text-purple-500 font-bold">ML</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                <tr><td className="px-3 py-1.5 text-slate-500">需要校正</td><td className="text-center">✅ 10.5 秒</td><td className="text-center">❌ 免校正</td></tr>
                <tr><td className="px-3 py-1.5 text-slate-500">子載波選擇</td><td className="text-center">NBVI 自動</td><td className="text-center">12 個固定</td></tr>
                <tr><td className="px-3 py-1.5 text-slate-500">閾值</td><td className="text-center">自適應 P95×1.1</td><td className="text-center">固定 0.5</td></tr>
                <tr><td className="px-3 py-1.5 text-slate-500">F1 Score</td><td className="text-center">&gt;96%</td><td className="text-center font-bold text-purple-600">97-100%</td></tr>
                <tr><td className="px-3 py-1.5 text-slate-500">啟動時間</td><td className="text-center">~10.5s</td><td className="text-center font-bold text-purple-600">~3s</td></tr>
                <tr><td className="px-3 py-1.5 text-slate-500">參數量</td><td className="text-center">—</td><td className="text-center">353 (~1.4KB)</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ===== 閾值即時調整 ===== */}
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-4">
            <SlidersHorizontal className="w-4 h-4 text-[#007AFF]" /> 閾值微調面板
          </h2>

          {algorithm === 'ml' ? (
            <div className="p-4 bg-purple-50 border border-purple-100 rounded-lg text-xs text-purple-700">
              <p className="font-bold mb-1">ML 模式使用固定閾值</p>
              <p>ML 偵測器使用 sigmoid 輸出，機率 &gt; 0.5 判定為 MOTION，無需手動調整。</p>
            </div>
          ) : (
            <>
              {/* Threshold mode */}
              <div className="flex gap-2 mb-4">
                {([
                  { key: 'auto', label: 'Auto (P95×1.1)', desc: '平衡模式' },
                  { key: 'min', label: 'Min (P100)', desc: '最大靈敏' },
                  { key: 'manual', label: '手動', desc: '自訂閾值' },
                ] as { key: ThresholdMode; label: string; desc: string }[]).map(mode => (
                  <button key={mode.key} onClick={() => setThresholdMode(mode.key)}
                    className={cn("flex-1 p-2 rounded-lg border text-xs transition-all",
                      thresholdMode === mode.key ? "bg-blue-50 border-[#007AFF] text-[#007AFF]" : "bg-slate-50 border-slate-200 text-slate-500"
                    )}>
                    <p className="font-bold">{mode.label}</p>
                    <p className="text-[9px] mt-0.5">{mode.desc}</p>
                  </button>
                ))}
              </div>

              {thresholdMode === 'manual' && (
                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-500 mb-1">手動閾值 (移動方差)</label>
                  <input type="text" value={manualThreshold}
                    onChange={e => setManualThreshold(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] outline-none" />
                </div>
              )}

              {/* Sensitivity slider */}
              <div className="p-4 rounded-xl border border-[#007AFF]/20 bg-[#007AFF]/5 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-bold text-[#007AFF] text-sm flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" /> 偵測靈敏度
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">調整 CSI 訊號變化的敏感度</p>
                  </div>
                  <span className="text-xl font-mono font-bold text-[#007AFF]">{sensitivity}%</span>
                </div>
                <input type="range" min="0" max="100" value={sensitivity}
                  onChange={e => setSensitivity(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#007AFF]" />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>低靈敏 (減少誤報)</span>
                  <span>高靈敏 (減少漏報)</span>
                </div>
              </div>

              {/* AI learning toggles */}
              <div className="space-y-2">
                {[
                  { label: '自動環境噪聲過濾', desc: '根據「誤報回饋」調整背景雜訊模型' },
                  { label: 'Hampel 離群值過濾', desc: 'MAD 方法移除突發干擾 (預設關閉)' },
                  { label: '低通濾波器 (11Hz)', desc: '過濾高頻噪音，保留人體運動信號' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50">
                    <div>
                      <h4 className="font-medium text-slate-700 text-xs">{item.label}</h4>
                      <p className="text-[10px] text-slate-400">{item.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked={i === 0} />
                      <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#007AFF]"></div>
                    </label>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ===== LINE 整合 ===== */}
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-4">
            <MessageSquare className="w-4 h-4 text-[#00C300]" /> LINE Notify 設定
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">LINE Token</label>
              <div className="relative">
                <input type={showToken ? "text" : "password"} defaultValue="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-3 py-2 pr-10 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#00C300]/20 focus:border-[#00C300] outline-none text-sm font-mono" />
                <button onClick={() => setShowToken(!showToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1">
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50">
              <div>
                <h4 className="font-medium text-slate-700 text-xs">啟用推播通知</h4>
                <p className="text-[10px] text-slate-400">偵測到高風險事件時立即通知</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#00C300]"></div>
              </label>
            </div>

            <button onClick={flash}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2">
              <Save className="w-4 h-4" /> 儲存 LINE 設定
            </button>
          </div>
        </div>

        {/* ===== 隱私與安全 + 匯出格式 ===== */}
        <div className="flex flex-col gap-5">
          {/* Privacy */}
          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-green-500" /> 隱私與安全聲明
            </h2>
            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex items-start gap-2 p-2 bg-green-50 rounded-lg border border-green-100">
                <Lock className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
                <p>CSI 資料僅收集 Wi-Fi 頻通道的<strong>物理特徵</strong>（振幅與相位），<strong>不含</strong>任何個人身分、通訊內容、影像或音訊。</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 text-center">
                  <p className="text-[10px] text-slate-400">攝影機</p>
                  <p className="font-bold text-green-600">❌ 無</p>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 text-center">
                  <p className="text-[10px] text-slate-400">麥克風</p>
                  <p className="font-bold text-green-600">❌ 無</p>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 text-center">
                  <p className="text-[10px] text-slate-400">穿戴裝置</p>
                  <p className="font-bold text-green-600">❌ 無</p>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                本系統應在取得受監護者<strong>明確同意</strong>後使用，且需遵守當地隱私法規 (如 GDPR)。
                僅限於合法用途：居家安全、個人健康監護等。
              </p>
            </div>
          </div>

          {/* Export formats */}
          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-3">
              <Download className="w-4 h-4 text-slate-500" /> 資料匯出格式
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <button className="p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 transition-colors text-left">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-green-600" />
                  <span className="text-xs font-bold text-slate-700">CSV</span>
                </div>
                <p className="text-[10px] text-slate-400">子載波振幅 + 跌倒標記</p>
              </button>
              <button className="p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 transition-colors text-left">
                <div className="flex items-center gap-2 mb-1">
                  <FileJson className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-bold text-slate-700">JSON</span>
                </div>
                <p className="text-[10px] text-slate-400">結構化健康紀錄 + 警報</p>
              </button>
            </div>
          </div>
        </div>
      </div>

      <SettingsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
