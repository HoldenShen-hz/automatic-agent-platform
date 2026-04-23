/**
 * E2E Execution Flow Tests
 *
 * End-to-end tests covering the complete task execution flow from creation
 * through dispatch, execution, and completion.
 *
 * Tests validate:
 * - Task lifecycle transitions (queued -> pending -> in_progress -> done/failed)
 * - Execution state machine transitions
 * - Workflow state progression through steps
 * - Session status changes during execution
 * - Multi-step orchestration with output aggregation
 * - Error handling and failure recovery paths
 *
 * These tests use in-memory SQLite database and mock external dependencies.
 */
export {};
