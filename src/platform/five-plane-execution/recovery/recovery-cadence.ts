/**
 * Recovery Cadence
 *
 * Defines the schedule and pattern for recovery operations, including
 * retry intervals, escalation thresholds, and maximum recovery attempts.
 */

import type { RecoverySuggestedAction } from "./runtime-recovery-service.js";

/**
 * Recovery cadence phases - ordered from least to most aggressive.
 */
export type RecoveryCadencePhase =
  /** Immediate retry with same worker */
  | "immediate_retry"
  /** Retry with backoff using same worker */
  | "backoff_retry"
  /** Retry on a different worker */
  | "reassign_retry"
  /** Move to dead letter queue for manual inspection */
  | "dead_letter"
  /** Escalate to human operator */
  | "escalate";

/**
 * Recovery cadence configuration for a single phase.
 */
export interface RecoveryCadencePhaseConfig {
  readonly phase: RecoveryCadencePhase;
  readonly maxAttempts: number;
  readonly intervalMs: number;
  readonly action: RecoverySuggestedAction;
}

/**
 * RecoveryCadence defines the full recovery schedule across all phases.
 */
export interface RecoveryCadence {
  readonly phases: readonly RecoveryCadencePhaseConfig[];
  readonly totalMaxAttempts: number;
  readonly escalateAfterAttempts: number;
}

/**
 * Default recovery cadence based on exception recovery config.
 */
export function createRecoveryCadence(config: {
  readonly resumeSameWorkerMaxAttempts: number;
  readonly retryNewTicketMaxAttempts: number;
  readonly escalateTakeoverMinAttempts: number;
  readonly moveToDeadLetterMinAttempts: number;
}): RecoveryCadence {
  return {
    phases: [
      {
        phase: "immediate_retry",
        maxAttempts: config.resumeSameWorkerMaxAttempts,
        intervalMs: 0,
        action: "resume_same_worker",
      },
      {
        phase: "backoff_retry",
        maxAttempts: Math.max(0, config.retryNewTicketMaxAttempts - config.resumeSameWorkerMaxAttempts),
        intervalMs: 1000,
        action: "retry_new_ticket",
      },
      {
        phase: "dead_letter",
        maxAttempts: config.moveToDeadLetterMinAttempts - config.retryNewTicketMaxAttempts,
        intervalMs: 5000,
        action: "move_dead_letter",
      },
      {
        phase: "escalate",
        maxAttempts: Number.MAX_SAFE_INTEGER,
        intervalMs: 0,
        action: "escalate_takeover",
      },
    ],
    totalMaxAttempts: config.escalateTakeoverMinAttempts,
    escalateAfterAttempts: config.moveToDeadLetterMinAttempts,
  };
}

/**
 * Next phase in the recovery cadence.
 */
export function nextPhase(
  cadence: RecoveryCadence,
  currentPhaseIndex: number,
): RecoveryCadencePhaseConfig | null {
  if (currentPhaseIndex >= cadence.phases.length - 1) {
    return null;
  }
  return cadence.phases[currentPhaseIndex + 1] ?? null;
}