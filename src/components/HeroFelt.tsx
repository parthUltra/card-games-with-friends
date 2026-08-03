"use client";

import { motion } from "framer-motion";

const HERO_CARDS = [
  { src: "/cards/hearts/A_of_hearts.png", rotate: -14, x: -72, y: 18, delay: 0.05 },
  { src: "/cards/spades/K_of_spades.png", rotate: -6, x: -28, y: 4, delay: 0.12 },
  { src: "/cards/diamonds/Q_of_diamonds.png", rotate: 2, x: 18, y: -2, delay: 0.18 },
  { src: "/cards/clubs/J_of_clubs.png", rotate: 10, x: 64, y: 10, delay: 0.24 },
  { src: "/cards/hearts/10_of_hearts.png", rotate: 18, x: 108, y: 22, delay: 0.3 },
];

export function HeroFelt() {
  return (
    <div className="relative mx-auto mt-12 max-w-4xl">
      <div className="felt-table relative mx-auto h-56 overflow-hidden rounded-[2rem] md:h-72">
        <div className="table-vignette absolute inset-0" />
        <div className="absolute inset-0 flex items-center justify-center">
          {HERO_CARDS.map((card) => (
            <motion.img
              key={card.src}
              src={card.src}
              alt=""
              className="pixel-card absolute h-28 w-auto drop-shadow-2xl md:h-40"
              initial={{ opacity: 0, y: 36, rotate: card.rotate - 8 }}
              animate={{
                opacity: 1,
                y: card.y,
                x: card.x,
                rotate: card.rotate,
              }}
              transition={{
                type: "spring",
                stiffness: 120,
                damping: 16,
                delay: card.delay,
              }}
              whileHover={{ y: card.y - 10, transition: { duration: 0.2 } }}
            />
          ))}
        </div>
        <motion.p
          className="pot-chip absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full px-4 py-1.5 text-sm text-[var(--gold-soft)]"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.45 }}
        >
          Your table. Your rules.
        </motion.p>
      </div>
    </div>
  );
}
