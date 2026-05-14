/**
 * Unit tests for state-evidence/events module index
 *
 * Tests re-exports and module interface for events package.
 * This supplements the comprehensive tests in individual test files.
 */

import assert from "node:assert/strict";
import test from "node:test";

// Re-exported types and functions from index.ts
import {
  // From cas/index
  CasService,
  type CasResult,
  FencingTokenService,
  type FenceMode,
  type FenceInfo,
  type FencingTokenValidation,
  // From dlq-service
  DlqService,
  type FailureCategory,
  type OperatorActionRecord,
  type OperatorActionType,
  type ExtendedDeadLetterRecord,
  type DeadLetterStatus,
  type DlqSummary,
  // From durable-event-bus-async
  DurableEventBusAsync,
  type EventHandler,
  // From durable-event-bus
  DurableEventBus,
  // From event-ops-service
  EventOpsService,
  type EventDrainResult,
  // From event-registry
  EVENT_SCHEMA_REGISTRY,
  validateEventPayload,
  hasEventSchema,
  getEventSchema,
  getRegisteredConsumers,
  type EventSchemaDefinition,
  type KnownEventType,
  // From event-reliability-inventory-service
  EventReliabilityInventoryService,
  type EventReliabilityInventoryEntry,
  type EventNamespaceInventory,
  type EventConsumerSurfaceInventory,
  type EventReliabilityInventoryReport,
  // From projection-inventory-service
  ProjectionInventoryService,
  type ProjectionInventoryRecord,
  // From event-topology-service
  EventTopologyService,
  type EventTopologyNode,
  type EventTopologyEdge,
  type EventTopologyEntry,
  type EventTopologySummary,
  // From event-types
  TIER_1_EVENT_TYPES,
  getEventTier,
  getRequiredConsumers,
  type Tier1EventType,
  // From transactional-event-appender
  TransactionalEventAppender,
  type TransactionalAppendOptions,
  type TransactionalAppendResult,
  // From typed-event-bus
  TypedEventBus,
  type TypedEventPayloadMap,
  type TypedEventType,
  type TypedEventEnvelope,
  // From typed-event-payloads
  type TaskStatusChangedPayload,
  type WorkflowStepCompletedPayload,
  type DecisionRequestedPayload,
  type DecisionRespondedPayload,
  type DivisionOutcomePayload,
  type SubtaskOutcomePayload,
  type CostLimitReachedPayload,
  type StreamChunkEmittedPayload,
  type DispatchTicketPayload,
  type WorkerLifecyclePayload,
  type TakeoverPayload,
  type RecoveryPayload,
  type DomainLifecyclePayload,
  type PluginLifecycleEventPayload,
  type PluginInvocationEventPayload,
  type KnowledgeChunkIndexedPayload,
  type LearningKnowledgePromotedPayload,
  // From typed-event-publisher
  TypedEventBusPublisher,
  type TypedEventPublisher,
} from "../../../../../src/platform/state-evidence/events/index.js";

// ============================================================================
// CAS Types
// ============================================================================

test("CasResult type structure", () => {
  const result: CasResult = {
    success: true,
    currentValue: "updated_value",
    currentVersion: 5,
  };
  assert.equal(result.success, true);
  assert.equal(result.currentVersion, 5);
});

test("FenceMode type values", () => {
  const shared: FenceMode = "shared";
  const exclusive: FenceMode = "exclusive";
  assert.equal(shared, "shared");
  assert.equal(exclusive, "exclusive");
});

test("FenceInfo type structure", () => {
  const info: FenceInfo = {
    executionId: "exec-123",
    mode: "exclusive",
    fenceToken: "token-xyz",
    ownerNodeId: "node-1",
    acquiredAt: new Date(),
    expiresAt: null,
  };
  assert.equal(info.executionId, "exec-123");
  assert.equal(info.mode, "exclusive");
});

