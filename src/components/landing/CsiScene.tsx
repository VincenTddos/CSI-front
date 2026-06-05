import React from 'react';

/**
 * CsiScene — 純 SVG/CSS 動畫「模擬場景」
 * 房間剖面：ESP32 發射 Wi-Fi 波 → 人物走動 → 跌倒 → 觸發警報 + LINE 推播。
 * 8 秒循環，像一段無限播放的展示影片。
 */
export function CsiScene() {
  return (
    <div className="relative w-full max-w-xl mx-auto select-none">
      <style>{`
        @keyframes csi-ring { 0%{transform:scale(.2);opacity:.9} 70%{opacity:.25} 100%{transform:scale(1.9);opacity:0} }
        @keyframes csi-person { 0%,8%{transform:translateX(0) rotate(0)} 40%{transform:translateX(120px) rotate(0)}
          50%{transform:translateX(132px) rotate(72deg)} 80%{transform:translateX(132px) rotate(72deg)}
          88%{transform:translateX(0) rotate(0)} 100%{transform:translateX(0) rotate(0)} }
        @keyframes csi-alert { 0%,46%{opacity:0;transform:translateY(6px) scale(.9)} 52%,82%{opacity:1;transform:translateY(0) scale(1)} 88%,100%{opacity:0;transform:translateY(6px) scale(.9)} }
        @keyframes csi-line { 0%,50%{opacity:0;transform:translateX(20px)} 58%,84%{opacity:1;transform:translateX(0)} 90%,100%{opacity:0;transform:translateX(20px)} }
        @keyframes csi-score { 0%,40%{height:18%} 52%{height:92%} 80%{height:88%} 88%,100%{height:18%} }
        @keyframes csi-scorecol { 0%,40%{background:#22c55e} 52%,80%{background:#ef4444} 88%,100%{background:#22c55e} }
        @keyframes csi-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        .csi-ring{transform-origin:center;animation:csi-ring 2.6s ease-out infinite}
        .csi-person{transform-box:fill-box;transform-origin:50% 100%;animation:csi-person 8s ease-in-out infinite}
        .csi-alert{animation:csi-alert 8s ease-in-out infinite}
        .csi-line{animation:csi-line 8s ease-in-out infinite}
        .csi-scorebar{animation:csi-score 8s ease-in-out infinite, csi-scorecol 8s step-end infinite}
      `}</style>

      {/* 場景框 */}
      <div className="relative rounded-3xl border border-white/10 bg-gradient-to-b from-[#0f1620] to-[#0a0f16] p-5 shadow-2xl overflow-hidden">
        {/* 角落光暈 */}
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-[#007AFF]/20 blur-3xl rounded-full" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-purple-500/10 blur-3xl rounded-full" />

        <svg viewBox="0 0 380 240" className="relative w-full">
          {/* 地板 / 牆 */}
          <defs>
            <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1b2735" />
              <stop offset="100%" stopColor="#0c121a" />
            </linearGradient>
          </defs>
          <rect x="10" y="30" width="360" height="180" rx="10" fill="url(#floor)" />
          <rect x="10" y="30" width="360" height="180" rx="10" fill="none" stroke="#2a3a4d" strokeWidth="1.5" />
          <line x1="10" y1="175" x2="370" y2="175" stroke="#2a3a4d" strokeWidth="1.5" />

          {/* Wi-Fi 波（從裝置發射） */}
          {[0, 0.8, 1.6].map((d, i) => (
            <circle key={i} className="csi-ring" style={{ animationDelay: `${d}s` }}
              cx="56" cy="60" r="30" fill="none" stroke="#007AFF" strokeWidth="2" />
          ))}

          {/* ESP32 裝置（牆上） */}
          <g style={{ animation: 'csi-float 4s ease-in-out infinite' }}>
            <rect x="40" y="46" width="32" height="22" rx="3" fill="#0b1118" stroke="#3b82f6" strokeWidth="1.5" />
            <rect x="46" y="52" width="12" height="10" rx="1" fill="#1e3a5f" />
            <circle cx="66" cy="51" r="1.6" fill="#22c55e" />
            <line x1="56" y1="46" x2="56" y2="38" stroke="#3b82f6" strokeWidth="1.5" />
            <circle cx="56" cy="37" r="2" fill="#3b82f6" />
          </g>
          <text x="56" y="82" textAnchor="middle" fill="#5b7a9d" fontSize="7" fontFamily="monospace">ESP32-S3</text>

          {/* 人物（走動→跌倒） */}
          <g className="csi-person">
            <g transform="translate(150,128)">
              {/* 影子 */}
              <ellipse cx="0" cy="48" rx="14" ry="3" fill="#000" opacity="0.25" />
              {/* 身體 */}
              <circle cx="0" cy="0" r="9" fill="#e2e8f0" />
              <rect x="-7" y="10" width="14" height="26" rx="6" fill="#94a3b8" />
              <line x1="-4" y1="36" x2="-7" y2="48" stroke="#64748b" strokeWidth="4" strokeLinecap="round" />
              <line x1="4" y1="36" x2="7" y2="48" stroke="#64748b" strokeWidth="4" strokeLinecap="round" />
            </g>
          </g>

          {/* 警報泡泡 */}
          <g className="csi-alert">
            <rect x="150" y="92" width="92" height="26" rx="13" fill="#ef4444" />
            <text x="196" y="109" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="bold">⚠ 偵測到跌倒</text>
          </g>
        </svg>

        {/* 移動分數條 */}
        <div className="absolute right-5 top-5 bottom-16 w-2.5 rounded-full bg-white/5 overflow-hidden flex items-end">
          <div className="csi-scorebar w-full rounded-full" />
        </div>

        {/* LINE 推播卡片 */}
        <div className="csi-line absolute bottom-4 right-4 w-52 bg-white rounded-xl shadow-2xl p-3 flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#00C300] flex items-center justify-center text-white font-bold text-xs shrink-0">LINE</div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-800">Wi-Care 跌倒警報</p>
            <p className="text-[10px] text-slate-500 leading-tight mt-0.5">客廳偵測到跌倒，移動分數 128，請立即確認！</p>
          </div>
        </div>

        <div className="absolute left-4 bottom-3 flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE 模擬展示
        </div>
      </div>
    </div>
  );
}
