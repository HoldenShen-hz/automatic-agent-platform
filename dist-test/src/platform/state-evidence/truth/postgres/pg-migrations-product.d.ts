/**
 * @fileoverview PostgreSQL migrations for billing, intelligence, PMF, and tenant product governance.
 */
declare const MIGRATION_07_BILLING: import("./pg-schema-support.js").PostgresMigration;
/**
 * Migration 8: Intelligence and action systems
 */
declare const MIGRATION_08_INTELLIGENCE: import("./pg-schema-support.js").PostgresMigration;
/**
 * Migration 9: HITL, evolution, and governance
 */
declare const MIGRATION_09_GOVERNANCE: import("./pg-schema-support.js").PostgresMigration;
/**
 * Migration 10: PMF validation
 */
declare const MIGRATION_10_PMF: import("./pg-schema-support.js").PostgresMigration;
/**
 * Migration 11: Completes tenant-scoped product/governance coverage and PG parity for marketplace tables.
 */
declare const MIGRATION_11_PRODUCT_GOVERNANCE_TENANT_SCOPE: import("./pg-schema-support.js").PostgresMigration;
declare const MIGRATION_12_AUTHORITATIVE_ASYNC_PARITY: import("./pg-schema-support.js").PostgresMigration;
declare const MIGRATION_13_KNOWLEDGE_SEMANTIC_VECTORS: import("./pg-schema-support.js").PostgresMigration;
export { MIGRATION_07_BILLING, MIGRATION_08_INTELLIGENCE, MIGRATION_09_GOVERNANCE, MIGRATION_10_PMF, MIGRATION_11_PRODUCT_GOVERNANCE_TENANT_SCOPE, MIGRATION_12_AUTHORITATIVE_ASYNC_PARITY, MIGRATION_13_KNOWLEDGE_SEMANTIC_VECTORS, };
