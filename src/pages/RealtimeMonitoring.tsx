import React, { useState, useEffect } from 'react';
import { 
  LineChart, 
  Line, 
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
  X
} from 'lucide-react';
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { useDeveloper } from '../contexts/DeveloperContext';
import { useUser } from '../contexts/UserContext';
import { cn } from '../lib/utils';

// Simulate CSI waveform data
const generateData = (time: number, isFall: boolean, sensitivity: number = 0.5) => {
  const base = Math.sin(time / 10) * 20;
  const noiseFactor = sensitivity * 20;
  const noise1 = (Math.random() * noiseFactor) - (noiseFactor / 2);
  const noise2 = Math.cos(time / 5) * 15;
  const noise3 = Math.sin(time / 3) * 10;
  
  if (isFall) {
    return {
      time,
      subcarrier1: -80 + Math.random() * 20,
      subcarrier2: -90 + Math.random() * 15,
      subcarrier3: -75 + Math.random() * 25,
    };
  }

  return {
    time,
    subcarrier1: base + noise1 + 50,
    subcarrier2: base + noise2 + 40,
    subcarrier3: noise3 + 60,
  };
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
  const { isDeveloperMode, manualState, sensitivity, sceneMode } = useDeveloper();

  const areas = user?.role === 'family' 
    ? [`${user.patientName} 的房間`] 
    : ['204 號房', '205 號房', '206 號房', '公共區域', '浴室'];

  const startThinkingMode = async () => {
    setIsThinking(true);
    setThinkingResult(null);

    if (isDeveloperMode) {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      const mockResult = isFallDetected 
        ? `【開發者模式 - 模擬分析】\n偵測到「${sceneMode === 'bathroom' ? '浴室' : '客廳'}」區域有劇烈訊號擾動，特徵與跌倒高度吻合。當前靈敏度設定為 ${Math.round(sensitivity * 100)}%。建議立即派員前往查看。`
        : `【開發者模式 - 模擬分析】\n當前環境訊號穩定。場景模式：${sceneMode === 'bathroom' ? '浴室' : '客廳'}。偵測到微弱的呼吸起伏，長者目前處於靜止狀態。`;
      setThinkingResult(mockResult);
      setIsThinking(false);
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `
          你是一位專業的智慧長照 AI 分析師。
          目前監控區域：${selectedArea}
          場景模式：${sceneMode === 'bathroom' ? '浴室' : '客廳'}
          偵測靈敏度：${Math.round(sensitivity * 100)}%
          當前偵測狀態：${isFallDetected ? '偵測到跌倒風險' : '正常活動中'}
          
          請針對當前的 Wi-Fi CSI 訊號模式進行深度分析。
          如果偵測到跌倒，請分析可能的嚴重程度與應對建議。
          如果狀態正常，請分析環境中的微小變動（如呼吸頻率、睡眠品質等）。
          
          請使用繁體中文回答。
        `,
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH
          }
        }
      });
      setThinkingResult(response.text || "無法取得分析結果。");
    } catch (error) {
      console.error("Thinking Mode Error:", error);
      setThinkingResult("分析過程中發生錯誤，請稍後再試。");
    } finally {
      setIsThinking(false);
    }
  };

  // Simulate real-time data stream
  useEffect(() => {
    let time = 0;
    const initialData = Array.from({ length: 50 }, (_, i) => generateData(i, false, sensitivity));
    setData(initialData);
    time = 50;

    const interval = setInterval(() => {
      time += 1;
      
      let fallEvent = false;

      if (isDeveloperMode && manualState) {
        fallEvent = manualState === 'fall';
      } else {
        // Simulate a fall event more frequently if sensitivity is high
        const threshold = sensitivity > 0.8 ? 100 : 150;
        fallEvent = time % threshold > (threshold - 20) && time % threshold < (threshold - 10);
      }
      
      if (fallEvent !== isFallDetected) {
        setIsFallDetected(fallEvent);
      }

      setData(prev => {
        const newData = [...prev.slice(1), generateData(time, fallEvent, sensitivity)];
        return newData;
      });

      setFullHistory(prev => {
        const newPoint = generateData(time, fallEvent, sensitivity);
        const updated = [...prev, newPoint];
        // Keep last 1000 points (approx 100 seconds)
        return updated.slice(-1000);
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isFallDetected, isDeveloperMode, manualState, sensitivity]);

  // Auto-show AI popup when fall is detected
  useEffect(() => {
    if (isFallDetected) {
      setShowAiPopup(true);
    }
  }, [isFallDetected]);

  const statusText = isFallDetected ? '異常震盪 (跌倒風險)' : '活動中';
  const statusColor = isFallDetected ? 'text-[#FF3B30] bg-[#FF3B30]/10 border-[#FF3B30]/20' : 'text-[#007AFF] bg-[#007AFF]/10 border-[#007AFF]/20';

  const handleExport = (seconds: number) => {
    const pointsToExport = seconds * 10; // 10 points per second
    const exportData = fullHistory.slice(-pointsToExport);
    
    if (exportData.length === 0) {
      alert("尚無足夠數據可供匯出");
      return;
    }

    const headers = ["Timestamp", "Subcarrier_1", "Subcarrier_2", "Subcarrier_3", "Fall_Detected"];
    const csvRows = [
      headers.join(","),
      ...exportData.map(d => [
        d.time,
        d.subcarrier1.toFixed(2),
        d.subcarrier2.toFixed(2),
        d.subcarrier3.toFixed(2),
        isFallDetected ? "1" : "0"
      ].join(","))
    ];

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `CSI_Data_Export_${new Date().toISOString().slice(0,19)}.csv`);
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
            <div className="p-6 space-y-3">
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
                匯出格式：CSV (UTF-8) | 包含子載波振幅與跌倒標記
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
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-100">
            <div className="w-2 h-2 rounded-full bg-[#34C759] animate-pulse" />
            <span className="text-sm font-medium text-slate-600">系統運作中</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        
        {/* Left Column: CSI Waveform & Info */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Top Info Cards */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#34C759]/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6 text-[#34C759]" />
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium">設備狀態</p>
                <h3 className="text-lg font-bold text-slate-800">連線成功</h3>
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

          {/* AI Brain Status (CSI Waveform) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex-1 flex flex-col min-h-[300px] relative overflow-hidden">
            <div className="flex items-center justify-between mb-6 z-10">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[#007AFF]" />
                  AI 大腦狀態 (CSI 感測)
                </h2>
                <p className="text-xs text-slate-500 mt-1">Wi-Fi 多子載波即時頻率變化</p>
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
                <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="time" hide />
                  <YAxis domain={[-100, 100]} hide />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    labelStyle={{ display: 'none' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="subcarrier1" 
                    stroke={isFallDetected ? "#FF3B30" : "#007AFF"} 
                    strokeWidth={2} 
                    dot={false} 
                    isAnimationActive={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="subcarrier2" 
                    stroke={isFallDetected ? "#ff6b6b" : "#4dabf7"} 
                    strokeWidth={2} 
                    dot={false} 
                    isAnimationActive={false}
                    opacity={0.7}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="subcarrier3" 
                    stroke={isFallDetected ? "#fa5252" : "#339af0"} 
                    strokeWidth={2} 
                    dot={false} 
                    isAnimationActive={false}
                    opacity={0.4}
                  />
                </LineChart>
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
                <span className="text-sm font-bold">啟動 AI 深度分析 (Thinking Mode)</span>
              </button>
            </div>
          </div>

          {/* Small Dynamic CSI Waveform Charts Container */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Subcarrier Detail (Amplitude) */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 h-32 relative overflow-hidden">
              <div className="flex items-center justify-between mb-2 z-10 relative">
                <h3 className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  子載波振幅監控 (CSI Amplitude)
                </h3>
                <span className="text-[10px] font-mono text-slate-400">Stream A</span>
              </div>
              <div className="h-16 w-full -ml-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.slice(-20)}>
                    <Line 
                      type="step" 
                      dataKey="subcarrier1" 
                      stroke="#007AFF" 
                      strokeWidth={1.5} 
                      dot={false} 
                      isAnimationActive={false}
                    />
                    <Line 
                      type="step" 
                      dataKey="subcarrier2" 
                      stroke="#4dabf7" 
                      strokeWidth={1} 
                      dot={false} 
                      isAnimationActive={false}
                      opacity={0.5}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:12px_12px] pointer-events-none" />
            </div>

            {/* Phase Variance (Activity Intensity) */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 h-32 relative overflow-hidden">
              <div className="flex items-center justify-between mb-2 z-10 relative">
                <h3 className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  相位變異監控 (Phase Variance)
                </h3>
                <span className="text-[10px] font-mono text-slate-400">Activity Level</span>
              </div>
              <div className="h-16 w-full -ml-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.slice(-20)}>
                    <Line 
                      type="monotone" 
                      dataKey={(d) => Math.abs(d.subcarrier1 - d.subcarrier2)} 
                      stroke={isFallDetected ? "#FF3B30" : "#34C759"} 
                      strokeWidth={2} 
                      dot={false} 
                      isAnimationActive={false}
                    />
                  </LineChart>
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
                  AI 深度分析報告
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

        {/* Right Column: Floor Plan */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col relative">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#2C363F]" />
              區域平面圖
            </h2>
            <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded">{selectedArea}</span>
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
                    onClick={() => isFallDetected && setShowAiPopup(true)}
                    className={cn(
                      "absolute top-0 left-0 w-32 h-32 border-r-2 border-b-2 border-slate-300 flex items-center justify-center transition-all duration-500 group overflow-hidden",
                      isFallDetected 
                        ? "bg-red-500/20 border-red-500/50 shadow-[inset_0_0_20px_rgba(239,68,68,0.2)]" 
                        : "bg-blue-50/30 hover:bg-blue-100/50"
                    )}
                  >
                    <span className={cn(
                      "text-xs font-bold transition-colors",
                      isFallDetected ? "text-red-600" : "text-slate-400"
                    )}>浴室</span>
                    {isFallDetected && (
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

              {/* Dynamic Fall Marker */}
              {isFallDetected && (
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
            {showAiPopup && isFallDetected && (
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
                  11:42 AM - 浴室偵測到劇烈訊號變化，與跌倒特徵吻合度 <span className="text-[#FF3B30] font-bold text-base">92%</span>，建議立即查看。
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
        </div>

      </div>
    </div>
  );
}
