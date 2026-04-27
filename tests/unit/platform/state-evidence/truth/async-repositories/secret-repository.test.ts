// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";

import { AsyncSecretRepository } from "../../../../../../src/platform/state-evidence/truth/async-repositories/secret-repository.js";
import type { AsyncSqlConnection, AsyncQueryResult } from "../../../../../../src/platform/state-evidence/truth/async-sql-database.js";

type SqlCall = {
  method: "query" | "queryOne" | "execute";
  sql: string;
  params: unknown[];
};

function createConnection(options: {
  queryRows?: unknown[][];
  queryOneRows?: unknown[];
  executeResults?: number[];
} = {}) {
  const calls: SqlCall[] = [];
  let queryIndex = 0;
  let queryOneIndex = 0;
  let executeIndex = 0;

  const connection: AsyncSqlConnection = {
    async query<T>(sql: string, ...params: unknown[]): Promise<AsyncQueryResult<T>> {
      calls.push({ method: "query", sql, params });
      const rows = (options.queryRows?.[queryIndex++] ?? []) as T[];
      return { rows, rowCount: rows.length, changes: rows.length };
    },
    async queryOne<T>(sql: string, ...params: unknown[]): Promise<T | undefined> {
      calls.push({ method: "queryOne", sql, params });
      return options.queryOneRows?.[queryOneIndex++] as T | undefined;
    },
    async execute(sql: string, ...params: unknown[]): Promise<number> {
      calls.push({ method: "execute", sql, params });
      return options.executeResults?.[executeIndex++] ?? 1;
    },
  };

  return { connection, calls };
}

const now = "2026-04-26T10:00:00.000Z";

