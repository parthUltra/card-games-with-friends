"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Card, cardBackImage, cardImage } from "@/lib/cards";

type Props = {
  card?: Card | null;
  faceDown?: boolean;
  /** Sizes are CSS-driven (table.css) so they scale with the viewport. */
  size?: "sm" | "md" | "lg" | "xl";
  delay?: number;
  /** Slide in from the table center then settle */
  deal?: boolean;
  /** Flip from back to face */
  flipIn?: boolean;
  dimmed?: boolean;
  /** Brass outline, e.g. cards of the winning hand */
  highlight?: boolean;
  className?: string;
};

const RANK_NAME: Record<string, string> = { A: "Ace", K: "King", Q: "Queen", J: "Jack" };
export const cardLabel = (c: Card) => `${RANK_NAME[c.rank] ?? c.rank} of ${c.suit}`;

const EASE = [0.2, 0.8, 0.2, 1] as const;

function Face({ src, alt, back }: { src: string; alt: string; back?: boolean }) {
  return (
    <span className={`pc-face ${back ? "pc-back" : ""}`}>
      <Image src={src} alt={alt} fill sizes="120px" unoptimized draggable={false} />
    </span>
  );
}

export function PlayingCard({
  card,
  faceDown,
  size = "md",
  delay = 0,
  deal = false,
  flipIn = false,
  dimmed = false,
  highlight = false,
  className = "",
}: Props) {
  const showFace = !faceDown && !!card;
  const alt = showFace ? cardLabel(card) : "Face-down card";
  const flip = flipIn && showFace;

  return (
    <motion.div
      role="img"
      aria-label={alt}
      initial={
        flip
          ? { rotateY: 180, scale: 0.9, opacity: 1 }
          : deal
            ? { y: -36, scale: 0.8, opacity: 0 }
            : false
      }
      animate={{ rotateY: 0, scale: 1, y: 0, opacity: dimmed ? 0.4 : 1 }}
      transition={
        flip
          ? { duration: 0.28, ease: EASE, delay }
          : { type: "spring", stiffness: 500, damping: 35, delay, opacity: { duration: 0.15, delay } }
      }
      className={`pc pc-${size} ${highlight ? "pc-hl" : ""} ${className}`}
    >
      {flip ? (
        <>
          <Face src={cardImage(card)} alt="" />
          <Face src={cardBackImage()} alt="" back />
        </>
      ) : (
        <Face src={showFace ? cardImage(card) : cardBackImage()} alt="" />
      )}
    </motion.div>
  );
}
