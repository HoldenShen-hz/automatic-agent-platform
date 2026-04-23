import test from "node:test";
import assert from "node:assert/strict";

import {
  UnifiedAssessmentSchema,
  parseUnifiedAssessment,
  createAssessmentRef,
  AssessmentPhaseSchema,
  AssessmentComplexitySchema,
  AssessmentRiskSchema,
  ApprovalLevelSchema,
  ExecutionModeSchema,
} from "../../../../../../src/platform/orchestration/oapeflir/types/unified-assessment.js";

test("AssessmentPhaseSchema accepts valid phases", () => {
  const phases = ["pre-execution", "post-execution"] as const;
  for (const phase of phases) {
    assert.equal(AssessmentPhaseSchema.parse(phase), phase);
  }
});

test("AssessmentPhaseSchema rejects invalid phase", () => {
  assert.throws(() => AssessmentPhaseSchema.parse("invalid"));
});

test("AssessmentComplexitySchema accepts valid complexities", () => {
  const complexities = ["trivial", "simple", "moderate", "complex", "critical"] as const;
  for (const c of complexities) {
    assert.equal(AssessmentComplexitySchema.parse(c), c);
  }
});

test("AssessmentRiskSchema accepts valid risks", () => {
  const risks = ["low", "medium", "high", "critical"] as const;
  for (const r of risks) {
    assert.equal(AssessmentRiskSchema.parse(r), r);
  }
});

test("ApprovalLevelSchema accepts valid levels", () => {
  const levels = ["none", "user", "admin"] as const;
  for (const l of levels) {
    assert.equal(ApprovalLevelSchema.parse(l), l);
  }
});

test("ExecutionModeSchema accepts valid modes", () => {
  const modes = ["auto", "supervised", "manual"] as const;
  for (const m of modes) {
    assert.equal(ExecutionModeSchema.parse(m), m);
  }
});

test("UnifiedAssessmentSchema parses valid assessment", () => {
  const validData = {
    taskId: "task_123",
    timestamp: Date.now(),
    situationRef: "situation_1",
    phase: "pre-execution",
    complexity: "moderate",
    risk: "medium",
    riskAssessment: {
      level: "medium",
      factors: ["factor_1", "factor_2"],
    },
    routingDecision: {
      division: "core",
      workflow: "standard",
      rationale: "Normal routing based on complexity",
    },
    resourceAllocation: {
      modelClass: "medium",
      maxTokens: 8000,
      timeoutMs: 60000,
    },
    approvalPolicy: {
      required: false,
      level: "none",
    },
    executionMode: "auto",
    suggestedActions: ["action_1", "action_2"],
  };

  const result = UnifiedAssessmentSchema.parse(validData);
  assert.equal(result.taskId, "task_123");
  assert.equal(result.phase, "pre-execution");
  assert.equal(result.complexity, "moderate");
  assert.equal(result.risk, "medium");
  assert.deepEqual(result.riskAssessment.factors, ["factor_1", "factor_2"]);
  assert.deepEqual(result.suggestedActions, ["action_1", "action_2"]);
});

test("UnifiedAssessmentSchema applies defaults", () => {
  const minimalData = {
    taskId: "task_min",
    timestamp: 1234567890,
    situationRef: "sit_min",
    phase: "post-execution",
    complexity: "simple",
    risk: "low",
    riskAssessment: {
      level: "low",
      factors: [],
    },
    routingDecision: {
      division: "core",
      workflow: "simple",
      rationale: "Simple task",
    },
    resourceAllocation: {
      modelClass: "small",
      maxTokens: 4000,
      timeoutMs: 30000,
    },
    approvalPolicy: {
      required: false,
    },
    executionMode: "auto",
  };

  const result = UnifiedAssessmentSchema.parse(minimalData);
  assert.deepEqual(result.suggestedActions, []);
});

test("UnifiedAssessmentSchema rejects invalid complexity", () => {
  assert.throws(() => {
    UnifiedAssessmentSchema.parse({
      taskId: "task_err",
      timestamp: 0,
      situationRef: "sit_err",
      phase: "pre-execution",
      complexity: "invalid_complexity",
      risk: "medium",
      riskAssessment: { level: "medium", factors: [] },
      routingDecision: { division: "d", workflow: "w", rationale: "r" },
      resourceAllocation: { modelClass: "m", maxTokens: 1000, timeoutMs: 1000 },
      approvalPolicy: { required: false },
      executionMode: "auto",
    });
  });
});

test("UnifiedAssessmentSchema rejects missing required fields", () => {
  assert.throws(() => {
    UnifiedAssessmentSchema.parse({
      taskId: "task_partial",
    });
  });
});

test("parseUnifiedAssessment returns parsed UnifiedAssessment", () => {
  const input = {
    taskId: "task_parse_1",
    timestamp: 9876543210,
    situationRef: "assessment_ref_1",
    phase: "post-execution",
    complexity: "complex",
    risk: "high",
    riskAssessment: {
      level: "high",
      factors: ["large_scale", "multiple_dependencies"],
    },
    routingDecision: {
      division: "enterprise",
      workflow: "complex",
      rationale: "High complexity requires enterprise workflow",
    },
    resourceAllocation: {
      modelClass: "large",
      maxTokens: 16000,
      timeoutMs: 120000,
    },
    approvalPolicy: {
      required: true,
      level: "admin",
    },
    executionMode: "supervised",
    suggestedActions: [],
  };

  const result = parseUnifiedAssessment(input);
  assert.equal(result.taskId, "task_parse_1");
  assert.equal(result.phase, "post-execution");
  assert.equal(result.complexity, "complex");
  assert.equal(result.risk, "high");
  assert.equal(result.approvalPolicy.required, true);
  assert.equal(result.approvalPolicy.level, "admin");
});

test("parseUnifiedAssessment throws on invalid input", () => {
  assert.throws(() => {
    parseUnifiedAssessment({
      taskId: "",
      timestamp: 0,
      situationRef: "",
      phase: "invalid",
      complexity: "invalid",
      risk: "invalid",
      riskAssessment: { level: "invalid", factors: [] },
      routingDecision: { division: "", workflow: "", rationale: "" },
      resourceAllocation: { modelClass: "", maxTokens: 0, timeoutMs: 0 },
      approvalPolicy: { required: false },
      executionMode: "invalid",
    });
  });
});

test("createAssessmentRef formats ref correctly", () => {
  const assessment = {
    taskId: "task_assess_1",
    timestamp: 1234567890,
  };

  const ref = createAssessmentRef(assessment);
  assert.equal(ref, "assessment:task_assess_1:1234567890");
});

test("createAssessmentRef handles different timestamps", () => {
  const assessment1 = { taskId: "task_1", timestamp: 1000 };
  const assessment2 = { taskId: "task_1", timestamp: 2000 };

  const ref1 = createAssessmentRef(assessment1);
  const ref2 = createAssessmentRef(assessment2);

  assert.notEqual(ref1, ref2);
  assert.equal(ref1, "assessment:task_1:1000");
  assert.equal(ref2, "assessment:task_1:2000");
});
