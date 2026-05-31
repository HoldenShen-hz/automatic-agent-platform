import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildCoverageReport,
  loadCoverageSummary,
  mergeCoverageSummaries,
  writeCoverageArtifacts,
  writeCoverageSummary,
} from "./coverage-lib.mjs";

const COVERAGE_LAYERS = ["leaks", "unit", "invariants", "integration", "golden", "e2e", "performance"];
const COVERAGE_ROOT = path.join(process.cwd(), "coverage");
const LAYERED_COVERAGE_ROOT = path.join(COVERAGE_ROOT, "layered");

function readLayerCoverageSummary(reportDir) {
  const summaryPath = path.join(reportDir, "coverage-summary.json");
  if (!existsSync(summaryPath)) {
    throw new Error(`missing coverage summary for ${reportDir}`);
  }
  return JSON.parse(readFileSync(summaryPath, "utf8"));
}

function runCoverageForLayer(c8Entrypoint, layer) {
  const tempDir = path.join(LAYERED_COVERAGE_ROOT, `${layer}-tmp`);
  const reportDir = path.join(LAYERED_COVERAGE_ROOT, `${layer}-report`);
  rmSync(tempDir, { recursive: true, force: true });
  rmSync(reportDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });
  mkdirSync(reportDir, { recursive: true });

  const result = spawnSync(
    process.execPath,
    [
      "--max-old-space-size=8192",
      c8Entrypoint,
      "--clean",
      "--temp-directory",
      tempDir,
      "--report-dir",
      reportDir,
      "--reporter",
      "json-summary",
      process.execPath,
      "--import",
      "tsx",
      "scripts/run-layered-tests.mjs",
      layer,
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: "inherit",
      env: {
        ...process.env,
        AA_RUNNING_TESTS: "1",
        AA_PRESERVE_DIST: "1",
      },
    },
  );

  if (result.status !== 0) {
    throw new Error(`c8 layered coverage run failed for ${layer}`);
  }

  return readLayerCoverageSummary(reportDir);
}

function generateCoverageSummaryFromCurrentRun() {
  const c8Entrypoint = fileURLToPath(new URL("../../node_modules/c8/bin/c8.js", import.meta.url));
  mkdirSync(LAYERED_COVERAGE_ROOT, { recursive: true });
  const summaries = COVERAGE_LAYERS.map((layer) => runCoverageForLayer(c8Entrypoint, layer));
  writeCoverageSummary(mergeCoverageSummaries(summaries));
}

generateCoverageSummaryFromCurrentRun();

const report = buildCoverageReport(loadCoverageSummary());
writeCoverageArtifacts(report);

console.log("Coverage report generated.");
console.log(`Global lines: ${report.global.lines.pct.toFixed(1)}%`);
console.log(`Lowest directory: ${report.directories[0]?.directory ?? "n/a"} (${report.directories[0]?.metrics.lines.pct.toFixed(1) ?? "n/a"}%)`);
