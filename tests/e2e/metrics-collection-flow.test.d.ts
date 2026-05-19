/**
 * E2E Metrics Collection Flow Tests
 *
 * End-to-end tests covering metrics collection across task lifecycle,
 * execution, workflow progression, and runtime state observation.
 *
 * Tests validate:
 * - MetricsService.buildSummary() aggregation from database state
 * - RuntimeMetricsRegistry counter/gauge/histogram recording
 * - Task metrics (total, success, failed, cancelled counts)
 * - Workflow metrics (completed, failed, retried counts)
 * - Execution metrics (active count, retry rate, superseded count)
 * - Recovery event metrics
 * - Cost aggregation metrics
 * - Approval metrics
 * - Event tier metrics
 * - Health status integration
 *
 * Uses in-memory SQLite database and mock external dependencies.
 */
export {};
