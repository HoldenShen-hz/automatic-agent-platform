import { Suspense, lazy, type ReactElement } from "react";
import { designTokens, type CoreDesignTokens } from "../design-tokens";

export interface EChartSurfaceProps {
  readonly title: string;
  readonly values: readonly number[];
  readonly showTableFallback?: boolean;
  readonly theme?: CoreDesignTokens;
}

const LazyEChartSurfaceRuntime = lazy(async () => import("./echart-surface-runtime").then((module) => ({ default: module.EChartSurfaceRuntime })));

function ChartTableFallback({ title, values }: { title: string; values: readonly number[] }): ReactElement {
  return (
    <table aria-label={`${title} data table`} style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
      <thead>
        <tr>
          <th align="left">Point</th>
          <th align="left">Value</th>
        </tr>
      </thead>
      <tbody>
        {values.map((value, index) => (
          <tr key={`${title}-${index + 1}`}>
            <td>{index + 1}</td>
            <td>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function EChartSurface({ title, values, showTableFallback = false, theme = designTokens }: EChartSurfaceProps): ReactElement {
  return (
    <div>
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
        <LazyEChartSurfaceRuntime title={title} values={values} theme={theme} />
      </Suspense>
      {showTableFallback ? <ChartTableFallback title={title} values={values} /> : null}
    </div>
  );
}
