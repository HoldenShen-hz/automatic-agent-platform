/**
 * Runbook Executor
 *
 * Executes runbook steps in sequence and records results.
 * Supports pausing for confirmation, retry, and abort.
 *
 * ## Execution Flow
 *
 * 1. Initialize execution with runbook and context
 * 2. For each section:
 *    a. For each step:
 *       - Check if confirmation required
 *       - Execute step (or pause for confirmation)
 *       - Record result
 *       - Handle failure according to config
 * 3. Return execution result
 */
import type { ParsedRunbook, RunbookExecutionResult, RunbookStepResult, RunbookExecutorConfig, RunbookExecutionContext } from "./types.js";
/**
 * Result of a single step execution.
 */
export interface StepExecutionOutput {
    stdout: string;
    stderr: string;
    exitCode: number;
}
/**
 * Runbook Executor Service
 *
 * Executes markdown runbooks with support for:
 * - Manual and automatic execution modes
 * - Step confirmation pauses
 * - Configurable failure handling
 * - Execution state persistence
 */
export declare class RunbookExecutor {
    private readonly config;
    private currentExecution;
    constructor(config?: Partial<RunbookExecutorConfig>);
    /**
     * Parses a markdown runbook without executing it.
     */
    parse(markdown: string, runbookId?: string): ParsedRunbook;
    /**
     * Initializes a new runbook execution.
     */
    initializeExecution(runbook: ParsedRunbook, executedBy: string, context?: RunbookExecutionContext): RunbookExecutionResult;
    /**
     * Gets the current execution state.
     */
    getCurrentExecution(): RunbookExecutionResult | null;
    /**
     * Gets steps that are waiting for confirmation.
     */
    getPendingConfirmations(): RunbookStepResult[];
    /**
     * Confirms a pending step to proceed with execution.
     */
    confirmStep(executionId: string, stepIndex: number): RunbookStepResult | null;
    /**
     * Executes a step and returns the result.
     *
     * In a real implementation, this would execute actual commands.
     * Here we simulate execution for testing purposes.
     */
    executeStep(executionId: string, sectionName: string, stepIndex: number, simulatedResult?: {
        success: boolean;
        output?: string;
    }): Promise<RunbookStepResult | null>;
    /**
     * Simulates step execution for testing.
     * In production, this would actually execute commands.
     */
    private simulateStepExecution;
    /**
     * Updates section statistics after step completion.
     */
    private updateSectionStats;
    /**
     * Checks if the entire execution is complete and updates outcome.
     */
    private checkExecutionComplete;
    /**
     * Skips a step without executing it.
     */
    skipStep(executionId: string, sectionName: string, stepIndex: number): RunbookStepResult | null;
    /**
     * Aborts the current execution.
     */
    abort(executionId: string): RunbookExecutionResult | null;
    /**
     * Creates a step result with initial state.
     */
    private createStepResult;
    /**
     * Generates a markdown report of the execution.
     */
    generateExecutionReport(execution: RunbookExecutionResult): string;
}
