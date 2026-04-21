export interface OfflineExecutionRecord {
    readonly edgeNodeId: string;
    readonly taskId: string;
    readonly createdAt: string;
    readonly syncRequired: boolean;
}
export declare function buildOfflineExecutionRecord(edgeNodeId: string, taskId: string, createdAt: string): OfflineExecutionRecord;
