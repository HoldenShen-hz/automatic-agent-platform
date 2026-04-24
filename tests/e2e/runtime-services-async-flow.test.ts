import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionDispatchServiceAsync } from "../../src/scale-ecosystem/runtime-services/execution-dispatch-service-async.js";
import { HumanTakeoverServiceAsync } from "../../src/scale-ecosystem/runtime-services/human-takeover-service-async.js";
import { DurableEventBusAsync } from "../../src/scale-ecosystem/runtime-services/durable-event-bus-async.js";
import { WorkerRegistryService } from "../../src/platform/execution/worker-pool/worker-registry-service.js";
import { createE2EHarness, createSeededE2EHarness } from "../helpers/e2e-harness.js";
import { seedTaskAndExecution } from "../helpers/seed.js";

test("E2E: runtime-services async dispatch creates and claims a ticket with the eligible worker", async () => {
  const harness = createE2EHarness("aa-e2e-runtime-dispatch-");

  try {
    seedTaskAndExecution(harness.db, harness.store, {
      taskId: "task-runtime-dispatch",
      executionId: "exec-runtime-dispatch",
      traceId: "trace-runtime-dispatch",
    });
    harness.db.connection.prepare("UPDATE executions SET status = ? WHERE id = ?").run("created", "exec-runtime-dispatch");

    const workers = new WorkerRegistryService(harness.store);
    workers.recordHeartbeat({
      workerId: "worker-runtime-capable",
      status: "idle",
      capabilities: ["bash", "edit"],
      runningExecutionIds: [],
      maxConcurrency: 2,
      queueAffinity: "default",
      occurredAt: "2026-04-24T12:00:00.000Z",
    });
    workers.recordHeartbeat({
      workerId: "worker-runtime-basic",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 2,
      queueAffinity: "default",
      occurredAt: "2026-04-24T12:00:00.000Z",
    });

    const dispatch = new ExecutionDispatchServiceAsync(harness.db, harness.store);
    const created = await dispatch.createTicket({
      executionId: "exec-runtime-dispatch",
      queueName: "default",
      requiredCapabilities: ["bash", "edit"],
      occurredAt: "2026-04-24T12:00:05.000Z",
    });
    const decision = await dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-24T12:00:06.000Z",
    });

    const ticket = created.outcome === "created" ? harness.store.listExecutionTicketsByExecution("exec-runtime-dispatch")[0] : null;
    const lease = decision.leaseId ? harness.store.getExecutionLease(decision.leaseId) : null;
    const eventTypes = harness.store.listEventsForTask("task-runtime-dispatch").map((event) => event.eventType);

    assert.equal(created.outcome, "created");
    assert.equal(decision.outcome, "dispatched");
    assert.equal(decision.worker?.workerId, "worker-runtime-capable");
    assert.equal(ticket?.assignedWorkerId, "worker-runtime-capable");
    assert.equal(ticket?.status, "claimed");
    assert.equal(lease?.workerId, "worker-runtime-capable");
    assert.ok(eventTypes.includes("dispatch:ticket_created"));
    assert.ok(eventTypes.includes("dispatch:ticket_claimed"));
    assert.equal(decision.trace?.selectedWorkerId, "worker-runtime-capable");
  } finally {
    harness.cleanup();
  }
});

test("E2E: runtime-services async human takeover modifies input and completes the task", async () => {
  const harness = createSeededE2EHarness("aa-e2e-runtime-takeover-", {
    taskId: "task-runtime-takeover",
    executionId: "exec-runtime-takeover",
  });

  try {
    const takeover = new HumanTakeoverServiceAsync(harness.db, harness.store);
    const asyncEvents: string[] = [];
    takeover.on("session_opened", (event) => asyncEvents.push(`opened:${event.taskId}`));
    takeover.on("session_closed", (event) => asyncEvents.push(`closed:${event.taskId}`));

    const opened = await takeover.openSession({
      taskId: "task-runtime-takeover",
      operatorId: "operator-runtime",
      reasonCode: "runtime_async_takeover",
    });
    await takeover.modifyInput({
      takeoverSessionId: opened.takeoverSessionId,
      inputJson: JSON.stringify({ request: "patched by operator", severity: "high" }),
      reasonCode: "operator_adjust_input",
    });
    await takeover.completeTask({
      takeoverSessionId: opened.takeoverSessionId,
      terminalStatus: "done",
      reasonCode: "operator_completed_task",
      outputJson: JSON.stringify({ outcome: "manual_recovery_complete" }),
    });

    const task = harness.store.getTask("task-runtime-takeover");
    const execution = harness.store.getExecution("exec-runtime-takeover");
    const session = harness.store.getTakeoverSession(opened.takeoverSessionId);
    const eventTypes = harness.store.listEventsForTask("task-runtime-takeover").map((event) => event.eventType);

    assert.equal(task?.status, "done");
    assert.equal(task?.inputJson, JSON.stringify({ request: "patched by operator", severity: "high" }));
    assert.equal(task?.outputJson, JSON.stringify({ outcome: "manual_recovery_complete" }));
    assert.equal(execution?.status, "succeeded");
    assert.equal(session?.status, "closed");
    assert.deepEqual(asyncEvents, ["opened:task-runtime-takeover", "closed:task-runtime-takeover"]);
    assert.ok(eventTypes.includes("takeover:session_opened"));
    assert.ok(eventTypes.includes("takeover:action_applied"));
  } finally {
    harness.cleanup();
  }
});

test("E2E: runtime-services durable event bus publishes, delivers, and drains pending acks", async () => {
  const harness = createSeededE2EHarness("aa-e2e-runtime-bus-", {
    taskId: "task-runtime-bus",
    executionId: "exec-runtime-bus",
  });

  try {
    const bus = new DurableEventBusAsync(harness.db, harness.store);
    const deliveredEventTypes: string[] = [];

    bus.subscribe("runtime_inspector", async (event) => {
      deliveredEventTypes.push(event.eventType);
    });

    const record = await bus.publish({
      eventType: "dispatch:ticket_created",
      taskId: "task-runtime-bus",
      executionId: "exec-runtime-bus",
      traceId: "trace-runtime-bus",
      payload: {
        ticketId: "ticket-runtime-bus-1",
        queueName: "default",
        dispatchTarget: "any",
        requiredIsolationLevel: "standard",
        requiredRepoVersion: null,
        attempt: 1,
        priority: "normal",
        requiredCapabilities: [],
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal(bus.getPendingCount("runtime_inspector"), 0);
    const deliveredCount = await bus.deliverPending("runtime_inspector");

    assert.equal(deliveredCount, 0);
    assert.deepEqual(deliveredEventTypes, ["dispatch:ticket_created"]);
    assert.equal(bus.getPendingCount("runtime_inspector"), 0);
    assert.equal(harness.store.countPendingTier1Acks(), 0);
    assert.equal(record.eventType, "dispatch:ticket_created");
    assert.equal(bus.getMetrics().totalPublishedEvents, 1);

    bus.dispose();
  } finally {
    harness.cleanup();
  }
});
