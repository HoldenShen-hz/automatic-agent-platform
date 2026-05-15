import type {
  ApprovalStatus,
  ExecutionStatus,
  SessionStatus,
  TaskStatus,
  TaskTerminalStatus,
  WorkflowStatus,
} from "../../contracts/types/status.js";
import type { TransitionAuditContext } from "../../contracts/types/domain.js";
import { StateTransitionMachine } from "./state-transition-machine.js";

const TASK_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  queued: ["pending", "in_progress", "cancelled"],
  pending: ["in_progress", "cancelled"],
  in_progress: ["awaiting_decision", "done", "failed", "cancelled"],
  awaiting_decision: ["in_progress", "failed", "cancelled"],
  done: [],
  failed: [],
  cancelled: [],
};

const WORKFLOW_TRANSITIONS: Record<WorkflowStatus, readonly WorkflowStatus[]> = {
  running: ["paused", "completed", "failed", "cancelling", "cancelled"],
  paused: ["resuming", "failed", "cancelled"],
  resuming: ["running", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelling: ["cancelled"],
  cancelled: [],
};

const SESSION_TRANSITIONS: Record<SessionStatus, readonly SessionStatus[]> = {
  open: ["streaming", "awaiting_user", "completed", "failed", "cancelled"],
  streaming: ["awaiting_user", "completed", "failed", "cancelled", "open"],
  awaiting_user: ["streaming", "completed", "failed", "cancelled"],
  paused: ["streaming", "completed", "failed", "cancelled", "open"],
  completed: [],
  failed: [],
  cancelled: [],
};

const EXECUTION_TRANSITIONS: Record<ExecutionStatus, readonly ExecutionStatus[]> = {
  created: ["prechecking", "executing", "cancelled", "failed"],
  prechecking: ["executing", "blocked", "cancelled", "failed"],
  ready: ["queued", "cancelled", "failed"],
  queued: ["dispatching", "cancelled", "failed"],
  dispatching: ["executing", "cancelled", "failed"],
  executing: ["blocked", "succeeded", "failed", "cancelled"],
  blocked: ["prechecking", "executing", "cancelled", "failed", "superseded"],
  paused: ["resuming", "executing", "cancelled", "failed"],
  resuming: ["executing", "cancelled", "failed"],
  recovering: ["executing", "cancelled", "failed", "timed_out"],
  timed_out: ["executing", "cancelled", "failed"],
  succeeded: [],
  failed: [],
  cancelled: [],
  superseded: [],
};

const APPROVAL_TRANSITIONS: Record<ApprovalStatus, readonly ApprovalStatus[]> = {
  requested: ["approved", "rejected", "expired", "cancelled"],
  approved: [],
  rejected: [],
  expired: [],
  cancelled: [],
};

export const taskStateMachine = new StateTransitionMachine("task", TASK_TRANSITIONS);
export const workflowStateMachine = new StateTransitionMachine("workflow", WORKFLOW_TRANSITIONS);
export const sessionStateMachine = new StateTransitionMachine("session", SESSION_TRANSITIONS);
export const executionStateMachine = new StateTransitionMachine("execution", EXECUTION_TRANSITIONS);
export const approvalStateMachine = new StateTransitionMachine("approval", APPROVAL_TRANSITIONS);

export interface BlockedApprovalRequestDefinition {
  approvalId?: string | undefined;
  sourceAgentId: string;
  reason: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  options: readonly string[];
  context: Record<string, unknown>;
  timeoutPolicy: "reject" | "approve" | "remain_pending";
  createdAt?: string | undefined;
}

export interface BlockedForApprovalTransitionCommand {
  taskId: string;
  sessionId: string;
  executionId: string;
  currentTaskStatus: TaskStatus;
  currentWorkflowStatus: WorkflowStatus;
  currentSessionStatus: SessionStatus;
  currentExecutionStatus: ExecutionStatus;
  workflowCurrentStepIndex: number;
  workflowOutputsJson: string;
  approval: BlockedApprovalRequestDefinition;
  context: TransitionAuditContext;
}

export interface BlockedForApprovalTransitionResult {
  approvalId: string;
  createdAt: string;
}

export type TaskTerminalTransitionInput = {
  taskId: string;
  sessionId: string;
  executionId: string;
  currentTaskStatus: TaskStatus;
  currentWorkflowStatus: WorkflowStatus;
  currentSessionStatus: SessionStatus;
  currentExecutionStatus: ExecutionStatus;
  terminalStatus: TaskTerminalStatus;
  taskOutputJson: string;
  outputsJson: string;
  context: TransitionAuditContext;
  expectedTaskUpdatedAt?: string;
  expectedWorkflowStepIndex?: number;
  expectedSessionUpdatedAt?: string;
  expectedExecutionUpdatedAt?: string;
};
