/**
 * EventRepository - Data access for events, acknowledgements, and Tier 1 audit state.
 */
import { computeTier1AuditChainHash, computeTier1AuditEventChecksum, verifyTier1AuditIntegrity, } from "../../../../control-plane/iam/audit-event-integrity.js";
import { getEventTier, getRequiredConsumers } from "../../../events/event-types.js";
import { newId, nowIso } from "../../../../contracts/types/ids.js";
import { execute, queryAll, queryOne } from "../query-helper.js";
import { parseDispatchDecisionTrace, resolveTenantScope, } from "../authoritative-task-store-types.js";
const EVENT_COLS = `id,
        task_id AS taskId,
        session_id AS sessionId,
        execution_id AS executionId,
        event_type AS eventType,
        event_tier AS eventTier,
        payload_json AS payloadJson,
        trace_id AS traceId,
        created_at AS createdAt`;
const EVENT_COLS_PREFIXED = `e.id,
        e.task_id AS taskId,
        e.session_id AS sessionId,
        e.execution_id AS executionId,
        e.event_type AS eventType,
        e.event_tier AS eventTier,
        e.payload_json AS payloadJson,
        e.trace_id AS traceId,
        e.created_at AS createdAt`;
export class EventRepository {
    conn;
    constructor(conn) {
        this.conn = conn;
    }
    insertEvent(event) {
        const record = {
            id: event.id,
            taskId: event.taskId ?? null,
            sessionId: event.sessionId ?? null,
            executionId: event.executionId ?? null,
            eventType: event.eventType,
            eventTier: event.eventTier ?? getEventTier(event.eventType),
            payloadJson: event.payloadJson,
            traceId: event.traceId ?? null,
            createdAt: event.createdAt,
        };
        this.conn
            .prepare(`INSERT INTO events (
          id, task_id, session_id, execution_id, event_type, event_tier,
          payload_json, trace_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(record.id, record.taskId, record.sessionId, record.executionId, record.eventType, record.eventTier, record.payloadJson, record.traceId, record.createdAt);
        for (const consumerId of getRequiredConsumers(record.eventType)) {
            this.insertEventConsumerAck({
                id: newId("eack"),
                eventId: record.id,
                consumerId,
                status: "pending",
                lastAttemptAt: null,
                ackedAt: null,
                errorCode: null,
                attemptCount: 0,
            });
        }
        if (record.eventTier === "tier_1") {
            this.bootstrapTier1AuditIntegrityRecords();
        }
        return record;
    }
    insertEventDeadLetter(record) {
        this.conn
            .prepare(`INSERT INTO event_dead_letters (
          id, original_event_id, event_type, payload_json, consumer_id,
          failure_count, last_error, dead_lettered_at, reprocessed_at, reprocess_result
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(record.id, record.originalEventId, record.eventType, record.payloadJson, record.consumerId, record.failureCount, record.lastError, record.deadLetteredAt, record.reprocessedAt, record.reprocessResult);
    }
    listEventDeadLetters(limit = 100, cursor) {
        let sql = `SELECT
        id,
        original_event_id AS originalEventId,
        event_type AS eventType,
        payload_json AS payloadJson,
        consumer_id AS consumerId,
        failure_count AS failureCount,
        last_error AS lastError,
        dead_lettered_at AS deadLetteredAt,
        reprocessed_at AS reprocessedAt,
        reprocess_result AS reprocessResult
       FROM event_dead_letters`;
        const params = [];
        if (cursor !== undefined && cursor !== null) {
            sql += ` WHERE dead_lettered_at < ?`;
            params.push(cursor);
        }
        sql += ` ORDER BY dead_lettered_at DESC LIMIT ?`;
        params.push(limit);
        return queryAll(this.conn, sql, ...params);
    }
    listEventsByType(eventType, limit) {
        const sql = `SELECT ${EVENT_COLS}
       FROM events
       WHERE event_type = ?
       ORDER BY created_at DESC${limit ? ` LIMIT ${limit}` : ""}`;
        return queryAll(this.conn, sql, eventType);
    }
    /**
     * List all events with optional pagination and filtering.
     * Used for projection rebuild to replay all events.
     */
    listAllEvents(limit = 1000, offset = 0) {
        return queryAll(this.conn, `SELECT ${EVENT_COLS}
       FROM events
       ORDER BY created_at ASC
       LIMIT ? OFFSET ?`, limit, offset);
    }
    insertEventConsumerAck(ack) {
        this.conn
            .prepare(`INSERT INTO event_consumer_acks (
          id, event_id, consumer_id, status, last_attempt_at,
          acked_at, error_code, attempt_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(ack.id, ack.eventId, ack.consumerId, ack.status, ack.lastAttemptAt, ack.ackedAt, ack.errorCode, ack.attemptCount);
    }
    markEventAck(eventIdOrInput, consumerId) {
        const input = typeof eventIdOrInput === "string"
            ? {
                eventId: eventIdOrInput,
                consumerId: consumerId ?? "",
                status: "acked",
                occurredAt: nowIso(),
                errorCode: null,
            }
            : eventIdOrInput;
        execute(this.conn, `UPDATE event_consumer_acks
       SET status = ?,
           last_attempt_at = ?,
           acked_at = CASE WHEN ? = 'acked' THEN ? ELSE acked_at END,
           error_code = ?,
           attempt_count = attempt_count + 1
       WHERE event_id = ? AND consumer_id = ?`, input.status, input.occurredAt, input.status, input.occurredAt, input.errorCode ?? null, input.eventId, input.consumerId);
    }
    markEventDeadLettered(input) {
        execute(this.conn, `UPDATE event_consumer_acks
       SET status = 'dead_lettered',
           last_attempt_at = ?,
           error_code = ?
       WHERE event_id = ? AND consumer_id = ?`, input.occurredAt, input.errorCode, input.eventId, input.consumerId);
    }
    getEventConsumerAck(eventId, consumerId) {
        return queryOne(this.conn, `SELECT
        id,
        event_id AS eventId,
        consumer_id AS consumerId,
        status,
        last_attempt_at AS lastAttemptAt,
        acked_at AS ackedAt,
        error_code AS errorCode,
        attempt_count AS attemptCount
       FROM event_consumer_acks
       WHERE event_id = ? AND consumer_id = ?`, eventId, consumerId);
    }
    getRequiredConsumerIds(eventId) {
        return queryAll(this.conn, `SELECT consumer_id AS consumerId
       FROM event_consumer_acks
       WHERE event_id = ?`, eventId).map((row) => row.consumerId);
    }
    ackAllConsumersForEvent(eventId, occurredAt) {
        execute(this.conn, `UPDATE event_consumer_acks
       SET status = 'acked',
           last_attempt_at = ?,
           acked_at = ?,
           error_code = NULL,
           attempt_count = attempt_count + 1
       WHERE event_id = ?
         AND status IN ('pending', 'failed')`, occurredAt, occurredAt, eventId);
    }
    ensureEventConsumerAckPending(eventId, consumerId) {
        this.conn
            .prepare(`INSERT OR IGNORE INTO event_consumer_acks (
          id, event_id, consumer_id, status, last_attempt_at, acked_at, error_code, attempt_count
        ) VALUES (?, ?, ?, 'pending', NULL, NULL, NULL, 0)`)
            .run(newId("eack"), eventId, consumerId);
    }
    listPendingEventsForConsumer(consumerId, limit) {
        const sql = `SELECT
        e.id AS event_id,
        e.task_id AS task_id,
        e.session_id AS session_id,
        e.execution_id AS execution_id,
        e.event_type AS event_type,
        e.event_tier AS event_tier,
        e.payload_json AS payload_json,
        e.trace_id AS trace_id,
        e.created_at AS event_created_at,
        a.id AS ack_id,
        a.consumer_id AS consumer_id,
        a.status AS ack_status,
        a.last_attempt_at AS last_attempt_at,
        a.acked_at AS acked_at,
        a.error_code AS ack_error_code,
        a.attempt_count AS attempt_count
       FROM event_consumer_acks a
       JOIN events e ON e.id = a.event_id
       WHERE a.consumer_id = ?
         AND a.status IN ('pending', 'failed')
       ORDER BY e.created_at ASC${limit ? ` LIMIT ${limit}` : ""}`;
        return queryAll(this.conn, sql, consumerId).map((record) => ({
            event: {
                id: String(record.event_id),
                taskId: record.task_id ?? null,
                sessionId: record.session_id ?? null,
                executionId: record.execution_id ?? null,
                eventType: String(record.event_type),
                eventTier: record.event_tier,
                payloadJson: String(record.payload_json),
                traceId: record.trace_id ?? null,
                createdAt: String(record.event_created_at),
            },
            ack: {
                id: String(record.ack_id),
                eventId: String(record.event_id),
                consumerId: String(record.consumer_id),
                status: record.ack_status,
                lastAttemptAt: record.last_attempt_at ?? null,
                ackedAt: record.acked_at ?? null,
                errorCode: record.ack_error_code ?? null,
                attemptCount: Number(record.attempt_count ?? 0),
            },
        }));
    }
    listFailedEventsForConsumer(consumerId) {
        return this.listPendingEventsForConsumer(consumerId).filter((item) => item.ack.status === "failed");
    }
    resetConsumerReplayState(consumerId) {
        const result = this.conn
            .prepare(`UPDATE event_consumer_acks
         SET status = 'pending',
             last_attempt_at = NULL,
             acked_at = NULL,
             error_code = NULL,
             attempt_count = 0
         WHERE consumer_id = ?
           AND status IN ('acked', 'failed', 'dead_lettered')`)
            .run(consumerId);
        return Number(result.changes ?? 0);
    }
    listEventsForTask(taskId, tenantIdOrLimit) {
        if (typeof tenantIdOrLimit === "number") {
            return queryAll(this.conn, `SELECT ${EVENT_COLS}
         FROM events
         WHERE task_id = ?
         ORDER BY created_at DESC
         LIMIT ?`, taskId, tenantIdOrLimit);
        }
        const scopedTenantId = resolveTenantScope(tenantIdOrLimit);
        if (scopedTenantId !== undefined) {
            return queryAll(this.conn, `SELECT ${EVENT_COLS_PREFIXED}
         FROM events e
         INNER JOIN tasks t ON t.id = e.task_id
         WHERE e.task_id = ?
           AND t.tenant_id = ?
         ORDER BY e.created_at ASC`, taskId, scopedTenantId);
        }
        return queryAll(this.conn, `SELECT ${EVENT_COLS}
       FROM events
       WHERE task_id = ?
       ORDER BY created_at ASC`, taskId);
    }
    getEvent(eventId) {
        return queryOne(this.conn, `SELECT ${EVENT_COLS}
       FROM events
       WHERE id = ?`, eventId);
    }
    listDispatchDecisionTracesByTask(taskId, tenantId) {
        return this.listEventsForTask(taskId, tenantId)
            .filter((event) => event.eventType === "dispatch:decision_recorded")
            .flatMap((event) => {
            const parsed = parseDispatchDecisionTrace(event.payloadJson);
            return parsed ? [parsed] : [];
        });
    }
    listDispatchDecisionTracesByExecution(executionId) {
        const execution = queryOne(this.conn, `SELECT task_id AS taskId
       FROM executions
       WHERE id = ?`, executionId);
        if (!execution) {
            return [];
        }
        return this.listDispatchDecisionTracesByTask(execution.taskId).filter((decision) => decision.executionId === executionId);
    }
    listTier1EventRegistryCoverage() {
        return queryAll(this.conn, `SELECT
        e.id AS event_id,
        e.event_type AS event_type,
        group_concat(a.consumer_id, ',') AS ack_consumers
       FROM events e
       LEFT JOIN event_consumer_acks a ON a.event_id = e.id
       WHERE e.event_tier = 'tier_1'
       GROUP BY e.id, e.event_type
       ORDER BY e.created_at ASC`).map((record) => ({
            eventId: String(record.event_id),
            eventType: String(record.event_type),
            ackConsumers: String(record.ack_consumers ?? "")
                .split(",")
                .filter(Boolean)
                .sort(),
        }));
    }
    getTier1AuditIntegrityReport() {
        try {
            this.bootstrapTier1AuditIntegrityRecords();
            const rows = queryAll(this.conn, `SELECT
          i.event_id AS eventId,
          i.chain_position AS chainPosition,
          i.event_type AS eventType,
          i.event_created_at AS eventCreatedAt,
          i.event_checksum AS eventChecksum,
          i.previous_chain_hash AS previousChainHash,
          i.chain_hash AS chainHash,
          i.recorded_at AS recordedAt,
          e.event_type AS currentEventType,
          e.task_id AS taskId,
          e.session_id AS sessionId,
          e.execution_id AS executionId,
          e.event_tier AS eventTier,
          e.payload_json AS payloadJson,
          e.trace_id AS traceId,
          e.created_at AS createdAt
         FROM event_integrity_records i
         LEFT JOIN events e ON e.id = i.event_id
         ORDER BY i.chain_position ASC`);
            return verifyTier1AuditIntegrity(rows.map((row) => ({
                integrityRecord: {
                    eventId: row.eventId,
                    chainPosition: row.chainPosition,
                    eventType: row.eventType,
                    eventCreatedAt: row.eventCreatedAt,
                    eventChecksum: row.eventChecksum,
                    previousChainHash: row.previousChainHash,
                    chainHash: row.chainHash,
                    recordedAt: row.recordedAt,
                },
                event: row.payloadJson == null || row.eventTier == null || row.createdAt == null || row.currentEventType == null
                    ? null
                    : {
                        id: row.eventId,
                        taskId: row.taskId,
                        sessionId: row.sessionId,
                        executionId: row.executionId,
                        eventType: row.currentEventType,
                        eventTier: row.eventTier,
                        payloadJson: row.payloadJson,
                        traceId: row.traceId,
                        createdAt: row.createdAt,
                    },
            })));
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {
                checked: false,
                totalTrackedEvents: 0,
                verifiedEvents: 0,
                compromisedEvents: 0,
                missingEvents: 0,
                chainBreaks: 0,
                latestChainHash: null,
                compromisedEventIds: [],
                missingEventIds: [],
                findings: [`audit_integrity_unavailable:${message}`],
            };
        }
    }
    bootstrapTier1AuditIntegrityRecords() {
        const pendingEvents = queryAll(this.conn, `SELECT ${EVENT_COLS_PREFIXED}
       FROM events e
       LEFT JOIN event_integrity_records i ON i.event_id = e.id
       WHERE e.event_tier = 'tier_1'
         AND i.event_id IS NULL
       ORDER BY e.created_at ASC, e.id ASC`);
        if (pendingEvents.length === 0) {
            return;
        }
        const latestRecord = queryOne(this.conn, `SELECT
        chain_position AS chainPosition,
        chain_hash AS chainHash
       FROM event_integrity_records
       ORDER BY chain_position DESC
       LIMIT 1`);
        let chainPosition = Number(latestRecord?.chainPosition ?? 0);
        let previousChainHash = latestRecord?.chainHash ?? null;
        const insertIntegrityRecord = this.conn.prepare(`INSERT INTO event_integrity_records (
        event_id, chain_position, event_type, event_created_at,
        event_checksum, previous_chain_hash, chain_hash, recorded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
        for (const event of pendingEvents) {
            const eventChecksum = computeTier1AuditEventChecksum(event);
            chainPosition += 1;
            const chainHash = computeTier1AuditChainHash({
                chainPosition,
                previousChainHash,
                eventChecksum,
                eventId: event.id,
            });
            insertIntegrityRecord.run(event.id, chainPosition, event.eventType, event.createdAt, eventChecksum, previousChainHash, chainHash, nowIso());
            previousChainHash = chainHash;
        }
    }
    listPendingTier1Acks(createdBefore) {
        return queryAll(this.conn, `SELECT
        e.id AS event_id,
        e.task_id AS task_id,
        e.event_type AS event_type,
        e.created_at AS event_created_at,
        a.consumer_id AS consumer_id
       FROM events e
       JOIN event_consumer_acks a ON a.event_id = e.id
       WHERE e.event_tier = 'tier_1'
         AND a.status IN ('pending', 'failed')
         AND e.created_at < ?`, createdBefore).map((record) => ({
            eventId: String(record.event_id),
            taskId: record.task_id ?? null,
            consumerId: String(record.consumer_id),
            eventType: String(record.event_type),
            eventCreatedAt: String(record.event_created_at),
        }));
    }
    countPendingTier1Acks() {
        const result = queryOne(this.conn, `SELECT COUNT(*) AS count
       FROM events e
       JOIN event_consumer_acks a ON a.event_id = e.id
       WHERE e.event_tier = 'tier_1'
         AND a.status = 'pending'`);
        return Number(result?.count ?? 0);
    }
    countFailedTier1Acks() {
        const result = queryOne(this.conn, `SELECT COUNT(*) AS count
       FROM events e
       JOIN event_consumer_acks a ON a.event_id = e.id
       WHERE e.event_tier = 'tier_1'
         AND a.status = 'failed'`);
        return Number(result?.count ?? 0);
    }
    createTier1StatusEvent(input) {
        const eventRecord = this.insertEvent({
            id: newId("evt"),
            taskId: input.taskId,
            sessionId: null,
            executionId: input.executionId,
            eventType: input.eventType,
            eventTier: "tier_1",
            payloadJson: JSON.stringify(input.payload),
            traceId: input.traceId,
            createdAt: nowIso(),
        });
        // Also write to outbox for reliable async delivery
        // This ensures tier-1 events are delivered via the outbox pattern
        const outboxId = newId("outbox");
        const outboxPayload = {
            eventId: eventRecord.id,
            eventType: input.eventType,
            taskId: input.taskId,
            executionId: input.executionId,
            payload: input.payload,
        };
        this.conn
            .prepare(`INSERT INTO outbox (
          id, aggregate_type, aggregate_id, event_type,
          payload_json, trace_id, created_at, published_at, retry_count, last_error, last_attempt_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0, NULL, NULL)`)
            .run(outboxId, "task", input.taskId, input.eventType, JSON.stringify(outboxPayload), input.traceId, eventRecord.createdAt);
        return eventRecord;
    }
}
//# sourceMappingURL=event-repository.js.map