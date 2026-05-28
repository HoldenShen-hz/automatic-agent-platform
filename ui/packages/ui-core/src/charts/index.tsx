import type { ReactElement } from "react";
import { designTokens } from "../design-tokens";
import { PieChart, TimelineChart } from "../components/extended";
export { EChartSurface } from "./echart-surface";

function resolveChartTone(tone: string | undefined): string {
  switch (tone) {
    case "accent":
      return designTokens.color.accent;
    case "danger":
      return designTokens.color.danger;
    case "warning":
      return designTokens.color.warning;
    case "info":
      return designTokens.color.info;
    case "success":
      return designTokens.semantic.color.success;
    case "planned":
      return designTokens.color.planned;
    case "neutral":
    case undefined:
      return designTokens.color.accent;
    default:
      return designTokens.color.accent;
  }
}

function withAlpha(hexColor: string, alpha: number): string {
  const normalized = hexColor.replace("#", "");
  if (normalized.length !== 6) {
    return hexColor;
  }
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function ChartDataTable({ caption, headers, rows }: {
  caption: string;
  headers: readonly string[];
  rows: readonly (readonly (string | number)[])[];
}): ReactElement {
  return (
    <details style={{ marginTop: 12 }}>
      <summary>{caption}</summary>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
        <thead>
          <tr>
            {headers.map((header) => <th align="left" key={header}>{header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${caption}-${index}`}>
              {row.map((cell, cellIndex) => <td key={`${caption}-${index}-${cellIndex}`}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

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
    <div style={{ display: "grid", gap: 10 }}>
      <div role="img" aria-label={`Bar chart: ${points.map((point) => `${point.label} ${point.value}`).join(", ")}`}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, minHeight: 160 }}>
        {points.map((point, index) => (
          <div key={`${point.label}-${index}`} style={{ flex: 1, display: "grid", gap: 8 }}>
            <div
              style={{
                height: `${Math.max(16, (point.value / max) * 150)}px`,
                borderRadius: `${designTokens.radius.md} ${designTokens.radius.md} 0 0`,
                background: resolveChartTone(point.tone),
                opacity: 0.72 + index / Math.max(points.length, 1) * 0.2,
              }}
            />
            <div style={{ color: designTokens.color.subtle, fontSize: 12, textAlign: "center" }}>{point.label}</div>
          </div>
        ))}
      </div>
      </div>
      <ChartDataTable
        caption="Bar chart data"
        headers={["Label", "Value"]}
        rows={points.map((point) => [point.label, point.value])}
      />
    </div>
  );
}

export function ScatterPlot({
  points,
}: {
  points: readonly { label: string; x: number; y: number }[];
}): ReactElement {
  const minX = Math.min(...points.map((point) => point.x), 0);
  const maxX = Math.max(...points.map((point) => point.x), 1);
  const minY = Math.min(...points.map((point) => point.y), 0);
  const maxY = Math.max(...points.map((point) => point.y), 1);
  const xRange = Math.max(maxX - minX, 1);
  const yRange = Math.max(maxY - minY, 1);
  return (
    <div>
      <svg viewBox="0 0 220 160" role="img" aria-label={`Scatter plot: ${points.map((point) => `${point.label} ${point.x},${point.y}`).join("; ")}`} style={{ width: "100%", minHeight: 160 }}>
        <rect x="0" y="0" width="220" height="160" rx="16" fill={designTokens.color.surfaceElevated} stroke={designTokens.color.border} />
        {points.map((point, index) => (
          <g key={`${point.label}-${index}`}>
            <circle
              cx={24 + ((point.x - minX) / xRange) * 172}
              cy={132 - ((point.y - minY) / yRange) * 100}
              r="6"
              fill={index % 2 === 0 ? designTokens.color.accent : designTokens.color.info}
            />
            <title>{`${point.label}: ${point.x}, ${point.y}`}</title>
          </g>
        ))}
      </svg>
      <ChartDataTable
        caption="Scatter plot data"
        headers={["Label", "X", "Y"]}
        rows={points.map((point) => [point.label, point.x, point.y])}
      />
    </div>
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
    <div style={{ display: "grid", gap: 12, justifyItems: "center" }}>
      <div role="img" aria-label={`${label}: ${Math.round(ratio * 100)}%`}>
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
      <ChartDataTable caption={`${label} gauge data`} headers={["Label", "Value", "Max"]} rows={[[label, value, max]]} />
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
    <div style={{ display: "grid", gap: 8 }}>
      <div role="img" aria-label={`Heatmap grid: ${rows.length} rows by ${columns.length} columns`}>
      <div style={{ display: "grid", gridTemplateColumns: `96px repeat(${columns.length}, minmax(0, 1fr))`, gap: 6 }}>
        <span aria-hidden="true" />
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
                    background: withAlpha(designTokens.color.accent, Number(alpha.toFixed(2))),
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
      </div>
      <ChartDataTable
        caption="Heatmap data"
        headers={["Row", ...columns]}
        rows={rows.map((row, rowIndex) => [row, ...columns.map((_column, columnIndex) => values[rowIndex]?.[columnIndex] ?? 0)])}
      />
    </div>
  );
}

export { PieChart, TimelineChart };
