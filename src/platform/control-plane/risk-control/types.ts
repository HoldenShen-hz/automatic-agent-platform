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
 */
export const RiskFactorsSchema = z.object({
  stepTypeRisk: StepTypeRiskSchema,
  targetSystemRisk: TargetSystemRiskSchema,
  dataClassRisk: DataClassRiskSchema,
  blastRadius: BlastRadiusSchema,
  priorFailureRatePercent: z.number().min(0).max(100),
  confidence: ConfidenceLevelSchema,
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
export interface RiskEvaluationResult {
  readonly taskId: string;
  readonly riskScore: number;
  readonly riskLevel: RiskLevel;
  readonly actions: readonly string[];
  readonly requiresApproval: boolean;
  readonly approvalType?: "standard" | "break_glass";
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

/**
 * Risk evaluation engine options
 */
export interface RiskEvaluationEngineOptions {
  readonly config: RiskConfig;
  readonly domainRiskProfiles?: ReadonlyMap<string, RiskLevel>;
}

/**
 * Risk configuration loaded from config/risk/default.json
 */
export interface RiskConfig {
  readonly factorWeights: {
    readonly stepTypeRisk: number;
    readonly targetSystemRisk: number;
    readonly dataClassRisk: number;
    readonly blastRadius: number;
    readonly priorFailureRate: number;
    readonly confidence: number;
  };
  readonly stepTypeRiskValues: Record<StepTypeRisk, number>;
  readonly targetSystemRiskValues: Record<TargetSystemRisk, number>;
  readonly dataClassRiskValues: Record<DataClassRisk, number>;
  readonly blastRadiusValues: Record<BlastRadius, number>;
  readonly priorFailureRateThresholds: {
    readonly low: { readonly maxPercent: number; readonly value: number };
    readonly medium: { readonly maxPercent: number; readonly value: number };
    readonly high: { readonly maxPercent: number; readonly value: number };
    readonly critical: { readonly maxPercent: number; readonly value: number };
  };
  readonly confidenceValues: Record<ConfidenceLevel, number>;
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
