import type { ReactElement } from "react";
import { designTokens } from "../design-tokens";
import { PieChart, TimelineChart } from "../components/extended";
export { EChartSurface } from "./echart-surface";

export function MetricGrid({ metrics }: { metrics: readonly { label: string; value: string | number }[] }): ReactElement {
  return (
    <div role="group" aria-label="Metric summary grid" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
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
  return (
    <div role="img" aria-label={`Trend values: ${values.join(", ")}`} style={{ display: "flex", gap: 6, alignItems: "flex-end", minHeight: 44 }}>
      {values.map((value, index) => (
        <span
          key={`${index}-${value}`}
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

export function SparklineBars({ values }: { values: readonly number[] }): ReactElement {
  return <MiniTrendBars values={values} />;
}

export function BarChart({
  points,
}: {
  points: readonly { label: string; value: number; tone?: string }[];
}): ReactElement {
  const max = Math.max(...points.map((point) => point.value), 1);
  return (
    <div role="img" aria-label="Bar chart" style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, minHeight: 160 }}>
        {points.map((point, index) => (
          <div key={`${point.label}-${index}`} style={{ flex: 1, display: "grid", gap: 8 }}>
            <div
              style={{
                height: `${Math.max(16, (point.value / max) * 150)}px`,
                borderRadius: `${designTokens.radius.md} ${designTokens.radius.md} 0 0`,
                background: point.tone ?? designTokens.color.accent,
                opacity: 0.72 + index / Math.max(points.length, 1) * 0.2,
              }}
            />
            <div style={{ color: designTokens.color.subtle, fontSize: 12, textAlign: "center" }}>{point.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ScatterPlot({
  points,
}: {
  points: readonly { label: string; x: number; y: number }[];
}): ReactElement {
  const maxX = Math.max(...points.map((point) => point.x), 1);
  const maxY = Math.max(...points.map((point) => point.y), 1);
  return (
    <svg viewBox="0 0 220 160" role="img" aria-label="Scatter plot" style={{ width: "100%", minHeight: 160 }}>
      <rect x="0" y="0" width="220" height="160" rx="16" fill={designTokens.color.surfaceElevated} stroke={designTokens.color.border} />
      {points.map((point, index) => (
        <g key={`${point.label}-${index}`}>
          <circle
            cx={24 + (point.x / maxX) * 172}
            cy={132 - (point.y / maxY) * 100}
            r="6"
            fill={index % 2 === 0 ? designTokens.color.accent : designTokens.color.info}
          />
          <title>{`${point.label}: ${point.x}, ${point.y}`}</title>
        </g>
      ))}
    </svg>
  );
}

export function GaugeChart({
  label,
  value,
  max = 100,
}: {
  label: string;
  value: number;
  max?: number;
}): ReactElement {
  const ratio = Math.max(0, Math.min(1, value / Math.max(max, 1)));
  return (
    <div role="img" aria-label={`${label}: ${Math.round(ratio * 100)}%`} style={{ display: "grid", gap: 12, justifyItems: "center" }}>
      <div
        style={{
          width: 144,
          height: 144,
          borderRadius: "50%",
          border: `1px solid ${designTokens.color.border}`,
          background: `conic-gradient(${designTokens.color.accent} 0 ${ratio * 360}deg, ${designTokens.color.surfaceElevated} ${ratio * 360}deg 360deg)`,
        }}
      />
      <div style={{ textAlign: "center" }}>
        <div style={{ color: designTokens.color.subtle, fontSize: 12 }}>{label}</div>
        <div style={{ color: designTokens.color.text, fontSize: 24, fontWeight: 700 }}>{Math.round(ratio * 100)}%</div>
      </div>
    </div>
  );
}

export function HeatmapGrid({
  rows,
  columns,
  values,
}: {
  rows: readonly string[];
  columns: readonly string[];
  values: readonly (readonly number[])[];
}): ReactElement {
  const maxValue = Math.max(...values.flat(), 1);
  return (
    <div role="img" aria-label="Heatmap grid" style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: `96px repeat(${columns.length}, minmax(0, 1fr))`, gap: 6 }}>
        <span />
        {columns.map((column) => (
          <span key={column} style={{ color: designTokens.color.subtle, fontSize: 12, textAlign: "center" }}>{column}</span>
        ))}
        {rows.map((row, rowIndex) => (
          <div key={row} style={{ display: "contents" }}>
            <span style={{ color: designTokens.color.subtle, fontSize: 12 }}>{row}</span>
            {columns.map((column, columnIndex) => {
              const value = values[rowIndex]?.[columnIndex] ?? 0;
              const alpha = 0.12 + (value / maxValue) * 0.72;
              return (
                <span
                  key={`${row}-${column}`}
                  title={`${row} / ${column}: ${value}`}
                  style={{
                    minHeight: 32,
                    borderRadius: designTokens.radius.sm,
                    border: `1px solid ${designTokens.color.border}`,
                    background: `rgba(34, 197, 94, ${alpha.toFixed(2)})`,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export { PieChart, TimelineChart };
