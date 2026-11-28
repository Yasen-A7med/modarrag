"use client";

import Image from "next/image";
import { motion } from "framer-motion";

/**
 * Clean, unobstructed 3D educational auditorium showcase for the Modarrag Hero.
 * Zero overlaid floating badges over the artwork.
 */
export function HeroShowcase() {
  return (
    <div className="relative mx-auto w-full max-w-[540px] select-none">
      <div
        className="pointer-events-none absolute -inset-4 rounded-[2.5rem] bg-gradient-to-br from-[#2563EB]/12 via-[#22D3EE]/12 to-transparent blur-2xl dark:from-blue-500/20 dark:via-cyan-400/15"
        aria-hidden="true"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-[2rem] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-2 shadow-[0_24px_56px_-20px_rgba(10,31,68,0.18)] dark:shadow-[0_24px_64px_-20px_rgba(0,0,0,0.65)]"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[1.5rem] bg-[#F1F5F9] dark:bg-[#0D1322]">
          <Image
            src="/images/hero-modarrag-3d.webp"
            alt="منصة مُدَرَّج لتنظيم الحصص المدرسية والأونلاين"
            fill
            priority
            sizes="(max-width: 768px) 94vw, 520px"
            className="object-cover"
          />
        </div>
      </motion.div>
    </div>
  );
}
