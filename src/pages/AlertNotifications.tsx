import React from 'react';
import { BellRing, Check, X, Clock, AlertTriangle, MessageSquare } from 'lucide-react';
import { cn } from '../lib/utils';

export function AlertNotifications() {
  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">警報通知</h1>
          <p className="text-slate-500 text-sm mt-1">歷史紀錄與 AI 學習回饋</p>
        </div>
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-100">
          <MessageSquare className="w-4 h-4 text-[#00C300]" />
          <span className="text-sm font-bold text-slate-700">LINE 緊急推播：已啟用</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <BellRing className="w-5 h-5 text-[#FF3B30]" />
            近期警報紀錄
          </h2>
          <p className="text-xs font-medium text-[#007AFF] bg-[#007AFF]/10 px-3 py-1.5 rounded-lg">
            您的回饋將協助 AI 優化環境噪聲過濾
          </p>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
          {[
            { id: 1, time: '今天 11:42 AM', room: '204 號房 - 浴室', type: '跌倒風險', confidence: '92%', status: 'pending' },
            { id: 2, time: '昨天 08:15 PM', room: '205 號房 - 床邊', type: '異常震盪', confidence: '85%', status: 'confirmed' },
            { id: 3, time: '昨天 02:30 PM', room: '交誼廳', type: '跌倒風險', confidence: '78%', status: 'false_alarm' },
            { id: 4, time: '10/24 09:00 AM', room: '204 號房 - 浴室', type: '異常震盪', confidence: '88%', status: 'confirmed' },
          ].map((alert) => (
            <div key={alert.id} className={cn(
              "rounded-xl p-5 border transition-all",
              alert.status === 'pending' ? "bg-red-50/50 border-red-100 shadow-sm" : "bg-slate-50 border-slate-100"
            )}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-1",
                    alert.status === 'pending' ? "bg-[#FF3B30]/10" : "bg-slate-200"
                  )}>
                    <AlertTriangle className={cn("w-5 h-5", alert.status === 'pending' ? "text-[#FF3B30]" : "text-slate-400")} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={cn("font-bold", alert.status === 'pending' ? "text-slate-800" : "text-slate-600")}>
                        {alert.type}
                      </h3>
                      <span className="text-xs font-mono font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                        吻合度 {alert.confidence}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm font-medium text-slate-500">
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {alert.time}</span>
                      <span>•</span>
                      <span>{alert.room}</span>
                    </div>
                  </div>
                </div>

                {/* Feedback Mechanism */}
                <div className="flex items-center gap-2 md:ml-auto">
                  {alert.status === 'pending' ? (
                    <>
                      <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#34C759]/10 hover:bg-[#34C759]/20 text-[#34C759] text-sm font-bold transition-colors border border-[#34C759]/20">
                        <Check className="w-4 h-4" /> 確認為意外
                      </button>
                      <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold transition-colors border border-slate-200">
                        <X className="w-4 h-4" /> 誤報，忽略
                      </button>
                    </>
                  ) : (
                    <span className={cn(
                      "text-sm font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5",
                      alert.status === 'confirmed' ? "text-[#34C759] bg-[#34C759]/10" : "text-slate-500 bg-slate-200"
                    )}>
                      {alert.status === 'confirmed' ? <><Check className="w-4 h-4" /> 已確認</> : <><X className="w-4 h-4" /> 已標記為誤報</>}
                    </span>
                  )}
                </div>

              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
