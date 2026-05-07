export interface DebugBreakpoint {
  readonly breakpointId: string;
  readonly taskId: string;
  readonly stepIndex: number;
  readonly condition: string | null;
  readonly enabled: boolean;
  readonly createdAt: string;
}

export interface DebugSnapshot {
  readonly snapshotId: string;
  readonly stepIndex: number;
  readonly workflowState: Record<string, unknown>;
}

export interface WorkflowRunRecord {
  readonly runId: string;
  readonly taskId: string;
  readonly workflowId: string;
  readonly status: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly steps: ReadonlyArray<Record<string, unknown>>;
  readonly events: ReadonlyArray<Record<string, unknown>>;
}
