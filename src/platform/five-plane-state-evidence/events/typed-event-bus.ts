import type { EventRecord, TraceContext } from "../../contracts/types/domain.js";

import { DurableEventBus, type EventHandler } from "./durable-event-bus.js";
import { getEventSchema, type KnownEventType } from "./event-registry.js";
import { AuthoritativeTaskStore } from "../truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../truth/authoritative-sql-database.js";

/**
 * Circuit breaker state change event payload.
 * Defined here to avoid circular dependency with circuit-breaker module.
 */
export interface CircuitBreakerStateChangePayload {
  circuitName: string;
  oldState: CircuitBreakerState;
  newState: CircuitBreakerState;
  nextAttemptAt: number | null;
  occurredAt: string;
}

type CircuitBreakerState = "closed" | "open" | "half_open";

import type {
  CostLimitReachedPayload,
  DecisionRequestedPayload,
  DecisionRespondedPayload,
  DispatchTicketPayload,
  DivisionOutcomePayload,
  RecoveryPayload,
  StreamChunkEmittedPayload,
  SubtaskOutcomePayload,
  TakeoverPayload,
  TaskStatusChangedPayload,
  DomainLifecyclePayload,
  PluginLifecycleEventPayload,
  PluginInvocationEventPayload,
  KnowledgeChunkIndexedPayload,
  LearningKnowledgePromotedPayload,
  WorkerLifecyclePayload,
  WorkflowStepCompletedPayload,
} from "./typed-event-payloads.js";

/**
 * TypedEventPayloadMap - Defines the payload structure for each known event type.
 * Each event type has a specific shape for its payload, providing type safety
 * when publishing or subscribing to events.
 */
