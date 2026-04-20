import {
  BASELINE_PATH,
  buildCoverageReport,
  compareAgainstBaseline,
  loadBaseline,
  loadCoverageSummary,
  writeCoverageArtifacts,
} from "./coverage-lib.mjs";

const report = buildCoverageReport(loadCoverageSummary());
writeCoverageArtifacts(report);

let baseline;
try {
  baseline = loadBaseline();
} catch (error) {
  console.error(`Coverage baseline is missing or unreadable at ${BASELINE_PATH}.`);
  console.error("Run `npm run coverage:baseline:update` after a trusted full test run to seed it.");
  throw error;
}

const comparison = compareAgainstBaseline(report, baseline);
if (comparison.untrackedDirectories.length > 0) {
  console.error("Coverage baseline is missing these directories:");
  for (const directory of comparison.untrackedDirectories) {
    console.error(`- ${directory}`);
  }
  process.exitCode = 1;
}

if (comparison.failures.length > 0) {
  console.error("Coverage baseline gate failed:");
  for (const failure of comparison.failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
}

if (process.exitCode !== 1) {
  console.log("Coverage baseline gate passed.");
  console.log(`Global lines: ${report.global.lines.pct.toFixed(1)}%`);
}
