import type { ApprovalDecision, ApprovalRequest } from "./approval-service.js";
import type {
  ApproverRule,
  Delegation,
  EscalationReason,
  EscalationRule,
  NotificationChannel,
} from "./escalation-manager.js";
import type { QuorumConfig, QuorumStatus, QuorumVote } from "./quorum-calculator.js";

export enum FlowType {
  SINGLE = "single",
  MULTI_PARTY = "multi_party",
  DELEGATED = "delegated",
  SEQUENTIAL_CHAIN = "sequential_chain",
}

export enum FlowStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  EXPIRED = "expired",
  ESCALATED = "escalated",
  MAX_ITERATIONS_REACHED = "max_iterations_reached",
  CANCELLED = "cancelled",
}

export interface ApprovalTimeoutConfig {
  warnAfterMs: number;
  escalateAfterMs: number;
  autoActionAfterMs: number;
  autoAction: "approve" | "deny" | "escalate";
}

export interface FeedbackLoopConfig {
  maxIterations: number;
  requireReplanOnReject: boolean;
}

export interface ApprovalFlowConfig {
  flowId: string;
  flowType: FlowType;
  approvers: ApproverRule[];
  quorum?: QuorumConfig;
  timeout: ApprovalTimeoutConfig;
  escalation: EscalationRule;
  feedbackLoop?: FeedbackLoopConfig;
  notificationChannels?: NotificationChannel[];
}

export interface HumanFeedback {
  iteration: number;
  feedbackType: "approve" | "reject_with_guidance" | "modify_directly";
  guidance?: string;
  modifiedArtifactRef?: string;
  timestamp: string;
  principal: string;
}

export interface FeedbackLoop {
  loopId: string;
  harnessRunId: string;
  nodeRunId: string;
  /** @deprecated legacy workflow projection identifier; use harnessRunId */
  workflowRunId: string;
  /** @deprecated legacy step projection identifier; use nodeRunId */
  stepId: string;
  maxIterations: number;
  currentIteration: number;
  humanFeedback: HumanFeedback[];
}

export interface FlowEscalationLevel {
  level: number;
  escalateTo: ApproverRule;
  escalatedAt: string;
  escalatedBy: string;
  reason: EscalationReason;
  sourceApprovalId: string;
}

export interface ApprovalFlowState {
  flowId: string;
  config: ApprovalFlowConfig;
  request: ApprovalRequest;
  status: FlowStatus;
  currentIteration: number;
  votes: QuorumVote[];
  votingStartedAt: string;
  escalationHistory: FlowEscalationLevel[];
  delegation: Delegation | null;
  feedbackLoop: FeedbackLoop | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  warningsSent: string[];
  escalationTriggered: boolean;
}

export interface VoteResult {
  success: boolean;
  quorumStatus: QuorumStatus;
  flowStatus: FlowStatus;
  error?: string;
}

export interface FeedbackResult {
  success: boolean;
  newIteration: number;
  flowStatus: FlowStatus;
  shouldReplan: boolean;
  error?: string;
}

export const DEFAULT_TIMEOUT_CONFIG: ApprovalTimeoutConfig = {
  warnAfterMs: 60 * 60 * 1000,
  escalateAfterMs: 2 * 60 * 60 * 1000,
  autoActionAfterMs: 24 * 60 * 60 * 1000,
  autoAction: "deny",
};

export const DEFAULT_ESCALATION_RULE: EscalationRule = {
  escalateTo: { type: "role", identifier: "admin", can_delegate: true },
  maxEscalationDepth: 3,
  notificationChannels: [],
  escalationTimeoutMs: 30 * 60 * 1000,
};

export const DEFAULT_FEEDBACK_LOOP_CONFIG: FeedbackLoopConfig = {
  maxIterations: 5,
  requireReplanOnReject: true,
};

export type { ApprovalDecision };
