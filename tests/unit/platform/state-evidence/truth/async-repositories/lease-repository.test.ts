import assert from "node:assert/strict";
import test from "node:test";

import { AsyncLeaseRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/async-repositories/lease-repository.js";
import type { AsyncSqlConnection, AsyncQueryResult } from "../../../../../../src/platform/five-plane-state-evidence/truth/async-sql-database.js";
import type { LeaseAuditRecord } from "../../../../../../src/platform/contracts/types/domain.js";

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

const now = "2026-04-23T10:00:00.000Z";

function leaseAuditRecord(overrides: Partial<LeaseAuditRecord> = {}): LeaseAuditRecord {
  return {
    id: "audit-1",
    executionId: "exec-1",
    leaseId: "lease-1",
    workerId: "worker-1",
    fencingToken: 1,
    eventType: "acquired",
    reasonCode: "dispatch",
    recordedAt: now,
    ...overrides,
  };
}

test("AsyncLeaseRepository listLeaseAudits returns audits for execution", async () => {
  const audit = leaseAuditRecord();
  const { connection, calls } = createConnection({ queryRows: [[audit]] });
  const repo = new AsyncLeaseRepository(connection);

  const result = await repo.listLeaseAudits("exec-1");

  assert.deepEqual(result, [audit]);
  assert.match(calls[0]!.sql, /FROM lease_audits/);
  assert.match(calls[0]!.sql, /WHERE execution_id = \$1/);
  assert.match(calls[0]!.sql, /ORDER BY recorded_at ASC/);
});

test("AsyncLeaseRepository listLeaseAudits returns empty array when no audits", async () => {
  const { connection } = createConnection({ queryRows: [[]] });
  const repo = new AsyncLeaseRepository(connection);

  const result = await repo.listLeaseAudits("exec-missing");

  assert.deepEqual(result, []);
});