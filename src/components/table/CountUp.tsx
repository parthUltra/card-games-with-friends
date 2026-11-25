"use client";

import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect } from "react";

/** Number that rolls to its new value (≤350ms) instead of jumping. */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => Math.round(v).toLocaleString());
  useEffect(() => {
    const ctl = animate(mv, value, { duration: 0.35, ease: "easeOut" });
    return () => ctl.stop();
  }, [value, mv]);
  return <motion.span className={className}>{text}</motion.span>;
}
