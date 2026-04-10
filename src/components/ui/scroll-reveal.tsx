"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

type Direction = "up" | "down" | "left" | "right" | "none";

interface ScrollRevealProps {
  children: ReactNode;
  direction?: Direction;
  delay?: number;
  duration?: number;
  once?: boolean;
  className?: string;
  amount?: number;
}

const offsets: Record<Direction, { x?: number; y?: number }> = {
  up: { y: 40 },
  down: { y: -40 },
  left: { x: 40 },
  right: { x: -40 },
  none: {},
};

export function ScrollReveal({
  children,
  direction = "up",
  delay = 0,
  duration = 0.6,
  once = true,
  className,
  amount = 0.2,
}: ScrollRevealProps) {
  const prefersReduced = useReducedMotion();

  const offset = offsets[direction];
  const hidden = prefersReduced
    ? { opacity: 1 }
    : { opacity: 0, ...offset };
  const visible = { opacity: 1, x: 0, y: 0 };

  return (
    <motion.div
      initial={hidden}
      whileInView={visible}
      viewport={{ once, amount }}
      transition={
        prefersReduced
          ? { duration: 0 }
          : { duration, delay, ease: "easeOut" }
      }
      className={className}
    >
      {children}
    </motion.div>
  );
}
