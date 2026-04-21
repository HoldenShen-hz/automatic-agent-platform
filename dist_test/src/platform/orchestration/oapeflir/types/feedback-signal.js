import { z } from "zod";
export const FeedbackSourceSchema = z.enum(["execution", "user", "hitl", "validation", "system"]);
export const FeedbackCategorySchema = z.enum(["success", "failure", "correction", "timeout", "partial"]);
export const FeedbackSeveritySchema = z.enum(["info", "warning", "error", "critical"]);
export const FeedbackSignalSchema = z.object({
    signalId: z.string().min(1),
    taskId: z.string().min(1),
    source: FeedbackSourceSchema,
    category: FeedbackCategorySchema,
    severity: FeedbackSeveritySchema,
    payload: z.record(z.string(), z.unknown()).default({}),
    stepOutputRefs: z.array(z.string()).default([]),
    timestamp: z.number().int().nonnegative(),
});
export function parseFeedbackSignal(input) {
    return FeedbackSignalSchema.parse(input);
}
//# sourceMappingURL=feedback-signal.js.map