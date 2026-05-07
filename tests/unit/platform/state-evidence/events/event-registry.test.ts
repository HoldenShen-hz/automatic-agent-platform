import assert from "node:assert/strict";
import test from "node:test";

import {
  EVENT_SCHEMA_REGISTRY,
  hasEventSchema,
  getRegisteredConsumers,
  getEventSchema,
  getEventReplayMetadata,
  validateEventPayload,
  type EventSchemaDefinition,
  type KnownEventType,
} from "../../../../../src/platform/state-evidence/events/event-registry.js";

test("EVENT_SCHEMA_REGISTRY contains known event types", () => {
  assert.ok(EVENT_SCHEMA_REGISTRY["task:status_changed"]);
  assert.ok(EVENT_SCHEMA_REGISTRY["workflow:step_completed"]);
  assert.ok(EVENT_SCHEMA_REGISTRY["decision:requested"]);
  assert.ok(EVENT_SCHEMA_REGISTRY["stream:chunk_emitted"]);
  assert.ok(EVENT_SCHEMA_REGISTRY["domain:registered"]);
  assert.ok(EVENT_SCHEMA_REGISTRY["plugin:error_isolated"]);
  assert.ok(EVENT_SCHEMA_REGISTRY["plugin:invocation_started"]);
  assert.ok(EVENT_SCHEMA_REGISTRY["plugin:invocation_completed"]);
  assert.ok(EVENT_SCHEMA_REGISTRY["knowledge:chunk_indexed"]);
  assert.ok(EVENT_SCHEMA_REGISTRY["platform.request_envelope.admitted"]);
  assert.ok(EVENT_SCHEMA_REGISTRY["platform.harness_run.status_changed"]);
  assert.ok(EVENT_SCHEMA_REGISTRY["platform.node_run.status_changed"]);
  assert.ok(EVENT_SCHEMA_REGISTRY["platform.side_effect.status_changed"]);
  assert.ok(EVENT_SCHEMA_REGISTRY["platform.graph_scheduler.decision_recorded"]);
  assert.ok(EVENT_SCHEMA_REGISTRY["oapeflir.view.run_lifecycle"]);
  assert.equal(hasEventSchema("platform.budget_ledger.status_changed"), true);
  assert.equal(hasEventSchema("platform.budget_reservation.status_changed"), true);
});

test("hasEventSchema returns true for known event types", () => {
  assert.equal(hasEventSchema("task:status_changed"), true);
  assert.equal(hasEventSchema("workflow:step_completed"), true);
  assert.equal(hasEventSchema("decision:requested"), true);
});

test("hasEventSchema returns false for unknown event types", () => {
  assert.equal(hasEventSchema("unknown:event"), false);
  assert.equal(hasEventSchema(""), false);
  assert.equal(hasEventSchema("task:not_registered"), false);
});

test("getRegisteredConsumers returns consumers for known event", () => {
  const consumers = getRegisteredConsumers("task:status_changed");
  assert.ok(Array.isArray(consumers));
  assert.ok(consumers.length > 0);
});

test("domain and plugin lifecycle events declare feedback projection consumers", () => {
  assert.ok(getRegisteredConsumers("domain:registered").includes("feedback_projection"));
  assert.ok(getRegisteredConsumers("plugin:error_isolated").includes("feedback_projection"));
  assert.ok(getRegisteredConsumers("knowledge:chunk_indexed").includes("feedback_projection"));
});

test("getRegisteredConsumers returns empty array for unknown event", () => {
  const consumers = getRegisteredConsumers("unknown:event");
  assert.deepEqual(consumers, []);
});

test("getEventSchema returns schema for known event", () => {
  const schema = getEventSchema("task:status_changed");
  assert.equal(schema.type, "task:status_changed");
  assert.ok(schema.tier);
  assert.ok(schema.producer);
  assert.ok(Array.isArray(schema.consumers));
});

