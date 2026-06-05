import React from 'react';

/**
 * CsiScene — 純 SVG/CSS 動畫「模擬場景」（淺色，與系統介面風格一致）。
 * 房間剖面：ESP32 發射 Wi-Fi 波 → 人物走動 → 跌倒 → 觸發警報 + LINE 推播。8 秒循環。
 */
export function CsiScene() {
  return (
    <div className="relative w-full max-w-xl mx-auto select-none">
      <style>{`
        @keyframes csi-ring { 0%{transform:scale(.2);opacity:.8} 70%{opacity:.2} 100%{transform:scale(1.9);opacity:0} }
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

      <div className="relative rounded-3xl border border-slate-200 bg-white p-5 shadow-xl overflow-hidden">
        {/* 視窗標題列（擬系統介面） */}
        <div className="flex items-center gap-1.5 mb-3">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
          <span className="ml-2 text-[11px] text-slate-400 font-medium">即時監控 · 客廳</span>
          <span className="ml-auto flex items-center gap-1 text-[10px] text-slate-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE
          </span>
        </div>

        <div className="relative rounded-2xl bg-[#F8FAFC] border border-slate-100 p-1">
          <svg viewBox="0 0 380 230" className="relative w-full">
            <defs>
              <linearGradient id="floorL" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#eef2f7" />
                <stop offset="100%" stopColor="#e2e8f0" />
              </linearGradient>
            </defs>
            {/* 房間 */}
            <rect x="10" y="20" width="360" height="190" rx="10" fill="url(#floorL)" stroke="#cbd5e1" strokeWidth="1.5" />
            <line x1="10" y1="170" x2="370" y2="170" stroke="#cbd5e1" strokeWidth="1.5" />

            {/* Wi-Fi 波 */}
            {[0, 0.8, 1.6].map((d, i) => (
              <circle key={i} className="csi-ring" style={{ animationDelay: `${d}s` }}
                cx="56" cy="52" r="30" fill="none" stroke="#007AFF" strokeWidth="2" />
            ))}

            {/* ESP32 裝置 */}
            <g style={{ animation: 'csi-float 4s ease-in-out infinite' }}>
              <rect x="40" y="38" width="32" height="22" rx="3" fill="#1e293b" stroke="#007AFF" strokeWidth="1.5" />
              <rect x="46" y="44" width="12" height="10" rx="1" fill="#3b82f6" />
              <circle cx="66" cy="43" r="1.6" fill="#22c55e" />
              <line x1="56" y1="38" x2="56" y2="30" stroke="#007AFF" strokeWidth="1.5" />
              <circle cx="56" cy="29" r="2" fill="#007AFF" />
            </g>
            <text x="56" y="74" textAnchor="middle" fill="#94a3b8" fontSize="7" fontFamily="monospace">ESP32-S3</text>

            {/* 人物（走動→跌倒） */}
            <g className="csi-person">
              <g transform="translate(150,122)">
                <ellipse cx="0" cy="48" rx="14" ry="3" fill="#000" opacity="0.12" />
                <circle cx="0" cy="0" r="9" fill="#334155" />
                <rect x="-7" y="10" width="14" height="26" rx="6" fill="#475569" />
                <line x1="-4" y1="36" x2="-7" y2="48" stroke="#334155" strokeWidth="4" strokeLinecap="round" />
                <line x1="4" y1="36" x2="7" y2="48" stroke="#334155" strokeWidth="4" strokeLinecap="round" />
              </g>
            </g>

            {/* 警報泡泡 */}
            <g className="csi-alert">
              <rect x="150" y="86" width="92" height="26" rx="13" fill="#ef4444" />
              <text x="196" y="103" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="bold">⚠ 偵測到跌倒</text>
            </g>
          </svg>

          {/* 移動分數條 */}
          <div className="absolute right-3 top-10 bottom-8 w-2.5 rounded-full bg-slate-200 overflow-hidden flex items-end">
            <div className="csi-scorebar w-full rounded-full" />
          </div>
        </div>

        {/* LINE 推播卡片 */}
        <div className="csi-line absolute bottom-5 right-5 w-52 bg-white rounded-xl shadow-2xl border border-slate-100 p-3 flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#00C300] flex items-center justify-center text-white font-bold text-[10px] shrink-0">LINE</div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-800">Wi-Care 跌倒警報</p>
            <p className="text-[10px] text-slate-500 leading-tight mt-0.5">客廳偵測到跌倒，移動分數 128，請立即確認！</p>
          </div>
        </div>
      </div>
    </div>
  );
}
