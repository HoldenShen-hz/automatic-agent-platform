import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { MarketplaceGovernanceService } from "../../../src/scale-ecosystem/marketplace/marketplace-governance-service.js";
import { choosePreemptionVictim } from "../../../src/scale-ecosystem/resource-manager/preemption/index.js";
import { ResourcePoolService } from "../../../src/scale-ecosystem/resource-manager/resource-pool-service.js";
import { StructuredLogger } from "../../../src/platform/shared/observability/structured-logger.js";
import { KnowledgeArchive } from "../../../src/platform/five-plane-state-evidence/knowledge/archive/knowledge-archive.js";
import { KeywordKnowledgeIndex } from "../../../src/platform/five-plane-state-evidence/knowledge/keyword-index.js";
import { KnowledgeRetrievalService } from "../../../src/platform/five-plane-state-evidence/knowledge/retrieval/knowledge-retrieval.js";
import { KnowledgeQueryService, QueryLevel } from "../../../src/platform/five-plane-state-evidence/knowledge/knowledge-query-service.js";
import { SemanticKnowledgeGraph } from "../../../src/platform/five-plane-state-evidence/knowledge/semantic-knowledge-graph.js";
import { NamespacePolicyStore } from "../../../src/platform/five-plane-state-evidence/knowledge/governance/namespace-policy.js";
import type { SemanticVectorStore } from "../../../src/platform/five-plane-state-evidence/knowledge/semantic-vector-store.js";
import {
  createWorkflowStepCheckpoint,
  restoreWorkflowStepCheckpoint,
  compareWorkflowStepCheckpointVersions,
} from "../../../src/platform/five-plane-state-evidence/checkpoints/index.js";
import { DEFAULT_MEMORY_PROMOTION_RULES, shouldEvict } from "../../../src/platform/five-plane-state-evidence/memory/memory-layer-model.js";
import { DEFAULT_SIX_LAYER_TRANSITION_RULES } from "../../../src/platform/five-plane-state-evidence/memory/layer-transition-service.js";
import { AuthoritativeTaskStore } from "../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import type { MemoryRecord } from "../../../src/platform/contracts/types/domain.js";
import type {
  KnowledgeChunk,
  KnowledgeDocument,
  KnowledgeNamespace,
  KnowledgeSource,
} from "../../../src/platform/five-plane-state-evidence/knowledge/knowledge-model.js";
import { cleanupPath, createTempWorkspace } from "../../helpers/fs.js";

function createSource(overrides: Partial<KnowledgeSource> = {}): KnowledgeSource {
  return {
    sourceId: "source-1",
    type: "file",
    uri: "file:///tmp/source.md",
    contentHash: "hash-1",
    metadata: {},
    ingestedAt: "2026-05-09T00:00:00.000Z",
    namespace: "ns-a",
    language: "en",
    tags: [],
    trustLevel: "team_reviewed",
    freshnessTimestamp: "2026-05-09T00:00:00.000Z",
    checksum: "checksum-1",
    ...overrides,
  };
}

function createDocument(overrides: Partial<KnowledgeDocument> = {}): KnowledgeDocument {
  return {
    documentId: "doc-1",
    sourceId: "source-1",
    title: "Doc 1",
    version: 1,
    tags: [],
    domainScope: [],
    status: "indexed",
    namespace: "ns-a",
    mimeType: "text/plain",
    rawText: "raw",
    structuredText: null,
    archived: false,
    archivedAt: null,
    ...overrides,
  };
}

function createChunk(overrides: Partial<KnowledgeChunk> = {}): KnowledgeChunk {
  return {
    chunkId: "chunk-1",
    documentId: "doc-1",
    content: "typescript orchestration knowledge",
    chunkType: "concept",
    metadata: { relevantFiles: [] },
    embedding: [1, 0.5, 0.25],
    tokenCount: 12,
    namespace: "ns-a",
    ordinal: 0,
    summary: "chunk summary",
    keywords: ["typescript", "orchestration"],
    embeddingId: null,
    locator: {},
    ...overrides,
  };
}

