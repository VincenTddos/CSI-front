import React, { useState, useEffect } from 'react';
import { BellRing, Check, X, Clock, AlertTriangle, MessageSquare, Filter, Plus, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useUser } from '../contexts/UserContext';
import {
  listAlerts, createAlert, updateAlertStatus, deleteAlert, subscribeNewAlerts,
} from '../services/alertsService';
import type { FallEventRow } from '../services/database.types';

// ===== Types（顯示用）=====
interface AlertRecord {
  id: string;
  time: string;
  room: string;
  type: string;
  confidence: string;
  status: 'pending' | 'confirmed' | 'false_alarm';
  feedbackNote?: string;
}

// FallEventRow（資料庫）→ AlertRecord（顯示）
function rowToRecord(r: FallEventRow): AlertRecord {
  const d = new Date(r.detected_at);
  const time = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const room = (r.location_x != null && r.location_y != null)
    ? `(${r.location_x.toFixed(1)}, ${r.location_y.toFixed(1)}) m`
    : '感測區';
  return {
    id: r.id,
    time,
    room,
    type: r.event_type || '跌倒風險',
    confidence: r.confidence != null ? `${Math.round(r.confidence)}%` : 'N/A',
    status: r.status,
    feedbackNote: r.feedback_note ?? undefined,
  };
}

type FilterType = 'all' | 'pending' | 'confirmed' | 'false_alarm';

