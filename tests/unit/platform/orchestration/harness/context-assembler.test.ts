import assert from "node:assert/strict";
import test from "node:test";

import { ContextAssembler, type HarnessContextSourceSet } from "../../../../../src/platform/five-plane-orchestration/harness/context-assembler.js";
import { HarnessRuntimeService, type ConstraintPack } from "../../../../../src/platform/five-plane-orchestration/harness/index.js";

function createConstraintPack(): ConstraintPack {
  return {
    policyIds: [],
    approvalMode: "none",
    autonomyMode: "supervised",
    tool_policy: { allowedTools: [] },
    risk_policy: { maxRiskScore: 100, escalationThreshold: 80 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budgetEnvelope: { maxSteps: 10, maxCost: 1000, maxDurationMs: 60000 },
    sandboxRequirement: { sandboxMode: "ephemeral", timeoutMs: 1000 },
    approvalRequirement: {
      requiredForRiskClass: ["critical"],
      approverRoles: ["operator"],
      escalationTimeoutMs: 1000,
    },
  };
}

test("ContextAssembler.assemble creates context ids and keeps source buckets isolated", () => {
  const assembler = new ContextAssembler();
  const sources: HarnessContextSourceSet = {
    conversation: { "conv:messages": ["hello", "world"] },
    task: { "task:id": "task-123" },
    memory: { "mem:lastResult": "success" },
    knowledge: { "know:domain": "testing" },
  };

  const context = assembler.assemble(sources, 4096);

  assert.equal(context.tokenBudget, 4096);
  assert.ok(context.contextId.startsWith("harness_context_"));
  assert.deepEqual(context.conversation["conv:messages"], ["hello", "world"]);
  assert.equal(context.task["task:id"], "task-123");
  assert.equal(context.memory["mem:lastResult"], "success");
  assert.equal(context.knowledge["know:domain"], "testing");
});

test("ContextAssembler.assemble handles empty and partial sources", () => {
  const assembler = new ContextAssembler();

  const emptyContext = assembler.assemble({}, 2048);
  const partialContext = assembler.assemble({ conversation: { "conv:count": 5 } }, 1024);

  assert.deepEqual(emptyContext.conversation, {});
  assert.deepEqual(emptyContext.task, {});
  assert.equal(partialContext.conversation["conv:count"], 5);
});

test("ContextAssembler.snapshot derives metadata from current HarnessRunRuntimeState", () => {
  const assembler = new ContextAssembler();
  const runtime = new HarnessRuntimeService();
  const run = runtime.createRun({
    taskId: "task-context",
    domainId: "domain-context",
    constraintPack: createConstraintPack(),
  });
  const steppedRun = runtime.appendStep(run, {
    role: "planner",
    stage: "plan",
    inputs: {},
    outputs: {},
    iteration: 1,
  });
  const context = assembler.assemble({}, 4096);
  const snapshot = assembler.snapshot(steppedRun, context);

  assert.ok(snapshot.snapshotId.startsWith("ctx_snapshot_"));
  assert.equal(snapshot.runId, steppedRun.runId);
  assert.equal(snapshot.domainId, "domain-context");
  assert.equal(snapshot.iteration, 1);
  assert.equal(snapshot.stepCount, 1);
  assert.equal(snapshot.lastDecisionId, null);
});
