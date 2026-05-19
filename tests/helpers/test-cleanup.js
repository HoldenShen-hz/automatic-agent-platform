import { execFileSync } from "node:child_process";
import { afterEach } from "node:test";
/**
 * Test Cleanup Helpers
 *
 * Provides unified singleton reset and process cleanup for tests per ADR-072.
 */
import { resetProcessTracker } from "../../src/platform/five-plane-execution/resource/process-tracker.js";
/**
 * Reset all global singletons and resources.
 * Call this in afterEach to ensure test isolation.
 */
export function resetAllSingletons() {
    // Reset ProcessTracker singleton
    resetProcessTracker();
}
/**
 * Get current child process IDs for leak detection.
 * Returns array of { pid, ppid, command } for processes that are children of the current process.
 */
export function getChildProcessSnapshot() {
    const output = execFileSync("ps", ["-axo", "pid=,ppid=,command="], { encoding: "utf8" });
    return output
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => {
        const match = line.match(/^(\d+)\s+(\d+)\s+(.*)$/);
        if (!match) {
            return null;
        }
        return {
            pid: Number(match[1]),
            ppid: Number(match[2]),
            command: match[3],
        };
    })
        .filter((entry) => entry != null && entry.ppid === process.pid);
}
afterEach(() => {
    resetAllSingletons();
});
//# sourceMappingURL=test-cleanup.js.map
