import type { EventRecord } from "../../contracts/types/domain.js";

import { getEventTier } from "./event-types.js";

export interface EventRecordDraft {
  readonly id: string;
  readonly eventType: string;
  readonly payloadJson: string;
  readonly createdAt: string;
  readonly taskId?: string | null;
  readonly sessionId?: string | null;
  readonly executionId?: string | null;
  readonly eventTier?: EventRecord["eventTier"];
  readonly traceId?: string | null;
  readonly schemaVersion?: string | null;
  readonly aggregateId?: string | null;
  readonly runId?: string | null;
  readonly sequence?: number | null;
  readonly causationId?: string | null;
  readonly correlationId?: string | null;
  readonly payloadHash?: string | null;
  readonly idempotencyKey?: string | null;
  readonly replayBehavior?: EventRecord["replayBehavior"];
  readonly principal?: string | null;
  readonly evidenceRefs?: readonly string[];
}

export function materializeEventRecord(input: EventRecordDraft): EventRecord {
  return {
    id: input.id,
    taskId: input.taskId ?? null,
    sessionId: input.sessionId ?? null,
    executionId: input.executionId ?? null,
    eventType: input.eventType,
    eventTier: input.eventTier ?? getEventTier(input.eventType),
    payloadJson: input.payloadJson,
    traceId: input.traceId ?? null,
    createdAt: input.createdAt,
    schemaVersion: input.schemaVersion ?? null,
    aggregateId: input.aggregateId ?? null,
    runId: input.runId ?? null,
    sequence: input.sequence ?? null,
    causationId: input.causationId ?? null,
    correlationId: input.correlationId ?? null,
    payloadHash: input.payloadHash ?? null,
    idempotencyKey: input.idempotencyKey ?? null,
    replayBehavior: input.replayBehavior ?? null,
    principal: input.principal ?? null,
    evidenceRefs: [...(input.evidenceRefs ?? [])],
  };
}
