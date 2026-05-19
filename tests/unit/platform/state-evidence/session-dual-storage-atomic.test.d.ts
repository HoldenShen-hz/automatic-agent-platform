/**
 * @fileoverview Tests for Session Dual Storage Non-Atomic Write Issue
 *
 * Tests the defect where two appendFileSync calls in session-dual-storage.ts
 * can result in inconsistent state if crash occurs between them.
 *
 * @see SYS-REL-2.8, manual §26.5
 */
export {};
