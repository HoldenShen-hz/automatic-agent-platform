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
  outputSchemaPath: z.string().min(1).nullable().optional(),
  dependencies: z.array(z.string()).default([]),
  status: PlanStepStatusSchema.default("pending"),
  timeout: z.number().int().positive(),
  retryPolicy: RetryPolicySchema.default({
    maxRetries: 0,
    backoffMs: 0,
  }),
});

export const PlanGraphNodeSchema = z.object({
  nodeId: z.string().min(1),
  nodeType: z.string().min(1),
  inputRefs: z.array(z.string()).default([]),
  riskClass: z.string().min(1),
  budgetIntent: z.record(z.string(), z.unknown()).optional(),
  sideEffectProfile: z.record(z.string(), z.unknown()).optional(),
  timeoutMs: z.number().int().positive().optional(),
}).passthrough();

export const PlanGraphEdgeSchema = z.object({
  edgeId: z.string().min(1),
  fromNodeId: z.string().min(1),
  toNodeId: z.string().min(1),
  condition: z.record(z.string(), z.unknown()).optional(),
  dependencyType: z.enum(["hard", "soft"]).default("hard"),
}).passthrough();

export const PlanSchema = z.object({
  planId: z.string().min(1),
  taskId: z.string().min(1),
  version: z.number().int().positive(),
  assessmentRef: z.string().min(1),
  strategy: PlanStrategySchema,
  steps: z.array(PlanStepSchema).min(1),
  createdAt: z.number().int().nonnegative(),
  parentVersion: z.number().int().nonnegative().optional(),
  nodes: z.array(PlanGraphNodeSchema).optional(),
  edges: z.array(PlanGraphEdgeSchema).optional(),
  entryNodeIds: z.array(z.string()).optional(),
  graphConstraints: z.record(z.string(), z.unknown()).optional(),
});

export type PlanStrategy = z.infer<typeof PlanStrategySchema>;
export type PlanStepStatus = z.infer<typeof PlanStepStatusSchema>;
export type PlanStep = z.output<typeof PlanStepSchema>;
export type Plan = z.output<typeof PlanSchema>;

export function parsePlan(input: unknown): Plan {
  return PlanSchema.parse(input);
}
