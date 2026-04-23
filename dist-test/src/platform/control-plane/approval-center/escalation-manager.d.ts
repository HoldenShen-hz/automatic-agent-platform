/**
 * @fileoverview Escalation Manager
 *
 * Handles escalation of approval requests when thresholds are exceeded,
 * including delegation with TTL reset support.
 *
 * @see §21 HITL Architecture - Escalation support
 */
/**
 * Notification channel types.
 */
export declare enum NotificationChannelType {
    EMAIL = "email",
    SLACK = "slack",
    FEISHU = "feishu",
    WEBHOOK = "webhook"
}
/**
 * Priority level for notifications.
 */
export declare enum NotificationPriority {
    HIGH = "high",
    NORMAL = "normal",
    LOW = "low"
}
/**
 * A notification channel configuration.
 */
export interface NotificationChannel {
    type: NotificationChannelType;
    address: string;
    enabled: boolean;
    priority?: NotificationPriority;
    /** Optional config for the channel (e.g., webhook secret) */
    config?: Record<string, unknown>;
}
/**
 * A message to send via notification channels.
 */
export interface NotificationMessage {
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
    priority?: NotificationPriority;
}
/**
 * Rule defining how escalation should happen.
 */
export interface EscalationRule {
    escalateTo: ApproverRule;
    maxEscalationDepth: number;
    notificationChannels: NotificationChannel[];
    escalationTimeoutMs: number;
}
/**
 * Approver rule for routing.
 */
export interface ApproverRule {
    type: "user" | "role" | "team" | "on_call";
    identifier: string;
    can_delegate: boolean;
}
/**
 * A single escalation level in the escalation chain.
 */
export interface EscalationLevel {
    level: number;
    escalateTo: ApproverRule;
    escalatedAt: string;
    escalatedBy: string;
    reason: EscalationReason;
    /** ID of the approval that triggered this escalation */
    sourceApprovalId: string;
}
/**
 * Context for an escalation operation.
 */
export interface EscalationContext {
    approvalId: string;
    taskId: string;
    executionId?: string | null;
    currentLevel: number;
    reason: EscalationReason;
    escalatedFrom?: string;
}
/**
 * Reasons for escalation.
 */
export declare enum EscalationReason {
    TIMEOUT = "timeout",
    QUORUM_NOT_MET = "quorum_not_met",
    MANUAL = "manual",
    CRITICAL_RISK = "critical_risk"
}
/**
 * A delegation record.
 */
export interface Delegation {
    delegationId: string;
    fromApprover: string;
    toApprover: string;
    delegatedAt: string;
    expiresAt: string;
    originalApprovalId: string;
    ttlResetCount: number;
    maxTtlResets: number;
    status: DelegationStatus;
}
/**
 * Status of a delegation.
 */
export declare enum DelegationStatus {
    ACTIVE = "active",
    EXPIRED = "expired",
    REVOKED = "revoked",
    COMPLETED = "completed"
}
/**
 * Result of an escalation operation.
 */
export interface EscalationResult {
    success: boolean;
    newLevel?: EscalationLevel;
    error?: string;
}
/**
 * Manages escalation of approval requests.
 */
