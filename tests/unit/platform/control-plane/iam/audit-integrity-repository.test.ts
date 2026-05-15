/**
 * Unit tests for AuditIntegrityRepository
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createAuditIntegrityRepository, AUDIT_INTEGRITY_DDL, type AuditIntegrityRepository } from "../../../../../src/platform/five-plane-control-plane/iam/audit-integrity-repository.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { Tier1AuditIntegrityRecord } from "../../../../../src/platform/five-plane-control-plane/iam/audit-event-integrity.js";

function createMockDatabase(): AuthoritativeSqlDatabase {
  const records: Map<string, Record<string, unknown>> = new Map();

  return {
    connection: {
      prepare: (sql: string) => {
        return {
          run: (...args: unknown[]) => {
            if (sql.includes("INSERT")) {
              const id = args[0] as string;
              records.set(id, {
                id: args[0],
                event_id: args[1],
                chain_position: args[2],
                event_type: args[3],
                event_created_at: args[4],
                event_checksum: args[5],
                previous_chain_hash: args[6],
                chain_hash: args[7],
                recorded_at: args[8],
              });
            }
          },
          get: (...args: unknown[]) => {
            const eventId = args[0] as string;
            if (sql.includes("ORDER BY chain_position DESC")) {
              const values = Array.from(records.values());
              return values.length > 0 ? values[values.length - 1] : undefined;
            }
            for (const record of records.values()) {
              if ((record as Record<string, unknown>).event_id === eventId) {
                return record;
              }
            }
            return undefined;
          },
          all: (...args: unknown[]) => {
            return Array.from(records.values());
          },
        };
      },
    },
    runMigrations: () => {},
    healthCheck: () => "ok",
  } as unknown as AuthoritativeSqlDatabase;
}

test("createAuditIntegrityRepository returns repository instance", () => {
  const db = createMockDatabase();
  const repo = createAuditIntegrityRepository(db);

  assert.ok(repo !== null);
  assert.ok(typeof repo.insertIntegrityRecord === "function");
  assert.ok(typeof repo.getIntegrityRecord === "function");
  assert.ok(typeof repo.getLatestChainHash === "function");
  assert.ok(typeof repo.getChainHashForEvent === "function");
  assert.ok(typeof repo.getIntegrityRecordsInRange === "function");
});

test("insertIntegrityRecord stores and retrieves record", () => {
  const db = createMockDatabase();
  const repo = createAuditIntegrityRepository(db);

  repo.insertIntegrityRecord(
    "evt-123",
    1,
    "task:status_changed",
    "2026-04-07T00:00:00.000Z",
    "checksum-abc",
    null,
    "chain-hash-1",
  );

  const record = repo.getIntegrityRecord("evt-123");

  assert.ok(record !== null);
  assert.equal(record!.eventId, "evt-123");
  assert.equal(record!.chainPosition, 1);
  assert.equal(record!.eventType, "task:status_changed");
  assert.equal(record!.eventChecksum, "checksum-abc");
  assert.equal(record!.previousChainHash, null);
  assert.equal(record!.chainHash, "chain-hash-1");
});

test("getLatestChainHash returns most recent chain hash", () => {
  const db = createMockDatabase();
  const repo = createAuditIntegrityRepository(db);

  repo.insertIntegrityRecord(
    "evt-1",
    1,
    "task:created",
    "2026-04-07T00:00:00.000Z",
    "checksum-1",
    null,
    "hash-1",
  );

  repo.insertIntegrityRecord(
    "evt-2",
    2,
    "task:started",
    "2026-04-07T00:01:00.000Z",
    "checksum-2",
    "hash-1",
    "hash-2",
  );

  const latestHash = repo.getLatestChainHash();

  assert.equal(latestHash, "hash-2");
});

test("getLatestChainHash returns null when no records", () => {
  const db = createMockDatabase();
  const repo = createAuditIntegrityRepository(db);

  const latestHash = repo.getLatestChainHash();

  assert.equal(latestHash, null);
});

test("getChainHashForEvent returns chain hash for specific event", () => {
  const db = createMockDatabase();
  const repo = createAuditIntegrityRepository(db);

  repo.insertIntegrityRecord(
    "evt-1",
    1,
    "task:created",
    "2026-04-07T00:00:00.000Z",
    "checksum-1",
    null,
    "hash-1",
  );

  repo.insertIntegrityRecord(
    "evt-2",
    2,
    "task:started",
    "2026-04-07T00:01:00.000Z",
    "checksum-2",
    "hash-1",
    "hash-2",
  );

  const hash = repo.getChainHashForEvent("evt-1");

  assert.equal(hash, "hash-1");
});

test("getChainHashForEvent returns null for non-existent event", () => {
  const db = createMockDatabase();
  const repo = createAuditIntegrityRepository(db);

  const hash = repo.getChainHashForEvent("non-existent");

  assert.equal(hash, null);
});

test("getIntegrityRecord returns null for non-existent event", () => {
  const db = createMockDatabase();
  const repo = createAuditIntegrityRepository(db);

  const record = repo.getIntegrityRecord("non-existent");

  assert.equal(record, null);
});

test("insertIntegrityRecord and getIntegrityRecord handle string chain position", () => {
  const db = createMockDatabase();
  const repo = createAuditIntegrityRepository(db);

  repo.insertIntegrityRecord(
    "evt-str",
    42,
    "workflow:step_completed",
    "2026-04-07T00:00:00.000Z",
    "checksum-str",
    "prev-hash-str",
    "chain-hash-str",
  );

  const record = repo.getIntegrityRecord("evt-str");

  assert.ok(record !== null);
  assert.equal(record!.eventId, "evt-str");
  assert.equal(record!.chainPosition, 42);
  assert.equal(record!.previousChainHash, "prev-hash-str");
  assert.equal(record!.chainHash, "chain-hash-str");
});

test("AUDIT_INTEGRITY_DDL contains required schema", () => {
  assert.ok(AUDIT_INTEGRITY_DDL.includes("audit_integrity_records"));
  assert.ok(AUDIT_INTEGRITY_DDL.includes("event_id"));
  assert.ok(AUDIT_INTEGRITY_DDL.includes("chain_position"));
  assert.ok(AUDIT_INTEGRITY_DDL.includes("event_checksum"));
  assert.ok(AUDIT_INTEGRITY_DDL.includes("previous_chain_hash"));
  assert.ok(AUDIT_INTEGRITY_DDL.includes("chain_hash"));
});

// R12-16: Verify algorithm field is HMAC-SHA256 (not plain SHA-256)
test("getIntegrityRecord returns algorithm as HMAC-SHA256", () => {
  const db = createMockDatabase();
  const repo = createAuditIntegrityRepository(db);

  repo.insertIntegrityRecord(
    "evt-algo-test",
    1,
    "task:status_changed",
    "2026-04-07T00:00:00.000Z",
    "checksum-algo",
    null,
    "chain-hash-algo",
  );

  const record = repo.getIntegrityRecord("evt-algo-test");

  assert.ok(record !== null);
  assert.equal(record!.algorithm, "HMAC-SHA256");
});