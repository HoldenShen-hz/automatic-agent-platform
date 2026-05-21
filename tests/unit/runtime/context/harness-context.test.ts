import test from "node:test";
import assert from "node:assert/strict";
import { ContextAssembler, type HarnessContextSourceSet, type HarnessContext } from "../../../../src/platform/five-plane-orchestration/harness/context/index.js";
import { newId, nowIso } from "../../../../src/platform/contracts/types/ids.js";

/**
 * Tests for src/platform/five-plane-orchestration/harness/context/index.ts
 * Re-exports from context-assembler.js
 */

test("ContextAssembler can be instantiated", () => {
  const assembler = new ContextAssembler();
  assert.ok(assembler != null, "assembler should be created");
  assert.strictEqual(typeof assembler.assemble, "function", "assemble method should exist");
  assert.strictEqual(typeof assembler.snapshot, "function", "snapshot method should exist");
});

test("ContextAssembler.assemble creates context with empty sources", () => {
  const assembler = new ContextAssembler();
  const sources: HarnessContextSourceSet = {};

  const context = assembler.assemble(sources, 4096);

  assert.ok(context.contextId.startsWith("harness_context_"));
  assert.strictEqual(context.tokenBudget, 4096);
  assert.deepEqual(context.conversation, {});
  assert.deepEqual(context.task, {});
  assert.deepEqual(context.memory, {});
  assert.deepEqual(context.knowledge, {});
});

test("ContextAssembler.assemble creates context with populated sources", () => {
  const assembler = new ContextAssembler();
  const sources: HarnessContextSourceSet = {
    conversation: { "conv:message_1": "hello" },
    task: { "task:description": "test task" },
    memory: { "mem:history": "last run" },
    knowledge: { "know:domain": "testing" },
  };

  const context = assembler.assemble(sources, 4096);

  assert.ok(context.contextId.startsWith("harness_context_"));
  assert.ok(context.assembledAt.length > 0);
  assert.strictEqual(typeof context.metadata, "object");
});

test("ContextAssembler.assemble handles different token budgets", () => {
  const assembler = new ContextAssembler();
  const sources: HarnessContextSourceSet = { task: { "task:test": "value" } };

  const context1 = assembler.assemble(sources, 1024);
  const context2 = assembler.assemble(sources, 2048);
  const context3 = assembler.assemble(sources, 8192);

  assert.strictEqual(context1.tokenBudget, 1024);
  assert.strictEqual(context2.tokenBudget, 2048);
  assert.strictEqual(context3.tokenBudget, 8192);
});

test("ContextAssembler.assemble generates unique contextIds", () => {
  const assembler = new ContextAssembler();
  const sources: HarnessContextSourceSet = { task: { "task:test": "value" } };

  const context1 = assembler.assemble(sources, 1000);
  const context2 = assembler.assemble(sources, 1000);
  const context3 = assembler.assemble(sources, 1000);

  assert.notStrictEqual(context1.contextId, context2.contextId);
  assert.notStrictEqual(context2.contextId, context3.contextId);
  assert.notStrictEqual(context1.contextId, context3.contextId);
});

test("ContextAssembler.assemble creates metadata with scores", () => {
  const assembler = new ContextAssembler();
  const sources: HarnessContextSourceSet = {
    task: { "task:test": "value", "task:foo": "bar" },
  };

  const context = assembler.assemble(sources, 4096);

  assert.ok(context.metadata != null);
  assert.ok(context.metadata!.relevanceScores != null);
  assert.ok(context.metadata!.freshnessScores != null);
  assert.ok(context.metadata!.trustLevels != null);
  assert.ok(typeof context.metadata!.trimmedTokens === "number");
});

