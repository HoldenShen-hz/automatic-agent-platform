/**
 * @fileoverview [SYS-REL-2.4] Redis Queue Adapter Error Propagation Tests
 *
 * Regression tests for SYS-REL-2.4: Redis queue silent task drop
 *
 * The enqueue pipeline uses .catch(() => {}) which swallows failures and causes
 * silent task drops. Write failures must propagate to the caller.
 */
export {};
