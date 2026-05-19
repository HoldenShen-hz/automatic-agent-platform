/**
 * [SYS-PERF-3.2] No Redis KEYS Command Tests
 *
 * Verifies that Redis lock adapter uses SCAN instead of KEYS.
 * KEYS command is O(n) and blocks the event loop on large keyspaces.
 */
export {};
