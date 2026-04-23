/**
 * DispatchRepository - Data access for executions, sessions, messages, and gateway targets.
 *
 * This repository handles all data access for:
 * - ExecutionRecord (executions table)
 * - ExecutionPrecheckRecord (execution_prechecks table)
 * - DeadLetterRecord (dead_letters table)
 * - SessionRecord (sessions table)
 * - MessageRecord (messages table)
 * - GatewayTargetRecord (gateway_targets table)
 * - WorkerSnapshotRecord (worker_snapshots table)
 *
 * All SQL queries use proper column aliasing to match the camelCase domain types.
 */
import type { ExecutionRecord, ExecutionPrecheckRecord, DeadLetterRecord, SessionRecord, MessageRecord, GatewayTargetRecord, WorkerSnapshotRecord } from "../../../../contracts/types/domain.js";
import type { SqliteConnection } from "../query-helper.js";
export declare class DispatchRepository {
    private readonly conn;
    constructor(conn: SqliteConnection);
    /** List executions by status filter. */
    listExecutionsByStatuses(statuses: ExecutionRecord["status"][]): ExecutionRecord[];
    /** Get an execution by ID with optional tenant scoping. */
    getExecution(executionId: string, tenantId?: string | null): ExecutionRecord | null;
    /** Get an execution precheck by execution ID. */
    getExecutionPrecheck(executionId: string, tenantId?: string | null): ExecutionPrecheckRecord | null;
    /** Get a dead letter record by execution ID. */
    getDeadLetterByExecutionId(executionId: string, tenantId?: string | null): DeadLetterRecord | null;
    /** List dead letters for a task. */
    listDeadLettersByTask(taskId: string, tenantId?: string | null): DeadLetterRecord[];
    /** Get a session by ID. */
    getSession(sessionId: string, tenantId?: string | null): SessionRecord | null;
    /** Get the latest session for a task. */
    selectLatestSessionByTask(taskId: string): SessionRecord | null;
    /** Get a gateway target by ID. */
    getGatewayTarget(targetId: string): GatewayTargetRecord | null;
    /** List gateway targets with optional channel filter. */
    listGatewayTargets(limit?: number, channel?: string): GatewayTargetRecord[];
    /** List messages for a session. */
    listMessagesBySession(sessionId: string, tenantId?: string | null): MessageRecord[];
    /** Get a worker snapshot by worker ID. */
    getWorkerSnapshot(workerId: string): WorkerSnapshotRecord | null;
}
