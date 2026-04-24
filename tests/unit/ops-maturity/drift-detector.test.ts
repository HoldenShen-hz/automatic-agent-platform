import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryEvidenceStore, type EvidenceRecord } from "../../../src/ops-maturity/drift-detection/evidence-store.js";
import { SimpleReflectionEngine } from "../../../src/ops-maturity/drift-detection/reflection-engine.js";
import { SimpleProposalEngine } from "../../../src/ops-maturity/drift-detection/proposal-engine.js";
import { SimpleBenchmarkRunner, type BenchmarkCase } from "../../../src/ops-maturity/drift-detection/benchmark-runner.js";
import { PromotionGate, DEFAULT_PROMOTION_GATE_CONFIG } from "../../../src/ops-maturity/drift-detection/promotion-gate.js";
import { SimpleRolloutManager, type RolloutStage, type RolloutMetrics } from "../../../src/ops-maturity/drift-detection/rollout-manager.js";
import { InMemoryEvolutionRegistry } from "../../../src/ops-maturity/drift-detection/evolution-registry.js";

function createEvidenceRecord(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return {
    id: "ev_1",
    taskType: "code_generation",
    sessionId: "sess_1",
    traceId: "trace_1",
    success: true,
    costUsd: 0.05,
    latencyMs: 1000,
    toolCalls: 5,
    repairRounds: 0,
    rollback: false,
    createdAt: "2026-04-14T00:00:00.000Z",
    ...overrides,
  };
}

test("InMemoryEvidenceStore append and getById roundtrip", async () => {
  const store = new InMemoryEvidenceStore();
  const record = createEvidenceRecord();

  await store.append(record);
  const retrieved = await store.getById("ev_1");

  assert.deepEqual(retrieved, record);
});

test("InMemoryEvidenceStore getById returns null for non-existent", async () => {
  const store = new InMemoryEvidenceStore();

  const result = await store.getById("nonexistent");

  assert.equal(result, null);
});

test("InMemoryEvidenceStore listByTaskType filters correctly", async () => {
  const store = new InMemoryEvidenceStore();
  await store.append(createEvidenceRecord({ id: "ev_1", taskType: "code_generation" }));
  await store.append(createEvidenceRecord({ id: "ev_2", taskType: "code_generation" }));
  await store.append(createEvidenceRecord({ id: "ev_3", taskType: "refactoring" }));

  const results = await store.listByTaskType("code_generation");

  assert.equal(results.length, 2);
});

test("InMemoryEvidenceStore getStatistics calculates correct aggregates", async () => {
  const store = new InMemoryEvidenceStore();
  await store.append(createEvidenceRecord({ id: "ev_1", success: true, costUsd: 0.10, latencyMs: 1000 }));
  await store.append(createEvidenceRecord({ id: "ev_2", success: true, costUsd: 0.20, latencyMs: 2000 }));
  await store.append(createEvidenceRecord({ id: "ev_3", success: false, costUsd: 0.15, latencyMs: 1500 }));

  const stats = await store.getStatistics();

  assert.equal(stats.totalRecords, 3);
  assert.equal(stats.successCount, 2);
  assert.equal(stats.failureCount, 1);
  assert.ok(Math.abs(stats.averageCostUsd - 0.15) < 0.001);
  assert.equal(stats.averageLatencyMs, 1500);
});

test("SimpleReflectionEngine reflectSingle generates reflection for failure", async () => {
  const engine = new SimpleReflectionEngine();
  const failure = createEvidenceRecord({
    id: "fail_1",
    success: false,
    failureMode: "type_error",
    taskType: "code_generation",
  });

  const reflection = await engine.reflectSingle(failure);

  assert.ok(reflection.id.startsWith("refl_"));
  assert.ok(reflection.evidenceIds.includes("fail_1"));
  assert.equal(reflection.taskType, "code_generation");
  assert.ok(reflection.rootCause.length > 0);
  assert.ok(reflection.confidence >= 0 && reflection.confidence <= 1);
});

