import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  FeatureScaffold,
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
