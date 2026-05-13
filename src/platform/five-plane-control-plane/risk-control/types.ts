import { z } from "zod";

/**
 * Risk level enum - four levels per §10.2
 */
export const RiskLevelSchema = z.enum(["low", "medium", "high", "critical"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

/**
 * Step type risk classification per §10.2
 */
export const StepTypeRiskSchema = z.enum(["read", "write", "delete", "external_call"]);
export type StepTypeRisk = z.infer<typeof StepTypeRiskSchema>;

/**
 * Target system classification per §10.2
 */
export const TargetSystemRiskSchema = z.enum(["internal", "staging", "production"]);
export type TargetSystemRisk = z.infer<typeof TargetSystemRiskSchema>;

/**
 * Data classification per §10.2
 */
export const DataClassRiskSchema = z.enum(["public", "internal", "confidential", "restricted"]);
export type DataClassRisk = z.infer<typeof DataClassRiskSchema>;

/**
 * Blast radius scope per §10.2
 */
export const BlastRadiusSchema = z.enum(["single_task", "workflow", "tenant", "platform"]);
export type BlastRadius = z.infer<typeof BlastRadiusSchema>;

/**
 * Confidence level per §10.2
 */
export const ConfidenceLevelSchema = z.enum(["high", "medium", "low"]);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

/**
 * Input factors for risk score calculation per §10.2
 * ADR-026 v4.3 canonical 8-factor model
 */
export const CanonicalRiskFactorsSchema = z.object({
  // ADR-026 v4.3: 8-factor canonical model replaces legacy 6-factor
  impact: z.number().min(1).max(5),                    // weight=4, operation impact
  irreversibility: z.number().min(1).max(5),          // weight=4, result irreversibility
  dataSensitivity: z.number().min(1).max(5),           // weight=3, data sensitivity level
  autonomyModeRisk: z.number().min(1).max(5),          // weight=2, automation amplification risk
  tenantImpact: z.number().min(1).max(5),             // weight=2, tenant/organization scope
  blastRadius: z.number().min(1).max(5),              // weight=2, failure spread radius
  historicalFailureRate: z.number().min(0).max(100),  // weight=2, historical failure rate %
  evidenceConfidence: z.enum(["high", "medium", "low"]), // weight=1, evidence sufficiency
  // Legacy fields removed per ADR-026 v4.3 remediation
});

export const LegacyRiskFactorsSchema = z.object({
  stepTypeRisk: StepTypeRiskSchema,
  targetSystemRisk: TargetSystemRiskSchema,
  dataClassRisk: DataClassRiskSchema,
  blastRadius: BlastRadiusSchema,
  priorFailureRatePercent: z.number().min(0).max(100),
  confidence: ConfidenceLevelSchema,
});

export const RiskFactorsSchema = z.union([CanonicalRiskFactorsSchema, LegacyRiskFactorsSchema]);
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
 * ADR-026 v4.3: 8-factor canonical model
 */
export interface RiskConfig {
  readonly factorWeights: {
    // ADR-026 v4.3 canonical 8-factor weights
    readonly impact: number;
    readonly irreversibility: number;
    readonly dataSensitivity: number;
    readonly autonomyModeRisk: number;
    readonly tenantImpact: number;
    readonly blastRadius: number;
    readonly historicalFailureRate: number;
    readonly evidenceConfidence: number;
    // Legacy six-factor weights
    readonly stepTypeRisk?: number;
    readonly targetSystemRisk?: number;
    readonly dataClassRisk?: number;
    readonly priorFailureRate?: number;
    readonly confidence?: number;
  };
  readonly impactValues: Record<string, number>;
  readonly irreversibilityValues: Record<string, number>;
  readonly dataSensitivityValues: Record<string, number>;
  readonly autonomyModeRiskValues: Record<string, number>;
  readonly tenantImpactValues: Record<string, number>;
  readonly blastRadiusValues: Record<string, number>;
  readonly historicalFailureRateThresholds: {
    readonly low: { readonly maxPercent: number; readonly value: number };
    readonly medium: { readonly maxPercent: number; readonly value: number };
    readonly high: { readonly maxPercent: number; readonly value: number };
    readonly critical: { readonly maxPercent: number; readonly value: number };
  };
  readonly evidenceConfidenceValues: Record<string, number>;
  // Legacy six-factor config
  readonly stepTypeRiskValues?: Record<string, number>;
  readonly targetSystemRiskValues?: Record<string, number>;
  readonly dataClassRiskValues?: Record<string, number>;
  readonly priorFailureRateThresholds?: {
    readonly low: { readonly maxPercent: number; readonly value: number };
    readonly medium: { readonly maxPercent: number; readonly value: number };
    readonly high: { readonly maxPercent: number; readonly value: number };
    readonly critical: { readonly maxPercent: number; readonly value: number };
  };
  readonly confidenceValues?: Record<string, number>;
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
