/**
 * [SYS-PERF-3.1] StructuredLogger Synchronous I/O Blocking Event Loop Tests
 *
 * Tests to verify that the StructuredLogger does not block the event loop
 * for more than 1ms per write.
 *
 * Defect: structured-logger.ts:295 uses appendFileSync which blocks the
 * event loop synchronously on every log write.
 */
export {};
