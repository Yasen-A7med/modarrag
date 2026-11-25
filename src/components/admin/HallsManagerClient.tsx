"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeftRight,
  Building2,
  MapPin,
  Pencil,
  Plus,
  Wrench,
} from "lucide-react";
import {
  reallocateSessionHallAction,
  updateHallStatusAction,
  upsertHallAction,
  type HallOccupancyData,
} from "@/application/halls/actions";
import { HallGaugeRing } from "@/components/admin/LiveOccupancyBento";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Input, SelectInput } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import type { HallStatus } from "@/infrastructure/supabase/database.types";
import { HALL_STATUS_TONES, type BadgeTone } from "@/lib/design-tokens";
import {
  formatArabicNumber,
  formatCairoDate,
  formatCairoTimeRange,
} from "@/lib/formatters";
import { cn } from "@/lib/utils";

const HALL_STATUS_OPTIONS: ReadonlyArray<{
  readonly value: HallStatus;
  readonly label: string;
}> = [
  { value: "active", label: "نشطة" },
  { value: "maintenance", label: "صيانة" },
  { value: "archived", label: "مؤرشفة" },
];

const HALL_STATUS_LABELS_AR: Readonly<Record<HallStatus, string>> = {
  active: "نشطة",
  maintenance: "صيانة",
  archived: "مؤرشفة",
};

function resolveHallBadge(status: HallStatus): {
  readonly label: string;
  readonly tone: BadgeTone;
} {
  return {
    label: HALL_STATUS_LABELS_AR[status],
    tone: HALL_STATUS_TONES[status],
  };
}

export interface ReallocatableSession {
  readonly id: string;
  readonly titleAr: string;
  readonly hallId: string;
  readonly hallCode: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly bookedSeatsCount: number;
}

export interface HallsManagerClientProps {
  readonly schoolSlug: string;
  readonly halls: HallOccupancyData["halls"];
  readonly activeSessions: readonly ReallocatableSession[];
}

/**
 * School Admin Halls Manager: radial occupancy rings, create/edit hall dialog,
 * status switching, and emergency hall reallocation panel.
 */
