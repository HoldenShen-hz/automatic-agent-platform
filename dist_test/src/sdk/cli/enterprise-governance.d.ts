/**
 * Enterprise Governance CLI
 *
 * This module provides a command-line interface for enterprise governance oversight,
 * including dependency manifest tracking, health monitoring, diagnostics, and
 * operational status reporting across enterprise deployments.
 *
 * Environment Variables (via loadEnterpriseGovernanceCliEnv):
 *   - AA_DB_PATH: Path to the SQLite database
 *   - AA_ENTERPRISE_GOVERNANCE_ACTION: Action to perform - "build_report" (default) or "export"
 *   - AA_ENVIRONMENT: Target environment (dev, staging, prod)
 *   - AA_ARTIFACT_ROOT: Optional root directory for artifact storage
 *   - AA_TASK_ID: Optional task identifier for report filtering
 *   - AA_SHIFT_OWNER: Optional shift owner for operations
 *   - AA_DEPENDENCY_MANIFEST_PATH: Optional path to dependency manifest
 *   - AA_DEPENDENCY_LOCKFILE_PATH: Optional path to dependency lockfile
 *
 * @see {@link docs_zh/architecture/00-platform-architecture.md} for governance architecture
 * @see {@link docs_zh/contracts/enterprise_governance_contract.md} for governance contracts
 */
export {};