export declare class EscalationManager {
    private readonly defaultTimeoutMs;
    private readonly logger;
    private readonly escalationHistory;
    private readonly delegations;
    private readonly MAX_ENTRIES;
    private readonly ENTRY_TTL_MS;
    private lastEvictionTime;
    private readonly EVICTION_INTERVAL_MS;
    constructor(defaultTimeoutMs?: number);
    /**
     * C-11: Evict expired escalation entries to prevent memory leaks.
     */
    private evictExpiredEntries;
    /**
     * Checks if escalation is possible within the max depth.
     *
     * @param currentLevel - Current escalation level
     * @param maxDepth - Maximum allowed escalation depth
     * @returns True if further escalation is allowed
     */
    canEscalate(currentLevel: number, maxDepth: number): boolean;
    /**
     * Creates a new escalation level.
     *
     * @param context - Escalation context
     * @param rule - Escalation rule to apply
     * @returns The new escalation level
     */
    createEscalation(context: EscalationContext, rule: EscalationRule): EscalationLevel;
    /**
     * Performs escalation for an approval request.
     *
     * @param context - Escalation context
     * @param rule - Escalation rule to apply
     * @returns Result of the escalation operation
     */
    escalate(context: EscalationContext, rule: EscalationRule): Promise<EscalationResult>;
    /**
     * Creates a delegation from one approver to another.
     *
     * @param fromApprover - Original approver
     * @param toApprover - Delegated approver
     * @param approvalId - Approval ID being delegated
     * @param ttlMs - Time-to-live in milliseconds
     * @param maxTtlResets - Maximum number of TTL resets allowed
     * @returns The created delegation
     */
    createDelegation(fromApprover: string, toApprover: string, approvalId: string, ttlMs?: number, maxTtlResets?: number): Delegation;
    /**
     * Checks if a delegation has expired.
     *
     * @param delegation - Delegation to check
     * @returns True if the delegation has expired
     */
    isDelegationExpired(delegation: Delegation): boolean;
    /**
     * Resets the TTL of an active delegation.
     * Only allowed if reset count is below max.
     *
     * @param delegation - Delegation to reset
     * @param ttlMs - New TTL in milliseconds
     * @returns Updated delegation
     * @throws Error if max resets exceeded
     */
    resetDelegationTtl(delegation: Delegation, ttlMs?: number): Delegation;
    /**
     * Revokes a delegation.
     *
     * @param delegationId - ID of delegation to revoke
     */
    revokeDelegation(delegationId: string): void;
    /**
     * Marks a delegation as completed.
     *
     * @param delegationId - ID of delegation to complete
     */
    completeDelegation(delegationId: string): void;
    /**
     * Gets a delegation by ID.
     *
     * @param delegationId - ID to look up
     * @returns Delegation or undefined
     */
    getDelegation(delegationId: string): Delegation | undefined;
    /**
     * Gets the active delegation for an approval.
     *
     * @param approvalId - Approval to find delegation for
     * @returns Active delegation or undefined
     */
    getActiveDelegationForApproval(approvalId: string): Delegation | undefined;
    /**
     * Gets the escalation history for an approval.
     *
     * @param approvalId - Approval to get history for
     * @returns Array of escalation levels
     */
    getEscalationHistory(approvalId: string): EscalationLevel[];
    /**
     * Gets the current escalation level for an approval.
     *
     * @param approvalId - Approval to check
     * @returns Current level or 0 if not escalated
     */
    getCurrentEscalationLevel(approvalId: string): number;
    /**
     * Notifies all enabled notification channels.
     * This is fire-and-forget; errors are logged but don't block.
     *
     * @param channels - Channels to notify
     * @param message - Message to send
     */
    notifyChannels(channels: NotificationChannel[], message: NotificationMessage): Promise<void>;
    /**
     * Sends a notification to a single channel.
     *
     * @param channel - Channel to send to
     * @param message - Message to send
     * @returns Promise that resolves when sent
     */
    private sendNotification;
    /**
     * Sends an email notification.
     */
    private sendEmail;
    /**
     * Sends a webhook notification.
     */
    private sendWebhook;
    /**
     * Creates an escalation context for a timeout.
     *
     * @param approvalId - Approval ID
     * @param taskId - Task ID
     * @param executionId - Execution ID
     * @param currentLevel - Current escalation level
     * @returns Escalation context
     */
    createTimeoutContext(approvalId: string, taskId: string, executionId: string | null, currentLevel: number): EscalationContext;
    /**
     * Creates an escalation context for quorum not met.
     */
    createQuorumNotMetContext(approvalId: string, taskId: string, executionId: string | null, currentLevel: number): EscalationContext;
}
