/**
 * Compliance Program CLI
 *
 * This module provides a command-line interface for compliance program reporting.
 * It generates compliance reports based on configured policies and evidence,
 * supporting both summary and export formats.
 *
 * Environment Variables:
 *   - AA_DB_PATH: Path to the SQLite database (required)
 *   - AA_COMPLIANCE_PROGRAM_ACTION: Action to perform - "summary" (default) or "export"
 *   - AA_COMPLIANCE_PROGRAM_ARTIFACT_ROOT: Optional root directory for artifact storage
 *
 * Actions:
 *   - summary: Build and return compliance report (default)
 *   - export: Export compliance report with all evidence
 *
 * @see {@link docs_zh/architecture/00-platform-architecture.md} for compliance architecture
 * @see {@link docs_zh/governance/glossary_and_terminology.md} for compliance terminology
 */
export {};
