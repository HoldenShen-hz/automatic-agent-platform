import type { ReactElement } from "react";
import { designTokens } from "../design-tokens";
export { ChartTableFallback, EChartSurface } from "./echart-surface";
export { MetricGrid, MiniTrendBars } from "./echart-surface";

// §R8-60: Accessible table fallback for chart data
export function ChartTableFallback({ title, values }: { title: string; values: readonly number[] }): ReactElement {
  return (
    <table aria-label={`${title} data table`} style={{ borderCollapse: "collapse", width: "100%" }}>
      <thead>
        <tr>
          <th scope="col" style={{ padding: "8px 12px", textAlign: "left", borderBottom: `2px solid ${designTokens.color.border}` }}>Index</th>
          <th scope="col" style={{ padding: "8px 12px", textAlign: "right", borderBottom: `2px solid ${designTokens.color.border}` }}>Value</th>
        </tr>
      </thead>
      <tbody>
        {values.map((value, index) => (
          <tr key={index}>
            <td style={{ padding: "8px 12px", borderBottom: `1px solid ${designTokens.color.border}` }}>{index + 1}</td>
            <td style={{ padding: "8px 12px", textAlign: "right", borderBottom: `1px solid ${designTokens.color.border}` }}>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function MetricGrid({ metrics }: { metrics: readonly { label: string; value: string | number }[] }): ReactElement {
  return (
    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
      {metrics.map((metric) => (
        <div key={metric.label} style={{ border: `1px solid ${designTokens.color.border}`, borderRadius: designTokens.radius.md, padding: 14 }}>
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
    <div style={{ display: "flex", gap: 6, alignItems: "flex-end", minHeight: 44 }}>
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
