import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, ShieldCheck, MapPin, BellRing, BarChart3, Wifi,
  Camera, Mic, Watch, ArrowRight, Cpu, HeartPulse, Lock, ChevronDown,
} from 'lucide-react';
import { useUser } from '../contexts/UserContext';

export function Landing() {
  const navigate = useNavigate();
  const { user } = useUser();

  const start = () => navigate(user ? '/realtime' : '/login');

  const features = [
    { icon: ShieldCheck, color: 'text-red-500 bg-red-50', title: '即時跌倒偵測', desc: '透過 Wi-Fi CSI 訊號變化偵測跌倒風險，偵測延遲 < 200ms，立即通報照護人員。' },
    { icon: MapPin, color: 'text-blue-500 bg-blue-50', title: 'Wi-Fi 室內定位', desc: '無需穿戴裝置，以多 AP 訊號強度三角定位，估算被照護者在房間內的位置。' },
    { icon: Activity, color: 'text-green-500 bg-green-50', title: '人體活動辨識', desc: '6 級活動狀態分類（睡眠／靜坐／輕微活動／行走／激烈活動／跌倒風險）。' },
    { icon: BellRing, color: 'text-amber-500 bg-amber-50', title: 'LINE 即時推播', desc: '偵測到跌倒事件時自動推播至照護人員 LINE，含分數、位置與時間。' },
    { icon: BarChart3, color: 'text-purple-500 bg-purple-50', title: '管理報表分析', desc: '跌倒事件統計、活動量趨勢、健康趨勢與裝置在線率，支援 CSV／JSON 匯出。' },
    { icon: Lock, color: 'text-slate-600 bg-slate-100', title: '隱私保護設計', desc: '僅收集 Wi-Fi 通道物理特徵，不含任何影像、聲音或個人身分資訊。' },
  ];

  return (
    <div className="min-h-screen bg-[#E8E1D5] text-slate-800">
      {/* ===== 導覽列 ===== */}
      <nav className="sticky top-0 z-30 bg-[#E8E1D5]/80 backdrop-blur-md border-b border-slate-300/40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-[#2C363F] rounded-xl flex items-center justify-center">
              <Activity className="w-5 h-5 text-[#007AFF]" />
            </div>
            <span className="font-bold text-lg tracking-tight">Wi-Care</span>
          </div>
          <button onClick={() => navigate('/login')}
            className="text-sm font-medium text-slate-600 hover:text-slate-900 px-4 py-2 transition-colors">
            登入
          </button>
        </div>
      </nav>

      {/* ===== Hero ===== */}
      <header className="max-w-6xl mx-auto px-6 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/60 border border-slate-300/50 text-xs font-medium text-slate-600 mb-6">
          <Wifi className="w-3.5 h-3.5 text-[#007AFF]" /> 非接觸式 Wi-Fi CSI 感測技術
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
          智慧長照監控系統
          <span className="block text-2xl md:text-3xl font-medium text-slate-500 mt-4">
            不用鏡頭、不用穿戴，守護每一位長者
          </span>
        </h1>
        <p className="max-w-2xl mx-auto text-slate-600 mt-6 leading-relaxed">
          Wi-Care 運用 Wi-Fi 通道狀態資訊（CSI）感測技術，在完全保護隱私的前提下，
          實現即時跌倒偵測、室內定位與活動辨識，為居家與長照機構提供安心的智慧照護。
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-10">
          <button onClick={start}
            className="group flex items-center gap-2 bg-[#2C363F] hover:bg-[#1E252B] text-white font-medium px-8 py-3.5 rounded-xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5">
            開始體驗
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
          <a href="#features"
            className="flex items-center gap-2 bg-white/70 hover:bg-white text-slate-700 font-medium px-8 py-3.5 rounded-xl border border-slate-300/50 transition-all">
            了解更多 <ChevronDown className="w-4 h-4" />
          </a>
        </div>

        {/* 隱私三不 */}
        <div className="flex items-center justify-center gap-6 mt-14 text-sm">
          {[{ icon: Camera, label: '無攝影機' }, { icon: Mic, label: '無麥克風' }, { icon: Watch, label: '無穿戴裝置' }].map((x) => (
            <div key={x.label} className="flex items-center gap-2 text-slate-500">
              <div className="relative">
                <x.icon className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 text-red-500 font-bold text-xs">✕</span>
              </div>
              {x.label}
            </div>
          ))}
        </div>
      </header>

      {/* ===== 功能特色 ===== */}
      <section id="features" className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold">核心功能</h2>
            <p className="text-slate-500 mt-3">六大功能，打造完整的智慧照護解決方案</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="p-6 rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-lg transition-all">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${f.color}`}>
                  <f.icon className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 技術原理 ===== */}
      <section className="py-20 bg-[#E8E1D5]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold">CSI 感測技術原理</h2>
            <p className="text-slate-500 mt-3">人體移動會改變 Wi-Fi 訊號的傳播路徑，從中推斷行為</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: '1', icon: Wifi, title: '訊號採集', desc: 'ESP32-S3 搭載 ESPectre 韌體，被動監聽 Wi-Fi 封包並萃取通道狀態資訊（CSI）。' },
              { step: '2', icon: Cpu, title: '特徵運算', desc: '計算各子載波的振幅變化（NBVI），轉換為 0-100 的移動分數並判定動作。' },
              { step: '3', icon: HeartPulse, title: '智慧分析', desc: '後端進行跌倒偵測、活動分類與室內定位，即時推播並寫入雲端資料庫。' },
            ].map((s) => (
              <div key={s.step} className="relative bg-white p-6 rounded-2xl border border-slate-100">
                <div className="absolute -top-3 -left-3 w-9 h-9 rounded-full bg-[#007AFF] text-white font-bold flex items-center justify-center text-sm shadow-lg">
                  {s.step}
                </div>
                <s.icon className="w-8 h-8 text-[#007AFF] mb-4 mt-2" />
                <h3 className="font-bold text-lg mb-2">{s.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 隱私聲明 ===== */}
      <section className="py-20 bg-[#2C363F] text-slate-200">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <Lock className="w-12 h-12 text-green-400 mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-white">隱私，是照護的前提</h2>
          <p className="text-slate-400 mt-4 leading-relaxed max-w-2xl mx-auto">
            Wi-Care 僅收集 Wi-Fi 頻道的物理特徵（振幅與相位），
            <strong className="text-white">不含任何個人身分、通訊內容、影像或音訊</strong>。
            讓被照護者在毫無壓力與負擔的情況下，獲得最完整的安全守護。
          </p>
          <button onClick={start}
            className="mt-10 inline-flex items-center gap-2 bg-[#007AFF] hover:bg-[#0066CC] text-white font-medium px-8 py-3.5 rounded-xl shadow-lg transition-all hover:-translate-y-0.5">
            立即開始體驗 <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* ===== 頁尾 ===== */}
      <footer className="bg-[#1E252B] text-slate-500 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#007AFF]" />
            <span className="font-medium text-slate-400">Wi-Care 智慧長照監控系統</span>
          </div>
          <span>© 2026 Wi-Care Team · 台北商業大學資訊管理系專題</span>
        </div>
      </footer>
    </div>
  );
}
