/**
 * High Availability Program CLI
 *
 * This module provides the command-line entry point for the HA Program service.
 * It generates reports on system health, availability, and resilience metrics
 * for the Automatic Agent system. The service analyzes runtime data to produce
 * comprehensive HA assessments.
 *
 * Environment Variables:
 *   - AA_DB_PATH: Path to the SQLite database (required)
 *   - AA_ENVIRONMENT: The environment name (required)
 *   - AA_HA_PROGRAM_ACTION: Action to perform (summary, export)
 *   - AA_HA_PROGRAM_ARTIFACT_ROOT: Root directory for artifact storage
 *
 * Actions:
 *   - summary: Build and return an HA program report (default)
 *   - export: Export the HA program report
 *
 * @see {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/architecture/00-platform-architecture.md | Architecture and Technical Design}
 * @see {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary and Terminology}
 */
export {};
