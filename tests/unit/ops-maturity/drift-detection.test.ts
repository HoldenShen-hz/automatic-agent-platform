import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryEvidenceStore, type EvidenceRecord } from "../../../src/ops-maturity/drift-detection/evidence-store.js";
import { SimpleReflectionEngine } from "../../../src/ops-maturity/drift-detection/reflection-engine.js";
import { SimpleBenchmarkRunner, type BenchmarkCase } from "../../../src/ops-maturity/drift-detection/benchmark-runner.js";
import { PromotionGate, DEFAULT_PROMOTION_GATE_CONFIG } from "../../../src/ops-maturity/drift-detection/promotion-gate.js";
import { SimpleProposalEngine } from "../../../src/ops-maturity/drift-detection/proposal-engine.js";
import { SimpleRolloutManager } from "../../../src/ops-maturity/drift-detection/rollout-manager.js";

test("drift: evidence store append and retrieve", async () => {
  const store = new InMemoryEvidenceStore();
  const record: EvidenceRecord = {
    id: "ev-001",
    taskType: "code_edit",
    sessionId: "sess-001",
    traceId: "trace-001",
    success: true,
    costUsd: 0.15,
    latencyMs: 3000,
    toolCalls: 5,
    repairRounds: 0,
    rollback: false,
    createdAt: "2026-04-29T00:00:00Z",
  };

  await store.append(record);
  const retrieved = await store.getById("ev-001");

  assert.strictEqual(retrieved?.id, "ev-001");
  assert.strictEqual(retrieved?.taskType, "code_edit");
  assert.strictEqual(retrieved?.success, true);
});

test("drift: evidence store list by task type", async () => {
  const store = new InMemoryEvidenceStore();
  for (let i = 0; i < 3; i++) {
    await store.append({
      id: `ev-type-${i}`,
      taskType: "code_edit",
      sessionId: "sess",
      traceId: `trace-${i}`,
      success: i % 2 === 0,
      costUsd: 0.1,
      latencyMs: 1000,
      toolCalls: 1,
      repairRounds: 0,
      rollback: false,
      createdAt: new Date().toISOString(),
    });
  }

  const results = await store.listByTaskType("code_edit");

  assert.strictEqual(results.length, 3);
});

test("drift: evidence store list failures", async () => {
  const store = new InMemoryEvidenceStore();
  for (let i = 0; i < 4; i++) {
    await store.append({
      id: `ev-fail-${i}`,
      taskType: "code_edit",
      sessionId: "sess",
      traceId: `trace-${i}`,
      success: i % 2 === 0,
      failureMode: i % 2 === 1 ? "type_error" : undefined,
      costUsd: 0.1,
      latencyMs: 1000,
      toolCalls: 1,
      repairRounds: 0,
      rollback: false,
      createdAt: new Date().toISOString(),
    });
  }

  const failures = await store.listFailures();

  assert.strictEqual(failures.length, 2);
});

test("drift: evidence store statistics", async () => {
  const store = new InMemoryEvidenceStore();
  await store.append({
    id: "ev-stat-1",
    taskType: "code_edit",
    sessionId: "sess",
    traceId: "trace-1",
    success: true,
    costUsd: 0.20,
    latencyMs: 2000,
    toolCalls: 3,
    repairRounds: 0,
    rollback: false,
    createdAt: new Date().toISOString(),
  });
  await store.append({
    id: "ev-stat-2",
    taskType: "code_edit",
    sessionId: "sess",
    traceId: "trace-2",
    success: false,
    failureMode: "type_error",
    costUsd: 0.30,
    latencyMs: 4000,
    toolCalls: 5,
    repairRounds: 2,
    rollback: false,
    createdAt: new Date().toISOString(),
  });

  const stats = await store.getStatistics();

  assert.strictEqual(stats.totalRecords, 2);
  assert.strictEqual(stats.successCount, 1);
  assert.strictEqual(stats.failureCount, 1);
  assert.strictEqual(stats.byTaskType["code_edit"]?.count, 2);
  assert.strictEqual(stats.byTaskType["code_edit"]?.successRate, 0.5);
});

