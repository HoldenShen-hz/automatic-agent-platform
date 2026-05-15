import test from "node:test";
import assert from "node:assert/strict";

import type { FinalResponse } from "../../../../../src/platform/five-plane-orchestration/oapeflir/final-response.js";

test("FinalResponse structure", () => {
  const response: FinalResponse = {
    taskId: "task_123",
    executionId: "exec_abc",
    planId: "plan_xyz",
    planVersion: 1,
    audience: "operator",
    runId: "run_123",
    human: {
      summary: "Task completed successfully",
      sections: [],
      citations: [],
    },
    artifacts: ["artifact:art_1", "artifact:art_2"],
    citations: [],
    citationsRequired: true,
    evidenceRefs: ["evidence:step_1"],
    dataClass: "internal",
    redactionApplied: false,
    confidenceScore: 0.95,
    limitations: "Validated only in test fixtures.",
    safetyLabels: ["safe"],
    disclaimer: null,
    generatedAt: "2024-01-01T00:00:00.000Z",
    executionDurationMs: 1200,
    modelId: "runtime",
    retryCount: 0,
  };

  assert.equal(response.taskId, "task_123");
  assert.equal(response.human.summary, "Task completed successfully");
  assert.equal(response.artifacts.length, 2);
  assert.equal(response.citations.length, 0);
  assert.equal(response.audience, "operator");
  assert.equal(response.runId, "run_123");
});

test("FinalResponse with empty arrays", () => {
  const response: FinalResponse = {
    taskId: "task_empty",
    executionId: "exec_empty",
    planId: "plan_empty",
    planVersion: 1,
    audience: "auditor",
    runId: "run_empty",
    human: {
      summary: "No artifacts or evidence",
      sections: [],
      citations: [],
    },
    artifacts: [],
    citations: [],
    citationsRequired: false,
    evidenceRefs: [],
    dataClass: "internal",
    redactionApplied: false,
    confidenceScore: 0.5,
    limitations: "No external evidence required.",
    safetyLabels: [],
    disclaimer: null,
    generatedAt: "2024-01-01T00:00:00.000Z",
    executionDurationMs: 0,
    modelId: "runtime",
    retryCount: 0,
  };

  assert.equal(response.artifacts.length, 0);
  assert.equal(response.citations.length, 0);
});

test("FinalResponse with citations", () => {
  const response: FinalResponse = {
    taskId: "task_citations",
    executionId: "exec_citations",
    planId: "plan_citations",
    planVersion: 1,
    audience: "stakeholder",
    runId: "run_citations",
    human: {
      summary: "Clean execution",
      sections: [],
      citations: ["evidence:sig_1"],
    },
    artifacts: ["artifact:clean"],
    citations: [],
    citationsRequired: true,
    evidenceRefs: ["evidence:sig_1"],
    dataClass: "internal",
    redactionApplied: false,
    confidenceScore: 1.0,
    limitations: "Evidence references are required.",
    safetyLabels: ["reviewed"],
    disclaimer: null,
    generatedAt: "2024-01-01T00:00:00.000Z",
    executionDurationMs: 200,
    modelId: "runtime",
    retryCount: 0,
  };

  assert.equal(response.human.summary, "Clean execution");
  assert.equal(response.artifacts.length, 1);
});
