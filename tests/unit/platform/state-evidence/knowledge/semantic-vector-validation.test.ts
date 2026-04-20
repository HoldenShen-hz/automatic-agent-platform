import assert from "node:assert/strict";
import test from "node:test";

import type {
  AsyncQueryResult,
  AsyncSqlConnection,
  AsyncSqlDatabase,
} from "../../../../../src/platform/state-evidence/truth/async-sql-database.js";
import { validateSemanticVectorReadiness } from "../../../../../src/platform/state-evidence/knowledge/semantic-vector-validation.js";

test("validateSemanticVectorReadiness verifies pgvector extension, table, ivfflat index, and roundtrip", async () => {
  const executed: Array<{ sql: string; params: unknown[] }> = [];
  let insertedKnowledgeRef = "knowledge:unknown";
  const conn: AsyncSqlConnection = {
    async query<T = unknown>(sql: string, ...params: unknown[]): Promise<AsyncQueryResult<T>> {
      if (sql.includes("GREATEST(0, 1 - (embedding <=>")) {
        return {
          rows: [{
            knowledge_ref: insertedKnowledgeRef,
            namespace: "system/readiness",
            similarity: 0.99,
          }] as T[],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    },
    async queryOne<T = unknown>(sql: string): Promise<T | undefined> {
      if (sql.includes("pg_extension")) {
        return { installed: true } as T;
      }
      if (sql.includes("to_regclass")) {
        return { regclass: "public.knowledge_semantic_vectors" } as T;
      }
      if (sql.includes("FROM pg_index")) {
        return { present: true } as T;
      }
      return undefined;
    },
    async execute(sql: string, ...params: unknown[]): Promise<number> {
      executed.push({ sql, params });
      if (sql.includes("INSERT INTO public.knowledge_semantic_vectors")) {
        insertedKnowledgeRef = String(params[0]);
      }
      return 1;
    },
  };
  const database: AsyncSqlDatabase = {
    filePath: "postgres://agent_os",
    asyncConnection: conn,
    async migrate() {},
    async getSchemaStatus() {
      return {
        currentVersion: 13,
        expectedVersion: 13,
        upToDate: true,
        pendingVersions: [],
        checksumMismatches: [],
      };
    },
    async assertSchemaCurrent() {},
    async integrityCheck() {
      return [];
    },
    async transaction<T>(work: (transactionConn: AsyncSqlConnection) => Promise<T>): Promise<T> {
      return work(conn);
    },
    async readTransaction<T>(work: (transactionConn: AsyncSqlConnection) => Promise<T>): Promise<T> {
      return work(conn);
    },
    async close() {},
  };

  const report = await validateSemanticVectorReadiness({
    env: {
      AA_STORAGE_DRIVER: "postgres",
      AA_KNOWLEDGE_VECTOR_BACKEND: "pgvector",
    },
    storageDriver: "postgres",
    database,
  });

  assert.equal(report.ready, true);
  assert.equal(report.vectorBackend, "pgvector");
  assert.equal(report.checks.find((check) => check.name === "semantic_roundtrip")?.ok, true);
  assert.equal(report.checks.find((check) => check.name === "semantic_ivfflat_index_present")?.ok, true);
  assert.ok(executed.some((entry) => entry.sql.includes("INSERT INTO public.knowledge_semantic_vectors")));
  assert.ok(executed.some((entry) => entry.sql.includes("DELETE FROM public.knowledge_semantic_vectors")));
});

test("validateSemanticVectorReadiness fails closed when storage is not postgres", async () => {
  const report = await validateSemanticVectorReadiness({
    env: {
      AA_KNOWLEDGE_VECTOR_BACKEND: "pgvector",
    },
    storageDriver: "sqlite",
    database: null,
  });

  assert.equal(report.ready, false);
  assert.equal(report.checks[0]?.name, "storage_driver_postgres");
  assert.equal(report.checks[0]?.ok, false);
  assert.equal(report.checks.some((check) => check.name === "semantic_roundtrip"), false);
});

test("validateSemanticVectorReadiness returns failed checks when pgvector extension is missing", async () => {
  const conn: AsyncSqlConnection = {
    async query<T = unknown>(): Promise<AsyncQueryResult<T>> {
      return { rows: [], rowCount: 0 };
    },
    async queryOne<T = unknown>(): Promise<T | undefined> {
      return undefined;
    },
    async execute(): Promise<number> {
      return 0;
    },
  };
  const database: AsyncSqlDatabase = {
    filePath: "postgres://agent_os",
    asyncConnection: conn,
    async migrate() {},
    async getSchemaStatus() {
      return {
        currentVersion: 13,
        expectedVersion: 13,
        upToDate: true,
        pendingVersions: [],
        checksumMismatches: [],
      };
    },
    async assertSchemaCurrent() {},
    async integrityCheck() {
      return [];
    },
    async transaction<T>(work: (transactionConn: AsyncSqlConnection) => Promise<T>): Promise<T> {
      return work(conn);
    },
    async readTransaction<T>(work: (transactionConn: AsyncSqlConnection) => Promise<T>): Promise<T> {
      return work(conn);
    },
    async close() {},
  };

  const report = await validateSemanticVectorReadiness({
    env: {
      AA_STORAGE_DRIVER: "postgres",
      AA_KNOWLEDGE_VECTOR_BACKEND: "pgvector",
    },
    storageDriver: "postgres",
    database,
  });

  assert.equal(report.ready, false);
  assert.equal(report.vectorBackend, "pgvector");
});
