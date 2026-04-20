import {
  BASELINE_PATH,
  buildBaseline,
  buildCoverageReport,
  loadCoverageSummary,
  writeBaseline,
  writeCoverageArtifacts,
} from "./coverage-lib.mjs";

const report = buildCoverageReport(loadCoverageSummary());
writeCoverageArtifacts(report);

const baseline = buildBaseline(report);
writeBaseline(baseline);

console.log(`Coverage baseline updated at ${BASELINE_PATH}.`);
