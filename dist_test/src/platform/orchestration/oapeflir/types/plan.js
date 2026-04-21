import { z } from "zod";
import { RetryPolicySchema } from "./shared.js";
export const PlanStrategySchema = z.enum([
    "linear",
    "hierarchical",
    "tree_branch",
    "reflexive",
    "goal_driven",
    "resource_constrained",
    "online",
    "replanned",
]);
export const PlanStepStatusSchema = z.enum(["pending", "running", "done", "failed", "skipped"]);
export const PlanStepSchema = z.object({
    stepId: z.string().min(1),
    action: z.string().min(1),
    title: z.string().optional(),
    inputs: z.record(z.string(), z.unknown()).default({}),
    outputs: z.array(z.string()).optional(),
    dependencies: z.array(z.string()).default([]),
    status: PlanStepStatusSchema.default("pending"),
    timeout: z.number().int().positive(),
    retryPolicy: RetryPolicySchema,
});
export const PlanSchema = z.object({
    planId: z.string().min(1),
    taskId: z.string().min(1),
    version: z.number().int().positive(),
    assessmentRef: z.string().min(1),
    strategy: PlanStrategySchema,
    steps: z.array(PlanStepSchema).min(1),
    createdAt: z.number().int().nonnegative(),
    parentVersion: z.number().int().nonnegative().optional(),
});
export function parsePlan(input) {
    return PlanSchema.parse(input);
}
//# sourceMappingURL=plan.js.map