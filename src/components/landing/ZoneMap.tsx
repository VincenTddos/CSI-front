import React, { useEffect, useState } from 'react';
import { Wifi } from 'lucide-react';

/**
 * ZoneMap — 俯視房型圖：人物在三個房間移動，所在區域亮燈、該裝置脈動。
 * 演示「多裝置分區偵測」（每台 ESP32 顧一個區域）。
 */
const ZONES = [
  { name: '客廳', x: 8, y: 8, w: 52, h: 50, dotX: 34, dotY: 33 },
  { name: '臥室', x: 64, y: 8, w: 36, h: 50, dotX: 82, dotY: 33 },
  { name: '浴室', x: 64, y: 62, w: 36, h: 30, dotX: 82, dotY: 77 },
];

export function ZoneMap() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setActive((p) => (p + 1) % ZONES.length), 2600);
    return () => clearInterval(timer);
  }, []);
  const person = ZONES[active];

  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
      <span className="text-xs font-bold text-slate-500 mb-3 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#007AFF] animate-pulse" /> 多裝置分區偵測
      </span>
      <div className="relative w-full" style={{ aspectRatio: '108 / 100' }}>
        <svg viewBox="0 0 108 100" className="w-full h-full">
          {ZONES.map((z, idx) => {
            const on = idx === active;
            return (
              <g key={z.name}>
                <rect x={z.x} y={z.y} width={z.w} height={z.h} rx="4"
                  fill={on ? 'rgba(0,122,255,0.12)' : '#f1f5f9'}
                  stroke={on ? '#007AFF' : '#cbd5e1'} strokeWidth={on ? 1.5 : 1}
                  style={{ transition: 'all .6s' }} />
                <text x={z.x + 5} y={z.y + 11} fontSize="5" fill={on ? '#007AFF' : '#94a3b8'}
                  style={{ transition: 'fill .6s' }} fontWeight="bold">{z.name}</text>
                {/* ESP32 裝置 */}
                <circle cx={z.x + z.w - 7} cy={z.y + 7} r={on ? 3.2 : 2.4} fill={on ? '#007AFF' : '#94a3b8'}
                  style={{ transition: 'all .4s' }}>
                  {on && <animate attributeName="opacity" values="1;0.4;1" dur="1.2s" repeatCount="indefinite" />}
                </circle>
                {on && (
                  <circle cx={z.x + z.w - 7} cy={z.y + 7} r="6" fill="none" stroke="#007AFF" strokeWidth="0.8">
                    <animate attributeName="r" values="3;9" dur="1.4s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.7;0" dur="1.4s" repeatCount="indefinite" />
                  </circle>
                )}
              </g>
            );
          })}
          {/* 人物（平滑移動到所在房間） */}
          <g style={{ transition: 'transform 1s cubic-bezier(.22,1,.36,1)', transform: `translate(${person.dotX}px, ${person.dotY}px)` }}>
            <circle r="4.5" fill="#2C363F" />
            <circle r="2" cy="-1" fill="#fff" />
          </g>
        </svg>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs">
        <span className="px-2 py-1 rounded-full bg-blue-50 text-[#007AFF] font-bold flex items-center gap-1">
          <Wifi className="w-3 h-3" /> {person.name}
        </span>
        <span className="text-slate-500">偵測到活動</span>
      </div>
    </div>
  );
}
