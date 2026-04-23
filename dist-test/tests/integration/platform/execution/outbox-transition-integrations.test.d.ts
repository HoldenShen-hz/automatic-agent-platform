/**
 * [SYS-REL-2.6] Outbox Not In Critical Write Path Tests
 *
 * Tests that task state transitions write outbox entries in the same
 * transaction as the status change.
 *
 * Defect: transition-service.ts task status transitions write events directly
 * to the events table without going through the Outbox pattern.
 */
export {};
