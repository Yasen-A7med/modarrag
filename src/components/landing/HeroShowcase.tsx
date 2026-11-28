"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, PlayCircle, ShieldCheck } from "lucide-react";
import { SPRING_EASE } from "@/components/motion/MotionPrimitives";
import { buttonVariants } from "@/components/ui/Button";

export interface HeroShowcaseProps {
  readonly schoolSlug: string;
}

/**
 * Animated Hero section featuring the clean 3D amphitheater sculpture,
 * Logo Idea navy-royal-cyan typography accents, and ultra-clear actions.
 */
export function HeroShowcase({ schoolSlug }: HeroShowcaseProps) {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-12">
      <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-10">
        {/* Hero Copy (Start / Right in RTL) */}
        <div className="flex flex-col items-start lg:col-span-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.36, ease: SPRING_EASE }}
            className="inline-flex items-center gap-2 rounded-full border border-[#2563EB]/25 bg-[var(--bg-surface)]/95 px-4 py-1.5 text-sm font-bold text-[#0A1F44] shadow-xs backdrop-blur-sm dark:border-cyan-400/35 dark:text-cyan-200"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-[#22D3EE]" aria-hidden="true" />
            <ShieldCheck className="h-4 w-4 shrink-0 text-[#2563EB] dark:text-cyan-300" />
            <span>السنتر المدرسي الرسمي الآمن</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.44, delay: 0.06, ease: SPRING_EASE }}
            className="mt-5 text-3xl font-bold leading-[1.24] text-[#0A1F44] dark:text-[var(--text-primary)] sm:text-4xl lg:text-[2.85rem]"
          >
            احجز مكانك في مدرج مدرستك{" "}
            <span className="bg-gradient-to-l from-[#0A1F44] via-[#2563EB] to-[#0891B2] bg-clip-text text-transparent dark:from-[#60A5FA] dark:via-[#38BDF8] dark:to-[#22D3EE]">
              باسمك وفي ثانية واحدة
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.44, delay: 0.12, ease: SPRING_EASE }}
            className="mt-4 max-w-xl text-base leading-relaxed text-[var(--text-secondary)] sm:text-lg"
          >
            تنظيم رسمي لحصص المراجعة والمحاضرات المسجلة داخل قاعات المدرسة بسعة آمنة ومعلمين معتمدين — بدون تكدس السناتر، وبدون تذاكر معقدة.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.44, delay: 0.18, ease: SPRING_EASE }}
            className="mt-7 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center"
          >
            <Link
              href={`/s/${schoolSlug}`}
              className={buttonVariants({
                variant: "primary",
                size: "lg",
                className: "w-full sm:w-auto shadow-md shadow-blue-600/20",
              })}
            >
              <span>ابدأ الحجز الآن</span>
              <ArrowLeft className="h-5 w-5" />
            </Link>

            <Link
              href={`/s/${schoolSlug}/lectures`}
              className={buttonVariants({
                variant: "emerald",
                size: "lg",
                className: "w-full sm:w-auto shadow-md shadow-emerald-600/15",
              })}
            >
              <PlayCircle className="h-5 w-5" />
              <span>المحاضرات المسجلة</span>
            </Link>

            <Link
              href="/login"
              className={buttonVariants({
                variant: "outline",
                size: "lg",
                className: "w-full sm:w-auto bg-[var(--bg-surface)]/95 backdrop-blur-sm",
              })}
            >
              <span>جرّب الحسابات الجاهزة</span>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.24, ease: SPRING_EASE }}
            className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-[var(--text-secondary)]"
          >
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#16A34A] dark:text-emerald-400" />
              تسجيل حضور بالاسم مباشرة
            </span>
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#2563EB] dark:text-cyan-400" />
              مقاعد آمنة ومحددة السعة
            </span>
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#0891B2] dark:text-teal-400" />
              محاضرات مسجلة بخصوصية مرنة
            </span>
          </motion.div>
        </div>

        {/* Clean 3D Frosted Amphitheater Visual without distracting floating overlays */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.52, delay: 0.1, ease: SPRING_EASE }}
          className="relative lg:col-span-6"
        >
          <div className="art-pedestal relative overflow-hidden rounded-3xl p-2 sm:p-3">
            <div className="relative overflow-hidden rounded-2xl bg-[#F6F8FC] dark:brightness-[0.95] dark:contrast-[1.03]">
              <Image
                src="/images/hero-modarrag-3d.webp"
                alt="مجسم ثلاثي الأبعاد لمدرج مدرسي منظم بمقاعد آمنة ومنصة شرح"
                width={1100}
                height={613}
                priority
                className="h-auto w-full object-cover transition-transform duration-700 ease-out hover:scale-[1.02]"
              />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
