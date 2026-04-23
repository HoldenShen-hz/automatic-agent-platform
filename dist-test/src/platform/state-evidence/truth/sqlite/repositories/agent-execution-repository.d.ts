import type { AgentExecutionRecord, RemoteLogRecord } from "../../../../contracts/types/domain.js";
import { type SqliteConnection } from "../query-helper.js";
export declare class AgentExecutionRepository {
    private readonly conn;
    constructor(conn: SqliteConnection);
    insertRemoteLog(record: RemoteLogRecord): void;
    upsertAgentExecutionRecord(record: AgentExecutionRecord): void;
    getAgentExecutionRecord(executionId: string, tenantId?: string | null): AgentExecutionRecord | undefined;
    listAgentExecutionRecordsByTask(taskId: string, tenantId?: string | null): AgentExecutionRecord[];
    listRemoteLogsByTask(taskId: string, tenantId?: string | null): RemoteLogRecord[];
    listRemoteLogsByExecution(executionId: string, tenantId?: string | null): RemoteLogRecord[];
}
