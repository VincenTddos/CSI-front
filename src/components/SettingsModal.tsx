import React from 'react';
import { X, Terminal, Bath, Sofa } from 'lucide-react';
import { useDeveloper, SceneMode } from '../contexts/DeveloperContext';
import { cn } from '../lib/utils';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { isDeveloperMode, setIsDeveloperMode, sceneMode, setSceneMode } = useDeveloper();

  if (!isOpen) return null;

  const handleSceneChange = (mode: SceneMode) => {
    setSceneMode(mode);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2C363F] flex items-center justify-center">
              <Terminal className="w-5 h-5 text-[#007AFF]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">系統設定</h3>
              <p className="text-xs text-slate-500">場景模式與開發者選項</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Scene Modes Section */}
          <section>
            <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              場景模式 (Scene Modes)
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleSceneChange('bathroom')}
                className={cn(
                  "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
                  sceneMode === 'bathroom' 
                    ? "border-[#007AFF] bg-[#007AFF]/5 text-[#007AFF]" 
                    : "border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200"
                )}
              >
                <Bath className="w-6 h-6" />
                <div className="text-center">
                  <p className="font-bold text-xs">浴室 (Bathroom)</p>
                  <p className="text-[10px] opacity-70">高靈敏度</p>
                </div>
              </button>

              <button
                onClick={() => handleSceneChange('living-room')}
                className={cn(
                  "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
                  sceneMode === 'living-room' 
                    ? "border-[#007AFF] bg-[#007AFF]/5 text-[#007AFF]" 
                    : "border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200"
                )}
              >
                <Sofa className="w-6 h-6" />
                <div className="text-center">
                  <p className="font-bold text-xs">客廳 (Living Room)</p>
                  <p className="text-[10px] opacity-70">寵物友善 / 低靈敏</p>
                </div>
              </button>
            </div>
          </section>

          {/* Developer Mode Section */}
          <section className="pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50">
              <div>
                <h4 className="font-bold text-slate-800 text-sm">開發者模式 (Developer Mode)</h4>
                <p className="text-xs text-slate-500 mt-0.5">啟用後將停用網路請求並使用模擬數據</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={isDeveloperMode}
                  onChange={(e) => setIsDeveloperMode(e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#007AFF]"></div>
              </label>
            </div>

            {isDeveloperMode && (
              <div className="mt-4 p-4 rounded-2xl bg-amber-50 border border-amber-100">
                <h5 className="text-xs font-bold text-amber-800 mb-1">提示：</h5>
                <p className="text-[10px] text-amber-700 leading-relaxed">
                  啟用開發者模式後，您可以透過點擊螢幕左上角與右上角的隱藏區域，手動切換「安全」與「跌倒」狀態。
                </p>
              </div>
            )}
          </section>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100">
          <button 
            onClick={onClose}
            className="w-full bg-[#2C363F] hover:bg-slate-800 text-white font-bold py-3 rounded-xl shadow-lg transition-all active:scale-95"
          >
            完成設定
          </button>
        </div>
      </div>
    </div>
  );
}
