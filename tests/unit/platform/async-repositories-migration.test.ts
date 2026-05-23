import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { AsyncQueryResult, AsyncSqlConnection } from "../../../src/platform/five-plane-state-evidence/truth/async-sql-database.js";
import { AsyncSessionRepository } from "../../../src/platform/five-plane-state-evidence/truth/async-repositories/session-repository.js";
import { decorateAuthoritativeTaskStore } from "../../../src/platform/five-plane-state-evidence/truth/repositories/authoritative-task-store-decorator.js";
import { redactDsnCredentials, validateTableName } from "../../../src/sdk/cli/migrate-sqlite-to-pg.js";

test("R31-28/R31-29/R31-30/R31-32/R31-33: async repositories and migration CLI stay injection-safe and PostgreSQL-compatible", async () => {
  const sessionSource = readFileSync("src/platform/five-plane-state-evidence/truth/async-repositories/session-repository.ts", "utf8");
  const delegationSource = readFileSync("src/platform/five-plane-state-evidence/truth/async-repositories/delegation-repository.ts", "utf8");
  const workerSource = readFileSync("src/platform/five-plane-state-evidence/truth/async-repositories/worker-repository.ts", "utf8");
  const migrateSource = readFileSync("src/sdk/cli/migrate-sqlite-to-pg.ts", "utf8");

  assert.match(sessionSource, /LIMIT \$2/);
  assert.ok(!sessionSource.includes("LIMIT ${limit}"));
  assert.match(delegationSource, /expires_at < NOW\(\)/);
  assert.ok(!delegationSource.includes("datetime('now')"));
  assert.match(workerSource, /dispatch_after <= NOW\(\)/);
  assert.ok(!workerSource.includes("strftime("));
  assert.match(migrateSource, /validateTableName\(table\)/);
  assert.match(migrateSource, /redactDsnCredentials/);

  const queries: Array<{ sql: string; params: readonly unknown[] }> = [];
  const conn: AsyncSqlConnection = {
    async query<T>(sql: string, ...params: unknown[]): Promise<AsyncQueryResult<T>> {
      queries.push({ sql, params });
      return { rows: [], rowCount: 0 };
    },
    async queryOne<T>(): Promise<T | undefined> {
      return undefined;
    },
    async execute(): Promise<number> {
      return 0;
    },
  };

  const repository = new AsyncSessionRepository(conn);
  await repository.listMessagesBySession("session-1", 25);

  assert.equal(queries.length, 1);
  assert.match(queries[0]!.sql, /LIMIT \$2/);
  assert.deepEqual(queries[0]!.params, ["session-1", 25]);

  await assert.rejects(
    () => repository.listMessagesBySession("session-1", "25; DROP TABLE messages" as unknown as number),
    /session_repository\.invalid_limit/,
  );

  assert.equal(redactDsnCredentials("postgresql://user:secret@db.example.com:5432/app"), "postgresql://****:****@db.example.com:5432/app");
  assert.equal(redactDsnCredentials("postgresql://db.example.com:5432/app"), "postgresql://db.example.com:5432/app");
  assert.doesNotThrow(() => validateTableName("tasks"));
  assert.throws(() => validateTableName("tasks; DROP TABLE tasks"));
});

test("R31-31: authoritative task store decorator leaves nested repository namespaces accessible", () => {
  const nestedNamespace = {
    describe(): string {
      return "nested-ok";
    },
  };
  const store = {
    namespace: nestedNamespace,
    ping(): string {
      return "pong";
    },
  };

  const decorated = decorateAuthoritativeTaskStore(
    store as unknown as Parameters<typeof decorateAuthoritativeTaskStore>[0],
  ) as unknown as typeof store;

  assert.equal(decorated.namespace, nestedNamespace);
  assert.equal(decorated.namespace.describe(), "nested-ok");
  assert.equal(decorated.ping(), "pong");
});
