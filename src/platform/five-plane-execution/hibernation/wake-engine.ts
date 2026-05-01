/**
 * @fileoverview WakeEngine - Evaluates wake conditions and triggers workflow resume.
 *
 * §20.2 Workflow Hibernation Mechanism
 *
 * WakeEngine monitors hibernated workflows and evaluates wake conditions.
 * When a condition is satisfied, it triggers the resume process:
 *
 * 1. wake_condition satisfied → WakeEngine triggers
 * 2. Execute ResumeCompatibilityCheck
 * 3. Restore workflow context from checkpoint
 * 4. Re-acquire worker lease
 * 5. Resume execution from checkpoint
 *
 * ResumeCompatibilityCheck must cover:
 * - RunVersionLock
 * - Prompt/Model/Tool/Policy version locks
 * - DomainDescriptor/Domain Spec versions
 * - Connector auth & action schema
 * - Secret lease reacquire
 * - Approval validity
 * - Budget reservation refresh
 * - External callback signature
 * - Policy diff
 * - Provider/model/prompt deprecation
 *
 * Any high/critical compatibility failure must enter require_revalidation
 * or abort_on_resume, not silently continue.
 *
 * ResumeCompatibilityCheck has a total timeout (default 30s, max 5min by domain policy).
 * On timeout: enter resume_check_timed_out, choose by risk tier:
 * - supervised_resume, require_revalidation, or abort_on_resume
 */

import type {
  HibernationRecord,
  WakeCondition,
  WakeConditionKind,
  ResumeOptions,
  ResumeResult,
  ResumeCompatibilityResult,
  ResumeDiffReport,
} from "./hibernation-types.js";
import { createWakeCondition } from "./hibernation-types.js";
import type { ArtifactRef } from "../../contracts/executable-contracts/index.js";

/**
 * Resume compatibility check result format.
 */
export interface ResumeSnapshotDescriptor {
  readonly runId: string;
  readonly contractVersion: string;
  readonly runtimeVersion: string;
  readonly graphHash: string;
  readonly artifactLockHash: string;
}

export interface ResumeCompatibilityOptions {
  readonly timeoutMs: number;
  readonly startedAtMs: number;
  readonly nowMs: number;
}

/**
 * WakeEngineOptions configures the WakeEngine behavior.
 */
export interface WakeEngineOptions {
  readonly defaultResumeTimeoutMs?: number;
  readonly maxResumeAttempts?: number;
  readonly compatibilityCheckTimeoutMs?: number;
}

/**
 * WakeEvent represents an event that may trigger wake evaluation.
 */
export interface WakeEvent {
  readonly eventKind: WakeConditionKind;
  readonly source: string;
  readonly payload?: Record<string, string>;
  readonly occurredAt: string;
}

/**
 * ResumeContext contains the context for resuming a hibernated workflow.
 */
export interface ResumeContext {
  readonly hibernationId: string;
  readonly harnessRunId: string;
  readonly tenantId: string;
  readonly traceId: string;
  readonly operatorId: string;
  readonly reason: string;
}

/**
 * WakeEngine evaluates wake conditions and triggers workflow resume.
 *
 * The WakeEngine is responsible for:
 * 1. Monitoring hibernated workflows
 * 2. Evaluating wake conditions against incoming events
 * 3. Performing resume compatibility checks
 * 4. Initiating the resume process
 */
export class WakeEngine {
  private readonly defaultResumeTimeoutMs: number;
  private readonly maxResumeAttempts: number;
  private readonly compatibilityCheckTimeoutMs: number;

  constructor(options: WakeEngineOptions = {}) {
    this.defaultResumeTimeoutMs = options.defaultResumeTimeoutMs ?? 30_000;
    this.maxResumeAttempts = options.maxResumeAttempts ?? 3;
    this.compatibilityCheckTimeoutMs = options.compatibilityCheckTimeoutMs ?? 30_000;
  }

  /**
   * Check if a wake event matches a wake condition.
   */
  public matchesCondition(event: WakeEvent, condition: WakeCondition): boolean {
    if (event.eventKind !== condition.conditionKind) {
      return false;
    }

    switch (condition.conditionKind) {
      case "approval_received":
        return condition.approvalRequestId != null && event.payload?.approvalRequestId === condition.approvalRequestId;

      case "external_callback":
        return condition.callbackEndpoint != null && event.source === condition.callbackEndpoint;

      case "timer_expired":
      case "scheduled_time":
        if (condition.targetTime) {
          const targetTime = new Date(condition.targetTime).getTime();
          const eventTime = new Date(event.occurredAt).getTime();
          return eventTime >= targetTime;
        }
        return false;

      case "event_received":
        if (condition.eventFilter) {
          return Object.entries(condition.eventFilter).every(
            ([key, value]) => event.payload?.[key] === value,
          );
        }
        return true;

      case "manual_wake":
        return true;

      default:
        return false;
    }
  }

  /**
   * Check if any wake condition is satisfied for a hibernation record.
   */
  public evaluateWakeConditions(
    record: HibernationRecord,
    event: WakeEvent,
  ): boolean {
    const conditions = record.wakeConditions;

    if (record.wakeConditionLogic === "all") {
      // All conditions must be satisfied (not typically used)
      return conditions.every((condition) => this.matchesCondition(event, condition));
    }

    // Default: any condition triggers wake
    return conditions.some((condition) => this.matchesCondition(event, condition));
  }