test("runtime platform events expose replay metadata and first-class registry schema", () => {
  assert.equal(hasEventSchema("platform.harness_run.status_changed"), true);

  const schema = getEventSchema("platform.harness_run.status_changed");
  const metadata = getEventReplayMetadata("platform.harness_run.status_changed");

  assert.equal(Object.hasOwn(EVENT_SCHEMA_REGISTRY, "platform.harness_run.status_changed"), true);
  assert.equal(schema.producer, "runtime-state-machine");
  assert.equal(metadata.sourceOfTruth, "platform");
  assert.equal(metadata.replayBehavior, "replay_as_fact");
  assert.equal(metadata.consumerContractTests.includes("runtime-state-machine.test.ts"), true);
});

test("getEventSchema throws ValidationError for unknown event", () => {
  assert.throws(
    () => getEventSchema("unknown:event"),
    (error: any) => {
      return error.code === "event.schema_missing" && error.message.includes("unknown:event");
    }
  );
});

test("KnownEventType includes tier_1 events", () => {
  const tier1Events: KnownEventType[] = [
    "task:status_changed",
    "workflow:step_completed",
    "decision:requested",
    "decision:responded",
    "division:completed",
    "division:failed",
    "subtask:completed",
    "subtask:failed",
    "cost:limit_reached",
  ];
  for (const event of tier1Events) {
    const schema = EVENT_SCHEMA_REGISTRY[event];
    assert.equal(schema.tier, "tier_1", `${event} should be tier_1`);
  }
});

test("KnownEventType includes tier_2 events", () => {
  const tier2Events: KnownEventType[] = [
    "dispatch:ticket_created",
    "dispatch:ticket_claimed",
    "worker:claim_accepted",
    "takeover:session_opened",
    "recovery:repair_applied",
    "skill:execution_started",
    "domain:registered",
    "plugin:error_isolated",
    "plugin:invocation_started",
    "knowledge:chunk_indexed",
  ];
  for (const event of tier2Events) {
    const schema = EVENT_SCHEMA_REGISTRY[event];
    assert.equal(schema.tier, "tier_2", `${event} should be tier_2`);
  }
});

test("KnownEventType includes tier_3 events", () => {
  const schema = EVENT_SCHEMA_REGISTRY["stream:chunk_emitted"];
  assert.equal(schema.tier, "tier_3");
});

test("EventSchemaDefinition has correct structure for tier_1 events", () => {
  const schema: EventSchemaDefinition = EVENT_SCHEMA_REGISTRY["task:status_changed"];
  assert.equal(schema.type, "task:status_changed");
  assert.equal(schema.tier, "tier_1");
  assert.ok(typeof schema.producer === "string");
  assert.ok(Array.isArray(schema.consumers));
  assert.ok(typeof schema.payloadSchemaRef === "string");
  assert.ok(schema.compatibilityPolicy === "backward_compatible_additive" || schema.compatibilityPolicy === "versioned_breaking_change");
});

test("All tier_1 events have required consumers", () => {
  const tier1Events = [
    "task:status_changed",
    "workflow:step_completed",
    "division:completed",
    "division:failed",
    "subtask:completed",
    "subtask:failed",
    "cost:limit_reached",
  ];
  for (const event of tier1Events) {
    const consumers = getRegisteredConsumers(event);
    assert.ok(consumers.length > 0, `${event} should have required consumers`);
  }
});

test("All events have payloadSchemaRef in correct format", () => {
  for (const [eventType, schema] of Object.entries(EVENT_SCHEMA_REGISTRY)) {
    assert.ok(schema.payloadSchemaRef.startsWith("event://"), `${eventType} should have event:// payload schema ref`);
    assert.ok(schema.payloadSchemaRef.endsWith("/v1"), `${eventType} should end with /v1`);
  }
});

test("getRegisteredConsumers is case-sensitive", () => {
  // Event types are lowercase with colons
  const consumers1 = getRegisteredConsumers("task:status_changed");
  const consumers2 = getRegisteredConsumers("Task:Status_Changed");
  assert.ok(consumers1.length !== consumers2.length || JSON.stringify(consumers1) !== JSON.stringify(consumers2));
});

test("validateEventPayload returns data for valid payload", () => {
  const payload = { fromStatus: "queued", toStatus: "in_progress" };
  const result = validateEventPayload("task:status_changed", payload);
  assert.equal(result.fromStatus, "queued");
  assert.equal(result.toStatus, "in_progress");
});

