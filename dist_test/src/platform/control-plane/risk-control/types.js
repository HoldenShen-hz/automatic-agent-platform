import { z } from "zod";
/**
 * Risk level enum - four levels per §10.2
 */
export const RiskLevelSchema = z.enum(["low", "medium", "high", "critical"]);
/**
 * Step type risk classification per §10.2
 */
export const StepTypeRiskSchema = z.enum(["read", "write", "delete", "external_call"]);
/**
 * Target system classification per §10.2
 */
export const TargetSystemRiskSchema = z.enum(["internal", "staging", "production"]);
/**
 * Data classification per §10.2
 */
export const DataClassRiskSchema = z.enum(["public", "internal", "confidential", "restricted"]);
/**
 * Blast radius scope per §10.2
 */
export const BlastRadiusSchema = z.enum(["single_task", "workflow", "tenant", "platform"]);
/**
 * Confidence level per §10.2
 */
export const ConfidenceLevelSchema = z.enum(["high", "medium", "low"]);
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
//# sourceMappingURL=types.js.map