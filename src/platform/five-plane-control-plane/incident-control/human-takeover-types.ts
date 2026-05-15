export interface ManualOverride {
  overrideId: string;
  taskId: string;
  executionId: string | null;
  operatorId: string;
  actionType: "input_modification" | "worker_switch" | "step_skip" | "task_complete" | "execution_retry" | "step_modification";
  reasonCode: string;
  targetStage: "observe" | "assess" | "plan" | "execute" | "feedback" | "learn" | "improve" | "release" | null;
  overridePayloadJson: string;
  feedbackSignalInjected: boolean;
  improvementCandidateCreated: boolean;
  createdAt: string;
  traceId: string | null;
}

export interface IncidentContextBundle {
  bundleId: string;
  incidentId: string | null;
  taskId: string;
  executionId: string | null;
  overrideIds: readonly string[];
  takeoverSessionIds: readonly string[];
  operatorIds: readonly string[];
  severity: "low" | "medium" | "high" | "critical";
  status: "active" | "resolved" | "cancelled";
  createdAt: string;
  resolvedAt: string | null;
  metadataJson: string | null;
}

export interface TakeoverActionResult {
  taskId: string;
  executionId: string | null;
  takeoverSessionId: string;
  operatorActionId: string;
}
