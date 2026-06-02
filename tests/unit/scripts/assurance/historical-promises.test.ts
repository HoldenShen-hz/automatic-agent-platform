import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import {
  buildHistoricalPromiseArtifacts,
  evaluateHistoricalPromiseArtifacts,
} from "../../../../scripts/assurance/historical-promises-lib.mjs";

function writeFile(path: string, content: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

test("historical promise artifacts extract multilingual promise lines and emit drift reports", () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "aa-historical-promises-"));
  writeFile(
    join(repoRoot, "docs_zh", "reference", "sample.md"),
    [
      "# Sample",
      "P0 release-ready gate 必须有 evidence。",
      "This component SHOULD emit a metric.",
      "",
    ].join("\n"),
  );
  writeFile(
    join(repoRoot, "README.md"),
    [
      "# Root",
      "The pilot is done and production-ready.",
      "",
    ].join("\n"),
  );

  const result = buildHistoricalPromiseArtifacts({
    repoRoot,
    outputDir: "artifacts/assurance",
  });
  const evaluation = evaluateHistoricalPromiseArtifacts(result);

  assert.equal(evaluation.pass, true);
  assert.equal(result.promises.length, 3);
  assert.equal(result.driftReport.scannedFiles, 2);
  assert.equal(result.driftReport.releaseClaimCount >= 2, true);

  const report = JSON.parse(readFileSync(result.outputs.driftJsonPath, "utf8"));
  assert.equal(report.totalPromises, 3);
  assert.equal(Array.isArray(report.files), true);
});
