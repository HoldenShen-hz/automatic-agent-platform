/**
 * Process Tracker
 *
 * Unified tracking of all OS child processes per ADR-072.
 * All spawn() calls must register here. GracefulShutdown uses this to kill orphans.
 */
import { type ChildProcess } from 'node:child_process';
/** Category of process owner for accounting */
export type ProcessOwner = 'bash-tool' | 'mcp-transport' | 'lsp-client' | 'redis-cli' | 'pg-cli' | 'docker' | 'exec-file' | 'unknown';
/** State of a tracked process */
export type TrackedProcessState = 'running' | 'terminating' | 'killed' | 'exited';
/**
 * A tracked child process with metadata for monitoring and cleanup.
 */
export interface TrackedProcess {
    pid: number;
    command: string;
    args: string[];
    spawnedAt: number;
    owner: ProcessOwner;
    pgid: number | undefined;
    state: TrackedProcessState;
    killRequestedAt: number | undefined;
    lastSignal: string | undefined;
}
/**
 * ProcessTracker maintains a registry of all child processes spawned by the runtime.
 * Used by GracefulShutdown to ensure all child processes are killed on exit,
 * and for monitoring zombie processes and process leaks.
 */
export declare class ProcessTracker {
    private readonly processes;
    /**
     * Register a newly spawned child process.
     * Must be called immediately after obtaining the pid, before any awaits or event bindings.
     */
    register(proc: ChildProcess, owner: ProcessOwner, command: string, args?: string[]): void;
    /**
     * Unregister a process by pid manually.
     */
    unregister(pid: number): void;
    /**
     * Get all active (running or terminating) processes.
     */
    getActive(): TrackedProcess[];
    /**
     * Get process count by owner category.
     */
    getCountByOwner(): Record<ProcessOwner, number>;
    /**
     * Get total active process count.
     */
    getActiveCount(): number;
    /**
     * Get zombie count (processes that have exited but not yet unregistered).
     */
    getZombieCount(): number;
    /**
     * Request termination of a specific process.
     *
     * Preferentially kills the process group if available to ensure
     * child processes are also terminated.
     */
    kill(pid: number, signal?: string): Promise<boolean>;
    /**
     * Kill all active processes with the given signal, then SIGKILL after delay.
     *
     * Used during graceful shutdown to ensure all child processes are terminated.
     */
    killAll(signal?: string, forceKillDelayMs?: number): Promise<void>;
    /**
     * Reset the tracker (for testing).
     */
    reset(): void;
    /**
     * Get summary for health reporting.
     */
    getSummary(): {
        active: number;
        zombie: number;
        byOwner: Record<ProcessOwner, number>;
    };
}
/**
 * Gets the singleton ProcessTracker instance.
 */
export declare function getProcessTracker(): ProcessTracker;
/**
 * Resets the singleton tracker instance.
 */
export declare function resetProcessTracker(): void;
/**
 * Spawns a child process and registers it with the ProcessTracker.
 *
 * This is the preferred way to spawn child processes in the runtime,
 * as it ensures proper tracking and cleanup.
 *
 * @param tracker - The ProcessTracker instance to register with
 * @param command - The command to spawn
 * @param args - Command arguments
 * @param options - Spawn options
 * @param owner - Category of process owner for accounting
 * @returns The spawned ChildProcess
 */
export declare function spawnTracked(tracker: ProcessTracker, command: string, args?: readonly string[], options?: {
    cwd?: string;
    detached?: boolean;
    env?: Record<string, string>;
}, owner?: ProcessOwner): ChildProcess;
