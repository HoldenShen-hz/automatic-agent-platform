/**
 * SessionRepository - Data access for sessions and messages.
 *
 * This repository handles:
 * - SessionRecord (sessions table)
 * - MessageRecord (messages table)
 * - GatewayTargetRecord (gateway_targets table)
 *
 * All SQL queries use proper column aliasing to match camelCase domain types.
 */
import type { CompactionRecord, GatewayTargetRecord, MessageRecord, SessionEventRecord, SessionRecord, SessionSummaryRecord } from "../../../../contracts/types/domain.js";
import { SessionDualStorageService } from "../../session-dual-storage.js";
import type { SqliteConnection } from "../query-helper.js";
import { type GatewaySessionTargetCandidate } from "../authoritative-task-store-types.js";
export declare class SessionRepository {
    private readonly conn;
    private readonly dualStorage;
    constructor(conn: SqliteConnection, dualStorage?: SessionDualStorageService | null);
    insertSession(session: SessionRecord): void;
    getSession(sessionId: string): SessionRecord | undefined;
    listSessionsByTask(taskId: string): SessionRecord[];
    updateSessionStatus(sessionId: string, status: string, updatedAt: string): void;
    /**
     * Updates session status with CAS (Compare-And-Swap) semantics.
     * Only updates if the current status matches the expected status.
     * @returns Number of rows affected (1 if successful, 0 if CAS failed)
     */
    updateSessionStatusCas(sessionId: string, expectedStatus: string, status: string, updatedAt: string): number;
    insertCompactionRecord(record: CompactionRecord): void;
    insertMessage(message: MessageRecord): void;
    listMessagesBySession(sessionId: string, limit?: number): MessageRecord[];
    insertSessionSummary(summary: SessionSummaryRecord): void;
    getLatestSessionSummary(sessionId: string): SessionSummaryRecord | null;
    insertSessionEvent(record: SessionEventRecord): void;
    listSessionEvents(sessionId: string, limit?: number): SessionEventRecord[];
    upsertGatewayTarget(target: GatewayTargetRecord): void;
    getGatewayTarget(targetId: string): GatewayTargetRecord | undefined;
    listGatewayTargetsByChannel(channel: string): GatewayTargetRecord[];
    listGatewaySessionTargetCandidates(limit?: number, channel?: string, tenantId?: string | null): GatewaySessionTargetCandidate[];
    listCompactionRecordsBySession(sessionId: string, tenantId?: string | null): CompactionRecord[];
    private recordDualStorage;
}
