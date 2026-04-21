/**
 * Process Tracker
 *
 * Unified tracking of all OS child processes per ADR-072.
 * All spawn() calls must register here. GracefulShutdown uses this to kill orphans.
 */
import { spawn } from 'node:child_process';
import { StructuredLogger } from '../../shared/observability/structured-logger.js';
const logger = new StructuredLogger();
function logDebug(message, data) {
    logger.log({ level: 'debug', message, ...data && { data } });
}
function logInfo(message, data) {
    logger.log({ level: 'info', message, ...data && { data } });
}
function logWarn(message, data) {
    logger.log({ level: 'warn', message, ...data && { data } });
}
function logError(message, data) {
    logger.log({ level: 'error', message, ...data && { data } });
}
/**
 * ProcessTracker maintains a registry of all child processes spawned by the runtime.
 * Used by GracefulShutdown to ensure all child processes are killed on exit,
 * and for monitoring zombie processes and process leaks.
 */
export class ProcessTracker {
    processes = new Map();
    /**
     * Register a newly spawned child process.
     * Must be called immediately after obtaining the pid, before any awaits or event bindings.
     */
    register(proc, owner, command, args = []) {
        if (!proc.pid) {
            logWarn('ProcessTracker.register called with invalid pid', { owner, command });
            return;
        }
        const procWithPgid = proc;
        const tracked = {
            pid: proc.pid,
            command,
            args,
            spawnedAt: Date.now(),
            owner,
            pgid: procWithPgid.pgid,
            state: 'running',
            killRequestedAt: undefined,
            lastSignal: undefined,
        };
        this.processes.set(proc.pid, tracked);
        logDebug('Child process registered', {
            pid: proc.pid,
            pgid: procWithPgid.pgid,
            owner,
            command,
        });
        // Auto-unregister on exit or close
        const cleanup = (code, signal) => {
            const existing = this.processes.get(proc.pid);
            if (existing) {
                existing.state = 'exited';
                logDebug('Child process exited', {
                    pid: proc.pid,
                    exitCode: code,
                    signal,
                    durationMs: Date.now() - existing.spawnedAt,
                    owner,
                });
                // Remove after a delay to allow close event to also fire
                setTimeout(() => {
                    this.processes.delete(proc.pid);
                }, 100).unref();
            }
        };
        proc.once('exit', cleanup);
        proc.once('close', () => {
            // Also handle close as backup cleanup
            const existing = this.processes.get(proc.pid);
            if (existing && existing.state === 'running') {
                existing.state = 'exited';
                this.processes.delete(proc.pid);
            }
        });
    }
    /**
     * Unregister a process by pid manually.
     */
    unregister(pid) {
        this.processes.delete(pid);
        logDebug('Child process unregistered', { pid });
    }
    /**
     * Get all active (running or terminating) processes.
     */
    getActive() {
        return Array.from(this.processes.values()).filter(p => p.state === 'running' || p.state === 'terminating');
    }
    /**
     * Get process count by owner category.
     */
    getCountByOwner() {
        const counts = {
            'bash-tool': 0,
            'mcp-transport': 0,
            'lsp-client': 0,
            'redis-cli': 0,
            'pg-cli': 0,
            'docker': 0,
            'exec-file': 0,
            'unknown': 0,
        };
        for (const p of this.getActive()) {
            counts[p.owner]++;
        }
        return counts;
    }
    /**
     * Get total active process count.
     */
    getActiveCount() {
        return this.getActive().length;
    }
    /**
     * Get zombie count (processes that have exited but not yet unregistered).
     */
    getZombieCount() {
        // On Linux, zombie processes have state 'Z' in ps output
        // We approximate by counting processes in 'exited' state that haven't been cleaned up
        return Array.from(this.processes.values()).filter(p => p.state === 'exited').length;
    }
    /**
     * Request termination of a specific process.
     *
     * Preferentially kills the process group if available to ensure
     * child processes are also terminated.
     */
    async kill(pid, signal = 'SIGTERM') {
        const tracked = this.processes.get(pid);
        if (!tracked) {
            logWarn('Attempted to kill unknown process', { pid, signal });
            return false;
        }
        try {
            tracked.lastSignal = signal;
            tracked.killRequestedAt = Date.now();
            tracked.state = 'terminating';
            // Prefer process group kill if available
            if (tracked.pgid && tracked.pgid !== pid) {
                process.kill(-tracked.pgid, signal);
                logInfo('Sent signal to process group', {
                    pid,
                    pgid: tracked.pgid,
                    signal,
                    owner: tracked.owner,
                });
            }
            else {
                process.kill(pid, signal);
                logInfo('Sent signal to process', {
                    pid,
                    signal,
                    owner: tracked.owner,
                });
            }
            return true;
        }
        catch (err) {
            const code = err.code;
            if (code === 'ESRCH') {
                // Process already dead
                this.processes.delete(pid);
                return true;
            }
            logError('Failed to send signal to process', {
                pid,
                signal,
                error: err instanceof Error ? err.message : String(err),
                owner: tracked.owner,
            });
            return false;
        }
    }
    /**
     * Kill all active processes with the given signal, then SIGKILL after delay.
     *
     * Used during graceful shutdown to ensure all child processes are terminated.
     */
    async killAll(signal = 'SIGTERM', forceKillDelayMs = 5000) {
        const active = this.getActive();
        if (active.length === 0)
            return;
        logWarn('Killing orphaned child processes', {
            count: active.length,
            signal,
        });
        // First pass: send signal to all
        await Promise.all(active.map(p => this.kill(p.pid, signal)));
        // Wait for graceful termination
        await new Promise(resolve => setTimeout(resolve, forceKillDelayMs));
        // Force kill any remaining
        const stillActive = this.getActive();
        if (stillActive.length > 0) {
            logWarn('Force killing remaining processes', {
                count: stillActive.length,
            });
            await Promise.all(stillActive.map(p => this.kill(p.pid, 'SIGKILL')));
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        // Check final state
        const remaining = this.getActive();
        if (remaining.length > 0) {
            logError('Failed to kill some processes', {
                count: remaining.length,
                pids: remaining.map(p => p.pid),
            });
        }
        else {
            logInfo('All child processes terminated', { count: active.length });
        }
    }
    /**
     * Reset the tracker (for testing).
     */
    reset() {
        this.processes.clear();
        logDebug('ProcessTracker reset');
    }
    /**
     * Get summary for health reporting.
     */
    getSummary() {
        return {
            active: this.getActiveCount(),
            zombie: this.getZombieCount(),
            byOwner: this.getCountByOwner(),
        };
    }
}
// Singleton instance
let trackerInstance = null;
/**
 * Gets the singleton ProcessTracker instance.
 */
export function getProcessTracker() {
    if (!trackerInstance) {
        trackerInstance = new ProcessTracker();
    }
    return trackerInstance;
}
/**
 * Resets the singleton tracker instance.
 */
export function resetProcessTracker() {
    if (trackerInstance) {
        trackerInstance.reset();
    }
    trackerInstance = null;
}
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
export function spawnTracked(tracker, command, args, options, owner = "unknown") {
    const spawnOpts = {
        cwd: options?.cwd,
        detached: options?.detached ?? process.platform !== "win32",
        env: options?.env,
        stdio: ["ignore", "pipe", "pipe"],
    };
    const child = spawn(command, args ?? [], spawnOpts);
    tracker.register(child, owner, command, args ? [...args] : []);
    return child;
}
//# sourceMappingURL=process-tracker.js.map