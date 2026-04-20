export interface OfflineExecutionRecord {
  readonly edgeNodeId: string;
  readonly taskId: string;
  readonly createdAt: string;
  readonly syncRequired: boolean;
}

export function buildOfflineExecutionRecord(edgeNodeId: string, taskId: string, createdAt: string): OfflineExecutionRecord {
  return { edgeNodeId, taskId, createdAt, syncRequired: true };
}