export interface TypedEventPayloadMap {
  "task:status_changed": TaskStatusChangedPayload;
  "workflow:step_completed": WorkflowStepCompletedPayload;
  "decision:requested": DecisionRequestedPayload;
  "decision:responded": DecisionRespondedPayload;
  "division:completed": DivisionOutcomePayload;
  "division:failed": DivisionOutcomePayload;
  "subtask:completed": SubtaskOutcomePayload;
  "subtask:failed": SubtaskOutcomePayload;
  "cost:limit_reached": CostLimitReachedPayload;
  "stream:chunk_emitted": StreamChunkEmittedPayload;
  "dispatch:ticket_created": DispatchTicketPayload;
  "dispatch:ticket_claimed": DispatchTicketPayload;
  "dispatch:decision_recorded": DispatchTicketPayload;
  "dispatch:execution_preempted": DispatchTicketPayload;
  "dispatch:ticket_reconciled": DispatchTicketPayload;
  "dispatch:ticket_requeued": DispatchTicketPayload;
  "dispatch:ticket_rebuilt": DispatchTicketPayload;
  "worker:claim_accepted": WorkerLifecyclePayload;
  "worker:claim_rejected": WorkerLifecyclePayload;
  "worker:heartbeat_recorded": WorkerLifecyclePayload;
  "worker:writeback_recorded": WorkerLifecyclePayload;
  "worker:writeback_rejected": WorkerLifecyclePayload;
  "worker:lease_released_after_writeback": WorkerLifecyclePayload;
  "takeover:session_opened": TakeoverPayload;
  "takeover:action_applied": TakeoverPayload;
  "recovery:repair_applied": RecoveryPayload;
  "recovery:decision_recorded": RecoveryPayload;
  "recovery:dead_lettered": RecoveryPayload;
  "recovery:cancelled": RecoveryPayload;
  "domain:registered": DomainLifecyclePayload;
  "domain:activated": DomainLifecyclePayload;
  "plugin:spi_registered": PluginLifecycleEventPayload;
  "plugin:suspended": PluginLifecycleEventPayload;
  "plugin:activated": PluginLifecycleEventPayload;
  "plugin:error_isolated": PluginLifecycleEventPayload;
  "plugin:invocation_started": PluginInvocationEventPayload;
  "plugin:invocation_completed": PluginInvocationEventPayload;
  "knowledge:chunk_indexed": KnowledgeChunkIndexedPayload;
  "learning:knowledge_promoted": LearningKnowledgePromotedPayload;
  "skill:execution_started": {
    skillId: string;
    version: string;
    stepCount: number;
    cacheStatus: string;
  };
  "skill:cache_miss": {
    skillId: string;
    cacheKey: string | null;
    workingDirectory: string | null;
    gitHead: string | null;
    sourceHash: string | null;
  };
  "skill:cache_hit": {
    skillId: string;
    cacheKey: string | null;
    workingDirectory: string | null;
    gitHead: string | null;
    sourceHash: string | null;
    storedAt: string | null;
    expiresAt: string | null;
  };
  "skill:cache_stored": {
    skillId: string;
    cacheKey: string | null;
    workingDirectory: string | null;
    gitHead: string | null;
    sourceHash: string | null;
    storedAt: string | null;
    expiresAt: string | null;
  };
  "skill:step_started": {
    skillId: string;
    stepId: string;
    toolName: string;
    attempt: number;
    maxAttempts: number;
  };
  "skill:retry_scheduled": {
    skillId: string;
    stepId: string;
    toolName: string;
    attempt: number;
    nextAttempt: number;
    errorCode: string | null;
  };
  "skill:step_succeeded": {
    skillId: string;
    stepId: string;
    toolName: string;
    attempt: number;
    maxAttempts: number;
    durationMs?: number;
    continuedAfterFailure?: boolean;
  };
  "skill:step_failed": {
    skillId: string;
    stepId: string;
    toolName: string;
    attempt: number;
    maxAttempts: number;
    errorCode: string | null;
    retrying?: boolean;
    willRetry?: boolean;
    continued?: boolean;
    continuedAfterFailure?: boolean;
  };
  "skill:execution_completed": {
    skillId: string;
    status: string;
    retryCount: number;
    cacheStatus: string;
    failedStepId?: string;
  };
  // Circuit breaker state change events per §9.4
  "circuit_breaker:state_changed": CircuitBreakerStateChangePayload;
  // §28 Canonical platform events - harness run (R5-41)
  "platform.harness_run.status_changed": {
    status: string;
    runId: string;
    taskId?: string | null;
    occurredAt?: string | null;
  };
  "platform.harness_run.created": {
    runId: string;
    taskId?: string | null;
    occurredAt?: string | null;
  };
  "platform.harness_run.admitted": {
    runId: string;
    taskId?: string | null;
    occurredAt?: string | null;
  };
  "platform.harness_run.planning": {
    runId: string;
    taskId?: string | null;
    occurredAt?: string | null;
  };
  "platform.harness_run.ready": {
    runId: string;
    taskId?: string | null;
    occurredAt?: string | null;
  };
  "platform.harness_run.pausing": {
    runId: string;
    taskId?: string | null;
    occurredAt?: string | null;
  };
  "platform.harness_run.replanning": {
    runId: string;
    taskId?: string | null;
    occurredAt?: string | null;
  };
  "platform.harness_run.compensating": {
    runId: string;
    taskId?: string | null;
    occurredAt?: string | null;
  };
  "platform.harness_run.aborted": {
    runId: string;
    taskId?: string | null;
    occurredAt?: string | null;
  };
  "platform.harness_run.completed": {
    runId: string;
    taskId?: string | null;
    occurredAt?: string | null;
  };
  // §28 Canonical platform events - node run (R5-41)
  "platform.node_run.status_changed": {
    status: string;
    runId: string;
    nodeId: string;
    taskId?: string | null;
    occurredAt?: string | null;
  };
  "platform.node_run.created": {
    runId: string;
    nodeId: string;
    taskId?: string | null;
    occurredAt?: string | null;
  };
  "platform.node_run.admitted": {
    runId: string;
    nodeId: string;
    taskId?: string | null;
    occurredAt?: string | null;
  };
  "platform.node_run.planning": {
    runId: string;
    nodeId: string;
    taskId?: string | null;
    occurredAt?: string | null;
  };
  "platform.node_run.ready": {
    runId: string;
    nodeId: string;
    taskId?: string | null;
    occurredAt?: string | null;
  };
  "platform.node_run.pausing": {
    runId: string;
    nodeId: string;
    taskId?: string | null;
    occurredAt?: string | null;
  };
  "platform.node_run.replanning": {
    runId: string;
    nodeId: string;
    taskId?: string | null;
    occurredAt?: string | null;
  };
  "platform.node_run.completed": {
    runId: string;
    nodeId: string;
    taskId?: string | null;
    occurredAt?: string | null;
  };
  "platform.node_run.failed": {
    runId: string;
    nodeId: string;
    taskId?: string | null;
    occurredAt?: string | null;
  };
  "platform.node_run.compensating": {
    runId: string;
    nodeId: string;
    taskId?: string | null;
    occurredAt?: string | null;
  };
  "platform.node_run.skipped": {
    runId: string;
    nodeId: string;
    taskId?: string | null;
    occurredAt?: string | null;
  };
  // §28 Canonical platform events - side effect (R5-41)
  "platform.side_effect.status_changed": {
    status: string;
    runId: string;
    sideEffectId: string;
    taskId?: string | null;
    occurredAt?: string | null;
  };
  "platform.side_effect.triggered": {
    runId: string;
    sideEffectId: string;
    taskId?: string | null;
    occurredAt?: string | null;
  };
  "platform.side_effect.completed": {
    runId: string;
    sideEffectId: string;
    taskId?: string | null;
    occurredAt?: string | null;
  };
  "platform.side_effect.failed": {
    runId: string;
    sideEffectId: string;
    taskId?: string | null;
    occurredAt?: string | null;
  };
  // §28 Canonical platform events - budget (R5-41)
  "platform.budget.status_changed": {
    status: string;
    budgetId: string;
    taskId?: string | null;
    occurredAt?: string | null;
  };
  "platform.budget.reserved": {
    budgetId: string;
    amount: number;
    taskId?: string | null;
    occurredAt?: string | null;
  };
  "platform.budget.actualized": {
    budgetId: string;
    amount: number;
    taskId?: string | null;
    occurredAt?: string | null;
  };
  "platform.budget.exceeded": {
    budgetId: string;
    limit: number;
    actual: number;
    taskId?: string | null;
    occurredAt?: string | null;
  };
  "platform.budget_reconciliation.status_changed": {
    status: string;
    reconciliationId: string;
    taskId?: string | null;
    occurredAt?: string | null;
  };
  // §28 OAPEFLIR events (R5-41)
  "oapeflir.view.run_lifecycle": {
    stage: string;
    runId: string;
    taskId?: string | null;
    occurredAt?: string | null;
  };
  "oapeflir.decision.recorded": {
    runId: string;
    decision: string;
    taskId?: string | null;
    occurredAt?: string | null;
  };
  "oapeflir.phase.transition": {
    runId: string;
    fromPhase: string;
    toPhase: string;
    taskId?: string | null;
    occurredAt?: string | null;
  };
  // §5.4 Canonical UX event taxonomy - platform.ux.* namespace
  "platform.ux.button_click": {
    eventId: string;
    userId: string;
    sessionId: string | null;
    taskId: string | null;
    abTestGroup: string | null;
    elementId: string | null;
    interactionType: string;
    metadata: Record<string, string>;
    occurredAt: string;
  };
  "platform.ux.form_submit": {
    eventId: string;
    userId: string;
    sessionId: string | null;
    taskId: string | null;
    abTestGroup: string | null;
    elementId: string | null;
    interactionType: string;
    metadata: Record<string, string>;
    occurredAt: string;
  };
  "platform.ux.navigation": {
    eventId: string;
    userId: string;
    sessionId: string | null;
    taskId: string | null;
    abTestGroup: string | null;
    elementId: string | null;
    interactionType: string;
    metadata: Record<string, string>;
    occurredAt: string;
  };
  "platform.ux.wizard_step": {
    eventId: string;
    userId: string;
    sessionId: string | null;
    taskId: string | null;
    abTestGroup: string | null;
    elementId: string | null;
    interactionType: string;
    metadata: Record<string, string>;
    occurredAt: string;
  };
  "platform.ux.workflow_build": {
    eventId: string;
    userId: string;
    sessionId: string | null;
    taskId: string | null;
    abTestGroup: string | null;
    elementId: string | null;
    interactionType: string;
    metadata: Record<string, string>;
    occurredAt: string;
  };
  "platform.ux.dashboard_view": {
    eventId: string;
    userId: string;
    sessionId: string | null;
    taskId: string | null;
    abTestGroup: string | null;
    elementId: string | null;
    interactionType: string;
    metadata: Record<string, string>;
    occurredAt: string;
  };
  "platform.ux.search_query": {
    eventId: string;
    userId: string;
    sessionId: string | null;
    taskId: string | null;
    abTestGroup: string | null;
    elementId: string | null;
    interactionType: string;
    metadata: Record<string, string>;
    occurredAt: string;
  };
  "platform.ux.filter_apply": {
    eventId: string;
    userId: string;
    sessionId: string | null;
    taskId: string | null;
    abTestGroup: string | null;
    elementId: string | null;
    interactionType: string;
    metadata: Record<string, string>;
    occurredAt: string;
  };
  "platform.ux.export_action": {
    eventId: string;
    userId: string;
    sessionId: string | null;
    taskId: string | null;
    abTestGroup: string | null;
    elementId: string | null;
    interactionType: string;
    metadata: Record<string, string>;
    occurredAt: string;
  };
  "platform.ux.share_action": {
    eventId: string;
    userId: string;
    sessionId: string | null;
    taskId: string | null;
    abTestGroup: string | null;
    elementId: string | null;
    interactionType: string;
    metadata: Record<string, string>;
    occurredAt: string;
  };
  "platform.ux.onboarding_complete": {
    eventId: string;
    userId: string;
    sessionId: string | null;
    taskId: string | null;
    abTestGroup: string | null;
    elementId: string | null;
    interactionType: string;
    metadata: Record<string, string>;
    occurredAt: string;
  };
  "platform.ux.feedback_submit": {
    eventId: string;
    userId: string;
    sessionId: string | null;
    taskId: string | null;
    abTestGroup: string | null;
    elementId: string | null;
    interactionType: string;
    metadata: Record<string, string>;
    occurredAt: string;
  };
  // Performance test event types - used for benchmarks only
  "perf:test_event": Record<string, unknown>;
  "perf:burst_event": Record<string, unknown>;
  "test:capacity": Record<string, unknown>;
  "test:many_events": Record<string, unknown>;
}

