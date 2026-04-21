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
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import { type RuntimeLifecycleRepository } from "../../state-evidence/truth/repositories/runtime-lifecycle-repository.js";
/**
 * Represents a request for human approval before proceeding.
 *
 * Contains the context for the decision, available options, risk assessment,
 * and a timeout policy that determines behavior on expiration.
 */
export interface ApprovalRequest {
    approvalId: string;
    taskId: string;
    executionId?: string | null;
    sourceAgentId: string;
    reason: string;
    riskLevel: "low" | "medium" | "high" | "critical";
    options: readonly string[];
    context: Record<string, unknown>;
    timeoutPolicy: "reject" | "approve" | "remain_pending";
    createdAt: string;
    /** Number of approvals required for multi-party approval (N-of-M). Default: 1 */
    requiredApprovals?: number;
    /** Groups from which approvers can be selected. Empty means any approver. */
    approverGroups?: readonly string[];
    /** Current count of approvals received */
    approvalsReceived?: number;
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
export declare function validateApprovalDecision(decision: ApprovalDecision): void;
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
export declare class ApprovalService {
    private readonly db;
    private readonly transitions;
    private readonly repository;
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore, repository?: RuntimeLifecycleRepository);
    /**
     * Creates a new approval request.
     *
     * The request is persisted to the database and an event is emitted
     * for external notification systems (webhooks, push notifications, etc).
     *
     * @param input - Request details excluding auto-generated fields
     * @returns The created approval request with generated ID and timestamp
     */
    createRequest(input: Omit<ApprovalRequest, "approvalId" | "createdAt">): ApprovalRequest;
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
    applyDecision(decision: ApprovalDecision): void;
}
