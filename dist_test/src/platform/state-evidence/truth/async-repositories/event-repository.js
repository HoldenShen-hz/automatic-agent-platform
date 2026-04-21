/**
 * AsyncEventRepository - Async data access for events and acknowledgements.
 */
import { getEventTier, getRequiredConsumers } from "../../events/event-types.js";
import { newId } from "../../../contracts/types/ids.js";
import { asyncExecute, asyncQueryAll, asyncQueryOne } from "../async-query-helper.js";
import { resolveTenantScope } from "../sqlite/authoritative-task-store-types.js";
const EVENT_COLS = `id, task_id AS "taskId", session_id AS "sessionId", execution_id AS "executionId",
        event_type AS "eventType", event_tier AS "eventTier", payload_json AS "payloadJson",
        trace_id AS "traceId", created_at AS "createdAt"`;
export class AsyncEventRepository {
    conn;
    constructor(conn) {
        this.conn = conn;
    }
    async insertEvent(event) {
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
        await asyncExecute(this.conn, `INSERT INTO events (
        id, task_id, session_id, execution_id, event_type, event_tier,
        payload_json, trace_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, record.id, record.taskId, record.sessionId, record.executionId, record.eventType, record.eventTier, record.payloadJson, record.traceId, record.createdAt);
        for (const consumerId of getRequiredConsumers(record.eventType)) {
            await this.insertEventConsumerAck({
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
        return record;
    }
    async insertEventDeadLetter(record) {
        await asyncExecute(this.conn, `INSERT INTO event_dead_letters (
        id, original_event_id, event_type, payload_json, consumer_id,
        failure_count, last_error, dead_lettered_at, reprocessed_at, reprocess_result
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, record.id, record.originalEventId, record.eventType, record.payloadJson, record.consumerId, record.failureCount, record.lastError, record.deadLetteredAt, record.reprocessedAt, record.reprocessResult);
    }
    async listEventDeadLetters(limit = 100) {
        return asyncQueryAll(this.conn, `SELECT id, original_event_id AS "originalEventId", event_type AS "eventType",
        payload_json AS "payloadJson", consumer_id AS "consumerId", failure_count AS "failureCount",
        last_error AS "lastError", dead_lettered_at AS "deadLetteredAt",
        reprocessed_at AS "reprocessedAt", reprocess_result AS "reprocessResult"
       FROM event_dead_letters ORDER BY dead_lettered_at DESC LIMIT $1`, limit);
    }
    async listEventsByType(eventType, limit) {
        let sql = `SELECT ${EVENT_COLS} FROM events WHERE event_type = $1 ORDER BY created_at DESC`;
        if (limit) {
            sql += ` LIMIT $2`;
            return asyncQueryAll(this.conn, sql, eventType, limit);
        }
        return asyncQueryAll(this.conn, sql, eventType);
    }
    async insertEventConsumerAck(ack) {
        await asyncExecute(this.conn, `INSERT INTO event_consumer_acks (id, event_id, consumer_id, status, last_attempt_at, acked_at, error_code, attempt_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, ack.id, ack.eventId, ack.consumerId, ack.status, ack.lastAttemptAt, ack.ackedAt, ack.errorCode, ack.attemptCount);
    }
    async markEventAck(eventId, consumerId, status, occurredAt, errorCode) {
        await asyncExecute(this.conn, `UPDATE event_consumer_acks SET status = $1, last_attempt_at = $2, acked_at = CASE WHEN $1 = 'acked' THEN $2 ELSE acked_at END, error_code = $3, attempt_count = attempt_count + 1 WHERE event_id = $4 AND consumer_id = $5`, status, occurredAt, errorCode ?? null, eventId, consumerId);
    }
    async markEventDeadLettered(input) {
        await asyncExecute(this.conn, `UPDATE event_consumer_acks SET status = 'dead_lettered', last_attempt_at = $1, error_code = $2 WHERE event_id = $3 AND consumer_id = $4`, input.occurredAt, input.errorCode, input.eventId, input.consumerId);
    }
    async getEventConsumerAck(eventId, consumerId) {
        const result = await asyncQueryOne(this.conn, `SELECT id, event_id AS "eventId", consumer_id AS "consumerId", status, last_attempt_at AS "lastAttemptAt",
        acked_at AS "ackedAt", error_code AS "errorCode", attempt_count AS "attemptCount"
       FROM event_consumer_acks WHERE event_id = $1 AND consumer_id = $2`, eventId, consumerId);
        return result ?? null;
    }
    async getRequiredConsumerIds(eventId) {
        const rows = await asyncQueryAll(this.conn, `SELECT consumer_id AS "consumerId" FROM event_consumer_acks WHERE event_id = $1`, eventId);
        return rows.map((row) => row.consumerId);
    }
    async ackAllConsumersForEvent(eventId, occurredAt) {
        await asyncExecute(this.conn, `UPDATE event_consumer_acks SET status = 'acked', last_attempt_at = $1, acked_at = $2, error_code = NULL, attempt_count = attempt_count + 1 WHERE event_id = $3 AND status IN ('pending', 'failed')`, occurredAt, occurredAt, eventId);
    }
    async listEventsForTask(taskId, tenantIdOrLimit) {
        if (typeof tenantIdOrLimit === "number") {
            return asyncQueryAll(this.conn, `SELECT ${EVENT_COLS} FROM events WHERE task_id = $1 ORDER BY created_at DESC LIMIT $2`, taskId, tenantIdOrLimit);
        }
        const scopedTenantId = resolveTenantScope(tenantIdOrLimit);
        if (scopedTenantId !== undefined) {
            return asyncQueryAll(this.conn, `SELECT e.id, e.task_id AS "taskId", e.session_id AS "sessionId", e.execution_id AS "executionId",
          e.event_type AS "eventType", e.event_tier AS "eventTier", e.payload_json AS "payloadJson",
          e.trace_id AS "traceId", e.created_at AS "createdAt"
         FROM events e INNER JOIN tasks t ON t.id = e.task_id WHERE e.task_id = $1 AND t.tenant_id = $2 ORDER BY e.created_at ASC`, taskId, scopedTenantId);
        }
        return asyncQueryAll(this.conn, `SELECT ${EVENT_COLS} FROM events WHERE task_id = $1 ORDER BY created_at ASC`, taskId);
    }
    async getEvent(eventId) {
        const result = await asyncQueryOne(this.conn, `SELECT ${EVENT_COLS} FROM events WHERE id = $1`, eventId);
        return result ?? null;
    }
    async countPendingTier1Acks() {
        const result = await asyncQueryOne(this.conn, `SELECT COUNT(*) AS count FROM events e JOIN event_consumer_acks a ON a.event_id = e.id WHERE e.event_tier = 'tier_1' AND a.status = 'pending'`);
        return Number(result?.count ?? 0);
    }
    async countFailedTier1Acks() {
        const result = await asyncQueryOne(this.conn, `SELECT COUNT(*) AS count FROM events e JOIN event_consumer_acks a ON a.event_id = e.id WHERE e.event_tier = 'tier_1' AND a.status = 'failed'`);
        return Number(result?.count ?? 0);
    }
}
//# sourceMappingURL=event-repository.js.map