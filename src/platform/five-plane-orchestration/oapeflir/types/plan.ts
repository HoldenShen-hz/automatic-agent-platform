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
  retryPolicy: RetryPolicySchema.default({
    maxRetries: 0,
    backoffMs: 0,
  }),
});

export const PlanSchema = z.object({
  planId: z.string().min(1),
  taskId: z.string().min(1),
  version: z.number().int().positive(),
  assessmentRef: z.string().min(1),
  strategy: PlanStrategySchema,
  // §13.7: PlanSchema now includes graph structure (nodes/edges/entryNodeIds)
  // for PlanGraphBundle compatibility - linear steps are converted to graph nodes
  steps: z.array(PlanStepSchema).min(1),
  nodes: z.array(z.object({
    nodeId: z.string().min(1),
    nodeType: z.string().min(1),
    inputRefs: z.array(z.string()).default([]),
    outputSchemaRef: z.string().optional(),
    riskClass: z.string().default("medium"),
    budgetIntent: z.object({
      amount: z.number().default(1),
      currency: z.string().default("USD"),
      resourceKinds: z.array(z.string()).default(["compute"]),
    }).optional(),
    sideEffectProfile: z.object({
      mayCommitExternalEffect: z.boolean().default(false),
      reversible: z.boolean().default(true),
    }).optional(),
    retryPolicyRef: z.string().optional(),
    timeoutMs: z.number().int().positive().optional(),
  })).default([]),
  edges: z.array(z.object({
    edgeId: z.string().min(1),
    fromNodeId: z.string().min(1),
    toNodeId: z.string().min(1),
    condition: z.object({ type: z.string().default("always") }).default({ type: "always" }),
    dependencyType: z.enum(["hard", "soft"]).default("hard"),
  })).default([]),
  entryNodeIds: z.array(z.string()).default([]),
  graphConstraints: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.number().int().nonnegative(),
  parentVersion: z.number().int().nonnegative().optional(),
});

export type PlanStrategy = z.infer<typeof PlanStrategySchema>;
export type PlanStepStatus = z.infer<typeof PlanStepStatusSchema>;
export type PlanStep = z.output<typeof PlanStepSchema>;
export type Plan = z.output<typeof PlanSchema>;

export function parsePlan(input: unknown): Plan {
  return PlanSchema.parse(input);
}
