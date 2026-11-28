"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/infrastructure/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { getPublicEnv } from "@/lib/env";
import { cn } from "@/lib/utils";

export interface GoogleSignInButtonProps {
  readonly label?: string;
  readonly nextPath?: string;
  readonly initialGoogleEnabled?: boolean;
  readonly className?: string;
}

/**
 * Clean 1-tap Google OAuth button ("المتابعة باستخدام Google") that safely checks
 * Supabase provider readiness and redirects through /auth/callback.
 */
export function GoogleSignInButton({
  label = "المتابعة باستخدام Google",
  nextPath,
  initialGoogleEnabled,
  className,
}: GoogleSignInButtonProps) {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [setupHint, setSetupHint] = React.useState<string | null>(null);

  const handleGoogleClick = async () => {
    setLoading(true);
    setSetupHint(null);

    try {
      const env = getPublicEnv();
      let isEnabled = initialGoogleEnabled;

      // Double-check live auth settings so enabling Google in Supabase works without rebuild
      try {
        const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
          headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
          cache: "no-store",
        });
        if (res.ok) {
          const settings = (await res.json()) as {
            external?: { google?: boolean };
          };
          isEnabled = Boolean(settings.external?.google);
        }
      } catch {
        // Fall through to OAuth invocation if settings preflight failed transiently
      }

      if (isEnabled === false) {
        const message =
          "ميزة الدخول بحساب Google مفعّلة في الواجهة وجاهزة، وتحتاج فقط لإدخال Google Client ID و Secret في إعدادات Supabase (Authentication → Providers → Google).";
        setSetupHint(message);
        toast({
          title: "يرجى ربط مزود Google في لوحة Supabase",
          description: message,
          variant: "info",
        });
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      if (nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")) {
        callbackUrl.searchParams.set("next", nextPath);
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl.toString(),
          queryParams: {
            prompt: "select_account",
          },
        },
      });

      if (error) {
        toast({
          title: "تعذر فتح تسجيل الدخول عبر Google",
          description: error.message,
          variant: "error",
        });
      }
    } catch {
      toast({
        title: "حدث خطأ غير متوقع",
        description: "يرجى المحاولة مرة أخرى بعد قليل.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleGoogleClick}
        disabled={loading}
        className={cn(
          "group relative inline-flex min-h-[52px] w-full items-center justify-center gap-3 rounded-xl border border-[#0A1F44]/15 bg-white px-5 text-base font-bold text-[#0A1F44] shadow-xs transition-all duration-200 cursor-pointer",
          "hover:-translate-y-0.5 hover:border-[#2563EB]/45 hover:shadow-md active:scale-[0.98]",
          "dark:border-white/15 dark:bg-white/95 dark:text-[#0A1F44]",
          "disabled:pointer-events-none disabled:opacity-60",
          className
        )}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-[#2563EB]" aria-hidden="true" />
        ) : (
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5 shrink-0"
            aria-hidden="true"
          >
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
        )}
        <span>{loading ? "جاري التحويل إلى Google..." : label}</span>
      </button>

      {setupHint && (
        <p className="rounded-xl border border-amber-300/70 bg-amber-50/90 px-3.5 py-2.5 text-xs font-medium leading-relaxed text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200">
          {setupHint}
        </p>
      )}
    </div>
  );
}
