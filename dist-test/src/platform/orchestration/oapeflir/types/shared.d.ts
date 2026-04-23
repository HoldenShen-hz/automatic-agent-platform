import { z } from "zod";
export declare const TaskPhaseSchema: z.ZodEnum<["intake", "planning", "executing", "reviewing", "completed"]>;
export declare const BlockerSchema: z.ZodObject<{
    description: z.ZodString;
    severity: z.ZodEnum<["low", "medium", "high", "critical"]>;
}, "strip", z.ZodTypeAny, {
    description: string;
    severity: "low" | "high" | "medium" | "critical";
}, {
    description: string;
    severity: "low" | "high" | "medium" | "critical";
}>;
export declare const RelevantFileSchema: z.ZodObject<{
    path: z.ZodString;
    language: z.ZodOptional<z.ZodString>;
    linesOfCode: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    path: string;
    language?: string | undefined;
    linesOfCode?: number | undefined;
}, {
    path: string;
    language?: string | undefined;
    linesOfCode?: number | undefined;
}>;
export declare const CodebaseSnapshotSchema: z.ZodObject<{
    rootPath: z.ZodString;
    fileCount: z.ZodNumber;
    relevantFiles: z.ZodDefault<z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        language: z.ZodOptional<z.ZodString>;
        linesOfCode: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        path: string;
        language?: string | undefined;
        linesOfCode?: number | undefined;
    }, {
        path: string;
        language?: string | undefined;
        linesOfCode?: number | undefined;
    }>, "many">>;
    gitRef: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    rootPath: string;
    fileCount: number;
    relevantFiles: {
        path: string;
        language?: string | undefined;
        linesOfCode?: number | undefined;
    }[];
    gitRef?: string | undefined;
}, {
    rootPath: string;
    fileCount: number;
    relevantFiles?: {
        path: string;
        language?: string | undefined;
        linesOfCode?: number | undefined;
    }[] | undefined;
    gitRef?: string | undefined;
}>;
export declare const EnvironmentContextSchema: z.ZodObject<{
    nodeVersion: z.ZodString;
    platform: z.ZodString;
    workingDirectory: z.ZodString;
    availableTools: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    nodeVersion: string;
    platform: string;
    workingDirectory: string;
    availableTools: string[];
}, {
    nodeVersion: string;
    platform: string;
    workingDirectory: string;
    availableTools?: string[] | undefined;
}>;
export declare const HistoricalContextSchema: z.ZodObject<{
    previousTaskIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    relatedMemoryRefs: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    lastExecutionOutcome: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    previousTaskIds: string[];
    relatedMemoryRefs: string[];
    lastExecutionOutcome?: string | undefined;
}, {
    previousTaskIds?: string[] | undefined;
    relatedMemoryRefs?: string[] | undefined;
    lastExecutionOutcome?: string | undefined;
}>;
export declare const UserIntentSchema: z.ZodObject<{
    raw: z.ZodString;
    normalized: z.ZodString;
    confidence: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    raw: string;
    normalized: string;
    confidence: number;
}, {
    raw: string;
    normalized: string;
    confidence: number;
}>;
export declare const RetryPolicySchema: z.ZodObject<{
    maxRetries: z.ZodNumber;
    backoffMs: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    maxRetries: number;
    backoffMs: number;
}, {
    maxRetries: number;
    backoffMs: number;
}>;
export type TaskPhase = z.infer<typeof TaskPhaseSchema>;
export type Blocker = z.infer<typeof BlockerSchema>;
export type RelevantFile = z.infer<typeof RelevantFileSchema>;
export type CodebaseSnapshot = z.infer<typeof CodebaseSnapshotSchema>;
export type EnvironmentContext = z.infer<typeof EnvironmentContextSchema>;
export type HistoricalContext = z.infer<typeof HistoricalContextSchema>;
export type UserIntent = z.infer<typeof UserIntentSchema>;
export type RetryPolicy = z.infer<typeof RetryPolicySchema>;