function createNamespace(overrides: Partial<KnowledgeNamespace> = {}): KnowledgeNamespace {
  return {
    namespaceId: "ns-a",
    path: "ns-a",
    description: "namespace",
    ownerDomainId: "domain-a",
    accessPolicy: "public",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "team_reviewed",
    maxDocuments: 100,
    maxTotalSizeBytes: 1024 * 1024,
    ...overrides,
  };
}

function createMemory(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: "memory-1",
    taskId: null,
    sessionId: "session-1",
    agentId: null,
    executionId: null,
    memoryLayer: "layer_1",
    scope: "session",
    contentJson: "{\"summary\":\"memory\"}",
    classification: "general",
    sourceTrustLevel: "team_reviewed",
    qualityScore: 0.7,
    hitCount: 5,
    createdAt: "2026-05-09T00:00:00.000Z",
    lastAccessedAt: "2026-05-09T00:00:00.000Z",
    expiresAt: null,
    revokedAt: null,
    revocationReason: null,
    kind: "general",
    status: "active",
    importanceScore: 0.8,
    freshnessScore: 0.9,
    contentHash: null,
    ...overrides,
  } as MemoryRecord;
}

test("R24-13: publishPackage auto-approves review-optional packages and records the generated reviewId", () => {
  const workspace = createTempWorkspace("aa-reaudit-r24-13-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    const pkg = service.registerExtensionPackage({
      extensionId: "plugin.review-optional",
      packageType: "plugin",
      displayName: "Review Optional",
      version: "1.0.0",
      owner: "owner",
      trustLevel: "internal",
      sourceUri: "registry://plugin/review-optional",
      capabilities: ["read_only"],
      permissions: ["read.audit"],
      compatibility: {
        apiContract: "^1.0.0",
        permissionSurface: "^1.0.0",
        runtimeCapability: "^1.0.0",
      },
      signatureVerified: true,
      sbomVerified: true,
      sandboxCertVerified: true,
      egressPolicyCompliant: true,
      manifestChecksum: "a".repeat(64),
      reviewRequired: false,
    });

    const publication = service.publishPackage({ packageId: pkg.packageId });
    assert.equal(publication.status, "published");
    assert.notEqual(publication.reviewId, "");
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("R24-15: StructuredLogger counts pending async writes when deciding file rotation", async () => {
  const loggerSource = readFileSync(
    join(process.cwd(), "src", "platform", "shared", "observability", "structured-logger.ts"),
    "utf8",
  );
  assert.equal(loggerSource.includes("pendingBytes"), true);
  assert.equal(loggerSource.includes("currentBytes + state.pendingBytes"), true);

  const logPath = join(process.cwd(), "data", `reaudit-r24-15-${Date.now()}.log`);
  writeFileSync(logPath, "x".repeat(95), "utf8");

  const fsModule = await import("node:fs");
  const originalAppendFile = fsModule.promises.appendFile;
  let releaseWrites!: () => void;
  const writesReleased = new Promise<void>((resolve) => {
    releaseWrites = resolve;
  });
  (fsModule.promises as { appendFile: typeof originalAppendFile }).appendFile = (async (...args: Parameters<typeof originalAppendFile>) => {
    await writesReleased;
    return originalAppendFile(...args);
  }) as typeof originalAppendFile;

  try {
    StructuredLogger.configureGlobalFileSink({ filePath: logPath, maxBytes: 100, maxFiles: 2 });
    const logger = new StructuredLogger({ retentionLimit: 10 });
    logger.log({ level: "info", message: "first pending entry", data: { id: 1 } });
    logger.log({ level: "info", message: "second pending entry", data: { id: 2 } });
    await new Promise((resolve) => setImmediate(resolve));
    releaseWrites();
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(existsSync(logPath), true);
  } finally {
    StructuredLogger.configureGlobalFileSink(null);
    (fsModule.promises as { appendFile: typeof originalAppendFile }).appendFile = originalAppendFile;
    cleanupPath(logPath);
    cleanupPath(`${logPath}.1`);
  }
});

test("R24-16: choosePreemptionVictim skips protected executions and honors minimum preemptable priority", () => {
  const victim = choosePreemptionVictim([
    {
      executionId: "protected",
      priority: 1,
      progressPercent: 10,
      protectedFromPreemption: true,
      lastCheckpointTimestampMs: Date.now(),
    },
    {
      executionId: "eligible",
      priority: 3,
      progressPercent: 20,
      lastCheckpointTimestampMs: Date.now(),
    },
  ], 300_000, 2);

  assert.equal(victim?.executionId, "eligible");
});

test("R24-17: ResourcePoolService requires the owning consumer to release allocated units", () => {
  const service = new ResourcePoolService();
  service.registerPool({
    poolId: "pool-r24-17",
    resourceType: "worker",
    scopeType: "shared",
    capacityUnits: 10,
    allocatedUnits: 0,
    burstUnits: 0,
    failureRateThreshold: 0.3,
    minSampleSize: 20,
    failureRate: 0,
    sampleCount: 0,
    isolationStatus: "active",
  });
  service.allocate("pool-r24-17", "consumer-a", 4);

  assert.throws(
    () => service.release("pool-r24-17", "consumer-b", 1),
    /resource_pool\.unauthorized_release/,
  );
  const updated = service.release("pool-r24-17", "consumer-a", 2);
  assert.equal(updated.allocatedUnits, 2);
});

test("R24-18: KnowledgeRetrievalService returns semantic candidates when a vector store is configured", async () => {
  const archive = new KnowledgeArchive();
  const index = new KeywordKnowledgeIndex();
  const graph = new SemanticKnowledgeGraph();
  const namespaceStore = new NamespacePolicyStore();
  namespaceStore.register(createNamespace({ namespaceId: "ns-a", path: "ns-a" }));
  archive.upsert({
    source: createSource({ checksum: "checksum-r24-18" }),
    document: createDocument({ documentId: "doc-r24-18", sourceId: "source-1" }),
    chunks: [createChunk({ chunkId: "chunk-r24-18", documentId: "doc-r24-18", keywords: ["semantic"], summary: "semantic summary" })],
  });

  const vectorStore: SemanticVectorStore = {
    backend: "local_hash",
    async upsertChunks() {},
    async querySimilar() {
      return [{ knowledgeRef: "knowledge:chunk-r24-18", namespace: "ns-a", similarity: 0.92 }];
    },
    inspect() {
      return { backend: "local_hash", ready: true, details: {} };
    },
  };
  const retrieval = new KnowledgeRetrievalService(
    index,
    archive,
    namespaceStore,
    graph,
    vectorStore,
  );

  const hits = await retrieval.queryAsync("federated semantic lookup", {
    namespace: "ns-a",
    accessPrincipal: {
      principalId: "principal-1",
      domainId: "domain-a",
      roles: ["reader"],
      permittedNamespaces: ["ns-a"],
    },
  });
  assert.equal(hits[0]?.knowledgeRef, "knowledge:chunk-r24-18");
  assert.equal(hits[0]?.matchType, "semantic");
});

test("R24-19/R24-24: old LRU memories can evict under pressure and legacy promotion rules align with six-layer thresholds", () => {
  const oldMemory = createMemory({
    createdAt: "2026-05-09T00:00:00.000Z",
    lastAccessedAt: "2026-05-09T00:00:00.000Z",
  });
  const originalNow = Date.now;
  Date.now = () => Date.parse("2026-05-09T00:40:00.000Z");
  try {
    assert.equal(shouldEvict(oldMemory, 20, 10), true);
  } finally {
    Date.now = originalNow;
  }

  assert.deepEqual(
    DEFAULT_MEMORY_PROMOTION_RULES.map((rule) => ({
      from: rule.from,
      to: rule.to,
      minHitCount: rule.minHitCount,
      minQualityScore: rule.minQualityScore,
      minImportanceScore: rule.minImportanceScore,
    })),
    [
      { from: "runtime", to: "session", minHitCount: 3, minQualityScore: 0.4, minImportanceScore: 0.3 },
      { from: "session", to: "agent", minHitCount: 8, minQualityScore: 0.55, minImportanceScore: 0.5 },
      { from: "agent", to: "project", minHitCount: 10, minQualityScore: 0.8, minImportanceScore: 0.65 },
      { from: "project", to: "user", minHitCount: 25, minQualityScore: 0.8, minImportanceScore: 0.75 },
      { from: "user", to: "evolution", minHitCount: 40, minQualityScore: 0.9, minImportanceScore: 0.85 },
    ],
  );
  assert.equal(DEFAULT_SIX_LAYER_TRANSITION_RULES.length, 5);
});

test("R24-21/R24-23: SemanticKnowledgeGraph supports relation aliases and dedupes repeated edges", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.addEntityRelation("entity-a", "entity-b", "related_to", 1);
  graph.addEntityRelation("entity-a", "entity-b", "related_to", 1);
  graph.addEntityRelation("entity-b", "entity-c", "contradicts", 0.5);
  graph.addEntityRelation("entity-c", "entity-d", "derives_from", 0.8);

  const inspection = graph.inspect();
  const relatedEdges = inspection.edges.filter((edge) => edge.fromNodeId === "entity:entity-a" && edge.toNodeId === "entity:entity-b");
  assert.equal(relatedEdges.length, 1);
  assert.equal(relatedEdges[0]?.relation, "relates_to");
  assert.equal(inspection.edges.some((edge) => edge.relation === "contradicts"), true);
  assert.equal(inspection.edges.some((edge) => edge.relation === "derived_from"), true);
});

