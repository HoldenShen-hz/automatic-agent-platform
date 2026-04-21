import { z } from "zod";
export declare const DomainEvaluatorSchema: z.ZodObject<{
    evaluatorId: z.ZodString;
    metric: z.ZodString;
    threshold: z.ZodNumber;
    blocking: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    evaluatorId: string;
    metric: string;
    threshold: number;
    blocking: boolean;
}, {
    evaluatorId: string;
    metric: string;
    threshold: number;
    blocking?: boolean | undefined;
}>;
export declare const DomainEvalFrameworkSchema: z.ZodObject<{
    frameworkId: z.ZodString;
    domainId: z.ZodString;
    evaluators: z.ZodDefault<z.ZodArray<z.ZodObject<{
        evaluatorId: z.ZodString;
        metric: z.ZodString;
        threshold: z.ZodNumber;
        blocking: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        evaluatorId: string;
        metric: string;
        threshold: number;
        blocking: boolean;
    }, {
        evaluatorId: string;
        metric: string;
        threshold: number;
        blocking?: boolean | undefined;
    }>, "many">>;
    onlineMetrics: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    domainId: string;
    frameworkId: string;
    evaluators: {
        evaluatorId: string;
        metric: string;
        threshold: number;
        blocking: boolean;
    }[];
    onlineMetrics: string[];
}, {
    domainId: string;
    frameworkId: string;
    evaluators?: {
        evaluatorId: string;
        metric: string;
        threshold: number;
        blocking?: boolean | undefined;
    }[] | undefined;
    onlineMetrics?: string[] | undefined;
}>;
export type DomainEvaluator = z.infer<typeof DomainEvaluatorSchema>;
export type DomainEvalFramework = z.infer<typeof DomainEvalFrameworkSchema>;
export declare function listBlockingEvaluators(framework: DomainEvalFramework): DomainEvaluator[];
export * from "./domain-evaluation-gate-service.js";
