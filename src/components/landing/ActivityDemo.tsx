import React, { useEffect, useState } from 'react';

/**
 * ActivityDemo — 循環演示 6 級活動辨識：圓形儀表 + 標籤隨分數變化。
 */
const STATES = [
  { label: '睡眠 / 靜止', icon: '😴', score: 5, color: '#22c55e' },
  { label: '靜坐', icon: '🪑', score: 16, color: '#22c55e' },
  { label: '輕微活動', icon: '💺', score: 32, color: '#3b82f6' },
  { label: '行走', icon: '🚶', score: 54, color: '#3b82f6' },
  { label: '激烈活動', icon: '🏃', score: 78, color: '#f59e0b' },
  { label: '跌倒風險', icon: '⚠️', score: 96, color: '#ef4444' },
];

const R = 54;
const C = 2 * Math.PI * R;

export function ActivityDemo() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setI((p) => (p + 1) % STATES.length), 2300);
    return () => clearInterval(timer);
  }, []);
  const s = STATES[i];
  const offset = C * (1 - s.score / 100);

  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-xl flex flex-col items-center">
      <span className="text-xs font-bold text-slate-500 self-start mb-2 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#007AFF] animate-pulse" /> AI 活動辨識
      </span>
      <div className="relative w-40 h-40">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 130 130">
          <circle cx="65" cy="65" r={R} fill="none" stroke="#eef2f7" strokeWidth="11" />
          <circle cx="65" cy="65" r={R} fill="none" stroke={s.color} strokeWidth="11" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset .9s cubic-bezier(.22,1,.36,1), stroke .6s' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl">{s.icon}</span>
          <span className="text-2xl font-black mt-1" style={{ color: s.color, transition: 'color .5s' }}>{s.score}</span>
        </div>
      </div>
      <p className="mt-3 text-lg font-bold text-slate-800" style={{ transition: 'color .4s' }}>{s.label}</p>
      {/* 狀態指示點 */}
      <div className="flex gap-1.5 mt-3">
        {STATES.map((st, idx) => (
          <span key={idx} className="w-2 h-2 rounded-full transition-all"
            style={{ background: idx === i ? st.color : '#e2e8f0', transform: idx === i ? 'scale(1.3)' : 'scale(1)' }} />
        ))}
      </div>
    </div>
  );
}