test("validateEventPayload throws ValidationError for invalid payload", () => {
  // Missing required fromStatus and toStatus fields
  const invalidPayload = { wrongField: "value" };
  assert.throws(
    () => validateEventPayload("task:status_changed", invalidPayload),
    (error: any) => {
      return error.code === "event.payload_invalid" && error.message.includes("task:status_changed");
    }
  );
});

test("validateEventPayload throws ValidationError for unknown event type", () => {
  const payload = { fromStatus: "queued", toStatus: "in_progress" };
  assert.throws(
    () => validateEventPayload("unknown:event_type", payload),
    (error: any) => {
      return error.code === "event.schema_missing" && error.message.includes("unknown:event_type");
    }
  );
});

test("validateEventPayload uses generic schema for events without specific validator", () => {
  // perf:test_event uses genericEventPayloadSchema (Record<string, unknown>)
  const result = validateEventPayload("perf:test_event", { anyField: "anyValue", num: 123 });
  assert.equal(result.anyField, "anyValue");
  assert.equal(result.num, 123);
});

test("validateEventPayload uses family validators for tier_2 dispatch and worker events", () => {
  const dispatchPayload = validateEventPayload("dispatch:ticket_claimed", {
    ticketId: "ticket-claimed",
    taskId: "task-dispatch",
    status: "claimed",
  });
  const workerPayload = validateEventPayload("worker:claim_accepted", {
    workerId: "worker-1",
    claimId: "claim-1",
    status: "accepted",
  });

  assert.equal(dispatchPayload.ticketId, "ticket-claimed");
  assert.equal(workerPayload.workerId, "worker-1");
});

test("validateEventPayload rejects subtask payload missing both stepId and subtaskId", () => {
  // subtaskOutcomePayloadSchema requires at least one of stepId or subtaskId
  const invalidPayload = { roleId: "agent", status: "completed" };
  assert.throws(
    () => validateEventPayload("subtask:completed", invalidPayload),
    (error: any) => {
      return error.code === "event.payload_invalid" && error.message.includes("subtask:completed");
    }
  );
});

test("R5-34 platform namespace events are registered and accessible", () => {
  const platformEvents = [
    "platform.request_envelope.admitted",
    "platform.harness_run.status_changed",
    "platform.node_run.status_changed",
    "platform.side_effect.status_changed",
    "platform.budget_ledger.status_changed",
    "platform.budget_reservation.status_changed",
    "platform.graph_scheduler.decision_recorded",
  ];

  for (const event of platformEvents) {
    assert.equal(hasEventSchema(event), true, `${event} should be registered`);
  }
});

test("platform.harness_run.status_changed has correct metadata per R5-34", () => {
  const schema = getEventSchema("platform.harness_run.status_changed");
  const metadata = getEventReplayMetadata("platform.harness_run.status_changed");

  assert.equal(schema.producer, "runtime-state-machine");
  assert.equal(schema.tier, "tier_1");
  assert.equal(metadata.replayable, true);
  assert.equal(metadata.sideEffectSafeToReplay, true);
  assert.equal(metadata.replayBehavior, "replay_as_fact");
  assert.equal(metadata.sourceOfTruth, "platform");
});

test("platform.node_run.status_changed has correct metadata per R5-34", () => {
  const schema = getEventSchema("platform.node_run.status_changed");
  const metadata = getEventReplayMetadata("platform.node_run.status_changed");

  assert.equal(schema.producer, "runtime-state-machine");
  assert.equal(schema.tier, "tier_1");
  assert.equal(metadata.replayable, true);
  assert.equal(metadata.sideEffectSafeToReplay, true);
  assert.equal(metadata.replayBehavior, "replay_as_fact");
});

test("platform.side_effect.status_changed has skip_side_effect behavior per R5-34", () => {
  const schema = getEventSchema("platform.side_effect.status_changed");
  const metadata = getEventReplayMetadata("platform.side_effect.status_changed");

  assert.equal(schema.producer, "side-effect-manager");
  assert.equal(metadata.sideEffectSafeToReplay, false);
  assert.equal(metadata.replayBehavior, "skip_side_effect");
});

