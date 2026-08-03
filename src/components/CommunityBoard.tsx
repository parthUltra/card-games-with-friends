"use client";

import { AnimatePresence, motion } from "framer-motion";
import { PlayingCard } from "@/components/PlayingCard";
import type { Card } from "@/lib/cards";

type Props = {
  board: Card[];
  street: string;
};

function streetLabel(street: string) {
  switch (street) {
    case "preflop":
      return "Preflop";
    case "flop":
      return "Flop";
    case "turn":
      return "Turn";
    case "river":
      return "River";
    case "showdown":
      return "Showdown";
    default:
      return street;
  }
}

export function CommunityBoard({ board, street }: Props) {
  return (
    <div className="flex flex-col items-center gap-3">
      <motion.div
        key={street}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-full border border-white/10 bg-black/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--gold-soft)]"
      >
        {streetLabel(street)}
      </motion.div>

      <div className="relative flex min-h-[86px] items-center justify-center gap-2 md:min-h-[100px] md:gap-2.5">
        {/* empty slots for feel */}
        {board.length === 0 && (
          <div className="flex gap-2 opacity-25">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-[78px] w-[58px] rounded-[0.45rem] border border-dashed border-white/25 md:h-[86px] md:w-[64px]"
              />
            ))}
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {board.map((card, i) => {
            const isFlopCard = i < 3;
            const delay =
              street === "flop" && isFlopCard
                ? 0.12 + i * 0.18
                : street === "turn" && i === 3
                  ? 0.15
                  : street === "river" && i === 4
                    ? 0.15
                    : i * 0.06;
            return (
              <PlayingCard
                key={`${card.rank}-${card.suit}-${i}`}
                card={card}
                size="md"
                deal
                flipIn
                delay={delay}
              />
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
