/**
 * Test Cleanup Helpers
 *
 * Provides unified singleton reset and process cleanup for tests per ADR-072.
 */

import { getProcessTracker, resetProcessTracker } from "../../src/platform/five-plane-execution/resource/process-tracker.js";

/**
 * Reset all global singletons and resources.
 * Call this in afterEach to ensure test isolation.
 */
export function resetAllSingletons(): void {
  // Reset ProcessTracker singleton
  resetProcessTracker();
}

/**
 * Get current child process IDs for leak detection.
 * Returns array of { pid, ppid, command } for processes that are children of the current process.
 */
export function getChildProcessSnapshot(): Array<{ pid: number; ppid: number; command: string }> {
  return getProcessTracker()
    .getActive()
    .map((entry) => ({
      pid: entry.pid,
      ppid: process.pid,
      command: entry.command,
    }));
}

export function registerDefaultTestCleanup(
  registerAfterEach: (cleanup: () => void) => void,
): void {
  registerAfterEach(() => {
    resetAllSingletons();
  });
}
