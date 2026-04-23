export interface AutomatedRunbook {
    readonly runbookId: string;
    readonly name: string;
    readonly steps: readonly string[];
}
export interface RunbookStepResult {
    readonly stepId: string;
    readonly stepName: string;
    readonly status: "success" | "failed" | "skipped";
    readonly output?: string;
    readonly error?: string;
    readonly durationMs: number;
}
export interface AutomatedRunbookExecution {
    readonly executionId: string;
    readonly runbookId: string;
    readonly startedAt: string;
    readonly completedAt: string;
    readonly completedSteps: readonly string[];
    readonly stepResults: readonly RunbookStepResult[];
    readonly status: "running" | "completed" | "failed";
    readonly totalDurationMs: number;
}
export interface RunbookExecutionContext {
    readonly environment: "production" | "staging" | "development";
    readonly actorId: string;
    readonly dryRun: boolean;
}
export declare class RunbookAutomationService {
    private readonly executionHistory;
    private readonly maxHistoryEntries;
    execute(runbook: AutomatedRunbook, context?: Partial<RunbookExecutionContext>): AutomatedRunbookExecution;
    getExecution(executionId: string): AutomatedRunbookExecution | null;
    listExecutions(runbookId?: string, limit?: number): AutomatedRunbookExecution[];
    getStatistics(): {
        totalExecutions: number;
        successCount: number;
        failureCount: number;
        averageDurationMs: number;
    };
    private evictOldEntries;
}
