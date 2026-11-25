"use client";

import { PlayingCard, cardLabel } from "@/components/PlayingCard";
import type { Card } from "@/lib/cards";

type Props = {
  board: Card[];
};

/** Five fixed slots so the board never shifts; new cards flip in (flop staggered 80ms). */
export function CommunityBoard({ board }: Props) {
  return (
    <div
      className="board"
      role="group"
      aria-label={board.length ? `Board: ${board.map(cardLabel).join(", ")}` : "Board: no cards yet"}
    >
      {[0, 1, 2, 3, 4].map((i) =>
        board[i] ? (
          <PlayingCard
            key={`${board[i].rank}${board[i].suit}`}
            card={board[i]}
            size="md"
            flipIn
            delay={i < 3 ? i * 0.08 : 0}
          />
        ) : (
          <span key={`slot-${i}`} className="board-slot" aria-hidden />
        ),
      )}
    </div>
  );
}
