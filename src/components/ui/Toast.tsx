"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type Tone = "info" | "success" | "error";
type ToastItem = { id: number; text: string; tone: Tone };

const ToastContext = createContext<(text: string, tone?: Tone) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

const TONE_DOT: Record<Tone, string> = {
  info: "bg-[var(--brass)]",
  success: "bg-[var(--action)]",
  error: "bg-[var(--danger)]",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const toast = useCallback((text: string, tone: Tone = "info") => {
    const id = ++nextId.current;
    setItems((list) => [...list.slice(-2), { id, text, tone }]);
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 2600);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        aria-live="polite"
        role="status"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-8"
      >
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, transition: { duration: 0.15 } }}
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
              className="flex max-w-sm items-center gap-2.5 rounded-full border border-white/10 bg-[var(--surface-2)]/95 px-4 py-2.5 text-sm font-medium shadow-[0_12px_32px_rgba(0,0,0,0.5)] backdrop-blur-md"
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${TONE_DOT[t.tone]}`} aria-hidden />
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