export function HallsManagerClient({
  schoolSlug,
  halls,
  activeSessions,
}: HallsManagerClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  // Upsert Hall dialog state
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | undefined>(undefined);
  const [code, setCode] = React.useState("");
  const [nameAr, setNameAr] = React.useState("");
  const [buildingAr, setBuildingAr] = React.useState("");
  const [floorLabelAr, setFloorLabelAr] = React.useState("");
  const [maxCapacity, setMaxCapacity] = React.useState("60");
  const [hallStatus, setHallStatus] = React.useState<HallStatus>("active");
  const [hasProjector, setHasProjector] = React.useState(true);
  const [hasAc, setHasAc] = React.useState(true);
  const [savingHall, setSavingHall] = React.useState(false);

  // Status update tracking
  const [updatingStatusHallId, setUpdatingStatusHallId] = React.useState<string | null>(
    null
  );

  // Emergency reallocation state
  const firstSession = activeSessions[0];
  const [selectedSessionId, setSelectedSessionId] = React.useState<string>(
    firstSession?.id ?? ""
  );
  const [targetHallId, setTargetHallId] = React.useState<string>("");
  const [reallocating, setReallocating] = React.useState(false);
  const [reallocationError, setReallocationError] = React.useState<string | null>(null);

  const selectedSession =
    activeSessions.find((s) => s.id === selectedSessionId) ?? firstSession;
  const activeHalls = React.useMemo(
    () => halls.filter((h) => h.status === "active"),
    [halls]
  );
  const candidateTargetHalls = React.useMemo(
    () =>
      selectedSession
        ? activeHalls.filter((h) => h.id !== selectedSession.hallId)
        : activeHalls,
    [activeHalls, selectedSession]
  );

  const effectiveTargetHallId = candidateTargetHalls.some((h) => h.id === targetHallId)
    ? targetHallId
    : (candidateTargetHalls[0]?.id ?? "");

  const openCreateModal = () => {
    setEditId(undefined);
    setCode("");
    setNameAr("");
    setBuildingAr("");
    setFloorLabelAr("");
    setMaxCapacity("60");
    setHallStatus("active");
    setHasProjector(true);
    setHasAc(true);
    setModalOpen(true);
  };

  const openEditModal = (hall: HallOccupancyData["halls"][number]) => {
    setEditId(hall.id);
    setCode(hall.code);
    setNameAr(hall.nameAr);
    setBuildingAr(hall.buildingAr ?? "");
    setFloorLabelAr(hall.floorLabelAr ?? "");
    setMaxCapacity(String(hall.maxCapacity));
    setHallStatus(hall.status);
    setModalOpen(true);
  };

  const handleSaveHall = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedCap = Number.parseInt(maxCapacity, 10);
    if (Number.isNaN(parsedCap) || parsedCap < 1 || parsedCap > 2000) {
      toast({
        title: "سعة القاعة غير صالحة",
        description: "يرجى إدخال سعة بين ١ و ٢٠٠٠ مقعد.",
        variant: "error",
      });
      return;
    }

    setSavingHall(true);
    try {
      const result = await upsertHallAction({
        schoolSlug,
        ...(editId ? { id: editId } : {}),
        code: code.trim().toUpperCase(),
        nameAr: nameAr.trim(),
        ...(buildingAr.trim() ? { buildingAr: buildingAr.trim() } : {}),
        ...(floorLabelAr.trim() ? { floorLabelAr: floorLabelAr.trim() } : {}),
        maxCapacity: parsedCap,
        status: hallStatus,
        amenities: {
          projector: hasProjector,
          airConditioning: hasAc,
        },
      });

      if (!result.ok) {
        toast({
          title: "تعذر حفظ بيانات القاعة",
          description: result.error.message,
          variant: "error",
        });
        return;
      }

      toast({
        title: editId ? "تم تحديث بيانات القاعة" : "تم إضافة القاعة الجديدة",
        variant: "success",
      });
      setModalOpen(false);
      router.refresh();
    } finally {
      setSavingHall(false);
    }
  };

  const handleStatusChange = async (hallId: string, nextStatus: HallStatus) => {
    setUpdatingStatusHallId(hallId);
    try {
      const result = await updateHallStatusAction({
        schoolSlug,
        hallId,
        status: nextStatus,
      });

      if (!result.ok) {
        toast({
          title: "تعذر تغيير حالة القاعة",
          description: result.error.message,
          variant: "error",
        });
        return;
      }

      toast({
        title: `تم تحديث حالة القاعة إلى "${HALL_STATUS_LABELS_AR[nextStatus]}"`,
        variant: "success",
      });
      router.refresh();
    } finally {
      setUpdatingStatusHallId(null);
    }
  };

  const handleReallocate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedSession || !effectiveTargetHallId) {
      setReallocationError("يرجى اختيار الحصة والقاعة البديلة.");
      return;
    }

    setReallocating(true);
    setReallocationError(null);
    try {
      const result = await reallocateSessionHallAction({
        schoolSlug,
        sessionId: selectedSession.id,
        newHallId: effectiveTargetHallId,
      });

      if (!result.ok) {
        setReallocationError(result.error.message);
        toast({
          title: "تعذر نقل الحصة",
          description: result.error.message,
          variant: "error",
        });
        return;
      }

      toast({
        title: "تم نقل الحصة إلى القاعة البديلة بنجاح",
        variant: "success",
      });
      router.refresh();
    } finally {
      setReallocating(false);
    }
  };

  const selectedTargetHall = halls.find((h) => h.id === effectiveTargetHallId);
  const capacityMismatch =
    Boolean(selectedSession && selectedTargetHall) &&
    (selectedTargetHall?.maxCapacity ?? 0) < (selectedSession?.bookedSeatsCount ?? 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Header Bar */}
      <Card>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] sm:text-2xl">
              إدارة القاعات والمدرجات
            </h1>
            <p className="mt-0.5 text-xs sm:text-sm text-[var(--text-muted)]">
              مراقبة الإشغال اللحظي، تعديل السعات وحالات الصيانة، ونقل الحصص عند الطوارئ
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            className="min-h-[44px]"
            onClick={openCreateModal}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            إضافة قاعة / مدرج
          </Button>
        </div>
      </Card>

      {/* Halls Cards with Radial Occupancy Rings & Status Controls */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {halls.map((hall) => {
          const statusMeta = resolveHallBadge(hall.status);
          const busyStatus = updatingStatusHallId === hall.id;

          return (
            <Card key={hall.id} className="flex flex-col justify-between gap-4 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="mono" dir="ltr">
                      {hall.code}
                    </Badge>
                    <Badge variant={statusMeta.tone} dot={hall.status === "active"}>
                      {statusMeta.label}
                    </Badge>
                  </div>
                  <h2 className="mt-2 text-base font-bold text-[var(--text-primary)]">
                    {hall.nameAr}
                  </h2>
                  {(hall.buildingAr || hall.floorLabelAr) && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--text-muted)]">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {[hall.buildingAr, hall.floorLabelAr].filter(Boolean).join(" · ")}
                      </span>
                    </p>
                  )}
                </div>

                <HallGaugeRing
                  booked={hall.currentBookedCount}
                  capacity={hall.maxCapacity}
                  status={hall.status}
                  size={84}
                />
              </div>

              <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-sunken)] px-3 py-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">السعة والإشغال الحالي</span>
                  <span className="font-mono font-semibold text-[var(--text-primary)] tabular-nums">
                    {formatArabicNumber(hall.currentBookedCount)} /{" "}
                    {formatArabicNumber(hall.maxCapacity)} مقعد
                  </span>
                </div>
                <p className="mt-1 truncate text-[11px] text-[var(--text-secondary)]">
                  {hall.currentSessionTitleAr
                    ? `جاري الآن: ${hall.currentSessionTitleAr}`
                    : "لا توجد حصة جارية في هذا التوقيت"}
                </p>
              </div>

              {/* Status Switcher + Edit Button */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-hairline)] pt-3">
                <div
                  className="inline-flex rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-1"
                  role="group"
                  aria-label={`تغيير حالة ${hall.nameAr}`}
                >
                  {HALL_STATUS_OPTIONS.map((opt) => {
                    const active = hall.status === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={busyStatus || active}
                        onClick={() => handleStatusChange(hall.id, opt.value)}
                        className={cn(
                          "min-h-[36px] rounded-md px-2.5 text-xs font-semibold transition-colors cursor-pointer",
                          active
                            ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs"
                            : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-[40px]"
                  onClick={() => openEditModal(hall)}
                  leftIcon={<Pencil className="h-3.5 w-3.5" />}
                >
                  تعديل
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Emergency Hall Reallocation Panel */}
      <Card>
        <CardHeader className="border-b border-[var(--border-hairline)] pb-3">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <CardTitle className="text-base">
              لوحة إعادة تخصيص القاعات عند الطوارئ والصيانة
            </CardTitle>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            نقل أي حصة مجدولة فوراً إلى قاعة نشطة بديلة مع التحقق التلقائي من عدم تداخل الجدول
          </p>
        </CardHeader>
        <CardContent className="pt-4">
          {activeSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1.5 py-6 text-center text-xs text-[var(--text-muted)]">
              <Building2 className="h-6 w-6" />
              <span>لا توجد حصص مجدولة حالياً لنقلها.</span>
            </div>
          ) : (
            <form onSubmit={handleReallocate} className="flex flex-col gap-4">
              {reallocationError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{reallocationError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <SelectInput
                  label="١ · اختيار الحصة المجدولة"
                  value={selectedSession?.id ?? ""}
                  onChange={(e) => {
                    setSelectedSessionId(e.target.value);
                    setReallocationError(null);
                  }}
                >
                  {activeSessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.titleAr} — ({s.hallCode}) · {formatCairoDate(s.startsAt)}{" "}
                      {formatCairoTimeRange(s.startsAt, s.endsAt)}
                    </option>
                  ))}
                </SelectInput>

                <SelectInput
                  label="٢ · القاعة البديلة المستهدفة"
                  value={effectiveTargetHallId}
                  onChange={(e) => {
                    setTargetHallId(e.target.value);
                    setReallocationError(null);
                  }}
                >
                  {candidateTargetHalls.length === 0 ? (
                    <option value="">لا توجد قاعات نشطة بديلة</option>
                  ) : (
                    candidateTargetHalls.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.nameAr} ({h.code}) — السعة: {formatArabicNumber(h.maxCapacity)} مقعد
                      </option>
                    ))
                  )}
                </SelectInput>
              </div>

              {selectedSession && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-sunken)] px-3.5 py-2.5 text-xs">
                  <span className="text-[var(--text-secondary)]">
                    الطلاب المحجوزون حالياً:{" "}
                    <strong className="font-mono text-[var(--text-primary)] tabular-nums">
                      {formatArabicNumber(selectedSession.bookedSeatsCount)} طالب
                    </strong>
                  </span>
                  {capacityMismatch && (
                    <span className="font-semibold text-amber-700 dark:text-amber-300">
                      تنبيه: سعة القاعة المختارة أقل من عدد الطلاب المحجوزين!
                    </span>
                  )}
                </div>
              )}

              <div>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  loading={reallocating}
                  disabled={candidateTargetHalls.length === 0 || !effectiveTargetHallId}
                  className="min-h-[44px]"
                  leftIcon={<ArrowLeftRight className="h-4 w-4" />}
                >
                  نقل الحصة للقاعة البديلة
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Hall Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editId ? "تعديل بيانات القاعة" : "إضافة قاعة أو مدرج جديد"}
            </DialogTitle>
            <DialogDescription>
              حدد كود القاعة والسعة القصوى المسموح بحجزها لضمان عدم التكدس.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveHall} className="mt-4 flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="كود القاعة"
                dir="ltr"
                required
                maxLength={20}
                placeholder="HALL-01"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <Input
                label="اسم القاعة بالعربية"
                required
                maxLength={120}
                placeholder="مدرج ١"
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="المبنى (اختياري)"
                maxLength={80}
                placeholder="المبنى الرئيسي"
                value={buildingAr}
                onChange={(e) => setBuildingAr(e.target.value)}
              />
              <Input
                label="الدور (اختياري)"
                maxLength={40}
                placeholder="الدور الأرضي"
                value={floorLabelAr}
                onChange={(e) => setFloorLabelAr(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="السعة القصوى (مقعد)"
                type="number"
                required
                min={1}
                max={2000}
                value={maxCapacity}
                onChange={(e) => setMaxCapacity(e.target.value)}
              />
              <SelectInput
                label="الحالة التشغيلية"
                value={hallStatus}
                onChange={(e) => setHallStatus(e.target.value as HallStatus)}
              >
                {HALL_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </SelectInput>
            </div>

            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex min-h-[40px] items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasProjector}
                  onChange={(e) => setHasProjector(e.target.checked)}
                  className="h-4 w-4 rounded"
                />
                <span>جهاز عرض (بروجيكتور)</span>
              </label>
              <label className="flex min-h-[40px] items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasAc}
                  onChange={(e) => setHasAc(e.target.checked)}
                  className="h-4 w-4 rounded"
                />
                <span>تهوية وتكييف</span>
              </label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px]"
                onClick={() => setModalOpen(false)}
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={savingHall}
                className="min-h-[44px]"
              >
                حفظ القاعة
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
