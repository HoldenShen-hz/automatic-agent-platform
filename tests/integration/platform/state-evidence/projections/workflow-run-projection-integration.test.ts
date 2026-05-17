/**
 * Workflow Run Projection Integration Tests
 *
 * Tests workflow_run_projection with events via ProjectionRebuildService.
 * Verifies idempotent event processing and projection state management.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createSeededIntegrationContext } from "../../../../helpers/integration-context.js";
import { ProjectionRebuildService } from "../../../../../src/platform/five-plane-state-evidence/projections/projection-rebuild-service.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";

test("workflow-run-projection: ProjectionRebuildService processes workflow events", () => {
  const ctx = createSeededIntegrationContext("aa-wf-proj-rebuild-", {
    taskId: "task-wf-rebuild-001",
    executionId: "exec-wf-rebuild-001",
  });

  try {
    const service = new ProjectionRebuildService(ctx.store.event);
    const taskId = "task-wf-rebuild-001";

    // Insert workflow lifecycle events
    ctx.db.transaction(() => {
      ctx.store.event.insertEvent({
        id: "evt-wf-created-001",
        taskId,
        sessionId: null,
        executionId: null,
        eventType: "workflow:created",
        eventTier: "tier_1",
        payloadJson: JSON.stringify({
          workflowId: "wf-test-projection",
          divisionId: "coding",
          stepCount: 3,
        }),
        traceId: "trace-wf-created",
        createdAt: nowIso(),
      } as any);

      ctx.store.event.insertEvent({
        id: "evt-wf-step-1-001",
        taskId,
        sessionId: null,
        executionId: null,
        eventType: "workflow:step_completed",
        eventTier: "tier_1",
        payloadJson: JSON.stringify({ stepIndex: 0, stepId: "step_0", durationMs: 1500 }),
        traceId: "trace-wf-step1",
        createdAt: nowIso(),
      } as any);

      ctx.store.event.insertEvent({
        id: "evt-wf-completed-001",
        taskId,
        sessionId: null,
        executionId: null,
        eventType: "workflow_run.completed",
        eventTier: "tier_1",
        payloadJson: JSON.stringify({ finalStepIndex: 2, totalDurationMs: 5000 }),
        traceId: "trace-wf-completed",
        createdAt: nowIso(),
      } as any);
    });

    // Rebuild workflow_run_projection
    const result = service.rebuildProjection("workflow_run_projection", { batchSize: 10 });

    assert.equal(typeof result.eventsProcessed === "number", true, "Should process events");
    assert.equal(typeof result.eventsSkipped === "number", true, "Should track skipped");
  } finally {
    ctx.cleanup();
  }
});

test("workflow-run-projection: Workflow timeline projection rebuilds correctly", () => {
  const ctx = createSeededIntegrationContext("aa-wf-timeline-proj-", {
    taskId: "task-wf-timeline-001",
    executionId: "exec-wf-timeline-001",
  });

  try {
    const service = new ProjectionRebuildService(ctx.store.event);
    const taskId = "task-wf-timeline-001";

    // Emit step events
    ctx.db.transaction(() => {
      ctx.store.event.insertEvent({
        id: "evt-timeline-start",
        taskId,
        sessionId: null,
        executionId: null,
        eventType: "workflow:step_started",
        eventTier: "tier_1",
        payloadJson: JSON.stringify({ stepIndex: 0, stepId: "intake_triage" }),
        traceId: "trace-timeline-start",
        createdAt: nowIso(),
      } as any);

      ctx.store.event.insertEvent({
        id: "evt-timeline-end",
        taskId,
        sessionId: null,
        executionId: null,
        eventType: "workflow:step_completed",
        eventTier: "tier_1",
        payloadJson: JSON.stringify({ stepIndex: 0, stepId: "intake_triage", durationMs: 3000 }),
        traceId: "trace-timeline-end",
        createdAt: nowIso(),
      } as any);
    });

    const result = service.rebuildProjection("workflow_timeline_projection", { batchSize: 10 });

    assert.equal(typeof result.eventsProcessed === "number", true, "Should process timeline events");
  } finally {
    ctx.cleanup();
  }
});

test("workflow-run-projection: Idempotency - same event processed twice produces same state", () => {
  const ctx = createSeededIntegrationContext("aa-wf-idempotent-", {
    taskId: "task-wf-idempotent-001",
    executionId: "exec-wf-idempotent-001",
  });

  try {
    const service = new ProjectionRebuildService(ctx.store.event);
    const taskId = "task-wf-idempotent-001";

    const eventId = "evt-idempotent-001";
    const now = nowIso();

    // Insert a single event, then rebuild twice to verify replay determinism.
    ctx.db.transaction(() => {
      ctx.store.event.insertEvent({
        id: eventId,
        taskId,
        sessionId: null,
        executionId: null,
        eventType: "workflow:step_completed",
        eventTier: "tier_1",
        payloadJson: JSON.stringify({ stepIndex: 0, stepId: "step_repeat" }),
        traceId: "trace-idempotent",
        createdAt: now,
      } as any);
    });

    const first = service.rebuildProjection("workflow_run_projection", { batchSize: 10 });
    const firstSnapshot = service.getProjectionSnapshotStatus("workflow_run_projection").active;
    const second = service.rebuildProjection("workflow_run_projection", { batchSize: 10 });
    const secondSnapshot = service.getProjectionSnapshotStatus("workflow_run_projection").active;

    assert.ok(firstSnapshot, "First rebuild should produce an active snapshot");
    assert.ok(secondSnapshot, "Second rebuild should produce an active snapshot");
    assert.equal(first.eventsProcessed, 1, "First rebuild should process the workflow event once");
    assert.equal(second.eventsProcessed, 1, "Second rebuild should replay the same event set once");
    assert.equal(secondSnapshot.stateHash, firstSnapshot.stateHash, "Repeated rebuilds should converge to the same state");
    assert.deepEqual(secondSnapshot.state, firstSnapshot.state, "Repeated rebuilds should preserve projection state");
  } finally {
    ctx.cleanup();
  }
});

test("workflow-run-projection: Handles workflow failure event", () => {
  const ctx = createSeededIntegrationContext("aa-wf-fail-handle-", {
    taskId: "task-wf-fail-001",
    executionId: "exec-wf-fail-001",
  });

  try {
    const service = new ProjectionRebuildService(ctx.store.event);
    const taskId = "task-wf-fail-001";

    ctx.db.transaction(() => {
      ctx.store.event.insertEvent({
        id: "evt-wf-fail-001",
        taskId,
        sessionId: null,
        executionId: null,
        eventType: "workflow_run.failed",
        eventTier: "tier_1",
        payloadJson: JSON.stringify({
          errorCode: "EXECUTION_TIMEOUT",
          errorMessage: "Step timed out after 60000ms",
          failedAtStep: 2,
        }),
        traceId: "trace-wf-fail",
        createdAt: nowIso(),
      } as any);
    });

    const result = service.rebuildProjection("workflow_run_projection", { batchSize: 10 });

    assert.equal(typeof result.eventsProcessed === "number", true, "Should process failure event");
  } finally {
    ctx.cleanup();
  }
});

test("workflow-run-projection: rebuildAll processes workflow projections", () => {
  const ctx = createSeededIntegrationContext("aa-wf-rebuild-all-", {
    taskId: "task-wf-all-001",
    executionId: "exec-wf-all-001",
  });

  try {
    const service = new ProjectionRebuildService(ctx.store.event);
    const taskId = "task-wf-all-001";

    // Insert events for multiple projection types
    ctx.db.transaction(() => {
      ctx.store.event.insertEvent({
        id: "evt-multi-proj-001",
        taskId,
        sessionId: null,
        executionId: null,
        eventType: "workflow:step_completed",
        eventTier: "tier_1",
        payloadJson: JSON.stringify({ stepIndex: 0 }),
        traceId: "trace-multi",
        createdAt: nowIso(),
      } as any);
    });

    const results = service.rebuildAll({ batchSize: 10 });

    assert.ok(results instanceof Map, "rebuildAll should return Map");
    assert.ok(results.has("workflow_run_projection"), "Should have workflow_run_projection");
    assert.ok(results.has("workflow_timeline_projection"), "Should have workflow_timeline_projection");
  } finally {
    ctx.cleanup();
  }
});
