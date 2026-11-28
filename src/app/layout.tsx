import type { Metadata, Viewport } from "next";
import { Cairo, IBM_Plex_Mono } from "next/font/google";
import { MotionConfig } from "framer-motion";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const cairoFont = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-arabic",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "مُدَرَّج — منصة تنظيم حصص المراجعة بالمدارس المصرية",
    template: "%s | مُدَرَّج",
  },
  description:
    "منصة رسمية لتنظيم حصص المراجعة المدرسية والأونلاين، حجز المقاعد بالاسم، إدارة القاعات والمطبعة، والمحاضرات المسجلة لكافة المراحل الدراسية ونظام البكالوريا.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8FAFC" },
    { media: "(prefers-color-scheme: dark)", color: "#090D16" },
  ],
};

const THEME_PREFLIGHT_SCRIPT = `(function(){try{var k='modarrag-theme';var s=localStorage.getItem(k);var d=s==='dark'||(!s&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;if(d){r.classList.add('dark');r.style.colorScheme='dark';}else{r.classList.remove('dark');r.style.colorScheme='light';}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${cairoFont.variable} ${ibmPlexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_PREFLIGHT_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-[var(--bg-canvas)] font-sans text-[var(--text-primary)] antialiased">
        <MotionConfig reducedMotion="user">
          <ToastProvider>{children}</ToastProvider>
        </MotionConfig>
      </body>
    </html>
  );
}