function secretRegistryRecord(overrides: Partial<import("../../../../../../src/platform/contracts/types/domain.js").SecretRegistryRecord> = {}): import("../../../../../../src/platform/contracts/types/domain.js").SecretRegistryRecord {
  return {
    secretRef: "secret/ref-1",
    displayName: "Test Secret",
    category: "api_key",
    providerKind: "aws",
    scopeType: "workspace",
    scopeRef: "ws-1",
    status: "active",
    rotationPolicyJson: '{"rotationDays":90}',
    metadataJson: '{"env":"test"}',
    currentVersion: "v1",
    lastRotatedAt: now,
    nextRotationDueAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function secretUsageAuditRecord(overrides: Partial<import("../../../../../../src/platform/contracts/types/domain.js").SecretUsageAuditRecord> = {}): import("../../../../../../src/platform/contracts/types/domain.js").SecretUsageAuditRecord {
  return {
    auditId: "audit-1",
    secretRef: "secret/ref-1",
    providerKind: "aws",
    taskId: "task-1",
    executionId: "exec-1",
    requestedBy: "agent-1",
    grantedTo: "agent-2",
    usagePurpose: "api_access",
    resolvedAt: now,
    expiresAt: now,
    maskedValue: "***",
    metadataJson: '{}',
    ...overrides,
  };
}

function secretLeaseRecord(overrides: Partial<import("../../../../../../src/platform/contracts/types/domain.js").SecretLeaseRecord> = {}): import("../../../../../../src/platform/contracts/types/domain.js").SecretLeaseRecord {
  return {
    leaseId: "lease-1",
    secretRef: "secret/ref-1",
    providerKind: "aws",
    taskId: "task-1",
    executionId: "exec-1",
    requestedBy: "agent-1",
    grantedTo: "agent-2",
    usagePurpose: "api_access",
    issuedAt: now,
    expiresAt: now,
    status: "active",
    revokedAt: null,
    revokedBy: null,
    revocationReasonCode: null,
    sourceVersion: "v1",
    maskedValue: "sk-****-1234",
    metadataJson: '{}',
    ...overrides,
  };
}

function secretRotationEventRecord(overrides: Partial<import("../../../../../../src/platform/contracts/types/domain.js").SecretRotationEventRecord> = {}): import("../../../../../../src/platform/contracts/types/domain.js").SecretRotationEventRecord {
  return {
    eventId: "rot-1",
    secretRef: "secret/ref-1",
    providerKind: "aws",
    rotationMode: "manual",
    status: "completed",
    reasonCode: "scheduled",
    requestedBy: "agent-1",
    previousVersion: "v1",
    nextVersion: "v2",
    occurredAt: now,
    metadataJson: '{}',
    ...overrides,
  };
}

// ─── upsertSecretRegistryRecord ───────────────────────────────────────────────

test("upsertSecretRegistryRecord executes INSERT with ON CONFLICT", async () => {
  const { connection, calls } = createConnection();
  const repo = new AsyncSecretRepository(connection);

  const record = secretRegistryRecord();
  await repo.upsertSecretRegistryRecord(record);

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "execute");
  assert.ok(calls[0]!.sql.includes("INSERT INTO secret_registry"));
  assert.ok(calls[0]!.sql.includes("ON CONFLICT(secret_ref) DO UPDATE SET"));
  assert.deepEqual(calls[0]!.params.slice(0, 6), [
    "secret/ref-1",
    "Test Secret",
    "api_key",
    "aws",
    "workspace",
    "ws-1",
  ]);
});

test("upsertSecretRegistryRecord handles all secret categories", async () => {
  const { connection, calls } = createConnection();
  const repo = new AsyncSecretRepository(connection);

  const categories = ["api_key", "password", "certificate", "oauth_token", "ssh_key"];
  for (const category of categories) {
    const record = secretRegistryRecord({ category: category as any });
    await repo.upsertSecretRegistryRecord(record);
  }

  assert.equal(calls.length, 5);
});

test("upsertSecretRegistryRecord handles all status values", async () => {
  const { connection, calls } = createConnection();
  const repo = new AsyncSecretRepository(connection);

  const statuses = ["active", "rotating", "revoked", "expired"];
  for (const status of statuses) {
    const record = secretRegistryRecord({ status: status as any });
    await repo.upsertSecretRegistryRecord(record);
  }

  assert.equal(calls.length, 4);
});

// ─── insertSecretUsageAudit ───────────────────────────────────────────────────

test("insertSecretUsageAudit executes INSERT with audit fields", async () => {
  const { connection, calls } = createConnection();
  const repo = new AsyncSecretRepository(connection);

  const record = secretUsageAuditRecord();
  await repo.insertSecretUsageAudit(record);

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "execute");
  assert.ok(calls[0]!.sql.includes("INSERT INTO secret_usage_audits"));
  assert.deepEqual(calls[0]!.params.slice(0, 7), [
    "audit-1",
    "secret/ref-1",
    "aws",
    "task-1",
    "exec-1",
    "agent-1",
    "agent-2",
  ]);
});

test("insertSecretUsageAudit includes masked value", async () => {
  const { connection, calls } = createConnection();
  const repo = new AsyncSecretRepository(connection);

  const record = secretUsageAuditRecord({ maskedValue: "sk-****-abcd" });
  await repo.insertSecretUsageAudit(record);

  assert.ok(calls[0]!.params.includes("sk-****-abcd"));
});

// ─── insertSecretRotationEvent ────────────────────────────────────────────────

test("insertSecretRotationEvent executes INSERT", async () => {
  const { connection, calls } = createConnection();
  const repo = new AsyncSecretRepository(connection);

  const record = secretRotationEventRecord();
  await repo.insertSecretRotationEvent(record);

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "execute");
  assert.ok(calls[0]!.sql.includes("INSERT INTO secret_rotation_events"));
  assert.deepEqual(calls[0]!.params.slice(0, 7), [
    "rot-1",
    "secret/ref-1",
    "aws",
    "manual",
    "completed",
    "scheduled",
    "agent-1",
  ]);
});

test("insertSecretRotationEvent handles all rotation modes", async () => {
  const { connection, calls } = createConnection();
  const repo = new AsyncSecretRepository(connection);

  const modes = ["manual", "automatic", "emergency"];
  for (const mode of modes) {
    const record = secretRotationEventRecord({ rotationMode: mode as any });
    await repo.insertSecretRotationEvent(record);
  }

  assert.equal(calls.length, 3);
});

