/**
 * Process Tracker
 *
 * Unified tracking of all OS child processes per ADR-072.
 * All spawn() calls must register here. GracefulShutdown uses this to kill orphans.
 */

import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { StructuredLogger } from '../../shared/observability/structured-logger.js';

const logger = new StructuredLogger();

function logDebug(message: string, data?: Record<string, unknown>): void {
  logger.log({ level: 'debug', message, ...data && { data } });
}

function logInfo(message: string, data?: Record<string, unknown>): void {
  logger.log({ level: 'info', message, ...data && { data } });
}

function logWarn(message: string, data?: Record<string, unknown>): void {
  logger.log({ level: 'warn', message, ...data && { data } });
}

function logError(message: string, data?: Record<string, unknown>): void {
  logger.log({ level: 'error', message, ...data && { data } });
}

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

// Extended ChildProcess with pgid (available when spawned with detached: true)
interface ChildProcessWithPgid extends ChildProcess {
  pgid?: number;
}

/**
 * ProcessTracker maintains a registry of all child processes spawned by the runtime.
 * Used by GracefulShutdown to ensure all child processes are killed on exit,
 * and for monitoring zombie processes and process leaks.
 */
export class ProcessTracker {
  private readonly processes = new Map<number, TrackedProcess>();

  /**
   * Register a newly spawned child process.
   * Must be called immediately after obtaining the pid, before any awaits or event bindings.
   */
  register(proc: ChildProcess, owner: ProcessOwner, command: string, args: string[] = []): void {
    if (!proc.pid) {
      logWarn('ProcessTracker.register called with invalid pid', { owner, command });
      return;
    }

    const procWithPgid = proc as ChildProcessWithPgid;

    const tracked: TrackedProcess = {
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
    const cleanup = (code: number | null, signal: string | null) => {
      const existing = this.processes.get(proc.pid!);
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
          this.processes.delete(proc.pid!);
        }, 100).unref();
      }
    };

    proc.once('exit', cleanup);
    proc.once('close', () => {
      // Also handle close as backup cleanup
      const existing = this.processes.get(proc.pid!);
      if (existing && existing.state === 'running') {
        existing.state = 'exited';
        this.processes.delete(proc.pid!);
      }
    });
  }

  /**
   * Unregister a process by pid manually.
   */
  unregister(pid: number): void {
    this.processes.delete(pid);
    logDebug('Child process unregistered', { pid });
  }

  /**
   * Get all active (running or terminating) processes.
   */
  getActive(): TrackedProcess[] {
    return Array.from(this.processes.values()).filter(
      p => p.state === 'running' || p.state === 'terminating'
    );
  }

  /**
   * Get process count by owner category.
   */
  getCountByOwner(): Record<ProcessOwner, number> {
    const counts: Record<ProcessOwner, number> = {
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
  getActiveCount(): number {
    return this.getActive().length;
  }

  /**
   * Get zombie count (processes that have exited but not yet unregistered).
   */
  getZombieCount(): number {
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
  async kill(pid: number, signal: string = 'SIGTERM'): Promise<boolean> {
    const tracked = this.processes.get(pid);
    if (!tracked) {
      logWarn('Attempted to kill unknown process', { pid, signal });
      return false;
    }

    try {
      tracked.lastSignal = signal;
      tracked.killRequestedAt = Date.now();
      tracked.state = signal === 'SIGKILL' ? 'killed' : 'terminating';

      // Prefer process group kill if available
      if (tracked.pgid && tracked.pgid !== pid) {
        process.kill(-tracked.pgid, signal);
        logInfo('Sent signal to process group', {
          pid,
          pgid: tracked.pgid,
          signal,
          owner: tracked.owner,
        });
      } else {
        process.kill(pid, signal);
        logInfo('Sent signal to process', {
          pid,
          signal,
          owner: tracked.owner,
        });
      }
      if (signal === 'SIGKILL') {
        this.processes.delete(pid);
      }
      return true;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
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
  async killAll(signal: string = 'SIGTERM', forceKillDelayMs: number = 5000): Promise<void> {
    const active = this.getActive();
    if (active.length === 0) return;

    logWarn('Killing orphaned child processes', {
      count: active.length,
      signal,
    });

    // First pass: send signal to all
    await Promise.all(
      active.map(p => this.kill(p.pid, signal))
    );

    // Wait for graceful termination
    await new Promise(resolve => setTimeout(resolve, forceKillDelayMs));

    // Force kill any remaining
    const stillActive = this.getActive();
    if (stillActive.length > 0) {
      logWarn('Force killing remaining processes', {
        count: stillActive.length,
      });
      await Promise.all(
        stillActive.map(p => this.kill(p.pid, 'SIGKILL'))
      );
    }

    // Check final state
    const remaining = this.getActive();
    if (remaining.length > 0) {
      logError('Failed to kill some processes', {
        count: remaining.length,
        pids: remaining.map(p => p.pid),
      });
    } else {
      logInfo('All child processes terminated', { count: active.length });
    }
  }

  /**
   * Reset the tracker (for testing).
   */
  reset(): void {
    this.processes.clear();
    logDebug('ProcessTracker reset');
  }

  /**
   * Get summary for health reporting.
   */
  getSummary(): {
    active: number;
    zombie: number;
    byOwner: Record<ProcessOwner, number>;
  } {
    return {
      active: this.getActiveCount(),
      zombie: this.getZombieCount(),
      byOwner: this.getCountByOwner(),
    };
  }
}

// Singleton instance
let trackerInstance: ProcessTracker | null = null;

/**
 * Gets the singleton ProcessTracker instance.
 */
export function getProcessTracker(): ProcessTracker {
  if (!trackerInstance) {
    trackerInstance = new ProcessTracker();
  }
  return trackerInstance;
}

/**
 * Resets the singleton tracker instance.
 */
export function resetProcessTracker(): void {
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
export function spawnTracked(
  tracker: ProcessTracker,
  command: string,
  args?: readonly string[],
  options?: {
    cwd?: string;
    detached?: boolean;
    env?: Record<string, string>;
    unref?: boolean;
  },
  owner: ProcessOwner = "unknown",
): ChildProcess {
  const spawnOpts: SpawnOptions = {
    cwd: options?.cwd,
    detached: options?.detached ?? process.platform !== "win32",
    env: options?.env,
    stdio: ["ignore", "pipe", "pipe"],
  };

  const child = spawn(command, args ?? [], spawnOpts);
  if (spawnOpts.detached && options?.unref !== false && process.platform !== "win32") {
    child.unref();
  }

  tracker.register(child, owner, command, args ? [...args] : []);

  return child;
}
