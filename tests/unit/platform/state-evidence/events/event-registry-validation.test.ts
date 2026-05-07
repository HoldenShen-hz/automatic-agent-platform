/**
 * Unit tests for event-registry.ts payload validation
 *
 * Tests validateEventPayload function and Zod schema validation for specific event types.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  getEventSchema,
  validateEventPayload,
  getEventReplayMetadata,
  EVENT_SCHEMA_REGISTRY,
  getPayloadValidatorSource,
} from "../../../../../src/platform/state-evidence/events/event-registry.js";

test("validateEventPayload accepts valid task:status_changed payload", () => {
  const result = validateEventPayload("task:status_changed", {
    fromStatus: "queued",
    toStatus: "in_progress",
    reasonCode: "scheduler.dispatch",
  });

  assert.equal(result.toStatus, "in_progress");
  assert.equal(result.fromStatus, "queued");
});

test("validateEventPayload accepts valid decision:requested payload", () => {
  const result = validateEventPayload("decision:requested", {
    approvalId: "approval-123",
    taskId: "task-456",
    reason: "high_value_task",
    riskLevel: "high",
    options: ["approve", "deny"],
    context: { environment: "production" },
  });

  assert.equal(result.approvalId, "approval-123");
  assert.equal(result.riskLevel, "high");
});

test("validateEventPayload accepts valid skill:execution_started payload", () => {
  const result = validateEventPayload("skill:execution_started", {
    skillId: "skill-coder-v2",
    version: "2.1.0",
    stepCount: 5,
    cacheStatus: "miss",
  });

  assert.equal(result.skillId, "skill-coder-v2");
  assert.equal(result.stepCount, 5);
});

test("validateEventPayload accepts valid dispatch:ticket_created payload", () => {
  const result = validateEventPayload("dispatch:ticket_created", {
    taskId: "task-dispatch-1",
    ticketId: "ticket-1",
    status: "created",
  });

  assert.equal(result.ticketId, "ticket-1");
});

test("validateEventPayload rejects recovery payload without correlation identifiers", () => {
  assert.throws(() => {
    validateEventPayload("recovery:repair_applied", {
      reasonCode: "repair.applied",
    });
  });
});

test("validateEventPayload accepts valid skill:step_failed payload", () => {
  const result = validateEventPayload("skill:step_failed", {
    skillId: "skill-coder-v2",
    stepId: "step-1",
    toolName: "bash",
    attempt: 2,
    maxAttempts: 3,
    errorCode: "bash.timeout",
    retrying: true,
    willRetry: true,
    continued: false,
    continuedAfterFailure: false,
  });

  assert.equal(result.retrying, true);
  assert.equal(result.willRetry, true);
});

test("validateEventPayload accepts valid cost:limit_reached payload", () => {
  const result = validateEventPayload("cost:limit_reached", {
    budgetId: "budget-123",
    currentCostUsd: 1.50,
    limitUsd: 1.00,
    occurredAt: "2026-04-15T10:00:00.000Z",
  });

  assert.equal(result.currentCostUsd, 1.50);
  assert.equal(result.limitUsd, 1.00);
});

test("validateEventPayload rejects invalid payload for task:status_changed", () => {
  // Missing required 'toStatus' field
  assert.throws(() => {
    validateEventPayload("task:status_changed", {
      fromStatus: "queued",
      // toStatus is required
    });
  });
});

test("validateEventPayload rejects invalid riskLevel in decision:requested", () => {
  assert.throws(() => {
    validateEventPayload("decision:requested", {
      approvalId: "approval-123",
      riskLevel: "invalid_risk_level", // Must be low|medium|high|critical
    });
  });
});

test("validateEventPayload accepts platform.harness_run.status_changed payload", () => {
  const result = validateEventPayload("platform.harness_run.status_changed", {
    aggregateType: "harness_run",
    fromStatus: "planning",
    toStatus: "ready",
    reasonCode: "plan_complete",
    emittedBy: "runtime-state-machine",
  });

  assert.equal(result.fromStatus, "planning");
  assert.equal(result.toStatus, "ready");
});

test("validateEventPayload accepts oapeflir.view.run_lifecycle payload", () => {
  const result = validateEventPayload("oapeflir.view.run_lifecycle", {
    stage: "executing",
    runId: "run-abc",
    taskId: "task-xyz",
    occurredAt: "2026-04-20T15:30:00.000Z",
  });

  assert.equal(result.stage, "executing");
  assert.equal(result.runId, "run-abc");
});

test("validateEventPayload accepts oapeflir.phase.transition payload", () => {
  const result = validateEventPayload("oapeflir.phase.transition", {
    runId: "run-transition",
    fromPhase: "observe",
    toPhase: "assess",
    taskId: "task-transition",
    occurredAt: "2026-04-20T15:30:00.000Z",
  });

  assert.equal(result.fromPhase, "observe");
  assert.equal(result.toPhase, "assess");
});

test("validateEventPayload accepts plugin:invocation_started payload", () => {
  const result = validateEventPayload("plugin:invocation_started", {
    pluginId: "plugin.retriever",
    domainId: "coding",
    spiType: "retriever",
    phase: "execute",
    invocationId: "inv-123",
    lifecycleState: "running",
    runtimeIsolation: "sandbox",
    activeInvocationCount: 1,
    queuedInvocationCount: 0,
  });

  assert.equal(result.phase, "execute");
  assert.equal(result.lifecycleState, "running");
});

test("validateEventPayload accepts knowledge:chunk_indexed payload", () => {
  const result = validateEventPayload("knowledge:chunk_indexed", {
    namespace: "docs",
    documentId: "doc-123",
    chunkId: "chunk-456",
    trustLevel: "high",
    keywordCount: 50,
    relationCount: 10,
  });

  assert.equal(result.namespace, "docs");
  assert.equal(result.trustLevel, "high");
});

test("validateEventPayload accepts domain:registered payload", () => {
  const result = validateEventPayload("domain:registered", {
    domainId: "domain-new",
    status: "registered",
    capabilityCount: 3,
    pluginCount: 5,
  });

  assert.equal(result.domainId, "domain-new");
  assert.equal(result.capabilityCount, 3);
});

test("registered tier_1 and tier_2 events do not fall back to generic payload validators", () => {
  for (const [eventType, schema] of Object.entries(EVENT_SCHEMA_REGISTRY)) {
    if (schema.tier === "tier_3") {
      continue;
    }
    assert.notEqual(
      getPayloadValidatorSource(eventType),
      "generic",
      `${eventType} should have a specific or family payload validator`,
    );
  }
});

test("validateEventPayload rejects unknown event types instead of accepting generic payloads", () => {
  assert.throws(() => {
    validateEventPayload("perf:test_event", {
      customField: "value",
      numberField: 42,
    });
  });
});

test("tier_3 events may still use generic object payload validation", () => {
  const result = validateEventPayload("stream:chunk_emitted", {
    chunk: "partial",
  });
  assert.equal(result.chunk, "partial");
});

test("validateEventPayload accepts skill:cache_hit payload", () => {
  const result = validateEventPayload("skill:cache_hit", {
    skillId: "skill-coder-v2",
    cacheKey: "cache-key-abc",
    workingDirectory: "/workspace/project",
    gitHead: "abc123def456",
    sourceHash: "hash789",
    storedAt: "2026-04-19T10:00:00.000Z",
    expiresAt: "2026-04-20T10:00:00.000Z",
  });

  assert.equal(result.storedAt, "2026-04-19T10:00:00.000Z");
  assert.equal(result.expiresAt, "2026-04-20T10:00:00.000Z");
});

test("validateEventPayload accepts subtask:completed payload", () => {
  const result = validateEventPayload("subtask:completed", {
    stepId: "step-1",
    subtaskId: "subtask-abc",
    roleId: "executor",
    status: "completed",
    attempt: 1,
    parentTaskId: "task-parent",
  });

  assert.equal(result.status, "completed");
  assert.equal(result.attempt, 1);
});

test("validateEventPayload rejects subtask:completed without stepId or subtaskId", () => {
  assert.throws(() => {
    validateEventPayload("subtask:completed", {
      // Must have at least one of stepId or subtaskId
      roleId: "executor",
      status: "completed",
    });
  });
});

test("getEventSchema returns correct payloadSchemaRef for skill events", () => {
  const schema = getEventSchema("skill:execution_started");
  assert.equal(schema.payloadSchemaRef, "event://skill/execution_started/v1");
});

test("getEventSchema returns correct payloadSchemaRef for platform events", () => {
  const schema = getEventSchema("platform.harness_run.status_changed");
  assert.equal(schema.payloadSchemaRef, "event://platform/harness_run/status_changed/v1");
});

test("RUNTIME_EVENT_REPLAY_METADATA covers all platform.* events", () => {
  const platformEvents = Object.keys(EVENT_SCHEMA_REGISTRY).filter((type) =>
    type.startsWith("platform.") || type.startsWith("oapeflir.")
  );

  // Each platform event should have replay metadata
  for (const eventType of platformEvents) {
    const metadata = getEventReplayMetadata(eventType);
    assert.ok(metadata, `Event ${eventType} should have replay metadata`);
    assert.ok(metadata.schemaOwner, `Event ${eventType} should have schemaOwner`);
    assert.ok(["platform", "projection"].includes(metadata.sourceOfTruth), `Event ${eventType} should have valid sourceOfTruth`);
  }
});

test("RUNTIME_EVENT_REPLAY_METADATA replayBehavior values are valid", () => {
  const validReplayBehaviors = ["replay_as_fact", "skip_side_effect", "simulate", "forbidden"] as const;

  for (const [eventType, metadata] of Object.entries(getEventReplayMetadata)) {
    assert.ok(
      validReplayBehaviors.includes(metadata.replayBehavior as typeof validReplayBehaviors[number]),
      `Event ${eventType} has invalid replayBehavior: ${metadata.replayBehavior}`
    );
  }
});
