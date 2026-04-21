import { z } from "zod";
import { type FeedbackSignal } from "../../../platform/orchestration/oapeflir/types/feedback-signal.js";
export declare const FeedbackBatchOutcomeSchema: z.ZodEnum<["completed", "failed", "repairable", "escalated", "partial"]>;
export declare const FeedbackBatchSchema: z.ZodObject<{
    feedbackId: z.ZodString;
    taskId: z.ZodString;
    executionId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    planId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    outcome: z.ZodEnum<["completed", "failed", "repairable", "escalated", "partial"]>;
    signals: z.ZodDefault<z.ZodArray<z.ZodObject<{
        signalId: z.ZodString;
        taskId: z.ZodString;
        source: z.ZodEnum<["execution", "user", "hitl", "validation", "system"]>;
        category: z.ZodEnum<["success", "failure", "correction", "timeout", "partial"]>;
        severity: z.ZodEnum<["info", "warning", "error", "critical"]>;
        payload: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        stepOutputRefs: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        timestamp: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        category: "success" | "timeout" | "correction" | "partial" | "failure";
        source: "validation" | "user" | "system" | "execution" | "hitl";
        taskId: string;
        severity: "info" | "error" | "warning" | "critical";
        payload: Record<string, unknown>;
        timestamp: number;
        signalId: string;
        stepOutputRefs: string[];
    }, {
        category: "success" | "timeout" | "correction" | "partial" | "failure";
        source: "validation" | "user" | "system" | "execution" | "hitl";
        taskId: string;
        severity: "info" | "error" | "warning" | "critical";
        timestamp: number;
        signalId: string;
        payload?: Record<string, unknown> | undefined;
        stepOutputRefs?: string[] | undefined;
    }>, "many">>;
    emittedAt: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    taskId: string;
    executionId: string | null;
    outcome: "failed" | "completed" | "escalated" | "partial" | "repairable";
    planId: string | null;
    feedbackId: string;
    signals: {
        category: "success" | "timeout" | "correction" | "partial" | "failure";
        source: "validation" | "user" | "system" | "execution" | "hitl";
        taskId: string;
        severity: "info" | "error" | "warning" | "critical";
        payload: Record<string, unknown>;
        timestamp: number;
        signalId: string;
        stepOutputRefs: string[];
    }[];
    emittedAt: number;
}, {
    taskId: string;
    outcome: "failed" | "completed" | "escalated" | "partial" | "repairable";
    feedbackId: string;
    emittedAt: number;
    executionId?: string | null | undefined;
    planId?: string | null | undefined;
    signals?: {
        category: "success" | "timeout" | "correction" | "partial" | "failure";
        source: "validation" | "user" | "system" | "execution" | "hitl";
        taskId: string;
        severity: "info" | "error" | "warning" | "critical";
        timestamp: number;
        signalId: string;
        payload?: Record<string, unknown> | undefined;
        stepOutputRefs?: string[] | undefined;
    }[] | undefined;
}>;
export declare const LearningSignalSchema: z.ZodObject<{
    learningSignalId: z.ZodString;
    taskId: z.ZodString;
    sourceFeedbackId: z.ZodString;
    learningType: z.ZodEnum<["failure_pattern", "user_correction", "recovery_playbook"]>;
    confidence: z.ZodNumber;
    valueSummary: z.ZodString;
    evidenceRefs: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    sourceSignalIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    relatedSignalIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    evidence: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    generatedAt: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    taskId: string;
    confidence: number;
    learningType: "failure_pattern" | "user_correction" | "recovery_playbook";
    generatedAt: number;
    evidence: Record<string, unknown>;
    learningSignalId: string;
    sourceFeedbackId: string;
    valueSummary: string;
    evidenceRefs: string[];
    sourceSignalIds: string[];
    relatedSignalIds: string[];
}, {
    taskId: string;
    confidence: number;
    learningType: "failure_pattern" | "user_correction" | "recovery_playbook";
    generatedAt: number;
    learningSignalId: string;
    sourceFeedbackId: string;
    valueSummary: string;
    evidence?: Record<string, unknown> | undefined;
    evidenceRefs?: string[] | undefined;
    sourceSignalIds?: string[] | undefined;
    relatedSignalIds?: string[] | undefined;
}>;
export type FeedbackBatchOutcome = z.infer<typeof FeedbackBatchOutcomeSchema>;
export type FeedbackBatch = z.infer<typeof FeedbackBatchSchema>;
export type LearningSignal = z.infer<typeof LearningSignalSchema>;
export type { FeedbackSignal };
export declare function parseFeedbackBatch(input: unknown): FeedbackBatch;
export declare function parseLearningSignal(input: unknown): LearningSignal;
