import React, { useState, useEffect, useRef } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import { 
  CheckCircle2, 
  AlertTriangle, 
  User, 
  MapPin, 
  ChevronDown, 
  Info, 
  Activity, 
  BrainCircuit, 
  Loader2,
  Download,
  Calendar,
  Clock,
  X,
  Wifi,
  WifiOff,
  LayoutGrid,
  Waves,
  Signal,
  Radio
} from 'lucide-react';
import { useDeveloper } from '../contexts/DeveloperContext';
import { useUser } from '../contexts/UserContext';
import { useCSIWebSocket } from '../hooks/useCSIWebSocket';
import { cn } from '../lib/utils';
import { RoomGrid, RoomStatus } from '../components/RoomGrid';
import { RoomDetailPanel } from '../components/RoomDetailPanel';
import { usePatients } from '../hooks/usePatients';
import { askGemini } from '../services/geminiService';

// 波形圖的單一資料點：movement = 真實移動強度分數 (0–100)，
// 來自 ESPectre 韌體把所有 CSI 子載波算完後輸出的 mvmt（非合成假資料）。
type WaveformPoint = {
  time: number;
  movement: number;
};

const clampScore = (score: number) => Math.min(100, Math.max(0, Math.round(score)));

// CSI 連結品質分級（給照護人員判讀，不需懂技術名詞）
type LinkTone = 'good' | 'warn' | 'bad';
const TONE_CLASS: Record<LinkTone, string> = {
  good: 'bg-emerald-50 text-emerald-600',
  warn: 'bg-amber-50 text-amber-600',
  bad: 'bg-red-50 text-red-600',
};
// 封包率（每秒筆數）：越高越即時穩定
const pktQuality = (n: number): { word: string; tone: LinkTone } =>
  n >= 80 ? { word: '良好', tone: 'good' } : n >= 40 ? { word: '普通', tone: 'warn' } : { word: '偏低', tone: 'bad' };
// 訊號強度（dBm，負值越接近 0 越強）
const rssiQuality = (n: number): { word: string; tone: LinkTone } =>
  n >= -60 ? { word: '良好', tone: 'good' } : n >= -75 ? { word: '普通', tone: 'warn' } : { word: '偏弱', tone: 'bad' };

const generateSimulatedMovementScore = (
  time: number,
  isFall: boolean,
  sensitivity: number,
  manualState: 'safe' | 'fall' | null
) => {
  if (isFall) {
    return clampScore(88 + Math.sin(time / 2) * 5 + Math.random() * 7);
  }

  if (manualState === 'safe') {
    return clampScore(8 + Math.sin(time / 12) * 4 + Math.random() * 6);
  }

  const base = 12 + sensitivity * 18;
  const walkingPulse = Math.max(0, Math.sin(time / 8)) * (18 + sensitivity * 16);
  const noise = (Math.random() - 0.5) * (10 + sensitivity * 14);
  return clampScore(base + walkingPulse + noise);
};