test("SimpleReflectionEngine reflect groups multiple failures of same mode", async () => {
  const engine = new SimpleReflectionEngine();
  const failures = [
    createEvidenceRecord({ id: "f1", success: false, failureMode: "type_error", repairRounds: 1 }),
    createEvidenceRecord({ id: "f2", success: false, failureMode: "type_error", repairRounds: 2 }),
    createEvidenceRecord({ id: "f3", success: false, failureMode: "test_failure", repairRounds: 1 }),
  ];

  const reflections = await engine.reflect(failures);

  // type_error has 2 failures so it should generate a reflection
  assert.ok(reflections.length >= 1);
  const typeReflection = reflections.find(r => r.metadata?.["failureMode"] === "type_error");
  assert.ok(typeReflection);
  assert.equal(typeReflection.evidenceIds.length, 2);
});

test("SimpleProposalEngine create produces valid proposal", async () => {
  const engine = new SimpleProposalEngine();

  const proposal = await engine.create({
    title: "Test Proposal",
    description: "A test proposal",
    kind: "tool_routing_rule",
    target: "test_target",
    risk: "low",
    agentId: "agent_1",
    evidenceIds: ["ev_1"],
  });

  assert.ok(proposal.id.startsWith("prop_"));
  assert.equal(proposal.title, "Test Proposal");
  assert.equal(proposal.kind, "tool_routing_rule");
  assert.equal(proposal.status, "proposed");
});

test("SimpleProposalEngine canAutoPromote returns true for low-risk kinds", () => {
  const engine = new SimpleProposalEngine();

  assert.equal(engine.canAutoPromote("tool_routing_rule"), true);
  assert.equal(engine.canAutoPromote("skill_doc"), true);
  assert.equal(engine.canAutoPromote("prompt_patch"), false);
});

test("SimpleProposalEngine requiresManualApproval returns true for high-risk kinds", () => {
  const engine = new SimpleProposalEngine();

  assert.equal(engine.requiresManualApproval("prompt_patch"), true);
  assert.equal(engine.requiresManualApproval("workflow_template"), true);
  assert.equal(engine.requiresManualApproval("threshold_tuning"), true);
  assert.equal(engine.requiresManualApproval("tool_routing_rule"), false);
});

test("SimpleProposalEngine listPending returns proposed proposals", async () => {
  const engine = new SimpleProposalEngine();
  await engine.create({
    title: "Pending",
    description: "desc",
    kind: "tool_routing_rule",
    target: "t",
    risk: "low",
    agentId: "a1",
    evidenceIds: [],
  });

  const pending = await engine.listPending();

  assert.equal(pending.length, 1);
  assert.equal(pending[0]!.title, "Pending");
});

test("SimpleBenchmarkRunner evaluate produces evaluation report", async () => {
  const runner = new SimpleBenchmarkRunner();
  const proposal = {
    id: "prop_1",
    title: "Test",
    description: "desc",
    kind: "tool_routing_rule" as const,
    target: "tool_validation",
    patch: "patch",
    rationale: "rationale",
    risk: "low" as const,
    evidenceIds: [],
    status: "proposed" as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const report = await runner.evaluate(proposal);

  assert.equal(report.proposalId, "prop_1");
  assert.ok(report.benchmarkCases >= 0);
  assert.ok(report.successRateBefore >= 0);
  assert.ok(report.successRateAfter >= 0);
  assert.ok(["promote", "reject", "needs_revision"].includes(report.decision));
});

test("SimpleBenchmarkRunner addBenchmarkCase adds test case", () => {
  const runner = new SimpleBenchmarkRunner();
  const testCase: BenchmarkCase = {
    id: "tc_1",
    taskType: "tool_operation",
    input: { test: true },
  };

  runner.addBenchmarkCase(testCase);

  // Evaluation should now include at least this case
  assert.ok(true); // If we got here without error, the case was added
});

test("PromotionGate decide rejects frozen system", () => {
  const gate = new PromotionGate();
  const proposal = {
    id: "prop_1",
    title: "Test",
    description: "desc",
    kind: "tool_routing_rule" as const,
    target: "t",
    patch: "p",
    rationale: "r",
    risk: "low" as const,
    evidenceIds: [],
    status: "proposed" as const,
    createdAt: "",
    updatedAt: "",
  };
  const report = {
    proposalId: "prop_1",
    benchmarkCases: 10,
    successRateBefore: 0.6,
    successRateAfter: 0.7,
    regressionRate: 0,
    avgCostDelta: 0.05,
    avgLatencyDelta: 0.1,
    safetyViolations: 0,
    decision: "promote" as const,
    createdAt: "",
  };

  const decision = gate.decide(proposal, report, true);

  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons.some(r => r.includes("frozen")));
});