  /**
   * Perform resume compatibility check.
   *
   * Compares the current system state against the snapshot taken at hibernation
   * to ensure the workflow can safely resume.
   */
  public checkResumeCompatibility(
    before: ResumeSnapshotDescriptor,
    after: ResumeSnapshotDescriptor,
    options: ResumeCompatibilityOptions,
  ): ResumeCompatibilityResult {
    // Check for timeout
    if (options.nowMs - options.startedAtMs > options.timeoutMs) {
      return {
        compatible: false,
        timedOut: true,
        differences: [],
        checkedAt: new Date().toISOString(),
      };
    }

    // Compare versions
    const fields: readonly (keyof ResumeSnapshotDescriptor)[] = [
      "runId",
      "contractVersion",
      "runtimeVersion",
      "graphHash",
      "artifactLockHash",
    ];

    const differences = fields
      .filter((field) => before[field] !== after[field])
      .map((field) => ({
        field,
        beforeValue: before[field],
        afterValue: after[field],
      }));

    return {
      compatible: differences.length === 0,
      timedOut: false,
      differences,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Generate a resume diff report for workflows exceeding compatibility window.
   */
  public generateResumeDiffReport(
    runId: string,
    differences: readonly { field: string; beforeValue: string; afterValue: string }[],
  ): ResumeDiffReport {
    // Determine recommendation based on differences
    let recommendation: ResumeDiffReport["recommendation"] = "supervised_resume";

    const criticalFields = ["contractVersion", "runtimeVersion"];
    const hasCriticalChanges = differences.some((d) => criticalFields.includes(d.field));

    if (hasCriticalChanges) {
      recommendation = "replan";
    } else if (differences.length > 3) {
      recommendation = "migrate";
    } else if (differences.length === 0) {
      recommendation = "supervised_resume";
    }

    return {
      runId,
      differences,
      recommendation,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Check if a hibernation record has expired.
   */
  public isExpired(record: HibernationRecord): boolean {
    const now = Date.now();
    const expiresAt = new Date(record.expiresAt).getTime();
    return now > expiresAt;
  }

  /**
   * Check if a hibernation record can be renewed.
   */
  public canRenew(record: HibernationRecord): boolean {
    return record.currentRenewals < record.maxRenewals;
  }

  /**
   * Calculate the new expiration time after renewal.
   */
  public calculateRenewalExpiration(record: HibernationRecord): string {
    const ttl = record.ttlMs;
    return new Date(Date.now() + ttl).toISOString();
  }

  /**
   * Determine if a resume attempt should be supervised.
   *
   * Based on risk tier and compatibility check result.
   */
  public shouldRequireSupervision(
    record: HibernationRecord,
    compatibilityResult: ResumeCompatibilityResult,
  ): boolean {
    // High/critical risk or timed out requires supervision
    if (compatibilityResult.timedOut) {
      return true;
    }

    if (!compatibilityResult.compatible) {
      return true;
    }

    return false;
  }

  /**
   * Get the next status for a hibernation record during wake process.
   */
  public getNextHibernationStatus(
    currentStatus: HibernationRecord["status"],
    action: "start_resume" | "resume_success" | "resume_failed" | "expire",
  ): HibernationRecord["status"] {
    switch (action) {
      case "start_resume":
        return "waking";
      case "resume_success":
        return "resumed";
      case "resume_failed":
        return "resume_failed";
      case "expire":
        return "expired";
      default:
        return currentStatus;
    }
  }

  /**
   * Create a manual wake condition.
   */
  public createManualWakeCondition(conditionId: string): WakeCondition {
    return createWakeCondition("manual_wake", { conditionId });
  }

  /**
   * Create a timer-based wake condition.
   */
  public createTimerWakeCondition(
    conditionId: string,
    targetTime: string,
  ): WakeCondition {
    return createWakeCondition("timer_expired", { conditionId, targetTime });
  }

  /**
   * Create an approval-based wake condition.
   */
  public createApprovalWakeCondition(
    conditionId: string,
    approvalRequestId: string,
  ): WakeCondition {
    return createWakeCondition("approval_received", { conditionId, approvalRequestId });
  }

  /**
   * Create a callback-based wake condition.
   */
  public createCallbackWakeCondition(
    conditionId: string,
    callbackEndpoint: string,
  ): WakeCondition {
    return createWakeCondition("external_callback", { conditionId, callbackEndpoint });
  }

  /**
   * Validate resume preconditions.
   */
  public validateResumePreconditions(
    record: HibernationRecord,
  ): { valid: boolean; reason?: string } {
    if (record.status !== "hibernating") {
      return {
        valid: false,
        reason: `Hibernation record ${record.hibernationId} is not in hibernating state (current: ${record.status})`,
      };
    }

    if (this.isExpired(record)) {
      return {
        valid: false,
        reason: `Hibernation record ${record.hibernationId} has expired`,
      };
    }

    if (record.resumeAttemptCount >= this.maxResumeAttempts) {
      return {
        valid: false,
        reason: `Hibernation record ${record.hibernationId} has exceeded max resume attempts`,
      };
    }

    return { valid: true };
  }
}
