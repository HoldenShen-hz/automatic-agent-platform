/**
 * @fileoverview Hibernation Types - Type definitions for workflow hibernation.
 *
 * §20.2 Workflow Hibernation Mechanism
 *
 * Hibernation allows long-running workflows (hours to days) to persist and resume later,
 * releasing worker leases while waiting for external events (approvals, callbacks, timers).
 *
 * Key types:
 * - HibernationRecord: Persists workflow state and wake conditions
 * - WakeCondition: Defines when and how a workflow should be resumed
 * - WakeEngine: Evaluates wake conditions and triggers resume
 */

import type { ArtifactRef } from "../../../contracts/executable-contracts/index.js";

// ---------------------------------------------------------------------------
// Wake Condition Types
// ---------------------------------------------------------------------------

/**
 * Wake condition types that can trigger workflow resume.
 */
export type WakeConditionKind =
  | "approval_received"
  | "external_callback"
  | "timer_expired"
  | "scheduled_time"
  | "event_received"
  | "manual_wake";

/**
 * Wake condition - defines when a hibernated workflow should resume.
 *
 * Multiple conditions can be registered; any condition triggering
 * will cause the WakeEngine to initiate resume.
 */
export interface WakeCondition {
  readonly conditionId: string;
  readonly conditionKind: WakeConditionKind;
  readonly targetTime?: string; // For scheduled_time
  readonly callbackEndpoint?: string; // For external_callback
  readonly eventFilter?: Record<string, string>; // For event_received
  readonly approvalRequestId?: string; // For approval_received
  readonly metadata?: Record<string, string>;
}

/**
 * Resume compatibility check result.
 */
export interface ResumeCompatibilityResult {
  readonly compatible: boolean;
  readonly timedOut: boolean;
  readonly differences: readonly {
    readonly field: string;
    readonly before: string;
    readonly after: string;
  }[];
  readonly checkedAt: string;
}

/**
 * Resume diff report for workflows exceeding compatibility window.
 */
export interface ResumeDiffReport {
  readonly runId: string;
  readonly differences: readonly {
    readonly field: string;
    readonly beforeValue: string;
    readonly afterValue: string;
  }[];
  readonly recommendation: "migrate" | "replan" | "terminate" | "supervised_resume";
  readonly generatedAt: string;
}

// ---------------------------------------------------------------------------
// Hibernation Record
// ---------------------------------------------------------------------------

/**
 * Hibernation status for a workflow.
 */
export type HibernationStatus =
  | "hibernating"
  | "waking"
  | "resume_check_pending"
  | "resuming"
  | "resumed"
  | "resume_failed"
  | "expired";

/**
 * HibernationRecord - persists workflow state for later resume.
 *
 * Created when a workflow enters a waiting state (human approval, external callback,
 * scheduled time, etc.) and the worker lease needs to be released.
 *
 * The record contains:
 * - Workflow identification and version
 * - Wake conditions that will trigger resume
 * - Checkpoint reference for state restoration
 * - TTL and expiration management
 */
export interface HibernationRecord {
  readonly hibernationId: string;
  readonly harnessRunId: string;
  readonly tenantId: string;
  readonly status: HibernationStatus;

  // Version information for compatibility checks
  readonly contractVersion: string;
  readonly runtimeVersion: string;
  readonly graphHash: string;
  readonly artifactLockHash: string;

  // Checkpoint for state restoration
  readonly checkpointRef: ArtifactRef;

  // Wake conditions
  readonly wakeConditions: readonly WakeCondition[];
  readonly wakeConditionLogic: "any" | "all"; // Default: "any" (resume on any condition)

  // TTL management
  readonly hibernatedAt: string;
  readonly ttlMs: number;
  readonly expiresAt: string;
  readonly maxRenewals: number;
  readonly currentRenewals: number;

  // Resume tracking
  readonly resumeAttemptCount: number;
  readonly lastResumeAttemptAt?: string;
  readonly lastResumeError?: string;

  // Metadata
  readonly pausedReason: string;
  readonly metadata?: Record<string, string>;
}

/**
 * Resume options for waking a hibernated workflow.
 */
export interface ResumeOptions {
  readonly resumeCompatibilityTimeoutMs?: number;
  readonly maxResumeAttempts?: number;
  readonly requireSupervision?: boolean;
}

/**
 * Resume result from WakeEngine.
 */
export interface ResumeResult {
  readonly success: boolean;
  readonly hibernationId: string;
  readonly newWorkerLeaseId?: string;
  readonly resumeDiffReport?: ResumeDiffReport;
  readonly error?: string;
  readonly resumedAt: string;
}

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

export function createWakeCondition(
  kind: WakeConditionKind,
  options: Partial<WakeCondition> & { conditionId: string },
): WakeCondition {
  return {
    conditionId: options.conditionId,
    conditionKind: kind,
    targetTime: options.targetTime,
    callbackEndpoint: options.callbackEndpoint,
    eventFilter: options.eventFilter,
    approvalRequestId: options.approvalRequestId,
    metadata: options.metadata,
  };
}

export function createHibernationRecord(input: {
  harnessRunId: string;
  tenantId: string;
  checkpointRef: ArtifactRef;
  wakeConditions: readonly WakeCondition[];
  pausedReason: string;
  hibernationId?: string;
  contractVersion?: string;
  runtimeVersion?: string;
  graphHash?: string;
  artifactLockHash?: string;
  ttlMs?: number;
  maxRenewals?: number;
  wakeConditionLogic?: "any" | "all";
  metadata?: Record<string, string>;
}): HibernationRecord {
  const now = new Date().toISOString();
  const ttl = input.ttlMs ?? 7 * 24 * 60 * 60 * 1000; // Default 7 days
  const expiresAt = new Date(Date.now() + ttl).toISOString();

  return {
    hibernationId: input.hibernationId ?? `hib-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    harnessRunId: input.harnessRunId,
    tenantId: input.tenantId,
    status: "hibernating",
    contractVersion: input.contractVersion ?? "v4.3",
    runtimeVersion: input.runtimeVersion ?? "1.0.0",
    graphHash: input.graphHash ?? "",
    artifactLockHash: input.artifactLockHash ?? "",
    checkpointRef: input.checkpointRef,
    wakeConditions: input.wakeConditions,
    wakeConditionLogic: input.wakeConditionLogic ?? "any",
    hibernatedAt: now,
    ttlMs: ttl,
    expiresAt,
    maxRenewals: input.maxRenewals ?? 6,
    currentRenewals: 0,
    resumeAttemptCount: 0,
    pausedReason: input.pausedReason,
    metadata: input.metadata,
  };
}