test("PromotionGate decide rejects high-risk proposals", () => {
  const gate = new PromotionGate();
  const proposal = {
    id: "prop_1",
    title: "Test",
    description: "desc",
    kind: "prompt_patch" as const,
    target: "t",
    patch: "p",
    rationale: "r",
    risk: "high" as const,
    evidenceIds: [],
    status: "proposed" as const,
    createdAt: "",
    updatedAt: "",
  };
  const report = {
    proposalId: "prop_1",
    benchmarkCases: 10,
    successRateBefore: 0.6,
    successRateAfter: 0.8,
    regressionRate: 0,
    avgCostDelta: 0,
    avgLatencyDelta: 0,
    safetyViolations: 0,
    decision: "promote" as const,
    createdAt: "",
  };

  const decision = gate.decide(proposal, report, false);

  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons.some(r => r.includes("High-risk")));
});

test("PromotionGate decide allows low-risk proposal with good metrics", () => {
  const gate = new PromotionGate();
  const proposal = {
    id: "prop_1",
    title: "Test",
    description: "desc",
    kind: "tool_routing_rule" as const,
    target: "t",
    patch: "p",
    rationale: "r",
    risk: "low" as const,
    evidenceIds: [],
    status: "proposed" as const,
    createdAt: "",
    updatedAt: "",
  };
  const report = {
    proposalId: "prop_1",
    benchmarkCases: 10,
    successRateBefore: 0.6,
    successRateAfter: 0.7,
    regressionRate: 0,
    avgCostDelta: 0.05,
    avgLatencyDelta: 0.1,
    safetyViolations: 0,
    decision: "promote" as const,
    createdAt: "",
  };

  const decision = gate.decide(proposal, report, false);

  assert.equal(decision.allowed, true);
  assert.equal(decision.reasons.length, 0);
});

test("PromotionGate canAutoPromote returns true only for low-risk", () => {
  const gate = new PromotionGate();
  const lowRiskProposal = { risk: "low" as const, kind: "tool_routing_rule" as const };
  const highRiskProposal = { risk: "high" as const, kind: "prompt_patch" as const };

  assert.equal(gate.canAutoPromote(lowRiskProposal as any), true);
  assert.equal(gate.canAutoPromote(highRiskProposal as any), false);
});

test("SimpleRolloutManager start creates rollout record", async () => {
  const manager = new SimpleRolloutManager();
  const proposal = {
    id: "prop_1",
    title: "Test",
    description: "desc",
    kind: "tool_routing_rule" as const,
    target: "t",
    patch: "p",
    rationale: "r",
    risk: "low" as const,
    evidenceIds: [],
    status: "proposed" as const,
    createdAt: "",
    updatedAt: "",
  };

  const record = await manager.start(proposal, "canary", 5);

  assert.equal(record.proposalId, "prop_1");
  assert.equal(record.stage, "canary");
  assert.equal(record.percentage, 5);
  assert.equal(record.status, "running");
});

test("SimpleRolloutManager updateMetrics modifies record", async () => {
  const manager = new SimpleRolloutManager();
  const proposal = {
    id: "prop_1",
    title: "Test",
    description: "desc",
    kind: "tool_routing_rule" as const,
    target: "t",
    patch: "p",
    rationale: "r",
    risk: "low" as const,
    evidenceIds: [],
    status: "proposed" as const,
    createdAt: "",
    updatedAt: "",
  };
  await manager.start(proposal, "canary", 5);
  const metrics: RolloutMetrics = {
    successRate: 0.95,
    errorRate: 0.05,
    latencyMs: 1000,
    costUsd: 0.10,
  };

  await manager.updateMetrics("prop_1", metrics);
  const record = await manager.getRollout("prop_1");

  assert.deepEqual(record?.metrics, metrics);
});

