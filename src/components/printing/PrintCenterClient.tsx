"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ExternalLink,
  FileUp,
  Layers,
  Phone,
  Printer,
  Send,
  Truck,
  Wallet,
} from "lucide-react";
import {
  createHandoutUploadIntentAction,
  createPrintOrderAction,
  updatePrintOrderStatusAction,
  type PrintCenterData,
} from "@/application/printing/actions";
import { MotionReveal } from "@/components/motion/MotionPrimitives";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, SelectInput } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import {
  calculatePrintOrderPricing,
  DEFAULT_PRINT_COMMISSION_PCT,
} from "@/domain/finance/revenue";
import type {
  PrintBindingType,
  PrintOrderStatus,
  PrintSpec,
} from "@/infrastructure/supabase/database.types";
import { formatArabicNumber, formatCairoDate } from "@/lib/formatters";

const STATUS_META: Readonly<
  Record<
    PrintOrderStatus,
    { readonly labelAr: string; readonly tone: "warning" | "info" | "primary" | "success" | "danger" }
  >
> = {
  pending: { labelAr: "قيد المراجعة", tone: "warning" },
  printing: { labelAr: "جاري الطباعة", tone: "info" },
  ready: { labelAr: "جاهز للاستلام", tone: "primary" },
  delivered: { labelAr: "تم التسليم", tone: "success" },
  cancelled: { labelAr: "ملغى", tone: "danger" },
};

const PRINT_SPEC_LABELS: Readonly<Record<PrintSpec, string>> = {
  bw_double: "أبيض وأسود (وجهين)",
  bw_single: "أبيض وأسود (وجه واحد)",
  color: "ألوان كاملة عالية الدقة",
};

const BINDING_LABELS: Readonly<Record<PrintBindingType, string>> = {
  staple: "تدبيس جانبي",
  spiral: "سلك حلزوني مع غلاف",
  none: "بدون تجليد",
};

export interface PrintCenterClientProps {
  readonly schoolSlug: string;
  readonly data: PrintCenterData;
}

/**
 * Online Print Shop workspace for Teachers & School Admin:
 * connects directly with contracted local print partners, uploads PDF handouts,
 * computes transparent VAT 14% + commission totals, and tracks fulfillment.
 */
