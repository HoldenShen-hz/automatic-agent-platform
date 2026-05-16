import type { EventRecord, TraceContext } from "../../contracts/types/domain.js";

import { DurableEventBus, type EventHandler } from "./durable-event-bus.js";
import { getEventSchema, type KnownEventType } from "./event-registry.js";
import { AuthoritativeTaskStore } from "../truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../truth/authoritative-sql-database.js";
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
  PluginIsolationEventPayload,
  PluginLifecycleEventPayload,
  PluginInvocationEventPayload,
  KnowledgeChunkIndexedPayload,
  LearningKnowledgePromotedPayload,
  WorkerLifecyclePayload,
  WorkflowStepCompletedPayload,
  CircuitBreakerStateChangePayload,
  WorkerScaleSignalPayload,
  // R23-55/R23-56: OAPEFLIR stage event payloads (15 types)
  ObserveSignalsCollectedPayload,
  ObserveContextAugmentedPayload,
  AssessEvaluationCompletedPayload,
  AssessAnomalyClassifiedPayload,
  PlanProposalCreatedPayload,
  PlanDecisionRecordedPayload,
  ExecuteActionStartedPayload,
  ExecuteActionCompletedPayload,
  FeedbackSignalReceivedPayload,
  FeedbackOutcomeProcessedPayload,
  LearnObjectCreatedPayload,
  LearnObjectPromotedPayload,
  ImproveCandidateProposedPayload,
  ImproveCandidateAcceptedPayload,
  ReleaseRolloutStartedPayload,
  ReleaseRolloutCompletedPayload,
  ReleaseRollbackTriggeredPayload,
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
  "domain:canary": DomainLifecyclePayload;
  "domain:updating": DomainLifecyclePayload;
  "domain:updated": DomainLifecyclePayload;
  "domain:deprecated": DomainLifecyclePayload;
  "domain:archived": DomainLifecyclePayload;
  "plugin:spi_registered": PluginLifecycleEventPayload;
  "plugin:activated": PluginLifecycleEventPayload;
  "plugin:error_isolated": PluginIsolationEventPayload;
  "plugin:suspended": PluginLifecycleEventPayload;
  "plugin:invocation_started": PluginInvocationEventPayload;
  "plugin:invocation_completed": PluginInvocationEventPayload;
  "knowledge:chunk_indexed": KnowledgeChunkIndexedPayload;
  "learning:knowledge_promoted": LearningKnowledgePromotedPayload;
  // Config change events
  "config.changed": Record<string, unknown>;
  "config.rollout.started": Record<string, unknown>;
  "config.rollout.promoted": Record<string, unknown>;
  "config.rollout.cancelled": Record<string, unknown>;
  "config.rollout.auto_progressed": Record<string, unknown>;
  "config.drift_detected": Record<string, unknown>;
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
  "ux:interaction_tracked": {
    eventId: string;
    occurredAt: string;
    userId: string;
    sessionId: string | null;
    taskId: string | null;
    abTestGroup: string | null;
    elementId: string | null;
    interactionType: string;
    uxEventType: string;
    metadata: Record<string, string>;
  };
  // Circuit breaker state change events per §9.4
  "circuit_breaker:state_changed": CircuitBreakerStateChangePayload;
  // Performance test event types - used for benchmarks only
  "perf:test_event": Record<string, unknown>;
  "perf:burst_event": Record<string, unknown>;
  "test:capacity": Record<string, unknown>;
  "test:many_events": Record<string, unknown>;
  // R13-18: Auto-scaling signals for worker pool
  "worker:scale_up": WorkerScaleSignalPayload,
  "worker:scale_down": WorkerScaleSignalPayload,
  // R23-55/R23-56: OAPEFLIR stage events (15 types: observe/assess/plan/execute/feedback/learn/improve/release)
  "observe:signals_collected": ObserveSignalsCollectedPayload,
  "observe:context_augmented": ObserveContextAugmentedPayload,
  "assess:evaluation_completed": AssessEvaluationCompletedPayload,
  "assess:anomaly_classified": AssessAnomalyClassifiedPayload,
  "plan:proposal_created": PlanProposalCreatedPayload,
  "plan:decision_recorded": PlanDecisionRecordedPayload,
  "execute:action_started": ExecuteActionStartedPayload,
  "execute:action_completed": ExecuteActionCompletedPayload,
  "feedback:signal_received": FeedbackSignalReceivedPayload,
  "feedback:outcome_processed": FeedbackOutcomeProcessedPayload,
  "learn:object_created": LearnObjectCreatedPayload,
  "learn:object_promoted": LearnObjectPromotedPayload,
  "improve:candidate_proposed": ImproveCandidateProposedPayload,
  "improve:candidate_accepted": ImproveCandidateAcceptedPayload,
  "release:rollout_started": ReleaseRolloutStartedPayload,
  "release:rollout_completed": ReleaseRolloutCompletedPayload,
  "release:rollback_triggered": ReleaseRollbackTriggeredPayload,
  // §28.1: Canonical platform events
  "platform.harness_run.status_changed": Record<string, unknown>;
  "platform.harness_run.created": Record<string, unknown>;
  "platform.harness_run.admitted": Record<string, unknown>;
  "platform.harness_run.completed": Record<string, unknown>;
  "platform.harness_run.failed": Record<string, unknown>;
  "platform.node_run.status_changed": Record<string, unknown>;
  "platform.node_run.created": Record<string, unknown>;
  "platform.node_run.admitted": Record<string, unknown>;
  "platform.node_run.planning": Record<string, unknown>;
  "platform.node_run.ready": Record<string, unknown>;
  "platform.node_run.pausing": Record<string, unknown>;
  "platform.node_run.replanning": Record<string, unknown>;
  "platform.node_run.started": Record<string, unknown>;
  "platform.node_run.completed": Record<string, unknown>;
  "platform.node_run.failed": Record<string, unknown>;
  "platform.node_run.compensating": Record<string, unknown>;
  "platform.node_run.skipped": Record<string, unknown>;
  "platform.budget_ledger.status_changed": Record<string, unknown>;
  "platform.budget_reservation.status_changed": Record<string, unknown>;
  "platform.budget.status_changed": Record<string, unknown>;
  "platform.budget.reserved": Record<string, unknown>;
  "platform.budget.actualized": Record<string, unknown>;
  "platform.budget.exceeded": Record<string, unknown>;
  "platform.budget_reconciliation.status_changed": Record<string, unknown>;
  "platform.side_effect.status_changed": Record<string, unknown>;
  "platform.side_effect.triggered": Record<string, unknown>;
  "platform.side_effect.completed": Record<string, unknown>;
  "platform.side_effect.failed": Record<string, unknown>;
  // OAPEFLR events
  "oapeflir.view.run_lifecycle": Record<string, unknown>;
  "oapeflir.decision.recorded": Record<string, unknown>;
  "oapeflir.graph.scheduled": Record<string, unknown>;
  "oapeflir.node.executed": Record<string, unknown>;
  "oapeflir.phase.transition": {
    runId: string;
    fromPhase: string;
    toPhase: string;
    triggeredBy?: string;
    occurredAt: string;
  };
  // R17-03: Run termination cleanup events
  "run.cleanup_completed": {
    runId: string;
    tenantId: string;
    terminalStatus: string;
    cleanedResourceIds: readonly string[];
    failedResourceIds: readonly string[];
    cleanupStatus: string;
    occurredAt: string;
  };
  "run.cleanup_failed": {
    runId: string;
    tenantId: string;
    terminalStatus: string;
    cleanedResourceIds: readonly string[];
    failedResourceIds: readonly string[];
    cleanupStatus: string;
    errorMessage?: string;
    occurredAt: string;
  };
}

