/**
 * Quality Gate Configuration Types
 *
 * Configuration for quality evaluation thresholds and weights.
 * Loaded from config/quality/default.json for runtime flexibility.
 *
 * §17.3: Quality gate thresholds must be configurable per risk level + domain.
 */

import type { RiskClass } from "../../contracts/executable-contracts/index.js";

export type DomainId = string;

export interface RiskLevelThreshold {
  readonly riskClass: RiskClass;
  readonly passThreshold: number;
  readonly criticalThreshold: number;
  readonly enforcement: "blocking" | "warning";
  /** Delta-based pass threshold: pass if (score - baseline) >= deltaThreshold */
  readonly deltaThreshold?: number;
}

export interface DomainThresholdOverride {
  readonly domainId: DomainId;
  readonly riskLevelThresholds: readonly RiskLevelThreshold[];
}

export interface QualityGateConfig {
  readonly qualityGate: {
    readonly defaultPassThreshold: number;
    readonly criticalPassThreshold: number;
    readonly enforcement: "blocking" | "warning";
    /** Delta-based pass threshold: pass if (score - baseline) >= deltaThreshold */
    readonly deltaThreshold?: number;
  };
  readonly qualityScoreWeights: {
    readonly successSignal: number;
    readonly completionOutcome: number;
    readonly failureSignal: number;
    readonly partialSignal: number;
    /** R11-03: Weight for constraint compliance evaluation per §13.5 */
    readonly constraintCompliance?: number;
    /** R11-03: Weight for budget adherence evaluation per §13.5 */
    readonly budgetAdherence?: number;
    /** R11-03: Weight for risk boundary evaluation per §13.5 */
    readonly riskBoundary?: number;
    /** R11-03: Weight for timing SLO evaluation per §13.5 */
    readonly timingSlo?: number;
  };
  readonly actionThresholds: {
    readonly completeMinScore: number;
    readonly approvalRequiredScore: number;
    readonly retryMaxFailures: number;
  };
  readonly evidence: {
    readonly enabled: boolean;
    readonly artifactKind: string;
    readonly retentionDays: number;
  };
  /** Per-risk-level thresholds per §17.3 */
  readonly riskLevelThresholds: readonly RiskLevelThreshold[];
  /** Per-domain threshold overrides per §17.3 */
  readonly domainThresholdOverrides: readonly DomainThresholdOverride[];
}

export interface QualityEvaluationEvidence {
  readonly evaluationId: string;
  readonly taskId: string;
  readonly executionId?: string;
  readonly qualityScore: number;
  readonly passed: boolean;
  readonly verdict: "pass" | "fail" | "degraded" | "inconclusive";
  readonly releaseStage: "released" | "repair" | "approval" | "blocked";
  readonly reasonCodes: readonly string[];
  readonly factorBreakdown: {
    readonly successSignals: number;
    readonly failureSignals: number;
    readonly partialSignals: number;
    readonly completionBonus: number;
    readonly failurePenalty: number;
    readonly partialPenalty: number;
  };
  readonly evaluatedAt: string;
  readonly configSnapshot: {
    readonly passThreshold: number;
    readonly weights: QualityGateConfig["qualityScoreWeights"];
  };
}

/** Additional evaluation dimensions per §13.5 */
export interface ConstraintComplianceResult {
  readonly compliant: boolean;
  readonly violatedConstraints: readonly string[];
}

export interface BudgetAdherenceResult {
  readonly adherent: boolean;
  readonly spentVsReserved?: {
    readonly spent: number;
    readonly reserved: number;
  };
  /** R11-03: Whether budget was exceeded per §13.5 */
  readonly budgetExceeded?: boolean;
}

export interface RiskBoundaryResult {
  readonly withinBoundary: boolean;
  readonly currentRiskClass: RiskClass;
  readonly baselineRiskClass: RiskClass;
}

export interface TimingSloResult {
  readonly withinSlo: boolean;
  readonly actualMs?: number;
  readonly maxAllowedMs?: number;
  /** R11-03: Reason for SLO miss if not within SLO */
  readonly sloMissReason?: "timeout_signal" | "duration_exceeded";
}
