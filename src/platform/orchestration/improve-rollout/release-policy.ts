/**
 * ReleasePolicy — defines the release strategy, guardrails, and promotion criteria
 * for ImprovementCandidates moving through the rollout pipeline.
 *
 * §9.5: Governs when and how a candidate transitions between rollout levels,
 * including traffic allocation, monitoring windows, and rollback conditions.
 */

import type { RolloutLevel } from "../oapeflir/types/rollout-record.js";

export interface ReleasePolicy {
  /** Unique identifier for this release policy */
  policyId: string;
  /** Human-readable name */
  name: string;
  /** Description of what this policy governs */
  description: string;
  /** Target rollout levels this policy applies to */
  targetLevels: RolloutLevel[];
  /** Traffic allocation per level (% of traffic) */
  trafficAllocation: Record<RolloutLevel, number>;
  /** Minimum observation window in milliseconds before promoting */
  minimumObservationWindowMs: number;
  /** Rollback threshold: max failure rate (0-1) */
  rollbackFailureRateThreshold: number;
  /** Rollback threshold: max latency multiplier vs baseline */
  rollbackLatencyMultiplierThreshold: number;
  /** Whether human approval is required for stable promotion */
  requiresHumanApproval: boolean;
  /** Whether this policy is active */
  active: boolean;
}

export interface ReleasePolicyEvaluation {
  /** Policy that was evaluated */
  policy: ReleasePolicy;
  /** Whether the candidate passed all checks */
  passed: boolean;
  /** Individual check results */
  checks: PolicyCheckResult[];
  /** Recommended next action */
  recommendedAction: ReleaseAction;
  /** Reason for the recommendation */
  reason: string;
}

export interface PolicyCheckResult {
  /** Name of the check */
  checkName: string;
  /** Whether this check passed */
  passed: boolean;
  /** Details about the check */
  details: string;
  /** Severity if check fails */
  severity: "critical" | "warning" | "info";
}

export type ReleaseAction =
  | "promote"
  | "demote"
  | "rollback"
  | "hold"
  | "require_approval";
