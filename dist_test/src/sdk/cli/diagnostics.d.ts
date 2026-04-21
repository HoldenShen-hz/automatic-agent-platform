/**
 * Diagnostics CLI
 *
 * This module provides a command-line interface for generating various diagnostic
 * reports about tasks and system health. It supports snapshots, debug dumps,
 * incident timelines, repro bundles, stalled execution escalations, and metrics.
 *
 * Environment Variables (via loadDiagnosticsCliEnv):
 *   - AA_DB_PATH: Optional custom path to the SQLite database file
 *   - AA_DIAGNOSTICS_KIND: Type of diagnostic to generate (required)
 *   - AA_TASK_ID: Target task identifier (required for most diagnostics)
 *   - AA_ARTIFACT_ROOT: Root directory for artifact export
 *
 * Kinds:
 *   - snapshot: Build a task state snapshot
 *   - debug: Build a debug dump with full context
 *   - incident: Build an incident timeline report
 *   - remote-timeline: Build a remote timeline report
 *   - repro: Build a minimal repro bundle
 *   - export: Export minimal repro bundle to disk
 *   - stalled-escalation: List stalled execution escalation packages
 *   - stalled-escalation-export: Export stalled escalations to disk
 *   - incident-export: Export incident timeline to disk
 *   - metrics: Build system metrics summary
 *
 * @see {@link docs_zh/architecture/00-platform-architecture.md} for diagnostics architecture
 * @see {@link docs_zh/contracts/observability_contract.md} for health and diagnostics contracts
 */
export {};
