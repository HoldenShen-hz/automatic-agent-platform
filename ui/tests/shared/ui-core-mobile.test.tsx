import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  FeatureScaffold,
  FeatureWorkbenchPanel,
  MetricGrid,
  MiniTrendBars,
  SystemStatusBar,
  createSystemHealthSummary,
  darkTheme,
  highContrastTheme,
  lightTheme,
  resolveTheme,
} from "@aa/ui-core";
import {
  buildMobileRouteMap,
  createMobileFeatureCard,
  createMobileScreenDescriptor,
  describeNativeModules,
  mobileNavigationBaseline,
} from "@aa/ui-mobile";

describe("ui-core split modules", () => {
  it("renders core components from split directories", () => {
    render(
      <FeatureScaffold title="Split UI" summary="split modules wired" status="Implemented/Internal">
        <MetricGrid metrics={[{ label: "Tasks", value: 12 }]} />
        <MiniTrendBars values={[1, 3, 2, 5]} />
        <SystemStatusBar status={{ wsStatus: "connected", offlineQueueSize: 2, syncStatus: "queued", panicActivated: false }} />
      </FeatureScaffold>,
    );

    expect(screen.getByText("Split UI")).toBeInTheDocument();
    expect(screen.getByText("Tasks")).toBeInTheDocument();
    expect(screen.getByText("connected")).toBeInTheDocument();
    expect(createSystemHealthSummary({ wsStatus: "connected", offlineQueueSize: 2, syncStatus: "queued", panicActivated: false })).toHaveLength(4);
    expect(lightTheme.color.surface).not.toBe(darkTheme.color.surface);
    expect(resolveTheme("high-contrast")).toEqual(highContrastTheme);
  });

  it("renders the interactive workbench baseline for L1 features", () => {
    render(
      <FeatureWorkbenchPanel
        metrics={[{ label: "Open", value: 3 }]}
        items={[
          { title: "Review Queue", description: "处理 backlog 并记录最新动作。" },
          { title: "Export Summary", description: "导出当前治理摘要。" },
        ]}
        actions={[
          { id: "run", label: "执行动作", tone: "accent" },
          { id: "note", label: "记录批注", tone: "neutral" },
        ]}
      />,
    );

    expect(screen.getByPlaceholderText("筛选当前工作台项")).toBeInTheDocument();
    expect(screen.getAllByText("Review Queue").length).toBeGreaterThan(0);
    expect(screen.getByText("操作日志")).toBeInTheDocument();
  });
});

describe("ui-mobile split modules", () => {
  it("builds screen descriptors, route map and native capability summary", () => {
    const screen = createMobileScreenDescriptor(
      {
        id: "dashboard",
        title: "Dashboard",
        group: "Mission Control",
        path: "/mission-control/dashboard",
        status: "Implemented/Internal",
        kind: "implemented",
        platforms: ["web", "windows", "macos", "linux", "android", "ios"],
        permission: "operator+",
        apiLayer: "C",
        summary: "dashboard",
      },
      "home",
    );
    const card = createMobileFeatureCard("Dashboard", "Mission overview", "live");
    const routeMap = buildMobileRouteMap([screen]);

    expect(card.badge).toBe("live");
    expect(mobileNavigationBaseline).toHaveLength(5);
    expect(routeMap.home).toEqual(["dashboard"]);
    expect(describeNativeModules().some((item) => item.name === "haptics" && item.enabled)).toBe(true);
  });
});
