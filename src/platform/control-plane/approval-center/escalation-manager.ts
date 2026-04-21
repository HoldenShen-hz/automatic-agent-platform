/**
 * @fileoverview Escalation Manager
 *
 * Handles escalation of approval requests when thresholds are exceeded,
 * including delegation with TTL reset support.
 *
 * @see §21 HITL Architecture - Escalation support
 */

import { newId, nowIso } from "../../contracts/types/ids.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { ValidationError } from "../../contracts/errors.js";

/**
 * Notification channel types.
 */
export enum NotificationChannelType {
  EMAIL = "email",
  SLACK = "slack",
  FEISHU = "feishu",
  WEBHOOK = "webhook",
}

/**
 * Priority level for notifications.
 */
export enum NotificationPriority {
  HIGH = "high",
  NORMAL = "normal",
  LOW = "low",
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
export enum EscalationReason {
  TIMEOUT = "timeout",
  QUORUM_NOT_MET = "quorum_not_met",
  MANUAL = "manual",
  CRITICAL_RISK = "critical_risk",
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
export enum DelegationStatus {
  ACTIVE = "active",
  EXPIRED = "expired",
  REVOKED = "revoked",
  COMPLETED = "completed",
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
 * Default escalation timeout in milliseconds (30 minutes).
 */
const DEFAULT_ESCALATION_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Default delegation TTL in milliseconds (2 hours).
 */
const DEFAULT_DELEGATION_TTL_MS = 2 * 60 * 60 * 1000;

/**
 * Maximum delegation resets allowed.
 */
const DEFAULT_MAX_TTL_RESETS = 3;

/**
 * Manages escalation of approval requests.
 */
export class EscalationManager {
  private readonly logger = new StructuredLogger({ retentionLimit: 50 });
  private readonly escalationHistory: Map<string, EscalationLevel[]> = new Map();
  private readonly delegations: Map<string, Delegation> = new Map();

  public constructor(private readonly defaultTimeoutMs: number = DEFAULT_ESCALATION_TIMEOUT_MS) {}

  /**
   * Checks if escalation is possible within the max depth.
   *
   * @param currentLevel - Current escalation level
   * @param maxDepth - Maximum allowed escalation depth
   * @returns True if further escalation is allowed
   */
  public canEscalate(currentLevel: number, maxDepth: number): boolean {
    return currentLevel < maxDepth;
  }

  /**
   * Creates a new escalation level.
   *
   * @param context - Escalation context
   * @param rule - Escalation rule to apply
   * @returns The new escalation level
   */
  public createEscalation(
    context: EscalationContext,
    rule: EscalationRule,
  ): EscalationLevel {
    const newLevel = context.currentLevel + 1;

    if (!this.canEscalate(newLevel, rule.maxEscalationDepth)) {
      throw new ValidationError(
        "escalation.max_depth_exceeded",
        `Cannot escalate beyond max depth of ${rule.maxEscalationDepth}`,
        { details: { currentLevel: context.currentLevel, maxDepth: rule.maxEscalationDepth } },
      );
    }

    const escalation: EscalationLevel = {
      level: newLevel,
      escalateTo: rule.escalateTo,
      escalatedAt: nowIso(),
      escalatedBy: "system",
      reason: context.reason,
      sourceApprovalId: context.approvalId,
    };

    // Store in history
    const history = this.escalationHistory.get(context.approvalId) ?? [];
    this.escalationHistory.set(context.approvalId, [...history, escalation]);

    this.logger.info("Escalation created", {
      approvalId: context.approvalId,
      newLevel,
      reason: context.reason,
      escalateTo: rule.escalateTo,
    });

    return escalation;
  }

