/**
 * Process Guard
 *
 * Provides process leak detection for tests per ADR-072.
 * Use in beforeEach/afterEach to detect leaked child processes.
 */
/**
 * Creates a process guard that tracks child processes spawned during a test.
 * Use in beforeEach to record baseline, and afterEach to assert no leaks.
 */
export declare function createProcessGuard(): {
    /**
     * Record baseline - call in beforeEach
     */
    capture(): void;
    /**
     * Assert no process leaks - call in afterEach
     */
    assertNoLeaks(): void;
};
/**
 * Wrapper for tests that spawn processes.
 * Automatically captures baseline and asserts no leaks.
 */
export declare function withProcessGuard(fn: () => Promise<void> | void): () => Promise<void>;