test("FencingTokenValidation type with valid result", () => {
  const validation: FencingTokenValidation = {
    valid: true,
    executionId: "exec-456",
    owner: "node-2",
  };
  assert.equal(validation.valid, true);
  assert.ok(validation.executionId);
  assert.ok(validation.owner);
});

test("FencingTokenValidation type with invalid result", () => {
  const validation: FencingTokenValidation = {
    valid: false,
    reason: "Token expired",
  };
  assert.equal(validation.valid, false);
  assert.ok(validation.reason);
});

// ============================================================================
// DLQ Types
// ============================================================================

test("FailureCategory type values", () => {
  const categories: FailureCategory[] = [
    "transient",
    "permanent",
    "configuration",
    "resource",
    "timeout",
    "authentication",
    "rate_limit",
    "unknown",
  ];
  for (const cat of categories) {
    const record: ExtendedDeadLetterRecord = createMinimalDlqRecord();
    record.failureCategory = cat;
    assert.ok(record.failureCategory === cat);
  }
});

test("OperatorActionType type values", () => {
  const types: OperatorActionType[] = [
    "retry_scheduled",
    "retry_cancelled",
    "retry_exhausted",
    "manual_discard",
    "manual_resolve",
    "category_changed",
    "investigation_started",
    "escalation_triggered",
    "mitigation_applied",
  ];
  for (const type of types) {
    const action: OperatorActionRecord = createMinimalOperatorAction(type);
    assert.equal(action.action, type);
  }
});

test("DeadLetterStatus type values", () => {
  const statuses: DeadLetterStatus[] = ["pending", "retrying", "discarded", "resolved"];
  for (const status of statuses) {
    const record: ExtendedDeadLetterRecord = createMinimalDlqRecord();
    record.status = status;
    assert.equal(record.status, status);
  }
});

test("DlqSummary type structure", () => {
  const summary: DlqSummary = {
    totalRecords: 10,
    statusCounts: {
      pending: 5,
      retrying: 2,
      discarded: 1,
      resolved: 2,
    },
    categoryCounts: {
      transient: 3,
      permanent: 2,
      unknown: 5,
    },
    consumerCounts: {
      consumer1: 4,
      consumer2: 6,
    },
    pendingConsumers: ["consumer1", "consumer2"],
    maxRetryCount: 5,
    oldestPendingAt: "2026-04-26T08:00:00.000Z",
  };
  assert.equal(summary.totalRecords, 10);
  assert.equal(summary.maxRetryCount, 5);
});

// ============================================================================
// Event Registry Types
// ============================================================================

test("EVENT_SCHEMA_REGISTRY contains expected event types", () => {
  assert.ok(EVENT_SCHEMA_REGISTRY["task:status_changed"]);
  assert.ok(EVENT_SCHEMA_REGISTRY["workflow:step_completed"]);
  assert.ok(EVENT_SCHEMA_REGISTRY["decision:requested"]);
  assert.ok(EVENT_SCHEMA_REGISTRY["division:completed"]);
});

test("EventSchemaDefinition structure", () => {
  const schema = EVENT_SCHEMA_REGISTRY["task:status_changed"];
  assert.equal(schema.type, "task:status_changed");
  assert.equal(schema.tier, "tier_1");
  assert.ok(Array.isArray(schema.consumers));
  assert.ok(schema.consumers.length > 0);
});

test("KnownEventType is string union of registry keys", () => {
  const eventType: KnownEventType = "task:status_changed";
  assert.equal(eventType, "task:status_changed");
});

test("validateEventPayload works for valid event type", () => {
  const payload = { fromStatus: "pending", toStatus: "in_progress" };
  const validated = validateEventPayload("task:status_changed", payload);
  assert.equal(validated.fromStatus, "pending");
  assert.equal(validated.toStatus, "in_progress");
});

