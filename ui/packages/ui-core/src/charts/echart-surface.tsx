import { Suspense, lazy, useState, type ReactElement } from "react";
import { designTokens } from "../design-tokens";
import { ChartTableFallback } from "./index";

export interface EChartSurfaceProps {
  readonly title: string;
  readonly values: readonly number[];
  readonly showTableFallback?: boolean;
}

const LazyEChartSurfaceRuntime = lazy(async () => import("./echart-surface-runtime").then((module) => ({ default: module.EChartSurfaceRuntime })));

export function EChartSurface({ title, values, showTableFallback }: EChartSurfaceProps): ReactElement {
  const [showTable, setShowTable] = useState(false);

  if (showTable || showTableFallback) {
    return (
      <div>
        <div style={{ color: designTokens.color.subtle, marginBottom: 8 }}>{title}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <button
            onClick={() => setShowTable(false)}
            style={{ background: "transparent", border: `1px solid ${designTokens.color.border}`, borderRadius: designTokens.radius.sm, color: designTokens.color.text, cursor: "pointer", padding: "4px 8px", fontSize: 12 }}
            type="button"
          >
            Show Chart
          </button>
        </div>
        <ChartTableFallback title={title} values={values} />
      </div>
    );
  }

  return (
    <Suspense
      fallback={(
        <div>
          <div style={{ color: designTokens.color.subtle, marginBottom: 8 }}>{title}</div>
          <div
            aria-label={`${title}: ${values.join(", ")}`}
            style={{
              height: 220,
              border: `1px solid ${designTokens.color.border}`,
              borderRadius: designTokens.radius.md,
              background: designTokens.color.surfaceElevated,
            }}
          />
        </div>
      )}
    >
      <div style={{ position: "relative" }}>
        <button
          aria-label="Show table fallback"
          onClick={() => setShowTable(true)}
          style={{ position: "absolute", top: 8, right: 8, background: "transparent", border: `1px solid ${designTokens.color.border}`, borderRadius: designTokens.radius.sm, color: designTokens.color.subtle, cursor: "pointer", padding: "4px 8px", fontSize: 11, zIndex: 1 }}
          title="View as table"
          type="button"
        >
          Table
        </button>
        <LazyEChartSurfaceRuntime title={title} values={values} />
      </div>
    </Suspense>
  );
}
