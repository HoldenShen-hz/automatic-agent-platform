/**
 * @fileoverview Approval Service - Manages human-in-the-loop (HITL) approval requests
 *
 * ## Overview
 *
 * Handles the approval workflow for operations requiring human authorization
 * before proceeding. When an agent encounters high-risk or ambiguous decisions,
 * it requests approval from a human operator.
 *
 * ## Key Concepts
 *
 * - **HITL (Human In The Loop)**: Decision step requiring human explicit participation
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: HITL}
 *
 * - **Break-glass**: High-risk emergency pass-through with strong audit
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: break-glass}
 *
 * ## Approval Flow
 *
 * 1. Agent creates ApprovalRequest with options and context
 * 2. Request persisted, event emitted for external notification
 * 3. Human operator responds with ApprovalDecision
 * 4. Decision validated, persisted, event emitted
 *
 * ## Timeout Policies
 *
 * - "reject": Auto-reject if timeout expires
 * - "approve": Auto-approve if timeout expires
 * - "remain_pending": Leave pending until explicit response
 *
 * @see HITL Contract: docs_zh/contracts/hitl_experience_and_explainability_contract.md
 * @see Glossary: docs_zh/governance/glossary_and_terminology.md
 *
 * @packageDocumentation
 */

import { AuthoritativeTaskStore } from "../../five-plane-state-evidence/truth/authoritative-task-store.js";
import type { ApprovalRecord } from "../../contracts/types/domain.js";
import type { AuthoritativeSqlDatabase } from "../../five-plane-state-evidence/truth/authoritative-sql-database.js";
import {
  createRuntimeLifecycleRepository,
  type RuntimeLifecycleRepository,
} from "../../five-plane-state-evidence/truth/repositories/runtime-lifecycle-repository.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import { TransitionService } from "../../five-plane-execution/state-transition/transition-service.js";
import { ValidationError } from "../../contracts/errors.js";
import {
  type ControlPlaneDirectiveSink,
  createNoOpDirectiveSink,
} from "../control-plane-directive-sink.js";
import { createDecisionDirective, type DecisionDirective } from "../../contracts/control-directive/index.js";

/**
 * Represents a request for human approval before proceeding.
 *
 * Contains the context for the decision, available options, risk assessment,
 * and a timeout policy that determines behavior on expiration.
 */
export interface ApprovalRequest {
  approvalId: string;
  status?: "pending";
  taskId: string;
  executionId?: string | null;
  harnessRunId?: string;
  nodeRunId?: string | null;
  sourceAgentId: string;
  reason: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  stageViewRef?: ApprovalStageViewRef | null;
  options: readonly string[];
  context: Record<string, unknown>;
  timeoutPolicy: "reject" | "approve" | "remain_pending";
  timeoutAutoAction?: ApprovalTimeoutAutoAction;
  escalationChain?: readonly ApprovalEscalationHop[];
  harness_run_id?: string;
  node_run_id?: string | null;
  stage_view_ref?: ApprovalStageViewRef | null;
  timeout_auto_action?: ApprovalTimeoutAutoAction;
  escalation_chain?: readonly ApprovalEscalationHop[];
  createdAt: string;
  /** Number of approvals required for multi-party approval (N-of-M). Default: 1 */
  requiredApprovals?: number;
  /** Groups from which approvers can be selected. Empty means any approver. */
  approverGroups?: readonly string[];
  /** Current count of approvals received */
  approvalsReceived?: number;
}

export type ApprovalStageViewRef =
  | "observe"
  | "assess"
  | "plan"
  | "execute"
  | "feedback"
  | "learn"
  | "improve"
  | "release";

export type ApprovalTimeoutAutoAction = "reject" | "escalate" | "remain_pending" | "continue_readonly";

export interface ApprovalEscalationHop {
  level: number;
  reviewerType: string;
  reviewerRef: string;
  timeoutMs: number;
  onTimeout: ApprovalTimeoutAutoAction;
}

export interface ApprovalDecision {
  /** The approval request this decision responds to */
  approvalId: string;
  /** Type of decision made */
  decisionType: "option_selected" | "confirmed" | "text_input" | "rejected" | "expired";
  /** For option_selected: which option was chosen */
  selectedOptionId?: string;
  /** For confirmed: must be exactly true */
  confirmed?: true;
  /** For text_input: the text response provided */
  inputText?: string;
  /** Identifier of who responded (user ID, agent ID, or "system") */
  respondedBy: string;
  /** ISO timestamp when decision was made */
  respondedAt: string;
}

