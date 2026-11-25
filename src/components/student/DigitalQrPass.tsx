"use client";

import * as React from "react";
import QRCode from "qrcode";
import {
  Calendar,
  Check,
  Clock,
  Copy,
  Download,
  MapPin,
  Printer,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import type { BookingTicketData } from "@/application/bookings/actions";
import { ModarragLogo } from "@/components/brand/ModarragLogo";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { BookingStatus } from "@/infrastructure/supabase/database.types";
import { BOOKING_STATUS_TONES } from "@/lib/design-tokens";
import {
  BOOKING_STATUS_LABELS,
  formatCairoDate,
  formatCairoTimeRange,
} from "@/lib/formatters";
import { cn } from "@/lib/utils";

export interface DigitalQrPassProps {
  readonly ticket: BookingTicketData;
  readonly schoolSlug: string;
  readonly schoolNameAr?: string;
  readonly showBackLink?: boolean;
}

function getBookingStatusMeta(status: string): {
  readonly labelAr: string;
  readonly tone: (typeof BOOKING_STATUS_TONES)[BookingStatus];
} {
  if (status in BOOKING_STATUS_LABELS) {
    const key = status as BookingStatus;
    return {
      labelAr: BOOKING_STATUS_LABELS[key].ar,
      tone: BOOKING_STATUS_TONES[key],
    };
  }
  return { labelAr: status, tone: "neutral" };
}

function buildQrSvgPath(qrToken: string): {
  readonly size: number;
  readonly pathData: string;
} {
  const qr = QRCode.create(qrToken, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const segments: string[] = [];

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (qr.modules.get(row, col)) {
        segments.push(`M${col},${row}h1v1h-1z`);
      }
    }
  }

  return {
    size,
    pathData: segments.join(""),
  };
}

/**
 * Apple-Wallet-style digital lecture hall pass with crisp 1px borders,
 * dashed perforation notches, high-contrast light QR plaque, PNG export, and print support.
 */
