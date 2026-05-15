import type { EventRecord } from "../../contracts/types/domain.js";
import { ValidationError } from "../../contracts/errors.js";
import { nowIso } from "../../contracts/types/ids.js";
import type { AuthoritativeSqlDatabase } from "../truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../truth/authoritative-task-store.js";

export type EventHandler = (event: EventRecord) => void | Promise<void>;

export const MAX_DELIVERY_RETRIES = 3;
export const INITIAL_BACKOFF_MS = 100;
export const MAX_BACKOFF_MS = 5000;
export const ACTIVE_CONSUMER_REF_COUNTS = new WeakMap<AuthoritativeSqlDatabase, Map<string, number>>();
export const ACTIVE_SUBSCRIBER_POLL_INTERVAL_MS = 100;

export type EventPartitionKey = string & { __partitionKey: true };

export interface PartitionSequenceEntry {
  sequence: number;
  pendingConsumers: Set<string>;
  event: EventRecord;
}

export interface ConsumerGroup {
  groupId: string;
  maxConcurrency: number;
  backPressureThresholdBytes: number;
}

export interface BackPressureState {
  isBackPressure: boolean;
  pendingCount: number;
  bufferedBytes: number;
  lastCheckedAt: string;
}

export const DEFAULT_CONSUMER_GROUPS: ConsumerGroup[] = [
  { groupId: "default", maxConcurrency: 10, backPressureThresholdBytes: 1_000_000 },
  { groupId: "high-priority", maxConcurrency: 20, backPressureThresholdBytes: 500_000 },
  { groupId: "low-priority", maxConcurrency: 5, backPressureThresholdBytes: 2_000_000 },
];

export interface PartitionSubscriber {
  handler: EventHandler;
  partitions: ReadonlySet<string>;
  groupId: string;
  generation: number;
}

export interface DeliveryChainState {
  chain: Promise<void>;
  backPressure: BackPressureState;
  lastDeliveryAt: string | null;
  deliveryCount: number;
  groupId: string;
}

export class AdaptivePollingInterval {
  private baseIntervalMs = ACTIVE_SUBSCRIBER_POLL_INTERVAL_MS;
  private maxIntervalMs = 5_000;
  private currentIntervalMs: number;

  public constructor(baseIntervalMs = ACTIVE_SUBSCRIBER_POLL_INTERVAL_MS, maxIntervalMs = 5_000) {
    this.baseIntervalMs = baseIntervalMs;
    this.maxIntervalMs = maxIntervalMs;
    this.currentIntervalMs = baseIntervalMs;
  }

  public getInterval(backPressureState: BackPressureState): number {
    if (backPressureState.isBackPressure) {
      this.currentIntervalMs = Math.min(this.currentIntervalMs * 2, this.maxIntervalMs);
    } else {
      this.currentIntervalMs = Math.max(this.baseIntervalMs, this.currentIntervalMs / 2);
    }
    return this.currentIntervalMs;
  }

  public reset(): void {
    this.currentIntervalMs = this.baseIntervalMs;
  }
}

export function calculateBackoff(attemptIndex: number): number {
  const exponentialDelay = Math.min(INITIAL_BACKOFF_MS * Math.pow(2, attemptIndex), MAX_BACKOFF_MS);
  const jitter = Math.random() * exponentialDelay * 0.1;
  return Math.round(exponentialDelay + jitter);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getActiveConsumerRefCounts(db: AuthoritativeSqlDatabase): Map<string, number> {
  let refCounts = ACTIVE_CONSUMER_REF_COUNTS.get(db);
  if (refCounts === undefined) {
    refCounts = new Map<string, number>();
    ACTIVE_CONSUMER_REF_COUNTS.set(db, refCounts);
  }
  return refCounts;
}

export function validateEventPayloadSize(payload: Record<string, unknown>): void {
  const payloadSize = JSON.stringify(payload).length;
  if (payloadSize > 1_000_000) {
    throw new ValidationError("event.payload_too_large", `event.payload_too_large: Event payload size ${payloadSize} exceeds maximum of 1000000 bytes`, {
      details: { payloadSize, maxSize: 1_000_000 },
    });
  }
}

export function ensureEventReferencedTask(store: AuthoritativeTaskStore, taskId: string | null): void {
  if (taskId == null || store.task.getTask(taskId) != null) {
    return;
  }
  const createdAt = nowIso();
  store.task.insertTask({
    id: taskId,
    parentId: null,
    rootId: taskId,
    divisionId: null,
    tenantId: null,
    title: `Event reference ${taskId}`,
    status: "pending",
    source: "system",
    priority: "normal",
    inputJson: JSON.stringify({ createdBy: "durable_event_bus_reference" }),
    normalizedInputJson: null,
    outputJson: null,
    estimatedCostUsd: null,
    actualCostUsd: 0,
    errorCode: null,
    createdAt,
    updatedAt: createdAt,
    completedAt: null,
  });
}

export function ensureEventReferencedExecution(
  store: AuthoritativeTaskStore,
  logger: { warn(message: string, data?: Record<string, unknown>): void },
  executionId: string | null,
  taskId: string | null,
): string | null {
  if (executionId == null) {
    return null;
  }
  if (store.execution.getExecution(executionId) != null) {
    return executionId;
  }
  logger.warn("event_bus.execution_not_found_for_event", {
    executionId,
    taskId,
    message: "Referenced execution not found, event will be written with execution_id = NULL",
  });
  return null;
}