test("hasEventSchema returns true for known event", () => {
  assert.equal(hasEventSchema("task:status_changed"), true);
  assert.equal(hasEventSchema("workflow:step_completed"), true);
});

test("hasEventSchema returns false for unknown event", () => {
  assert.equal(hasEventSchema("unknown:event"), false);
  assert.equal(hasEventSchema(""), false);
});

test("getEventSchema returns schema for known event", () => {
  const schema = getEventSchema("task:status_changed");
  assert.equal(schema.type, "task:status_changed");
});

test("getRegisteredConsumers returns consumers for Tier 1 events", () => {
  const consumers = getRegisteredConsumers("task:status_changed");
  assert.ok(consumers.length > 0);
  assert.ok(consumers.includes("task_projection"));
});

test("getRegisteredConsumers returns empty for Tier 2 events", () => {
  const consumers = getRegisteredConsumers("stream:chunk_emitted");
  assert.deepEqual(consumers, []);
});

// ============================================================================
// Event Types
// ============================================================================

test("TIER_1_EVENT_TYPES contains canonical runtime reliability events", () => {
  assert.ok(TIER_1_EVENT_TYPES.length >= 46);
  assert.ok(TIER_1_EVENT_TYPES.includes("platform.node_run.failed"));
  assert.ok(TIER_1_EVENT_TYPES.includes("platform.side_effect.failed"));
  assert.ok(TIER_1_EVENT_TYPES.includes("platform.budget.actualized"));
  assert.ok(TIER_1_EVENT_TYPES.includes("oapeflir.phase.transition"));
});

test("Tier1EventType union type works", () => {
  const eventType: Tier1EventType = "task:status_changed";
  assert.equal(eventType, "task:status_changed");
});

test("getEventTier for all TIER_1_EVENT_TYPES returns tier_1", () => {
  for (const eventType of TIER_1_EVENT_TYPES) {
    assert.equal(getEventTier(eventType), "tier_1");
  }
});

test("getEventTier for dispatch events returns tier_2", () => {
  assert.equal(getEventTier("dispatch:ticket_created"), "tier_2");
});

test("getEventTier for stream events returns tier_3", () => {
  assert.equal(getEventTier("stream:chunk_emitted"), "tier_3");
});

test("getRequiredConsumers returns correct consumers for task events", () => {
  const consumers = getRequiredConsumers("task:status_changed");
  assert.ok(consumers.includes("task_projection"));
  assert.ok(consumers.includes("inspect_projection"));
});

// ============================================================================
// Event Drain Result
// ============================================================================

test("EventDrainResult type structure", () => {
  const result: EventDrainResult = {
    consumerId: "test_consumer",
    pendingBefore: 5,
    failedBefore: 0,
    replayedFromHistoryCount: 0,
    delivered: 5,
    pendingAfter: 0,
    failedAfter: 0,
    outcome: "delivered",
    errorCode: null,
  };
  assert.equal(result.consumerId, "test_consumer");
  assert.equal(result.outcome, "delivered");
});

// ============================================================================
// Event Reliability Inventory Types
// ============================================================================

test("EventReliabilityInventoryEntry type structure", () => {
  const entry: EventReliabilityInventoryEntry = {
    eventType: "task:status_changed",
    namespace: "task",
    tier: "tier_1",
    producer: "transition_service",
    consumers: ["task_projection", "inspect_projection"],
    ackRequired: true,
    replayRequired: true,
    dlqEligible: true,
    payloadSchemaRef: "event://task/status_changed/v1",
  };
  assert.equal(entry.namespace, "task");
  assert.equal(entry.ackRequired, true);
});

test("EventNamespaceInventory type structure", () => {
  const inventory: EventNamespaceInventory = {
    namespace: "task",
    totalEvents: 5,
    tierCounts: { tier_1: 4, tier_2: 1, tier_3: 0 },
    producers: ["producer1", "producer2"],
    consumers: ["consumer1", "consumer2"],
    ackRequiredEvents: ["task:status_changed"],
    replayRequiredEvents: ["task:status_changed"],
    dlqEligibleEvents: ["task:status_changed"],
  };
  assert.equal(inventory.namespace, "task");
  assert.equal(inventory.totalEvents, 5);
});