export function DigitalQrPass({
  ticket,
  schoolSlug,
  schoolNameAr,
}: DigitalQrPassProps) {
  const { toast } = useToast();
  const [downloading, setDownloading] = React.useState(false);
  const [copiedField, setCopiedField] = React.useState<"ref" | "token" | null>(null);

  const statusMeta = getBookingStatusMeta(ticket.status);
  const isActiveQr = ticket.status === "confirmed" || ticket.status === "checked_in";

  const qrMatrix = React.useMemo(() => {
    try {
      return buildQrSvgPath(ticket.qrToken);
    } catch {
      return null;
    }
  }, [ticket.qrToken]);

  const dateLabel = React.useMemo(() => {
    try {
      return formatCairoDate(ticket.sessionStartsAt, { includeWeekday: true });
    } catch {
      return ticket.sessionStartsAt;
    }
  }, [ticket.sessionStartsAt]);

  const timeRangeLabel = React.useMemo(() => {
    try {
      return formatCairoTimeRange(ticket.sessionStartsAt, ticket.sessionEndsAt);
    } catch {
      return "";
    }
  }, [ticket.sessionStartsAt, ticket.sessionEndsAt]);

  const handleCopy = async (value: string, kind: "ref" | "token") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(kind);
      toast({
        title: kind === "ref" ? "تم نسخ رقم المرجع" : "تم نسخ رمز التذكرة",
        variant: "success",
      });
      window.setTimeout(() => {
        setCopiedField((prev) => (prev === kind ? null : prev));
      }, 2000);
    } catch {
      toast({
        title: "تعذر النسخ التلقائي",
        description: "يمكنك تحديد النص ونسخه يدوياً.",
        variant: "warning",
      });
    }
  };

  const handleDownloadPng = async () => {
    setDownloading(true);
    try {
      const width = 800;
      const height = 1080;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Canvas context unavailable");
      }

      // Background canvas
      ctx.fillStyle = "#F8FAFC";
      ctx.fillRect(0, 0, width, height);

      // Pass outer card
      const cardX = 48;
      const cardY = 48;
      const cardW = width - 96;
      const cardH = height - 96;

      ctx.fillStyle = "#FFFFFF";
      ctx.strokeStyle = "#CBD5E1";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 24);
      ctx.fill();
      ctx.stroke();

      // Header band
      ctx.fillStyle = "#1E3A8A";
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, 132, [24, 24, 0, 0]);
      ctx.fill();

      ctx.direction = "rtl";
      ctx.textAlign = "right";
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 32px system-ui, -apple-system, sans-serif";
      ctx.fillText("مُدَرَّج — تذكرة دخول القاعة", width - 84, 108);

      ctx.fillStyle = "#BFDBFE";
      ctx.font = "500 20px system-ui, -apple-system, sans-serif";
      ctx.fillText(schoolNameAr || schoolSlug, width - 84, 146);

      // Status pill in header
      ctx.direction = "ltr";
      ctx.textAlign = "left";
      ctx.fillStyle = "#F59E0B";
      ctx.font = "bold 20px ui-monospace, monospace";
      ctx.fillText(ticket.referenceCode, 84, 108);

      // Session info
      ctx.direction = "rtl";
      ctx.textAlign = "right";
      ctx.fillStyle = "#475569";
      ctx.font = "600 22px system-ui, -apple-system, sans-serif";
      ctx.fillText(ticket.subjectNameAr, width - 84, 234);

      ctx.fillStyle = "#0F172A";
      ctx.font = "bold 32px system-ui, -apple-system, sans-serif";
      ctx.fillText(ticket.sessionTitleAr.slice(0, 38), width - 84, 282);

      // Metadata grid boxes
      const boxes: readonly { readonly label: string; readonly value: string; readonly x: number; readonly y: number }[] = [
        { label: "رقم المقعد", value: ticket.seatNumber ?? "قائمة انتظار", x: 416, y: 326 },
        { label: "القاعة الدراسية", value: ticket.hallNameAr, x: 84, y: 326 },
        { label: "الموعد", value: `${dateLabel} · ${timeRangeLabel}`, x: 416, y: 446 },
        { label: "بيانات الطالب والمعلم", value: `${ticket.studentLabel} · معلم ${ticket.teacherCode}`, x: 84, y: 446 },
      ];

      for (const box of boxes) {
        ctx.fillStyle = "#F5F7FA";
        ctx.strokeStyle = "#E2E8F0";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(box.x, box.y, 300, 98, 12);
        ctx.fill();
        ctx.stroke();

        ctx.direction = "rtl";
        ctx.textAlign = "right";
        ctx.fillStyle = "#64748B";
        ctx.font = "500 18px system-ui, -apple-system, sans-serif";
        ctx.fillText(box.label, box.x + 280, box.y + 34);

        ctx.fillStyle = "#0F172A";
        ctx.font = "bold 21px system-ui, -apple-system, sans-serif";
        ctx.fillText(box.value.slice(0, 30), box.x + 280, box.y + 72);
      }

      // Dashed perforation divider
      ctx.save();
      ctx.setLineDash([10, 8]);
      ctx.strokeStyle = "#CBD5E1";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cardX + 20, 586);
      ctx.lineTo(cardX + cardW - 20, 586);
      ctx.stroke();
      ctx.restore();

      // QR Plaque
      const qrCanvas = document.createElement("canvas");
      await QRCode.toCanvas(qrCanvas, ticket.qrToken, {
        width: 280,
        margin: 2,
        errorCorrectionLevel: "M",
        color: { dark: "#0A0A0A", light: "#FFFFFF" },
      });

      const plaqueSize = 316;
      const plaqueX = (width - plaqueSize) / 2;
      const plaqueY = 622;

      ctx.fillStyle = "#FFFFFF";
      ctx.strokeStyle = "#CBD5E1";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(plaqueX, plaqueY, plaqueSize, plaqueSize, 14);
      ctx.fill();
      ctx.stroke();

      ctx.drawImage(qrCanvas, plaqueX + 18, plaqueY + 18, 280, 280);

      ctx.direction = "ltr";
      ctx.textAlign = "center";
      ctx.fillStyle = "#0F172A";
      ctx.font = "bold 24px ui-monospace, monospace";
      ctx.fillText(ticket.referenceCode, width / 2, 982);

      ctx.direction = "rtl";
      ctx.fillStyle = "#64748B";
      ctx.font = "500 18px system-ui, -apple-system, sans-serif";
      ctx.fillText("تذكرة موثقة رقمياً عبر منظومة مُدَرَّج — تُبرز عند بوابة القاعة", width / 2, 1014);

      const pngUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = pngUrl;
      link.download = `${ticket.referenceCode}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "تم تحميل التذكرة بصيغة PNG",
        description: ticket.referenceCode,
        variant: "success",
      });
    } catch {
      toast({
        title: "تعذر تصدير الصورة",
        description: "يمكنك استخدام زر الطباعة لحفظ التذكرة بصيغة PDF.",
        variant: "error",
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      {/* Apple-Wallet-style Pass Outer Frame (16px / rounded-2xl ceiling) */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] hairline-lift print:border-slate-300 print:shadow-none">
        {/* Top Navy Architectural Header Band */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#1E3A8A] px-5 py-4 text-white dark:bg-[#172554]">
          <div className="flex items-center gap-2.5 min-w-0">
            <ModarragLogo size="sm" showWordmark={false} />
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight">بطاقة دخول القاعة</p>
              <p className="truncate text-[11px] text-blue-100">
                {schoolNameAr || schoolSlug}
              </p>
            </div>
          </div>

          <Badge
            variant={statusMeta.tone}
            size="md"
            dot
            className="border-white/25 bg-white/15 text-white"
          >
            {statusMeta.labelAr}
          </Badge>
        </div>

        {/* Pass Body Details */}
        <div className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <Badge variant="primary" size="sm">
                {ticket.subjectNameAr}
              </Badge>
              <h1 className="mt-2 text-lg font-bold leading-snug text-[var(--text-primary)]">
                {ticket.sessionTitleAr}
              </h1>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-3">
              <p className="text-[11px] text-[var(--text-muted)]">رقم المقعد المخصص</p>
              <p
                className="mt-1 font-mono text-xl font-bold text-[#1E3A8A] tabular-nums dark:text-blue-400"
                dir="ltr"
              >
                {ticket.seatNumber ?? "WAITLIST"}
              </p>
            </div>

            <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-3">
              <p className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                <MapPin className="h-3 w-3 shrink-0" />
                <span>القاعة الدراسية</span>
              </p>
              <p className="mt-1 text-sm font-bold text-[var(--text-primary)]">
                {ticket.hallNameAr}
              </p>
            </div>

            <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-3">
              <p className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                <Calendar className="h-3 w-3 shrink-0" />
                <span>التاريخ والوقت</span>
              </p>
              <p className="mt-1 text-xs font-semibold text-[var(--text-primary)]">
                {dateLabel}
              </p>
              {timeRangeLabel && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--text-secondary)] tabular-nums">
                  <Clock className="h-3 w-3 shrink-0 text-[var(--text-muted)]" />
                  <span>{timeRangeLabel}</span>
                </p>
              )}
            </div>

            <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-3">
              <p className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                <UserCheck className="h-3 w-3 shrink-0" />
                <span>الهوية الأكاديمية</span>
              </p>
              <p className="mt-1 text-xs font-bold text-[var(--text-primary)] tabular-nums">
                {ticket.studentLabel}
              </p>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)] tabular-nums">
                معلم المادة · كود{" "}
                <span className="font-mono" dir="ltr">
                  {ticket.teacherCode}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Perforated Dashed Divider with Semicircular Side Notches */}
        <div className="relative flex items-center py-1" aria-hidden="true">
          <span className="-ms-3 h-6 w-6 shrink-0 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)]" />
          <div className="mx-1 w-full border-t-2 border-dashed border-[var(--border-strong)]" />
          <span className="-me-3 h-6 w-6 shrink-0 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)]" />
        </div>

        {/* High-Contrast QR Plaque Section */}
        <div className="flex flex-col items-center gap-3 px-5 pt-3 pb-5">
          {!isActiveQr && (
            <div className="w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-900 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-200">
              {ticket.status === "waitlisted"
                ? "هذه التذكرة في قائمة الانتظار حالياً — يتفعل رمز الدخول فور تأكيد المقعد."
                : "هذه التذكرة غير مفعلة للدخول عند البوابة."}
            </div>
          )}

          {/* Strictly light-only QR plaque for reliable gate scanning */}
          <div
            className={cn(
              "rounded-lg border border-slate-200 bg-white p-3 text-neutral-950",
              !isActiveQr && "opacity-60"
            )}
            style={{ colorScheme: "only light" }}
          >
            {qrMatrix ? (
              <svg
                viewBox={`-2 -2 ${qrMatrix.size + 4} ${qrMatrix.size + 4}`}
                className="h-48 w-48 sm:h-52 sm:w-52"
                role="img"
                aria-label={`رمز التحقق للتذكرة ${ticket.referenceCode}`}
                shapeRendering="crispEdges"
              >
                <rect
                  x={-2}
                  y={-2}
                  width={qrMatrix.size + 4}
                  height={qrMatrix.size + 4}
                  fill="#ffffff"
                />
                <path d={qrMatrix.pathData} fill="#0a0a0a" />
              </svg>
            ) : (
              <div className="flex h-48 w-48 items-center justify-center text-xs text-neutral-600">
                تعذر توليد رمز QR
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-1 text-center">
            <div className="flex items-center gap-2">
              <span
                className="font-mono text-sm font-bold tracking-wider text-[var(--text-primary)] tabular-nums"
                dir="ltr"
              >
                {ticket.referenceCode}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(ticket.referenceCode, "ref")}
                className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-[var(--border-hairline)] bg-[var(--bg-sunken)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] cursor-pointer print:hidden"
                aria-label="نسخ رقم المرجع"
              >
                {copiedField === "ref" ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            <p className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>توقيع مشفر HMAC-SHA256 · صالح لمسح واحد عند البوابة</span>
            </p>
          </div>

          <div className="flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-sunken)] px-3 py-2 print:hidden">
            <span className="min-w-0 truncate font-mono text-[11px] text-[var(--text-muted)]" dir="ltr">
              {ticket.qrToken}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="min-h-[44px]"
              onClick={() => handleCopy(ticket.qrToken, "token")}
              leftIcon={
                copiedField === "token" ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )
              }
            >
              نسخ الرمز
            </Button>
          </div>
        </div>
      </div>

      {/* Export & Print Controls */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 print:hidden">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={downloading}
          onClick={handleDownloadPng}
          leftIcon={<Download className="h-4 w-4" />}
        >
          تحميل التذكرة PNG
        </Button>
        <Button
          variant="outline"
          size="lg"
          fullWidth
          onClick={() => window.print()}
          leftIcon={<Printer className="h-4 w-4" />}
        >
          طباعة
        </Button>
      </div>
    </div>
  );
}
