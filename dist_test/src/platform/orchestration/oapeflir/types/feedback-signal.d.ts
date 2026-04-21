import { z } from "zod";
export declare const FeedbackSourceSchema: z.ZodEnum<["execution", "user", "hitl", "validation", "system"]>;
export declare const FeedbackCategorySchema: z.ZodEnum<["success", "failure", "correction", "timeout", "partial"]>;
export declare const FeedbackSeveritySchema: z.ZodEnum<["info", "warning", "error", "critical"]>;
export declare const FeedbackSignalSchema: z.ZodObject<{
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
}>;
export type FeedbackSource = z.infer<typeof FeedbackSourceSchema>;
export type FeedbackCategory = z.infer<typeof FeedbackCategorySchema>;
export type FeedbackSeverity = z.infer<typeof FeedbackSeveritySchema>;
export type FeedbackSignal = z.output<typeof FeedbackSignalSchema>;
export declare function parseFeedbackSignal(input: unknown): FeedbackSignal;
