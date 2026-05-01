import { useEffect, useMemo, useRef, type ReactElement } from "react";
import { init, use } from "echarts/core";
import { LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { designTokens } from "../design-tokens";

use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

export interface EChartSurfaceRuntimeProps {
  readonly title: string;
  readonly values: readonly number[];
}

export function EChartSurfaceRuntime({ title, values }: EChartSurfaceRuntimeProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fallbackLabel = useMemo(() => `${title}: ${values.join(", ")}`, [title, values]);
  // P2 FIX: Store designTokens.color in a ref so useEffect dependency is stable.
  // Root cause: Passing designTokens.color directly in deps caused useEffect to
  // re-run on every render even when colors hadn't changed, or worse, miss theme
  // changes if designTokens object reference changed but deps didn't include it.
  // Using a ref captures the current color values without causing re-renders.
  const colorRef = useRef(designTokens.color);
  colorRef.current = designTokens.color;

  useEffect(() => {
    const container = containerRef.current;
    const userAgent = container?.ownerDocument.defaultView?.navigator.userAgent ?? "";
    if (container == null || userAgent.includes("jsdom")) {
      return;
    }

    const chart = init(container);
    chart.setOption({
      backgroundColor: "transparent",
      animationDuration: 220,
      xAxis: {
        type: "category",
        data: values.map((_, index) => `${index + 1}`),
        axisLine: { lineStyle: { color: colorRef.current.border } },
      },
      yAxis: {
        type: "value",
        axisLine: { lineStyle: { color: colorRef.current.border } },
        splitLine: { lineStyle: { color: "rgba(148,163,184,0.18)" } },
      },
      series: [
        {
          type: "line",
          smooth: true,
          data: values,
          lineStyle: { color: colorRef.current.accent, width: 3 },
          areaStyle: { color: "rgba(34,197,94,0.18)" },
        },
      ],
      tooltip: { trigger: "axis" },
    });

    const resize = () => chart.resize();
    container.ownerDocument.defaultView?.addEventListener("resize", resize);
    return () => {
      container.ownerDocument.defaultView?.removeEventListener("resize", resize);
      chart.dispose();
    };
  }, [values]);

  return (
    <div>
      <div style={{ color: designTokens.color.subtle, marginBottom: 8 }}>{title}</div>
      <div
        aria-label={fallbackLabel}
        ref={containerRef}
        style={{
          height: 220,
          border: `1px solid ${designTokens.color.border}`,
          borderRadius: designTokens.radius.md,
          background: designTokens.color.surfaceElevated,
        }}
      />
    </div>
  );
}