test("R24-25/R24-26: federated knowledge queries merge namespaces and archive retains version history with diff + rollback", () => {
  const archive = new KnowledgeArchive();
  const index = new KeywordKnowledgeIndex();
  const graph = new SemanticKnowledgeGraph();
  const namespaceStore = new NamespacePolicyStore();
  namespaceStore.register(createNamespace({ namespaceId: "ns-a", path: "ns-a", ownerDomainId: "domain-a" }));
  namespaceStore.register(createNamespace({ namespaceId: "ns-b", path: "ns-b", ownerDomainId: "domain-b" }));
  const retrieval = new KnowledgeRetrievalService(
    index,
    archive,
    namespaceStore,
    graph,
  );
  const service = new KnowledgeQueryService(retrieval);

  const v1 = {
    source: createSource({ sourceId: "source-a", namespace: "ns-a", checksum: "checksum-a-v1" }),
    document: createDocument({ documentId: "doc-federated", sourceId: "source-a", namespace: "ns-a", version: 1 }),
    chunks: [createChunk({ chunkId: "chunk-a-1", documentId: "doc-federated", namespace: "ns-a", keywords: ["typescript"], summary: "A1" })],
  };
  const v2 = {
    source: createSource({ sourceId: "source-a", namespace: "ns-a", checksum: "checksum-a-v2" }),
    document: createDocument({ documentId: "doc-federated", sourceId: "source-a", namespace: "ns-a", version: 2 }),
    chunks: [createChunk({ chunkId: "chunk-a-2", documentId: "doc-federated", namespace: "ns-a", keywords: ["typescript"], summary: "A2" })],
  };
  const nsBRecord = {
    source: createSource({ sourceId: "source-b", namespace: "ns-b", checksum: "checksum-b-v1" }),
    document: createDocument({ documentId: "doc-b", sourceId: "source-b", namespace: "ns-b", title: "Doc B" }),
    chunks: [createChunk({ chunkId: "chunk-b-1", documentId: "doc-b", namespace: "ns-b", keywords: ["typescript"], summary: "B1" })],
  };

  archive.upsert(v1);
  archive.upsert(v2);
  archive.upsert(nsBRecord);
  index.upsert(v2.chunks[0]!);
  index.upsert(nsBRecord.chunks[0]!);

  const federated = service.queryFederated("typescript", ["ns-a", "ns-b"], {
    limit: 5,
    accessPrincipal: {
      principalId: "principal-1",
      domainId: "domain-a",
      roles: ["cross_domain_reader"],
      permittedNamespaces: ["ns-a", "ns-b"],
    },
  }, QueryLevel.Standard);
  assert.deepEqual(federated.map((hit) => hit.namespace).sort(), ["ns-a", "ns-b"]);

  const versions = archive.listVersions("doc-federated");
  assert.deepEqual(versions.map((record) => record.document.version), [1, 2]);
  const diff = archive.diffDocumentVersions("doc-federated", 1, 2);
  assert.deepEqual(diff?.addedChunkIds, ["chunk-a-2"]);
  assert.deepEqual(diff?.removedChunkIds, ["chunk-a-1"]);

  const rolledBack = archive.rollbackDocument("doc-federated", 1);
  assert.ok(rolledBack);
  assert.equal(archive.getDocument("doc-federated")?.chunks[0]?.chunkId, "chunk-a-1");
});

