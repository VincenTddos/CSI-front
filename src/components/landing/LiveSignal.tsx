import React, { useEffect, useRef, useState } from 'react';

/**
 * LiveSignal — 用 canvas 即時繪製多子載波 CSI 波形（持續流動，偶發動作尖峰）。
 */
export function LiveSignal() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(8);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    let raf = 0, t = 0;
    let spike = 0; // 動作尖峰強度

    const waves = [
      { color: '#007AFF', freq: 0.035, amp: 16, speed: 0.06, phase: 0 },
      { color: '#a855f7', freq: 0.05, amp: 11, speed: 0.09, phase: 1.5 },
      { color: '#22c55e', freq: 0.07, amp: 8, speed: 0.13, phase: 3 },
    ];

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      // 網格
      ctx.strokeStyle = 'rgba(148,163,184,0.15)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y <= H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      const envelope = 1 + spike * 2.2 + 0.35 * Math.sin(t * 0.4);
      waves.forEach((w) => {
        ctx.beginPath();
        ctx.strokeStyle = w.color;
        ctx.lineWidth = 2;
        for (let x = 0; x <= W; x++) {
          const noise = spike * (Math.random() - 0.5) * 10;
          const y = H / 2 + Math.sin(x * w.freq + t * w.speed + w.phase) * w.amp * envelope + noise;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      });

      // 衰減尖峰
      spike *= 0.97;
      t += 1;
      raf = requestAnimationFrame(draw);
    };
    draw();

    // 偶發動作尖峰
    const spikeTimer = setInterval(() => { if (Math.random() < 0.5) spike = 0.6 + Math.random() * 0.8; }, 2600);
    // 分數讀數
    const scoreTimer = setInterval(() => {
      setScore(Math.round(6 + spike * 90 + Math.random() * 6));
    }, 400);

    return () => { cancelAnimationFrame(raf); clearInterval(spikeTimer); clearInterval(scoreTimer); };
  }, []);

  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> CSI 子載波即時訊號
        </span>
        <span className="text-xs font-mono text-slate-400">
          移動分數 <span className={`font-bold ${score > 60 ? 'text-red-500' : score > 25 ? 'text-amber-500' : 'text-green-500'}`}>{score}</span>
        </span>
      </div>
      <canvas ref={ref} width={520} height={180} className="w-full rounded-lg bg-[#F8FAFC]" />
      <div className="flex gap-4 mt-2 text-[10px] text-slate-400">
        <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-[#007AFF]" /> 子載波 1</span>
        <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-purple-500" /> 子載波 2</span>
        <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-green-500" /> 子載波 3</span>
      </div>
    </div>
  );
}
