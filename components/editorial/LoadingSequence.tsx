"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check } from "lucide-react";

/**
 * The "reading the piece / reading the fashion signal" loader used across
 * every AI wait state in the app — steps advance on a timer purely for
 * perceived progress; the real work finishes whenever the request resolves.
 */
export function LoadingSequence({
  headline,
  steps,
  stepDurationMs = 900,
}: {
  headline: string;
  steps: string[];
  stepDurationMs?: number;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (activeIndex >= steps.length - 1) return;
    const timer = setTimeout(() => setActiveIndex((i) => i + 1), stepDurationMs);
    return () => clearTimeout(timer);
  }, [activeIndex, steps.length, stepDurationMs]);

  return (
    <div className="flex flex-col items-center justify-center gap-8 py-16 text-center">
      <div className="relative h-16 w-16">
        <span className="absolute inset-0 rounded-full border border-line" />
        <motion.span
          className="absolute inset-0 rounded-full border-t-2 border-rescue"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
        />
      </div>
      <div>
        <p className="font-serif-display text-2xl italic text-ink">{headline}</p>
      </div>
      <ul className="flex flex-col gap-2.5">
        {steps.map((step, i) => (
          <li key={step} className="flex items-center gap-2.5 text-sm">
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                i < activeIndex
                  ? "border-signal bg-signal text-paper"
                  : i === activeIndex
                    ? "border-rescue animate-pulse-soft"
                    : "border-line"
              }`}
            >
              {i < activeIndex && <Check size={10} strokeWidth={3} />}
            </span>
            <AnimatePresence mode="wait">
              <motion.span
                key={i <= activeIndex ? "active" : "pending"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={i <= activeIndex ? "text-ink" : "text-ink-faint"}
              >
                {step}
              </motion.span>
            </AnimatePresence>
          </li>
        ))}
      </ul>
    </div>
  );
}