test("drift: reflection engine generates reflections from failures", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence: EvidenceRecord[] = [
    {
      id: "ref-ev-1",
      taskType: "code_edit",
      sessionId: "sess",
      traceId: "trace",
      success: false,
      failureMode: "type_error",
      costUsd: 0.25,
      latencyMs: 5000,
      toolCalls: 4,
      repairRounds: 2,
      rollback: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: "ref-ev-2",
      taskType: "code_edit",
      sessionId: "sess",
      traceId: "trace2",
      success: false,
      failureMode: "type_error",
      costUsd: 0.30,
      latencyMs: 6000,
      toolCalls: 5,
      repairRounds: 3,
      rollback: false,
      createdAt: new Date().toISOString(),
    },
  ];

  const reflections = await engine.reflect(evidence);

  assert.ok(reflections.length > 0);
  const reflection = reflections[0];
  assert.strictEqual(reflection.taskType, "code_edit");
  assert.ok(reflection.rootCause.length > 0);
  assert.ok(reflection.recommendation.length > 0);
  assert.ok(reflection.confidence >= 0 && reflection.confidence <= 1);
});

test("drift: reflection engine single reflection", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence: EvidenceRecord = {
    id: "ref-single",
    taskType: "test_write",
    sessionId: "sess",
    traceId: "trace",
    success: false,
    failureMode: "test_failure",
    costUsd: 0.15,
    latencyMs: 3000,
    toolCalls: 3,
    repairRounds: 1,
    rollback: false,
    createdAt: new Date().toISOString(),
  };

  const reflection = await engine.reflectSingle(evidence);

  assert.strictEqual(reflection.taskType, "test_write");
  assert.ok(reflection.rootCause.includes("Test") || reflection.rootCause.includes("test"));
});

test("drift: proposal engine creates proposal from reflection", async () => {
  const engine = new SimpleProposalEngine();
  const reflection = {
    id: "refl-001",
    evidenceIds: ["ev-1", "ev-2"],
    taskType: "code_edit",
    rootCause: "Type checking and schema validation errors suggest inconsistent interface definitions",
    recommendation: "Add explicit type annotations",
    confidence: 0.75,
    createdAt: new Date().toISOString(),
  };

  const proposals = await engine.proposeFromReflection(reflection);

  assert.ok(proposals.length > 0);
  const proposal = proposals[0];
  assert.strictEqual(proposal.kind, "tool_routing_rule");
  assert.strictEqual(proposal.risk, "low");
  assert.strictEqual(proposal.status, "proposed");
  assert.deepStrictEqual(proposal.evidenceIds, ["ev-1", "ev-2"]);
});

test("drift: proposal engine manual-only kinds", async () => {
  const engine = new SimpleProposalEngine();

  assert.strictEqual(engine.requiresManualApproval("prompt_patch"), true);
  assert.strictEqual(engine.requiresManualApproval("workflow_template"), true);
  assert.strictEqual(engine.requiresManualApproval("threshold_tuning"), true);
  assert.strictEqual(engine.requiresManualApproval("tool_routing_rule"), false);
});

test("drift: proposal engine auto-promote kinds", async () => {
  const engine = new SimpleProposalEngine();

  assert.strictEqual(engine.canAutoPromote("tool_routing_rule"), true);
  assert.strictEqual(engine.canAutoPromote("skill_doc"), true);
  assert.strictEqual(engine.canAutoPromote("prompt_patch"), false);
});

test("drift: proposal engine create and list pending", async () => {
  const engine = new SimpleProposalEngine();
  await engine.create({
    title: "Test Proposal",
    description: "A test proposal",
    kind: "tool_routing_rule",
    target: "test_target",
    risk: "low",
    agentId: "agent-001",
    evidenceIds: ["ev-1"],
  });

  const pending = await engine.listPending();

  assert.strictEqual(pending.length, 1);
  assert.strictEqual(pending[0].title, "Test Proposal");
});

