import assert from "node:assert/strict";
import test from "node:test";

import type {
  AsyncQueryResult,
  AsyncSqlConnection,
  AsyncSqlDatabase,
} from "../../../../../src/platform/five-plane-state-evidence/truth/async-sql-database.js";
import {
  LocalHashSemanticVectorStore,
  PgvectorSemanticVectorStore,
  createSemanticVectorStoreFromEnvironment,
} from "../../../../../src/platform/five-plane-state-evidence/knowledge/semantic-vector-store.js";
import { buildSemanticEmbedding } from "../../../../../src/platform/five-plane-state-evidence/knowledge/semantic-embedding.js";
import { KnowledgePlaneService } from "../../../../../src/platform/five-plane-state-evidence/knowledge/knowledge-plane-service.js";

function buildEmbedding(seed: number): number[] {
  return Array.from({ length: 32 }, (_, index) => Number((((seed + index) % 7) / 7).toFixed(6)));
}

test("LocalHashSemanticVectorStore upserts and queries semantic candidates", async () => {
  const store = new LocalHashSemanticVectorStore();
  await store.upsertChunks([{
    knowledgeRef: "knowledge:chunk_build",
    chunkId: "chunk_build",
    documentId: "document_1",
    namespace: "shared/common",
    embeddingId: "local-hash-v1:test",
    embedding: buildSemanticEmbedding("build retry")!,
    updatedAt: "2026-04-16T00:00:00.000Z",
  }]);

  const candidates = await store.querySimilar({
    query: "build retry",
    namespace: "shared/common",
    minSimilarity: 0,
  });

  assert.equal(store.inspect().backend, "local_hash");
  assert.ok(candidates.some((candidate) => candidate.knowledgeRef === "knowledge:chunk_build"));
});

test("LocalHashSemanticVectorStore exposes unsupported-embedding telemetry and evicts oldest records", async () => {
  const store = new LocalHashSemanticVectorStore({ maxRecords: 1 });
  await store.upsertChunks([
    {
      knowledgeRef: "knowledge:bad",
      chunkId: "bad",
      documentId: "document_bad",
      namespace: "shared/common",
      embeddingId: null,
      embedding: null,
      updatedAt: "2026-04-15T00:00:00.000Z",
    },
    {
      knowledgeRef: "knowledge:old",
      chunkId: "old",
      documentId: "document_old",
      namespace: "shared/common",
      embeddingId: "ok",
      embedding: buildEmbedding(1),
      updatedAt: "2026-04-15T00:00:00.000Z",
    },
    {
      knowledgeRef: "knowledge:new",
      chunkId: "new",
      documentId: "document_new",
      namespace: "shared/common",
      embeddingId: "ok",
      embedding: buildEmbedding(2),
      updatedAt: "2026-04-16T00:00:00.000Z",
    },
  ]);

  const candidates = await store.querySimilar({
    query: "build retry",
    namespace: "shared/common",
    minSimilarity: 0,
  });

  assert.equal(store.inspect().details.skippedUnsupportedEmbeddings, 1);
  assert.equal(candidates.some((candidate) => candidate.knowledgeRef === "knowledge:old"), false);
  assert.equal(candidates.some((candidate) => candidate.knowledgeRef === "knowledge:new"), true);
});

test("PgvectorSemanticVectorStore upserts records and executes vector similarity query", async () => {
  const executed: Array<{ sql: string; params: unknown[] }> = [];
  const queried: Array<{ sql: string; params: unknown[] }> = [];
  const conn: AsyncSqlConnection = {
    async query<T = unknown>(sql: string, ...params: unknown[]): Promise<AsyncQueryResult<T>> {
      queried.push({ sql, params });
      return {
        rows: [{
          knowledge_ref: "knowledge:chunk_pg",
          namespace: "shared/common",
          similarity: 0.93,
        }] as T[],
        rowCount: 1,
      };
    },
    async queryOne<T = unknown>(sql: string, ...params: unknown[]): Promise<T | undefined> {
      queried.push({ sql, params });
      if (sql.includes("pg_extension")) {
        return { installed: true } as T;
      }
      if (sql.includes("to_regclass")) {
        return { regclass: "public.knowledge_semantic_vectors" } as T;
      }
      return undefined;
    },
    async execute(sql: string, ...params: unknown[]): Promise<number> {
      executed.push({ sql, params });
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

  const store = new PgvectorSemanticVectorStore({ database });
  await store.upsertChunks([{
    knowledgeRef: "knowledge:chunk_pg",
    chunkId: "chunk_pg",
    documentId: "document_pg",
    namespace: "shared/common",
    embeddingId: "local-hash-v1:test",
    embedding: buildEmbedding(2),
    updatedAt: "2026-04-16T00:00:00.000Z",
  }]);
  const candidates = await store.querySimilar({
    query: "build retry",
    namespace: "shared/common",
  });

  assert.equal(store.inspect().backend, "pgvector");
  assert.ok(executed[0]?.sql.includes("\"public\".\"knowledge_semantic_vectors\""));
  assert.equal(typeof executed[0]?.params[6], "string");
  assert.ok(String(executed[0]?.params[6]).startsWith("["));
  assert.ok(queried.some((item) => item.sql.includes("pg_extension")));
  assert.equal(candidates[0]?.knowledgeRef, "knowledge:chunk_pg");
});

test("createSemanticVectorStoreFromEnvironment rejects pgvector without postgres storage", () => {
  assert.throws(() => createSemanticVectorStoreFromEnvironment({
    env: { AA_KNOWLEDGE_VECTOR_BACKEND: "pgvector" },
    storageDriver: "sqlite",
    database: null,
  }), /knowledge\.semantic_pgvector_requires_postgres/);
});

test("KnowledgePlaneService async query path uses configured semantic vector store", async () => {
  const plane = new KnowledgePlaneService({
    semanticVectorStore: new LocalHashSemanticVectorStore(),
  });
  plane.registerNamespace({
    namespaceId: "ns_shared_common",
    path: "shared/common",
    description: "Shared common knowledge",
    ownerDomainId: "shared",
    accessPolicy: "public",
    freshnessPolicy: {
      maxAgeDays: 90,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "official",
    maxDocuments: 100,
    maxTotalSizeBytes: 1000000,
  });

  const semanticDoc = await plane.ingestAsync({
    title: "Build diagnostics",
    body: "Build failures usually recover after clearing stale caches and re-running the pipeline once.",
    namespace: "shared/common",
    sourceType: "text",
    trustLevel: "official",
  });

  const hits = await plane.queryAsync("compilation", {
    namespace: "shared/common",
    limit: 5,
  });

  const semanticHit = hits.find((hit) => hit.knowledgeRef === `knowledge:${semanticDoc.chunks[0]!.chunkId}`);
  assert.ok(semanticHit);
  assert.equal(plane.inspectSemanticInfrastructure().backend, "local_hash");
});
