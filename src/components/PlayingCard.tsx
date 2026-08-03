"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Card, cardBackImage, cardImage } from "@/lib/cards";

type Props = {
  card?: Card | null;
  faceDown?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  delay?: number;
  /** Deal from above then settle */
  deal?: boolean;
  /** 3D flip from back to face */
  flipIn?: boolean;
  dimmed?: boolean;
  className?: string;
};

const SIZES = {
  sm: { w: 40, h: 54 },
  md: { w: 58, h: 78 },
  lg: { w: 88, h: 118 },
  xl: { w: 110, h: 148 },
};

export function PlayingCard({
  card,
  faceDown,
  size = "md",
  delay = 0,
  deal = false,
  flipIn = false,
  dimmed = false,
  className = "",
}: Props) {
  const dim = SIZES[size];
  const showFace = !faceDown && !!card;
  const src = showFace ? cardImage(card) : cardBackImage();

  return (
    <motion.div
      layout
      initial={
        deal || flipIn
          ? {
              y: deal ? -80 : 0,
              opacity: 0,
              scale: deal ? 0.85 : 1,
              rotateY: flipIn ? 90 : 0,
              rotateZ: deal ? -8 : 0,
            }
          : false
      }
      animate={{
        y: 0,
        opacity: dimmed ? 0.35 : 1,
        scale: 1,
        rotateY: 0,
        rotateZ: 0,
      }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 20,
        delay,
        opacity: { duration: 0.25, delay },
      }}
      className={`card-face relative shrink-0 ${className}`}
      style={{
        width: dim.w,
        height: dim.h,
        transformStyle: "preserve-3d",
        perspective: 800,
      }}
    >
      <div className="card-shell absolute inset-0 overflow-hidden rounded-[0.45rem] bg-[#f7f1e3] shadow-[0_8px_20px_rgba(0,0,0,0.45)] ring-1 ring-black/30">
        <Image
          src={src}
          alt={showFace ? `${card!.rank} of ${card!.suit}` : "Card back"}
          width={dim.w * 2}
          height={dim.h * 2}
          className="h-full w-full object-cover"
          unoptimized
          priority={size === "lg" || size === "xl"}
        />
      </div>
    </motion.div>
  );
}