  /**
   * Performs escalation for an approval request.
   *
   * @param context - Escalation context
   * @param rule - Escalation rule to apply
   * @returns Result of the escalation operation
   */
  public async escalate(
    context: EscalationContext,
    rule: EscalationRule,
  ): Promise<EscalationResult> {
    try {
      const newLevel = this.createEscalation(context, rule);

      // Notify channels
      await this.notifyChannels(
        rule.notificationChannels,
        {
          title: `Approval Escalated - Level ${newLevel.level}`,
          body: `Approval ${context.approvalId} has been escalated to ${rule.escalateTo.identifier}`,
          metadata: {
            taskId: context.taskId,
            executionId: context.executionId,
            escalationLevel: newLevel.level,
            reason: context.reason,
          },
          priority: NotificationPriority.HIGH,
        },
      );

      return { success: true, newLevel };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error("Escalation failed", { approvalId: context.approvalId, error: message });
      return { success: false, error: message };
    }
  }

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
  public createDelegation(
    fromApprover: string,
    toApprover: string,
    approvalId: string,
    ttlMs: number = DEFAULT_DELEGATION_TTL_MS,
    maxTtlResets: number = DEFAULT_MAX_TTL_RESETS,
  ): Delegation {
    if (fromApprover === toApprover) {
      throw new ValidationError(
        "delegation.self_delegation",
        "Cannot delegate to yourself",
        { details: { fromApprover, toApprover } },
      );
    }

    const delegation: Delegation = {
      delegationId: newId("delegation"),
      fromApprover,
      toApprover,
      delegatedAt: nowIso(),
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
      originalApprovalId: approvalId,
      ttlResetCount: 0,
      maxTtlResets,
      status: DelegationStatus.ACTIVE,
    };

    this.delegations.set(delegation.delegationId, delegation);

    this.logger.info("Delegation created", {
      delegationId: delegation.delegationId,
      fromApprover,
      toApprover,
      approvalId,
      expiresAt: delegation.expiresAt,
    });

    return delegation;
  }

  /**
   * Checks if a delegation has expired.
   *
   * @param delegation - Delegation to check
   * @returns True if the delegation has expired
   */
  public isDelegationExpired(delegation: Delegation): boolean {
    if (delegation.status !== DelegationStatus.ACTIVE) {
      return delegation.status === DelegationStatus.EXPIRED;
    }
    return new Date(delegation.expiresAt).getTime() <= Date.now();
  }

  /**
   * Resets the TTL of an active delegation.
   * Only allowed if reset count is below max.
   *
   * @param delegation - Delegation to reset
   * @param ttlMs - New TTL in milliseconds
   * @returns Updated delegation
   * @throws Error if max resets exceeded
   */
  public resetDelegationTtl(
    delegation: Delegation,
    ttlMs: number = DEFAULT_DELEGATION_TTL_MS,
  ): Delegation {
    if (delegation.ttlResetCount >= delegation.maxTtlResets) {
      throw new ValidationError(
        "delegation.max_resets_exceeded",
        `Cannot reset TTL more than ${delegation.maxTtlResets} times`,
        { details: { delegationId: delegation.delegationId, ttlResetCount: delegation.ttlResetCount } },
      );
    }

    if (delegation.status !== DelegationStatus.ACTIVE) {
      throw new ValidationError(
        "delegation.not_active",
        "Cannot reset TTL on inactive delegation",
        { details: { delegationId: delegation.delegationId, status: delegation.status } },
      );
    }

    const updated: Delegation = {
      ...delegation,
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
      ttlResetCount: delegation.ttlResetCount + 1,
    };

    this.delegations.set(delegation.delegationId, updated);

    this.logger.info("Delegation TTL reset", {
      delegationId: delegation.delegationId,
      newExpiresAt: updated.expiresAt,
      resetCount: updated.ttlResetCount,
    });

    return updated;
  }

  /**
   * Revokes a delegation.
   *
   * @param delegationId - ID of delegation to revoke
   */
  public revokeDelegation(delegationId: string): void {
    const delegation = this.delegations.get(delegationId);
    if (!delegation) {
      throw new ValidationError("delegation.not_found", `Delegation not found: ${delegationId}`);
    }

    const updated: Delegation = {
      ...delegation,
      status: DelegationStatus.REVOKED,
    };

    this.delegations.set(delegationId, updated);

    this.logger.info("Delegation revoked", { delegationId });
  }

  /**
   * Marks a delegation as completed.
   *
   * @param delegationId - ID of delegation to complete
   */
  public completeDelegation(delegationId: string): void {
    const delegation = this.delegations.get(delegationId);
    if (!delegation) {
      throw new ValidationError("delegation.not_found", `Delegation not found: ${delegationId}`);
    }

    const updated: Delegation = {
      ...delegation,
      status: DelegationStatus.COMPLETED,
    };

    this.delegations.set(delegationId, updated);

    this.logger.info("Delegation completed", { delegationId });
  }

