export interface OfflineExecutionRecord {
  readonly edgeNodeId: string;
  readonly taskId: string;
  readonly createdAt: string;
  readonly syncRequired: boolean;
  readonly status: "queued" | "running" | "completed";
  readonly completedAt?: string;
}

export function buildOfflineExecutionRecord(edgeNodeId: string, taskId: string, createdAt: string): OfflineExecutionRecord {
  return { edgeNodeId, taskId, createdAt, syncRequired: true, status: "queued" };
}

export function completeOfflineExecution(record: OfflineExecutionRecord, completedAt: string): OfflineExecutionRecord {
  return {
    ...record,
    status: "completed",
    completedAt,
  };
}
