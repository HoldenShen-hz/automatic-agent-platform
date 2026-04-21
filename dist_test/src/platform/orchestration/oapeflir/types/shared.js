import { z } from "zod";
export const TaskPhaseSchema = z.enum([
    "intake",
    "planning",
    "executing",
    "reviewing",
    "completed",
]);
export const BlockerSchema = z.object({
    description: z.string().min(1),
    severity: z.enum(["low", "medium", "high", "critical"]),
});
export const RelevantFileSchema = z.object({
    path: z.string().min(1),
    language: z.string().optional(),
    linesOfCode: z.number().int().nonnegative().optional(),
});
export const CodebaseSnapshotSchema = z.object({
    rootPath: z.string().min(1),
    fileCount: z.number().int().nonnegative(),
    relevantFiles: z.array(RelevantFileSchema).default([]),
    gitRef: z.string().optional(),
});
export const EnvironmentContextSchema = z.object({
    nodeVersion: z.string().min(1),
    platform: z.string().min(1),
    workingDirectory: z.string().min(1),
    availableTools: z.array(z.string()).default([]),
});
export const HistoricalContextSchema = z.object({
    previousTaskIds: z.array(z.string()).default([]),
    relatedMemoryRefs: z.array(z.string()).default([]),
    lastExecutionOutcome: z.string().optional(),
});
export const UserIntentSchema = z.object({
    raw: z.string().min(1),
    normalized: z.string().min(1),
    confidence: z.number().min(0).max(1),
});
export const RetryPolicySchema = z.object({
    maxRetries: z.number().int().nonnegative(),
    backoffMs: z.number().int().nonnegative(),
});
//# sourceMappingURL=shared.js.map