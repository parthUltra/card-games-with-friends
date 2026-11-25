"use client";

import { AnimatePresence, motion } from "framer-motion";
import { PlayingCard } from "@/components/PlayingCard";
import { CountUp } from "@/components/table/CountUp";
import { TurnRing } from "@/components/table/TurnRing";
import { avatarSrc } from "@/lib/avatars";
import type { PlayerPublic } from "@/lib/poker/engine";
import { handRankLabel, type HandRankName } from "@/lib/poker/hand";

type Props = {
  player: PlayerPublic;
  active: boolean;
  /** Someone else is acting: dim to 70% so the active seat pops */
  idle: boolean;
  isDealer: boolean;
  reveal: boolean;
  winner: boolean;
  badge: string | null;
  isHero?: boolean;
  /** Desktop: larger avatar ring */
  big?: boolean;
  clock: { endsAt: number | null; totalMs: number; skew: number };
};

/** Compact seat pod: avatar with turn ring, name, stack, mini cards and a status badge. */
export function SeatHud({ player, active, idle, isDealer, reveal, winner, badge, isHero, big, clock }: Props) {
  const out = player.busted;
  const status = out ? "Out" : player.folded ? "Fold" : player.allIn ? "All-in" : player.sittingOut ? "Away" : badge;
  const showFaces = reveal && player.hole?.length === 2 && !isHero;

  return (
    <motion.div
      className={`pod ${active ? "pod-active" : ""} ${winner ? "pod-win" : ""} ${isHero ? "pod-hero" : ""}`}
      animate={{
        opacity: out ? 0.35 : player.folded ? 0.5 : idle ? 0.7 : 1,
        scale: winner ? [1, 1.04, 1] : 1,
      }}
      transition={{ type: "spring", stiffness: 300, damping: 25, scale: { duration: 0.35, ease: "easeOut" } }}
      aria-label={`${isHero ? "You" : player.name}, ${player.stack.toLocaleString()} chips${status ? `, ${status}` : ""}${active ? ", acting" : ""}`}
    >
      {!isHero && !showFaces && player.holeCount > 0 && !out && (
        <div className="pod-cards" aria-hidden>
          {Array.from({ length: player.holeCount }).map((_, i) => (
            <PlayingCard key={i} faceDown size="sm" deal delay={i * 0.06} dimmed={player.folded} />
          ))}
        </div>
      )}

      <TurnRing endsAt={active ? clock.endsAt : null} totalMs={clock.totalMs} skew={clock.skew} size={(big ? 56 : 40) + (isHero ? 4 : 0)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarSrc(player.avatarId)} alt="" className="pod-avatar" />
      </TurnRing>

      <div className="pod-info">
        <span className="pod-name">{isHero ? "You" : player.name}</span>
        <CountUp value={player.stack} className="pod-stack" />
      </div>

      {showFaces && (
        <div className="pod-cards-up">
          {player.hole!.map((c, i) => (
            <PlayingCard key={`${c.rank}${c.suit}`} card={c} size="sm" flipIn delay={i * 0.08} highlight={winner} />
          ))}
        </div>
      )}

      {isDealer && <span className="dealer-btn" aria-label="Dealer">D</span>}

      <AnimatePresence>
        {(status || (reveal && player.handName)) && (
          <motion.span
            key={reveal && player.handName ? player.handName : status}
            className={`pod-badge ${reveal && player.handName ? "pod-badge-hand" : ""} ${status === "All-in" ? "pod-badge-allin" : ""}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {reveal && player.handName ? handRankLabel(player.handName as HandRankName) : status}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