export function AlertNotifications() {
  const { user } = useUser();
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [filterStatus, setFilterStatus] = useState<FilterType>('all');
  const [showSavedMsg, setShowSavedMsg] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAlert, setNewAlert] = useState({ room: '', type: '跌倒風險', confidence: '80%' });

  // 載入 + 即時訂閱新警報
  useEffect(() => {
    listAlerts().then(rows => setAlerts(rows.map(rowToRecord))).catch(e => console.error('[Alerts]', e));
    const unsub = subscribeNewAlerts(row => setAlerts(prev => [rowToRecord(row), ...prev]));
    return unsub;
  }, []);

  const handleConfirm = async (id: string) => {
    await updateAlertStatus(id, 'confirmed');
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'confirmed' as const } : a));
    flash();
  };

  const handleFalseAlarm = async (id: string) => {
    await updateAlertStatus(id, 'false_alarm');
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'false_alarm' as const } : a));
    flash();
  };

  const handleDelete = async (id: string) => {
    await deleteAlert(id);
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const handleAddAlert = async () => {
    if (!newAlert.room.trim()) return;
    const created = await createAlert({
      event_type: newAlert.type,
      confidence: parseInt(newAlert.confidence, 10) || 80,
      status: 'pending',
      detected_at: new Date().toISOString(),
    });
    setAlerts(prev => [rowToRecord(created), ...prev]);
    setShowAddModal(false);
    setNewAlert({ room: '', type: '跌倒風險', confidence: '80%' });
    flash();
  };

  const flash = () => {
    setShowSavedMsg(true);
    setTimeout(() => setShowSavedMsg(false), 2000);
  };

  const filteredAlerts = alerts.filter(a => filterStatus === 'all' || a.status === filterStatus);

  const pendingCount = alerts.filter(a => a.status === 'pending').length;
  const confirmedCount = alerts.filter(a => a.status === 'confirmed').length;
  const falseAlarmCount = alerts.filter(a => a.status === 'false_alarm').length;

  // AI feedback summary
  const totalProcessed = confirmedCount + falseAlarmCount;
  const falseAlarmRate = totalProcessed > 0 ? Math.round((falseAlarmCount / totalProcessed) * 100) : 0;

  return (
    <div className="h-full flex flex-col space-y-5">
      {/* 頂部標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">警報通知</h1>
          <p className="text-sm text-slate-500 mt-1">管理感測器警報紀錄，您的回饋將幫助 AI 優化未來的偵測準確度</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-100 text-sm">
            <MessageSquare className="w-4 h-4 text-[#00C300]" />
            <span className="font-medium text-slate-700">LINE 推播：已啟用</span>
          </div>
          {user?.role !== 'family' && (
            <button onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-[#007AFF] hover:bg-[#0066CC] text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium">
              <Plus className="w-4 h-4" /> 手動新增
            </button>
          )}
        </div>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-100 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <p className="text-xs text-slate-500">待處理</p>
            <p className="text-lg font-bold text-red-600">{pendingCount}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
            <Check className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <p className="text-xs text-slate-500">已確認</p>
            <p className="text-lg font-bold text-green-600">{confirmedCount}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center">
            <X className="w-5 h-5 text-slate-400" />
          </div>
          <div>
            <p className="text-xs text-slate-500">誤報</p>
            <p className="text-lg font-bold text-slate-600">{falseAlarmCount}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-blue-100 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <BellRing className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p className="text-xs text-slate-500">AI 誤報率</p>
            <p className="text-lg font-bold text-blue-600">{falseAlarmRate}%</p>
          </div>
        </div>
      </div>

      {/* AI 學習回饋 */}
      <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
        <h3 className="text-sm font-bold text-blue-800 mb-1">🤖 AI 學習回饋</h3>
        <p className="text-xs text-blue-700 leading-relaxed">
          目前共有 <strong>{totalProcessed}</strong> 筆已處理的警報回饋。
          {falseAlarmRate > 30
            ? ` 誤報率為 ${falseAlarmRate}%，偏高。AI 正在學習您標記的誤報模式（如環境噪音、正常活動），持續標記可降低未來的誤判。`
            : falseAlarmRate > 0
            ? ` 誤報率為 ${falseAlarmRate}%，表現良好。AI 正根據您的回饋持續調整震盪閾值與環境噪音過濾器。`
            : ' 尚無足夠資料計算誤報率。請持續對待處理的警報進行「確認」或「誤報」標記，以幫助 AI 學習。'
          }
        </p>
      </div>

      {/* 篩選列 */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-slate-400" />
        <span className="text-xs text-slate-500 mr-1">篩選：</span>
        {([
          ['all', '全部'],
          ['pending', '待處理'],
          ['confirmed', '已確認'],
          ['false_alarm', '誤報']
        ] as [FilterType, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setFilterStatus(key)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium transition-colors",
              filterStatus === key ? "bg-[#007AFF] text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            )}>
            {label}
          </button>
        ))}
      </div>

      {/* 儲存提示 */}
      {showSavedMsg && (
        <div className="p-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-xs max-w-xs">
          ✓ 已更新，AI 回饋同步計算
        </div>
      )}

      {/* 警報列表 */}
      <div className="flex-1 bg-white rounded-xl border border-slate-100 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredAlerts.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-sm">
              {filterStatus === 'all' ? '目前沒有警報紀錄' : `沒有「${filterStatus === 'pending' ? '待處理' : filterStatus === 'confirmed' ? '已確認' : '誤報'}」的警報`}
            </div>
          )}
          {filteredAlerts.map(alert => (
            <div key={alert.id} className={cn(
              "rounded-xl p-4 border transition-all",
              alert.status === 'pending' ? "bg-red-50/40 border-red-100" : "bg-slate-50/50 border-slate-100"
            )}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                    alert.status === 'pending' ? "bg-red-100" : "bg-slate-200"
                  )}>
                    <AlertTriangle className={cn("w-4 h-4", alert.status === 'pending' ? "text-red-500" : "text-slate-400")} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className={cn("font-bold text-sm", alert.status === 'pending' ? "text-slate-800" : "text-slate-600")}>
                        {alert.type}
                      </h3>
                      <span className="text-[10px] font-mono font-bold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                        吻合度 {alert.confidence}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {alert.time}</span>
                      <span>•</span>
                      <span>{alert.room}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 md:ml-auto">
                  {alert.status === 'pending' ? (
                    <>
                      <button onClick={() => handleConfirm(alert.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 text-xs font-bold transition-colors border border-green-200">
                        <Check className="w-3.5 h-3.5" /> 確認為意外
                      </button>
                      <button onClick={() => handleFalseAlarm(alert.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-colors border border-slate-200">
                        <X className="w-3.5 h-3.5" /> 誤報
                      </button>
                    </>
                  ) : (
                    <span className={cn(
                      "text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1",
                      alert.status === 'confirmed' ? "text-green-600 bg-green-50" : "text-slate-500 bg-slate-100"
                    )}>
                      {alert.status === 'confirmed' ? <><Check className="w-3.5 h-3.5" /> 已確認</> : <><X className="w-3.5 h-3.5" /> 已標記誤報</>}
                    </span>
                  )}
                  <button onClick={() => handleDelete(alert.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors" title="刪除">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 手動新增 Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50">
              <h3 className="text-base font-bold text-slate-800">手動新增警報</h3>
              <p className="text-xs text-slate-500 mt-0.5">模擬感測器觸發的警報紀錄</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">地點 *</label>
                <input type="text" value={newAlert.room}
                  onChange={e => setNewAlert({ ...newAlert, room: e.target.value })}
                  placeholder="例如：606 號房 - 浴室"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">類型</label>
                <select value={newAlert.type} onChange={e => setNewAlert({ ...newAlert, type: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] outline-none">
                  <option value="跌倒風險">跌倒風險</option>
                  <option value="異常震盪">異常震盪</option>
                  <option value="長時間無活動">長時間無活動</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">AI 吻合度</label>
                <select value={newAlert.confidence} onChange={e => setNewAlert({ ...newAlert, confidence: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] outline-none">
                  <option value="95%">95%</option>
                  <option value="90%">90%</option>
                  <option value="85%">85%</option>
                  <option value="80%">80%</option>
                  <option value="75%">75%</option>
                  <option value="70%">70%</option>
                </select>
              </div>
            </div>
            <div className="p-5 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50">取消</button>
              <button onClick={handleAddAlert} disabled={!newAlert.room.trim()}
                className="flex-1 px-4 py-2 rounded-lg bg-[#007AFF] text-white text-sm font-medium hover:bg-[#0066CC] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> 新增警報
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