  /**
   * Gets a delegation by ID.
   *
   * @param delegationId - ID to look up
   * @returns Delegation or undefined
   */
  public getDelegation(delegationId: string): Delegation | undefined {
    return this.delegations.get(delegationId);
  }

  /**
   * Gets the active delegation for an approval.
   *
   * @param approvalId - Approval to find delegation for
   * @returns Active delegation or undefined
   */
  public getActiveDelegationForApproval(approvalId: string): Delegation | undefined {
    for (const delegation of this.delegations.values()) {
      if (
        delegation.originalApprovalId === approvalId &&
        delegation.status === DelegationStatus.ACTIVE &&
        !this.isDelegationExpired(delegation)
      ) {
        return delegation;
      }
    }
    return undefined;
  }

  /**
   * Gets the escalation history for an approval.
   *
   * @param approvalId - Approval to get history for
   * @returns Array of escalation levels
   */
  public getEscalationHistory(approvalId: string): EscalationLevel[] {
    return this.escalationHistory.get(approvalId) ?? [];
  }

  /**
   * Gets the current escalation level for an approval.
   *
   * @param approvalId - Approval to check
   * @returns Current level or 0 if not escalated
   */
  public getCurrentEscalationLevel(approvalId: string): number {
    const history = this.escalationHistory.get(approvalId) ?? [];
    if (history.length === 0) return 0;
    return Math.max(...history.map((h) => h.level));
  }

  /**
   * Notifies all enabled notification channels.
   * This is fire-and-forget; errors are logged but don't block.
   *
   * @param channels - Channels to notify
   * @param message - Message to send
   */
  public async notifyChannels(
    channels: NotificationChannel[],
    message: NotificationMessage,
  ): Promise<void> {
    const promises = channels
      .filter((ch) => ch.enabled)
      .map((channel) => this.sendNotification(channel, message));

    // Fire and forget - log any errors but don't throw
    Promise.allSettled(promises).then((results) => {
      for (const result of results) {
        if (result.status === "rejected") {
          this.logger.warn("Notification failed", {
            error: result.reason,
            channel: result.reason?.channel,
          });
        }
      }
    });
  }

  /**
   * Sends a notification to a single channel.
   *
   * @param channel - Channel to send to
   * @param message - Message to send
   * @returns Promise that resolves when sent
   */
  private async sendNotification(
    channel: NotificationChannel,
    message: NotificationMessage,
  ): Promise<void> {
    switch (channel.type) {
      case NotificationChannelType.EMAIL:
        await this.sendEmail(channel, message);
        break;
      case NotificationChannelType.SLACK:
      case NotificationChannelType.FEISHU:
        await this.sendWebhook(channel, message);
        break;
      case NotificationChannelType.WEBHOOK:
        await this.sendWebhook(channel, message);
        break;
    }
  }

  /**
   * Sends an email notification.
   */
  private async sendEmail(channel: NotificationChannel, message: NotificationMessage): Promise<void> {
    // Email implementation would integrate with SMTP adapter
    this.logger.info("Email notification", {
      to: channel.address,
      title: message.title,
      priority: message.priority,
    });
    // Placeholder for actual email integration
  }

  /**
   * Sends a webhook notification.
   */
  private async sendWebhook(channel: NotificationChannel, message: NotificationMessage): Promise<void> {
    // Webhook implementation would make HTTP request
    this.logger.info("Webhook notification", {
      url: channel.address,
      title: message.title,
      priority: message.priority,
    });
    // Placeholder for actual webhook implementation
  }

  /**
   * Creates an escalation context for a timeout.
   *
   * @param approvalId - Approval ID
   * @param taskId - Task ID
   * @param executionId - Execution ID
   * @param currentLevel - Current escalation level
   * @returns Escalation context
   */
  public createTimeoutContext(
    approvalId: string,
    taskId: string,
    executionId: string | null,
    currentLevel: number,
  ): EscalationContext {
    return {
      approvalId,
      taskId,
      executionId,
      currentLevel,
      reason: EscalationReason.TIMEOUT,
    };
  }

  /**
   * Creates an escalation context for quorum not met.
   */
  public createQuorumNotMetContext(
    approvalId: string,
    taskId: string,
    executionId: string | null,
    currentLevel: number,
  ): EscalationContext {
    return {
      approvalId,
      taskId,
      executionId,
      currentLevel,
      reason: EscalationReason.QUORUM_NOT_MET,
    };
  }
}
