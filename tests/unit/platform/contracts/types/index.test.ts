import assert from "node:assert/strict";
import test from "node:test";

// Barrel test for types module
import {
  createControlDirective,
  createExecutionPlan,
  createExecutionReceipt,
  createPlatformPrincipal,
  createRequestEnvelope,
  createStateCommand,
  newId,
  nowIso,
  TASK_STATUSES,
  WORKFLOW_STATUSES,
} from "../../../../../src/platform/contracts/types/index.js";

test("newId generates unique ids with prefix", () => {
  const id = newId("task");
  assert.ok(id.startsWith("task_"));
  assert.ok(id.length > 5);
});

test("newId generates different ids each call", () => {
  const id1 = newId("task");
  const id2 = newId("task");
  assert.notEqual(id1, id2);
});

test("newId works with different prefixes", () => {
  const taskId = newId("task");
  const execId = newId("exec");
  const sessId = newId("sess");
  assert.ok(taskId.startsWith("task_"));
  assert.ok(execId.startsWith("exec_"));
  assert.ok(sessId.startsWith("sess_"));
});

test("nowIso returns valid ISO timestamp", () => {
  const timestamp = nowIso();
  assert.ok(timestamp.includes("T"));
  assert.ok(timestamp.endsWith("Z"));
  // Should be parseable as a Date
  const date = new Date(timestamp);
  assert.ok(!isNaN(date.getTime()));
});

test("nowIso returns current time (within 1 second)", () => {
  const before = Date.now();
  const timestamp = nowIso();
  const after = Date.now();
  const date = new Date(timestamp);
  assert.ok(date.getTime() >= before);
  assert.ok(date.getTime() <= after + 1000);
});

test("TASK_STATUSES contains all expected values", () => {
  const expected = ["queued", "pending", "in_progress", "awaiting_decision", "done", "failed", "cancelled"];
  assert.deepEqual(TASK_STATUSES, expected);
});

test("TASK_STATUSES is readonly", () => {
  assert.ok(Array.isArray(TASK_STATUSES));
  // Verify it has the correct length (7 terminal states)
  assert.equal(TASK_STATUSES.length, 7);
});

test("WORKFLOW_STATUSES contains all expected values", () => {
  const expected = ["running", "paused", "resuming", "completed", "failed", "cancelling", "cancelled"];
  assert.deepEqual(WORKFLOW_STATUSES, expected);
});

test("WORKFLOW_STATUSES is readonly", () => {
  assert.ok(Array.isArray(WORKFLOW_STATUSES));
  assert.equal(WORKFLOW_STATUSES.length, 7);
});

test("platform contract builders produce doc-aligned contracts", () => {
  const principal = createPlatformPrincipal({
    actorId: "user_1",
    tenantId: "tenant_1",
    roles: ["operator"],
    authMethod: "jwt",
  });
  const envelope = createRequestEnvelope({
    principal,
    payload: { title: "Deploy release" },
    metadata: { source: "api", confirmationRequired: true },
    traceId: "trace_1",
  });
  const directive = createControlDirective({
    type: "pause",
    issuedBy: principal,
    reason: "manual hold",
    targetScope: { workflowId: "workflow_1" },
  });
  const plan = createExecutionPlan({
    traceId: "trace_1",
    principal,
    workflowRunId: "workflow_1",
    steps: [
      {
        stepId: "step_1",
        action: "inspect",
        inputs: {},
        dependencies: [],
        status: "pending",
        timeout: 1000,
        retryPolicy: { maxRetries: 1, backoffMs: 100 },
      },
    ],
    budget: { maxSteps: 1, maxDurationMs: 1000, maxCost: 1 },
  });
  const receipt = createExecutionReceipt({
    planId: plan.planId,
    stepId: "step_1",
    status: "succeeded",
    durationMs: 400,
  });
  const stateCommand = createStateCommand({
    traceId: "trace_1",
    principal,
    type: "append_event",
    aggregateId: "task_1",
    expectedVersion: 3,
    fencingToken: "fence_1",
    payload: { eventType: "task.updated" },
  });

  assert.equal(envelope.traceId, "trace_1");
  assert.equal(envelope.metadata.confirmationRequired, "true");
  assert.equal(directive.type, "pause");
  assert.equal(plan.steps.length, 1);
  assert.equal(receipt.status, "succeeded");
  assert.equal(stateCommand.expectedVersion, 3);
});
