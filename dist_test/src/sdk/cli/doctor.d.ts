/**
 * Doctor CLI Tool
 *
 * This module provides a diagnostic utility that checks the health and consistency
 * of the authoritative SQLite database and runtime components. It aggregates checks from
 * multiple services (HealthService, StartupConsistencyChecker, StalledExecutionDetector,
 * etc.) and outputs a comprehensive JSON report of system state.
 *
 * Usage: AA_DB_PATH=/path/to/db npm run doctor
 *
 * @see {@link docs_zh/contracts/runtime_execution_contract.md} - Runtime execution model
 * @see {@link docs_zh/contracts/observability_contract.md} - Health and observability
 * @see {@link docs_zh/contracts/debug_inspect_health_backpressure_contract.md} - Health diagnostics
 * @see {@link docs_zh/contracts/startup_consistency_and_recovery_drill_contract.md} - Startup consistency
 * @see {@link docs_zh/contracts/storage_schema_contract.md} - SQLite schema
 * @see {@link docs_zh/governance/glossary_and_terminology.md} - Glossary
 * @see {@link docs_zh/architecture/00-platform-architecture.md} - Architecture
 */
export {};
