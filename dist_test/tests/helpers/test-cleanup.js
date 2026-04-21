/**
 * Test Cleanup Helpers
 *
 * Provides unified singleton reset and process cleanup for tests per ADR-072.
 */
import { resetProcessTracker } from '../../src/platform/execution/resource/process-tracker.js';
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
    // In Node.js test environment, we can't easily enumerate child processes
    // This is a placeholder that returns empty - actual implementation would
    // need platform-specific code (ps on Unix)
    return [];
}
//# sourceMappingURL=test-cleanup.js.map