import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { buildCoverageReport, loadCoverageSummary, writeCoverageArtifacts } from "./coverage-lib.mjs";

function generateCoverageSummaryFromCurrentRun() {
  const c8Entrypoint = fileURLToPath(new URL("../../node_modules/c8/bin/c8.js", import.meta.url));
  const result = spawnSync(
    process.execPath,
    [
      "--max-old-space-size=8192",
      c8Entrypoint,
      "--clean",
      "--reporter",
      "json-summary",
      process.execPath,
      "--import",
      "tsx",
      "scripts/run-layered-tests.mjs",
      "full",
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
    throw new Error("c8 layered coverage run failed");
  }
}

generateCoverageSummaryFromCurrentRun();

const report = buildCoverageReport(loadCoverageSummary());
writeCoverageArtifacts(report);

console.log("Coverage report generated.");
console.log(`Global lines: ${report.global.lines.pct.toFixed(1)}%`);
console.log(`Lowest directory: ${report.directories[0]?.directory ?? "n/a"} (${report.directories[0]?.metrics.lines.pct.toFixed(1) ?? "n/a"}%)`);
