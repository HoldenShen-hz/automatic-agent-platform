/**
 * AsyncDispatchRepository - Async data access for executions, sessions, messages, and gateway targets.
 */
import type { DeadLetterRecord, ExecutionPrecheckRecord, ExecutionRecord, GatewayTargetRecord, MessageRecord, SessionRecord, WorkerSnapshotRecord } from "../../../contracts/types/domain.js";
import type { AsyncSqlConnection } from "../async-sql-database.js";
export declare class AsyncDispatchRepository {
    private readonly conn;
    constructor(conn: AsyncSqlConnection);
    listExecutionsByStatuses(statuses: ExecutionRecord["status"][]): Promise<ExecutionRecord[]>;
    getExecution(executionId: string, tenantId?: string | null): Promise<ExecutionRecord | null>;
    getExecutionPrecheck(executionId: string, tenantId?: string | null): Promise<ExecutionPrecheckRecord | null>;
    getDeadLetterByExecutionId(executionId: string, tenantId?: string | null): Promise<DeadLetterRecord | null>;
    listDeadLettersByTask(taskId: string, tenantId?: string | null): Promise<DeadLetterRecord[]>;
    getSession(sessionId: string, tenantId?: string | null): Promise<SessionRecord | null>;
    selectLatestSessionByTask(taskId: string): Promise<SessionRecord | null>;
    getGatewayTarget(targetId: string): Promise<GatewayTargetRecord | null>;
    listGatewayTargets(limit?: number, channel?: string): Promise<GatewayTargetRecord[]>;
    listMessagesBySession(sessionId: string, tenantId?: string | null): Promise<MessageRecord[]>;
    getWorkerSnapshot(workerId: string): Promise<WorkerSnapshotRecord | null>;
}
