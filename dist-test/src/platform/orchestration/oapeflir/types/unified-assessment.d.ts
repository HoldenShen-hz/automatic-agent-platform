import { z } from "zod";
export declare const AssessmentPhaseSchema: z.ZodEnum<["pre-execution", "post-execution"]>;
export declare const AssessmentComplexitySchema: z.ZodEnum<["trivial", "simple", "moderate", "complex", "critical"]>;
export declare const AssessmentRiskSchema: z.ZodEnum<["low", "medium", "high", "critical"]>;
export declare const ApprovalLevelSchema: z.ZodEnum<["none", "user", "admin"]>;
export declare const ExecutionModeSchema: z.ZodEnum<["auto", "supervised", "manual"]>;
export declare const UnifiedAssessmentSchema: z.ZodObject<{
    taskId: z.ZodString;
    timestamp: z.ZodNumber;
    situationRef: z.ZodString;
    phase: z.ZodEnum<["pre-execution", "post-execution"]>;
    complexity: z.ZodEnum<["trivial", "simple", "moderate", "complex", "critical"]>;
    risk: z.ZodEnum<["low", "medium", "high", "critical"]>;
    riskAssessment: z.ZodObject<{
        level: z.ZodEnum<["low", "medium", "high", "critical"]>;
        factors: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        level: "low" | "high" | "medium" | "critical";
        factors: string[];
    }, {
        level: "low" | "high" | "medium" | "critical";
        factors?: string[] | undefined;
    }>;
    routingDecision: z.ZodObject<{
        division: z.ZodString;
        workflow: z.ZodString;
        rationale: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        division: string;
        workflow: string;
        rationale: string;
    }, {
        division: string;
        workflow: string;
        rationale: string;
    }>;
    resourceAllocation: z.ZodObject<{
        modelClass: z.ZodString;
        maxTokens: z.ZodNumber;
        timeoutMs: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        timeoutMs: number;
        modelClass: string;
        maxTokens: number;
    }, {
        timeoutMs: number;
        modelClass: string;
        maxTokens: number;
    }>;
    approvalPolicy: z.ZodObject<{
        required: z.ZodBoolean;
        level: z.ZodOptional<z.ZodEnum<["none", "user", "admin"]>>;
    }, "strip", z.ZodTypeAny, {
        required: boolean;
        level?: "user" | "admin" | "none" | undefined;
    }, {
        required: boolean;
        level?: "user" | "admin" | "none" | undefined;
    }>;
    executionMode: z.ZodEnum<["auto", "supervised", "manual"]>;
    suggestedActions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    taskId: string;
    phase: "pre-execution" | "post-execution";
    timestamp: number;
    situationRef: string;
    complexity: "critical" | "trivial" | "simple" | "moderate" | "complex";
    risk: "low" | "high" | "medium" | "critical";
    riskAssessment: {
        level: "low" | "high" | "medium" | "critical";
        factors: string[];
    };
    routingDecision: {
        division: string;
        workflow: string;
        rationale: string;
    };
    resourceAllocation: {
        timeoutMs: number;
        modelClass: string;
        maxTokens: number;
    };
    approvalPolicy: {
        required: boolean;
        level?: "user" | "admin" | "none" | undefined;
    };
    executionMode: "manual" | "supervised" | "auto";
    suggestedActions: string[];
}, {
    taskId: string;
    phase: "pre-execution" | "post-execution";
    timestamp: number;
    situationRef: string;
    complexity: "critical" | "trivial" | "simple" | "moderate" | "complex";
    risk: "low" | "high" | "medium" | "critical";
    riskAssessment: {
        level: "low" | "high" | "medium" | "critical";
        factors?: string[] | undefined;
    };
    routingDecision: {
        division: string;
        workflow: string;
        rationale: string;
    };
    resourceAllocation: {
        timeoutMs: number;
        modelClass: string;
        maxTokens: number;
    };
    approvalPolicy: {
        required: boolean;
        level?: "user" | "admin" | "none" | undefined;
    };
    executionMode: "manual" | "supervised" | "auto";
    suggestedActions?: string[] | undefined;
}>;
export type AssessmentPhase = z.infer<typeof AssessmentPhaseSchema>;
export type AssessmentComplexity = z.infer<typeof AssessmentComplexitySchema>;
export type AssessmentRisk = z.infer<typeof AssessmentRiskSchema>;
export type ApprovalLevel = z.infer<typeof ApprovalLevelSchema>;
export type ExecutionMode = z.infer<typeof ExecutionModeSchema>;
export type UnifiedAssessment = z.output<typeof UnifiedAssessmentSchema>;
export declare function parseUnifiedAssessment(input: unknown): UnifiedAssessment;
export declare function createAssessmentRef(assessment: Pick<UnifiedAssessment, "taskId" | "timestamp">): string;
