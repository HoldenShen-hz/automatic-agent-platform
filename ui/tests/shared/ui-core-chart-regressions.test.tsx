import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EChartSurface, designTokens } from "@aa/ui-core";
import { EChartSurfaceRuntime } from "../../packages/ui-core/src/charts/echart-surface-runtime";

const chartApi = {
  setOption: vi.fn(),
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
    chartApi.resize.mockClear();
    chartApi.dispose.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the accessible table fallback for screen-reader friendly chart access", () => {
    render(<EChartSurface title="Throughput" values={[2, 4, 6]} showTableFallback />);

    expect(screen.getByRole("table", { name: "Throughput data table" })).toBeInTheDocument();
    expect(screen.getByText("Value")).toBeInTheDocument();
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

    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value: originalUserAgent,
    });
  });
});
