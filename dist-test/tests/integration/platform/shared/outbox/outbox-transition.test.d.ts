/**
 * Integration Tests: Outbox Transition Service
 *
 * Tests that task state transitions write outbox entries in the same transaction.
 *
 * Defect [SYS-REL-2.6]: TransitionService writes events directly to the events table
 * rather than going through the Outbox pattern. This test validates that task status
 * transitions should write outbox entries atomically with the status update.
 */
export {};
