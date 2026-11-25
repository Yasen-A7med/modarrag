import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Readex_Pro } from "next/font/google";
import { MotionConfig } from "framer-motion";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const readexPro = Readex_Pro({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
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
    default: "مُدَرَّج — احجز مقعدك في مدرج مدرستك بسهولة",
    template: "%s | مُدَرَّج",
  },
  description:
    "منصة مدرسية بسيطة لتنظيم وحجز مدرجات المحاضرات بالاسم لطلاب البكالوريا المصرية — بدون تكدس أو تعقيد.",
  applicationName: "مُدَرَّج",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F8FF" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0E14" },
  ],
};

const THEME_INIT_SCRIPT = `(function(){try{var k='modarrag-theme';var t=localStorage.getItem(k);var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;if(d){r.classList.add('dark');r.style.colorScheme='dark';}else{r.classList.remove('dark');r.style.colorScheme='light';}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      suppressHydrationWarning
      className={`${readexPro.variable} ${ibmPlexMono.variable}`}
    >
      <head>
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-[var(--bg-canvas)] text-[var(--text-primary)] antialiased">
        <MotionConfig reducedMotion="user">
          <ToastProvider>{children}</ToastProvider>
        </MotionConfig>
      </body>
    </html>
  );
}
