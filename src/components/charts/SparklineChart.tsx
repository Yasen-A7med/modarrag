import * as React from "react";
import { cn } from "@/lib/utils";

export interface SparklineChartProps {
  readonly data: readonly number[];
  readonly strokeColor?: string;
  readonly fillId?: string;
  readonly height?: number;
  readonly className?: string;
}

/**
 * Responsive SVG area sparkline matching the national analytics cards.
 */
export function SparklineChart({
  data,
  strokeColor = "#2563EB",
  height = 48,
  className,
}: SparklineChartProps) {
  const gradId = React.useId().replace(/:/g, "");
  const safeData = data.length >= 2 ? data : [1, 2, 2, 3, 4];
  const minVal = Math.min(...safeData);
  const maxVal = Math.max(...safeData);
  const span = Math.max(1, maxVal - minVal);

  const width = 200;
  const padY = 6;
  const usableH = height - padY * 2;

  const points = safeData.map((val, idx) => {
    const x = (idx / (safeData.length - 1)) * width;
    const y = padY + usableH - ((val - minVal) / span) * usableH;
    return { x, y };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("w-full overflow-visible", className)}
      style={{ height }}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={`spark-${gradId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.24" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#spark-${gradId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.length > 0 && (
        <circle
          cx={points[points.length - 1]?.x}
          cy={points[points.length - 1]?.y}
          r="3.2"
          fill={strokeColor}
        />
      )}
    </svg>
  );
}
