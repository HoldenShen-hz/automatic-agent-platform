import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryEvolutionRegistry } from "../../../../src/ops-maturity/drift-detection/evolution-registry.js";
import type { ImprovementProposal, ProposalStatus } from "../../../../src/ops-maturity/drift-detection/proposal-engine.js";
import type { EvaluationReport } from "../../../../src/ops-maturity/drift-detection/benchmark-runner.js";
import type { RolloutRecord } from "../../../../src/ops-maturity/drift-detection/rollout-manager.js";
import type { ReflectionRecord } from "../../../../src/ops-maturity/drift-detection/reflection-engine.js";

function createTestProposal(overrides: Partial<ImprovementProposal> = {}): ImprovementProposal {
  return {
    id: "prop_1",
    title: "Test Proposal",
    description: "A test proposal",
    kind: "prompt_patch",
    target: "test_target",
    patch: "{}",
    rationale: "Testing",
    risk: "low",
    evidenceIds: ["ev_1"],
    status: "proposed",
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
    ...overrides,
  };
}

function createTestEvaluation(proposalId: string, overrides: Partial<EvaluationReport> = {}): EvaluationReport {
  return {
    proposalId,
    benchmarkCases: 10,
    successRateBefore: 0.6,
    successRateAfter: 0.7,
    regressionRate: 0,
    avgCostDelta: -0.05,
    avgLatencyDelta: -0.1,
    safetyViolations: 0,
    decision: "promote",
    createdAt: "2026-04-14T00:00:00.000Z",
    ...overrides,
  };
}

function createTestRollout(proposalId: string, overrides: Partial<RolloutRecord> = {}): RolloutRecord {
  return {
    proposalId,
    stage: "canary",
    percentage: 10,
    startedAt: "2026-04-14T00:00:00.000Z",
    status: "running",
    ...overrides,
  };
}

function createTestReflection(overrides: Partial<ReflectionRecord> = {}): ReflectionRecord {
  return {
    id: "ref_1",
    evidenceIds: ["ev_1"],
    taskType: "test_task",
    rootCause: "root cause",
    recommendation: "recommendation",
    confidence: 0.8,
    createdAt: "2026-04-14T00:00:00.000Z",
    ...overrides,
  };
}

test("InMemoryEvolutionRegistry saves and retrieves proposal", async () => {
  const registry = new InMemoryEvolutionRegistry();
  const proposal = createTestProposal();

  await registry.saveProposal(proposal);
  const retrieved = await registry.getProposal("prop_1");

  assert.deepEqual(retrieved, proposal);
});

test("InMemoryEvolutionRegistry returns null for non-existent proposal", async () => {
  const registry = new InMemoryEvolutionRegistry();
  const retrieved = await registry.getProposal("non_existent");

  assert.equal(retrieved, null);
});

test("InMemoryEvolutionRegistry lists all proposals", async () => {
  const registry = new InMemoryEvolutionRegistry();
  await registry.saveProposal(createTestProposal({ id: "prop_1" }));
  await registry.saveProposal(createTestProposal({ id: "prop_2" }));

  const proposals = await registry.listProposals();

  assert.equal(proposals.length, 2);
});

test("InMemoryEvolutionRegistry filters proposals by status", async () => {
  const registry = new InMemoryEvolutionRegistry();
  await registry.saveProposal(createTestProposal({ id: "prop_1", status: "proposed" }));
  await registry.saveProposal(createTestProposal({ id: "prop_2", status: "testing" }));
  await registry.saveProposal(createTestProposal({ id: "prop_3", status: "proposed" }));

  const proposals = await registry.listProposals("proposed");

  assert.equal(proposals.length, 2);
  assert.ok(proposals.every(p => p.status === "proposed"));
});

test("InMemoryEvolutionRegistry updates proposal status", async () => {
  const registry = new InMemoryEvolutionRegistry();
  await registry.saveProposal(createTestProposal({ id: "prop_1" }));

  await registry.updateProposalStatus("prop_1", "testing");

  const proposal = await registry.getProposal("prop_1");
  assert.equal(proposal?.status, "testing");
});

test("InMemoryEvolutionRegistry saves and retrieves evaluation", async () => {
  const registry = new InMemoryEvolutionRegistry();
  const evaluation = createTestEvaluation("prop_1");

  await registry.saveEvaluation(evaluation);
  const retrieved = await registry.getEvaluation("prop_1");

  assert.deepEqual(retrieved, evaluation);
});

test("InMemoryEvolutionRegistry returns null for non-existent evaluation", async () => {
  const registry = new InMemoryEvolutionRegistry();
  const retrieved = await registry.getEvaluation("non_existent");

  assert.equal(retrieved, null);
});

test("InMemoryEvolutionRegistry lists all evaluations", async () => {
  const registry = new InMemoryEvolutionRegistry();
  await registry.saveEvaluation(createTestEvaluation("prop_1"));
  await registry.saveEvaluation(createTestEvaluation("prop_2"));

  const evaluations = await registry.listEvaluations();

  assert.equal(evaluations.length, 2);
});

