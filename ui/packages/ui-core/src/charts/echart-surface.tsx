import { Suspense, lazy, useState, type ReactElement } from "react";
import { designTokens, type CoreDesignTokens } from "../design-tokens";

export interface EChartSurfaceProps {
  readonly title: string;
  readonly values: readonly number[];
  readonly showTableFallback?: boolean;
  readonly theme?: CoreDesignTokens;
}

const LazyEChartSurfaceRuntime = lazy(async () => import("./echart-surface-runtime").then((module) => ({ default: module.EChartSurfaceRuntime })));

export function ChartTableFallback({ title, values, theme = designTokens }: { title: string; values: readonly number[]; theme?: CoreDesignTokens }): ReactElement {
  return (
    <table aria-label={`${title} data table`} style={{ borderCollapse: "collapse", width: "100%" }}>
      <thead>
        <tr>
          <th scope="col" style={{ padding: "8px 12px", textAlign: "left", borderBottom: `2px solid ${theme.color.border}` }}>Index</th>
          <th scope="col" style={{ padding: "8px 12px", textAlign: "right", borderBottom: `2px solid ${theme.color.border}` }}>Value</th>
        </tr>
      </thead>
      <tbody>
        {values.map((value, index) => (
          <tr key={index}>
            <td style={{ padding: "8px 12px", borderBottom: `1px solid ${theme.color.border}` }}>{index + 1}</td>
            <td style={{ padding: "8px 12px", textAlign: "right", borderBottom: `1px solid ${theme.color.border}` }}>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function EChartSurface({ title, values, showTableFallback, theme = designTokens }: EChartSurfaceProps): ReactElement {
  const [showTable, setShowTable] = useState(false);

  if (showTable || showTableFallback) {
    return (
      <div>
        <div style={{ color: theme.color.subtle, marginBottom: 8 }}>{title}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <button
            onClick={() => setShowTable(false)}
            style={{ background: "transparent", border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.sm, color: theme.color.text, cursor: "pointer", padding: "4px 8px", fontSize: 12 }}
            type="button"
          >
            Show Chart
          </button>
        </div>
        <ChartTableFallback title={title} values={values} theme={theme} />
      </div>
    );
  }

  return (
    <Suspense
      fallback={(
        <div>
          <div style={{ color: theme.color.subtle, marginBottom: 8 }}>{title}</div>
          <div
            aria-label={`${title}: ${values.join(", ")}`}
            style={{
              height: 220,
              border: `1px solid ${theme.color.border}`,
              borderRadius: theme.radius.md,
              background: theme.color.surfaceElevated,
            }}
          />
        </div>
      )}
    >
      <div style={{ position: "relative" }}>
        <button
          aria-label="Show table fallback"
          onClick={() => setShowTable(true)}
          style={{ position: "absolute", top: 8, right: 8, background: "transparent", border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.sm, color: theme.color.subtle, cursor: "pointer", padding: "4px 8px", fontSize: 11, zIndex: 1 }}
          title="View as table"
          type="button"
        >
          Table
        </button>
        <LazyEChartSurfaceRuntime title={title} values={values} theme={theme} />
      </div>
    </Suspense>
  );
}
