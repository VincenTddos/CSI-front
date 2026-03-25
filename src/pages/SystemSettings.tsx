import React, { useState } from 'react';
import { Settings, MessageSquare, SlidersHorizontal, Save, ShieldCheck, Terminal } from 'lucide-react';
import { SettingsModal } from '../components/SettingsModal';
import { cn } from '../lib/utils';

export function SystemSettings() {
  const [sensitivity, setSensitivity] = useState(75);
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">系統設定</h1>
          <p className="text-slate-500 text-sm mt-1">全域參數與第三方整合</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-xl transition-all active:scale-95"
        >
          <Terminal className="w-4 h-4" />
          <span className="text-sm font-bold">開發者選項</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
        
        {/* LINE Integration */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col gap-6">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#00C300]" />
            LINE Notify 設定
          </h2>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">LINE Token</label>
              <input
                type="password"
                defaultValue="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#00C300]/20 focus:border-[#00C300] transition-all outline-none text-slate-700 font-mono text-sm"
              />
              <p className="text-xs text-slate-500 mt-2">
                用於發送緊急跌倒警報至指定的 LINE 群組或個人。
              </p>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50">
              <div>
                <h4 className="font-bold text-slate-800 text-sm">啟用推播通知</h4>
                <p className="text-xs text-slate-500 mt-0.5">當偵測到高風險事件時立即通知</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00C300]"></div>
              </label>
            </div>

            <button className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2">
              <Save className="w-4 h-4" /> 儲存 LINE 設定
            </button>
          </div>
        </div>

        {/* AI Parameters */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col gap-6">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-[#007AFF]" />
            AI 參數調整
          </h2>

          <div className="space-y-6">
            <div className="p-5 rounded-xl border border-[#007AFF]/20 bg-[#007AFF]/5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-bold text-[#007AFF] text-sm flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" /> 跌倒偵測靈敏度閾值
                  </h4>
                  <p className="text-xs text-slate-600 mt-1">
                    調整 espectre 系統對 CSI 訊號變化的敏感度。
                  </p>
                </div>
                <span className="text-2xl font-mono font-bold text-[#007AFF]">{sensitivity}%</span>
              </div>

              <input 
                type="range" 
                min="0" 
                max="100" 
                value={sensitivity}
                onChange={(e) => setSensitivity(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#007AFF]"
              />
              
              <div className="flex justify-between text-xs font-medium text-slate-500 mt-2">
                <span>低靈敏 (減少誤報)</span>
                <span>高靈敏 (減少漏報)</span>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-slate-800 text-sm">進階學習機制</h4>
              
              <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">自動環境噪聲過濾</h4>
                  <p className="text-xs text-slate-500 mt-0.5">根據「誤報回饋」自動調整背景雜訊模型</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#007AFF]"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">Gemini 協同分析</h4>
                  <p className="text-xs text-slate-500 mt-0.5">啟用大型語言模型進行複雜場景判斷</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#007AFF]"></div>
                </label>
              </div>
            </div>

          </div>
        </div>

      </div>
      
      <SettingsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
