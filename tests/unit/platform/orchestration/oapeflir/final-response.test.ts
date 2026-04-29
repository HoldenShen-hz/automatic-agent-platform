import test from "node:test";
import assert from "node:assert/strict";

import type { FinalResponse } from "../../../../../src/platform/orchestration/oapeflir/final-response.js";

test("FinalResponse structure", () => {
  const response: FinalResponse = {
    taskId: "task_123",
    executionId: "exec_abc",
    planId: "plan_xyz",
    planVersion: 1,
    human: {
      summary: "Task completed successfully",
      sections: [],
      citations: [],
    },
    executionDurationMs: 1250,
    modelId: "claude-sonnet-4",
    retryCount: 0,
    artifacts: ["artifact:art_1", "artifact:art_2"],
    citations: [],
    confidenceScore: 0.95,
    disclaimer: null,
    generatedAt: "2024-01-01T00:00:00.000Z",
  };

  assert.equal(response.taskId, "task_123");
  assert.equal(response.human.summary, "Task completed successfully");
  assert.equal(response.executionDurationMs, 1250);
  assert.equal(response.modelId, "claude-sonnet-4");
  assert.equal(response.artifacts.length, 2);
  assert.equal(response.citations.length, 0);
});

test("FinalResponse with empty arrays", () => {
  const response: FinalResponse = {
    taskId: "task_empty",
    executionId: "exec_empty",
    planId: "plan_empty",
    planVersion: 1,
    human: {
      summary: "No artifacts or evidence",
      sections: [],
      citations: [],
    },
    executionDurationMs: 0,
    modelId: "local-simulated",
    retryCount: 0,
    artifacts: [],
    citations: [],
    confidenceScore: 0.5,
    disclaimer: null,
    generatedAt: "2024-01-01T00:00:00.000Z",
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
    human: {
      summary: "Clean execution",
      sections: [],
      citations: ["evidence:sig_1"],
    },
    executionDurationMs: 2400,
    modelId: "gpt-5",
    retryCount: 1,
    artifacts: ["artifact:clean"],
    citations: [],
    confidenceScore: 1.0,
    disclaimer: null,
    generatedAt: "2024-01-01T00:00:00.000Z",
  };

  assert.equal(response.human.summary, "Clean execution");
  assert.equal(response.retryCount, 1);
  assert.equal(response.artifacts.length, 1);
});
