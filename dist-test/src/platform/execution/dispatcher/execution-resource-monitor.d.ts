/**
 * @fileoverview Execution Resource Monitor - Scans active executions for resource ceiling violations.
 *
 * Monitors all active executions by querying the store for execution activity,
 * gathering resource usage from worker snapshots and agent execution records,
 * and evaluating against the resource ceiling guard.
 *
 * Use detect() to find all executions currently exceeding resource limits.
 *
 * @see Resource Ceiling Guard: execution-resource-ceiling-guard.ts
 */
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import { ExecutionResourceCeilingGuard, type ExecutionResourceCeilingFinding } from "./execution-resource-ceiling-guard.js";
/** Options for the resource monitor scan. */
export interface ExecutionResourceMonitorOptions {
    now?: string;
}
/**
 * Monitors active executions for resource ceiling violations.
 *
 * Scans all active execution activity in the store, retrieves associated
 * execution and agent execution records, gathers resource usage from worker
 * snapshots, and evaluates against the ceiling guard.
 *
 * Returns findings for any executions that have exceeded configured limits.
 */
export declare class ExecutionResourceMonitor {
    private readonly store;
    private readonly guard;
    constructor(store: AuthoritativeTaskStore, guard?: ExecutionResourceCeilingGuard);
    /**
     * Detects all active executions that are exceeding resource ceilings.
     *
     * Iterates through all active execution activity, builds resource usage
     * samples from execution and worker data, and returns ceiling violations.
     */
    detect(options?: ExecutionResourceMonitorOptions): ExecutionResourceCeilingFinding[];
}
