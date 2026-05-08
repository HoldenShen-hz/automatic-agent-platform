import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  FeatureScaffold,
  FeatureWorkbenchPanel,
  ListCard,
  MetricGrid,
  MiniTrendBars,
  SystemStatusBar,
  applyResolvedTheme,
  createSystemHealthSummary,
  designTokens,
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
    expect(designTokens.color.background).toContain("--aa-color-background");
    expect(resolveTheme("high-contrast")).toEqual(highContrastTheme);
  });

  it("applies resolved theme values to document CSS variables so module-level design tokens stay switchable", () => {
    applyResolvedTheme("dark");
    expect(document.documentElement.dataset.aaTheme).toBe("dark");
    expect(document.documentElement.style.getPropertyValue("--aa-color-background")).toBe(darkTheme.color.background);
    expect(document.documentElement.style.getPropertyValue("--aa-shadow-card")).toBe(darkTheme.shadows.card);
  });

  it("renders the interactive workbench baseline for L1 features", () => {
    const onTrigger = vi.fn();
    render(
      <FeatureWorkbenchPanel
        metrics={[{ label: "Open", value: 3 }]}
        items={[
          { title: "Review Queue", description: "处理 backlog 并记录最新动作。" },
          { title: "Export Summary", description: "导出当前治理摘要。" },
        ]}
        actions={[
          { id: "run", label: "执行动作", tone: "accent", onTrigger },
          { id: "note", label: "记录批注", tone: "neutral" },
        ]}
      />,
    );

    expect(screen.getByPlaceholderText("筛选当前工作台项")).toBeInTheDocument();
    expect(screen.getAllByText("Review Queue").length).toBeGreaterThan(0);
    expect(screen.getByText("操作日志")).toBeInTheDocument();
    fireEvent.click(screen.getByText("执行动作"));
    expect(onTrigger).toHaveBeenCalledWith(expect.objectContaining({ title: "Review Queue" }));
  });

  it("keeps duplicate-titled ListCard items renderable without key collisions", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <ListCard
        items={[
          { title: "重复标题", description: "第一条" },
          { title: "重复标题", description: "第二条" },
        ]}
      />,
    );

    expect(screen.getAllByText("重复标题")).toHaveLength(2);
    expect(consoleError).not.toHaveBeenCalledWith(expect.stringContaining("Encountered two children with the same key"));
    consoleError.mockRestore();
  });
});

describe("ui-mobile split modules", () => {
  it("builds screen descriptors, route map and native capability summary", () => {
    globalThis.__AA_MOBILE__ = {
      vibrate: () => undefined,
      openDeepLink: () => undefined,
      readSecureValue: async () => null,
      writeSecureValue: async () => undefined,
      deleteSecureValue: async () => undefined,
      enableScreenSecurity: async () => undefined,
    };
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
    delete globalThis.__AA_MOBILE__;
  });
});
