import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { createSideEffectRecord } from "../../../src/platform/contracts/executable-contracts/index.js";
import { CompensationManager } from "../../../src/platform/five-plane-execution/compensation-manager.js";

function readRepoFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

test("R6-19: CompensationManager emits evidence keyed by compensation nodeRunId", () => {
  const manager = new CompensationManager();
  const sideEffect = createSideEffectRecord({
    sideEffectId: "seffect-r6-19",
    harnessRunId: "hrun-r6-19",
    nodeRunId: "nrun-origin",
    nodeAttemptId: "attempt-r6-19",
    effectKind: "external_api",
    idempotencyKey: "idem-r6-19",
    riskClass: "low",
    preCommitPolicyProofRef: {
      artifactId: "proof-1",
      uri: "artifact://proof-1",
      kind: "policy_proof",
    },
    status: "failed",
  });

  const plan = manager.planCompensation(sideEffect, {
    tenantId: "tenant-r6-19",
    traceId: "trace-r6-19",
    operatorId: "operator-r6-19",
    reason: "manual repair",
  });
  const firstStep = plan.steps[0];

  assert.ok(firstStep);
  assert.ok(firstStep.nodeRunId.startsWith("nrun_"));
  assert.equal(firstStep.stepId, firstStep.nodeRunId);

  const result = manager.executeCompensationSteps(plan, {
    tenantId: "tenant-r6-19",
    traceId: "trace-r6-19",
    operatorId: "operator-r6-19",
    reason: "manual repair",
  });

  assert.equal(result.evidenceRefs[0]?.artifactId, firstStep.nodeRunId);
  assert.equal(result.evidenceRefs[0]?.uri, `compensation://${plan.compensationId}/${firstStep.nodeRunId}`);
});

test("R6-19: legacy execution-receipt compatibility path exposes nodeRunId", () => {
  const source = readRepoFile("src/platform/contracts/execution-receipt/index.ts");
  assert.match(source, /nodeRunId\?: string \| null/);
  assert.match(source, /@deprecated legacy execution projection; use nodeRunId/);
  assert.match(source, /stepId\?: string \| null/);
});

test("R6-19: external SDK takeover and demo surfaces expose nodeRunId", () => {
  const takeoverEnvSource = readRepoFile("src/platform/control-plane/config-center/takeover-cli-env.ts");
  const takeoverCliSource = readRepoFile("src/sdk/cli/takeover.ts");
  const demoSource = readRepoFile("src/sdk/cli/phase1b-demo.ts");
  const takeoverServiceSource = readRepoFile("src/platform/control-plane/incident-control/human-takeover-service.ts");

  assert.match(takeoverEnvSource, /AA_NODE_RUN_ID/);
  assert.match(takeoverCliSource, /nodeRunId: envConfig\.nodeRunId/);
  assert.match(demoSource, /nodeRunId: step\.nodeRunId/);
  assert.match(takeoverServiceSource, /const nodeRunId = input\.nodeRunId/);
  assert.match(takeoverServiceSource, /payload: \{\s*nodeRunId,/m);
});
