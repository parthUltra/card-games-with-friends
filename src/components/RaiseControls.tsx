"use client";

import { useEffect, useState } from "react";

type Props = {
  enabled: boolean;
  minRaiseTo: number;
  maxRaiseTo: number;
  pot: number;
  callAmount: number;
  value: number;
  onChange: (n: number) => void;
  onRaise: () => void;
  disabled?: boolean;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function RaiseControls({
  enabled,
  minRaiseTo,
  maxRaiseTo,
  pot,
  callAmount,
  value,
  onChange,
  onRaise,
  disabled,
}: Props) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  if (!enabled) return null;

  const presets = [
    { label: "Min", amount: minRaiseTo },
    { label: "2×", amount: clamp(minRaiseTo * 2, minRaiseTo, maxRaiseTo) },
    {
      label: "½ pot",
      amount: clamp(
        Math.floor(pot / 2) + callAmount,
        minRaiseTo,
        maxRaiseTo,
      ),
    },
    {
      label: "Pot",
      amount: clamp(pot + callAmount, minRaiseTo, maxRaiseTo),
    },
    { label: "All-in", amount: maxRaiseTo },
  ];

  function commitDraft() {
    const parsed = Number(draft.replace(/[^\d]/g, ""));
    if (Number.isFinite(parsed)) {
      onChange(clamp(parsed, minRaiseTo, maxRaiseTo));
    } else {
      setDraft(String(value));
    }
  }

  return (
    <div className="raise-panel space-y-3 rounded-2xl border border-[var(--line)] bg-black/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--cream)]/55">
          Raise to
        </span>
        <div className="flex items-center gap-2">
          <input
            className="input !w-28 !py-2 text-center font-display text-lg font-bold tabular-nums"
            inputMode="numeric"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitDraft();
                (e.target as HTMLInputElement).blur();
              }
            }}
            disabled={disabled}
          />
          <button
            type="button"
            className="btn btn-gold !rounded-xl !px-4 !py-2"
            disabled={disabled || value < minRaiseTo}
            onClick={() => {
              commitDraft();
              onRaise();
            }}
          >
            Raise
          </button>
        </div>
      </div>

      <input
        type="range"
        className="raise-slider w-full"
        min={minRaiseTo}
        max={maxRaiseTo}
        step={1}
        value={clamp(value, minRaiseTo, maxRaiseTo)}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />

      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-[var(--cream)]/85 transition hover:border-[var(--gold)]/50 hover:bg-white/10 disabled:opacity-40"
            disabled={disabled}
            onClick={() => onChange(p.amount)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <p className="text-center text-[11px] text-[var(--cream)]/45">
        Min {minRaiseTo.toLocaleString()} · Max {maxRaiseTo.toLocaleString()}
      </p>
    </div>
  );
}
