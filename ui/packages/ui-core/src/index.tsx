import React, { createElement, type ReactElement, type ReactNode } from "react";
import type { AppRoute, FeatureGroup, ImplementationStatus, PlatformFeatureManifest, PlatformId } from "@aa/shared-types";
import { createRouteGuardChain } from "@aa/shared-domain";
import { FeatureScaffold } from "./components";
import { designTokens } from "./design-tokens";
export { createSystemHealthSummary, SystemStatusBar } from "./business";
export {
  buildWorkbenchActionHandler,
  FeatureScaffold,
  FeatureWorkbench,
  FeatureWorkbenchPanel,
  KeyValueTable,
  ListCard,
  StatusPill,
} from "./components";
export {
  BarChart,
  EChartSurface,
  GaugeChart,
  HeatmapGrid,
  MetricGrid,
  MiniTrendBars,
  PieChart,
  ScatterPlot,
  SparklineBars,
  TimelineChart,
} from "./charts";
export { createPanelStyle, designTokens } from "./design-tokens";
export { CodeBlock, DAGVisualization, FileAttachment, Timeline } from "./components/extended";
export { Inline, LayoutFrame, Stack, ThreePaneLayout } from "./layouts";
export { applyResolvedTheme, darkTheme, highContrastTheme, lightTheme, resolveTheme, type ThemeRuntimeBridge } from "./themes";

export interface FeatureModule {
  readonly manifest: PlatformFeatureManifest;
  readonly route: AppRoute;
  readonly Component: () => ReactElement;
  readonly subPages?: readonly unknown[];
}

class FeatureModuleErrorBoundary extends React.Component<
  {
    readonly title: string;
    readonly summary: string;
    readonly status: ImplementationStatus;
    readonly children: ReactNode;
  },
  { readonly error: Error | null }
> {
  public constructor(props: {
    readonly title: string;
    readonly summary: string;
    readonly status: ImplementationStatus;
    readonly children: ReactNode;
  }) {
    super(props);
    this.state = { error: null };
  }

  public static getDerivedStateFromError(error: Error): { readonly error: Error } {
    return { error };
  }

  public override render(): ReactNode {
    if (this.state.error == null) {
      return this.props.children;
    }

    const message = this.state.error.message;
    return (
      <FeatureScaffold title={this.props.title} summary={this.props.summary} status={this.props.status}>
        <div role="alert">
          <strong>组件渲染失败</strong>
          <p style={{ marginBottom: 0 }}>{message}</p>
        </div>
      </FeatureScaffold>
    );
  }
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
}): FeatureModule {
  const platforms = config.platforms ?? ["web", "windows", "macos", "linux", "android", "ios"];
  const renderFeature = config.render ?? (() => (
    <FeatureScaffold title={config.title} summary={config.summary} status={config.status}>
      <p style={{ color: designTokens.color.text, margin: 0 }}>
        {config.kind === "planned" ? "This feature is wired through a contract seam and feature gate." : "This feature is connected to the shared UI baseline."}
      </p>
    </FeatureScaffold>
  ));
  const RenderFeature = (): ReactElement => renderFeature();
  const Component = () => createElement(
    FeatureModuleErrorBoundary,
    {
      title: config.title,
      summary: config.summary,
      status: config.status,
    },
    createElement(RenderFeature),
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
      codeSplit: true,
    },
    Component,
  };
}

export function createFeatureGuard(permission: string, flag?: string) {
  return createRouteGuardChain(permission, flag);
}
