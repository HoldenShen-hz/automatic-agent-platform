/**
 * @fileoverview Workflow Crash Simulator - Injects artificial crashes for stability testing.
 *
 * Provides controlled crash injection for workflow execution testing. This is used
 * exclusively in test/development environments to verify that the system correctly
 * handles and recovers from unexpected workflow failures.
 *
 * Crash points:
 * - step_started: Crash immediately when a workflow step begins
 * - tool_completed: Crash after a tool execution completes
 * - before_commit: Crash just before the workflow state is committed
 *
 * @see Stable Release Gate: stable-release-gate.ts
 */
import { InternalAppError } from "../../contracts/errors.js";
/** Points in workflow execution where crashes can be injected. */
export type WorkflowCrashPoint = "step_started" | "tool_completed" | "before_commit";
/**
 * Defines a crash injection configuration.
 *
 * Specifies the crash point and optionally a specific step ID to target.
 * If stepId is null, the crash applies to any step matching the point.
 */
export interface WorkflowCrashInjection {
    point: WorkflowCrashPoint;
    stepId?: string | null;
}
/**
 * Context describing where in the workflow the crash occurred.
 *
 * Used to build the InjectedWorkflowCrashError with enough information
 * to understand the crash location and associated entities.
 */
export interface WorkflowCrashContext {
    point: WorkflowCrashPoint;
    taskId: string;
    executionId: string;
    workflowId: string;
    stepId: string;
}
/**
 * Error thrown when an injected workflow crash fires.
 *
 * Extends InternalAppError to indicate this is an expected, controlled
 * error during testing, not a genuine runtime failure.
 */
export declare class InjectedWorkflowCrashError extends InternalAppError {
    readonly taskId: string;
    readonly executionId: string;
    readonly point: WorkflowCrashPoint;
    readonly workflowId: string;
    readonly stepId: string;
    constructor(context: WorkflowCrashContext);
}
/**
 * Conditionally injects a workflow crash based on injection configuration.
 *
 * Checks if the crash point matches and if the step ID matches (if specified).
 * If conditions are met, throws InjectedWorkflowCrashError to simulate a crash.
 */
export declare function maybeInjectWorkflowCrash(injection: WorkflowCrashInjection | undefined, context: WorkflowCrashContext): void;
/** Type guard to identify injected workflow crash errors. */
export declare function isInjectedWorkflowCrashError(error: unknown): error is InjectedWorkflowCrashError;
