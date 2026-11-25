"use client";

import { useEffect, useRef, useState } from "react";

type Clock = { endsAt: number | null; totalMs: number; skew: number };

/** Server-time "now" on this client: skew = serverNow - Date.now() at the last response. */
const serverNow = (skew: number) => Date.now() + skew;

/**
 * SVG countdown ring drawn around a child (avatar). Driven by rAF straight to the DOM,
 * so it never re-renders React and never jumps when polls land.
 */
export function TurnRing({ endsAt, totalMs, skew, size, children }: Clock & { size: number; children: React.ReactNode }) {
  const circle = useRef<SVGCircleElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const r = size / 2 - 2;
  const c = 2 * Math.PI * r;

  useEffect(() => {
    if (!endsAt) return;
    let raf = 0;
    let shown = -1;
    const draw = () => {
      const left = Math.max(0, Math.min(1, (endsAt - serverNow(skew)) / totalMs));
      const offset = c * (1 - left);
      const el = circle.current;
      // Only touch the DOM when the arc moves ≥0.5px: smooth to the eye, near-zero paint cost.
      if (el && Math.abs(offset - shown) >= 0.5) {
        shown = offset;
        el.style.strokeDashoffset = String(offset);
        el.style.stroke = left > 0.33 ? "var(--action)" : left > 0.15 ? "#F5B748" : "var(--danger)";
        wrap.current?.classList.toggle("ring-urgent", left <= 0.15);
      }
      if (left > 0) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [endsAt, totalMs, skew, c]);

  return (
    <div ref={wrap} className="ring-wrap" style={{ width: size, height: size }}>
      {children}
      {endsAt && (
        <svg className="ring-svg" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" />
          <circle
            ref={circle}
            cx={size / 2}
            cy={size / 2}
            r={r}
            className="ring-bar"
            strokeDasharray={c}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
      )}
    </div>
  );
}

/** Whole seconds left on a deadline, ticking locally (null when there is no deadline). */
export function useSecondsLeft(endsAt: number | null, skew: number) {
  const [secs, setSecs] = useState<number | null>(null);
  useEffect(() => {
    if (!endsAt) return;
    const tick = () => setSecs(Math.max(0, Math.ceil((endsAt - serverNow(skew)) / 1000)));
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 250);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [endsAt, skew]);
  return endsAt ? secs : null;
}

/** " · 12s" suffix; isolated so the ticking re-renders only this span. */
export function Countdown({ endsAt, skew }: { endsAt: number | null; skew: number }) {
  const secs = useSecondsLeft(endsAt, skew);
  return secs === null ? null : <span className="secs"> · {secs}s</span>;
}
