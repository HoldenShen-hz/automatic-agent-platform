import assert from "node:assert/strict";
import test from "node:test";

import type { FinalResponse } from "../../../../../src/platform/five-plane-orchestration/oapeflir/final-response.js";

test("FinalResponse exposes all required section 27 fields", () => {
  const response: FinalResponse = {
    taskId: "task_1",
    executionId: "execution_1",
    planId: "plan_1",
    planVersion: 1,
    audience: "operator",
    runId: "run_1",
    human: {
      summary: "Completed",
      sections: ["Summary"],
      citations: ["doc://knowledge/1"],
    },
    executionDurationMs: 1200,
    modelId: "runtime",
    retryCount: 0,
    artifacts: ["artifact://report/1"],
    citations: ["knowledge://source/1"],
    citationsRequired: true,
    evidenceRefs: ["evidence://step/1"],
    dataClass: "internal",
    redactionApplied: false,
    safetyLabels: ["safe"],
    confidenceScore: 0.92,
    limitations: "Only validated against staging data.",
    disclaimer: "Human review recommended before release.",
    generatedAt: "2026-05-06T00:00:00.000Z",
  };

  assert.equal(response.audience, "operator");
  assert.equal(response.runId, "run_1");
  assert.equal(response.citationsRequired, true);
  assert.deepEqual(response.evidenceRefs, ["evidence://step/1"]);
  assert.equal(response.dataClass, "internal");
  assert.equal(response.redactionApplied, false);
  assert.deepEqual(response.safetyLabels, ["safe"]);
  assert.equal(response.limitations, "Only validated against staging data.");
});