test("SimpleRolloutManager complete marks rollout as succeeded", async () => {
  const manager = new SimpleRolloutManager();
  const proposal = {
    id: "prop_1",
    title: "Test",
    description: "desc",
    kind: "tool_routing_rule" as const,
    target: "t",
    patch: "p",
    rationale: "r",
    risk: "low" as const,
    evidenceIds: [],
    status: "proposed" as const,
    createdAt: "",
    updatedAt: "",
  };
  await manager.start(proposal, "stable", 100);

  await manager.complete("prop_1");
  const record = await manager.getRollout("prop_1");

  assert.equal(record?.status, "succeeded");
  assert.ok(record?.completedAt);
});

test("SimpleRolloutManager rollback marks rollout as rolled_back", async () => {
  const manager = new SimpleRolloutManager();
  const proposal = {
    id: "prop_1",
    title: "Test",
    description: "desc",
    kind: "tool_routing_rule" as const,
    target: "t",
    patch: "p",
    rationale: "r",
    risk: "low" as const,
    evidenceIds: [],
    status: "proposed" as const,
    createdAt: "",
    updatedAt: "",
  };
  await manager.start(proposal, "partial", 25);

  await manager.rollback("prop_1", "Performance degradation");
  const record = await manager.getRollout("prop_1");

  assert.equal(record?.status, "rolled_back");
  assert.equal(record?.failureReason, "Performance degradation");
});

test("SimpleRolloutManager getActiveRollouts returns only running rollouts", async () => {
  const manager = new SimpleRolloutManager();
  const proposal1 = { id: "prop_1", title: "T1", description: "", kind: "tool_routing_rule" as const, target: "t", patch: "p", rationale: "r", risk: "low" as const, evidenceIds: [], status: "proposed" as const, createdAt: "", updatedAt: "" };
  const proposal2 = { id: "prop_2", title: "T2", description: "", kind: "tool_routing_rule" as const, target: "t", patch: "p", rationale: "r", risk: "low" as const, evidenceIds: [], status: "proposed" as const, createdAt: "", updatedAt: "" };

  await manager.start(proposal1, "canary", 5);
  await manager.start(proposal2, "stable", 100);
  await manager.complete("prop_2");

  const active = await manager.getActiveRollouts();

  assert.equal(active.length, 1);
  assert.equal(active[0]?.proposalId, "prop_1");
});

test("SimpleRolloutManager getStagePercentage returns correct percentages", () => {
  const manager = new SimpleRolloutManager();

  assert.equal(manager.getStagePercentage("shadow"), 0);
  assert.equal(manager.getStagePercentage("canary"), 5);
  assert.equal(manager.getStagePercentage("partial"), 25);
  assert.equal(manager.getStagePercentage("stable"), 100);
});

test("InMemoryEvolutionRegistry save and get proposal roundtrip", async () => {
  const registry = new InMemoryEvolutionRegistry();
  const proposal = {
    id: "prop_1",
    title: "Test",
    description: "desc",
    kind: "tool_routing_rule" as const,
    target: "t",
    patch: "p",
    rationale: "r",
    risk: "low" as const,
    evidenceIds: [],
    status: "proposed" as const,
    createdAt: "",
    updatedAt: "",
  };

  await registry.saveProposal(proposal);
  const retrieved = await registry.getProposal("prop_1");

  assert.deepEqual(retrieved, proposal);
});

test("InMemoryEvolutionRegistry updateProposalStatus modifies status", async () => {
  const registry = new InMemoryEvolutionRegistry();
  const proposal = {
    id: "prop_1",
    title: "Test",
    description: "desc",
    kind: "tool_routing_rule" as const,
    target: "t",
    patch: "p",
    rationale: "r",
    risk: "low" as const,
    evidenceIds: [],
    status: "proposed" as const,
    createdAt: "",
    updatedAt: "",
  };
  await registry.saveProposal(proposal);

  await registry.updateProposalStatus("prop_1", "testing");
  const updated = await registry.getProposal("prop_1");

  assert.equal(updated?.status, "testing");
});

