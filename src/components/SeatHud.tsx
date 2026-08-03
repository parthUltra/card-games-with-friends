"use client";

import { motion, AnimatePresence } from "framer-motion";
import { PlayingCard } from "@/components/PlayingCard";
import { avatarSrc } from "@/lib/avatars";
import type { PlayerPublic } from "@/lib/poker/engine";

type Props = {
  player: PlayerPublic;
  active: boolean;
  isDealer: boolean;
  reveal: boolean;
};

export function SeatHud({ player, active, isDealer, reveal }: Props) {
  return (
    <motion.div
      layout
      animate={{
        scale: active ? 1.04 : 1,
        opacity: player.busted ? 0.4 : player.folded ? 0.55 : 1,
      }}
      className={`seat-hud relative w-[104px] rounded-2xl px-2.5 py-2 text-center md:w-[118px] ${
        active ? "seat-hud-active" : "seat-hud-idle"
      }`}
    >
      {isDealer && (
        <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--cream)] font-display text-[10px] font-bold text-[var(--ink)] shadow">
          D
        </span>
      )}

      <div className="relative mx-auto h-11 w-11">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarSrc(player.avatarId)}
          alt=""
          className="h-11 w-11 rounded-full ring-2 ring-black/40"
        />
        {active && (
          <span className="absolute inset-0 animate-ping rounded-full bg-[var(--gold)]/30" />
        )}
      </div>

      <p className="mt-1.5 truncate text-xs font-semibold tracking-wide">
        {player.name}
      </p>
      <p className="font-display text-sm tabular-nums text-[var(--gold-soft)]">
        {player.stack.toLocaleString()}
      </p>

      <AnimatePresence>
        {player.bet > 0 && !player.busted && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-1 inline-flex rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-[var(--cream)]"
          >
            {player.bet.toLocaleString()}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-1.5 flex min-h-[54px] justify-center gap-1">
        {reveal && player.hole && player.hole.length === 2
          ? player.hole.map((c, i) => (
              <PlayingCard key={i} card={c} size="sm" flipIn delay={i * 0.08} />
            ))
          : Array.from({ length: player.holeCount }).map((_, i) => (
              <PlayingCard
                key={i}
                faceDown
                size="sm"
                deal
                delay={i * 0.06}
                dimmed={player.folded}
              />
            ))}
      </div>

      {(player.folded || player.allIn || player.busted) && (
        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[var(--cream)]/60">
          {player.busted ? "Out" : player.folded ? "Fold" : "All-in"}
        </p>
      )}
    </motion.div>
  );
}
