import { z } from "zod";
export declare const PlanStrategySchema: z.ZodEnum<["linear", "hierarchical", "tree_branch", "reflexive", "goal_driven", "resource_constrained", "online", "replanned"]>;
export declare const PlanStepStatusSchema: z.ZodEnum<["pending", "running", "done", "failed", "skipped"]>;
export declare const PlanStepSchema: z.ZodObject<{
    stepId: z.ZodString;
    action: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
    inputs: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    outputs: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    dependencies: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    status: z.ZodDefault<z.ZodEnum<["pending", "running", "done", "failed", "skipped"]>>;
    timeout: z.ZodNumber;
    retryPolicy: z.ZodObject<{
        maxRetries: z.ZodNumber;
        backoffMs: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        backoffMs: number;
        maxRetries: number;
    }, {
        backoffMs: number;
        maxRetries: number;
    }>;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "failed" | "done" | "running" | "skipped";
    stepId: string;
    action: string;
    timeout: number;
    inputs: Record<string, unknown>;
    dependencies: string[];
    retryPolicy: {
        backoffMs: number;
        maxRetries: number;
    };
    title?: string | undefined;
    outputs?: string[] | undefined;
}, {
    stepId: string;
    action: string;
    timeout: number;
    retryPolicy: {
        backoffMs: number;
        maxRetries: number;
    };
    status?: "pending" | "failed" | "done" | "running" | "skipped" | undefined;
    title?: string | undefined;
    outputs?: string[] | undefined;
    inputs?: Record<string, unknown> | undefined;
    dependencies?: string[] | undefined;
}>;
export declare const PlanSchema: z.ZodObject<{
    planId: z.ZodString;
    taskId: z.ZodString;
    version: z.ZodNumber;
    assessmentRef: z.ZodString;
    strategy: z.ZodEnum<["linear", "hierarchical", "tree_branch", "reflexive", "goal_driven", "resource_constrained", "online", "replanned"]>;
    steps: z.ZodArray<z.ZodObject<{
        stepId: z.ZodString;
        action: z.ZodString;
        title: z.ZodOptional<z.ZodString>;
        inputs: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        outputs: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        dependencies: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        status: z.ZodDefault<z.ZodEnum<["pending", "running", "done", "failed", "skipped"]>>;
        timeout: z.ZodNumber;
        retryPolicy: z.ZodObject<{
            maxRetries: z.ZodNumber;
            backoffMs: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            backoffMs: number;
            maxRetries: number;
        }, {
            backoffMs: number;
            maxRetries: number;
        }>;
    }, "strip", z.ZodTypeAny, {
        status: "pending" | "failed" | "done" | "running" | "skipped";
        stepId: string;
        action: string;
        timeout: number;
        inputs: Record<string, unknown>;
        dependencies: string[];
        retryPolicy: {
            backoffMs: number;
            maxRetries: number;
        };
        title?: string | undefined;
        outputs?: string[] | undefined;
    }, {
        stepId: string;
        action: string;
        timeout: number;
        retryPolicy: {
            backoffMs: number;
            maxRetries: number;
        };
        status?: "pending" | "failed" | "done" | "running" | "skipped" | undefined;
        title?: string | undefined;
        outputs?: string[] | undefined;
        inputs?: Record<string, unknown> | undefined;
        dependencies?: string[] | undefined;
    }>, "many">;
    createdAt: z.ZodNumber;
    parentVersion: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    taskId: string;
    createdAt: number;
    version: number;
    strategy: "linear" | "hierarchical" | "tree_branch" | "reflexive" | "goal_driven" | "resource_constrained" | "online" | "replanned";
    planId: string;
    assessmentRef: string;
    steps: {
        status: "pending" | "failed" | "done" | "running" | "skipped";
        stepId: string;
        action: string;
        timeout: number;
        inputs: Record<string, unknown>;
        dependencies: string[];
        retryPolicy: {
            backoffMs: number;
            maxRetries: number;
        };
        title?: string | undefined;
        outputs?: string[] | undefined;
    }[];
    parentVersion?: number | undefined;
}, {
    taskId: string;
    createdAt: number;
    version: number;
    strategy: "linear" | "hierarchical" | "tree_branch" | "reflexive" | "goal_driven" | "resource_constrained" | "online" | "replanned";
    planId: string;
    assessmentRef: string;
    steps: {
        stepId: string;
        action: string;
        timeout: number;
        retryPolicy: {
            backoffMs: number;
            maxRetries: number;
        };
        status?: "pending" | "failed" | "done" | "running" | "skipped" | undefined;
        title?: string | undefined;
        outputs?: string[] | undefined;
        inputs?: Record<string, unknown> | undefined;
        dependencies?: string[] | undefined;
    }[];
    parentVersion?: number | undefined;
}>;
export type PlanStrategy = z.infer<typeof PlanStrategySchema>;
export type PlanStepStatus = z.infer<typeof PlanStepStatusSchema>;
export type PlanStep = z.output<typeof PlanStepSchema>;
export type Plan = z.output<typeof PlanSchema>;
export declare function parsePlan(input: unknown): Plan;
