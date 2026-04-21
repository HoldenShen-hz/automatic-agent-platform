import { z } from "zod";
export const ImprovementChangeScopeSchema = z.enum(["prompt", "policy", "model", "workflow", "tool_config"]);
export const ImprovementCandidateStatusSchema = z.enum([
    "proposed",
    "evaluating",
    "approved",
    "shadow_running",
    "rejected",
    "rolled_back",
]);
export const ImprovementCandidateSchema = z.object({
    candidateId: z.string().min(1),
    taskId: z.string().min(1),
    sourceSignalRefs: z.array(z.string()).default([]),
    sourceLearningObjectIds: z.array(z.string()).default([]),
    changeScope: ImprovementChangeScopeSchema,
    description: z.string().min(1),
    expectedBenefit: z.string().min(1),
    status: ImprovementCandidateStatusSchema,
    createdAt: z.number().int().nonnegative(),
});
export function parseImprovementCandidate(input) {
    return ImprovementCandidateSchema.parse(input);
}
//# sourceMappingURL=improvement-candidate.js.map