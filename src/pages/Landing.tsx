import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, ShieldCheck, MapPin, BellRing, BarChart3, Wifi,
  Camera, Mic, Watch, ArrowRight, Cpu, HeartPulse, Lock, Sparkles, Zap,
} from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { CsiScene } from '../components/landing/CsiScene';
import { Esp32Photo } from '../components/landing/Esp32Photo';
import { Reveal } from '../components/landing/Reveal';
import { CountUp } from '../components/landing/CountUp';
import { LiveSignal } from '../components/landing/LiveSignal';
import { ActivityDemo } from '../components/landing/ActivityDemo';
import { ZoneMap } from '../components/landing/ZoneMap';

export function Landing() {
  const navigate = useNavigate();
  const { user } = useUser();
  const start = () => navigate(user ? '/realtime' : '/login');

  const features = [
    { icon: ShieldCheck, tint: 'text-red-500 bg-red-50', title: '即時跌倒偵測', desc: '透過 Wi-Fi CSI 訊號變化偵測跌倒，延遲 < 200ms，立即通報。' },
    { icon: MapPin, tint: 'text-blue-500 bg-blue-50', title: 'Wi-Fi 室內定位', desc: '免穿戴，以多 AP 訊號三角定位估算房間內位置。' },
    { icon: Activity, tint: 'text-green-500 bg-green-50', title: '人體活動辨識', desc: '6 級活動狀態：睡眠／靜坐／輕微／行走／激烈／跌倒。' },
    { icon: BellRing, tint: 'text-amber-500 bg-amber-50', title: 'LINE 即時推播', desc: '跌倒當下自動推播含分數、位置與時間的警報。' },
    { icon: BarChart3, tint: 'text-purple-500 bg-purple-50', title: '管理報表分析', desc: '跌倒統計、活動趨勢、裝置在線率，可匯出 CSV／JSON。' },
    { icon: Lock, tint: 'text-slate-600 bg-slate-100', title: '隱私保護設計', desc: '僅收集 Wi-Fi 物理特徵，無影像、聲音或身分資訊。' },
  ];

  const tech = ['React 19', 'TypeScript', 'Vite', 'Tailwind CSS', 'Supabase', 'PostgreSQL', 'Python', 'WebSocket', 'ESP32-S3', 'ESPectre', 'Recharts', 'BLE'];

  return (
    <div className="relative min-h-screen bg-[#E8E1D5] text-slate-800 overflow-x-hidden">
      <style>{`
        @keyframes lp-aurora1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(50px,-30px) scale(1.15)} }
        @keyframes lp-aurora2 { 0%,100%{transform:translate(0,0) scale(1.1)} 50%{transform:translate(-40px,30px) scale(.95)} }
        @keyframes lp-marquee { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes lp-shimmer { 0%{background-position:0% 50%} 100%{background-position:200% 50%} }
        @keyframes lp-glow { 0%,100%{box-shadow:0 10px 30px -8px rgba(0,122,255,.5)} 50%{box-shadow:0 10px 40px -4px rgba(0,122,255,.75)} }
        .lp-a1{animation:lp-aurora1 18s ease-in-out infinite}
        .lp-a2{animation:lp-aurora2 22s ease-in-out infinite}
        .lp-grad{background:linear-gradient(110deg,#007AFF,#7c3aed,#007AFF);background-size:200% auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:lp-shimmer 5s linear infinite}
        .lp-marq{animation:lp-marquee 24s linear infinite}
        .lp-cta{animation:lp-glow 2.6s ease-in-out infinite}
      `}</style>

      {/* 柔光背景 */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="lp-a1 absolute -top-32 -left-24 w-[34rem] h-[34rem] rounded-full bg-[#007AFF]/15 blur-[120px]" />
        <div className="lp-a2 absolute top-1/3 -right-24 w-[30rem] h-[30rem] rounded-full bg-purple-400/15 blur-[120px]" />
      </div>

      {/* 導覽列 */}
      <nav className="sticky top-0 z-30 backdrop-blur-xl bg-[#E8E1D5]/70 border-b border-slate-300/40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-[#007AFF] to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-900">Wi-Care</span>
          </div>
          <button onClick={() => navigate('/login')}
            className="text-sm font-medium text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg hover:bg-white/50 transition-colors">
            登入 →
          </button>
        </div>
      </nav>

      {/* Hero */}
      <header className="relative z-10 max-w-6xl mx-auto px-6 pt-16 pb-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <Reveal>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/70 border border-slate-200 text-xs font-medium text-slate-600 mb-6">
                <Sparkles className="w-3.5 h-3.5 text-[#007AFF]" /> 非接觸式 Wi-Fi CSI 感測技術
              </div>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[1.1] text-slate-900">
                <span className="lp-grad">智慧長照</span><br />監控系統
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="text-lg text-slate-600 mt-6 leading-relaxed max-w-xl">
                不用鏡頭、不用穿戴。Wi-Care 用 Wi-Fi 訊號的細微變化，即時偵測
                <span className="text-slate-900 font-semibold">跌倒</span>、推估
                <span className="text-slate-900 font-semibold">位置</span>、辨識
                <span className="text-slate-900 font-semibold">活動</span>——在完全保護隱私的前提下守護每一位長者。
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="flex flex-col sm:flex-row gap-3 mt-9">
                <button onClick={start}
                  className="lp-cta group flex items-center justify-center gap-2 bg-gradient-to-r from-[#007AFF] to-blue-600 text-white font-semibold px-8 py-3.5 rounded-xl hover:-translate-y-0.5 transition-transform">
                  開始體驗
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
                <a href="#scene"
                  className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-medium px-8 py-3.5 rounded-xl shadow-sm transition-colors">
                  觀看模擬展示
                </a>
              </div>
            </Reveal>

            {/* 統計：數字滾動計數 */}
            <Reveal delay={320}>
              <div className="grid grid-cols-4 gap-3 mt-12">
                {[
                  { node: <CountUp to={200} prefix="< " suffix="ms" />, label: '偵測延遲' },
                  { node: <CountUp to={6} suffix=" 級" />, label: '活動分類' },
                  { node: <CountUp to={10} suffix=" Hz" />, label: '採集頻率' },
                  { node: <CountUp to={0} />, label: '攝影機' },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <p className="text-xl md:text-2xl font-bold text-slate-900">{s.node}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>

          {/* Hero 視覺 */}
          <Reveal delay={200}>
            <div id="scene"><CsiScene /></div>
          </Reveal>
        </div>
      </header>

      {/* 技術跑馬燈 */}
      <div className="relative z-10 border-y border-slate-300/40 bg-white/40 py-5 overflow-hidden">
        <div className="flex w-max lp-marq">
          {[...tech, ...tech].map((t, i) => (
            <span key={i} className="mx-6 text-sm font-mono text-slate-500 whitespace-nowrap flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#007AFF]/60" /> {t}
            </span>
          ))}
        </div>
      </div>

      {/* 功能特色 */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-24">
        <Reveal className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900">核心功能</h2>
          <p className="text-slate-500 mt-3">六大模組，打造完整的智慧照護解決方案</p>
        </Reveal>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 70}>
              <div className="group h-full p-6 rounded-2xl border border-slate-100 bg-white hover:shadow-xl hover:-translate-y-1 transition-all">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${f.tint}`}>
                  <f.icon className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-lg text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* 即時動態演示 */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-24">
        <Reveal className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/70 border border-slate-200 text-xs text-slate-600 mb-4">
            <Sparkles className="w-3.5 h-3.5 text-[#007AFF]" /> 即時動態演示
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900">看系統怎麼運作</h2>
          <p className="text-slate-500 mt-3">以下皆為即時動畫演示，呈現感測、辨識與分區的實際運作</p>
        </Reveal>

        {/* CSI 訊號波形 + 說明 */}
        <div className="grid lg:grid-cols-2 gap-8 items-center mb-8">
          <Reveal><LiveSignal /></Reveal>
          <Reveal delay={120}>
            <div>
              <h3 className="text-2xl font-bold text-slate-900">感測訊號即時視覺化</h3>
              <p className="text-slate-600 mt-3 leading-relaxed">
                ESP32 每秒擷取數十組 Wi-Fi 子載波振幅。當有人移動，訊號會明顯抖動——
                系統把這些變化量化成 0–100 的<span className="font-semibold text-slate-900">移動分數</span>，
                作為跌倒與活動判斷的依據。
              </p>
            </div>
          </Reveal>
        </div>

        {/* 活動辨識 + 分區偵測 */}
        <div className="grid md:grid-cols-2 gap-8">
          <Reveal>
            <div className="flex flex-col gap-4">
              <ActivityDemo />
              <p className="text-sm text-slate-500 text-center px-4">
                依移動分數即時分類 6 級活動狀態，分數異常飆高即判定跌倒風險。
              </p>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="flex flex-col gap-4">
              <ZoneMap />
              <p className="text-sm text-slate-500 text-center px-4">
                多台 ESP32 各顧一個區域，人在哪個房間、哪台就亮燈——掌握活動範圍。
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 硬體展示：真實照片 + 3D 傾斜 */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-24">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          <Reveal>
            <Esp32Photo />
          </Reveal>
          <Reveal delay={120}>
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/70 border border-slate-200 text-xs text-slate-600 mb-5">
                <Cpu className="w-3.5 h-3.5 text-[#007AFF]" /> 感測核心硬體
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900">ESP32-S3 + ESPectre 韌體</h2>
              <p className="text-slate-600 mt-4 leading-relaxed">
                一片不到台幣 300 元的開發板，搭載 ESPectre v2.7.0 CSI 韌體，
                被動監聽 Wi-Fi 封包即可感測整個房間的人體活動——免額外感測器、免佈線。
                <span className="block mt-2 text-sm text-slate-400">（滑鼠移到板子上試試 3D 視差效果）</span>
              </p>
              <div className="grid grid-cols-2 gap-3 mt-7">
                {[
                  { icon: Wifi, k: '無線連接', v: 'Wi-Fi + BLE 5.0' },
                  { icon: Cpu, k: '處理器', v: '雙核 240MHz' },
                  { icon: Zap, k: '採集頻率', v: '10 Hz 即時' },
                  { icon: HeartPulse, k: '偵測核心', v: 'NBVI / MVS' },
                ].map((x) => (
                  <div key={x.k} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-100 shadow-sm">
                    <x.icon className="w-5 h-5 text-[#007AFF] shrink-0" />
                    <div>
                      <p className="text-[11px] text-slate-400">{x.k}</p>
                      <p className="text-sm font-medium text-slate-800">{x.v}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 運作原理 */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-24">
        <Reveal className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900">運作原理</h2>
          <p className="text-slate-500 mt-3">人體移動改變 Wi-Fi 訊號路徑，從中推斷行為</p>
        </Reveal>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { step: '01', icon: Wifi, title: '訊號採集', desc: 'ESP32-S3 被動監聽 Wi-Fi 封包，萃取通道狀態資訊（CSI）。' },
            { step: '02', icon: Cpu, title: '特徵運算', desc: '計算子載波振幅變化（NBVI），轉成 0-100 移動分數並判定動作。' },
            { step: '03', icon: BellRing, title: '智慧分析', desc: '跌倒偵測、活動分類與定位，即時推播並寫入雲端資料庫。' },
          ].map((s, i) => (
            <Reveal key={s.step} delay={i * 100}>
              <div className="relative h-full p-7 rounded-2xl border border-slate-100 bg-white shadow-sm">
                <span className="text-5xl font-black text-slate-100 absolute top-4 right-5">{s.step}</span>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#007AFF] to-purple-600 flex items-center justify-center mb-5 shadow-lg shadow-blue-600/20">
                  <s.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-lg text-slate-900 mb-2">{s.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* 隱私（深色帶，呼應系統側邊欄配色） */}
      <section className="relative z-10 bg-[#2C363F] py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <Reveal>
            <Lock className="w-12 h-12 text-green-400 mx-auto mb-6" />
            <h2 className="text-3xl md:text-4xl font-bold text-white">隱私，是照護的前提</h2>
            <p className="text-slate-400 mt-4 leading-relaxed max-w-2xl mx-auto">
              Wi-Care 僅收集 Wi-Fi 頻道的物理特徵，<strong className="text-white">不含任何身分、影像或音訊</strong>，
              讓被照護者毫無壓力地獲得完整守護。
            </p>
            <div className="flex items-center justify-center gap-4 sm:gap-8 mt-10">
              {[{ icon: Camera, label: '無攝影機' }, { icon: Mic, label: '無麥克風' }, { icon: Watch, label: '無穿戴' }].map((x) => (
                <div key={x.label} className="flex flex-col items-center gap-2 text-slate-300">
                  <div className="relative w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                    <x.icon className="w-6 h-6" />
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">✕</span>
                  </div>
                  <span className="text-xs">{x.label}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* 最終 CTA */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-24">
        <Reveal>
          <div className="relative rounded-3xl border border-slate-200 bg-white p-10 md:p-14 text-center overflow-hidden shadow-xl">
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 bg-[#007AFF]/15 blur-3xl rounded-full" />
            <div className="relative">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900">準備好體驗智慧照護了嗎？</h2>
              <p className="text-slate-500 mt-3">立即進入系統，探索即時監控、跌倒警報與管理報表。</p>
              <button onClick={start}
                className="lp-cta mt-8 inline-flex items-center gap-2 bg-gradient-to-r from-[#007AFF] to-blue-600 text-white font-semibold px-8 py-3.5 rounded-xl hover:-translate-y-0.5 transition-transform">
                開始體驗 <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </Reveal>
      </section>

      {/* 頁尾 */}
      <footer className="relative z-10 border-t border-slate-300/40 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#007AFF]" />
            <span className="font-medium text-slate-600">Wi-Care 智慧長照監控系統</span>
          </div>
          <span>© 2026 Wi-Care Team · 台北商業大學資訊管理系專題</span>
        </div>
      </footer>
    </div>
  );
}