export function RealtimeMonitoring() {
  const { user } = useUser();
  const [data, setData] = useState<any[]>([]);
  const [isFallDetected, setIsFallDetected] = useState(false);
  const [showAiPopup, setShowAiPopup] = useState(false);
  const [selectedArea, setSelectedArea] = useState(user?.role === 'family' ? `${user.patientName} 的房間` : '204 號房');
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingResult, setThinkingResult] = useState<string | null>(null);
  const [fullHistory, setFullHistory] = useState<any[]>([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [movementScore, setMovementScore] = useState(0);
  const [showLinkHelp, setShowLinkHelp] = useState(false);
  const [harActivity, setHarActivity] = useState<{ label: string; confidence: number; icon: string }>({ label: '待機', confidence: 0, icon: '⏸️' });
  const [rightTab, setRightTab] = useState<'floorplan' | 'rooms'>('floorplan');
  const [selectedRoom, setSelectedRoom] = useState<RoomStatus | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [holdSimulatedFallMarker, setHoldSimulatedFallMarker] = useState(false);
  const { isDeveloperMode, manualState, sensitivity, waveformSmoothing } = useDeveloper();

  // -- WebSocket hook: 接收 core_bridge.py 的即時數據 --
  const { isConnected, dataStale, bridgeStatus, locationData } = useCSIWebSocket();
  const { patients } = usePatients();

  // isConnected = WebSocket 到 bridge 通了；isHardwareOnline = ESP32 板子實際有插著
  const isHardwareOnline = isConnected && bridgeStatus?.status === 'online';
  const isManualSimulation = isDeveloperMode && manualState !== null;
  const isSimulationActive = isSimulating || isManualSimulation;
  const isRealDataActive = isHardwareOnline && !isSimulationActive;

  // CSI 連結品質（給照護人員判讀：良好 / 普通 / 偏弱）
  const csiLink = bridgeStatus?.csi_link ?? null;
  const pktQ = csiLink?.pkt_rate != null ? pktQuality(csiLink.pkt_rate) : null;
  const rssiQ = csiLink?.rssi != null ? rssiQuality(csiLink.rssi) : null;

  // Refs to access latest real-time values inside setInterval without restarting it
  const movementScoreRef = useRef(movementScore);
  const isFallRef = useRef(isFallDetected);
  // 顯示用的平滑後移動值（自適應 EMA：讓波形更平順、不隨環境雜訊亂跳）
  const displayMovementRef = useRef(0);
  // 平滑強度（0~100）用 ref 讀取，調滑桿可即時生效又不會重置波形
  const smoothingRef = useRef(waveformSmoothing);
  useEffect(() => { smoothingRef.current = waveformSmoothing; }, [waveformSmoothing]);
  useEffect(() => { movementScoreRef.current = movementScore; }, [movementScore]);
  useEffect(() => { isFallRef.current = isFallDetected; }, [isFallDetected]);

  // Rolling window for HAR pattern analysis (20 samples ≈ 2 seconds at 10Hz)
  const scoreHistoryRef = useRef<number[]>([]);

  const classifyActivity = (hist: number[], isFalling: boolean) => {
    if (hist.length === 0) return { label: '待機', confidence: 0, icon: '⏸️' };

    // Backend sends a normalized 0-100 score. Keep a defensive clamp here
    // so stale servers or old cached packets cannot dominate the classifier.
    const capped = hist.map(v => Math.min(100, Math.max(0, v)));
    const mean = capped.reduce((a, b) => a + b, 0) / capped.length;
    const variance = capped.reduce((a, b) => a + (b - mean) ** 2, 0) / capped.length;
    const peak = Math.max(...capped);
    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

    if (isFalling) {
      return { label: '跌倒風險', confidence: clamp(88 + Math.round((peak - 80) * 0.25), 88, 99), icon: '⚠️' };
    }
    if (mean > 82) {
      return { label: '激烈活動', confidence: clamp(72 + Math.round((mean - 82) * 1.2), 72, 95), icon: '🏃' };
    }
    if (mean > 45 && variance > 80) {
      return { label: '行走', confidence: clamp(65 + Math.round(variance * 0.2), 65, 93), icon: '🚶' };
    }
    if (mean > 18 || variance > 35) {
      return { label: '輕微活動', confidence: clamp(70 + Math.round(mean * 0.7), 70, 92), icon: '💺' };
    }
    if (mean > 4) {
      return { label: '靜坐', confidence: clamp(78 + Math.round(mean * 1.5), 78, 94), icon: '🪑' };
    }
    return { label: '睡眠 / 靜止', confidence: clamp(82 + Math.round((4 - mean) * 3), 82, 96), icon: '😴' };
  };

  const updateActivitySnapshot = (score: number, isFalling: boolean) => {
    const normalizedScore = Math.min(100, Math.max(0, score));
    setMovementScore(Math.round(normalizedScore));
    setIsFallDetected(isFalling);
    scoreHistoryRef.current = [...scoreHistoryRef.current.slice(-19), normalizedScore];
    setHarActivity(classifyActivity(scoreHistoryRef.current, isFalling));
  };

  const areas = user?.role === 'family' 
    ? [`${user.patientName} 的房間`] 
    : ['204 號房', '205 號房', '206 號房', '公共區域', '浴室'];

  const startThinkingMode = async () => {
    setIsThinking(true);
    setThinkingResult(null);

    // 取此刻的即時數據快照（只用真的有的資料：移動分數、活動分類、跌倒狀態）
    const recent = scoreHistoryRef.current;
    const avgScore = recent.length
      ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length)
      : movementScore;
    const peakScore = recent.length ? Math.round(Math.max(...recent)) : movementScore;
    const dataSource = isRealDataActive ? '實機 ESP32 即時數據'
      : (isDeveloperMode && manualState) ? '開發者手動測試'
      : isSimulating ? '模擬數據'
      : '無即時數據';

    if (isDeveloperMode) {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1200));
      const mockResult = isFallDetected
        ? `【開發者模式 · 模擬研判】\n「${selectedArea}」訊號在短時間內劇烈震盪，與跌倒特徵高度吻合。\n風險等級：高。\n建議：立即派員前往查看，並確認長者意識與傷勢。`
        : `【開發者模式 · 模擬研判】\n「${selectedArea}」目前訊號平穩，長者處於正常活動狀態。\n風險等級：低。\n建議：維持例行觀察即可，暫無須介入。`;
      setThinkingResult(mockResult);
      setIsThinking(false);
      return;
    }

    // 沒有任何即時數據時，不丟給 AI 編造
    if (dataSource === '無即時數據') {
      setThinkingResult('目前沒有可分析的即時數據。請確認 ESP32 已連線，或開啟模擬模式後再試。');
      setIsThinking(false);
      return;
    }

    const prompt = `
你是一位智慧長照的即時監測 AI。請僅根據以下「此刻」的即時數據，對長者當前狀態做出簡短研判與建議。
重要：你只有移動分數與活動分類，沒有影像、生命徵象或病史。請勿臆測呼吸、心率或下醫療診斷，只就「活動狀態」研判。

監控區域：${selectedArea}
資料來源：${dataSource}
目前活動分類：${harActivity.label}（信心 ${harActivity.confidence}%）
即時移動分數：${movementScore} / 100（近 2 秒平均 ${avgScore}、峰值 ${peakScore}）
跌倒偵測：${isFallDetected ? '是（偵測到跌倒風險）' : '否'}${locationData?.x != null ? `\n相對位置：x=${locationData.x}, y=${locationData.y}` : ''}

請用繁體中文，條列輸出三點：
1. 目前狀態研判（依移動分數與活動分類，一句話）
2. 風險等級（低 / 中 / 高）與簡短理由
3. 給照護人員的當下建議（具體、可立即執行）
`.trim();

    try {
      setThinkingResult(await askGemini(prompt));
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setThinkingResult(`分析過程中發生錯誤：\n${errMsg}`);
    } finally {
      setIsThinking(false);
    }
  };

  // Real-time data stream
  useEffect(() => {
    let time = 50;
    const flat = Array.from({ length: 50 }, (_, i) => ({ time: i, movement: 0 }));
    setData(flat);
    displayMovementRef.current = 0;

    const interval = setInterval(() => {
      time += 1;
      let target: number;

      if (isDeveloperMode && manualState) {
        const fallEvent = manualState === 'fall';
        const score = generateSimulatedMovementScore(time, fallEvent, sensitivity, manualState);
        updateActivitySnapshot(score, fallEvent);
        target = score;
      } else if (isRealDataActive) {
        // 板子插著：目標值為真實 movement score（ESPectre 由 CSI 子載波算出的 mvmt）
        target = movementScoreRef.current;
      } else if (isSimulating) {
        // 手動開啟模擬模式
        const threshold = sensitivity > 0.8 ? 100 : 150;
        const fallEvent = time % threshold > (threshold - 20) && time % threshold < (threshold - 10);
        const score = generateSimulatedMovementScore(time, fallEvent, sensitivity, null);
        updateActivitySnapshot(score, fallEvent);
        target = score;
      } else {
        // 沒插板子、也沒開模擬 → 平線、無數據
        scoreHistoryRef.current = [];
        setMovementScore(0);
        setIsFallDetected(false);
        setHarActivity({ label: '待機', confidence: 0, icon: '⏸️' });
        target = 0;
      }

      // 自適應平滑（EMA）：真實值約每秒一筆，這裡每 0.1 秒把顯示值朝目標補間。
      // 變化大→反應快（即時，跌倒尖峰跟得上）；變化小→收斂慢（平順，濾掉環境雜訊亂跳）。
      // 平滑強度由設定滑桿控制：0=最即時(alpha 高)、100=最平順(alpha 低)。
      const sm = Math.min(1, Math.max(0, (smoothingRef.current ?? 60) / 100));
      const alphaSmall = 0.5 - sm * 0.45;                 // 0.5(即時) → 0.05(平順)
      const alphaBig = Math.min(0.7, alphaSmall + 0.35);  // 大跳動恆比小抖動快
      const cur = displayMovementRef.current;
      const diff = target - cur;
      const alpha = Math.abs(diff) > 25 ? alphaBig : alphaSmall;
      const movement = Math.max(0, Math.min(100, cur + diff * alpha));
      displayMovementRef.current = movement;

      const newPoint: WaveformPoint = { time, movement };
      setData(prev => [...prev.slice(1), newPoint]);
      setFullHistory(prev => [...prev, newPoint].slice(-1000));
    }, 100);

    return () => clearInterval(interval);
  }, [isDeveloperMode, manualState, sensitivity, isRealDataActive, isSimulating]);

  // 將 core_bridge.py 的即時數據同步到 UI 狀態
  useEffect(() => {
    if (isSimulationActive) return;
    if (!bridgeStatus) return;

    if (bridgeStatus.status !== 'online') {
      if (!isSimulating) {
        scoreHistoryRef.current = [];
        setMovementScore(0);
        setIsFallDetected(false);
        setHarActivity({ label: '待機', confidence: 0, icon: '⏸️' });
      }
      return;
    }

    // 更新移動分數
    const score = Math.min(100, Math.max(0, bridgeStatus.ai_analysis.movement_score));
    updateActivitySnapshot(score, bridgeStatus.ai_analysis.is_falling);
  }, [bridgeStatus, isSimulationActive, isSimulating]);

  useEffect(() => {
    if (!isSimulationActive) {
      setHoldSimulatedFallMarker(false);
      return;
    }

    if (isFallDetected) {
      setHoldSimulatedFallMarker(true);
      return;
    }

    const timeout = window.setTimeout(() => setHoldSimulatedFallMarker(false), 3500);
    return () => window.clearTimeout(timeout);
  }, [isFallDetected, isSimulationActive]);

  // Auto-show AI popup when fall is detected
  useEffect(() => {
    if (isFallDetected) {
      setShowAiPopup(true);
    }
  }, [isFallDetected]);

  const statusText = isFallDetected ? '異常震盪 (跌倒風險)' : '活動中';
  const statusColor = isFallDetected ? 'text-[#FF3B30] bg-[#FF3B30]/10 border-[#FF3B30]/20' : 'text-[#007AFF] bg-[#007AFF]/10 border-[#007AFF]/20';
  const floorPlanFallVisible = isFallDetected || holdSimulatedFallMarker;
  const deviceState = isRealDataActive ? 'online' : isSimulationActive ? 'simulating' : isConnected ? 'standby' : 'offline';

  const handleExport = (seconds: number) => {
    const pointsToExport = seconds * 10; // 10 points per second
    const exportData = fullHistory.slice(-pointsToExport);
    
    if (exportData.length === 0) {
      alert("尚無足夠數據可供匯出");
      return;
    }

    let fileContent = "";
    let mimeType = "";
    let fileExtension = "";

    if (exportFormat === 'csv') {
      const headers = ["Timestamp", "Movement_Score", "Fall_Detected"];
      const csvRows = [
        headers.join(","),
        ...exportData.map(d => [
          d.time,
          d.movement.toFixed(2),
          isFallDetected ? "1" : "0"
        ].join(","))
      ];
      fileContent = csvRows.join("\n");
      mimeType = 'text/csv;charset=utf-8;';
      fileExtension = 'csv';
    } else {
      const jsonData = exportData.map(d => ({
        timestamp: d.time,
        movement_score: parseFloat(d.movement.toFixed(2)),
        fall_detected: isFallDetected
      }));
      fileContent = JSON.stringify(jsonData, null, 2);
      mimeType = 'application/json;charset=utf-8;';
      fileExtension = 'json';
    }

    const blob = new Blob([fileContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `CSI_Data_Export_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.${fileExtension}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportModal(false);
  };

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500">
      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#2C363F] flex items-center justify-center">
                  <Download className="w-5 h-5 text-[#007AFF]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">數據匯出</h3>
                  <p className="text-xs text-slate-500">選擇匯出時間範圍</p>
                </div>
              </div>
              <button 
                onClick={() => setShowExportModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-4 px-6 bg-white space-y-3">
              <div className="flex gap-2 mb-2">
                <button 
                  onClick={() => setExportFormat('csv')}
                  className={cn("flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all", exportFormat === 'csv' ? "bg-green-50 border-green-200 text-green-700" : "bg-slate-50 border-slate-200 text-slate-500")}
                >
                  .CSV 格式
                </button>
                <button 
                  onClick={() => setExportFormat('json')}
                  className={cn("flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all", exportFormat === 'json' ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-slate-50 border-slate-200 text-slate-500")}
                >
                  .JSON 格式
                </button>
              </div>
              {[
                { label: '最近 10 秒', value: 10 },
                { label: '最近 30 秒', value: 30 },
                { label: '最近 60 秒', value: 60 },
                { label: '完整歷史 (最大 100 秒)', value: 100 },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleExport(opt.value)}
                  className="w-full flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50 hover:border-[#007AFF] hover:bg-[#007AFF]/5 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-slate-400 group-hover:text-[#007AFF]" />
                    <span className="text-sm font-bold text-slate-700 group-hover:text-[#007AFF]">{opt.label}</span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-300 -rotate-90" />
                </button>
              ))}
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 text-center">
                匯出格式：{exportFormat.toUpperCase()} (UTF-8) | {exportFormat === 'csv' ? '包含子載波振幅與跌倒標記' : '結構化陣列資料'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">即時監控面板</h1>
          <p className="text-slate-500 text-sm mt-1">CSI 頻譜感測與 AI 空間分析</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg shadow-sm border border-slate-100 transition-all active:scale-95"
          >
            <Download className="w-4 h-4 text-[#007AFF]" />
            <span className="text-sm font-medium">匯出數據</span>
          </button>
          {/* 模擬模式切換按鈕（板子未插時才顯示，或已開啟時顯示）*/}
          {(!isHardwareOnline || isSimulating) && (
            <button
              onClick={() => {
                setIsSimulating(v => !v);
                scoreHistoryRef.current = [];
                setHoldSimulatedFallMarker(false);
                setIsFallDetected(false);
                setMovementScore(0);
                setHarActivity({ label: '待機', confidence: 0, icon: '⏸️' });
              }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg shadow-sm border text-sm font-medium transition-all active:scale-95",
                isSimulating
                  ? "bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100"
                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
              )}
            >
              <div className={cn("w-2 h-2 rounded-full", isSimulating ? "bg-amber-400 animate-pulse" : "bg-slate-300")} />
              {isSimulating ? '模擬模式（關閉）' : '模擬模式'}
            </button>
          )}
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg shadow-sm border",
            isRealDataActive ? "bg-white border-slate-100" : isSimulationActive ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200"
          )}>
            <div className={cn(
              "w-2 h-2 rounded-full",
              isRealDataActive ? "bg-[#34C759] animate-pulse" : isSimulationActive ? "bg-amber-400 animate-pulse" : "bg-slate-300"
            )} />
            <span className="text-sm font-medium text-slate-600">
              {isRealDataActive ? '系統運作中' : isSimulationActive ? '模擬模式中' : '無訊號'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        
        {/* Left Column: CSI Waveform & Info */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Top Info Cards */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-4">
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                deviceState === 'online' ? "bg-[#34C759]/10" : deviceState === 'simulating' ? "bg-amber-50" : "bg-red-50"
              )}>
                {deviceState === 'online' ? (
                  <CheckCircle2 className="w-6 h-6 text-[#34C759]" />
                ) : deviceState === 'simulating' ? (
                  <Wifi className="w-6 h-6 text-amber-500" />
                ) : (
                  <WifiOff className="w-6 h-6 text-red-400" />
                )}
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium">設備狀態</p>
                <h3 className={cn(
                  "text-lg font-bold",
                  deviceState === 'online' ? "text-slate-800" : deviceState === 'simulating' ? "text-amber-600" : "text-red-500"
                )}>
                  {deviceState === 'simulating'
                    ? '模擬資料輸入'
                    : dataStale
                    ? '⚠️ 資料延遲'
                    : deviceState === 'online'
                    ? '連線成功'
                    : deviceState === 'standby'
                    ? '板子未插上'
                    : '已斷線'}
                </h3>
                {deviceState === 'simulating' && (
                  <p className="text-[10px] text-amber-500 font-medium">Movement / HAR / 跌倒提示皆為模擬</p>
                )}
              </div>
            </div>
            
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#2C363F]/5 flex items-center justify-center shrink-0">
                  <User className="w-6 h-6 text-[#2C363F]" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">當前監控者</p>
                  <h3 className="text-lg font-bold text-slate-800">{user?.name} {user?.role === 'medical' ? '護理師' : user?.role === 'admin' ? '管理者' : '家屬'}</h3>
                </div>
              </div>
              <div className="relative">
                <select 
                  value={selectedArea}
                  onChange={(e) => setSelectedArea(e.target.value)}
                  className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 py-2 pl-4 pr-10 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 cursor-pointer"
                >
                  {areas.map(area => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Movement Score + HAR */}
          <div className="grid grid-cols-2 gap-4">
            {/* Movement Score Gauge */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex items-center gap-4">
              <div className="relative w-16 h-16 shrink-0">
                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="28" fill="none" stroke="#f1f5f9" strokeWidth="6" />
                  <circle cx="32" cy="32" r="28" fill="none"
                    stroke={movementScore > 80 ? '#FF3B30' : movementScore > 40 ? '#FFCC00' : '#34C759'}
                    strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={`${Math.min(movementScore, 100) * 1.76} 176`}
                    className="transition-all duration-300" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-mono font-bold text-slate-800">
                  {movementScore}
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Movement Score</p>
                <p className={cn("text-sm font-bold",
                  movementScore > 80 ? 'text-[#FF3B30]' : movementScore > 40 ? 'text-amber-500' : 'text-[#34C759]'
                )}>
                  {movementScore > 80 ? '高度活動' : movementScore > 40 ? '中度活動' : '低度 / 靜止'}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">閾值: 80 | 模式: {isSimulationActive ? 'SIM' : 'MVS'}</p>
              </div>
            </div>

            {/* HAR Activity Recognition */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-2xl shrink-0">
                {harActivity.icon}
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">HAR 活動辨識</p>
                <p className={cn("text-sm font-bold",
                  harActivity.label === '跌倒風險' ? 'text-[#FF3B30]' : 'text-slate-800'
                )}>
                  {harActivity.label}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        harActivity.label === '跌倒風險' ? "bg-[#FF3B30]" : "bg-[#007AFF]"
                      )}
                      style={{ width: `${harActivity.confidence}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">{harActivity.confidence}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* AI Brain Status (CSI Waveform) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex-1 flex flex-col min-h-[300px] relative overflow-hidden">
            <div className="flex items-start justify-between mb-6 z-10">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[#007AFF]" />
                  AI 大腦狀態 (CSI 感測)
                </h2>
                <p className="text-xs text-slate-500 mt-1">CSI 移動強度即時波形（0–100，由所有子載波算出）</p>
                {isRealDataActive && csiLink && (
                  <div className="mt-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {pktQ && csiLink.pkt_rate != null && (
                        <span className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold", TONE_CLASS[pktQ.tone])}>
                          <Waves className="w-3 h-3" />
                          封包率 <span className="font-mono">{csiLink.pkt_rate}</span>
                          <span className="font-normal opacity-70">/秒 · {pktQ.word}</span>
                        </span>
                      )}
                      {rssiQ && csiLink.rssi != null && (
                        <span className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold", TONE_CLASS[rssiQ.tone])}>
                          <Signal className="w-3 h-3" />
                          訊號強度 <span className="font-mono">{csiLink.rssi}</span>
                          <span className="font-normal opacity-70">dBm · {rssiQ.word}</span>
                        </span>
                      )}
                      {csiLink.channel != null && (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-50 text-violet-600 text-[11px] font-bold">
                          <Radio className="w-3 h-3" />
                          頻道 <span className="font-mono">{csiLink.channel}</span>
                        </span>
                      )}
                      <button
                        onClick={() => setShowLinkHelp(v => !v)}
                        className="flex items-center justify-center w-5 h-5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        title="這些數字怎麼看？"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {showLinkHelp && (
                      <div className="mt-2 w-full max-w-md bg-slate-50 rounded-xl border border-slate-200 p-3 animate-in fade-in slide-in-from-top-1 duration-150">
                        <div className="flex items-center justify-between mb-1.5">
                          <h4 className="text-[11px] font-bold text-slate-700">這些數字怎麼看？（給照護人員）</h4>
                          <button onClick={() => setShowLinkHelp(false)} className="text-slate-400 hover:text-slate-600">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <ul className="space-y-1.5 text-[11px] text-slate-600 leading-relaxed">
                          <li>
                            <span className="font-bold text-slate-700">封包率</span>：感測器每秒回傳的資料筆數，越高偵測越即時穩定。
                            <span className="text-emerald-600 font-bold"> 良好 ≥ 80</span>｜普通 40–79｜<span className="text-red-500 font-bold">偏低 &lt; 40</span>（訊號被擋住或距離太遠，偵測會變遲鈍）。
                          </li>
                          <li>
                            <span className="font-bold text-slate-700">訊號強度</span>：Wi-Fi 訊號強弱，是負數、越接近 0 越強。
                            <span className="text-emerald-600 font-bold"> 良好 ≥ -60</span>｜普通 -60～-75｜<span className="text-red-500 font-bold">偏弱 &lt; -75</span>（建議把感測器移近，或減少牆面阻隔）。
                          </li>
                          <li>
                            <span className="font-bold text-slate-700">頻道</span>：目前使用的 Wi-Fi 頻道（1–13），只是顯示運作頻段，沒有好壞之分。
                          </li>
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className={cn(
                "px-4 py-1.5 rounded-full border text-sm font-bold flex items-center gap-2 transition-colors duration-300",
                statusColor
              )}>
                {isFallDetected && <AlertTriangle className="w-4 h-4" />}
                狀態：{statusText}
              </div>
            </div>

            <div className="flex-1 w-full -ml-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="movementFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={isFallDetected ? "#FF3B30" : "#007AFF"} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={isFallDetected ? "#FF3B30" : "#007AFF"} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="time" hide />
                  <YAxis domain={[0, 100]} hide />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    labelStyle={{ display: 'none' }}
                    formatter={(v: number) => [Math.round(v), '移動強度']}
                  />
                  <Area
                    type="monotone"
                    dataKey="movement"
                    stroke={isFallDetected ? "#FF3B30" : "#007AFF"}
                    strokeWidth={2.5}
                    fill="url(#movementFill)"
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            
            {/* Subtle background grid effect */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
            
            {/* Thinking Mode Button */}
            <div className="absolute bottom-4 right-6 z-10">
              <button 
                onClick={startThinkingMode}
                disabled={isThinking}
                className="flex items-center gap-2 bg-[#2C363F] hover:bg-slate-800 text-white px-4 py-2 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50"
              >
                {isThinking ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <BrainCircuit className="w-4 h-4 text-[#007AFF]" />
                )}
                <span className="text-sm font-bold">即時 AI 研判</span>
              </button>
            </div>
          </div>

          {/* Small Dynamic CSI Waveform Charts Container */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 即時移動強度 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 h-32 relative overflow-hidden">
              <div className="flex items-center justify-between mb-2 z-10 relative">
                <h3 className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-[#007AFF]" />
                  即時移動強度
                </h3>
                <span className="text-sm font-mono font-bold text-[#007AFF]">
                  {movementScore}<span className="text-[10px] text-slate-400 font-normal ml-0.5">/100</span>
                </span>
              </div>
              <div className="h-16 w-full -ml-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.slice(-30)}>
                    <defs>
                      <linearGradient id="miniMovementFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#007AFF" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#007AFF" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="movement"
                      stroke="#007AFF"
                      strokeWidth={2}
                      fill="url(#miniMovementFill)"
                      dot={false}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:12px_12px] pointer-events-none" />
            </div>

            {/* 活動強度變化（移動分數變化量） */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 h-32 relative overflow-hidden">
              <div className="flex items-center justify-between mb-2 z-10 relative">
                <h3 className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                  <Activity className={cn("w-3.5 h-3.5", isFallDetected ? "text-[#FF3B30]" : "text-[#34C759]")} />
                  活動強度變化
                </h3>
                <span className={cn("text-sm font-mono font-bold", isFallDetected ? "text-[#FF3B30]" : "text-[#34C759]")}>
                  Δ {data.length > 1 ? Math.round(Math.abs(data[data.length - 1].movement - data[data.length - 2].movement)) : 0}
                </span>
              </div>
              <div className="h-16 w-full -ml-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.slice(-30).map((d, i, a) => ({ time: d.time, delta: i > 0 ? Math.abs(d.movement - a[i - 1].movement) : 0 }))}>
                    <defs>
                      <linearGradient id="miniDeltaFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={isFallDetected ? "#FF3B30" : "#34C759"} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={isFallDetected ? "#FF3B30" : "#34C759"} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="delta"
                      stroke={isFallDetected ? "#FF3B30" : "#34C759"}
                      strokeWidth={2}
                      fill="url(#miniDeltaFill)"
                      dot={false}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:12px_12px] pointer-events-none" />
            </div>
          </div>

          {/* Thinking Result Display */}
          {thinkingResult && (
            <div className="bg-[#2C363F] text-white rounded-2xl shadow-xl p-6 animate-in zoom-in-95 duration-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 text-[#007AFF]" />
                  即時 AI 研判
                </h3>
                <button 
                  onClick={() => setThinkingResult(null)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  關閉
                </button>
              </div>
              <div className="text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">
                {thinkingResult}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Floor Plan + Room Overview (Tabbed) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col relative">
          {/* Tab Header */}
          <div className="flex items-center gap-1 mb-4 bg-slate-100 rounded-xl p-1 shrink-0">
            <button
              onClick={() => { setRightTab('floorplan'); setSelectedRoom(null); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all",
                rightTab === 'floorplan'
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <MapPin className="w-3.5 h-3.5" />
              平面圖
            </button>
            <button
              onClick={() => { setRightTab('rooms'); setSelectedRoom(null); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all",
                rightTab === 'rooms'
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              病房總覽
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 relative min-h-0">
            {rightTab === 'floorplan' ? (
              /* ====== Original Floor Plan (UNCHANGED) ====== */
              <>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-[#2C363F]" />
                    區域平面圖
                  </h2>
                  <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{selectedArea}</span>
                </div>

                <div className="flex-1 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 relative overflow-hidden p-4 flex items-center justify-center">
                  {/* Minimalist Floor Plan SVG Representation */}
                  <div className="w-full aspect-square max-w-sm relative border-4 border-slate-300 rounded-lg bg-white shadow-inner">
                    {selectedArea === '公共區域' ? (
                      <>
                        {/* Tables and Chairs for Public Area */}
                        <div className="absolute top-8 left-8 w-20 h-20 border-2 border-slate-300 rounded-full bg-slate-100 flex items-center justify-center">
                          <span className="text-[10px] text-slate-400 font-medium">圓桌</span>
                        </div>
                        <div className="absolute top-8 right-8 w-20 h-20 border-2 border-slate-300 rounded-full bg-slate-100 flex items-center justify-center">
                          <span className="text-[10px] text-slate-400 font-medium">圓桌</span>
                        </div>
                        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-48 h-12 border-2 border-slate-300 rounded bg-slate-100 flex items-center justify-center">
                          <span className="text-[10px] text-slate-400 font-medium">長沙發區</span>
                        </div>
                      </>
                    ) : selectedArea === '浴室' ? (
                      <>
                        {/* Dedicated Bathroom Layout */}
                        <div className="absolute top-4 right-4 w-24 h-24 border-2 border-slate-300 rounded-bl-3xl bg-slate-100 flex items-center justify-center">
                          <span className="text-[10px] text-slate-400 font-medium">浴缸</span>
                        </div>
                        <div className="absolute bottom-4 left-4 w-16 h-16 border-2 border-slate-300 rounded-full bg-slate-100 flex items-center justify-center">
                          <span className="text-[10px] text-slate-400 font-medium">洗手台</span>
                        </div>
                        <div className="absolute top-4 left-4 w-12 h-16 border-2 border-slate-300 rounded bg-slate-100 flex items-center justify-center">
                          <span className="text-[10px] text-slate-400 font-medium">馬桶</span>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Default Room Layout */}
                        <div className="absolute top-4 right-4 w-24 h-32 border-2 border-slate-300 rounded bg-slate-100 flex items-center justify-center">
                          <span className="text-xs text-slate-400 font-medium">病床</span>
                        </div>
                        
                        {/* Bathroom - Interactive Area */}
                        <button 
                          onClick={() => floorPlanFallVisible && setShowAiPopup(true)}
                          className={cn(
                            "absolute top-0 left-0 w-32 h-32 border-r-2 border-b-2 border-slate-300 flex items-center justify-center transition-all duration-500 group overflow-hidden",
                            floorPlanFallVisible
                              ? "bg-red-500/20 border-red-500/50 shadow-[inset_0_0_20px_rgba(239,68,68,0.2)]" 
                              : "bg-blue-50/30 hover:bg-blue-100/50"
                          )}
                        >
                          <span className={cn(
                            "text-xs font-bold transition-colors",
                            floorPlanFallVisible ? "text-red-600" : "text-slate-400"
                          )}>浴室</span>
                          {floorPlanFallVisible && (
                            <div className="absolute inset-0 bg-red-500/10 animate-pulse pointer-events-none" />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-400/5 to-transparent h-1/2 w-full animate-scan pointer-events-none" />
                        </button>

                        <div className="absolute bottom-12 right-8 w-12 h-12 border-2 border-slate-300 rounded-full bg-slate-50" />
                      </>
                    )}

                    {/* Door */}
                    <div className="absolute bottom-0 left-8 w-16 h-2 bg-white border-x-2 border-slate-300" />

                    {/* CSI Sensor Location */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 opacity-40">
                      <div className="w-4 h-4 bg-[#007AFF] rounded-sm rotate-45 flex items-center justify-center">
                        <Activity className="w-2 h-2 text-white -rotate-45" />
                      </div>
                      <span className="text-[8px] font-bold text-[#007AFF] uppercase tracking-tighter">CSI Sensor</span>
                    </div>

                    {/* Wi-Fi Triangulation Person Location Dot */}
                    {locationData.x !== null && locationData.y !== null && (() => {
                      const roomWidth = 6.0;
                      const roomHeight = 5.0;
                      const pctX = Math.max(0, Math.min(100, (locationData.x / roomWidth) * 100));
                      const pctY = Math.max(0, Math.min(100, (locationData.y / roomHeight) * 100));
                      return (
                        <div
                          className="absolute z-10 transition-all duration-1000 ease-in-out"
                          style={{ left: `${pctX}%`, top: `${pctY}%`, transform: 'translate(-50%, -50%)' }}
                        >
                          <div className="w-5 h-5 bg-[#34C759] rounded-full border-2 border-white shadow-lg relative z-10 flex items-center justify-center">
                            <User className="w-2.5 h-2.5 text-white" />
                          </div>
                          <div className="absolute inset-[-4px] bg-[#34C759]/30 rounded-full animate-ping" />
                          <div className="absolute inset-[-8px] bg-[#34C759]/10 rounded-full animate-pulse" />
                          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                            <span className="text-[7px] font-mono font-bold text-[#34C759] bg-white/80 px-1 rounded">
                              ({locationData.x?.toFixed(1)}, {locationData.y?.toFixed(1)})
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Dynamic Fall Marker */}
                    {floorPlanFallVisible && (
                      <div className={cn(
                        "absolute z-20 pointer-events-none",
                        selectedArea === '公共區域' ? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" :
                        selectedArea === '浴室' ? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" :
                        "top-16 left-16 -translate-x-1/2 -translate-y-1/2"
                      )}>
                        <div className="w-6 h-6 bg-[#FF3B30] rounded-full relative z-10 shadow-lg border-2 border-white flex items-center justify-center">
                          <AlertTriangle className="w-3 h-3 text-white" />
                        </div>
                        <div className="absolute inset-0 bg-[#FF3B30] rounded-full animate-ping opacity-75" />
                        <div className="absolute inset-[-12px] bg-[#FF3B30]/20 rounded-full animate-pulse" />
                      </div>
                    )}
                  </div>

                  {/* AI Analysis Popup */}
                  {showAiPopup && floorPlanFallVisible && (
                    <div className="absolute inset-x-4 bottom-4 bg-white rounded-xl shadow-2xl border border-red-100 p-4 z-30 animate-in slide-in-from-bottom-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 text-[#FF3B30] font-bold text-sm">
                          <Info className="w-4 h-4" />
                          Gemini AI 初步判斷
                        </div>
                        <button 
                          onClick={() => setShowAiPopup(false)}
                          className="text-slate-400 hover:text-slate-600 text-xs"
                        >
                          關閉
                        </button>
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed font-medium">
                        {new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })} - {selectedArea}偵測到劇烈訊號變化，與跌倒特徵吻合度 <span className="text-[#FF3B30] font-bold text-base">{Math.max(92, harActivity.confidence)}%</span>，建議立即查看。
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button className="flex-1 bg-[#FF3B30] hover:bg-red-600 text-white text-xs font-bold py-2 rounded-lg transition-colors">
                          立即處理
                        </button>
                        <button className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2 rounded-lg transition-colors">
                          誤報忽略
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* ====== Room Overview Tab (NEW) ====== */
              <div className="h-full flex flex-col">
                <RoomGrid
                  compact
                  onRoomClick={(room) => setSelectedRoom(room)}
                  liveScore={isRealDataActive || isSimulationActive ? movementScore : undefined}
                />
              </div>
            )}

            {/* Room Detail Slide-Over Panel */}
            {selectedRoom && (
              <RoomDetailPanel
                room={selectedRoom}
                patient={(() => {
                  // Match room to patient by room number extracted from room name
                  const roomNum = selectedRoom.name.match(/\d+/);
                  if (!roomNum) return null;
                  return patients.find(p => p.roomNumber === roomNum[0]) || null;
                })()}
                onClose={() => setSelectedRoom(null)}
              />
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
