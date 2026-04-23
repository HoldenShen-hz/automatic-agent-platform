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
        taskId: string;
        category: "partial" | "timeout" | "success" | "failure" | "correction";
        source: "user" | "system" | "execution" | "validation" | "hitl";
        payload: Record<string, unknown>;
        severity: "info" | "error" | "warning" | "critical";
        timestamp: number;
        signalId: string;
        stepOutputRefs: string[];
    }, {
        taskId: string;
        category: "partial" | "timeout" | "success" | "failure" | "correction";
        source: "user" | "system" | "execution" | "validation" | "hitl";
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
    planId: string | null;
    outcome: "failed" | "completed" | "partial" | "escalated" | "repairable";
    feedbackId: string;
    signals: {
        taskId: string;
        category: "partial" | "timeout" | "success" | "failure" | "correction";
        source: "user" | "system" | "execution" | "validation" | "hitl";
        payload: Record<string, unknown>;
        severity: "info" | "error" | "warning" | "critical";
        timestamp: number;
        signalId: string;
        stepOutputRefs: string[];
    }[];
    emittedAt: number;
}, {
    taskId: string;
    outcome: "failed" | "completed" | "partial" | "escalated" | "repairable";
    feedbackId: string;
    emittedAt: number;
    executionId?: string | null | undefined;
    planId?: string | null | undefined;
    signals?: {
        taskId: string;
        category: "partial" | "timeout" | "success" | "failure" | "correction";
        source: "user" | "system" | "execution" | "validation" | "hitl";
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
    learningType: z.ZodEnum<["failure_pattern", "user_correction", "recovery_playbook", "model_retraining", "dataset_gap"]>;
    confidence: z.ZodNumber;
    valueSummary: z.ZodString;
    evidenceRefs: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    sourceSignalIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    relatedSignalIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    evidence: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    generatedAt: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    taskId: string;
    learningType: "failure_pattern" | "user_correction" | "recovery_playbook" | "model_retraining" | "dataset_gap";
    confidence: number;
    evidence: Record<string, unknown>;
    generatedAt: number;
    evidenceRefs: string[];
    learningSignalId: string;
    sourceFeedbackId: string;
    valueSummary: string;
    sourceSignalIds: string[];
    relatedSignalIds: string[];
}, {
    taskId: string;
    learningType: "failure_pattern" | "user_correction" | "recovery_playbook" | "model_retraining" | "dataset_gap";
    confidence: number;
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
