import React, { useEffect, useState } from 'react';
import { AlertTriangle, BellRing, Clock, ArrowUpCircle, CheckCircle2 } from 'lucide-react';

/**
 * EscalationDemo — 循環演示「警報升級流程」：
 * 偵測跌倒 → 通知護理站 → 等待確認（倒數）→ 自動升級家屬 → 完成處理。
 * 呼應系統「未確認自動升級」能力，補完從感測到人為回應的完整鏈路。
 */
const STEPS = [
  { icon: AlertTriangle, label: '偵測跌倒', sub: 'AI 判定跌倒風險', color: '#ef4444' },
  { icon: BellRing, label: '通知護理站', sub: '即時推播警報', color: '#007AFF' },
  { icon: Clock, label: '等待確認', sub: '30 秒內需有人回應', color: '#f59e0b' },
  { icon: ArrowUpCircle, label: '自動升級', sub: '逾時轉通知家屬', color: '#f97316' },
  { icon: CheckCircle2, label: '完成處理', sub: '人員到場、解除警報', color: '#22c55e' },
];

const STEP_MS = 1500;
const WAIT_INDEX = 2; // 「等待確認」步驟，顯示倒數進度條

export function EscalationDemo() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setActive((p) => (p + 1) % STEPS.length), STEP_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
      <style>{`@keyframes escFill { from { width: 0% } to { width: 100% } }`}</style>
      <span className="text-xs font-bold text-slate-500 mb-5 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#007AFF] animate-pulse" /> 警報升級流程
      </span>

      <div className="relative">
        {STEPS.map((s, idx) => {
          const done = idx < active;
          const on = idx === active;
          const lit = done || on;
          return (
            <div key={s.label} className="flex gap-3.5 relative pb-5 last:pb-0">
              {/* 連接線 */}
              {idx < STEPS.length - 1 && (
                <span
                  className="absolute left-[18px] top-9 bottom-0 w-0.5 rounded-full"
                  style={{ background: done ? s.color : '#e2e8f0', transition: 'background .4s' }}
                />
              )}
              {/* 步驟圓點 */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 z-10"
                style={{
                  background: lit ? s.color : '#f1f5f9',
                  color: lit ? '#fff' : '#94a3b8',
                  boxShadow: on ? `0 0 0 4px ${s.color}22` : 'none',
                  transition: 'all .4s',
                }}
              >
                <s.icon className="w-4 h-4" />
              </div>
              {/* 文字 */}
              <div className="pt-1">
                <p
                  className="text-sm font-bold"
                  style={{ color: on ? s.color : done ? '#334155' : '#94a3b8', transition: 'color .4s' }}
                >
                  {s.label}
                </p>
                <p className="text-xs text-slate-400">{s.sub}</p>
                {on && idx === WAIT_INDEX && (
                  <div className="mt-2 h-1.5 w-32 rounded-full bg-amber-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-400"
                      style={{ animation: `escFill ${STEP_MS}ms linear forwards` }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
