/**
 * @fileoverview [SYS-PERF-3.2] Redis Lock Adapter KEYS Command Tests
 *
 * Regression tests for SYS-PERF-3.2: Redis KEYS command blocking
 *
 * The redis-lock-adapter.ts uses .keys() which blocks the Redis event loop.
 * Must use SCAN instead for production safety.
 */
export {};