test("InMemoryEvolutionRegistry saves and retrieves rollout", async () => {
  const registry = new InMemoryEvolutionRegistry();
  const rollout = createTestRollout("prop_1");

  await registry.saveRollout(rollout);
  const retrieved = await registry.getRollout("prop_1");

  assert.deepEqual(retrieved, rollout);
});

test("InMemoryEvolutionRegistry returns null for non-existent rollout", async () => {
  const registry = new InMemoryEvolutionRegistry();
  const retrieved = await registry.getRollout("non_existent");

  assert.equal(retrieved, null);
});

test("InMemoryEvolutionRegistry lists active rollouts only", async () => {
  const registry = new InMemoryEvolutionRegistry();
  await registry.saveRollout(createTestRollout("prop_1", { status: "running" }));
  await registry.saveRollout(createTestRollout("prop_2", { status: "succeeded" }));
  await registry.saveRollout(createTestRollout("prop_3", { status: "running" }));

  const activeRollouts = await registry.listActiveRollouts();

  assert.equal(activeRollouts.length, 2);
  assert.ok(activeRollouts.every(r => r.status === "running"));
});

test("InMemoryEvolutionRegistry saves and lists reflections", async () => {
  const registry = new InMemoryEvolutionRegistry();
  const reflection1 = createTestReflection({ id: "ref_1", taskType: "test_task" });
  const reflection2 = createTestReflection({ id: "ref_2", taskType: "other_task" });

  await registry.saveReflection(reflection1);
  await registry.saveReflection(reflection2);

  const reflections = await registry.listReflections();

  assert.equal(reflections.length, 2);
});

test("InMemoryEvolutionRegistry filters reflections by taskType", async () => {
  const registry = new InMemoryEvolutionRegistry();
  await registry.saveReflection(createTestReflection({ id: "ref_1", taskType: "test_task" }));
  await registry.saveReflection(createTestReflection({ id: "ref_2", taskType: "other_task" }));
  await registry.saveReflection(createTestReflection({ id: "ref_3", taskType: "test_task" }));

  const reflections = await registry.listReflections("test_task");

  assert.equal(reflections.length, 2);
  assert.ok(reflections.every(r => r.taskType === "test_task"));
});

test("InMemoryEvolutionRegistry computes statistics correctly", async () => {
  const registry = new InMemoryEvolutionRegistry();

  // Add proposals with various statuses
  await registry.saveProposal(createTestProposal({ id: "prop_1", status: "proposed" }));
  await registry.saveProposal(createTestProposal({ id: "prop_2", status: "testing" }));
  await registry.saveProposal(createTestProposal({ id: "prop_3", status: "canary" }));
  await registry.saveProposal(createTestProposal({ id: "prop_4", status: "rejected" }));
  await registry.saveProposal(createTestProposal({ id: "prop_5", status: "rolled_back" }));

  // Add evaluation with success lift
  await registry.saveEvaluation(createTestEvaluation("prop_1", {
    successRateBefore: 0.6,
    successRateAfter: 0.7,
  }));

  const stats = await registry.getStatistics();

  assert.equal(stats.totalProposals, 5);
  assert.equal(stats.activeCount, 1); // canary only (staging + canary define active, testing != staging)
  assert.equal(stats.rejectedCount, 0); // deprecated + archived only (rejected and rolled_back are different statuses)
  assert.equal(stats.byStatus["proposed"], 1);
  assert.equal(stats.byStatus["testing"], 1);
  assert.equal(stats.byStatus["canary"], 1);
  assert.equal(stats.byStatus["rejected"], 1);
  assert.equal(stats.byStatus["rolled_back"], 1);
  // averageSuccessLift = (0.7 - 0.6) = 0.1 (with floating point tolerance)
  assert.ok(Math.abs(stats.averageSuccessLift - 0.1) < 0.0001);
});

test("InMemoryEvolutionRegistry returns zero averageSuccessLift when no evaluations", async () => {
  const registry = new InMemoryEvolutionRegistry();
  await registry.saveProposal(createTestProposal());

  const stats = await registry.getStatistics();

  assert.equal(stats.averageSuccessLift, 0);
});

test("InMemoryEvolutionRegistry handles empty registry", async () => {
  const registry = new InMemoryEvolutionRegistry();

  const proposals = await registry.listProposals();
  const evaluations = await registry.listEvaluations();
  const rollouts = await registry.listActiveRollouts();
  const reflections = await registry.listReflections();
  const stats = await registry.getStatistics();

  assert.equal(proposals.length, 0);
  assert.equal(evaluations.length, 0);
  assert.equal(rollouts.length, 0);
  assert.equal(reflections.length, 0);
  assert.equal(stats.totalProposals, 0);
});

test("InMemoryEvolutionRegistry updateProposalStatus handles non-existent proposal", async () => {
  const registry = new InMemoryEvolutionRegistry();

  // Should not throw
  await registry.updateProposalStatus("non_existent", "testing");

  const proposals = await registry.listProposals();
  assert.equal(proposals.length, 0);
});