test("platform.budget_ledger and budget_reservation events are replayable", () => {
  const events = ["platform.budget_ledger.status_changed", "platform.budget_reservation.status_changed"];

  for (const event of events) {
    const metadata = getEventReplayMetadata(event);
  assert.equal(metadata.replayable, true, `${event} should be replayable`);
  assert.equal(metadata.sideEffectSafeToReplay, true, `${event} should be safe to replay`);
  }
});

test("platform.graph_scheduler.decision_recorded is replayable per R5-34", () => {
  const schema = getEventSchema("platform.graph_scheduler.decision_recorded");
  const metadata = getEventReplayMetadata("platform.graph_scheduler.decision_recorded");

  assert.equal(schema.producer, "graph-scheduler");
  assert.equal(metadata.replayable, true);
  assert.equal(metadata.replayBehavior, "replay_as_fact");
  assert.equal(metadata.sourceOfTruth, "platform");
});

test("oapeflir.view.run_lifecycle has simulation replay behavior", () => {
  const schema = getEventSchema("oapeflir.view.run_lifecycle");
  const metadata = getEventReplayMetadata("oapeflir.view.run_lifecycle");

  assert.equal(schema.producer, "oapeflir-projection");
  assert.equal(metadata.replayBehavior, "simulate");
  assert.equal(metadata.sourceOfTruth, "projection");
});

test("all platform namespace events use backward_compatible_additive policy", () => {
  const platformEvents = [
    "platform.harness_run.status_changed",
    "platform.node_run.status_changed",
    "platform.side_effect.status_changed",
    "platform.budget_ledger.status_changed",
    "platform.budget_reservation.status_changed",
    "platform.graph_scheduler.decision_recorded",
    "oapeflir.view.run_lifecycle",
  ];

  for (const event of platformEvents) {
    const schema = getEventSchema(event);
    assert.equal(schema.compatibilityPolicy, "backward_compatible_additive", `${event} should use backward_compatible_additive`);
  }
});

test("platform events have inspect_projection consumer when source is projection", () => {
  const schema = getEventSchema("oapeflir.view.run_lifecycle");
  assert.ok(schema.consumers.includes("oapeflir_projection"));
  assert.ok(schema.consumers.includes("inspect_projection"));
});

test("platform events have truth_projector and audit_projection consumers when source is platform", () => {
  const schema = getEventSchema("platform.harness_run.status_changed");
  assert.ok(schema.consumers.includes("truth_projector"));
  assert.ok(schema.consumers.includes("audit_projection"));
});

test("R5-34 consumer contract tests are defined for platform events", () => {
  const eventsWithContractTests = [
    "platform.request_envelope.admitted",
    "platform.harness_run.status_changed",
    "platform.node_run.status_changed",
    "platform.side_effect.status_changed",
    "platform.budget_ledger.status_changed",
    "platform.budget_reservation.status_changed",
    "platform.graph_scheduler.decision_recorded",
  ];

  for (const event of eventsWithContractTests) {
    const metadata = getEventReplayMetadata(event);
    assert.ok(metadata.consumerContractTests.length > 0, `${event} should have consumer contract tests`);
  }
});

test("validateEventPayload accepts valid decision:requested payload", () => {
  const validPayload = {
    approvalId: "approval-123",
    taskId: "task-456",
    executionId: "exec-789",
    sourceAgentId: "agent-1",
    reason: "policy.high_risk",
    riskLevel: "high",
    options: ["approve", "deny"],
    timeoutPolicy: "reject",
    createdAt: "2026-04-28T00:00:00.000Z",
  };

  const result = validateEventPayload("decision:requested", validPayload);
  assert.equal(result.approvalId, "approval-123");
  assert.equal(result.reason, "policy.high_risk");
});

test("validateEventPayload accepts valid platform.request_envelope.admitted payload", () => {
  const validPayload = {
    confirmedTaskSpecId: "cts-123",
    harnessRunId: "hrun-456",
    runVersionLockId: "rvl-789",
    clarificationSession: { sessionId: "clar-001" },
  };

  const result = validateEventPayload("platform.request_envelope.admitted", validPayload);
  assert.equal(result.confirmedTaskSpecId, "cts-123");
  assert.equal(result.runVersionLockId, "rvl-789");
});