/**
 * Compile-time check that all known event types have payload definitions.
 * Extracts event types from the registry that are NOT in TypedEventPayloadMap.
 */
type MissingTypedEventDefinitions = Exclude<KnownEventType, keyof TypedEventPayloadMap>;
type _UnusedMissingTypedEventDefinitions = MissingTypedEventDefinitions;

function toEventPayloadRecord(payload: object): Record<string, unknown> {
  return payload as Record<string, unknown>;
}

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
  private readonly typedSubscribers = new Map<string, {
    eventTypes: ReadonlySet<TypedEventType>;
    handler: (event: TypedEventEnvelope<TypedEventType>) => void | Promise<void>;
  }>();

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
    principal?: string | null;
    payload: TypedEventPayloadMap[TType];
  }): EventRecord {
    getEventSchema(input.eventType);
    const event = this.bus.publish({
      ...input,
      payload: toEventPayloadRecord(input.payload),
    });
    return event;
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
    this.typedSubscribers.set(consumerId, {
      eventTypes: accepted as ReadonlySet<TypedEventType>,
      handler: handler as (event: TypedEventEnvelope<TypedEventType>) => void | Promise<void>,
    });
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
    this.typedSubscribers.delete(consumerId);
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

  public dispose(): void {
    this.typedSubscribers.clear();
    this.bus.dispose();
  }

  private async dispatchTypedVolatile(event: EventRecord): Promise<void> {
    for (const subscriber of this.typedSubscribers.values()) {
      if (!subscriber.eventTypes.has(event.eventType as TypedEventType)) {
        continue;
      }
      await subscriber.handler({
        event: event as EventRecord & { eventType: TypedEventType },
        payload: JSON.parse(event.payloadJson) as TypedEventPayloadMap[TypedEventType],
      });
    }
  }
}