/**
 * Compile-time check that all known event types have payload definitions.
 * Extracts event types from the registry that are NOT in TypedEventPayloadMap.
 */
type MissingTypedEventDefinitions = Exclude<KnownEventType, keyof TypedEventPayloadMap>;
// Compile-time check: if MissingTypedEventDefinitions is not never, this type will be never, causing a type error
type _TypedEventCoverageCheck = MissingTypedEventDefinitions extends never ? true : never;

/**
 * Union type of all event types that have typed payloads.
 */
export type TypedEventType = keyof TypedEventPayloadMap & KnownEventType;

/**
 * Extracts skill-related event types from TypedEventType.
 * Useful for subscribing to skill-specific events.
 */
export type SkillEventType = Extract<TypedEventType, `skill:${string}`>;

/**
 * TypedEventEnvelope - Combines an event record with its type-safe payload.
 * The eventType is refined to the specific TType, allowing TypeScript
 * to correctly infer the payload type.
 */
export interface TypedEventEnvelope<TType extends TypedEventType> {
  event: EventRecord & { eventType: TType };
  payload: TypedEventPayloadMap[TType];
}

/**
 * TypedEventBus - Provides type-safe event publishing and subscribing.
 * Wraps the DurableEventBus with compile-time type checking for event payloads.
 */
