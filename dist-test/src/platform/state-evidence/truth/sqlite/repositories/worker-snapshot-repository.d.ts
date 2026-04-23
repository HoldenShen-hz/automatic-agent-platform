import type { CoordinatorInstanceRecord, HeartbeatSnapshotRecord, WorkerSnapshotRecord } from "../../../../contracts/types/domain.js";
import { type SqliteConnection } from "../query-helper.js";
export declare class WorkerSnapshotRepository {
    private readonly conn;
    constructor(conn: SqliteConnection);
    insertHeartbeatSnapshot(snapshot: HeartbeatSnapshotRecord): void;
    upsertWorkerSnapshot(snapshot: WorkerSnapshotRecord): void;
    upsertCoordinatorInstanceSnapshot(snapshot: CoordinatorInstanceRecord): void;
    getWorkerSnapshot(workerId: string): WorkerSnapshotRecord | undefined;
    listWorkerSnapshots(status?: string, limit?: number): WorkerSnapshotRecord[];
    listStaleWorkerSnapshots(heartbeatBefore: string): WorkerSnapshotRecord[];
    getCoordinatorInstanceSnapshot(coordinatorId: string): CoordinatorInstanceRecord | undefined;
    listCoordinatorInstanceSnapshots(limit?: number): CoordinatorInstanceRecord[];
    listHeartbeatSnapshotsByExecution(executionId: string, tenantId?: string | null): HeartbeatSnapshotRecord[];
}