export interface LegacyApprovalResolutionInput {
  approvalId: string;
  decision: "approve" | "approved" | "reject" | "rejected";
  resolvedBy: string;
  resolutionReason?: string;
}

export interface LegacyApprovalView {
  approvalId: string;
  status: "pending" | "approved" | "rejected" | "expired" | "cancelled";
  resolvedBy: string | null;
  resolutionReason: string | null;
  request: ApprovalRequest;
  response: ApprovalDecision | null;
}

interface CascadeDecisionPayload extends ApprovalDecision {
  cascadeDeny?: true;
  cascadeSourceApprovalId?: string;
  cascadeSessionId?: string;
}

/**
 * Validates that an approval decision has the correct payload for its type.
 *
 * Each decision type has different required fields:
 * - option_selected: requires selectedOptionId
 * - confirmed: requires confirmed === true
 * - text_input: requires inputText
 * - rejected/expired: require no additional payload
 *
 * @param decision - The decision to validate
 * @throws Error if decision payload is invalid for its type
 */
export function validateApprovalDecision(decision: ApprovalDecision): void {
  switch (decision.decisionType) {
    case "option_selected":
      if (!decision.selectedOptionId || decision.confirmed || decision.inputText) {
        throw new ValidationError("approval.invalid_option_selected", "Option selected decision must have selectedOptionId and no confirmed or inputText", {
          details: { decisionType: decision.decisionType, selectedOptionId: decision.selectedOptionId, confirmed: decision.confirmed, inputText: decision.inputText },
        });
      }
      return;
    case "confirmed":
      if (decision.confirmed !== true || decision.selectedOptionId || decision.inputText) {
        throw new ValidationError("approval.invalid_confirmed", "Confirmed decision must have confirmed=true and no selectedOptionId or inputText", {
          details: { decisionType: decision.decisionType, confirmed: decision.confirmed, selectedOptionId: decision.selectedOptionId, inputText: decision.inputText },
        });
      }
      return;
    case "text_input":
      if (!decision.inputText || decision.selectedOptionId || decision.confirmed) {
        throw new ValidationError("approval.invalid_text_input", "Text input decision must have inputText and no selectedOptionId or confirmed", {
          details: { decisionType: decision.decisionType, inputText: decision.inputText, selectedOptionId: decision.selectedOptionId, confirmed: decision.confirmed },
        });
      }
      return;
    case "rejected":
    case "expired":
      if (decision.selectedOptionId || decision.confirmed || decision.inputText) {
        throw new ValidationError("approval.invalid_terminal_payload", "Terminal decision must not have selectedOptionId, confirmed, or inputText", {
          details: { decisionType: decision.decisionType, selectedOptionId: decision.selectedOptionId, confirmed: decision.confirmed, inputText: decision.inputText },
        });
      }
      return;
  }
}

function parseApprovalRequest(requestJson: string): ApprovalRequest {
  return JSON.parse(requestJson) as ApprovalRequest;
}

function readCascadeSessionId(request: ApprovalRequest): string | null {
  const context = request.context ?? {};
  const sessionId =
    context.sessionId ??
    context.approvalSessionId ??
    context.permissionSessionId;
  return typeof sessionId === "string" && sessionId.trim().length > 0 ? sessionId : null;
}

