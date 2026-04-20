/**
 * Outbox Pattern Types
 *
 * Provides type definitions for the transactional outbox pattern implementation.
 * The outbox pattern ensures reliable event delivery by writing events to an
 * outbox table within the same transaction as business data, then asynchronously
 * publishing to the event bus.
 */

export interface OutboxRecord {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payloadJson: string;
  traceId: string | null;
  createdAt: string;
  publishedAt: string | null;
  retryCount: number;
  lastError: string | null;
  lastAttemptAt: string | null;
}

export interface OutboxInsertPayload {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  traceId?: string | null;
}

export interface OutboxPollResult {
  published: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

export interface OutboxMetrics {
  pendingCount: number;
  publishedCount: number;
  failedCount: number;
  averageLatencyMs: number;
}

export enum OutboxStatus {
  PENDING = "pending",
  PUBLISHED = "published",
  FAILED = "failed",
}