test("insertSecretRotationEvent handles all status values", async () => {
  const { connection, calls } = createConnection();
  const repo = new AsyncSecretRepository(connection);

  const statuses = ["pending", "in_progress", "completed", "failed", "rolled_back"];
  for (const status of statuses) {
    const record = secretRotationEventRecord({ status: status as any });
    await repo.insertSecretRotationEvent(record);
  }

  assert.equal(calls.length, 5);
});

// ─── upsertSecretLeaseRecord ──────────────────────────────────────────────────

test("upsertSecretLeaseRecord executes INSERT with ON CONFLICT", async () => {
  const { connection, calls } = createConnection();
  const repo = new AsyncSecretRepository(connection);

  const record = secretLeaseRecord();
  await repo.upsertSecretLeaseRecord(record);

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "execute");
  assert.ok(calls[0]!.sql.includes("INSERT INTO secret_leases"));
  assert.ok(calls[0]!.sql.includes("ON CONFLICT(lease_id) DO UPDATE SET"));
});

test("upsertSecretLeaseRecord handles all status values", async () => {
  const { connection, calls } = createConnection();
  const repo = new AsyncSecretRepository(connection);

  const statuses = ["active", "expired", "revoked"];
  for (const status of statuses) {
    const record = secretLeaseRecord({ status: status as any });
    await repo.upsertSecretLeaseRecord(record);
  }

  assert.equal(calls.length, 3);
});

// ─── getSecretRegistryRecord ─────────────────────────────────────────────────

test("getSecretRegistryRecord queries by secret ref", async () => {
  const { connection, calls } = createConnection({
    queryOneRows: [secretRegistryRecord()],
  });
  const repo = new AsyncSecretRepository(connection);

  await repo.getSecretRegistryRecord("secret/ref-1");

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "queryOne");
  assert.ok(calls[0]!.sql.includes("FROM secret_registry"));
  assert.ok(calls[0]!.sql.includes("WHERE secret_ref = $1"));
  assert.deepEqual(calls[0]!.params, ["secret/ref-1"]);
});

test("getSecretRegistryRecord returns null when not found", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncSecretRepository(connection);

  const result = await repo.getSecretRegistryRecord("nonexistent");

  assert.equal(result, null);
});

// ─── listSecretRegistryRecords ────────────────────────────────────────────────

test("listSecretRegistryRecords returns all records", async () => {
  const records = [secretRegistryRecord({ secretRef: "secret/ref-1" }), secretRegistryRecord({ secretRef: "secret/ref-2" })];
  const { connection, calls } = createConnection({ queryRows: [records] });
  const repo = new AsyncSecretRepository(connection);

  const result = await repo.listSecretRegistryRecords();

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "query");
  assert.ok(calls[0]!.sql.includes("ORDER BY secret_ref ASC"));
  assert.equal(result.length, 2);
});

test("listSecretRegistryRecords orders by secret_ref ASC", async () => {
  const { connection, calls } = createConnection({ queryRows: [[]] });
  const repo = new AsyncSecretRepository(connection);

  await repo.listSecretRegistryRecords();

  assert.ok(calls[0]!.sql.includes("ORDER BY secret_ref ASC"));
});

// ─── listSecretUsageAuditsBySecretRef ────────────────────────────────────────

test("listSecretUsageAuditsBySecretRef queries by secret ref", async () => {
  const { connection, calls } = createConnection({
    queryRows: [[secretUsageAuditRecord()]],
  });
  const repo = new AsyncSecretRepository(connection);

  const result = await repo.listSecretUsageAuditsBySecretRef("secret/ref-1");

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "query");
  assert.ok(calls[0]!.sql.includes("WHERE secret_ref = $1"));
  assert.deepEqual(calls[0]!.params, ["secret/ref-1"]);
  assert.equal(result.length, 1);
});

