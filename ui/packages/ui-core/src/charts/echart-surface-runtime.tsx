import { useEffect, useMemo, useRef, type ReactElement } from "react";
import { init, use } from "echarts/core";
import { LineChart } from "echarts/charts";
import { DataZoomComponent, GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { designTokens, type CoreDesignTokens } from "../design-tokens";

use([LineChart, GridComponent, TooltipComponent, DataZoomComponent, CanvasRenderer]);

export interface EChartSurfaceRuntimeProps {
  readonly title: string;
  readonly values: readonly number[];
  readonly theme?: CoreDesignTokens;
}

function withAlpha(color: string, alpha: number): string {
  if (!color.startsWith("#")) {
    return color;
  }
  const normalized = color.length === 4
    ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
    : color;
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function EChartSurfaceRuntime({ title, values, theme = designTokens }: EChartSurfaceRuntimeProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ReturnType<typeof init> | null>(null);
  const previousValuesRef = useRef<readonly number[]>([]);
  const fallbackLabel = useMemo(() => `${title}: ${values.join(", ")}`, [title, values]);
  const chartTheme = theme.color;

  useEffect(() => {
    const container = containerRef.current;
    const userAgent = container?.ownerDocument.defaultView?.navigator.userAgent ?? "";
    if (container == null || userAgent.includes("jsdom")) {
      return;
    }

    chartRef.current = init(container);

    const resize = () => chartRef.current?.resize();
    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => resize());
    resizeObserver?.observe(container);
    if (resizeObserver == null) {
      container.ownerDocument.defaultView?.addEventListener("resize", resize);
    }
    return () => {
      resizeObserver?.disconnect();
      if (resizeObserver == null) {
        container.ownerDocument.defaultView?.removeEventListener("resize", resize);
      }
      chartRef.current?.dispose();
      chartRef.current = null;
      previousValuesRef.current = [];
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (chart == null) {
      return;
    }

    const previousValues = previousValuesRef.current;
    const canAppend = previousValues.length > 0
      && values.length > previousValues.length
      && previousValues.every((value, index) => values[index] === value);

    chart.setOption({
      backgroundColor: "transparent",
      animationDuration: 220,
      dataZoom: [
        {
          type: "inside",
          filterMode: "none",
        },
        {
          type: "slider",
          height: 18,
          borderColor: chartTheme.border,
          fillerColor: withAlpha(chartTheme.accent, 0.18),
          backgroundColor: withAlpha(chartTheme.surfaceElevated, 0.9),
          handleStyle: {
            color: chartTheme.accent,
            borderColor: chartTheme.accent,
          },
          textStyle: {
            color: chartTheme.subtle,
          },
        },
      ],
      xAxis: {
        type: "category",
        data: values.map((_, index) => `${index + 1}`),
        axisLine: { lineStyle: { color: chartTheme.border } },
      },
      yAxis: {
        type: "value",
        axisLine: { lineStyle: { color: chartTheme.border } },
        splitLine: { lineStyle: { color: withAlpha(chartTheme.border, 0.3) } },
      },
      series: [
        {
          type: "line",
          smooth: true,
          ...(canAppend ? {} : { data: values }),
          lineStyle: { color: chartTheme.accent, width: 3 },
          areaStyle: { color: withAlpha(chartTheme.accent, 0.18) },
        },
      ],
      tooltip: { trigger: "axis" },
    });

    if (canAppend) {
      chart.appendData({
        seriesIndex: 0,
        data: values.slice(previousValues.length),
      });
    }
    previousValuesRef.current = [...values];
  }, [values, chartTheme.accent, chartTheme.border, chartTheme.subtle, chartTheme.surfaceElevated]);

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