test("ContextAssembler.snapshot creates snapshot from run state", () => {
  const assembler = new ContextAssembler();
  const sources: HarnessContextSourceSet = {};

  // Minimal run object for snapshot testing
  const run = {
    runId: "run_test_snapshot",
    harnessRunId: "harness_run_test",
    taskId: "task_test_snapshot",
    domainId: "domain_test",
    tenantId: "tenant_test",
    constraintPackRef: "ref_test",
    versionLockId: "lock_test",
    planGraphBundle: { planGraphBundleId: "bundle_test", planId: "plan_test", summary: "test", checkpoints: [], policyIds: [] },
    budgetLedgerId: "budget_test",
    currentSeq: 1,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    status: "running" as const,
    maxIterations: 10,
    currentIteration: 5,
    steps: [],
    nodeRunIds: [],
    contextSnapshots: [],
    sleepLease: null,
    recoveryCheckpoint: null,
    feedbackEnvelope: null,
    toolbelt: null,
    guardrailAssessment: null,
    hitlRequest: null,
    timeline: [],
    decision: null,
  } as any;

  const context = assembler.assemble(sources, 4096);
  const snapshot = assembler.snapshot(run, context);

  assert.ok(snapshot.snapshotId.startsWith("ctx_snapshot_"));
  assert.strictEqual(snapshot.runId, "run_test_snapshot");
  assert.strictEqual(snapshot.domainId, "domain_test");
  assert.strictEqual(snapshot.iteration, 5);
  assert.strictEqual(snapshot.capturedAt, context.assembledAt);
});

test("ContextAssembler.snapshot captures decision ID when available", () => {
  const assembler = new ContextAssembler();
  const sources: HarnessContextSourceSet = {};

  const run = {
    runId: "run_with_decision",
    harnessRunId: "harness_run_decision",
    taskId: "task_decision",
    domainId: "domain_decision",
    tenantId: "tenant_decision",
    constraintPackRef: "ref_decision",
    versionLockId: "lock_decision",
    planGraphBundle: { planGraphBundleId: "bundle_decision", planId: "plan_decision", summary: "decision test", checkpoints: [], policyIds: [] },
    budgetLedgerId: "budget_decision",
    currentSeq: 1,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    status: "running" as const,
    maxIterations: 10,
    currentIteration: 3,
    steps: [],
    nodeRunIds: [],
    contextSnapshots: [],
    sleepLease: null,
    recoveryCheckpoint: null,
    feedbackEnvelope: null,
    toolbelt: null,
    guardrailAssessment: null,
    hitlRequest: null,
    timeline: [],
    decision: {
      decisionId: "decision_abc",
      action: "accept" as const,
      reasonCodes: [],
      confidence: 0.95,
      createdAt: nowIso(),
    },
  } as any;

  const context = assembler.assemble(sources, 4096);
  const snapshot = assembler.snapshot(run, context);

  assert.strictEqual(snapshot.lastDecisionId, "decision_abc");
});

test("ContextAssembler.snapshot handles null decision", () => {
  const assembler = new ContextAssembler();
  const sources: HarnessContextSourceSet = {};

  const run = {
    runId: "run_no_decision",
    harnessRunId: "harness_run_no_decision",
    taskId: "task_no_decision",
    domainId: "domain_no_decision",
    tenantId: "tenant_no_decision",
    constraintPackRef: "ref_no_decision",
    versionLockId: "lock_no_decision",
    planGraphBundle: { planGraphBundleId: "bundle_no_decision", planId: "plan_no_decision", summary: "no decision", checkpoints: [], policyIds: [] },
    budgetLedgerId: "budget_no_decision",
    currentSeq: 1,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    status: "running" as const,
    maxIterations: 10,
    currentIteration: 1,
    steps: [],
    nodeRunIds: [],
    contextSnapshots: [],
    sleepLease: null,
    recoveryCheckpoint: null,
    feedbackEnvelope: null,
    toolbelt: null,
    guardrailAssessment: null,
    hitlRequest: null,
    timeline: [],
    decision: null,
  } as any;

  const context = assembler.assemble(sources, 4096);
  const snapshot = assembler.snapshot(run, context);

  assert.strictEqual(snapshot.lastDecisionId, null);
});

test("ContextAssembler.assemble preserves readonly properties in context", () => {
  const assembler = new ContextAssembler();
  const sources: HarnessContextSourceSet = { task: { "task:test": "some value" } };

  const context = assembler.assemble(sources, 4096);

  // Verify contextId and assembledAt are set
  assert.ok(context.contextId.length > 0);
  assert.ok(context.assembledAt.length > 0);

  // Verify tokenBudget is the requested amount
  assert.strictEqual(context.tokenBudget, 4096);
});