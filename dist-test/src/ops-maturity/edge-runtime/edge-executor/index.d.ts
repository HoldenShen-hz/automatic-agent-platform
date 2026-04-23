export interface OfflineExecutionRecord {
    readonly edgeNodeId: string;
    readonly taskId: string;
    readonly createdAt: string;
    readonly syncRequired: boolean;
    readonly status: "queued" | "running" | "completed";
    readonly completedAt?: string;
}
export declare function buildOfflineExecutionRecord(edgeNodeId: string, taskId: string, createdAt: string): OfflineExecutionRecord;
export declare function completeOfflineExecution(record: OfflineExecutionRecord, completedAt: string): OfflineExecutionRecord;