export function PrintCenterClient({ schoolSlug, data }: PrintCenterClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [partnerId, setPartnerId] = React.useState(data.partners[0]?.id ?? "");
  const [sessionId, setSessionId] = React.useState(data.teacherSessions[0]?.id ?? "");
  const [titleAr, setTitleAr] = React.useState("");
  const [copiesCount, setCopiesCount] = React.useState("40");
  const [pagesCount, setPagesCount] = React.useState("16");
  const [printSpecs, setPrintSpecs] = React.useState<PrintSpec>("bw_double");
  const [bindingType, setBindingType] = React.useState<PrintBindingType>("staple");
  const [externalFileUrl, setExternalFileUrl] = React.useState("");
  const [notesAr, setNotesAr] = React.useState("");

  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [updatingOrderId, setUpdatingOrderId] = React.useState<string | null>(null);

  const selectedPartner = data.partners.find((p) => p.id === partnerId) ?? data.partners[0];
  const parsedCopies = Math.max(1, Number.parseInt(copiesCount || "1", 10) || 1);
  const parsedPages = Math.max(1, Number.parseInt(pagesCount || "1", 10) || 1);

  const livePricing = calculatePrintOrderPricing({
    copiesCount: parsedCopies,
    pagesCount: parsedPages,
    printSpecs,
    bindingType,
    vatRatePct: data.vatRatePct,
    commissionPct: selectedPartner?.commissionPct ?? DEFAULT_PRINT_COMMISSION_PCT,
  });

  const handleSubmitOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!partnerId) {
      toast({
        title: "لا توجد مطبعة مفعّلة",
        description: "يرجى إضافة أو تفعيل مطبعة شريكة أولاً.",
        variant: "error",
      });
      return;
    }

    setSubmitting(true);
    try {
      let uploadedPath: string | null = null;
      if (selectedFile) {
        setUploading(true);
        const intent = await createHandoutUploadIntentAction({
          schoolSlug,
          fileName: selectedFile.name,
        });
        if (!intent.ok) {
          setUploading(false);
          toast({
            title: "تعذر تجهيز رابط الملف",
            description: intent.error.message,
            variant: "error",
          });
          setSubmitting(false);
          return;
        }
        const uploadRes = await fetch(intent.data.signedUrl, {
          method: "PUT",
          headers: { "Content-Type": selectedFile.type || "application/pdf" },
          body: selectedFile,
        });
        setUploading(false);
        if (!uploadRes.ok) {
          toast({
            title: "تعذر رفع الملف",
            description: "يرجى المحاولة مرة أخرى أو استخدام رابط سحابي.",
            variant: "error",
          });
          setSubmitting(false);
          return;
        }
        uploadedPath = intent.data.storagePath;
      }

      const res = await createPrintOrderAction({
        schoolSlug,
        partnerId,
        sessionId: sessionId || null,
        titleAr: titleAr.trim(),
        copiesCount: parsedCopies,
        pagesCount: parsedPages,
        printSpecs,
        bindingType,
        fileStoragePath: uploadedPath,
        externalFileUrl: externalFileUrl.trim() || null,
        notesAr: notesAr.trim() || null,
      });

      if (!res.ok) {
        toast({
          title: "تعذر إرسال طلب الطباعة",
          description: res.error.message,
          variant: "error",
        });
        return;
      }

      toast({
        title: "تم إرسال طلب الطباعة للمطبعة ✓",
        description: `الإجمالي شامل الضريبة: ${formatArabicNumber(res.data.totalEgp)} ج.م`,
        variant: "success",
      });

      setTitleAr("");
      setExternalFileUrl("");
      setNotesAr("");
      setSelectedFile(null);
      router.refresh();
    } finally {
      setUploading(false);
      setSubmitting(false);
    }
  };

  const handleStatusUpdate = async (orderId: string, status: PrintOrderStatus) => {
    setUpdatingOrderId(orderId);
    try {
      const res = await updatePrintOrderStatusAction({
        schoolSlug,
        orderId,
        status,
      });
      if (!res.ok) {
        toast({
          title: "تعذر تحديث الحالة",
          description: res.error.message,
          variant: "error",
        });
        return;
      }
      toast({ title: "تم تحديث حالة الطباعة ✓", variant: "success" });
      router.refresh();
    } finally {
      setUpdatingOrderId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Compact Header */}
      <MotionReveal className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Badge variant="info" size="md">
            مطبعة مُدَرَّج أونلاين
          </Badge>
          <h1 className="mt-2 text-2xl font-extrabold text-[var(--text-primary)]">
            طباعة المذكرات والملازم
          </h1>
          <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
            أرسل ملف المذكرة مباشرةً للمطبعة المعتمدة مع حساب تلقائي للتكلفة والضريبة
          </p>
        </div>

        {selectedPartner && (
          <Card className="flex items-center gap-3 px-4 py-3 border-[#22D3EE]/40 bg-cyan-50/40 dark:bg-cyan-950/20">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#0A1F44] text-cyan-300">
              <Phone className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-bold text-[var(--text-primary)]">
                {selectedPartner.nameAr}
              </p>
              <a
                href={`tel:${selectedPartner.phone}`}
                dir="ltr"
                className="text-xs font-bold text-[#2563EB] hover:underline dark:text-cyan-300 tabular-nums"
              >
                {selectedPartner.phone}
              </a>
            </div>
          </Card>
        )}
      </MotionReveal>

      {/* Top KPI Row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4 border-b-[3px] border-b-[#2563EB]">
          <span className="text-xs font-medium text-[var(--text-muted)]">إجمالي الطلبات</span>
          <p className="mt-1.5 text-2xl font-extrabold text-[var(--text-primary)] tabular-nums">
            {formatArabicNumber(data.summary.totalOrders)}
          </p>
        </Card>
        <Card className="p-4 border-b-[3px] border-b-[#22D3EE]">
          <span className="text-xs font-medium text-[var(--text-muted)]">طلبات قيد التنفيذ</span>
          <p className="mt-1.5 text-2xl font-extrabold text-[var(--text-primary)] tabular-nums">
            {formatArabicNumber(data.summary.activeOrders)}
          </p>
        </Card>
        <Card className="p-4 border-b-[3px] border-b-emerald-500">
          <span className="text-xs font-medium text-[var(--text-muted)]">إجمالي التكلفة (شامل VAT)</span>
          <p className="mt-1.5 text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {formatArabicNumber(data.summary.totalSpentEgp)} ج.م
          </p>
        </Card>
      </div>

      {/* Split Configurator + Live Cost Breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader className="border-b border-[var(--border-hairline)] pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Printer className="h-5 w-5 text-[#2563EB] dark:text-cyan-400" />
              <span>طلب طباعة جديد</span>
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-5">
            <form onSubmit={handleSubmitOrder} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SelectInput
                  label="المطبعة المعتمدة"
                  value={partnerId}
                  onChange={(e) => setPartnerId(e.target.value)}
                >
                  {data.partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nameAr}
                    </option>
                  ))}
                </SelectInput>

                <SelectInput
                  label="الحصة المرتبطة (اختياري)"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                >
                  <option value="">بدون ربط بحصة محددة</option>
                  {data.teacherSessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.titleAr}
                    </option>
                  ))}
                </SelectInput>
              </div>

              <Input
                label="عنوان الملزمة أو المذكرة"
                required
                placeholder="مثال: مذكرة المراجعة النهائية — الفصل الثاني"
                value={titleAr}
                onChange={(e) => setTitleAr(e.target.value)}
              />

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Input
                  label="عدد النسخ"
                  type="number"
                  min={1}
                  max={5000}
                  required
                  dir="ltr"
                  value={copiesCount}
                  onChange={(e) => setCopiesCount(e.target.value)}
                />
                <Input
                  label="عدد الصفحات"
                  type="number"
                  min={1}
                  max={1000}
                  required
                  dir="ltr"
                  value={pagesCount}
                  onChange={(e) => setPagesCount(e.target.value)}
                />
                <SelectInput
                  label="نوع الطباعة"
                  value={printSpecs}
                  onChange={(e) => setPrintSpecs(e.target.value as PrintSpec)}
                >
                  <option value="bw_double">{PRINT_SPEC_LABELS.bw_double}</option>
                  <option value="bw_single">{PRINT_SPEC_LABELS.bw_single}</option>
                  <option value="color">{PRINT_SPEC_LABELS.color}</option>
                </SelectInput>
                <SelectInput
                  label="التجليد"
                  value={bindingType}
                  onChange={(e) => setBindingType(e.target.value as PrintBindingType)}
                >
                  <option value="staple">{BINDING_LABELS.staple}</option>
                  <option value="spiral">{BINDING_LABELS.spiral}</option>
                  <option value="none">{BINDING_LABELS.none}</option>
                </SelectInput>
              </div>

              <div className="rounded-2xl border-2 border-dashed border-[#2563EB]/30 bg-[var(--bg-sunken)] p-4">
                <label className="flex cursor-pointer flex-col items-center gap-2 text-center">
                  <FileUp className="h-6 w-6 text-[#2563EB] dark:text-cyan-400" />
                  <span className="text-sm font-bold text-[var(--text-primary)]">
                    {selectedFile ? selectedFile.name : "اختر ملف PDF للرفع للمطبعة"}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    PDF أو Word أو صورة — بحد أقصى ٢٥ ميجابايت
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.docx,.png,.jpg,.jpeg"
                    className="sr-only"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>

              <Input
                label="أو رابط ملف سحابي (اختياري)"
                type="url"
                dir="ltr"
                placeholder="https://drive.google.com/..."
                value={externalFileUrl}
                onChange={(e) => setExternalFileUrl(e.target.value)}
              />

              <Input
                label="ملاحظات التسليم"
                placeholder="مثال: التسليم قبل الحصة بنصف ساعة"
                value={notesAr}
                onChange={(e) => setNotesAr(e.target.value)}
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={submitting || uploading}
                leftIcon={<Send className="h-4 w-4" />}
              >
                {uploading ? "جاري رفع الملف..." : "تأكيد وإرسال للمطبعة"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Live Deterministic Invoice Preview */}
        <Card className="lg:col-span-5 bg-[#0A1F44] text-white border-[#0A1F44]">
          <CardHeader className="border-b border-white/12 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-white">
                <Wallet className="h-5 w-5 text-cyan-300" />
                <span>ملخص التكلفة والضريبة</span>
              </CardTitle>
              <span className="rounded-full bg-cyan-400/20 px-2.5 py-0.5 text-xs font-bold text-cyan-200 tabular-nums">
                VAT {formatArabicNumber(data.vatRatePct)}٪
              </span>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-4 pt-5">
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>تكلفة النسخ ({formatArabicNumber(parsedCopies)} × {formatArabicNumber(parsedPages)} صفحة)</span>
              <span className="font-bold text-white tabular-nums">
                {formatArabicNumber(livePricing.subtotalEgp)} ج.م
              </span>
            </div>

            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>ضريبة القيمة المضافة ({formatArabicNumber(data.vatRatePct)}٪)</span>
              <span className="font-bold text-amber-300 tabular-nums">
                {formatArabicNumber(livePricing.vatEgp)} ج.م
              </span>
            </div>

            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>حصة المنصة المتعاقدة ({formatArabicNumber(selectedPartner?.commissionPct ?? DEFAULT_PRINT_COMMISSION_PCT)}٪)</span>
              <span className="font-bold text-cyan-300 tabular-nums">
                {formatArabicNumber(livePricing.platformCommissionEgp)} ج.م
              </span>
            </div>

            <div className="mt-2 flex items-baseline justify-between rounded-2xl border border-cyan-400/35 bg-white/[0.06] p-4">
              <span className="text-sm font-semibold text-cyan-200">الإجمالي المطلوب</span>
              <span className="text-3xl font-extrabold text-white tabular-nums">
                {formatArabicNumber(livePricing.totalEgp)}{" "}
                <span className="text-sm font-bold text-cyan-300">ج.م</span>
              </span>
            </div>

            {selectedPartner?.addressAr && (
              <div className="flex items-start gap-2.5 rounded-xl bg-white/[0.05] p-3 text-xs text-slate-300">
                <Truck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                <span>{selectedPartner.addressAr}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Print Orders Queue */}
      <Card>
        <CardHeader className="border-b border-[var(--border-hairline)] pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4 text-[#2563EB]" />
              <span>سجل طلبات الطباعة</span>
            </CardTitle>
            <Badge variant="neutral">{formatArabicNumber(data.orders.length)} طلبات</Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {data.orders.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--text-muted)]">
              لم ترسل أي طلبات طباعة حتى الآن.
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-hairline)]">
              {data.orders.map((order) => {
                const st = STATUS_META[order.status];
                const isBusy = updatingOrderId === order.id;
                return (
                  <div
                    key={order.id}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={st.tone} dot>
                          {st.labelAr}
                        </Badge>
                        <span className="text-xs font-medium text-[var(--text-muted)] tabular-nums">
                          {formatArabicNumber(order.copiesCount)} نسخة · {formatArabicNumber(order.pagesCount)} صفحة
                        </span>
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                          {formatArabicNumber(order.totalEgp)} ج.م
                        </span>
                      </div>

                      <h3 className="mt-1.5 text-base font-bold text-[var(--text-primary)]">
                        {order.titleAr}
                      </h3>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        {order.partnerNameAr} · {PRINT_SPEC_LABELS[order.printSpecs]} ·{" "}
                        {formatCairoDate(order.createdAt)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {order.externalFileUrl && (
                        <a
                          href={order.externalFileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-[38px] items-center gap-1 rounded-xl border border-[var(--border-hairline)] px-3 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>رابط الملف</span>
                        </a>
                      )}

                      {order.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          loading={isBusy}
                          onClick={() => handleStatusUpdate(order.id, "printing")}
                        >
                          بدء الطباعة
                        </Button>
                      )}
                      {order.status === "printing" && (
                        <Button
                          size="sm"
                          variant="primary"
                          loading={isBusy}
                          onClick={() => handleStatusUpdate(order.id, "ready")}
                        >
                          جاهز للاستلام
                        </Button>
                      )}
                      {order.status === "ready" && (
                        <Button
                          size="sm"
                          variant="emerald"
                          loading={isBusy}
                          onClick={() => handleStatusUpdate(order.id, "delivered")}
                          leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
                        >
                          تم التسليم
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
