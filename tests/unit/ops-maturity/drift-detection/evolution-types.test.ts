import assert from "node:assert/strict";
import test from "node:test";

import type {
  ImprovementProposal,
  ProposalKind,
  ProposalStatus,
} from "../../../../src/ops-maturity/drift-detection/proposal-engine.js";
import type {
  RolloutRecord,
  RolloutStage,
  RolloutStatus,
  RolloutMetrics,
} from "../../../../src/ops-maturity/drift-detection/rollout-manager.js";
import type { ReflectionRecord } from "../../../../src/ops-maturity/drift-detection/reflection-engine.js";
import type {
  EvaluationReport,
  BenchmarkResult,
  BenchmarkCase,
} from "../../../../src/ops-maturity/drift-detection/benchmark-runner.js";
import type { EvidenceRecord } from "../../../../src/ops-maturity/drift-detection/evidence-store.js";

test("ProposalKind type accepts valid values", () => {
  const kinds: ProposalKind[] = [
    "prompt_patch",
    "tool_routing_rule",
    "workflow_template",
    "skill_doc",
    "threshold_tuning",
  ];
  assert.equal(kinds.length, 5);
});

test("ProposalStatus type accepts valid values", () => {
  const statuses: ProposalStatus[] = [
    "proposed",
    "testing",
    "canary",
    "active",
    "rejected",
    "rolled_back",
  ];
  assert.equal(statuses.length, 6);
});

