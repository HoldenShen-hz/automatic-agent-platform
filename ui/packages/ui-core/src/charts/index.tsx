import type { ReactElement } from "react";
import { designTokens } from "../design-tokens";
export { ChartTableFallback, EChartSurface } from "./echart-surface";

export function MetricGrid({ metrics }: { metrics: readonly { label: string; value: string | number }[] }): ReactElement {
  return (
    <div
      role="group"
      aria-label="Metric summary grid"
      style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}
    >
      {metrics.map((metric) => (
        <div
          key={metric.label}
          role="group"
          aria-label={`${metric.label}: ${metric.value}`}
          style={{ border: `1px solid ${designTokens.color.border}`, borderRadius: designTokens.radius.md, padding: 14 }}
        >
          <div style={{ color: designTokens.color.subtle, fontSize: 12 }}>{metric.label}</div>
          <div style={{ color: designTokens.color.text, fontSize: 24, fontWeight: 700 }}>{metric.value}</div>
        </div>
      ))}
    </div>
  );
}

export function MiniTrendBars({ values }: { values: readonly number[] }): ReactElement {
  const maxValue = Math.max(...values, 1);
  const trendLabel = values.length === 0
    ? "No trend data available"
    : `Trend values: ${values.join(", ")}`;
  return (
    <div
      role="img"
      aria-label={trendLabel}
      style={{ display: "flex", gap: 6, alignItems: "flex-end", minHeight: 44 }}
    >
      {values.map((value, index) => (
        <span
          key={`${index}-${value}`}
          aria-hidden="true"
          style={{
            width: 10,
            height: `${Math.max(8, (value / maxValue) * 44)}px`,
            borderRadius: 999,
            background: designTokens.color.accent,
            opacity: 0.65 + index / Math.max(values.length, 1) * 0.35,
          }}
        />
      ))}
    </div>
  );
}