function readStringContextField(
  context: Record<string, unknown> | null | undefined,
  ...keys: readonly string[]
): string | null {
  if (context == null) {
    return null;
  }
  for (const key of keys) {
    const value = context[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return null;
}

function isApprovalStageViewRef(value: unknown): value is ApprovalStageViewRef {
  return value === "observe"
    || value === "assess"
    || value === "plan"
    || value === "execute"
    || value === "feedback"
    || value === "learn"
    || value === "improve"
    || value === "release";
}

function readStageViewRef(input: Partial<ApprovalRequest>): ApprovalStageViewRef | null | undefined {
  const candidate = input.stageViewRef ?? input.stage_view_ref ?? input.context?.stageViewRef ?? input.context?.stage_view_ref;
  return isApprovalStageViewRef(candidate) ? candidate : null;
}

function readEscalationChain(input: Partial<ApprovalRequest>): readonly ApprovalEscalationHop[] {
  const candidate = input.escalationChain ?? input.escalation_chain ?? input.context?.escalationChain ?? input.context?.escalation_chain;
  if (!Array.isArray(candidate)) {
    return [];
  }
  return candidate.flatMap((hop, index) => {
    if (typeof hop !== "object" || hop == null) {
      return [];
    }
    const record = hop as Record<string, unknown>;
    const reviewerType = typeof record.reviewerType === "string"
      ? record.reviewerType
      : typeof record.reviewer_type === "string"
      ? record.reviewer_type
      : null;
    const reviewerRef = typeof record.reviewerRef === "string"
      ? record.reviewerRef
      : typeof record.reviewer_ref === "string"
      ? record.reviewer_ref
      : null;
    const timeoutMs = typeof record.timeoutMs === "number"
      ? record.timeoutMs
      : typeof record.timeout_ms === "number"
      ? record.timeout_ms
      : null;
    const onTimeout = record.onTimeout ?? record.on_timeout;
    if (
      reviewerType == null
      || reviewerRef == null
      || timeoutMs == null
      || !Number.isFinite(timeoutMs)
      || (
        onTimeout !== "reject"
        && onTimeout !== "escalate"
        && onTimeout !== "remain_pending"
        && onTimeout !== "continue_readonly"
      )
    ) {
      return [];
    }
    return [{
      level: typeof record.level === "number" ? record.level : index + 1,
      reviewerType,
      reviewerRef,
      timeoutMs,
      onTimeout,
    }];
  });
}

function toTimeoutAutoAction(timeoutPolicy: ApprovalRequest["timeoutPolicy"]): ApprovalTimeoutAutoAction {
  switch (timeoutPolicy) {
    case "reject":
      return "reject";
    case "approve":
      return "continue_readonly";
    case "remain_pending":
      return "remain_pending";
  }
}

function deriveDefaultHarnessRunId(input: Pick<ApprovalRequest, "taskId" | "executionId">): string {
  return input.executionId != null && input.executionId.trim().length > 0
    ? `harness_run:${input.executionId}`
    : `harness_run:task:${input.taskId}`;
}

/**
 * Service for managing approval requests and decisions.
 *
 * Handles the complete approval lifecycle:
 * 1. Creation: Agents request approval with context and options
 * 2. Storage: Requests are persisted with timeout policies
 * 3. Events: Notifications are emitted for external handling
 * 4. Decisions: Human responses are validated and applied
 * 5. Updates: Approval status transitions are recorded
 *
 * This service is transactional - request creation and decision application
 * are atomic, ensuring consistent state in the database.
 */
export class ApprovalService {
  private readonly transitions: TransitionService;
  private readonly repository: RuntimeLifecycleRepository;
  private readonly directiveSink: ControlPlaneDirectiveSink;

  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    private readonly store: AuthoritativeTaskStore,
    repository: RuntimeLifecycleRepository = createRuntimeLifecycleRepository(store),
    directiveSink: ControlPlaneDirectiveSink = createNoOpDirectiveSink(),
  ) {
    this.repository = repository;
    this.transitions = new TransitionService(db, store, repository);
    this.directiveSink = directiveSink;
  }

  /**
   * Creates a new approval request.
   *
   * The request is persisted to the database and an event is emitted
   * for external notification systems (webhooks, push notifications, etc).
   *
   * @param input - Request details excluding auto-generated fields
   * @returns The created approval request with generated ID and timestamp
   */
  public createRequest(input: Omit<ApprovalRequest, "approvalId" | "createdAt">): ApprovalRequest {
    const contextApproverGroups = Array.isArray(input.context.approverGroups)
      ? input.context.approverGroups.filter((group): group is string => typeof group === "string")
      : [];
    const harnessRunId =
      input.harnessRunId
      ?? input.harness_run_id
      ?? readStringContextField(input.context, "harnessRunId", "harness_run_id")
      ?? deriveDefaultHarnessRunId(input);
    const nodeRunId =
      input.nodeRunId
      ?? input.node_run_id
      ?? readStringContextField(input.context, "nodeRunId", "node_run_id");
    const stageViewRef = readStageViewRef(input);
    const timeoutAutoAction = input.timeoutAutoAction ?? input.timeout_auto_action ?? toTimeoutAutoAction(input.timeoutPolicy);
    const escalationChain = readEscalationChain(input);
    const approval: ApprovalRequest = {
      approvalId: newId("approval"),
      status: "pending",
      createdAt: nowIso(),
      ...input,
      executionId: input.executionId ?? null,
      harnessRunId,
      nodeRunId: nodeRunId ?? null,
      ...(stageViewRef !== undefined && { stageViewRef }),
      timeoutAutoAction,
      escalationChain,
      harness_run_id: harnessRunId,
      node_run_id: nodeRunId ?? null,
      ...(stageViewRef !== undefined && { stage_view_ref: stageViewRef }),
      timeout_auto_action: timeoutAutoAction,
      escalation_chain: escalationChain,
      approverGroups: input.approverGroups ?? contextApproverGroups,
    };

    this.db.transaction(() => {
      this.repository.insertApproval({
        id: approval.approvalId,
        taskId: approval.taskId,
        executionId: approval.executionId ?? null,
        status: "requested",
        requestJson: JSON.stringify(approval),
        responseJson: null,
        timeoutPolicy: approval.timeoutPolicy,
        createdAt: approval.createdAt,
        respondedAt: null,
      });
      this.repository.insertEvent({
        id: newId("evt"),
        taskId: approval.taskId,
        executionId: approval.executionId ?? null,
        eventType: "decision:requested",
        eventTier: "tier_1",
        payloadJson: JSON.stringify(approval),
        traceId: null,
        createdAt: approval.createdAt,
      });
    });

    return approval;
  }

  public getApproval(approvalId: string): LegacyApprovalView | null {
    const record = this.repository.getApproval(approvalId);
    return record == null ? null : toLegacyApprovalView(record);
  }

  public resolve(input: LegacyApprovalResolutionInput): LegacyApprovalView {
    const decision: ApprovalDecision = input.decision === "approve" || input.decision === "approved"
      ? {
          approvalId: input.approvalId,
          decisionType: "confirmed",
          confirmed: true,
          respondedBy: input.resolvedBy,
          respondedAt: nowIso(),
        }
      : {
          approvalId: input.approvalId,
          decisionType: "rejected",
          respondedBy: input.resolvedBy,
          respondedAt: nowIso(),
        };
    this.applyDecision(decision);
    const resolved = this.getApproval(input.approvalId);
    if (resolved == null) {
      throw new ValidationError("approval.not_found", `Approval not found: ${input.approvalId}`, {
        details: { approvalId: input.approvalId },
      });
    }
    return {
      ...resolved,
      resolutionReason: input.resolutionReason ?? resolved.resolutionReason,
    };
  }

  /**
   * Applies a decision to an existing approval request.
   *
   * Validates the decision payload, checks the request is still pending,
   * then updates the status and records the response. A decision:responded
   * event is emitted for external notification.
   *
   * Terminal decisions (rejected, expired) set the status directly.
   * Other decisions (option_selected, confirmed, text_input) set status to "approved".
   *
   * Idempotent: if the request is not in "requested" status, this is a no-op.
   *
   * @param decision - The decision to apply
   * @throws Error if decision is invalid or approval not found
   */
  public applyDecision(decision: ApprovalDecision): ApprovalDecision {
    validateApprovalDecision(decision);
    this.db.transaction(() => {
      const existing = this.repository.getApproval(decision.approvalId);

      if (!existing) {
        throw new ValidationError("approval.not_found", `Approval not found: ${decision.approvalId}`, {
          details: { approvalId: decision.approvalId },
        });
      }

      // Only apply if still pending - already resolved requests are ignored
      if (existing.status !== "requested") {
        return;
      }

      // Map decision type to status: rejected/expired are terminal, others are approved
      const nextStatus =
        decision.decisionType === "rejected" || decision.decisionType === "expired"
          ? decision.decisionType
          : "approved";
      const existingRequest = parseApprovalRequest(existing.requestJson);

      this.transitions.transitionApprovalStatus({
        entityKind: "approval",
        entityId: decision.approvalId,
        fromStatus: existing.status,
        toStatus: nextStatus,
        responseJson: JSON.stringify(decision),
        reasonCode: `approval.${nextStatus}`,
        traceId: existing.executionId ?? existing.taskId,
        actorType: decision.respondedBy === "system" ? "system" : "user",
        actorId: decision.respondedBy,
        occurredAt: decision.respondedAt,
      });
      this.repository.insertEvent({
        id: newId("evt"),
        taskId: existing.taskId,
        executionId: existing.executionId,
        eventType: "decision:responded",
        eventTier: "tier_1",
        payloadJson: JSON.stringify(decision),
        traceId: null,
        createdAt: decision.respondedAt,
      });

      if (decision.decisionType === "rejected") {
        const cascadeSessionId = readCascadeSessionId(existingRequest);
        if (cascadeSessionId) {
          const cascadeDecision: CascadeDecisionPayload = {
            approvalId: "",
            decisionType: "rejected",
            respondedBy: decision.respondedBy,
            respondedAt: decision.respondedAt,
            cascadeDeny: true,
            cascadeSourceApprovalId: decision.approvalId,
            cascadeSessionId,
          };

          for (const sibling of this.repository.listApprovalsByTask(existing.taskId)) {
            if (sibling.id === existing.id || sibling.status !== "requested") {
              continue;
            }

            const siblingRequest = parseApprovalRequest(sibling.requestJson);
            if (readCascadeSessionId(siblingRequest) !== cascadeSessionId) {
              continue;
            }

            this.transitions.transitionApprovalStatus({
              entityKind: "approval",
              entityId: sibling.id,
              fromStatus: sibling.status,
              toStatus: "rejected",
              responseJson: JSON.stringify({
                ...cascadeDecision,
                approvalId: sibling.id,
              }),
              reasonCode: "approval.cascade_rejected",
              traceId: sibling.executionId ?? sibling.taskId,
              actorType: decision.respondedBy === "system" ? "system" : "user",
              actorId: decision.respondedBy,
              occurredAt: decision.respondedAt,
            });
            this.repository.insertEvent({
              id: newId("evt"),
              taskId: sibling.taskId,
              executionId: sibling.executionId,
              eventType: "decision:responded",
              eventTier: "tier_1",
              payloadJson: JSON.stringify({
                ...cascadeDecision,
                approvalId: sibling.id,
              }),
              traceId: null,
              createdAt: decision.respondedAt,
            });
          }
        }
      }

      this.applyExecutionEffect(existing.executionId, nextStatus, decision.respondedAt);

      // Emit DecisionDirective to P3/P4 per R4-14 (P2→P3/P4 governance gate)
      const directiveTenantId =
        readStringContextField(existingRequest.context, "tenantId", "tenant_id")
        ?? existing.taskId;
      const directiveRole = decision.respondedBy === "system" || decision.respondedBy.startsWith("system:")
        ? "system"
        : "approver";
      const decisionDirective: DecisionDirective = createDecisionDirective({
        type: decision.decisionType === "rejected" || decision.decisionType === "expired" ? "deny" : "approve",
        scope: {
          tenantId: directiveTenantId,
        },
        targetRef: decision.approvalId,
        issuedBy: {
          principalId: decision.respondedBy,
          tenantId: directiveTenantId,
          roles: [directiveRole],
        },
        payload: decision,
        reason: `approval.${nextStatus}`,
      });
      this.directiveSink.emitDecisionDirective(decisionDirective);
    });
    return decision;
  }

  private applyExecutionEffect(
    executionId: string | null,
    approvalStatus: "approved" | "rejected" | "expired",
    occurredAt: string,
  ): void {
    if (executionId == null || (approvalStatus !== "rejected" && approvalStatus !== "expired")) {
      return;
    }

    const execution = this.store.execution.getExecution(executionId);
    if (!execution || execution.status !== "blocked") {
      return;
    }

    this.repository.updateExecutionStatus(executionId, "cancelled", occurredAt, execution.startedAt, occurredAt, "approval.denied");
  }
}

function toLegacyApprovalView(record: ApprovalRecord): LegacyApprovalView {
  const request = parseApprovalRequest(record.requestJson);
  const response = record.responseJson == null ? null : JSON.parse(record.responseJson) as ApprovalDecision;
  return {
    approvalId: record.id,
    status: record.status === "requested" ? "pending" : record.status,
    resolvedBy: response?.respondedBy ?? null,
    resolutionReason: null,
    request,
    response,
  };
}
