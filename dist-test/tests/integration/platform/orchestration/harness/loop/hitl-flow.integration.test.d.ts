/**
 * Integration Test: Harness HITL Flow
 *
 * Tests human-in-the-loop integration:
 * - runLoop with requiresHuman=true -> waiting_hitl -> resolveHitlReview(approved/rejected)
 * - Multiple HITL resolution scenarios
 * - HITL state transitions and persistence
 *
 * Uses in-memory SQLite and temp directories for integration testing.
 */
export {};
