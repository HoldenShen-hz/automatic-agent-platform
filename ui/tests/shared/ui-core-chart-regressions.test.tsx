// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

import { EChartSurface } from "../../packages/ui-core/src/charts/echart-surface";
import { EChartSurfaceRuntime } from "../../packages/ui-core/src/charts/echart-surface-runtime";
import { MetricGrid, MiniTrendBars } from "../../packages/ui-core/src/charts";
import { designTokens } from "../../packages/ui-core/src/design-tokens";

const chartApi = {
  setOption: vi.fn(),
  appendData: vi.fn(),
  resize: vi.fn(),
  dispose: vi.fn(),
};

vi.mock("echarts/core", () => ({
  init: vi.fn(() => chartApi),
  use: vi.fn(),
}));

describe("ui-core chart regressions", () => {
  beforeEach(() => {
    chartApi.setOption.mockClear();
    chartApi.appendData.mockClear();
    chartApi.resize.mockClear();
    chartApi.dispose.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the accessible table fallback for screen-reader friendly chart access", () => {
    render(<EChartSurface title="Throughput" values={[2, 4, 6]} showTableFallback />);

    expect(screen.queryByRole("table", { name: "Throughput data table" })).not.toBeNull();
    expect(screen.queryByText("Value")).not.toBeNull();
  });

  it("exposes semantic metric and trend summaries for assistive technology", async () => {
    render(
      <div>
        <MetricGrid metrics={[{ label: "Open Tasks", value: 12 }]} />
        <MiniTrendBars values={[8, 12, 16]} />
      </div>,
    );

    expect(screen.queryByRole("group", { name: "Metric summary grid" })).not.toBeNull();
    expect(screen.queryByRole("group", { name: "Open Tasks: 12" })).not.toBeNull();
    expect(screen.queryByRole("img", { name: "Trend values: 8, 12, 16" })).not.toBeNull();
  });

  it("configures data zoom, theme-aware colors, and ResizeObserver-based reflow in chart runtime", () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    const resizeObserver = vi.fn(() => ({ observe, disconnect }));
    vi.stubGlobal("ResizeObserver", resizeObserver as unknown as typeof ResizeObserver);
    const originalUserAgent = window.navigator.userAgent;
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value: "vitest-browser",
    });

    render(
      <EChartSurfaceRuntime
        title="Latency"
        values={[1, 3, 2]}
        theme={{
          ...designTokens,
          color: {
            ...designTokens.color,
            accent: "#123456",
            border: "#345678",
            subtle: "#56789a",
            surfaceElevated: "#abcdef",
          },
        }}
      />,
    );

    expect(chartApi.setOption).toHaveBeenCalledTimes(1);
    const option = chartApi.setOption.mock.calls[0]?.[0] as {
      dataZoom: readonly unknown[];
      yAxis: { splitLine: { lineStyle: { color: string } } };
      series: readonly [{ areaStyle: { color: string }; lineStyle: { color: string } }];
    };
    expect(option.dataZoom).toHaveLength(2);
    expect(option.series[0]?.lineStyle.color).toBe("#123456");
    expect(option.series[0]?.areaStyle.color).toBe("rgba(18, 52, 86, 0.18)");
    expect(option.yAxis.splitLine.lineStyle.color).toBe("rgba(52, 86, 120, 0.3)");
    expect(observe).toHaveBeenCalledTimes(1);
    expect(resizeObserver).toHaveBeenCalledTimes(1);
    expect(chartApi.appendData).not.toHaveBeenCalled();

    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value: originalUserAgent,
    });
  });

  it("reuses the same chart instance and appends series data for append-only updates", () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    const resizeObserver = vi.fn(() => ({ observe, disconnect }));
    vi.stubGlobal("ResizeObserver", resizeObserver as unknown as typeof ResizeObserver);
    const originalUserAgent = window.navigator.userAgent;
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value: "vitest-browser",
    });

    const { rerender } = render(<EChartSurfaceRuntime title="Latency" values={[1, 2]} />);
    rerender(<EChartSurfaceRuntime title="Latency" values={[1, 2, 3, 4]} />);

    expect(chartApi.setOption).toHaveBeenCalledTimes(2);
    expect(chartApi.appendData).toHaveBeenCalledWith({
      seriesIndex: 0,
      data: [3, 4],
    });

    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value: originalUserAgent,
    });
  });
});