test("ImprovementProposal structure is correct", () => {
  const proposal: ImprovementProposal = {
    id: "prop_123",
    title: "Test Proposal",
    description: "A test proposal",
    kind: "tool_routing_rule",
    target: "test_target",
    patch: '{"test": true}',
    rationale: "Test rationale",
    risk: "low",
    evidenceIds: ["ev_1", "ev_2"],
    status: "proposed",
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(proposal.id, "prop_123");
  assert.equal(proposal.kind, "tool_routing_rule");
  assert.equal(proposal.risk, "low");
  assert.equal(proposal.status, "proposed");
  assert.equal(proposal.evidenceIds.length, 2);
});

test("ImprovementProposal allows optional expectedBenefit", () => {
  const proposal: ImprovementProposal = {
    id: "prop_123",
    title: "Test Proposal",
    description: "A test proposal",
    kind: "skill_doc",
    target: "test_target",
    patch: "{}",
    rationale: "Test rationale",
    risk: "medium",
    evidenceIds: [],
    status: "proposed",
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
    expectedBenefit: {
      quality: 0.1,
      latency: -0.05,
      cost: 0.02,
      stability: 0.15,
    },
  };
  assert.ok(proposal.expectedBenefit);
  assert.equal(proposal.expectedBenefit!.quality, 0.1);
  assert.equal(proposal.expectedBenefit!.latency, -0.05);
});

test("ImprovementProposal risk can be high", () => {
  const proposal: ImprovementProposal = {
    id: "prop_123",
    title: "Security Enhancement",
    description: "A high risk proposal",
    kind: "prompt_patch",
    target: "security",
    patch: "{}",
    rationale: "Security improvement",
    risk: "high",
    evidenceIds: [],
    status: "proposed",
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(proposal.risk, "high");
});

test("RolloutStage type accepts valid values", () => {
  const stages: RolloutStage[] = ["shadow", "canary", "partial", "stable"];
  assert.equal(stages.length, 4);
});

test("RolloutStatus type accepts valid values", () => {
  const statuses: RolloutStatus[] = ["running", "succeeded", "failed", "rolled_back"];
  assert.equal(statuses.length, 4);
});

test("RolloutRecord structure is correct", () => {
  const record: RolloutRecord = {
    proposalId: "prop_123",
    stage: "canary",
    percentage: 5,
    startedAt: "2026-04-14T00:00:00.000Z",
    status: "running",
  };
  assert.equal(record.proposalId, "prop_123");
  assert.equal(record.stage, "canary");
  assert.equal(record.percentage, 5);
  assert.equal(record.status, "running");
});

test("RolloutRecord allows optional completedAt and metrics", () => {
  const record: RolloutRecord = {
    proposalId: "prop_123",
    stage: "stable",
    percentage: 100,
    startedAt: "2026-04-14T00:00:00.000Z",
    completedAt: "2026-04-14T12:00:00.000Z",
    status: "succeeded",
    metrics: {
      successRate: 0.95,
      errorRate: 0.02,
      latencyMs: 4500,
      costUsd: 0.25,
    },
  };
  assert.ok(record.completedAt);
  assert.ok(record.metrics);
  assert.equal(record.metrics!.successRate, 0.95);
});

test("RolloutRecord allows failureReason on failed rollout", () => {
  const record: RolloutRecord = {
    proposalId: "prop_123",
    stage: "canary",
    percentage: 5,
    startedAt: "2026-04-14T00:00:00.000Z",
    completedAt: "2026-04-14T01:00:00.000Z",
    status: "failed",
    failureReason: "Safety violation detected",
  };
  assert.equal(record.status, "failed");
  assert.equal(record.failureReason, "Safety violation detected");
});

test("RolloutMetrics structure is correct", () => {
  const metrics: RolloutMetrics = {
    successRate: 0.92,
    errorRate: 0.05,
    latencyMs: 3500,
    costUsd: 0.18,
  };
  assert.equal(metrics.successRate, 0.92);
  assert.equal(metrics.errorRate, 0.05);
  assert.equal(metrics.latencyMs, 3500);
  assert.equal(metrics.costUsd, 0.18);
});

test("ReflectionRecord structure is correct", () => {
  const record: ReflectionRecord = {
    id: "refl_123",
    evidenceIds: ["ev_1", "ev_2"],
    taskType: "code_edit",
    rootCause: "Type checking errors",
    recommendation: "Add explicit type annotations",
    confidence: 0.85,
    createdAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.id, "refl_123");
  assert.equal(record.taskType, "code_edit");
  assert.equal(record.confidence, 0.85);
  assert.equal(record.evidenceIds.length, 2);
});

test("ReflectionRecord allows optional metadata", () => {
  const record: ReflectionRecord = {
    id: "refl_123",
    evidenceIds: [],
    taskType: "test",
    rootCause: "Test failure",
    recommendation: "Fix test",
    confidence: 0.7,
    createdAt: "2026-04-14T00:00:00.000Z",
    metadata: {
      failureMode: "unit_test_failure",
      sampleSize: 5,
      avgRepairRounds: 2.3,
    },
  };
  assert.ok(record.metadata);
  assert.equal(record.metadata!["failureMode"], "unit_test_failure");
});

test("EvaluationReport structure is correct", () => {
  const report: EvaluationReport = {
    proposalId: "prop_123",
    benchmarkCases: 20,
    successRateBefore: 0.6,
    successRateAfter: 0.75,
    regressionRate: 0,
    avgCostDelta: -0.1,
    avgLatencyDelta: -0.05,
    safetyViolations: 0,
    decision: "promote",
    createdAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(report.proposalId, "prop_123");
  assert.equal(report.benchmarkCases, 20);
  assert.equal(report.decision, "promote");
  assert.equal(report.regressionRate, 0);
});

test("EvaluationReport decision can be reject", () => {
  const report: EvaluationReport = {
    proposalId: "prop_123",
    benchmarkCases: 20,
    successRateBefore: 0.6,
    successRateAfter: 0.5,
    regressionRate: 0.1,
    avgCostDelta: 0.2,
    avgLatencyDelta: 0.1,
    safetyViolations: 0,
    decision: "reject",
    createdAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(report.decision, "reject");
});

test("EvaluationReport decision can be needs_revision", () => {
  const report: EvaluationReport = {
    proposalId: "prop_123",
    benchmarkCases: 20,
    successRateBefore: 0.6,
    successRateAfter: 0.65,
    regressionRate: 0,
    avgCostDelta: 0,
    avgLatencyDelta: 0,
    safetyViolations: 2,
    decision: "needs_revision",
    createdAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(report.decision, "needs_revision");
  assert.equal(report.safetyViolations, 2);
});

test("BenchmarkResult structure is correct", () => {
  const result: BenchmarkResult = {
    testCaseId: "case_1",
    success: true,
    costUsd: 0.25,
    latencyMs: 4000,
    violations: [],
  };
  assert.equal(result.testCaseId, "case_1");
  assert.equal(result.success, true);
  assert.equal(result.costUsd, 0.25);
  assert.deepEqual(result.violations, []);
});

test("BenchmarkResult allows violations", () => {
  const result: BenchmarkResult = {
    testCaseId: "case_2",
    success: false,
    costUsd: 0.50,
    latencyMs: 9000,
    violations: ["security_policy_violation", "timeout"],
  };
  assert.equal(result.success, false);
  assert.equal(result.violations.length, 2);
  assert.ok(result.violations.includes("security_policy_violation"));
});

test("BenchmarkCase structure is correct", () => {
  const testCase: BenchmarkCase = {
    id: "bench_1",
    taskType: "code_edit",
    input: { filePath: "/test.ts", content: "test" },
  };
  assert.equal(testCase.id, "bench_1");
  assert.equal(testCase.taskType, "code_edit");
  assert.ok(testCase.input);
});

test("BenchmarkCase allows optional expectedOutput and critical", () => {
  const testCase: BenchmarkCase = {
    id: "bench_2",
    taskType: "code_edit",
    input: {},
    expectedOutput: { success: true },
    critical: true,
  };
  assert.ok(testCase.expectedOutput);
  assert.equal(testCase.critical, true);
});

test("EvidenceRecord structure is correct", () => {
  const record: EvidenceRecord = {
    id: "ev_123",
    taskType: "code_edit",
    sessionId: "sess_abc",
    traceId: "trace_xyz",
    success: true,
    costUsd: 0.15,
    latencyMs: 3000,
    toolCalls: 12,
    repairRounds: 0,
    rollback: false,
    createdAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.id, "ev_123");
  assert.equal(record.taskType, "code_edit");
  assert.equal(record.success, true);
  assert.equal(record.costUsd, 0.15);
  assert.equal(record.toolCalls, 12);
});

test("EvidenceRecord allows failure fields", () => {
  const record: EvidenceRecord = {
    id: "ev_456",
    taskType: "code_edit",
    sessionId: "sess_abc",
    traceId: "trace_xyz",
    success: false,
    failureMode: "type_error",
    failureCategory: "type_error",
    costUsd: 0.35,
    latencyMs: 8000,
    toolCalls: 25,
    repairRounds: 3,
    rollback: true,
    acceptedByUser: false,
    createdAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.success, false);
  assert.equal(record.failureMode, "type_error");
  assert.equal(record.failureCategory, "type_error");
  assert.equal(record.repairRounds, 3);
  assert.equal(record.rollback, true);
});

test("EvidenceRecord failureCategory type accepts all valid values", () => {
  const categories: EvidenceRecord["failureCategory"][] = [
    "schema_error",
    "type_error",
    "unit_test_failure",
    "lint_error",
    "complex_repair_failure",
    "forbidden_path",
    "security_policy_violation",
  ];
  assert.equal(categories.length, 7);
});

test("EvidenceRecord allows optional acceptedByUser", () => {
  const record: EvidenceRecord = {
    id: "ev_789",
    taskType: "code_edit",
    sessionId: "sess_abc",
    traceId: "trace_xyz",
    success: true,
    costUsd: 0.15,
    latencyMs: 3000,
    toolCalls: 12,
    repairRounds: 0,
    rollback: false,
    acceptedByUser: true,
    createdAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.acceptedByUser, true);
});
