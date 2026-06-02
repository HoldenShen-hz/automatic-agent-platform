import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildReviewImportArtifacts, evaluateReviewImportResult } from "./review-import-lib.mjs";

function readOption(flag, fallback) {
  const index = process.argv.indexOf(flag);
  if (index >= 0 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }
  return fallback;
}

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(readOption("--repo-root", resolve(currentDir, "..", "..")));
const checkMode = process.argv.includes("--check");
const allowParseWarnings = process.argv.includes("--allow-parse-warnings");
const allowConflicts = process.argv.includes("--allow-conflicts");

const result = buildReviewImportArtifacts({
  repoRoot,
  reviewsRoot: readOption("--reviews-root", "docs_zh/reviews"),
  outputDir: readOption("--output-dir", "artifacts/assurance"),
});

const evaluation = evaluateReviewImportResult(result, {
  allowParseWarnings,
  allowConflicts,
});

const summary = {
  rawFindings: result.rawFindings.length,
  normalizedFindings: result.normalizedFindings.length,
  conflicts: result.conflictRecords.length,
  coverageStatus: result.coverageReport.overallStatus,
  checkMode,
  pass: evaluation.pass,
  reasons: evaluation.reasons,
  outputs: result.outputs,
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

if (checkMode && !evaluation.pass) {
  process.exitCode = 1;
}