test("drift: benchmark runner evaluates proposal", async () => {
  const runner = new SimpleBenchmarkRunner();
  const proposal = {
    id: "prop-test",
    title: "Test Proposal",
    description: "Test",
    kind: "tool_routing_rule",
    target: "type_validation",
    patch: "{}",
    rationale: "Test",
    risk: "low" as const,
    evidenceIds: [],
    status: "proposed" as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const report = await runner.evaluate(proposal);

  assert.strictEqual(report.proposalId, "prop-test");
  assert.ok(report.benchmarkCases >= 0);
  assert.ok(report.successRateBefore >= 0);
  assert.ok(report.successRateAfter >= 0);
  assert.ok(report.regressionRate >= 0);
});

test("drift: benchmark runner with test cases", async () => {
  const runner = new SimpleBenchmarkRunner([
    { id: "tc-1", taskType: "tool_invocation", input: {} },
    { id: "tc-2", taskType: "tool_invocation", input: {} },
  ]);
  const proposal = {
    id: "prop-with-cases",
    title: "Test",
    description: "Test",
    kind: "tool_routing_rule",
    target: "type_validation",
    patch: "{}",
    rationale: "Test",
    risk: "low" as const,
    evidenceIds: [],
    status: "proposed" as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const report = await runner.evaluate(proposal);

  assert.strictEqual(report.benchmarkCases, 2);
});

test("drift: promotion gate allows valid proposal", () => {
  const gate = new PromotionGate();
  const proposal = {
    id: "prop-gate-1",
    title: "Test",
    description: "Test",
    kind: "tool_routing_rule",
    target: "test",
    patch: "{}",
    rationale: "Test",
    risk: "low",
    evidenceIds: [],
    status: "proposed",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const report = {
    proposalId: "prop-gate-1",
    benchmarkCases: 10,
    successRateBefore: 0.60,
    successRateAfter: 0.70,
    regressionRate: 0,
    avgCostDelta: 0.05,
    avgLatencyDelta: 0.10,
    safetyViolations: 0,
    decision: "promote" as const,
    createdAt: new Date().toISOString(),
  };

  const decision = gate.decide(proposal, report, false);

  assert.strictEqual(decision.allowed, true);
  assert.strictEqual(decision.stage, "testing");
});

test("drift: promotion gate blocks frozen system", () => {
  const gate = new PromotionGate();
  const proposal = {
    id: "prop-frozen",
    title: "Test",
    description: "Test",
    kind: "tool_routing_rule",
    target: "test",
    patch: "{}",
    rationale: "Test",
    risk: "low",
    evidenceIds: [],
    status: "proposed",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const report = {
    proposalId: "prop-frozen",
    benchmarkCases: 10,
    successRateBefore: 0.60,
    successRateAfter: 0.70,
    regressionRate: 0,
    avgCostDelta: 0.05,
    avgLatencyDelta: 0.10,
    safetyViolations: 0,
    decision: "promote" as const,
    createdAt: new Date().toISOString(),
  };

  const decision = gate.decide(proposal, report, true);

  assert.strictEqual(decision.allowed, false);
  assert.ok(decision.reasons.some(r => r.includes("frozen")));
});

test("drift: promotion gate blocks high-risk proposal", () => {
  const gate = new PromotionGate();
  const proposal = {
    id: "prop-high-risk",
    title: "Test",
    description: "Test",
    kind: "prompt_patch",
    target: "test",
    patch: "{}",
    rationale: "Test",
    risk: "high",
    evidenceIds: [],
    status: "proposed",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const report = {
    proposalId: "prop-high-risk",
    benchmarkCases: 10,
    successRateBefore: 0.60,
    successRateAfter: 0.80,
    regressionRate: 0,
    avgCostDelta: 0,
    avgLatencyDelta: 0,
    safetyViolations: 0,
    decision: "promote" as const,
    createdAt: new Date().toISOString(),
  };

  const decision = gate.decide(proposal, report, false);

  assert.strictEqual(decision.allowed, false);
  assert.ok(decision.reasons.some(r => r.includes("manual") || r.includes("High-risk")));
});

test("drift: promotion gate blocks insufficient success lift", () => {
  const gate = new PromotionGate();
  const proposal = {
    id: "prop-no-lift",
    title: "Test",
    description: "Test",
    kind: "tool_routing_rule",
    target: "test",
    patch: "{}",
    rationale: "Test",
    risk: "low",
    evidenceIds: [],
    status: "proposed",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const report = {
    proposalId: "prop-no-lift",
    benchmarkCases: 10,
    successRateBefore: 0.60,
    successRateAfter: 0.61,
    regressionRate: 0,
    avgCostDelta: 0,
    avgLatencyDelta: 0,
    safetyViolations: 0,
    decision: "promote" as const,
    createdAt: new Date().toISOString(),
  };

  const decision = gate.decide(proposal, report, false);

  assert.strictEqual(decision.allowed, false);
  assert.ok(decision.reasons.some(r => r.includes("success lift")));
});

test("drift: promotion gate advances stages correctly", () => {
  const gate = new PromotionGate();
  const proposal = {
    id: "prop-stages",
    title: "Test",
    description: "Test",
    kind: "tool_routing_rule",
    target: "test",
    patch: "{}",
    rationale: "Test",
    risk: "low",
    evidenceIds: [],
    status: "proposed",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const report = {
    proposalId: "prop-stages",
    benchmarkCases: 10,
    successRateBefore: 0.60,
    successRateAfter: 0.70,
    regressionRate: 0,
    avgCostDelta: 0.05,
    avgLatencyDelta: 0.10,
    safetyViolations: 0,
    decision: "promote" as const,
    createdAt: new Date().toISOString(),
  };

  const decision1 = gate.decide(proposal, report, false, "testing");
  assert.strictEqual(decision1.stage, "canary");

  const decision2 = gate.decide(proposal, report, false, "canary");
  assert.strictEqual(decision2.stage, "active");
});

test("drift: promotion gate requires manual for certain kinds", () => {
  const gate = new PromotionGate();
  const proposal = {
    id: "prop-manual",
    title: "Test",
    description: "Test",
    kind: "threshold_tuning",
    target: "test",
    patch: "{}",
    rationale: "Test",
    risk: "low",
    evidenceIds: [],
    status: "proposed",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  assert.strictEqual(gate.requiresManualGate(proposal), true);
});

test("drift: rollout manager starts rollout", async () => {
  const manager = new SimpleRolloutManager();
  const proposal = {
    id: "prop-rollout",
    title: "Test",
    description: "Test",
    kind: "tool_routing_rule",
    target: "test",
    patch: "{}",
    rationale: "Test",
    risk: "low",
    evidenceIds: [],
    status: "proposed",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const record = await manager.start(proposal, "shadow", 0);

  assert.strictEqual(record.proposalId, "prop-rollout");
  assert.strictEqual(record.stage, "shadow");
  assert.strictEqual(record.status, "running");
});

test("drift: rollout manager completes rollout", async () => {
  const manager = new SimpleRolloutManager();
  const proposal = {
    id: "prop-complete",
    title: "Test",
    description: "Test",
    kind: "tool_routing_rule",
    target: "test",
    patch: "{}",
    rationale: "Test",
    risk: "low",
    evidenceIds: [],
    status: "proposed",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await manager.start(proposal, "stable", 100);

  await manager.complete("prop-complete");
  const record = await manager.getRollout("prop-complete");

  assert.strictEqual(record?.status, "succeeded");
  assert.ok(record?.completedAt != null);
});

test("drift: rollout manager rolls back", async () => {
  const manager = new SimpleRolloutManager();
  const proposal = {
    id: "prop-rb",
    title: "Test",
    description: "Test",
    kind: "tool_routing_rule",
    target: "test",
    patch: "{}",
    rationale: "Test",
    risk: "low",
    evidenceIds: [],
    status: "proposed",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await manager.start(proposal, "canary", 5);

  await manager.rollback("prop-rb", "performance regression");

  const record = await manager.getRollout("prop-rb");
  assert.strictEqual(record?.status, "rolled_back");
  assert.strictEqual(record?.failureReason, "performance regression");
});

test("drift: rollout manager stage percentages", () => {
  const manager = new SimpleRolloutManager();

  assert.strictEqual(manager.getStagePercentage("shadow"), 0);
  assert.strictEqual(manager.getStagePercentage("canary"), 5);
  assert.strictEqual(manager.getStagePercentage("partial"), 25);
  assert.strictEqual(manager.getStagePercentage("stable"), 100);
});

test("drift: rollout manager default stage sequence", () => {
  const manager = new SimpleRolloutManager();
  const sequence = manager.getDefaultStageSequence();

  assert.deepStrictEqual(sequence, ["shadow", "canary", "partial", "stable"]);
});

test("drift: promotion gate config defaults", () => {
  const config = DEFAULT_PROMOTION_GATE_CONFIG;

  assert.strictEqual(config.minSuccessLift, 0.03);
  assert.strictEqual(config.maxRegressionRate, 0.01);
  assert.strictEqual(config.maxCostIncrease, 0.10);
  assert.strictEqual(config.maxLatencyIncrease, 0.15);
  assert.strictEqual(config.maxSafetyViolations, 0);
});
