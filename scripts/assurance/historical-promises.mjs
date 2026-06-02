import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildHistoricalPromiseArtifacts, evaluateHistoricalPromiseArtifacts } from "./historical-promises-lib.mjs";

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

const result = buildHistoricalPromiseArtifacts({
  repoRoot,
  outputDir: readOption("--output-dir", "artifacts/assurance"),
});
const evaluation = evaluateHistoricalPromiseArtifacts(result);

const summary = {
  scannedFiles: result.driftReport.scannedFiles,
  totalPromises: result.promises.length,
  releaseClaimCount: result.driftReport.releaseClaimCount,
  checkMode,
  pass: evaluation.pass,
  reasons: evaluation.reasons,
  outputs: result.outputs,
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

if (checkMode && !evaluation.pass) {
  process.exitCode = 1;
}
