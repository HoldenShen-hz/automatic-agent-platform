import assert from "node:assert/strict";
import test from "node:test";

import {
  MIGRATION_01_INITIAL_SCHEMA,
  MIGRATION_02_EXECUTION_CORE,
  MIGRATION_03_WORKER_QUEUE,
  MIGRATION_04_SESSIONS_MESSAGING,
  MIGRATION_05_EVENTS_APPROVALS,
  MIGRATION_06_RESOURCES,
} from "../../../../../../src/platform/five-plane-state-evidence/truth/postgres/pg-migrations-runtime.js";

test("MIGRATION_01_INITIAL_SCHEMA is exported and has valid structure", () => {
  assert.equal(MIGRATION_01_INITIAL_SCHEMA.version, 1);
  assert.equal(MIGRATION_01_INITIAL_SCHEMA.name, "initial_schema");
  assert.ok(typeof MIGRATION_01_INITIAL_SCHEMA.ddl === "string");
  assert.ok(MIGRATION_01_INITIAL_SCHEMA.ddl.length > 0);
  assert.ok(typeof MIGRATION_01_INITIAL_SCHEMA.checksum === "string");
  assert.equal(MIGRATION_01_INITIAL_SCHEMA.checksum.length, 64); // SHA256 hex
  assert.ok(typeof MIGRATION_01_INITIAL_SCHEMA.downDdl === "string");
});

test("MIGRATION_02_EXECUTION_CORE is exported and has valid structure", () => {
  assert.equal(MIGRATION_02_EXECUTION_CORE.version, 2);
  assert.equal(MIGRATION_02_EXECUTION_CORE.name, "execution_core");
  assert.ok(typeof MIGRATION_02_EXECUTION_CORE.ddl === "string");
  assert.ok(MIGRATION_02_EXECUTION_CORE.ddl.includes("CREATE TABLE IF NOT EXISTS cost_events"));
  assert.ok(MIGRATION_02_EXECUTION_CORE.ddl.includes("CREATE TABLE IF NOT EXISTS executions"));
  assert.ok(MIGRATION_02_EXECUTION_CORE.ddl.includes("CREATE TABLE IF NOT EXISTS dead_letters"));
  assert.equal(MIGRATION_02_EXECUTION_CORE.checksum.length, 64);
});

test("MIGRATION_03_WORKER_QUEUE is exported and has valid structure", () => {
  assert.equal(MIGRATION_03_WORKER_QUEUE.version, 3);
  assert.equal(MIGRATION_03_WORKER_QUEUE.name, "worker_queue");
  assert.ok(typeof MIGRATION_03_WORKER_QUEUE.ddl === "string");
  assert.ok(MIGRATION_03_WORKER_QUEUE.ddl.includes("CREATE TABLE IF NOT EXISTS worker_snapshots"));
  assert.ok(MIGRATION_03_WORKER_QUEUE.ddl.includes("CREATE TABLE IF NOT EXISTS execution_tickets"));
  assert.ok(MIGRATION_03_WORKER_QUEUE.ddl.includes("CREATE TABLE IF NOT EXISTS execution_leases"));
  assert.equal(MIGRATION_03_WORKER_QUEUE.checksum.length, 64);
});

test("MIGRATION_04_SESSIONS_MESSAGING is exported and has valid structure", () => {
  assert.equal(MIGRATION_04_SESSIONS_MESSAGING.version, 4);
  assert.equal(MIGRATION_04_SESSIONS_MESSAGING.name, "sessions_messaging");
  assert.ok(typeof MIGRATION_04_SESSIONS_MESSAGING.ddl === "string");
  assert.ok(MIGRATION_04_SESSIONS_MESSAGING.ddl.includes("CREATE TABLE IF NOT EXISTS sessions"));
  assert.ok(MIGRATION_04_SESSIONS_MESSAGING.ddl.includes("CREATE TABLE IF NOT EXISTS messages"));
  assert.ok(MIGRATION_04_SESSIONS_MESSAGING.ddl.includes("CREATE TABLE IF NOT EXISTS remote_log_entries"));
  assert.equal(MIGRATION_04_SESSIONS_MESSAGING.checksum.length, 64);
});

test("MIGRATION_05_EVENTS_APPROVALS is exported and has valid structure", () => {
  assert.equal(MIGRATION_05_EVENTS_APPROVALS.version, 5);
  assert.equal(MIGRATION_05_EVENTS_APPROVALS.name, "events_approvals");
  assert.ok(typeof MIGRATION_05_EVENTS_APPROVALS.ddl === "string");
  assert.ok(MIGRATION_05_EVENTS_APPROVALS.ddl.includes("CREATE TABLE IF NOT EXISTS events"));
  assert.ok(MIGRATION_05_EVENTS_APPROVALS.ddl.includes("CREATE TABLE IF NOT EXISTS approvals"));
  assert.equal(MIGRATION_05_EVENTS_APPROVALS.checksum.length, 64);
});

