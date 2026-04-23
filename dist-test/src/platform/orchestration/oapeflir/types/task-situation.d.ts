import { z } from "zod";
export declare const TaskSituationSchema: z.ZodObject<{
    taskId: z.ZodString;
    timestamp: z.ZodNumber;
    objective: z.ZodString;
    currentPhase: z.ZodEnum<["intake", "planning", "executing", "reviewing", "completed"]>;
    userIntent: z.ZodObject<{
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
    blockers: z.ZodDefault<z.ZodArray<z.ZodObject<{
        description: z.ZodString;
        severity: z.ZodEnum<["low", "medium", "high", "critical"]>;
    }, "strip", z.ZodTypeAny, {
        description: string;
        severity: "low" | "high" | "medium" | "critical";
    }, {
        description: string;
        severity: "low" | "high" | "medium" | "critical";
    }>, "many">>;
    codebaseSnapshot: z.ZodObject<{
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
    environmentContext: z.ZodObject<{
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
    historicalContext: z.ZodObject<{
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
    relevantMemory: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    fileRefs: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    metrics: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    taskId: string;
    timestamp: number;
    metrics: Record<string, number>;
    blockers: {
        description: string;
        severity: "low" | "high" | "medium" | "critical";
    }[];
    currentPhase: "completed" | "executing" | "intake" | "planning" | "reviewing";
    objective: string;
    userIntent: {
        raw: string;
        normalized: string;
        confidence: number;
    };
    codebaseSnapshot: {
        rootPath: string;
        fileCount: number;
        relevantFiles: {
            path: string;
            language?: string | undefined;
            linesOfCode?: number | undefined;
        }[];
        gitRef?: string | undefined;
    };
    environmentContext: {
        nodeVersion: string;
        platform: string;
        workingDirectory: string;
        availableTools: string[];
    };
    historicalContext: {
        previousTaskIds: string[];
        relatedMemoryRefs: string[];
        lastExecutionOutcome?: string | undefined;
    };
    relevantMemory: string[];
    fileRefs: string[];
}, {
    taskId: string;
    timestamp: number;
    currentPhase: "completed" | "executing" | "intake" | "planning" | "reviewing";
    objective: string;
    userIntent: {
        raw: string;
        normalized: string;
        confidence: number;
    };
    codebaseSnapshot: {
        rootPath: string;
        fileCount: number;
        relevantFiles?: {
            path: string;
            language?: string | undefined;
            linesOfCode?: number | undefined;
        }[] | undefined;
        gitRef?: string | undefined;
    };
    environmentContext: {
        nodeVersion: string;
        platform: string;
        workingDirectory: string;
        availableTools?: string[] | undefined;
    };
    historicalContext: {
        previousTaskIds?: string[] | undefined;
        relatedMemoryRefs?: string[] | undefined;
        lastExecutionOutcome?: string | undefined;
    };
    metrics?: Record<string, number> | undefined;
    blockers?: {
        description: string;
        severity: "low" | "high" | "medium" | "critical";
    }[] | undefined;
    relevantMemory?: string[] | undefined;
    fileRefs?: string[] | undefined;
}>;
export type TaskSituation = z.output<typeof TaskSituationSchema>;
export declare function parseTaskSituation(input: unknown): TaskSituation;
export declare function createTaskSituationRef(situation: Pick<TaskSituation, "taskId" | "timestamp">): string;
