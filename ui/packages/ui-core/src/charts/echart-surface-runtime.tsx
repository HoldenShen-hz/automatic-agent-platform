import { useEffect, useMemo, useRef, type ReactElement } from "react";
import { init, use } from "echarts/core";
import { LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { designTokens, type CoreDesignTokens } from "../design-tokens";

use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

export interface EChartSurfaceRuntimeProps {
  readonly title: string;
  readonly values: readonly number[];
  readonly theme?: CoreDesignTokens;
}

export function EChartSurfaceRuntime({ title, values, theme = designTokens }: EChartSurfaceRuntimeProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fallbackLabel = useMemo(() => `${title}: ${values.join(", ")}`, [title, values]);
  const chartTheme = theme.color;

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
        axisLine: { lineStyle: { color: chartTheme.border } },
      },
      yAxis: {
        type: "value",
        axisLine: { lineStyle: { color: chartTheme.border } },
        splitLine: { lineStyle: { color: "rgba(148,163,184,0.18)" } },
      },
      series: [
        {
          type: "line",
          smooth: true,
          data: values,
          lineStyle: { color: chartTheme.accent, width: 3 },
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
  }, [values, chartTheme.accent, chartTheme.border]);

  return (
    <div>
      <div style={{ color: theme.color.subtle, marginBottom: 8 }}>{title}</div>
      <div
        aria-label={fallbackLabel}
        ref={containerRef}
        style={{
          height: 220,
          border: `1px solid ${theme.color.border}`,
          borderRadius: theme.radius.md,
          background: theme.color.surfaceElevated,
        }}
      />
    </div>
  );
}