test("EventConsumerSurfaceInventory type structure", () => {
  const surface: EventConsumerSurfaceInventory = {
    consumerId: "task_projection",
    role: "projection",
    expectedByContract: true,
    consumedEvents: ["task:status_changed", "task:created"],
    tier1Events: ["task:status_changed"],
    tier2Events: [],
    tier3Events: [],
    ackRequired: true,
    replayRequired: true,
    coverageStatus: "implemented",
  };
  assert.equal(surface.consumerId, "task_projection");
  assert.equal(surface.role, "projection");
});

// ============================================================================
// Projection Inventory Types
// ============================================================================

test("ProjectionInventoryRecord type structure", () => {
  const record: ProjectionInventoryRecord = {
    projectionName: "task_summary",
    consumerId: "task_projection",
    namespace: "task",
    eventTypes: ["task:status_changed"],
    lagThresholdSeconds: 30,
    rebuildRequired: true,
    coverageStatus: "implemented",
  };
  assert.equal(record.projectionName, "task_summary");
  assert.equal(record.lagThresholdSeconds, 30);
});

// ============================================================================
// Event Topology Types
// ============================================================================

test("EventTopologyNode type structure", () => {
  const node: EventTopologyNode = {
    nodeId: "producer:transition_service",
    kind: "producer",
  };
  assert.equal(node.kind, "producer");
});

test("EventTopologyEdge type structure", () => {
  const edge: EventTopologyEdge = {
    source: "producer:transition_service",
    target: "event:task:status_changed",
    relation: "emits",
    tier: "tier_1",
  };
  assert.equal(edge.relation, "emits");
  assert.equal(edge.tier, "tier_1");
});

test("EventTopologyEntry type structure", () => {
  const entry: EventTopologyEntry = {
    eventType: "task:status_changed",
    namespace: "task",
    tier: "tier_1",
    producer: "transition_service",
    consumers: ["task_projection"],
    payloadSchemaRef: "event://task/status_changed/v1",
    reliableAckRequired: true,
  };
  assert.equal(entry.reliableAckRequired, true);
});

test("EventTopologySummary type structure", () => {
  const summary: EventTopologySummary = {
    totalEvents: 50,
    namespaces: ["task", "workflow", "decision"],
    tierCounts: { tier_1: 15, tier_2: 30, tier_3: 5 },
    producers: ["producer1", "producer2"],
    consumers: ["consumer1", "consumer2"],
  };
  assert.equal(summary.totalEvents, 50);
  assert.equal(summary.tierCounts.tier_1, 15);
});

// ============================================================================
// Transactional Event Appender Types
// ============================================================================

test("TransactionalAppendOptions type structure", () => {
  const options: TransactionalAppendOptions = {
    writeToOutbox: true,
    traceId: "trace-123",
    eventTier: "tier_1",
  };
  assert.equal(options.writeToOutbox, true);
  assert.equal(options.traceId, "trace-123");
});

test("TransactionalAppendResult type structure", () => {
  const result: TransactionalAppendResult = {
    event: {
      id: "evt-123",
      taskId: "task-456",
      sessionId: null,
      executionId: "exec-789",
      eventType: "task:status_changed",
      eventTier: "tier_1",
      payloadJson: "{}",
      traceId: null,
      createdAt: "2026-04-26T10:00:00.000Z",
    },
    outboxEntryId: "outbox-abc",
  };
  assert.ok(result.event);
  assert.ok(result.outboxEntryId);
});

// ============================================================================
// Typed Event Bus Types
// ============================================================================

