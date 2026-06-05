import React, { useRef, useState } from 'react';

/**
 * Tilt — 滑鼠視差 3D 傾斜容器（無第三方套件）。
 * 滑鼠在元件上移動時，依位置即時旋轉 rotateX/rotateY，離開時回正。
 */
export function Tilt({
  children, className = '', max = 12, glare = true,
}: {
  children: React.ReactNode;
  className?: string;
  max?: number;
  glare?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [t, setT] = useState({ rx: 0, ry: 0, gx: 50, gy: 50, active: false });

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setT({ rx: -py * max * 2, ry: px * max * 2, gx: (px + 0.5) * 100, gy: (py + 0.5) * 100, active: true });
  };
  const reset = () => setT((s) => ({ ...s, rx: 0, ry: 0, active: false }));

  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={reset}
      className={className} style={{ perspective: 1000 }}>
      <div
        style={{
          transform: `rotateX(${t.rx}deg) rotateY(${t.ry}deg) scale(${t.active ? 1.03 : 1})`,
          transition: t.active ? 'transform .08s ease-out' : 'transform .5s cubic-bezier(.22,1,.36,1)',
          transformStyle: 'preserve-3d',
          position: 'relative',
        }}
      >
        {children}
        {glare && (
          <div
            className="pointer-events-none absolute inset-0 rounded-[inherit]"
            style={{
              background: `radial-gradient(circle at ${t.gx}% ${t.gy}%, rgba(255,255,255,${t.active ? 0.35 : 0}), transparent 55%)`,
              transition: 'opacity .3s', borderRadius: 'inherit',
            }}
          />
        )}
      </div>
    </div>
  );
}