test("MIGRATION_06_RESOURCES is exported and has valid structure", () => {
  assert.equal(MIGRATION_06_RESOURCES.version, 6);
  assert.equal(MIGRATION_06_RESOURCES.name, "resources");
  assert.ok(typeof MIGRATION_06_RESOURCES.ddl === "string");
  assert.ok(MIGRATION_06_RESOURCES.ddl.includes("CREATE TABLE IF NOT EXISTS file_locks"));
  assert.ok(MIGRATION_06_RESOURCES.ddl.includes("CREATE TABLE IF NOT EXISTS memories"));
  assert.ok(MIGRATION_06_RESOURCES.ddl.includes("CREATE TABLE IF NOT EXISTS artifacts"));
  assert.equal(MIGRATION_06_RESOURCES.checksum.length, 64);
});

test("migrations are in sequential version order", () => {
  assert.equal(MIGRATION_01_INITIAL_SCHEMA.version, 1);
  assert.equal(MIGRATION_02_EXECUTION_CORE.version, 2);
  assert.equal(MIGRATION_03_WORKER_QUEUE.version, 3);
  assert.equal(MIGRATION_04_SESSIONS_MESSAGING.version, 4);
  assert.equal(MIGRATION_05_EVENTS_APPROVALS.version, 5);
  assert.equal(MIGRATION_06_RESOURCES.version, 6);
});

test("all migrations have unique names", () => {
  const names = [
    MIGRATION_01_INITIAL_SCHEMA.name,
    MIGRATION_02_EXECUTION_CORE.name,
    MIGRATION_03_WORKER_QUEUE.name,
    MIGRATION_04_SESSIONS_MESSAGING.name,
    MIGRATION_05_EVENTS_APPROVALS.name,
    MIGRATION_06_RESOURCES.name,
  ];
  const uniqueNames = new Set(names);
  assert.equal(uniqueNames.size, names.length);
});

test("all migrations have non-empty DDL with trailing newline", () => {
  const migrations = [
    MIGRATION_01_INITIAL_SCHEMA,
    MIGRATION_02_EXECUTION_CORE,
    MIGRATION_03_WORKER_QUEUE,
    MIGRATION_04_SESSIONS_MESSAGING,
    MIGRATION_05_EVENTS_APPROVALS,
    MIGRATION_06_RESOURCES,
  ];
  for (const migration of migrations) {
    assert.ok(migration.ddl.length > 0, `Migration ${migration.name} has empty DDL`);
    assert.ok(migration.ddl.endsWith("\n"), `Migration ${migration.name} DDL should end with newline`);
  }
});

test("all migrations have valid SHA256 checksums", () => {
  const migrations = [
    MIGRATION_01_INITIAL_SCHEMA,
    MIGRATION_02_EXECUTION_CORE,
    MIGRATION_03_WORKER_QUEUE,
    MIGRATION_04_SESSIONS_MESSAGING,
    MIGRATION_05_EVENTS_APPROVALS,
    MIGRATION_06_RESOURCES,
  ];
  for (const migration of migrations) {
    assert.equal(
      migration.checksum.length,
      64,
      `Migration ${migration.name} should have 64-char SHA256 checksum`,
    );
    assert.ok(
      /^[a-f0-9]+$/.test(migration.checksum),
      `Migration ${migration.name} checksum should be valid hex`,
    );
  }
});

test("execution core migration includes required indexes", () => {
  const ddl = MIGRATION_02_EXECUTION_CORE.ddl;
  assert.ok(ddl.includes("CREATE INDEX IF NOT EXISTS idx_executions_task_created_at"));
  assert.ok(ddl.includes("CREATE INDEX IF NOT EXISTS idx_executions_trace_id"));
  assert.ok(ddl.includes("CREATE UNIQUE INDEX IF NOT EXISTS idx_executions_task_attempt"));
});

test("worker queue migration includes fence token unique index", () => {
  const ddl = MIGRATION_03_WORKER_QUEUE.ddl;
  assert.ok(ddl.includes("CREATE UNIQUE INDEX IF NOT EXISTS idx_execution_leases_execution_fencing"));
  assert.ok(ddl.includes("CREATE UNIQUE INDEX IF NOT EXISTS idx_execution_leases_active_execution"));
});

test("resources migration includes experience cache table", () => {
  const ddl = MIGRATION_06_RESOURCES.ddl;
  assert.ok(ddl.includes("CREATE TABLE IF NOT EXISTS experience_cache"));
  assert.ok(ddl.includes("quality_score"));
  assert.ok(ddl.includes("hit_count"));
});