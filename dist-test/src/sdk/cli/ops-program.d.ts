/**
 * Operations Program CLI
 *
 * This module provides the command-line entry point for the Operations Program service.
 * It runs operational diagnostics, health checks, and governance reporting for the
 * Automatic Agent system. It orchestrates multiple services including health monitoring,
 * diagnostics, doctor checks, and observability retention management.
 *
 * Environment Variables (via loadOpsProgramCliEnv):
 *   - AA_DB_PATH: Path to the SQLite database
 *   - AA_ENVIRONMENT: The environment name (development, staging, production)
 *   - AA_OPS_PROGRAM_ACTION: Action to perform (summary, export)
 *   - AA_OPS_PROGRAM_ARTIFACT_ROOT: Root directory for artifact storage
 *
 * Actions:
 *   - summary: Build and return an operational report
 *   - export: Export the operational report
 *
 * @see {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/architecture/00-platform-architecture.md | Architecture and Technical Design}
 * @see {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary and Terminology}
 */
export {};
