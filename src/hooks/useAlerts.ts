import { useState, useEffect } from 'react';

const ALERTS_STORAGE_KEY = 'csi_alerts';

export interface AlertRecord {
  id: string;
  time: string;
  room: string;
  type: string;
  confidence: string;
  status: 'pending' | 'confirmed' | 'false_alarm';
  feedbackNote?: string;
}

export type FilterType = 'all' | 'pending' | 'confirmed' | 'false_alarm';

const defaultAlerts: AlertRecord[] = [
  { id: 'a1', time: '2026/03/27 11:42', room: '606 號房 - 浴室', type: '跌倒風險', confidence: '92%', status: 'pending' },
  { id: 'a2', time: '2026/03/26 20:15', room: '503 號房 - 床邊', type: '異常震盪', confidence: '85%', status: 'confirmed' },
  { id: 'a3', time: '2026/03/26 14:30', room: '交誼廳', type: '跌倒風險', confidence: '78%', status: 'false_alarm' },
  { id: 'a4', time: '2026/03/25 09:00', room: '502 號房 - 浴室', type: '異常震盪', confidence: '88%', status: 'confirmed' },
  { id: 'a5', time: '2026/03/24 16:45', room: '611 號房 - 走廊', type: '跌倒風險', confidence: '71%', status: 'false_alarm' },
  { id: 'a6', time: '2026/03/24 03:12', room: '609 號房 - 床邊', type: '異常震盪', confidence: '95%', status: 'pending' },
];

function loadAlerts(): AlertRecord[] {
  const saved = localStorage.getItem(ALERTS_STORAGE_KEY);
  if (saved) { try { return JSON.parse(saved); } catch { /* ignore */ } }
  return defaultAlerts;
}

function saveAlerts(alerts: AlertRecord[]) {
  localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(alerts));
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<AlertRecord[]>(loadAlerts());
  const [filterStatus, setFilterStatus] = useState<FilterType>('all');
  const [showSavedMsg, setShowSavedMsg] = useState(false);

  useEffect(() => { saveAlerts(alerts); }, [alerts]);

  const flash = () => {
    setShowSavedMsg(true);
    setTimeout(() => setShowSavedMsg(false), 2000);
  };

  const handleConfirm = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'confirmed' as const } : a));
    flash();
  };

  const handleFalseAlarm = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'false_alarm' as const } : a));
    flash();
  };

  const handleDelete = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const handleAddAlert = (alertData: { room: string, type: string, confidence: string }) => {
    if (!alertData.room.trim()) return;
    const now = new Date();
    const timeStr = \\/\/\ \:\\;
    const alert: AlertRecord = {
      id: 'a' + Date.now().toString(36),
      time: timeStr,
      room: alertData.room,
      type: alertData.type,
      confidence: alertData.confidence,
      status: 'pending'
    };
    setAlerts(prev => [alert, ...prev]);
    flash();
  };

  const filteredAlerts = alerts.filter(a => filterStatus === 'all' || a.status === filterStatus);
  const pendingCount = alerts.filter(a => a.status === 'pending').length;
  const confirmedCount = alerts.filter(a => a.status === 'confirmed').length;
  const falseAlarmCount = alerts.filter(a => a.status === 'false_alarm').length;
  const totalProcessed = confirmedCount + falseAlarmCount;
  const falseAlarmRate = totalProcessed > 0 ? Math.round((falseAlarmCount / totalProcessed) * 100) : 0;

  return {
    alerts,
    filteredAlerts,
    filterStatus,
    setFilterStatus,
    showSavedMsg,
    handleConfirm,
    handleFalseAlarm,
    handleDelete,
    handleAddAlert,
    pendingCount,
    confirmedCount,
    falseAlarmCount,
    totalProcessed,
    falseAlarmRate
  };
}
