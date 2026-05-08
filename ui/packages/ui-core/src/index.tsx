import type { ReactElement } from "react";
import type { AppRoute, FeatureGroup, ImplementationStatus, PlatformFeatureManifest, PlatformId } from "@aa/shared-types";
import { createRouteGuardChain } from "@aa/shared-domain";
import { ComponentErrorBoundary, FeatureScaffold } from "./components";
import { designTokens } from "./design-tokens";
export { createSystemHealthSummary, SystemStatusBar } from "./business";
export { ComponentErrorBoundary, FeatureScaffold, FeatureWorkbench, FeatureWorkbenchPanel, KeyValueTable, ListCard, StatusPill } from "./components";
export { EChartSurface, MetricGrid, MiniTrendBars } from "./charts";
export { createPanelStyle, designTokens } from "./design-tokens";
export { LayoutFrame, ThreePaneLayout } from "./layouts";
export { applyResolvedTheme, darkTheme, highContrastTheme, lightTheme, resolveTheme } from "./themes";

export interface FeatureSubPage {
  readonly id: string;
  readonly path: string;
  readonly label: string;
  readonly Component: () => ReactElement;
}

export interface FeatureModule {
  readonly manifest: PlatformFeatureManifest;
  readonly route: AppRoute;
  readonly Component: () => ReactElement;
  readonly subPages?: readonly FeatureSubPage[];
}

export function createFeatureModule(config: {
  id: string;
  title: string;
  group: FeatureGroup;
  path: string;
  permission: string;
  status: ImplementationStatus;
  kind?: "implemented" | "planned";
  platforms?: readonly PlatformId[];
  apiLayer?: "A" | "B" | "C";
  summary: string;
  render?: () => ReactElement;
  subPages?: readonly FeatureSubPage[];
}): FeatureModule {
  const platforms = config.platforms ?? ["web", "windows", "macos", "linux", "android", "ios"];
  const Component = config.render ?? (() => (
    <FeatureScaffold title={config.title} summary={config.summary} status={config.status}>
      <p style={{ color: designTokens.color.text, margin: 0 }}>
        {config.kind === "planned" ? "This feature is wired through a contract seam and feature gate." : "This feature is connected to the shared UI baseline."}
      </p>
    </FeatureScaffold>
  ));
  const WrappedComponent = () => (
    <ComponentErrorBoundary>
      <Component />
    </ComponentErrorBoundary>
  );

  return {
    manifest: {
      id: config.id,
      title: config.title,
      group: config.group,
      path: config.path,
      status: config.status,
      kind: config.kind ?? (config.status === "Planned" ? "planned" : "implemented"),
      platforms,
      permission: config.permission,
      apiLayer: config.apiLayer ?? "C",
      summary: config.summary,
    },
    route: {
      path: config.path,
      featureId: config.id,
      group: config.group,
      title: config.title,
      permission: config.permission,
      platforms,
      // P1 FIX: Enable lazy loading for all feature modules per spec §4.4.1
      // Spec requires React.lazy for all features except / and /login
      codeSplit: true,
    },
    Component: WrappedComponent,
    ...(config.subPages == null ? {} : { subPages: config.subPages }),
  };
}

export function createFeatureGuard(permission: string, flag?: string) {
  return createRouteGuardChain(permission, flag);
}
