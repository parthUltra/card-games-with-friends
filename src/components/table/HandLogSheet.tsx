"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  log: { hand: number; text: string }[];
};

/** Hand history: bottom sheet on phones, right drawer on desktop (see table.css). */
export function HandLogSheet({ open, onClose, log }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const hands = new Map<number, string[]>();
  for (let i = log.length - 1; i >= 0; i--) {
    const l = log[i];
    if (!hands.has(l.hand)) hands.set(l.hand, []);
    hands.get(l.hand)!.unshift(l.text);
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="sheet-scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div
            className="log-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Hand log"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", stiffness: 500, damping: 40 }}
          >
            <header className="log-head">
              <h2>Hand log</h2>
              <button ref={closeRef} type="button" className="icon-btn" onClick={onClose} aria-label="Close hand log">
                ✕
              </button>
            </header>
            <div className="log-body">
              {hands.size === 0 && <p className="log-empty">No actions yet.</p>}
              {[...hands].map(([hand, lines]) => (
                <section key={hand} className="log-hand">
                  <h3>Hand #{hand}</h3>
                  <ol>
                    {lines.map((t, i) => (
                      <li key={i} className={/ wins /.test(t) ? "log-win" : ""}>
                        {t}
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
