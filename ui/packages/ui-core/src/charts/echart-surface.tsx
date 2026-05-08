import { Suspense, lazy, type ReactElement } from "react";
import { designTokens } from "../design-tokens";

export interface EChartSurfaceProps {
  readonly title: string;
  readonly values: readonly number[];
}

const LazyEChartSurfaceRuntime = lazy(async () => import("./echart-surface-runtime").then((module) => ({ default: module.EChartSurfaceRuntime })));

export function EChartSurface({ title, values }: EChartSurfaceProps): ReactElement {
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
      <LazyEChartSurfaceRuntime title={title} values={values} />
    </Suspense>
  );
}
