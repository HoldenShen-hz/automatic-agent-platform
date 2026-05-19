import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  selectManualChunk,
  WEB_BUILD_TARGET,
  WEB_CHUNK_WARNING_LIMIT_KB,
  WEB_MINIFY_MODE,
} from "../../../../../apps/web/build-config.ts";

describe("web build config", () => {
  it("pins explicit target, minify mode and chunk warning budget", () => {
    expect(WEB_BUILD_TARGET).toBe("es2022");
    expect(WEB_MINIFY_MODE).toBe("esbuild");
    expect(WEB_CHUNK_WARNING_LIMIT_KB).toBe(200);
  });

  it("splits feature and vendor modules instead of falling back to a single unmatched chunk", () => {
    expect(selectManualChunk("/workspace/ui/packages/features/feature-dashboard/index.tsx")).toBe("feature-dashboard");
    expect(selectManualChunk("/workspace/ui/node_modules/lodash-es/index.js")).toBe("vendor-lodash-es");
    expect(selectManualChunk("/workspace/ui/node_modules/@scope/pkg/index.js")).toBe("vendor-scope-pkg");
  });

  it("fail-closes on missing dist root and is wired into CI", () => {
    const uiRoot = process.cwd();
    const perfBudgetScript = readFileSync(resolve(uiRoot, "scripts/perf-budget.mjs"), "utf8");
    const packageJson = JSON.parse(readFileSync(resolve(uiRoot, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(existsSync(resolve(uiRoot, "scripts/perf-budget.mjs"))).toBe(true);
    expect(perfBudgetScript).toMatch(/if \(!existsSync\(distRoot\)\)/);
    expect(perfBudgetScript).toMatch(/if \(process\.env\.CI === "true"\)/);
    expect(perfBudgetScript).toMatch(/maxEchartsGzBytes/);
    expect(perfBudgetScript).toMatch(/maxMonacoGzBytes/);
    expect(perfBudgetScript).toMatch(/lighthouseReportPath/);
    expect(perfBudgetScript).toMatch(/maxFirstContentfulPaintMs/);
    expect(perfBudgetScript).toMatch(/maxInteractionToNextPaintMs/);
    expect(packageJson.scripts.ci).toMatch(/perf:budget/);
  });
});