test("TypedEventPayloadMap includes all expected event types", () => {
  const map: TypedEventPayloadMap = {
    "task:status_changed": { fromStatus: "pending", toStatus: "in_progress" },
    "workflow:step_completed": { stepId: "step-1" },
    "decision:requested": { approvalId: "approval-123" },
  };
  assert.ok(map["task:status_changed"]);
  assert.ok(map["workflow:step_completed"]);
});

test("TypedEventType is intersection of KnownEventType and keyof TypedEventPayloadMap", () => {
  const eventType: TypedEventType = "task:status_changed";
  assert.equal(eventType, "task:status_changed");
});

test("TypedEventEnvelope type structure", () => {
  const envelope: TypedEventEnvelope<"task:status_changed"> = {
    event: {
      id: "evt-123",
      taskId: "task-456",
      sessionId: null,
      executionId: null,
      eventType: "task:status_changed",
      eventTier: "tier_1",
      payloadJson: "{}",
      traceId: null,
      createdAt: "2026-04-26T10:00:00.000Z",
    },
    payload: {
      fromStatus: "pending",
      toStatus: "in_progress",
    },
  };
  assert.equal(envelope.event.eventType, "task:status_changed");
  assert.equal(envelope.payload.fromStatus, "pending");
});

// ============================================================================
// Typed Event Publisher Type
// ============================================================================

test("TypedEventPublisher interface structure", () => {
  // Verify the interface exists and is properly typed
  const publisher: TypedEventPublisher = {
    publish: (input) => {
      assert.equal(input.eventType, "task:status_changed");
    },
  };
  publisher.publish({
    eventType: "task:status_changed",
    payload: { fromStatus: "a", toStatus: "b" },
  });
});

// ============================================================================
// Event Payload Type Structures
// ============================================================================

test("TaskStatusChangedPayload structure", () => {
  const payload: TaskStatusChangedPayload = {
    fromStatus: "queued",
    toStatus: "in_progress",
  };
  assert.equal(payload.fromStatus, "queued");
});

test("WorkflowStepCompletedPayload structure", () => {
  const payload: WorkflowStepCompletedPayload = {
    stepId: "step-123",
  };
  assert.equal(payload.stepId, "step-123");
});

test("DecisionRequestedPayload structure", () => {
  const payload: DecisionRequestedPayload = {
    approvalId: "approval-abc",
  };
  assert.equal(payload.approvalId, "approval-abc");
});

test("DivisionOutcomePayload structure", () => {
  const payload: DivisionOutcomePayload = {
    divisionId: "div-123",
    occurredAt: "2026-04-26T10:00:00.000Z",
  };
  assert.equal(payload.divisionId, "div-123");
});

test("SubtaskOutcomePayload structure", () => {
  const payload: SubtaskOutcomePayload = {
    subtaskId: "sub-123",
  };
  assert.equal(payload.subtaskId, "sub-123");
});

test("CostLimitReachedPayload structure", () => {
  const payload: CostLimitReachedPayload = {
    budgetId: "budget-123",
    currentCostUsd: 95.50,
    limitUsd: 100,
    occurredAt: "2026-04-26T10:00:00.000Z",
  };
  assert.equal(payload.currentCostUsd, 95.50);
});

test("StreamChunkEmittedPayload structure", () => {
  const payload: StreamChunkEmittedPayload = {
    streamId: "stream-abc",
    chunkIndex: 5,
    chunkType: "text",
    emittedAt: "2026-04-26T10:00:00.000Z",
  };
  assert.equal(payload.chunkIndex, 5);
});

test("DispatchTicketPayload structure", () => {
  const payload: DispatchTicketPayload = {
    ticketId: "ticket-123",
    executionId: "exec-456",
    occurredAt: "2026-04-26T10:00:00.000Z",
  };
  assert.equal(payload.ticketId, "ticket-123");
});

