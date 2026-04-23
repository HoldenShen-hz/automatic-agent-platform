/**
 * AsyncSessionRepository - Async data access for sessions and messages.
 *
 * This is the async PostgreSQL-compatible version of SessionRepository.
 * All methods are async and use $1, $2 ... placeholders for PostgreSQL.
 */
import type { CompactionRecord, GatewayTargetRecord, MessageRecord, SessionEventRecord, SessionRecord, SessionSummaryRecord } from "../../../contracts/types/domain.js";
import type { AsyncSqlConnection } from "../async-sql-database.js";
export declare class AsyncSessionRepository {
    private readonly conn;
    constructor(conn: AsyncSqlConnection);
    insertSession(session: SessionRecord): Promise<void>;
    getSession(sessionId: string): Promise<SessionRecord | null>;
    listSessionsByTask(taskId: string): Promise<SessionRecord[]>;
    updateSessionStatus(sessionId: string, status: string, updatedAt: string): Promise<number>;
    insertCompactionRecord(record: CompactionRecord): Promise<void>;
    insertMessage(message: MessageRecord): Promise<void>;
    listMessagesBySession(sessionId: string, limit?: number): Promise<MessageRecord[]>;
    insertSessionSummary(summary: SessionSummaryRecord): Promise<void>;
    getLatestSessionSummary(sessionId: string): Promise<SessionSummaryRecord | null>;
    insertSessionEvent(record: SessionEventRecord): Promise<void>;
    listSessionEvents(sessionId: string, limit?: number): Promise<SessionEventRecord[]>;
    upsertGatewayTarget(target: GatewayTargetRecord): Promise<void>;
    getGatewayTarget(targetId: string): Promise<GatewayTargetRecord | null>;
    listGatewayTargetsByChannel(channel: string): Promise<GatewayTargetRecord[]>;
    listCompactionRecordsBySession(sessionId: string, tenantId?: string | null): Promise<CompactionRecord[]>;
}
