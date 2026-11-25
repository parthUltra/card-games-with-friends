"use client";

import { motion } from "framer-motion";

const HERO_CARDS = [
  { src: "/cards/hearts/A_of_hearts.png", alt: "Ace of hearts", rotate: -16, x: -96, y: 22 },
  { src: "/cards/spades/K_of_spades.png", alt: "King of spades", rotate: -8, x: -48, y: 6 },
  { src: "/cards/diamonds/Q_of_diamonds.png", alt: "Queen of diamonds", rotate: 0, x: 0, y: 0 },
  { src: "/cards/clubs/J_of_clubs.png", alt: "Jack of clubs", rotate: 8, x: 48, y: 6 },
  { src: "/cards/hearts/10_of_hearts.png", alt: "Ten of hearts", rotate: 16, x: 96, y: 22 },
];

export function HeroFelt() {
  return (
    <div className="relative mx-auto mt-12 max-w-4xl md:mt-16">
      {/* leather rail + brass hairline around an elliptical felt */}
      <div className="rounded-[999px] bg-[var(--rail)] p-[10px] shadow-[0_40px_80px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)]">
        <div className="felt-table relative h-56 overflow-hidden rounded-[999px] md:h-72">
          <div className="table-vignette absolute inset-0" />
          <div className="absolute inset-0 flex items-center justify-center pb-8 md:pb-10" role="img" aria-label="A royal flush in hearts fanned on the felt">
            {HERO_CARDS.map((card, i) => (
              <motion.img
                key={card.src}
                src={card.src}
                alt=""
                draggable={false}
                className="pixel-card absolute h-28 w-auto rounded-md drop-shadow-[0_14px_18px_rgba(0,0,0,0.55)] md:h-40"
                initial={{ opacity: 0, y: 60, x: 0, rotate: 0, scale: 0.9 }}
                animate={{ opacity: 1, y: card.y, x: card.x, rotate: card.rotate, scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 35, delay: 0.1 + i * 0.06 }}
                whileHover={{ y: card.y - 12, transition: { duration: 0.18 } }}
              />
            ))}
          </div>
          <motion.p
            className="pot-chip tnum absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide text-[var(--brass-hi)] md:bottom-6 md:text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.2 }}
          >
            Pot 12,400 · Your table, your rules
          </motion.p>
        </div>
      </div>
    </div>
  );
}