test("validateEventPayload accepts valid platform.harness_run.status_changed payload", () => {
  const validPayload = {
    aggregateType: "HarnessRun",
    fromStatus: "created",
    toStatus: "admitted",
    reasonCode: "admission.accepted",
    emittedBy: "intake-admission-service",
    runVersionLockId: "rvl-123",
    policyGuard: {
      allowed: true,
      policyProofRef: "policy://proof",
    },
    budgetPrecondition: {
      reservationId: "bledger-123",
      hardCapSatisfied: true,
    },
    auditRef: "audit://harness-runs/hrun-123/admission",
  };

  const result = validateEventPayload("platform.harness_run.status_changed", validPayload);
  assert.equal(result.toStatus, "admitted");
  assert.equal((result.policyGuard as { allowed: boolean }).allowed, true);
});

test("validateEventPayload rejects invalid platform.graph_scheduler.decision_recorded payload", () => {
  const invalidPayload = {
    schedulerPolicy: "critical-path",
    readyNodeIds: "node-1",
  };

  assert.throws(
    () => validateEventPayload("platform.graph_scheduler.decision_recorded", invalidPayload),
    (error: any) => error.code === "event.payload_invalid"
  );
});

test("validateEventPayload accepts valid oapeflir.view.run_lifecycle payload", () => {
  const validPayload = {
    stage: "feedback",
    runId: "hrun-123",
    taskId: "task-123",
    occurredAt: "2026-04-28T00:00:00.000Z",
  };

  const result = validateEventPayload("oapeflir.view.run_lifecycle", validPayload);
  assert.equal(result.stage, "feedback");
});

test("validateEventPayload accepts valid decision:responded payload", () => {
  const validPayload = {
    approvalId: "approval-123",
    decisionType: "confirmed",
    selectedOptionId: "option-1",
    confirmed: true,
    respondedBy: "user-1",
    respondedAt: "2026-04-28T00:00:00.000Z",
  };

  const result = validateEventPayload("decision:responded", validPayload);
  assert.equal(result.confirmed, true);
});

test("validateEventPayload accepts valid cost:limit_reached payload", () => {
  const validPayload = {
    budgetId: "budget-123",
    currentCostUsd: 150.5,
    limitUsd: 100.0,
    occurredAt: "2026-04-28T00:00:00.000Z",
  };

  const result = validateEventPayload("cost:limit_reached", validPayload);
  assert.equal(result.currentCostUsd, 150.5);
  assert.equal(result.limitUsd, 100.0);
});

test("validateEventPayload accepts valid knowledge:chunk_indexed payload", () => {
  const validPayload = {
    namespace: "coding",
    documentId: "doc-123",
    chunkId: "chunk-456",
    trustLevel: "high",
    keywordCount: 50,
    relationCount: 10,
    occurredAt: "2026-04-28T00:00:00.000Z",
  };

  const result = validateEventPayload("knowledge:chunk_indexed", validPayload);
  assert.equal(result.namespace, "coding");
});

test("validateEventPayload accepts valid domain:registered payload", () => {
  const validPayload = {
    domainId: "domain-123",
    status: "active",
    capabilityCount: 5,
    pluginCount: 3,
    occurredAt: "2026-04-28T00:00:00.000Z",
  };

  const result = validateEventPayload("domain:registered", validPayload);
  assert.equal(result.status, "active");
});

test("validateEventPayload accepts valid plugin:invocation_started payload", () => {
  const validPayload = {
    pluginId: "plugin-123",
    domainId: "coding",
    spiType: "retriever",
    phase: "invoke",
    invocationId: "inv-456",
    lifecycleState: "active",
    runtimeIsolation: "serialized",
    activeInvocationCount: 1,
    queuedInvocationCount: 0,
    occurredAt: "2026-04-28T00:00:00.000Z",
    status: "started",
  };

  const result = validateEventPayload("plugin:invocation_started", validPayload);
  assert.equal(result.invocationId, "inv-456");
});