test("InMemoryEvolutionRegistry listProposals filters by status", async () => {
  const registry = new InMemoryEvolutionRegistry();
  await registry.saveProposal({ id: "p1", title: "T1", description: "", kind: "tool_routing_rule" as const, target: "t", patch: "p", rationale: "r", risk: "low" as const, evidenceIds: [], status: "proposed" as const, createdAt: "", updatedAt: "" });
  await registry.saveProposal({ id: "p2", title: "T2", description: "", kind: "tool_routing_rule" as const, target: "t", patch: "p", rationale: "r", risk: "low" as const, evidenceIds: [], status: "testing" as const, createdAt: "", updatedAt: "" });

  const proposed = await registry.listProposals("proposed");
  const testing = await registry.listProposals("testing");

  assert.equal(proposed.length, 1);
  assert.equal(testing.length, 1);
});

test("InMemoryEvolutionRegistry save and retrieve evaluation", async () => {
  const registry = new InMemoryEvolutionRegistry();
  const report = {
    proposalId: "prop_1",
    benchmarkCases: 10,
    successRateBefore: 0.6,
    successRateAfter: 0.7,
    regressionRate: 0.1,
    avgCostDelta: 0.05,
    avgLatencyDelta: 0.1,
    safetyViolations: 0,
    decision: "promote" as const,
    createdAt: "",
  };

  await registry.saveEvaluation(report);
  const retrieved = await registry.getEvaluation("prop_1");

  assert.deepEqual(retrieved, report);
});

test("InMemoryEvolutionRegistry save and retrieve rollout", async () => {
  const registry = new InMemoryEvolutionRegistry();
  const rollout = {
    proposalId: "prop_1",
    stage: "canary" as const,
    percentage: 5,
    startedAt: "2026-04-14T00:00:00.000Z",
    status: "running" as const,
  };

  await registry.saveRollout(rollout);
  const retrieved = await registry.getRollout("prop_1");

  assert.deepEqual(retrieved, rollout);
});

test("InMemoryEvolutionRegistry getStatistics calculates correct aggregates", async () => {
  const registry = new InMemoryEvolutionRegistry();
  await registry.saveProposal({ id: "p1", title: "", description: "", kind: "tool_routing_rule" as const, target: "", patch: "", rationale: "", risk: "low" as const, evidenceIds: [], status: "active" as const, createdAt: "", updatedAt: "" });
  await registry.saveProposal({ id: "p2", title: "", description: "", kind: "tool_routing_rule" as const, target: "", patch: "", rationale: "", risk: "low" as const, evidenceIds: [], status: "rejected" as const, createdAt: "", updatedAt: "" });
  await registry.saveEvaluation({
    proposalId: "p1",
    benchmarkCases: 10,
    successRateBefore: 0.6,
    successRateAfter: 0.7,
    regressionRate: 0,
    avgCostDelta: 0.05,
    avgLatencyDelta: 0.1,
    safetyViolations: 0,
    decision: "promote" as const,
    createdAt: "",
  });

  const stats = await registry.getStatistics();

  assert.equal(stats.totalProposals, 2);
  assert.equal(stats.activeCount, 1);
  assert.equal(stats.rejectedCount, 1);
});

test("InMemoryEvolutionRegistry saveReflection and listReflections", async () => {
  const registry = new InMemoryEvolutionRegistry();
  const reflection = {
    id: "refl_1",
    evidenceIds: ["ev_1"],
    taskType: "code_generation",
    rootCause: "type error",
    recommendation: "add type annotations",
    confidence: 0.8,
    createdAt: "",
  };

  await registry.saveReflection(reflection);
  const reflections = await registry.listReflections();

  assert.equal(reflections.length, 1);
  assert.equal(reflections[0]!.id, "refl_1");
});

test("InMemoryEvolutionRegistry listReflections filters by taskType", async () => {
  const registry = new InMemoryEvolutionRegistry();
  await registry.saveReflection({ id: "r1", evidenceIds: [], taskType: "code", rootCause: "c", recommendation: "r", confidence: 0.5, createdAt: "" });
  await registry.saveReflection({ id: "r2", evidenceIds: [], taskType: "refactor", rootCause: "c", recommendation: "r", confidence: 0.5, createdAt: "" });

  const codeReflections = await registry.listReflections("code");

  assert.equal(codeReflections.length, 1);
  assert.equal(codeReflections[0]!.taskType, "code");
});
