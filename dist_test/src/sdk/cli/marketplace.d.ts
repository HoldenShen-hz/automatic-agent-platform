/**
 * Marketplace Governance CLI
 *
 * This module provides a command-line interface for managing extension packages
 * in the marketplace. It supports package registration, review workflows,
 * publication management, and catalog browsing for marketplace operators.
 *
 * Environment Variables (via loadMarketplaceCliEnv):
 *   - AA_DB_PATH: Path to the SQLite database
 *   - AA_MARKETPLACE_ACTION: Action to perform
 *   - AA_MARKETPLACE_ARTIFACT_ROOT: Optional artifact root directory
 *   - AA_MARKETPLACE_TENANT_ID: Tenant identifier
 *
 * Actions:
 *   - register_package: Register a new extension package in the marketplace
 *   - submit_review: Submit a package for review
 *   - decide_review: Approve or reject a package review
 *   - publish: Publish an approved package
 *   - revoke: Revoke a published package
 *   - summary: Build marketplace catalog summary
 *   - export: Export marketplace catalog with evidence
 *   - list_packages: List registered packages
 *   - list_reviews: List package reviews
 *   - list_publications: List package publications
 *   - list_reports: List generated reports
 *
 * @see {@link docs_zh/architecture/00-platform-architecture.md} for marketplace architecture
 * @see {@link docs_zh/governance/glossary_and_terminology.md} for marketplace terminology
 */
export {};
