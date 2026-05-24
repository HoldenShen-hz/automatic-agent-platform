import assert from "node:assert/strict";
import test from "node:test";

import type { FinalResponse } from "../../../../../src/platform/five-plane-orchestration/oapeflir/final-response.js";

test("FinalResponse uses current artifact and knowledge reference shapes", () => {
  const response: FinalResponse = {
    taskId: "task-1",
    executionId: "execution-1",
    planId: "plan-1",
    planVersion: 1,
    audience: "operator",
    runId: "run-1",
    human: {
      summary: "Completed",
      sections: ["Summary"],
      citations: ["knowledge:source-1"],
    },
    artifacts: ["artifact:report-1"],
    citations: [{
      knowledgeRef: "knowledge:source-1",
      refType: "knowledge",
      namespace: "docs",
      chunkId: "chunk-1",
      documentId: "doc-1",
      score: 0.92,
      matchType: "semantic",
    }],
    citationsRequired: true,
    evidenceRefs: ["evidence:step-1"],
    dataClass: "internal",
    redactionApplied: false,
    confidenceScore: 0.92,
    limitations: "Validated against staging data only.",
    safetyLabels: ["safe"],
    disclaimer: "Human review recommended before release.",
    generatedAt: "2026-05-06T00:00:00.000Z",
    executionDurationMs: 1_200,
    modelId: "runtime",
    retryCount: 0,
  };

  assert.equal(response.citations[0]?.refType, "knowledge");
  assert.equal(response.artifacts[0], "artifact:report-1");
  assert.equal(response.citationsRequired, true);
});
