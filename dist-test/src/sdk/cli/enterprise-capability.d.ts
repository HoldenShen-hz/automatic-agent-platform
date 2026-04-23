/**
 * Enterprise Capability Matrix CLI
 *
 * This module provides a command-line interface for managing environment readiness
 * assessment and capability matrix reporting. It tracks which enterprise capabilities
 * are available per environment and deployment mode.
 *
 * Environment Variables (via loadEnterpriseCapabilityCliEnv):
 *   - AA_DB_PATH: Path to the SQLite database
 *   - AA_ENTERPRISE_CAPABILITY_ACTION: Action to perform
 *   - AA_ENTERPRISE_CAPABILITY_ARTIFACT_ROOT: Optional artifact root directory
 *
 * Actions:
 *   - register_readiness: Register environment readiness status for a component
 *   - summary: Build capability matrix summary
 *   - export: Export capability matrix with evidence
 *   - list_readiness: List all readiness registrations
 *   - list_reports: List generated reports
 *
 * @see {@link docs_zh/architecture/00-platform-architecture.md} for enterprise capability architecture
 * @see {@link docs_zh/governance/glossary_and_terminology.md} for capability terminology
 */
export {};
