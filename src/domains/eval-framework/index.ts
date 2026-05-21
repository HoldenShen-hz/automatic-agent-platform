import { z } from "zod";

export const DomainEvaluatorSchema = z.object({
  evaluatorId: z.string().min(1),
  metric: z.string().min(1),
  threshold: z.number().nonnegative().max(1),
  blocking: z.boolean().default(true),
});

export const DomainEvalFrameworkSchema = z.object({
  frameworkId: z.string().min(1),
  domainId: z.string().min(1),
  fewShotExamples: z.array(z.string().min(1)).default([]),
  evaluators: z.array(DomainEvaluatorSchema).default([]),
  onlineMetrics: z.array(z.string()).default([]),
  releaseGates: z
    .object({
      minFewShotCount: z.number().int().nonnegative().default(5),
      minRegressionCaseCount: z.number().int().nonnegative().default(20),
      requirePromptInjectionCoverage: z.boolean().default(true),
    })
    .default({
      minFewShotCount: 5,
      minRegressionCaseCount: 20,
      requirePromptInjectionCoverage: true,
    }),
});

export type DomainEvaluator = z.infer<typeof DomainEvaluatorSchema>;
export type DomainEvalFramework = z.infer<typeof DomainEvalFrameworkSchema>;

export function listBlockingEvaluators(
  framework: DomainEvalFramework,
): DomainEvaluator[] {
  return framework.evaluators.filter((item) => item.blocking);
}

export * from "./domain-evaluation-gate-service.js";