test("WorkerLifecyclePayload structure", () => {
  const payload: WorkerLifecyclePayload = {
    workerId: "worker-123",
    executionId: null,
    occurredAt: "2026-04-26T10:00:00.000Z",
  };
  assert.equal(payload.executionId, null);
});

test("TakeoverPayload structure", () => {
  const payload: TakeoverPayload = {
    takeoverId: "takeover-123",
    executionId: "exec-456",
    occurredAt: "2026-04-26T10:00:00.000Z",
  };
  assert.equal(payload.takeoverId, "takeover-123");
});

test("RecoveryPayload structure", () => {
  const payload: RecoveryPayload = {
    executionId: "exec-123",
    occurredAt: "2026-04-26T10:00:00.000Z",
    reasonCode: "db_reconnect",
  };
  assert.equal(payload.reasonCode, "db_reconnect");
});

test("DomainLifecyclePayload structure", () => {
  const payload: DomainLifecyclePayload = {
    domainId: "domain-123",
    status: "active",
    capabilityCount: 5,
    pluginCount: 10,
    occurredAt: "2026-04-26T10:00:00.000Z",
  };
  assert.equal(payload.capabilityCount, 5);
});

test("PluginLifecycleEventPayload structure", () => {
  const payload: PluginLifecycleEventPayload = {
    pluginId: "plugin-123",
    domainId: null,
    spiType: "ai_spi",
    lifecycleState: "initialized",
    occurredAt: "2026-04-26T10:00:00.000Z",
  };
  assert.equal(payload.lifecycleState, "initialized");
});

test("PluginInvocationEventPayload structure", () => {
  const payload: PluginInvocationEventPayload = {
    pluginId: "plugin-abc",
    domainId: "domain-xyz",
    spiType: "presenter",
    phase: "invoke",
    invocationId: "inv-123",
    lifecycleState: "running",
    runtimeIsolation: "sandbox",
    activeInvocationCount: 2,
    queuedInvocationCount: 1,
    occurredAt: "2026-04-26T10:00:00.000Z",
  };
  assert.equal(payload.activeInvocationCount, 2);
});

test("KnowledgeChunkIndexedPayload structure", () => {
  const payload: KnowledgeChunkIndexedPayload = {
    namespace: "test/ns",
    documentId: "doc-123",
    chunkId: "chunk-456",
    trustLevel: "verified",
    keywordCount: 10,
    relationCount: 5,
    occurredAt: "2026-04-26T10:00:00.000Z",
  };
  assert.equal(payload.trustLevel, "verified");
});

test("LearningKnowledgePromotedPayload structure", () => {
  const payload: LearningKnowledgePromotedPayload = {
    learningObjectId: "lo-123",
    learningType: "concept",
    documentId: "doc-456",
    namespace: "test/ns",
    trustLevel: "reviewed",
    promotedCount: 3,
    occurredAt: "2026-04-26T10:00:00.000Z",
  };
  assert.equal(payload.promotedCount, 3);
});

// ============================================================================
// Helper Functions
// ============================================================================

function createMinimalDlqRecord(): ExtendedDeadLetterRecord {
  return {
    deadLetterId: "dlq-123",
    sourceEventId: "evt-456",
    consumerId: "consumer-abc",
    errorCode: "test_error",
    errorMessage: null,
    payloadJson: "{}",
    status: "pending",
    retryCount: 0,
    maxRetries: 5,
    nextRetryAt: null,
    createdAt: "2026-04-26T10:00:00.000Z",
    updatedAt: "2026-04-26T10:00:00.000Z",
    originalTimestamp: null,
    failureCategory: null,
    reason: null,
    retryExhaustedAt: null,
    operatorActionLog: [],
  };
}

function createMinimalOperatorAction(type: OperatorActionType): OperatorActionRecord {
  return {
    actionId: "action-123",
    operatorId: "operator-456",
    action: type,
    timestamp: "2026-04-26T10:00:00.000Z",
    details: null,
    previousStatus: null,
    newStatus: null,
  };
}
