import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { generateEndpointBindingModule } from "@aa/codegen";
import { createScenarioChecklist } from "@aa/e2e";
import { describePlannedEndpoint, resolveMockRequest } from "@aa/mock-server";

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
  });

  it("ships a storybook baseline", () => {
    const root = process.cwd();
    expect(existsSync(join(root, ".storybook/main.ts"))).toBe(true);
    expect(existsSync(join(root, ".storybook/preview.ts"))).toBe(true);
  });

  it("defines lint, coverage and bundle/perf quality gates", () => {
    const root = process.cwd();
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { scripts: Record<string, string> };

    expect(packageJson.scripts.lint).toContain("eslint");
    expect(packageJson.scripts["test:coverage"]).toContain("--coverage");
    expect(packageJson.scripts["bundle:analyze"]).toContain("bundle-analysis");
    expect(packageJson.scripts["perf:budget"]).toContain("perf-budget");
    expect(existsSync(join(root, "eslint.config.js"))).toBe(true);
    expect(existsSync(join(root, "scripts/bundle-analysis.mjs"))).toBe(true);
    expect(existsSync(join(root, "scripts/perf-budget.mjs"))).toBe(true);
    expect(existsSync(join(root, "../.github/workflows/ui-quality.yml"))).toBe(true);
  });
});
