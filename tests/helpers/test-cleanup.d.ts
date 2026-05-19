/**
 * Test Cleanup Helpers
 *
 * Provides unified singleton reset and process cleanup for tests per ADR-072.
 */
/**
 * Reset all global singletons and resources.
 * Call this in afterEach to ensure test isolation.
 */
export declare function resetAllSingletons(): void;
/**
 * Get current child process IDs for leak detection.
 * Returns array of { pid, ppid, command } for processes that are children of the current process.
 */
export declare function getChildProcessSnapshot(): Array<{
    pid: number;
    ppid: number;
    command: string;
}>;