test("R24-27/R24-28: workflow step checkpoints expose restore state and version diffs", () => {
  const base = createWorkflowStepCheckpoint({
    taskId: "task-1",
    executionId: "exec-1",
    workflowId: "workflow-1",
    divisionId: "division-1",
    harnessRunId: "harness-1",
    nodeRunId: "node-1",
    planGraphId: "graph-1",
    stepId: "step-1",
    roleId: "role-1",
    outputKey: "result",
    status: "succeeded",
    producedAt: "2026-05-09T00:00:00.000Z",
    output: { summary: "done" },
    decisionContext: {
      source: "planner",
      request: "run",
      routeReason: null,
      priorStepSummaries: [],
      dependsOnStepIds: [],
    },
    resumeContext: {
      completedStepIds: ["step-1"],
      nextStepId: "step-2",
      outputKeys: ["result"],
    },
    compensationModel: {
      strategy: "undo_patch",
      rollbackTaskId: "rollback-1",
    },
  });
  const next = createWorkflowStepCheckpoint({
    ...base,
    status: "failed",
    producedAt: "2026-05-09T00:10:00.000Z",
    resumeContext: {
      ...base.resumeContext,
      outputKeys: ["result", "diagnostics"],
      nextStepId: "step-3",
    },
  });

  const restored = restoreWorkflowStepCheckpoint(base);
  assert.equal(restored.nodeRunId, "node-1");
  assert.deepEqual(restored.resumeContext.outputKeys, ["result"]);

  const diff = compareWorkflowStepCheckpointVersions(base, next);
  assert.equal(diff.statusChanged, true);
  assert.deepEqual(diff.outputKeysAdded, ["diagnostics"]);
  assert.equal(diff.nextStepChanged, true);
});

test("workflow checkpoint diff treats compensation model key order as stable", () => {
  const previous = createWorkflowStepCheckpoint({
    taskId: "task-1",
    executionId: "exec-1",
    workflowId: "workflow-1",
    divisionId: "division-1",
    harnessRunId: "harness-1",
    nodeRunId: "node-1",
    planGraphId: "graph-1",
    stepId: "step-1",
    roleId: "role-1",
    outputKey: "result",
    status: "succeeded",
    producedAt: "2026-05-09T00:00:00.000Z",
    output: { summary: "done" },
    decisionContext: {
      source: "planner",
      request: "run",
      routeReason: null,
      priorStepSummaries: [],
      dependsOnStepIds: [],
    },
    resumeContext: {
      completedStepIds: ["step-1"],
      nextStepId: "step-2",
      outputKeys: ["result"],
    },
    compensationModel: { strategy: "idempotent_replay", b: 2, a: 1 },
  });
  const next = createWorkflowStepCheckpoint({
    ...previous,
    compensationModel: { strategy: "idempotent_replay", a: 1, b: 2 },
  });

  const diff = compareWorkflowStepCheckpointVersions(previous, next);

  assert.equal(diff.compensationChanged, false);
});
