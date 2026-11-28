"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeftRight,
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
import { formatArabicNumber, formatCairoDate, formatCairoTimeRange } from "@/lib/formatters";
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
 * Slide 8 Blueprint: Halls grid with Maintenance Glow + Automatic Centered
 * Emergency Reallocation Modal when switching an occupied hall to maintenance.
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
  const [savingHall, setSavingHall] = React.useState(false);

  const [updatingStatusHallId, setUpdatingStatusHallId] = React.useState<string | null>(null);

  // Slide 8 Centered Emergency Reallocation Modal (triggered automatically on maintenance switch if sessions exist)
  const [emergencyModalOpen, setEmergencyModalOpen] = React.useState(false);
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
    if (Number.isNaN(parsedCap) || parsedCap < 10 || parsedCap > 500) {
      toast({
        title: "سعة القاعة غير صالحة",
        description: "يرجى إدخال سعة بين ١٠ و ٥٠٠ مقعد.",
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
        amenities: { projector: true, airConditioning: true },
      });

      if (!result.ok) {
        toast({
          title: "تعذر حفظ القاعة",
          description: result.error.message,
          variant: "error",
        });
        return;
      }

      toast({
        title: editId ? "تم تحديث القاعة ✓" : "تمت إضافة القاعة ✓",
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
        title: `تم تحويل الحالة إلى "${HALL_STATUS_LABELS_AR[nextStatus]}"`,
        variant: nextStatus === "maintenance" ? "warning" : "success",
      });

      // Slide 8 interactive flow: if switched to maintenance and active sessions use this hall,
      // automatically pop open the Emergency Reallocation Modal pre-targeted to that session.
      if (nextStatus === "maintenance") {
        const affectedSession = activeSessions.find((s) => s.hallId === hallId);
        if (affectedSession) {
          setSelectedSessionId(affectedSession.id);
          setReallocationError(null);
          setEmergencyModalOpen(true);
        }
      }
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
        title: "تم نقل الحصة وتوجيه الطلاب ✓",
        variant: "success",
      });
      setEmergencyModalOpen(false);
      router.refresh();
    } finally {
      setReallocating(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card className="rounded-[2rem]">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <Badge variant="info" size="md">
              المدرجات والقاعات
            </Badge>
            <h1 className="mt-2 text-2xl font-extrabold text-[var(--text-primary)]">
              إدارة القاعات والإشغال
            </h1>
            <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
              مراقبة لحظية، تحويل لصيانة الطوارئ، وتوجيه تلقائي للحصص
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeSessions.length > 0 && (
              <Button
                variant="outline"
                size="md"
                onClick={() => setEmergencyModalOpen(true)}
                leftIcon={<ArrowLeftRight className="h-4 w-4 text-amber-600" />}
              >
                نقل حصة طارئ
              </Button>
            )}
            <Button
              variant="primary"
              size="md"
              onClick={openCreateModal}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              إضافة قاعة
            </Button>
          </div>
        </div>
      </Card>

      {/* Halls Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {halls.map((hall) => {
          const statusMeta = resolveHallBadge(hall.status);
          const isMaintenance = hall.status === "maintenance";
          const busyStatus = updatingStatusHallId === hall.id;

          return (
            <Card
              key={hall.id}
              className={cn(
                "flex flex-col justify-between gap-4 p-5 transition-all",
                isMaintenance &&
                  "border-amber-400 bg-amber-50/35 ring-2 ring-amber-400/20 dark:border-amber-500/45 dark:bg-amber-950/15"
              )}
            >
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
                  <h2 className="mt-2 text-lg font-extrabold text-[var(--text-primary)]">
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

              <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)] px-3.5 py-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">السعة والإشغال</span>
                  <span className="font-bold text-[var(--text-primary)] tabular-nums">
                    {formatArabicNumber(hall.currentBookedCount)} /{" "}
                    {formatArabicNumber(hall.maxCapacity)} مقعد
                  </span>
                </div>
                <p className="mt-1 truncate text-[11px] text-[var(--text-secondary)]">
                  {hall.currentSessionTitleAr
                    ? `جاري الآن: ${hall.currentSessionTitleAr}`
                    : "متاحة للحجز"}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-hairline)] pt-3">
                <div className="inline-flex rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-1">
                  {HALL_STATUS_OPTIONS.map((opt) => {
                    const active = hall.status === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={busyStatus || active}
                        onClick={() => handleStatusChange(hall.id, opt.value)}
                        className={cn(
                          "min-h-[36px] rounded-lg px-2.5 text-xs font-bold transition-colors cursor-pointer",
                          active
                            ? opt.value === "maintenance"
                              ? "bg-amber-500 text-white"
                              : "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs"
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

      {/* Add / Edit Hall Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "تعديل بيانات القاعة" : "إضافة قاعة جديدة"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveHall} className="mt-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="كود القاعة"
                required
                dir="ltr"
                placeholder="HALL-3"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <Input
                label="السعة (مقاعد)"
                type="number"
                required
                min={10}
                max={500}
                dir="ltr"
                value={maxCapacity}
                onChange={(e) => setMaxCapacity(e.target.value)}
              />
            </div>
            <Input
              label="اسم القاعة"
              required
              placeholder="مثال: مدرج العلوم الرئيسي"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="المبنى (اختياري)"
                value={buildingAr}
                onChange={(e) => setBuildingAr(e.target.value)}
              />
              <Input
                label="الدور (اختياري)"
                value={floorLabelAr}
                onChange={(e) => setFloorLabelAr(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit" variant="primary" loading={savingHall}>
                حفظ
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Slide 8: Centered Emergency Reallocation Modal */}
      <Dialog open={emergencyModalOpen} onOpenChange={setEmergencyModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <Wrench className="h-5 w-5" />
              <span>نقل حصة لقاعة بديلة (طوارئ)</span>
            </DialogTitle>
            <DialogDescription>
              اختر الحصة المتأثرة والقاعة البديلة المتاحة ليتم تحديث الجدول وإخطار الجميع تلقائياً.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleReallocate} className="mt-4 flex flex-col gap-4">
            {reallocationError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 dark:bg-red-500/10 dark:text-red-300"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{reallocationError}</span>
              </div>
            )}

            <SelectInput
              label="الحصة الحالية"
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
            >
              {activeSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.titleAr} — ({s.hallCode}) · {formatArabicNumber(s.bookedSeatsCount)} طالب
                </option>
              ))}
            </SelectInput>

            {selectedSession && (
              <p className="rounded-xl bg-[var(--bg-sunken)] px-3 py-2 text-xs text-[var(--text-secondary)] tabular-nums">
                {formatCairoDate(selectedSession.startsAt)} ·{" "}
                {formatCairoTimeRange(selectedSession.startsAt, selectedSession.endsAt)}
              </p>
            )}

            <SelectInput
              label="القاعة البديلة المتاحة"
              value={effectiveTargetHallId}
              onChange={(e) => setTargetHallId(e.target.value)}
            >
              {candidateTargetHalls.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.nameAr} ({formatArabicNumber(h.maxCapacity)} مقعد)
                </option>
              ))}
            </SelectInput>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEmergencyModalOpen(false)}
              >
                إغلاق
              </Button>
              <Button type="submit" variant="primary" loading={reallocating}>
                توجيه وإخطار الجميع
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Also keep quick card access to Emergency Reallocation */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowLeftRight className="h-4 w-4 text-[#2563EB]" />
            <span>الحصص القادمة القابلة للنقل ({formatArabicNumber(activeSessions.length)})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeSessions.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">
              لا توجد حصص حضورية قادمة حالياً.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {activeSessions.slice(0, 6).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)] px-3 py-2.5 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold text-[var(--text-primary)]">{s.titleAr}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {s.hallCode} · {formatArabicNumber(s.bookedSeatsCount)} طالب
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedSessionId(s.id);
                      setReallocationError(null);
                      setEmergencyModalOpen(true);
                    }}
                  >
                    نقل
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