test("validateEventPayload accepts valid learning:knowledge_promoted payload", () => {
  const validPayload = {
    learningObjectId: "lo-123",
    learningType: "snippet",
    documentId: "doc-456",
    namespace: "coding",
    trustLevel: "high",
    promotedCount: 5,
    occurredAt: "2026-04-28T00:00:00.000Z",
  };

  const result = validateEventPayload("learning:knowledge_promoted", validPayload);
  assert.equal(result.promotedCount, 5);
});

test("validateEventPayload rejects invalid decision:requested payload", () => {
  const invalidPayload = { reason: "missing approvalId" };
  assert.throws(
    () => validateEventPayload("decision:requested", invalidPayload),
    (error: any) => error.code === "event.payload_invalid"
  );
});

test("validateEventPayload rejects invalid cost:limit_reached payload", () => {
  const invalidPayload = { currentCostUsd: "not-a-number" };
  assert.throws(
    () => validateEventPayload("cost:limit_reached", invalidPayload),
    (error: any) => error.code === "event.payload_invalid"
  );
});

test("getEventReplayMetadata throws for unknown event type", () => {
  assert.throws(
    () => getEventReplayMetadata("unknown:event"),
    (error: any) => error.code === "event.replay_metadata_missing"
  );
});

test("event schema buildPayloadSchemaRef creates correct URI format", () => {
  const schema = getEventSchema("task:status_changed");
  assert.equal(schema.payloadSchemaRef, "event://task/status_changed/v1");
});

test("event schema buildPayloadSchemaRef handles multi-segment event types", () => {
  const schema = getEventSchema("platform.harness_run.status_changed");
  assert.equal(schema.payloadSchemaRef, "event://platform/harness_run/status_changed/v1");
});

test("getEventSchema returns tier_1 for platform namespace events", () => {
  const schema = getEventSchema("platform.harness_run.status_changed");
  assert.equal(schema.tier, "tier_1");
});

test("dispatch tier 2 events have inspect_projection consumer", () => {
  const dispatchEvents = [
    "dispatch:ticket_created",
    "dispatch:ticket_claimed",
    "dispatch:decision_recorded",
    "dispatch:execution_preempted",
    "dispatch:ticket_reconciled",
    "dispatch:ticket_requeued",
    "dispatch:ticket_rebuilt",
  ];

  for (const event of dispatchEvents) {
    const consumers = getRegisteredConsumers(event);
    assert.ok(consumers.includes("inspect_projection"), `${event} should have inspect_projection consumer`);
  }
});

test("worker tier 2 events have inspect_projection consumer", () => {
  const workerEvents = [
    "worker:claim_accepted",
    "worker:claim_rejected",
    "worker:heartbeat_recorded",
    "worker:writeback_recorded",
    "worker:writeback_rejected",
    "worker:lease_released_after_writeback",
  ];

  for (const event of workerEvents) {
    const consumers = getRegisteredConsumers(event);
    assert.ok(consumers.includes("inspect_projection"), `${event} should have inspect_projection consumer`);
  }
});

test("recovery tier 2 events have inspect_projection consumer", () => {
  const recoveryEvents = [
    "recovery:repair_applied",
    "recovery:decision_recorded",
    "recovery:dead_lettered",
    "recovery:cancelled",
  ];

  for (const event of recoveryEvents) {
    const consumers = getRegisteredConsumers(event);
    assert.ok(consumers.includes("inspect_projection"), `${event} should have inspect_projection consumer`);
  }
});

test("takeover tier 2 events have inspect_projection consumer", () => {
  const takeoverEvents = ["takeover:session_opened", "takeover:action_applied"];

  for (const event of takeoverEvents) {
    const consumers = getRegisteredConsumers(event);
    assert.ok(consumers.includes("inspect_projection"), `${event} should have inspect_projection consumer`);
  }
});

test("skill tier 2 events have inspect_projection consumer", () => {
  const skillEvents = [
    "skill:execution_started",
    "skill:cache_miss",
    "skill:cache_hit",
    "skill:cache_stored",
    "skill:step_started",
    "skill:retry_scheduled",
    "skill:step_succeeded",
    "skill:step_failed",
    "skill:execution_completed",
  ];

  for (const event of skillEvents) {
    const consumers = getRegisteredConsumers(event);
    assert.ok(consumers.includes("inspect_projection"), `${event} should have inspect_projection consumer`);
  }
});
