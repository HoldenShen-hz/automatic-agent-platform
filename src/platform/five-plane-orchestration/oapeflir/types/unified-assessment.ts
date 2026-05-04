import { z } from "zod";

export const AssessmentPhaseSchema = z.enum(["pre-execution", "post-execution"]);
export const AssessmentComplexitySchema = z.enum(["trivial", "simple", "moderate", "complex", "critical"]);
export const AssessmentRiskSchema = z.enum(["low", "medium", "high", "critical"]);
export const ApprovalLevelSchema = z.enum(["none", "user", "admin"]);
export const ExecutionModeSchema = z.enum(["auto", "supervised", "manual"]);

/**
 * EffectivePolicySnapshot schema - policy state that Assess should also output per §13.1.1
 */
export const EffectivePolicySnapshotSchema = z.object({
  snapshotId: z.string().min(1),
  requiredApprovalLevel: ApprovalLevelSchema.optional(),
  blockedTools: z.array(z.string()).default([]),
  forcedExecutionMode: ExecutionModeSchema.optional(),
});
export type EffectivePolicySnapshot = z.infer<typeof EffectivePolicySnapshotSchema>;

/**
 * CanonicalRiskAssessment schema - risk factors that Assess should also output per §13.1.1
 */
export const CanonicalRiskAssessmentSchema = z.object({
  level: AssessmentRiskSchema,
  factors: z.array(z.string()).default([]),
});
export type CanonicalRiskAssessment = z.infer<typeof CanonicalRiskAssessmentSchema>;

export const UnifiedAssessmentSchema = z.object({
  taskId: z.string().min(1),
  timestamp: z.number().int().nonnegative(),
  situationRef: z.string().min(1),
  phase: AssessmentPhaseSchema,
  complexity: AssessmentComplexitySchema,
  risk: AssessmentRiskSchema,
  riskAssessment: CanonicalRiskAssessmentSchema,
  /** §13.1.1: ConstraintPack - use z.unknown() since ConstraintPack is defined in ../harness/index.ts */
  constraintPack: z.unknown().optional(),
  /** §13.1.1: EffectivePolicySnapshot produced by Assess stage */
  effectivePolicySnapshot: EffectivePolicySnapshotSchema.optional(),
  routingDecision: z.object({
    division: z.string().min(1),
    workflow: z.string().min(1),
    rationale: z.string().min(1),
  }),
  resourceAllocation: z.object({
    modelClass: z.string().min(1),
    maxTokens: z.number().int().positive(),
    timeoutMs: z.number().int().positive(),
  }),
  approvalPolicy: z.object({
    required: z.boolean(),
    level: ApprovalLevelSchema.optional(),
  }),
  executionMode: ExecutionModeSchema,
  suggestedActions: z.array(z.string()).default([]),
});

export type AssessmentPhase = z.infer<typeof AssessmentPhaseSchema>;
export type AssessmentComplexity = z.infer<typeof AssessmentComplexitySchema>;
export type AssessmentRisk = z.infer<typeof AssessmentRiskSchema>;
export type ApprovalLevel = z.infer<typeof ApprovalLevelSchema>;
export type ExecutionMode = z.infer<typeof ExecutionModeSchema>;
export type UnifiedAssessment = z.output<typeof UnifiedAssessmentSchema>;

export function parseUnifiedAssessment(input: unknown): UnifiedAssessment {
  return UnifiedAssessmentSchema.parse(input);
}

export function createAssessmentRef(assessment: Pick<UnifiedAssessment, "taskId" | "timestamp">): string {
  return `assessment:${assessment.taskId}:${assessment.timestamp}`;
}