test("listSecretUsageAuditsBySecretRef orders by resolved_at DESC", async () => {
  const { connection, calls } = createConnection({ queryRows: [[]] });
  const repo = new AsyncSecretRepository(connection);

  await repo.listSecretUsageAuditsBySecretRef("secret/ref-1");

  assert.ok(calls[0]!.sql.includes("ORDER BY resolved_at DESC"));
});

test("listSecretUsageAuditsBySecretRef returns empty array when none found", async () => {
  const { connection } = createConnection({ queryRows: [[]] });
  const repo = new AsyncSecretRepository(connection);

  const result = await repo.listSecretUsageAuditsBySecretRef("secret/none");

  assert.deepEqual(result, []);
});

// ─── listSecretRotationEventsBySecretRef ─────────────────────────────────────

test("listSecretRotationEventsBySecretRef queries by secret ref", async () => {
  const { connection, calls } = createConnection({
    queryRows: [[secretRotationEventRecord()]],
  });
  const repo = new AsyncSecretRepository(connection);

  const result = await repo.listSecretRotationEventsBySecretRef("secret/ref-1");

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "query");
  assert.ok(calls[0]!.sql.includes("WHERE secret_ref = $1"));
  assert.deepEqual(calls[0]!.params, ["secret/ref-1"]);
  assert.equal(result.length, 1);
});

test("listSecretRotationEventsBySecretRef orders by occurred_at DESC", async () => {
  const { connection, calls } = createConnection({ queryRows: [[]] });
  const repo = new AsyncSecretRepository(connection);

  await repo.listSecretRotationEventsBySecretRef("secret/ref-1");

  assert.ok(calls[0]!.sql.includes("ORDER BY occurred_at DESC"));
});

test("listSecretRotationEventsBySecretRef returns empty array when none found", async () => {
  const { connection } = createConnection({ queryRows: [[]] });
  const repo = new AsyncSecretRepository(connection);

  const result = await repo.listSecretRotationEventsBySecretRef("secret/none");

  assert.deepEqual(result, []);
});

// ─── getSecretLeaseRecord ─────────────────────────────────────────────────────

test("getSecretLeaseRecord queries by lease ID", async () => {
  const { connection, calls } = createConnection({
    queryOneRows: [secretLeaseRecord()],
  });
  const repo = new AsyncSecretRepository(connection);

  await repo.getSecretLeaseRecord("lease-1");

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "queryOne");
  assert.ok(calls[0]!.sql.includes("FROM secret_leases"));
  assert.ok(calls[0]!.sql.includes("WHERE lease_id = $1"));
  assert.deepEqual(calls[0]!.params, ["lease-1"]);
});

test("getSecretLeaseRecord returns null when not found", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncSecretRepository(connection);

  const result = await repo.getSecretLeaseRecord("nonexistent");

  assert.equal(result, null);
});

// ─── listSecretLeasesBySecretRef ──────────────────────────────────────────────

test("listSecretLeasesBySecretRef queries by secret ref", async () => {
  const { connection, calls } = createConnection({
    queryRows: [[secretLeaseRecord()]],
  });
  const repo = new AsyncSecretRepository(connection);

  const result = await repo.listSecretLeasesBySecretRef("secret/ref-1");

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "query");
  assert.ok(calls[0]!.sql.includes("WHERE secret_ref = $1"));
  assert.deepEqual(calls[0]!.params, ["secret/ref-1"]);
  assert.equal(result.length, 1);
});

test("listSecretLeasesBySecretRef orders by issued_at DESC", async () => {
  const { connection, calls } = createConnection({ queryRows: [[]] });
  const repo = new AsyncSecretRepository(connection);

  await repo.listSecretLeasesBySecretRef("secret/ref-1");

  assert.ok(calls[0]!.sql.includes("ORDER BY issued_at DESC"));
});

test("listSecretLeasesBySecretRef returns empty array when none found", async () => {
  const { connection } = createConnection({ queryRows: [[]] });
  const repo = new AsyncSecretRepository(connection);

  const result = await repo.listSecretLeasesBySecretRef("secret/none");

  assert.deepEqual(result, []);
});