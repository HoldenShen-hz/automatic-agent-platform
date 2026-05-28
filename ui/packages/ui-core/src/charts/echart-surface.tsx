import React, { Suspense, lazy, type ReactElement, type ReactNode } from "react";
import { designTokens, type CoreDesignTokens } from "../design-tokens";

export interface EChartSurfaceProps {
  readonly title: string;
  readonly values: readonly number[];
  readonly showTableFallback?: boolean;
  readonly theme?: CoreDesignTokens;
}

const LazyEChartSurfaceRuntime = lazy(async () => import("./echart-surface-runtime").then((module) => ({ default: module.EChartSurfaceRuntime })));

class ChartRuntimeErrorBoundary extends React.Component<
  { readonly children: ReactNode; readonly fallback: ReactElement },
  { readonly failed: boolean }
> {
  public constructor(props: { readonly children: ReactNode; readonly fallback: ReactElement }) {
    super(props);
    this.state = { failed: false };
  }

  public static getDerivedStateFromError(): { readonly failed: boolean } {
    return { failed: true };
  }

  public override render(): ReactNode {
    if (this.state.failed) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

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
  const chartFallback = (
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
  );
  return (
    <div>
      <ChartRuntimeErrorBoundary fallback={chartFallback}>
        <Suspense fallback={chartFallback}>
          <LazyEChartSurfaceRuntime title={title} values={values} theme={theme} />
        </Suspense>
      </ChartRuntimeErrorBoundary>
      {showTableFallback ? <ChartTableFallback title={title} values={values} /> : null}
    </div>
  );
}
