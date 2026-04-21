/**
 * @fileoverview PostgreSQL migrations for runtime, sessions, resources, and governance baseline.
 */
declare const MIGRATION_01_INITIAL_SCHEMA: import("./pg-schema-support.js").PostgresMigration;
/**
 * Migration 2: Execution core tables
 */
declare const MIGRATION_02_EXECUTION_CORE: import("./pg-schema-support.js").PostgresMigration;
/**
 * Migration 3: Worker, coordination, and queue tables
 */
declare const MIGRATION_03_WORKER_QUEUE: import("./pg-schema-support.js").PostgresMigration;
/**
 * Migration 4: Sessions, messaging, and logging tables
 */
declare const MIGRATION_04_SESSIONS_MESSAGING: import("./pg-schema-support.js").PostgresMigration;
/**
 * Migration 5: Events and approvals
 */
declare const MIGRATION_05_EVENTS_APPROVALS: import("./pg-schema-support.js").PostgresMigration;
/**
 * Migration 6: Resources, memory, and artifacts
 */
declare const MIGRATION_06_RESOURCES: import("./pg-schema-support.js").PostgresMigration;
/**
 * Migration 7: Billing and entitlements
 */
export { MIGRATION_01_INITIAL_SCHEMA, MIGRATION_02_EXECUTION_CORE, MIGRATION_03_WORKER_QUEUE, MIGRATION_04_SESSIONS_MESSAGING, MIGRATION_05_EVENTS_APPROVALS, MIGRATION_06_RESOURCES, };
