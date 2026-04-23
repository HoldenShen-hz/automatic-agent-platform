/**
 * Data Plane CLI
 *
 * This module provides the command-line entry point for data plane operations.
 * It manages analytics facts, archive bundles, replay datasets, and data movement jobs
 * within the Automatic Agent system.
 *
 * Environment Variables (via loadDataPlaneCliEnv):
 *   - AA_DB_PATH: Path to the SQLite database
 *   - AA_DATA_PLANE_ACTION: Action to perform
 *   - AA_ARTIFACT_ROOT: Root directory for artifact storage
 *   - AA_NAMESPACE_ID: Namespace identifier for multi-tenant operations
 *   - AA_TENANT_ID: Tenant identifier
 *   - AA_SOURCE_NAMESPACE_ID: Source namespace for movement operations
 *   - AA_TARGET_NAMESPACE_ID: Target namespace for movement operations
 *
 * Actions:
 *   - create_analytics_fact: Create an analytics fact record
 *   - create_archive_bundle: Create an archive bundle
 *   - create_replay_dataset: Create a replay dataset
 *   - start_movement_job: Start a data movement job
 *   - complete_movement_job: Complete a data movement job
 *   - summary: Build and return a data plane summary
 *   - export: Export the data plane summary
 *
 * @see {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/architecture/00-platform-architecture.md | Architecture and Technical Design}
 * @see {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary and Terminology}
 */
export {};
