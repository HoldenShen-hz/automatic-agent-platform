/**
 * Unit tests for sqlite-cas-repository.ts
 *
 * Tests SQLite-backed Compare-And-Swap repository for persistent CAS records.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { SqliteCasRepository, type CasRecord } from "../../../../../../src/platform/five-plane-state-evidence/events/cas/sqlite-cas-repository.js";
import type { CasResult } from "../../../../../../src/platform/five-plane-state-evidence/events/cas/cas-service.js";

// Mock SqliteConnection for testing
function createMockConnection(): {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): { changes: number };
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown | undefined;
  };
} {
  // Single storage for all CAS operations (set, compareAndSwap, compareAndSet, get, has)
  const storage = new Map<string, { value: string; version: number; updatedAt: string }>();

  return {
    exec(sql: string): void {
      // Schema creation and transaction commands handled silently
    },
    prepare(sql: string) {
      const currentSql = sql;
      return {
        run(...params: unknown[]): { changes: number } {
          // set() method: INSERT ... ON CONFLICT DO UPDATE SET ...
          // Params: [key, value, version, updatedAt]
          if (sql.includes("ON CONFLICT")) {
            const key = params[0] as string;
            storage.set(key, {
              value: params[1] as string,
              version: params[2] as number,
              updatedAt: params[3] as string,
            });
            return { changes: 1 };
          }
          // compareAndSwap/compareAndSet plain INSERT (version hardcoded to 1)
          // Params: [key, newValue, updatedAt]
          if (sql.includes("INSERT")) {
            const key = params[0] as string;
            storage.set(key, {
              value: params[1] as string,
              version: 1,
              updatedAt: params[2] as string,
            });
            return { changes: 1 };
          }
          if (sql.includes("UPDATE")) {
            // compareAndSwap/compareAndSet UPDATE: increments version
            // Params: [newValue, updatedAt, key, expectedValue/expectedVersion]
            const key = params[2] as string;
            const existing = storage.get(key);
            if (existing) {
              storage.set(key, {
                value: params[0] as string,
                version: existing.version + 1,
                updatedAt: params[1] as string,
              });
              return { changes: 1 };
            }
            return { changes: 0 };
          }
          if (sql.includes("DELETE")) {
            const key = params[0] as string;
            const existed = storage.has(key);
            storage.delete(key);
            return { changes: existed ? 1 : 0 };
          }
          return { changes: 0 };
        },
        all(..._params: unknown[]): unknown[] {
          return [];
        },
        get(...params: unknown[]): unknown | undefined {
          const key = params[0] as string;
          // For SELECT COUNT(*) queries, return { count: N }
          if (currentSql && currentSql.includes("COUNT")) {
            const hasKey = storage.has(key);
            return { count: hasKey ? 1 : 0 };
          }
          // For SELECT ... queries, return the row
          const row = storage.get(key);
          if (!row) return undefined;
          return {
            cas_key: key,
            value: row.value,
            version: row.version,
            updated_at: row.updatedAt,
          };
        },
      };
    },
  };
}

test("SqliteCasRepository.get returns undefined for non-existent key", () => {
  const conn = createMockConnection();
  const repo = new SqliteCasRepository(conn);

  const result = repo.get("nonexistent");
  assert.equal(result, undefined);
});

test("SqliteCasRepository.set stores record", () => {
  const conn = createMockConnection();
  const repo = new SqliteCasRepository(conn);

  const record: CasRecord = {
    value: "test-value",
    version: 1,
    updatedAt: new Date("2026-05-21T10:00:00Z"),
  };

  repo.set("key-1", record);

  const retrieved = repo.get("key-1");
  assert.ok(retrieved !== undefined);
  assert.equal(retrieved?.value, "test-value");
  assert.equal(retrieved?.version, 1);
});

test("SqliteCasRepository.delete removes record", () => {
  const conn = createMockConnection();
  const repo = new SqliteCasRepository(conn);

  const record: CasRecord = {
    value: "to-delete",
    version: 1,
    updatedAt: new Date(),
  };

  repo.set("delete-key", record);
  const deleted = repo.delete("delete-key");

  assert.equal(deleted, true);
  assert.equal(repo.get("delete-key"), undefined);
});

test("SqliteCasRepository.delete returns false for non-existent key", () => {
  const conn = createMockConnection();
  const repo = new SqliteCasRepository(conn);

  const deleted = repo.delete("non-existent");
  assert.equal(deleted, false);
});

test("SqliteCasRepository.has returns false for non-existent key", () => {
  const conn = createMockConnection();
  const repo = new SqliteCasRepository(conn);

  assert.equal(repo.has("nonexistent"), false);
});

test("SqliteCasRepository.has returns true for existing key", () => {
  const conn = createMockConnection();
  const repo = new SqliteCasRepository(conn);

  const record: CasRecord = {
    value: "exists",
    version: 1,
    updatedAt: new Date(),
  };
  repo.set("exists-key", record);

  assert.equal(repo.has("exists-key"), true);
});

test("SqliteCasRepository.compareAndSwap succeeds when key doesn't exist and expected is empty", () => {
  const conn = createMockConnection();
  const repo = new SqliteCasRepository(conn);

  const result = repo.compareAndSwap("new-key", "", "new-value");

  assert.equal(result.success, true);
  assert.equal(result.currentValue, "new-value");
  assert.equal(result.currentVersion, 1);
});

test("SqliteCasRepository.compareAndSwap fails when key doesn't exist but expected is not empty", () => {
  const conn = createMockConnection();
  const repo = new SqliteCasRepository(conn);

  const result = repo.compareAndSwap("new-key", "unexpected", "new-value");

  assert.equal(result.success, false);
});

test("SqliteCasRepository.compareAndSwap succeeds when value matches", () => {
  const conn = createMockConnection();
  const repo = new SqliteCasRepository(conn);

  // First set initial value
  const initial: CasRecord = {
    value: "original",
    version: 1,
    updatedAt: new Date(),
  };
  repo.set("swap-key", initial);

  // Now CAS with matching expected value
  const result = repo.compareAndSwap("swap-key", "original", "updated");

  assert.equal(result.success, true);
  assert.equal(result.currentValue, "updated");
  assert.equal(result.currentVersion, 2);
});

test("SqliteCasRepository.compareAndSwap fails when value doesn't match", () => {
  const conn = createMockConnection();
  const repo = new SqliteCasRepository(conn);

  // First set initial value
  const initial: CasRecord = {
    value: "original",
    version: 1,
    updatedAt: new Date(),
  };
  repo.set("mismatch-key", initial);

  // Now CAS with wrong expected value
  const result = repo.compareAndSwap("mismatch-key", "wrong-value", "updated");

  assert.equal(result.success, false);
  assert.equal(result.currentValue, "original");
  assert.equal(result.currentVersion, 1);
});

test("SqliteCasRepository.compareAndSet succeeds when version matches", () => {
  const conn = createMockConnection();
  const repo = new SqliteCasRepository(conn);

  // First set initial value with version 1
  const initial: CasRecord = {
    value: "initial",
    version: 1,
    updatedAt: new Date(),
  };
  repo.set("cas-key", initial);

  // CAS with matching version
  const result = repo.compareAndSet("cas-key", 1, "updated-version");

  assert.equal(result.success, true);
  assert.equal(result.currentValue, "updated-version");
  assert.equal(result.currentVersion, 2);
});

test("SqliteCasRepository.compareAndSet fails when version doesn't match", () => {
  const conn = createMockConnection();
  const repo = new SqliteCasRepository(conn);

  // First set initial value with version 1
  const initial: CasRecord = {
    value: "initial",
    version: 1,
    updatedAt: new Date(),
  };
  repo.set("version-mismatch", initial);

  // CAS with wrong version
  const result = repo.compareAndSet("version-mismatch", 99, "updated");

  assert.equal(result.success, false);
  assert.equal(result.currentValue, "initial");
  assert.equal(result.currentVersion, 1);
});

test("SqliteCasRepository.compareAndSet succeeds when key doesn't exist and expected version is 0", () => {
  const conn = createMockConnection();
  const repo = new SqliteCasRepository(conn);

  const result = repo.compareAndSet("brand-new-key", 0, "first-value");

  assert.equal(result.success, true);
  assert.equal(result.currentValue, "first-value");
  assert.equal(result.currentVersion, 1);
});

test("SqliteCasRepository.compareAndSet fails when key doesn't exist and expected version is not 0", () => {
  const conn = createMockConnection();
  const repo = new SqliteCasRepository(conn);

  const result = repo.compareAndSet("another-new-key", 5, "value");

  assert.equal(result.success, false);
});

test("SqliteCasRepository.compareAndSwap increments version on success", () => {
  const conn = createMockConnection();
  const repo = new SqliteCasRepository(conn);

  repo.compareAndSwap("version-test", "", "v1");
  const first = repo.get("version-test");
  assert.equal(first?.version, 1);

  repo.compareAndSwap("version-test", "v1", "v2");
  const second = repo.get("version-test");
  assert.equal(second?.version, 2);

  repo.compareAndSwap("version-test", "v2", "v3");
  const third = repo.get("version-test");
  assert.equal(third?.version, 3);
});

test("SqliteCasRepository.compareAndSet increments version on success", () => {
  const conn = createMockConnection();
  const repo = new SqliteCasRepository(conn);

  repo.compareAndSet("cas-version-test", 0, "v1");
  const first = repo.get("cas-version-test");
  assert.equal(first?.version, 1);

  repo.compareAndSet("cas-version-test", 1, "v2");
  const second = repo.get("cas-version-test");
  assert.equal(second?.version, 2);
});

test("SqliteCasRepository handles concurrent updates to different keys", () => {
  const conn = createMockConnection();
  const repo = new SqliteCasRepository(conn);

  const result1 = repo.compareAndSwap("key-a", "", "value-a");
  const result2 = repo.compareAndSwap("key-b", "", "value-b");

  assert.equal(result1.success, true);
  assert.equal(result2.success, true);
  assert.equal(result1.currentVersion, 1);
  assert.equal(result2.currentVersion, 1);
  assert.equal(repo.get("key-a")?.value, "value-a");
  assert.equal(repo.get("key-b")?.value, "value-b");
});

test("SqliteCasRepository constructor calls ensureSchema", () => {
  let schemaEnsured = false;
  const trackingConn = {
    exec(sql: string): void {
      if (sql.includes("CREATE TABLE")) {
        schemaEnsured = true;
      }
    },
    prepare(sql: string) {
      return {
        run(..._params: unknown[]): { changes: number } {
          return { changes: 0 };
        },
        all(..._params: unknown[]): unknown[] {
          return [];
        },
        get(..._params: unknown[]): unknown | undefined {
          return undefined;
        },
      };
    },
  };

  new SqliteCasRepository(trackingConn as Parameters<typeof SqliteCasRepository>[0]);
  assert.equal(schemaEnsured, true, "ensureSchema should be called in constructor");
});