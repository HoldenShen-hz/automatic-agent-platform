/**
 * @fileoverview Reconciliation Worker - Handles ambiguous side effect resolution.
 *
 * §14.12 Reconciliation Worker
 *
 * When external systems timeout, connections are interrupted, commit receipts are lost,
 * or idempotency key state is unclear, the Reconciliation Worker takes over reconciliation.
 *
 * Reconciliation states:
 * - pending: SideEffect is ambiguous, query external state or idempotency key
 * - matched: External state matches expectation, mark as confirmed
 * - diverged: External state diverges from expectation, create incident + compensation_required
 * - unknown: Cannot confirm, escalate to manual_review_required
 * - expired: Reconciliation window expired, escalate/abort/compensate by risk tier
 */

import type {
  SideEffectRecord,
  SideEffectStatus,
  ReconciliationRecord,
  ArtifactRef,
  JsonValue,
} from "../contracts/executable-contracts/index.js";
import { createReconciliationRecord } from "../contracts/executable-contracts/index.js";
import { newId, nowIso } from "../contracts/types/ids.js";

export type ReconciliationResult =
  | "confirmed"
  | "not_found"
  | "ambiguous"
  | "failed";

export type ReconciliationNextAction =
  | "mark_confirmed"
  | "retry_probe"
  | "compensate"
  | "escalate_hitl"
  | "mark_failed";

export interface ReconciliationProbeResult {
  readonly observedState: JsonValue;
  readonly result: ReconciliationResult;
  readonly evidenceRefs: readonly ArtifactRef[];
}

export interface ReconciliationWorkerOptions {
  readonly defaultReconciliationWindowMs?: number;
  readonly maxRetryAttempts?: number;
  readonly probeTimeoutMs?: number;
}

export interface ReconciliationContext {
  readonly tenantId: string;
  readonly traceId: string;
  readonly operatorId: string;
}

/**
 * ReconciliationWorker handles the reconciliation of ambiguous side effects.
 *
 * It probes external systems to determine the actual state of side effects
 * and takes appropriate action based on the reconciliation result.
 */
export class ReconciliationWorker {
  private readonly defaultReconciliationWindowMs: number;
  private readonly maxRetryAttempts: number;
  private readonly probeTimeoutMs: number;

  constructor(options: ReconciliationWorkerOptions = {}) {
    this.defaultReconciliationWindowMs = options.defaultReconciliationWindowMs ?? 30_000;
    this.maxRetryAttempts = options.maxRetryAttempts ?? 3;
    this.probeTimeoutMs = options.probeTimeoutMs ?? 10_000;
  }

  /**
   * Determine the next action for a side effect based on reconciliation result.
   */
  public determineNextAction(
    reconciliationResult: ReconciliationResult,
    riskClass: "low" | "medium" | "high" | "critical",
  ): ReconciliationNextAction {
    switch (reconciliationResult) {
      case "confirmed":
        return "mark_confirmed";
      case "not_found":
        return riskClass === "low" ? "mark_failed" : "compensate";
      case "ambiguous":
        return "retry_probe";
      case "failed":
        return riskClass === "critical" ? "escalate_hitl" : "compensate";
    }
  }

  /**
   * Create a reconciliation record for a side effect.
   */
  public createReconciliationRecord(
    sideEffectId: string,
    probeKind: string,
    observedState: JsonValue,
    result: ReconciliationResult,
    nextAction: ReconciliationNextAction,
    evidenceRefs?: readonly ArtifactRef[],
  ): ReconciliationRecord {
    return createReconciliationRecord({
      sideEffectId,
      probeKind,
      externalObservedState: observedState,
      result,
      nextAction,
      evidenceRefs,
    });
  }

  /**
   * Check if a reconciliation has timed out based on creation time.
   */
  public isReconciliationExpired(
    reconciliationCreatedAt: string,
    windowMs?: number,
  ): boolean {
    const window = windowMs ?? this.defaultReconciliationWindowMs;
    const createdAt = new Date(reconciliationCreatedAt).getTime();
    const now = Date.now();
    return now - createdAt > window;
  }

  /**
   * Get the target status for a side effect after reconciliation.
   */
  public getTargetStatus(nextAction: ReconciliationNextAction): SideEffectStatus {
    switch (nextAction) {
      case "mark_confirmed":
        return "confirmed";
      case "retry_probe":
        return "reconciling";
      case "compensate":
        return "compensation_required";
      case "escalate_hitl":
        return "manual_review_required";
      case "mark_failed":
        return "failed";
    }
  }

  /**
   * Determine if escalation to human review is required.
   */
  public requiresEscalation(
    result: ReconciliationResult,
    attemptCount: number,
    riskClass: "low" | "medium" | "high" | "critical",
  ): boolean {
    if (result === "ambiguous" && attemptCount >= this.maxRetryAttempts) {
      return true;
    }
    return riskClass === "critical" && result === "failed";
  }
}

/**
 * Probe external system state for reconciliation.
 *
 * This is an interface that should be implemented based on the specific
 * external system being reconciled (API, database, file system, etc.).
 */
export interface ExternalStateProbe {
  /**
   * Probe the external system for the current state of a side effect.
   *
   * @param idempotencyKey - The idempotency key used when committing the side effect
   * @param timeoutMs - Maximum time to wait for a response
   * @returns The observed state and reconciliation result
   */
  probe(
    idempotencyKey: string,
    timeoutMs?: number,
  ): Promise<ReconciliationProbeResult>;
}
