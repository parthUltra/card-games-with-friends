"use client";

import { motion } from "framer-motion";
import { avatarSrc } from "@/lib/avatars";

type Props = {
  placements: { id: string; name: string; avatarId: string; place: number }[];
  meId: string | null;
  rematchCode: string | null;
  error: string | null;
  onRematch: () => void;
  onBack: () => void;
};

const MEDAL = ["", "🥇", "🥈", "🥉"];

export function FinishedScreen({ placements, meId, rematchCode, error, onRematch, onBack }: Props) {
  const winner = placements.find((p) => p.place === 1);
  return (
    <div className="finish">
      <motion.div
        className="finish-card"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        <p className="finish-kicker">Tournament over</p>
        {winner && (
          <div className="finish-champ">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarSrc(winner.avatarId)} alt="" />
            <h1 className="font-display">{winner.id === meId ? "You win!" : `${winner.name} wins`}</h1>
          </div>
        )}
        <ol className="finish-list">
          {placements.map((p, i) => (
            <motion.li
              key={p.id}
              className={`finish-row ${p.id === meId ? "finish-me" : ""} ${p.place === 1 ? "finish-first" : ""}`}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.06 }}
            >
              <span className="finish-place">{MEDAL[p.place] || `#${p.place}`}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatarSrc(p.avatarId)} alt="" />
              <span className="finish-name">
                {p.name}
                {p.id === meId && <em> (you)</em>}
              </span>
            </motion.li>
          ))}
        </ol>
        <div className="finish-actions">
          <motion.button whileTap={{ scale: 0.96 }} type="button" className="btn btn-gold" onClick={onRematch}>
            {rematchCode ? "Join rematch" : "Rematch"}
          </motion.button>
          <motion.button whileTap={{ scale: 0.96 }} type="button" className="btn btn-ghost" onClick={onBack}>
            Back to games
          </motion.button>
        </div>
        {error && <p className="finish-error" role="alert">{error}</p>}
      </motion.div>
    </div>
  );
}
