/**
 * Orphan Cleanup CLI Tool
 *
 * This module provides a command-line interface for detecting and removing
 * orphaned execution records that have become inconsistent with worker
 * lease state. It supports both preview (scan) and enforce (repair) modes.
 *
 * Usage:
 *   npm run orphan-cleanup              # Preview orphaned records
 *   AA_ORPHAN_CLEANUP_ACTION=repair npm run orphan-cleanup  # Apply fixes
 *
 * Environment Variables:
 *   - AA_ORPHAN_CLEANUP_ACTION: "scan" (default) or "repair"
 *   - AA_OCCURRED_AT: ISO timestamp for the operation
 *
 * @see {@link docs_zh/contracts/runtime_execution_contract.md} - Runtime execution
 * @see {@link docs_zh/contracts/idempotency_and_recovery_matrix_contract.md} - Recovery
 * @see {@link docs_zh/governance/glossary_and_terminology.md} - Glossary
 * @see {@link docs_zh/architecture/00-platform-architecture.md} - Architecture
 */
export {};
