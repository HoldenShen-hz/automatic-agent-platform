import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

type InitPilotEvidenceModule = {
  initP0PilotEvidence: (options?: {
    platformRoot?: string;
    inputRoot?: string;
    force?: boolean;
  }) => { inputRoot: string; divisions: readonly string[]; force: boolean };
};

const initModule = await import(
  new URL("../../../scripts/validation/init-p0-pilot-evidence.ts", import.meta.url).href
) as InitPilotEvidenceModule;

test("initP0PilotEvidence scaffolds all three P0 division template directories", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-p0-init-"));
  try {
    const result = initModule.initP0PilotEvidence({
      platformRoot: workspace,
      force: true,
    });

    assert.deepEqual(result.divisions, ["coding", "knowledge-base", "customer-service"]);
    const codingEval = JSON.parse(readFileSync(join(result.inputRoot, "coding", "eval-cases.json"), "utf8")) as { cases: Array<{ caseId: string }> };
    const knowledgeEval = JSON.parse(readFileSync(join(result.inputRoot, "knowledge-base", "eval-cases.json"), "utf8")) as { cases: Array<{ claims: unknown[] }> };
    const customerBenchmark = JSON.parse(readFileSync(join(result.inputRoot, "customer-service", "benchmark-results.json"), "utf8")) as { comparisons: Array<{ benchmarkId: string }> };

    assert.equal(codingEval.cases[0]?.caseId, "coding-001");
    assert.equal(Array.isArray(knowledgeEval.cases[0]?.claims), true);
    assert.equal(customerBenchmark.comparisons[0]?.benchmarkId, "tau-bench");
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("initP0PilotEvidence rejects input roots outside the platform data directory", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-p0-init-invalid-root-"));
  try {
    assert.throws(
      () => initModule.initP0PilotEvidence({
        platformRoot: workspace,
        inputRoot: join(tmpdir(), "outside-pilot-evidence"),
        force: true,
      }),
      /pilot_evidence\.invalid_input_root/,
    );
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
