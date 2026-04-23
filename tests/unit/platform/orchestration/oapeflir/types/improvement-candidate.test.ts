import test from "node:test";
import assert from "node:assert/strict";

import {
  ImprovementCandidateSchema,
  parseImprovementCandidate,
  ImprovementChangeScopeSchema,
  ImprovementCandidateStatusSchema,
} from "../../../../../../src/platform/orchestration/oapeflir/types/improvement-candidate.js";

test("ImprovementChangeScopeSchema accepts valid scopes", () => {
  const scopes = ["prompt", "policy", "model", "workflow", "tool_config"] as const;
  for (const scope of scopes) {
    assert.equal(ImprovementChangeScopeSchema.parse(scope), scope);
  }
});

test("ImprovementChangeScopeSchema rejects invalid scope", () => {
  assert.throws(() => ImprovementChangeScopeSchema.parse("invalid_scope"));
});

test("ImprovementCandidateStatusSchema accepts valid statuses", () => {
  const statuses = ["proposed", "evaluating", "approved", "shadow_running", "rejected", "rolled_back"] as const;
  for (const status of statuses) {
    assert.equal(ImprovementCandidateStatusSchema.parse(status), status);
  }
});

test("ImprovementCandidateStatusSchema rejects invalid status", () => {
  assert.throws(() => ImprovementCandidateStatusSchema.parse("invalid_status"));
});

test("ImprovementCandidateSchema parses valid candidate", () => {
  const validCandidate = {
    candidateId: "cand_001",
    taskId: "task_123",
    sourceSignalRefs: ["signal_1", "signal_2"],
    sourceLearningObjectIds: ["lo_1", "lo_2"],
    changeScope: "workflow",
    description: "Improve workflow efficiency",
    expectedBenefit: "Reduce execution time by 30%",
    status: "proposed",
    createdAt: Date.now(),
  };

  const result = ImprovementCandidateSchema.parse(validCandidate);
  assert.equal(result.candidateId, "cand_001");
  assert.equal(result.taskId, "task_123");
  assert.equal(result.changeScope, "workflow");
  assert.equal(result.status, "proposed");
  assert.deepEqual(result.sourceSignalRefs, ["signal_1", "signal_2"]);
  assert.deepEqual(result.sourceLearningObjectIds, ["lo_1", "lo_2"]);
});

test("ImprovementCandidateSchema applies defaults", () => {
  const minimalCandidate = {
    candidateId: "cand_min",
    taskId: "task_min",
    changeScope: "prompt" as const,
    description: "Minimal candidate",
    expectedBenefit: "Minor improvement",
    status: "proposed" as const,
    createdAt: 0,
  };

  const result = ImprovementCandidateSchema.parse(minimalCandidate);
  assert.deepEqual(result.sourceSignalRefs, []);
  assert.deepEqual(result.sourceLearningObjectIds, []);
});

test("ImprovementCandidateSchema rejects invalid changeScope", () => {
  assert.throws(() => {
    ImprovementCandidateSchema.parse({
      candidateId: "cand_err",
      taskId: "task_err",
      changeScope: "invalid",
      description: "Test",
      expectedBenefit: "Test",
      status: "proposed",
      createdAt: 0,
    });
  });
});

test("ImprovementCandidateSchema rejects invalid status", () => {
  assert.throws(() => {
    ImprovementCandidateSchema.parse({
      candidateId: "cand_err",
      taskId: "task_err",
      changeScope: "policy",
      description: "Test",
      expectedBenefit: "Test",
      status: "invalid_status",
      createdAt: 0,
    });
  });
});

test("ImprovementCandidateSchema rejects missing required fields", () => {
  assert.throws(() => {
    ImprovementCandidateSchema.parse({
      candidateId: "cand_partial",
    });
  });
});

test("ImprovementCandidateSchema rejects empty candidateId", () => {
  assert.throws(() => {
    ImprovementCandidateSchema.parse({
      candidateId: "",
      taskId: "task_123",
      changeScope: "workflow",
      description: "Test",
      expectedBenefit: "Test",
      status: "approved",
      createdAt: 0,
    });
  });
});

test("ImprovementCandidateSchema rejects empty description", () => {
  assert.throws(() => {
    ImprovementCandidateSchema.parse({
      candidateId: "cand_err",
      taskId: "task_123",
      changeScope: "workflow",
      description: "",
      expectedBenefit: "Test",
      status: "approved",
      createdAt: 0,
    });
  });
});

test("parseImprovementCandidate returns parsed ImprovementCandidate", () => {
  const input = {
    candidateId: "cand_parse_1",
    taskId: "task_parse",
    sourceSignalRefs: ["sig_1", "sig_2", "sig_3"],
    sourceLearningObjectIds: ["lo_learning_1"],
    changeScope: "model",
    description: "Optimize model parameters based on feedback",
    expectedBenefit: "Improve accuracy by 15%",
    status: "evaluating",
    createdAt: 9876543210,
  };

  const result = parseImprovementCandidate(input);
  assert.equal(result.candidateId, "cand_parse_1");
  assert.equal(result.changeScope, "model");
  assert.equal(result.status, "evaluating");
  assert.equal(result.sourceSignalRefs.length, 3);
  assert.equal(result.sourceLearningObjectIds.length, 1);
});

test("parseImprovementCandidate throws on invalid input", () => {
  assert.throws(() => {
    parseImprovementCandidate({
      candidateId: "",
      taskId: "",
      changeScope: "invalid",
      description: "",
      expectedBenefit: "",
      status: "invalid",
      createdAt: -1,
    });
  });
});

test("ImprovementCandidateSchema accepts all change scopes with different statuses", () => {
  const scopes = ["prompt", "policy", "model", "workflow", "tool_config"] as const;
  const statuses = ["proposed", "evaluating", "approved", "shadow_running", "rejected", "rolled_back"] as const;

  for (const scope of scopes) {
    for (const status of statuses) {
      const candidate = {
        candidateId: `cand_${scope}_${status}`,
        taskId: "task_test",
        changeScope: scope,
        description: "Test description",
        expectedBenefit: "Test benefit",
        status,
        createdAt: 0,
      };
      const result = ImprovementCandidateSchema.parse(candidate);
      assert.equal(result.changeScope, scope);
      assert.equal(result.status, status);
    }
  }
});
