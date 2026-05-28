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

function withAlpha(hexColor: string, alpha: number): string {
  const normalized = hexColor.replace("#", "");
  const shorthand = normalized.length === 3
    ? normalized.split("").map((segment) => `${segment}${segment}`).join("")
    : normalized;

  if (shorthand.length !== 6) {
    return hexColor;
  }

  const red = Number.parseInt(shorthand.slice(0, 2), 16);
  const green = Number.parseInt(shorthand.slice(2, 4), 16);
  const blue = Number.parseInt(shorthand.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function buildChartOption(title: string, values: readonly number[], theme: CoreDesignTokens) {
  return {
    aria: {
      enabled: true,
      decal: { show: true },
      description: `${title}: ${values.join(", ")}`,
    },
    backgroundColor: "transparent",
    animationDuration: 220,
    grid: {
      top: 18,
      left: 24,
      right: 24,
      bottom: 44,
    },
    xAxis: {
      type: "category",
      data: values.map((_, index) => `${index + 1}`),
      axisLine: { lineStyle: { color: theme.color.border } },
    },
    yAxis: {
      type: "value",
      axisLine: { lineStyle: { color: theme.color.border } },
      splitLine: { lineStyle: { color: withAlpha(theme.color.border, 0.3) } },
    },
    dataZoom: [
      {
        type: "inside",
        filterMode: "none",
      },
      {
        type: "slider",
        height: 20,
        bottom: 10,
        borderColor: theme.color.border,
        fillerColor: withAlpha(theme.color.accent, 0.18),
        backgroundColor: withAlpha(theme.color.surfaceElevated, 0.9),
        handleStyle: {
          color: theme.color.accent,
          borderColor: theme.color.border,
        },
      },
    ],
    series: [
      {
        type: "line",
        smooth: true,
        data: values,
        lineStyle: { color: theme.color.accent, width: 3 },
        areaStyle: { color: withAlpha(theme.color.accent, 0.18) },
        itemStyle: { color: theme.color.accent },
        emphasis: { focus: "series" },
        decal: {
          symbol: "rect",
          dashArrayX: [1, 0],
          dashArrayY: [2, 2],
        },
      },
    ],
    tooltip: { trigger: "axis" },
  };
}

function createResizeObserver(handler: () => void): ResizeObserver | null {
  if (typeof ResizeObserver !== "function") {
    return null;
  }
  try {
    return new ResizeObserver(handler);
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("is not a constructor")) {
      return (ResizeObserver as unknown as (callback: ResizeObserverCallback) => ResizeObserver)(handler as ResizeObserverCallback);
    }
    throw error;
  }
}

export function EChartSurfaceRuntime({ title, values, theme = designTokens }: EChartSurfaceRuntimeProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ReturnType<typeof init> | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const previousValuesRef = useRef<readonly number[]>([]);
  const initializedRef = useRef(false);
  const chartTheme = theme.color;
  const fallbackLabel = useMemo(() => `${title}: ${values.join(", ")}`, [title, values]);
  const chartOption = useMemo(
    () => buildChartOption(title, values, theme),
    [title, values, chartTheme.accent, chartTheme.border, chartTheme.surfaceElevated],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (container == null || initializedRef.current) {
      return;
    }
    initializedRef.current = true;

    const chart = init(container);
    const resizeObserver = createResizeObserver(() => chart.resize());
    resizeObserver?.observe(container);
    chartRef.current = chart;
    cleanupRef.current = () => {
      resizeObserver?.disconnect();
    };

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      chartRef.current = null;
      previousValuesRef.current = [];
      initializedRef.current = false;
      chart.dispose();
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (chart == null) {
      return;
    }

    const previousValues = previousValuesRef.current;
    const isAppendOnly = previousValues.length > 0
      && values.length > previousValues.length
      && previousValues.every((value, index) => values[index] === value);

    if (isAppendOnly) {
      chart.setOption(buildChartOption(title, previousValues, theme));
      chart.appendData({
        seriesIndex: 0,
        data: values.slice(previousValues.length),
      });
    } else {
      chart.setOption(chartOption);
    }
    previousValuesRef.current = [...values];
  }, [chartOption, theme, title, values]);

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
