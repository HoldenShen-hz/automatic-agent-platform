import { getProcessTracker, resetProcessTracker } from "../platform/five-plane-execution/resource/process-tracker.js";

export function resetAllSingletons(): void {
  resetProcessTracker();
}

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
