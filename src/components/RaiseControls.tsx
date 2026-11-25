"use client";

import { motion } from "framer-motion";
import { snapToBB, type Preset } from "@/components/table/logic";

type Props = {
  presets: Preset[];
  min: number;
  max: number;
  bigBlind: number;
  value: number;
  verb: "Bet" | "Raise";
  onChange: (n: number) => void;
};

/** Raise sheet: presets with chip amounts, BB-snapping slider and ± stepper. Confirm lives on the dock's primary button. */
export function RaiseControls({ presets, min, max, bigBlind, value, verb, onChange }: Props) {
  const step = (dir: 1 | -1) => onChange(snapToBB(value + dir * bigBlind, min, max, bigBlind));
  return (
    <motion.div
      className="raise-sheet"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ type: "spring", stiffness: 600, damping: 40 }}
      role="group"
      aria-label={`${verb} amount`}
    >
      <div className="raise-presets">
        {presets.map((p, i) => (
          <motion.button
            key={p.label}
            type="button"
            whileTap={{ scale: 0.96 }}
            className={`preset ${value === p.amount ? "preset-on" : ""} ${p.allIn ? "preset-allin" : ""}`}
            aria-pressed={value === p.amount}
            onClick={() => onChange(p.amount)}
          >
            <span className="preset-label">
              {p.label}
              <kbd aria-hidden>{i + 1}</kbd>
            </span>
            <span className="preset-amt">{p.amount.toLocaleString()}</span>
          </motion.button>
        ))}
      </div>

      <div className="raise-row">
        <button type="button" className="stepper" onClick={() => step(-1)} disabled={value <= min} aria-label={`Decrease by ${bigBlind}`}>
          −
        </button>
        <input
          type="range"
          className="raise-slider"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(e) => onChange(snapToBB(Number(e.target.value), min, max, bigBlind))}
          aria-label={`${verb} to`}
          aria-valuetext={`${verb} to ${value.toLocaleString()}${value === max ? ", all-in" : ""}`}
        />
        <button type="button" className="stepper" onClick={() => step(1)} disabled={value >= max} aria-label={`Increase by ${bigBlind}`}>
          +
        </button>
      </div>
      <p className="raise-amt">
        <span>{verb} to</span> <strong>{value.toLocaleString()}</strong>
        <span className="raise-hint">↑↓ ±BB · Enter confirm · Esc cancel</span>
      </p>
    </motion.div>
  );
}
