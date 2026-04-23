/**
 * Integration Test: Harness Lifecycle - Full Loop
 *
 * Tests the complete lifecycle of a harness run including:
 * - createRun -> appendStep -> sleep -> recover -> resume
 * - Context assembly and snapshotting
 * - Checkpoint/restore flow
 * - Guardrail evaluation in context of full loop
 *
 * Uses in-memory SQLite and temp directories for integration testing.
 */
export {};
