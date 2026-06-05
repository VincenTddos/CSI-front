import React from 'react';

/**
 * Esp32Board — 純 SVG 繪製的 ESP32-S3 開發板插圖 + 標註說明。
 */
export function Esp32Board() {
  return (
    <div className="relative w-full max-w-md mx-auto select-none">
      <style>{`
        @keyframes esp-led { 0%,100%{opacity:.3} 50%{opacity:1} }
        @keyframes esp-bob { 0%,100%{transform:translateY(0) rotate(-2deg)} 50%{transform:translateY(-8px) rotate(-2deg)} }
        .esp-led{animation:esp-led 1.6s ease-in-out infinite}
        .esp-board{animation:esp-bob 6s ease-in-out infinite;transform-origin:center}
      `}</style>

      {/* 光暈底 */}
      <div className="absolute inset-0 bg-gradient-to-tr from-[#007AFF]/20 to-purple-500/10 blur-3xl rounded-full" />

      <svg viewBox="0 0 320 200" className="relative w-full drop-shadow-2xl">
        <defs>
          <linearGradient id="pcb" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0e2a22" />
            <stop offset="100%" stopColor="#0a1f19" />
          </linearGradient>
          <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fcd34d" />
            <stop offset="100%" stopColor="#d4a017" />
          </linearGradient>
        </defs>

        <g className="esp-board">
          {/* PCB 板 */}
          <rect x="70" y="40" width="180" height="120" rx="8" fill="url(#pcb)" stroke="#10b981" strokeWidth="1" opacity="0.95" />

          {/* 天線蛇形走線 */}
          <path d="M150 46 h40 v6 h-40 v6 h40 v6 h-40" fill="none" stroke="url(#gold)" strokeWidth="2" />

          {/* 金屬遮蔽罩（Wi-Fi 模組） */}
          <rect x="86" y="58" width="48" height="40" rx="3" fill="#cbd5e1" stroke="#94a3b8" />
          <rect x="86" y="58" width="48" height="40" rx="3" fill="none" stroke="#e2e8f0" strokeWidth="0.6" />
          <text x="110" y="82" textAnchor="middle" fill="#475569" fontSize="6" fontFamily="monospace">WiFi+BLE</text>

          {/* 主晶片 ESP32-S3 */}
          <rect x="150" y="74" width="54" height="54" rx="4" fill="#0b0f14" stroke="#334155" />
          <text x="177" y="98" textAnchor="middle" fill="#94a3b8" fontSize="8" fontWeight="bold" fontFamily="monospace">ESP32</text>
          <text x="177" y="110" textAnchor="middle" fill="#64748b" fontSize="7" fontFamily="monospace">-S3</text>
          {/* 晶片接腳 */}
          {Array.from({ length: 9 }).map((_, i) => (
            <React.Fragment key={i}>
              <rect x={152 + i * 6} y="70" width="3" height="4" fill="#475569" />
              <rect x={152 + i * 6} y="128" width="3" height="4" fill="#475569" />
            </React.Fragment>
          ))}

          {/* USB-C */}
          <rect x="60" y="92" width="14" height="20" rx="4" fill="#94a3b8" />
          <rect x="63" y="96" width="8" height="12" rx="3" fill="#475569" />

          {/* RGB LED */}
          <circle className="esp-led" cx="224" cy="62" r="4" fill="#22c55e" />

          {/* 排針 */}
          {Array.from({ length: 14 }).map((_, i) => (
            <circle key={i} cx={80 + i * 12} cy="150" r="2.4" fill="url(#gold)" />
          ))}
          {Array.from({ length: 14 }).map((_, i) => (
            <circle key={`t${i}`} cx={80 + i * 12} cy="50" r="2.4" fill="url(#gold)" />
          ))}
        </g>

        {/* 標註線 + 文字 */}
        <g fontFamily="monospace" fontSize="8">
          {/* 天線 */}
          <line x1="170" y1="40" x2="170" y2="22" stroke="#3b82f6" strokeWidth="1" />
          <circle cx="170" cy="22" r="2" fill="#3b82f6" />
          <text x="176" y="20" fill="#93c5fd">2.4GHz Wi-Fi 天線</text>
          {/* 晶片 */}
          <line x1="204" y1="100" x2="290" y2="100" stroke="#a855f7" strokeWidth="1" />
          <circle cx="290" cy="100" r="2" fill="#a855f7" />
          <text x="236" y="96" fill="#c4b5fd">雙核 240MHz</text>
          {/* USB */}
          <line x1="60" y1="102" x2="24" y2="120" stroke="#22c55e" strokeWidth="1" />
          <circle cx="24" cy="120" r="2" fill="#22c55e" />
          <text x="10" y="135" fill="#86efac">USB-C 供電</text>
          {/* LED */}
          <line x1="224" y1="62" x2="284" y2="48" stroke="#f59e0b" strokeWidth="1" />
          <circle cx="284" cy="48" r="2" fill="#f59e0b" />
          <text x="250" y="40" fill="#fcd34d">RGB 狀態燈</text>
        </g>
      </svg>
    </div>
  );
}
