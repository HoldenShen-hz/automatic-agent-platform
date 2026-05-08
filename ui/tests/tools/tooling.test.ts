import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { generateEndpointBindingModule } from "@aa/codegen";
import { createScenarioChecklist, runScenarioAssertion } from "@aa/e2e";
import { createMockHandlers, createMockServer, describePlannedEndpoint, resolveMockRequest } from "@aa/mock-server";
import {
  selectManualChunk,
  WEB_BUILD_TARGET,
  WEB_CHUNK_WARNING_LIMIT_KB,
  WEB_MINIFY_MODE,
} from "../../apps/web/build-config";

describe("ui tooling baselines", () => {
  it("exposes runnable codegen, mock-server and e2e helpers", () => {
    const source = generateEndpointBindingModule([
      { id: "tasks", path: "/api/v1/tasks" },
      { id: "dashboard", path: "/api/v1/dashboard/snapshot" },
    ]);

    expect(source).toContain('export const tasksPath = "/api/v1/tasks";');
    expect(resolveMockRequest("/api/v1/tasks")).toBeDefined();
    expect(describePlannedEndpoint("analytics").enabled).toBe(false);
    expect(createScenarioChecklist()).toHaveLength(7);
    expect(typeof runScenarioAssertion).toBe("function");
    expect(createMockHandlers()).toHaveLength(2);
    expect(typeof createMockServer).toBe("function");
  });

  it("ships a storybook baseline", () => {
    const root = process.cwd();
    expect(existsSync(join(root, ".storybook/main.ts"))).toBe(true);
    expect(existsSync(join(root, ".storybook/preview.ts"))).toBe(true);
  });

  it("defines lint, coverage and bundle/perf quality gates", () => {
    const root = process.cwd();
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { scripts: Record<string, string> };
    const perfBudgetScript = readFileSync(join(root, "scripts/perf-budget.mjs"), "utf8");

    expect(packageJson.scripts.lint).toContain("eslint");
    expect(packageJson.scripts["test:coverage"]).toContain("--coverage");
    expect(packageJson.scripts["bundle:analyze"]).toContain("bundle-analysis");
    expect(packageJson.scripts["perf:budget"]).toContain("perf-budget");
    expect(packageJson.scripts.ci).toContain("perf:budget");
    expect(existsSync(join(root, "eslint.config.js"))).toBe(true);
    expect(existsSync(join(root, "scripts/bundle-analysis.mjs"))).toBe(true);
    expect(existsSync(join(root, "scripts/perf-budget.mjs"))).toBe(true);
    expect(existsSync(join(root, "../.github/workflows/ui-quality.yml"))).toBe(true);
    expect(perfBudgetScript).toContain("if (!existsSync(distRoot))");
    expect(perfBudgetScript).toContain("if (process.env.CI === \"true\")");
    expect(perfBudgetScript).toContain("maxEchartsGzBytes");
    expect(perfBudgetScript).toContain("maxMonacoGzBytes");
  });

  it("pins explicit vite build target, minify mode and chunk segmentation", () => {
    expect(WEB_BUILD_TARGET).toBe("es2022");
    expect(WEB_MINIFY_MODE).toBe("esbuild");
    expect(WEB_CHUNK_WARNING_LIMIT_KB).toBe(200);
    expect(selectManualChunk("/workspace/ui/packages/features/feature-dashboard/index.tsx")).toBe("feature-dashboard");
    expect(selectManualChunk("/workspace/ui/node_modules/lodash-es/index.js")).toBe("vendor-lodash-es");
    expect(selectManualChunk("/workspace/ui/node_modules/@scope/pkg/index.js")).toBe("vendor-scope-pkg");
  });
});
