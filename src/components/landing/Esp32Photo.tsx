import React, { useState } from 'react';
import { Wifi, Cpu } from 'lucide-react';
import { Tilt } from './Tilt';
import { Esp32Board } from './Esp32Board';

/**
 * Esp32Photo — 真實板子照片 + 滑鼠視差 3D 傾斜。
 * 圖片放在 public/esp32-s3.png；若檔案不存在，自動 fallback 成 SVG 插圖。
 */
export function Esp32Photo() {
  const [imgOk, setImgOk] = useState(true);

  return (
    <Tilt className="w-full max-w-md mx-auto" max={14}>
      <div className="relative">
        {/* 光暈底 */}
        <div className="absolute inset-0 bg-gradient-to-tr from-[#007AFF]/25 to-purple-500/15 blur-3xl rounded-full scale-90" />

        {imgOk ? (
          <div className="relative rounded-3xl bg-white border border-slate-200 shadow-2xl p-6">
            <img
              src="/esp32-s3.png"
              alt="ESP32-S3 開發板"
              onError={() => setImgOk(false)}
              className="relative w-full object-contain drop-shadow-xl"
              style={{ transform: 'translateZ(40px)' }}
            />
            {/* 漂浮標籤（3D 層次） */}
            <div className="absolute -left-3 top-8 bg-white rounded-xl shadow-lg border border-slate-100 px-3 py-2 flex items-center gap-2"
              style={{ transform: 'translateZ(70px)' }}>
              <Wifi className="w-4 h-4 text-[#007AFF]" />
              <span className="text-xs font-bold text-slate-700">Wi-Fi + BLE</span>
            </div>
            <div className="absolute -right-3 bottom-10 bg-white rounded-xl shadow-lg border border-slate-100 px-3 py-2 flex items-center gap-2"
              style={{ transform: 'translateZ(70px)' }}>
              <Cpu className="w-4 h-4 text-purple-500" />
              <span className="text-xs font-bold text-slate-700">雙核 240MHz</span>
            </div>
          </div>
        ) : (
          <div className="relative rounded-3xl bg-white border border-slate-200 shadow-2xl p-4">
            <Esp32Board />
            <p className="text-center text-[11px] text-slate-400 mt-1">
              （把板子照片存成 <code className="bg-slate-100 px-1 rounded">public/esp32-s3.png</code> 即顯示實拍）
            </p>
          </div>
        )}
      </div>
    </Tilt>
  );
}
