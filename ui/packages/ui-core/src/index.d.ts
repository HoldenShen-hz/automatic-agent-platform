import { type ReactElement } from "react";
import type { AppRoute, FeatureGroup, ImplementationStatus, PlatformFeatureManifest, PlatformId } from "@aa/shared-types";
export { createSystemHealthSummary, SystemStatusBar } from "./business";
export { buildWorkbenchActionHandler, FeatureScaffold, FeatureWorkbench, FeatureWorkbenchPanel, KeyValueTable, ListCard, StatusPill, } from "./components";
export { BarChart, EChartSurface, GaugeChart, HeatmapGrid, MetricGrid, MiniTrendBars, PieChart, ScatterPlot, SparklineBars, TimelineChart, } from "./charts";
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
export declare function createFeatureModule(config: {
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
}): FeatureModule;
export declare function createFeatureGuard(permission: string, flag?: string): import("@aa/shared-types").RouteGuardChain;