export class TypedEventBus {
  private readonly bus: DurableEventBus;

  public constructor(
    db: AuthoritativeSqlDatabase,
    store: AuthoritativeTaskStore,
  ) {
    this.bus = new DurableEventBus(db, store);
  }

  /**
   * Publishes a typed event to the event bus.
   * Validates the event type against the schema before publishing.
   * @param input - The event data including type, payload, and optional IDs
   * @returns The persisted event record
   */
  public publish<TType extends TypedEventType>(input: {
    eventType: TType;
    taskId?: string | null;
    sessionId?: string | null;
    executionId?: string | null;
    traceId?: string | null;
    traceContext?: TraceContext | null;
    payload: TypedEventPayloadMap[TType];
  }): EventRecord {
    getEventSchema(input.eventType);
    return this.bus.publish({
      ...input,
      payload: input.payload as unknown as Record<string, unknown>,
    });
  }

  /**
   * Subscribes a handler to specific typed event types.
   * The handler receives events with fully typed payloads.
   * @param consumerId - The consumer ID to subscribe
   * @param eventTypes - Array of event types to subscribe to
   * @param handler - Handler function called for each matching event
   */
  public subscribe<TType extends TypedEventType>(
    consumerId: string,
    eventTypes: readonly TType[],
    handler: (event: TypedEventEnvelope<TType>) => void | Promise<void>,
  ): void {
    const accepted = new Set(eventTypes);
    const typedHandler: EventHandler = async (event) => {
      if (!accepted.has(event.eventType as TType)) {
        return;
      }
      await handler({
        event: event as EventRecord & { eventType: TType },
        payload: JSON.parse(event.payloadJson) as TypedEventPayloadMap[TType],
      });
    };
    this.bus.subscribe(consumerId, typedHandler);
  }

  /**
   * Unsubscribes a consumer from the event bus.
   * @param consumerId - The consumer ID to unsubscribe
   */
  public unsubscribe(consumerId: string): void {
    this.bus.unsubscribe(consumerId);
  }

  /**
   * Delivers all pending events to a specific consumer.
   * @param consumerId - The consumer ID to deliver events to
   * @returns The number of events delivered
   */
  public async deliverPending(consumerId: string): Promise<number> {
    return this.bus.deliverPending(consumerId);
  }

  /**
   * Gets all pending events for a specific consumer.
   * @param consumerId - The consumer ID to get pending events for
   * @returns Array of pending events
   */
  public pendingForConsumer(consumerId: string) {
    return this.bus.pendingForConsumer(consumerId);
  }

  /**
   * Disposes the typed event bus and releases all resources.
   */
  public dispose(): void {
    this.bus.dispose();
  }
}
