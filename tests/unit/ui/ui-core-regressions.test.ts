import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const uiCoreIndexSource = readFileSync(resolve("ui/packages/ui-core/src/index.tsx"), "utf8");
const uiCoreLayoutsSource = readFileSync(resolve("ui/packages/ui-core/src/layouts/index.ts"), "utf8");
const uiCoreThemesSource = readFileSync(resolve("ui/packages/ui-core/src/themes/index.ts"), "utf8");
const uiCoreChartSource = readFileSync(resolve("ui/packages/ui-core/src/charts/echart-surface.tsx"), "utf8");
const uiCoreChartRuntimeSource = readFileSync(resolve("ui/packages/ui-core/src/charts/echart-surface-runtime.tsx"), "utf8");
const dashboardFeatureSource = readFileSync(resolve("ui/packages/features/dashboard/src/web/index.tsx"), "utf8");
const analyticsFeatureSource = readFileSync(resolve("ui/packages/features/analytics/src/web/index.tsx"), "utf8");

test("createFeatureModule enables codeSplit by default", () => {
  assert.match(uiCoreIndexSource, /codeSplit:\s*true/);
});

test("ThreePaneLayout uses responsive auto-fit columns instead of a fixed 720px minimum", () => {
  assert.match(uiCoreLayoutsSource, /gridTemplateColumns:\s*"repeat\(auto-fit, minmax\(200px, 1fr\)\)"/);
  assert.match(uiCoreLayoutsSource, /createElement\("main", \{ "aria-label": "Main content" \}/);
  assert.match(uiCoreLayoutsSource, /createElement\("aside", \{ "aria-label": "Left panel" \}/);
});

test("darkTheme defines explicit semantic colors needed for dark-mode contrast", () => {
  assert.match(uiCoreThemesSource, /accent:\s*"#[0-9a-fA-F]+"/);
  assert.match(uiCoreThemesSource, /danger:\s*"#[0-9a-fA-F]+"/);
  assert.match(uiCoreThemesSource, /success:\s*"#[0-9a-fA-F]+"/);
  assert.match(uiCoreThemesSource, /warning:\s*"#[0-9a-fA-F]+"/);
});

test("EChartSurface forwards an explicit theme into the runtime chart", () => {
  assert.match(uiCoreChartSource, /readonly theme\?: CoreDesignTokens/);
  assert.match(uiCoreChartSource, /LazyEChartSurfaceRuntime title=\{title\} values=\{values\} theme=\{theme\}/);
});

test("EChartSurfaceRuntime re-renders when theme colors change", () => {
  assert.match(uiCoreChartRuntimeSource, /readonly theme\?: CoreDesignTokens/);
  assert.match(uiCoreChartRuntimeSource, /\[title, values, chartTheme\.accent, chartTheme\.border, chartTheme\.surfaceElevated\]/);
});

test("current chart feature entrypoints pass resolved theme into EChartSurface", () => {
  assert.match(dashboardFeatureSource, /useThemeState/);
  assert.match(dashboardFeatureSource, /resolveTheme\(resolvedColorScheme\)/);
  assert.match(dashboardFeatureSource, /theme=\{theme\}/);
  assert.match(analyticsFeatureSource, /useThemeState/);
  assert.match(analyticsFeatureSource, /resolveTheme\(resolvedColorScheme\)/);
  assert.match(analyticsFeatureSource, /theme=\{theme\}/);
});
