"use client";

import { RefreshCw, ShieldCheck, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatArabicNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export interface OfflineQueueBadgeProps {
  readonly isOnline: boolean;
  readonly pendingCount: number;
  readonly manifestCount: number | null;
  readonly syncing: boolean;
  readonly onSyncNow: () => void;
  readonly className?: string;
}

/**
 * Displays live online/offline status, cached Kiosk Sync Pack count,
 * and pending IndexedDB check-ins awaiting synchronization.
 */
export function OfflineQueueBadge({
  isOnline,
  pendingCount,
  manifestCount,
  syncing,
  onSyncNow,
  className,
}: OfflineQueueBadgeProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 hairline-lift",
        className
      )}
    >
      <Badge variant={isOnline ? "success" : "warning"} size="md" dot>
        {isOnline ? (
          <Wifi className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
        )}
        <span>{isOnline ? "متصل بالشبكة" : "وضع عدم الاتصال (أوفلاين)"}</span>
      </Badge>

      {manifestCount !== null ? (
        <Badge variant="info" size="md">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
          <span className="tabular-nums">
            كشف محلي: {formatArabicNumber(manifestCount)} طالب
          </span>
        </Badge>
      ) : (
        <Badge variant="neutral" size="md">
          لا يوجد كشف أوفلاين محفوظ
        </Badge>
      )}

      {pendingCount > 0 && (
        <div className="flex items-center gap-2">
          <Badge variant="warning" size="md">
            <span className="tabular-nums">
              {formatArabicNumber(pendingCount)} في طابور المزامنة
            </span>
          </Badge>
          <Button
            variant="primary"
            size="sm"
            loading={syncing}
            disabled={!isOnline || syncing}
            onClick={onSyncNow}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            className="min-h-[44px]"
          >
            مزامنة الآن
          </Button>
        </div>
      )}
    </div>
  );
}
