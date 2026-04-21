import { z } from "zod";
export const DomainEvaluatorSchema = z.object({
    evaluatorId: z.string().min(1),
    metric: z.string().min(1),
    threshold: z.number().min(0).max(1),
    blocking: z.boolean().default(true),
});
export const DomainEvalFrameworkSchema = z.object({
    frameworkId: z.string().min(1),
    domainId: z.string().min(1),
    evaluators: z.array(DomainEvaluatorSchema).default([]),
    onlineMetrics: z.array(z.string()).default([]),
});
export function listBlockingEvaluators(framework) {
    return framework.evaluators.filter((item) => item.blocking);
}
export * from "./domain-evaluation-gate-service.js";
//# sourceMappingURL=index.js.map