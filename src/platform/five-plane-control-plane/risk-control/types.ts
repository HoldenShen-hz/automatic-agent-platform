import { z } from "zod";

/**
 * Risk level enum - four levels per §10.2
 */
export const RiskLevelSchema = z.enum(["low", "medium", "high", "critical"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

// ============================================================================
// ADR-026 8-Factor Canonical Model
//
// The canonical risk model per ADR-026 §8 uses 8 weighted factors:
//   operationRisk (w=3), targetResourceCriticality (w=3), dataSensitivity (w=3),
//   autonomyModeRisk (w=2), tenantImpact (w=2), blastRadius (w=2),
//   historicalFailureRate (w=2), evidenceConfidence (w=1)
// Max possible weighted score = 18 (divisor 18 produces normalized 0-1 score).
//
// Legacy 6-factor model (stepTypeRisk / targetSystemRisk / dataClassRisk /
// blastRadius / priorFailureRate / confidence) is superseded.
// ============================================================================

/**
 * Operation risk - type of operation and side effect risk per ADR-026
 */
export const OperationRiskSchema = z.enum(["read", "write", "delete", "external_call"]);
export type OperationRisk = z.infer<typeof OperationRiskSchema>;

/**
 * Target resource criticality per ADR-026
 */
export const TargetResourceCriticalitySchema = z.enum(["internal", "staging", "production"]);
export type TargetResourceCriticality = z.infer<typeof TargetResourceCriticalitySchema>;

/**
 * Data sensitivity level per ADR-026
 */
export const DataSensitivitySchema = z.enum(["public", "internal", "confidential", "restricted"]);
export type DataSensitivity = z.infer<typeof DataSensitivitySchema>;

/**
 * Autonomy mode risk - automation amplification risk per ADR-026
 */
export const AutonomyModeRiskSchema = z.enum(["full_auto", "semi_auto", "supervised", "suggestion"]);
export type AutonomyModeRisk = z.infer<typeof AutonomyModeRiskSchema>;

/**
 * Tenant impact scope per ADR-026
 */
export const TenantImpactSchema = z.enum(["single_task", "workflow", "tenant", "platform"]);
export type TenantImpact = z.infer<typeof TenantImpactSchema>;

/**
 * Blast radius - failure propagation radius per ADR-026
 */
export const BlastRadiusSchema = z.enum(["single_task", "workflow", "tenant", "platform"]);
export type BlastRadius = z.infer<typeof BlastRadiusSchema>;

/**
 * Historical failure rate per ADR-026
 */
export const HistoricalFailureRateSchema = z.enum(["low", "medium", "high", "critical"]);
export type HistoricalFailureRate = z.infer<typeof HistoricalFailureRateSchema>;

/**
 * Evidence confidence - sufficiency of evidence and judgment confidence per ADR-026
 */
export const EvidenceConfidenceSchema = z.enum(["high", "medium", "low"]);
export type EvidenceConfidence = z.infer<typeof EvidenceConfidenceSchema>;

/**
 * Input factors for risk score calculation per ADR-026 8-factor model
 */
export const RiskFactorsSchema = z.object({
  operationRisk: OperationRiskSchema,
  targetResourceCriticality: TargetResourceCriticalitySchema,
  dataSensitivity: DataSensitivitySchema,
  autonomyModeRisk: AutonomyModeRiskSchema,
  tenantImpact: TenantImpactSchema,
  blastRadius: BlastRadiusSchema,
  historicalFailureRate: HistoricalFailureRateSchema,
  evidenceConfidence: EvidenceConfidenceSchema,
});
export type RiskFactors = z.infer<typeof RiskFactorsSchema>;

/**
 * Risk evaluation request
 */
export interface RiskEvaluationRequest {
  readonly taskId: string;
  readonly factors: RiskFactors;
  readonly tenantId?: string;
  readonly domainId?: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Risk evaluation result output per §10.3
 */
export interface RiskEvaluationResultBase {
  readonly taskId: string;
  readonly riskScore: number;
  readonly riskLevel: RiskLevel;
  readonly actions: readonly string[];
  readonly requiresApproval: boolean;
  readonly evidenceLevel: "basic" | "enhanced" | "full" | "legal";
  readonly logLevel: "info" | "warn" | "error" | "critical";
  readonly autoExecute: boolean;
  readonly sideEffect: "normal" | "normal_with_validation" | "restricted" | "prohibited";
  readonly factorBreakdown: readonly {
    readonly factor: string;
    readonly value: number;
    readonly weight: number;
    readonly weightedValue: number;
  }[];
}

export interface RiskEvaluationResultRequiresApproval extends RiskEvaluationResultBase {
  readonly requiresApproval: true;
  readonly approvalType: "standard" | "break_glass";
}

export interface RiskEvaluationResultNoApproval extends RiskEvaluationResultBase {
  readonly requiresApproval: false;
  readonly approvalType?: undefined;
}

export type RiskEvaluationResult = RiskEvaluationResultRequiresApproval | RiskEvaluationResultNoApproval;

/**
 * Risk evaluation engine options
 */
export interface RiskEvaluationEngineOptions {
  readonly config: RiskConfig;
  readonly domainRiskProfiles?: ReadonlyMap<string, RiskLevel>;
}

/**
 * Risk configuration loaded from config/risk/default.json
 * Updated to ADR-026 8-factor canonical model
 */
export interface RiskConfig {
  readonly factorWeights: {
    readonly operationRisk: number;
    readonly targetResourceCriticality: number;
    readonly dataSensitivity: number;
    readonly autonomyModeRisk: number;
    readonly tenantImpact: number;
    readonly blastRadius: number;
    readonly historicalFailureRate: number;
    readonly evidenceConfidence: number;
  };
  readonly operationRiskValues: Record<OperationRisk, number>;
  readonly targetResourceCriticalityValues: Record<TargetResourceCriticality, number>;
  readonly dataSensitivityValues: Record<DataSensitivity, number>;
  readonly autonomyModeRiskValues: Record<AutonomyModeRisk, number>;
  readonly tenantImpactValues: Record<TenantImpact, number>;
  readonly blastRadiusValues: Record<BlastRadius, number>;
  readonly historicalFailureRateThresholds: {
    readonly low: { readonly maxPercent: number; readonly value: number };
    readonly medium: { readonly maxPercent: number; readonly value: number };
    readonly high: { readonly maxPercent: number; readonly value: number };
    readonly critical: { readonly maxPercent: number; readonly value: number };
  };
  readonly evidenceConfidenceValues: Record<EvidenceConfidence, number>;
  readonly riskLevelThresholds: {
    readonly low: number;
    readonly medium: number;
    readonly high: number;
    readonly critical: number;
  };
  readonly riskLevelActions: {
    readonly low: RiskLevelActionConfig;
    readonly medium: RiskLevelActionConfig;
    readonly high: RiskLevelActionConfig;
    readonly critical: RiskLevelActionConfig;
  };
}

export interface RiskLevelActionConfig {
  readonly autoExecute: boolean;
  readonly logLevel: "info" | "warn" | "error" | "critical";
  readonly requiresApproval: boolean;
  readonly approvalType?: "standard" | "break_glass";
  readonly sideEffect: "normal" | "normal_with_validation" | "restricted" | "prohibited";
  readonly evidenceLevel: "basic" | "enhanced" | "full" | "legal";
}
