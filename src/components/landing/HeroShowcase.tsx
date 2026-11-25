"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, ShieldCheck, Users } from "lucide-react";
import { SPRING_EASE } from "@/components/motion/MotionPrimitives";
import { buttonVariants } from "@/components/ui/Button";

export interface HeroShowcaseProps {
  readonly schoolSlug: string;
}

/**
 * Animated Ruwaq-inspired Hero section featuring frosted 3D amphitheater render,
 * staggered editorial copy, and gently floating safe-capacity reassurance chips.
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
            className="inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-[var(--bg-surface)]/90 px-4 py-1.5 text-sm font-semibold text-[#0B63CE] shadow-xs backdrop-blur-sm dark:border-blue-500/35 dark:text-blue-300"
          >
            <span className="h-2 w-2 rounded-full bg-teal-500" aria-hidden="true" />
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>السنتر المدرسي الرسمي الآمن</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.44, delay: 0.06, ease: SPRING_EASE }}
            className="mt-5 text-3xl font-bold leading-[1.24] text-[var(--text-primary)] sm:text-4xl lg:text-[2.85rem]"
          >
            احجز مكانك في مدرج مدرستك{" "}
            <span className="bg-gradient-to-l from-[#254EDB] to-[#0D9488] bg-clip-text text-transparent dark:from-[#6C8CFF] dark:to-[#2DD4BF]">
              باسمك وفي ثانية واحدة
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.44, delay: 0.12, ease: SPRING_EASE }}
            className="mt-4 max-w-xl text-base leading-relaxed text-[var(--text-secondary)] sm:text-lg"
          >
            تنظيم رسمي لحصص المراجعة داخل قاعات المدرسة بسعة آمنة ومعلمين معتمدين — بدون تكدس السناتر، وبدون تذاكر معقدة.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.44, delay: 0.18, ease: SPRING_EASE }}
            className="mt-7 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center"
          >
            <Link
              href={`/s/${schoolSlug}`}
              className={buttonVariants({
                variant: "emerald",
                size: "lg",
                className: "w-full sm:w-auto shadow-md shadow-emerald-600/15",
              })}
            >
              <span>ابدأ الحجز الآن</span>
              <ArrowLeft className="h-5 w-5" />
            </Link>

            <Link
              href="/login"
              className={buttonVariants({
                variant: "outline",
                size: "lg",
                className: "w-full sm:w-auto bg-[var(--bg-surface)]/90 backdrop-blur-sm",
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
              <CheckCircle2 className="h-4 w-4 text-[#16A34A] dark:text-emerald-400" />
              مقاعد آمنة ومحددة السعة
            </span>
          </motion.div>
        </div>

        {/* 3D Frosted Amphitheater Visual + Floating Glass Reassurance Chips */}
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

            {/* Floating Chip 1: Safe Organized Capacity */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.34, ease: SPRING_EASE }}
              className="float-slow glass-bar hidden sm:flex absolute top-5 start-5 items-center gap-3 rounded-2xl px-3.5 py-2.5"
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#254EDB] to-[#0D9488] text-white shadow-xs">
                <Users className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[var(--text-primary)]">
                  سعة قاعات آمنة ١٠٠٪
                </p>
                <p className="text-[11px] font-medium text-[var(--text-secondary)]">
                  مقعد مخصص بدون تكدس
                </p>
              </div>
            </motion.div>

            {/* Floating Chip 2: Effortless Name Attendance */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.44, ease: SPRING_EASE }}
              className="float-delayed glass-bar hidden sm:flex absolute bottom-5 end-5 items-center gap-3 rounded-2xl px-3.5 py-2.5"
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-[#16A34A] dark:text-emerald-300">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>الحضور بالاسم فوراً</span>
                </p>
                <p className="text-[11px] font-medium text-[var(--text-secondary)]">
                  بدون تذاكر أو خطوات صعبة
                </p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
