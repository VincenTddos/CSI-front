import React, { useEffect, useRef, useState } from 'react';

/**
 * Reveal — 進入視窗時淡入上移（IntersectionObserver，無第三方套件）。
 */
export function Reveal({
  children, className = '', delay = 0, as: Tag = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: React.ElementType;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);
  // react-three-fiber 會把 three 元素併入 react 的 JSX 內建元素，使多型的
  // React.ElementType 共同 props 退化為 never；此處 Tag 是任意 DOM 標籤，以 any 還原可渲染。
  const Component: any = Tag;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) { setShown(true); io.disconnect(); }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Component
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : 'translateY(28px)',
        transition: `opacity .7s ease ${delay}ms, transform .7s cubic-bezier(.22,1,.36,1) ${delay}ms`,
      }}
    >
      {children}
    </Component>
  );
}
