/**
 * E2E Distributed Lock Tests
 *
 * End-to-end tests for distributed locking using SQLite lock adapter.
 * Tests lock acquisition, release, fencing tokens, force steal, and inspection.
 *
 * Coverage:
 * 1. Lock acquisition and release
 * 2. Fencing token generation and incrementing
 * 3. Force steal of locks
 * 4. Lock inspection
 * 5. Multiple concurrent lock owners
 * 6. Stale lock eviction
 */
export {};
