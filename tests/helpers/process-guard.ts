/**
 * Process Guard
 *
 * Provides process leak detection for tests per ADR-072.
 * Use in beforeEach/afterEach to detect leaked child processes.
 */

import { spawn } from 'node:child_process';
import { getProcessTracker } from '../../src/platform/execution/resource/process-tracker.js';

/**
 * Creates a process guard that tracks child processes spawned during a test.
 * Use in beforeEach to record baseline, and afterEach to assert no leaks.
 */
export function createProcessGuard(): {
  /**
   * Record baseline - call in beforeEach
   */
  capture(): void;
  /**
   * Assert no process leaks - call in afterEach
   */
  assertNoLeaks(): void;
} {
  let pidsBefore: number[] = [];
  const tracker = getProcessTracker();

  return {
    capture(): void {
      // Record current tracked processes
      pidsBefore = Array.from(tracker.getActive().map(p => p.pid));
    },

    assertNoLeaks(): void {
      const tracker = getProcessTracker();
      const activeAfter = tracker.getActive();
      const leaked = activeAfter.filter(p => {
        if (pidsBefore.includes(p.pid)) {
          return false;
        }

        try {
          process.kill(p.pid, 0);
          return true;
        } catch (error) {
          const code = (error as NodeJS.ErrnoException).code;
          if (code === 'ESRCH') {
            tracker.unregister(p.pid);
            return false;
          }
          return true;
        }
      });

      if (leaked.length > 0) {
        // Attempt to kill leaked processes
        for (const proc of leaked) {
          try {
            process.kill(proc.pid, 'SIGKILL');
          } catch {
            // Process may already be dead
          }
        }

        throw new Error(
          `Process leak detected: ${leaked.length} child process(es) not cleaned up: ` +
          leaked.map(p => `pid=${p.pid} cmd=${p.command} owner=${p.owner}`).join(', ')
        );
      }
    },
  };
}

/**
 * Wrapper for tests that spawn processes.
 * Automatically captures baseline and asserts no leaks.
 */
export function withProcessGuard(fn: () => Promise<void> | void): () => Promise<void> {
  const guard = createProcessGuard();

  return async () => {
    guard.capture();
    try {
      await fn();
    } finally {
      await new Promise(resolve => setTimeout(resolve, 150));
      guard.assertNoLeaks();
    }
  };
}
