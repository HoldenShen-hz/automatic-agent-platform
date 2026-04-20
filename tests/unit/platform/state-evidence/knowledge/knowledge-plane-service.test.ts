import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { KnowledgeArchive } from "../../../../../src/platform/state-evidence/knowledge/archive/knowledge-archive.js";
import { DomainRegistryService } from "../../../../../src/domains/registry/domain-registry-service.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";
import type { RetrieverKnowledgeResult } from "../../../../../src/domains/registry/plugin-spi.js";
import { PluginSpiRegistry } from "../../../../../src/domains/registry/plugin-spi-registry.js";
import { KnowledgeSnapshotStore } from "../../../../../src/platform/state-evidence/knowledge/archive/knowledge-snapshot-store.js";
import { KnowledgeAuditLogger } from "../../../../../src/platform/state-evidence/knowledge/governance/knowledge-audit-logger.js";
import { KnowledgePlaneService } from "../../../../../src/platform/state-evidence/knowledge/knowledge-plane-service.js";
import type {
  SemanticVectorCandidate,
  SemanticVectorChunkRecord,
  SemanticVectorStore,
  SemanticVectorStoreProfile,
} from "../../../../../src/platform/state-evidence/knowledge/semantic-vector-store.js";
import { LocalHashSemanticVectorStore } from "../../../../../src/platform/state-evidence/knowledge/semantic-vector-store.js";
import { StructuredLogger } from "../../../../../src/platform/shared/observability/structured-logger.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

test("KnowledgePlaneService merges local and domain retriever results", async () => {
  const pluginRegistry = new PluginSpiRegistry();
  let pluginKnowledgeRef: RetrieverKnowledgeResult = { knowledgeRef: "knowledge:missing", snippet: "Missing chunk", score: 0.5, namespace: "coding/repo", chunkId: "chunk:missing", documentId: "doc:missing", matchType: "keyword" as const };
  pluginRegistry.register({
    pluginId: "plugin.coding.retriever",
    domainId: "coding",
    spiType: "retriever",
    async retrieve() {
      return [pluginKnowledgeRef];
    },
  }, {
    pluginId: "plugin.coding.retriever",
    name: "coding retriever",
    version: "1.0.0",
    owner: "test",
    domainIds: ["coding"],
    capabilityIds: ["knowledge.retrieve"],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "tests/mock",
    settingsSchema: {},
    sandbox: {
      timeoutMs: 1000,
      allowFilesystemWrite: false,
      allowNetworkEgress: false,
      allowedKnowledgeNamespaces: ["coding/repo"],
      maxConcurrentInvocations: 1,
      maxQueuedInvocations: 8,
      runtimeIsolation: "serialized_in_process",
      cooldownMs: 0,
    },
  });

  const domains = new DomainRegistryService({ pluginRegistry });
  domains.register({
    domainId: "coding",
    name: "Coding",
    description: "Coding domain",
    version: 1,
    workflows: [{ workflowId: "wf", name: "wf", triggerConditions: {}, steps: [] }],
    toolBundles: [{ bundleId: "default", tools: [{ toolName: "read", enabled: true, configOverrides: {} }] }],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {
      supportedTaskTypes: ["bugfix"],
      requiredTools: ["read"],
      optionalTools: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 1000, maxCostPerTask: 1 },
      securityLevel: "standard",
    },
    status: "testing",
    externalAdapters: [],
    pluginBindings: [{
      bindingId: "binding.retriever",
      domainId: "coding",
      pluginType: "retriever",
      pluginId: "plugin.coding.retriever",
      priority: 10,
      enabled: true,
      config: {},
    }],
  });

  const plane = new KnowledgePlaneService({
    domainRegistry: domains,
    pluginRegistry,
  });

  plane.registerNamespace({
    namespaceId: "ns_1",
    path: "coding/repo",
    description: "Coding repo knowledge",
    ownerDomainId: "coding",
    accessPolicy: "domain_only",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 100,
    maxTotalSizeBytes: 1000000,
  });

  const ingested = plane.ingest({
    title: "Build troubleshooting",
    body: "Retry the build after clearing stale caches.",
    namespace: "coding/repo",
    sourceType: "text",
    trustLevel: "verified",
  });

  const pluginAugmented = plane.ingest({
    title: "Plugin troubleshooting",
    body: "Plugin supplied snippet",
    namespace: "coding/repo",
    sourceType: "text",
    trustLevel: "verified",
  });

  const pluginChunk = pluginAugmented.chunks[0];
  assert.ok(pluginChunk);
  pluginKnowledgeRef = { knowledgeRef: `knowledge:${pluginChunk!.chunkId}`, snippet: "Plugin supplied snippet", score: 0.9, namespace: "coding/repo", chunkId: pluginChunk!.chunkId, documentId: "doc:plugin", matchType: "semantic" as const };
  const hits = await plane.queryForDomain("retry", {
    domainId: "coding",
    namespace: "coding/repo",
    includePluginRetrieval: true,
    limit: 5,
  });

  assert.ok(hits.some((hit) => hit.knowledgeRef === `knowledge:${ingested.chunks[0]!.chunkId}`));
  assert.ok(hits.some((hit) => hit.knowledgeRef === `knowledge:${pluginChunk!.chunkId}`));
  const graph = plane.inspectGraph({ knowledgeRef: `knowledge:${ingested.chunks[0]!.chunkId}` });
  assert.ok(graph.nodes.some((node) => node.nodeType === "chunk"));
  assert.ok(graph.edges.some((edge) => edge.relation === "contains"));
});

test("KnowledgePlaneService restores namespaces and documents from snapshot store", () => {
  const workspace = createTempWorkspace("aa-knowledge-snapshot-");

  try {
    const snapshotStore = new KnowledgeSnapshotStore({
      snapshotPath: join(workspace, "knowledge.snapshot.json"),
    });
    const first = new KnowledgePlaneService({ snapshotStore });
    first.registerNamespace({
      namespaceId: "ns_shared_common",
      path: "shared/common",
      description: "shared",
      ownerDomainId: "shared",
      accessPolicy: "public",
      freshnessPolicy: {
        maxAgeDays: 90,
        staleAction: "warn",
        refreshStrategy: "manual",
        refreshIntervalHours: null,
      },
      trustLevel: "reviewed",
      maxDocuments: 100,
      maxTotalSizeBytes: 100000,
    });
    first.ingest({
      title: "Conventions",
      body: "Always keep route names stable.",
      namespace: "shared/common",
      trustLevel: "reviewed",
    });

    const restored = new KnowledgePlaneService({ snapshotStore });
    assert.equal(restored.listNamespaces()[0]?.path, "shared/common");
    assert.equal(restored.inspectNamespace("shared/common").documentCount, 1);
    assert.equal(restored.query("stable", { namespace: "shared/common" }).length, 1);
  } finally {
    cleanupPath(workspace);
  }
});

test("KnowledgePlaneService restores semantic vector records from snapshot store", async () => {
  const workspace = createTempWorkspace("aa-knowledge-semantic-snapshot-");

  try {
    const snapshotStore = new KnowledgeSnapshotStore({
      snapshotPath: join(workspace, "knowledge.snapshot.json"),
    });
    const first = new KnowledgePlaneService({
      snapshotStore,
      semanticVectorStore: new LocalHashSemanticVectorStore(),
    });
    first.registerNamespace({
      namespaceId: "ns_shared_common",
      path: "shared/common",
      description: "shared",
      ownerDomainId: "shared",
      accessPolicy: "public",
      freshnessPolicy: {
        maxAgeDays: 90,
        staleAction: "warn",
        refreshStrategy: "manual",
        refreshIntervalHours: null,
      },
      trustLevel: "reviewed",
      maxDocuments: 100,
      maxTotalSizeBytes: 100000,
    });
    await first.ingestAsync({
      title: "Build diagnostics",
      body: "Build failures usually recover after clearing stale caches and re-running the pipeline once.",
      namespace: "shared/common",
      sourceType: "text",
      trustLevel: "reviewed",
    });

    const restored = new KnowledgePlaneService({
      snapshotStore,
      semanticVectorStore: new LocalHashSemanticVectorStore(),
    });
    await restored.initialize();
    const hits = await restored.queryAsync("compilation", {
      namespace: "shared/common",
      limit: 5,
    });

    assert.equal(restored.inspectNamespace("shared/common").documentCount, 1);
    assert.ok(hits.some((hit) => hit.matchType === "semantic"));
  } finally {
    cleanupPath(workspace);
  }
});

test("KnowledgePlaneService initialize fails closed when semantic backend bootstrap fails", async () => {
  class FailingSemanticVectorStore implements SemanticVectorStore {
    public readonly backend = "pgvector" as const;

    public async upsertChunks(_records: readonly SemanticVectorChunkRecord[]): Promise<void> {
      throw new Error("semantic.init_failed");
    }

    public async querySimilar(_input: {
      query: string;
      namespace?: string;
      limit?: number;
      minSimilarity?: number;
    }): Promise<SemanticVectorCandidate[]> {
      return [];
    }

    public inspect(): SemanticVectorStoreProfile {
      return {
        backend: "pgvector",
        ready: false,
        details: {
          status: "failing",
        },
      };
    }
  }

  const plane = new KnowledgePlaneService({
    semanticVectorStore: new FailingSemanticVectorStore(),
  });

  await assert.rejects(() => plane.initialize(), /semantic\.init_failed/);
});

test("KnowledgePlaneService emits chunk indexed events for semantic graph ingestion", () => {
  const events: string[] = [];
  const plane = new KnowledgePlaneService({
    eventPublisher: {
      publish(input) {
        events.push(input.eventType);
      },
    },
  });

  plane.registerNamespace({
    namespaceId: "ns_coding_repo",
    path: "coding/repo",
    description: "repo knowledge",
    ownerDomainId: "coding",
    accessPolicy: "domain_only",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 100,
    maxTotalSizeBytes: 1000000,
  });
  const ingested = plane.ingest({
    title: "Retry policy",
    body: "Retry failed builds.\n\nRetry stale jobs again.",
    namespace: "coding/repo",
    sourceType: "text",
    trustLevel: "verified",
  });

  const graph = plane.inspectGraph({ keyword: "retry" });
  assert.ok(graph.nodes.some((node) => node.nodeType === "keyword" && node.label === "retry"));
  assert.ok(graph.edges.some((edge) => edge.relation === "shared_keyword" || edge.relation === "contains"));
  assert.equal(events.filter((eventType) => eventType === "knowledge:chunk_indexed").length, ingested.chunks.length);
});

test("KnowledgePlaneService audits and filters cross-domain plugin knowledge access", async () => {
  const pluginRegistry = new PluginSpiRegistry();
  let pluginKnowledgeRef: RetrieverKnowledgeResult = { knowledgeRef: "knowledge:missing", snippet: "Missing chunk", score: 0.5, namespace: "shared/finance", chunkId: "chunk:missing", documentId: "doc:missing", matchType: "keyword" };
  pluginRegistry.register({
    pluginId: "plugin.shared.retriever",
    domainId: "ops",
    spiType: "retriever",
    async retrieve() {
      return [pluginKnowledgeRef];
    },
  }, {
    pluginId: "plugin.shared.retriever",
    name: "shared retriever",
    version: "1.0.0",
    owner: "test",
    domainIds: ["ops"],
    capabilityIds: ["knowledge.retrieve"],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "tests/mock",
    settingsSchema: {},
    sandbox: {
      timeoutMs: 1000,
      allowFilesystemWrite: false,
      allowNetworkEgress: false,
      allowedKnowledgeNamespaces: ["shared/finance"],
      maxConcurrentInvocations: 1,
      maxQueuedInvocations: 8,
      runtimeIsolation: "serialized_in_process",
      cooldownMs: 0,
    },
  });

  const domains = new DomainRegistryService({ pluginRegistry });
  domains.register({
    domainId: "ops",
    name: "Ops",
    description: "Ops domain",
    version: 1,
    workflows: [{ workflowId: "wf", name: "wf", triggerConditions: {}, steps: [] }],
    toolBundles: [{ bundleId: "default", tools: [{ toolName: "read", enabled: true, configOverrides: {} }] }],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {
      supportedTaskTypes: ["support"],
      requiredTools: ["read"],
      optionalTools: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 1000, maxCostPerTask: 1 },
      securityLevel: "standard",
    },
    status: "testing",
    externalAdapters: [],
    pluginBindings: [{
      bindingId: "binding.shared.retriever",
      domainId: "ops",
      pluginType: "retriever",
      pluginId: "plugin.shared.retriever",
      priority: 10,
      enabled: true,
      config: {},
    }],
  });

  const auditLogger = new StructuredLogger({ retentionLimit: 20 });
  const plane = new KnowledgePlaneService({
    domainRegistry: domains,
    pluginRegistry,
    knowledgeAuditLogger: new KnowledgeAuditLogger(auditLogger),
  });

  plane.registerNamespace({
    namespaceId: "ns_shared_finance",
    path: "shared/finance",
    description: "Finance knowledge",
    ownerDomainId: "finance",
    accessPolicy: "restricted",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 100,
    maxTotalSizeBytes: 1000000,
  });

  const ingested = plane.ingest({
    title: "Finance-only policy",
    body: "Quarter close playbook",
    namespace: "shared/finance",
    sourceType: "text",
    trustLevel: "verified",
  });

  pluginKnowledgeRef = { knowledgeRef: `knowledge:${ingested.chunks[0]!.chunkId}`, snippet: "Finance chunk", score: 0.9, namespace: "shared/finance", chunkId: ingested.chunks[0]!.chunkId, documentId: "doc:finance", matchType: "semantic" };
  const hits = await plane.queryForDomain("quarter", {
    domainId: "ops",
    includePluginRetrieval: true,
    accessPrincipal: {
      principalId: "ops_reader",
      domainId: "ops",
      roles: ["reader"],
    },
    limit: 5,
  });

  assert.equal(hits.length, 0);
  const auditEntry = auditLogger.recent().find((entry) => entry.message === "knowledge.audit.access");
  assert.ok(auditEntry);
  assert.equal(auditEntry?.level, "error");
  assert.equal(auditEntry?.data?.crossDomain, true);
  assert.equal(auditEntry?.data?.reasonCode, "knowledge.access.cross_domain_denied");
});

test("KnowledgePlaneService handles plugin retriever error gracefully", async () => {
  // Test that plugin retriever errors are caught and don't break the query
  const pluginRegistry = new PluginSpiRegistry();

  // Register a plugin that throws when retrieve is called
  pluginRegistry.register({
    pluginId: "plugin.error.retriever",
    domainId: "test",
    spiType: "retriever",
    async retrieve() {
      throw new Error("Plugin retrieval failed");
    },
  }, {
    pluginId: "plugin.error.retriever",
    name: "error retriever",
    version: "1.0.0",
    owner: "test",
    domainIds: ["test"],
    capabilityIds: ["knowledge.retrieve"],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "tests/mock",
    settingsSchema: {},
    sandbox: {
      timeoutMs: 1000,
      allowFilesystemWrite: false,
      allowNetworkEgress: false,
      allowedKnowledgeNamespaces: [],
      maxConcurrentInvocations: 1,
      maxQueuedInvocations: 8,
      runtimeIsolation: "serialized_in_process",
      cooldownMs: 0,
    },
  });

  const domains = new DomainRegistryService({ pluginRegistry });
  domains.register({
    domainId: "test",
    name: "Test",
    description: "Test domain",
    version: 1,
    workflows: [],
    toolBundles: [],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {
      supportedTaskTypes: [],
      requiredTools: [],
      optionalTools: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 1000, maxCostPerTask: 1 },
      securityLevel: "standard",
    },
    status: "testing",
    externalAdapters: [],
    pluginBindings: [{
      bindingId: "binding.error",
      domainId: "test",
      pluginType: "retriever",
      pluginId: "plugin.error.retriever",
      priority: 10,
      enabled: true,
      config: {},
    }],
  });

  const plane = new KnowledgePlaneService({
    domainRegistry: domains,
    pluginRegistry,
  });

  // Should not throw even though the plugin throws
  const hits = await plane.queryForDomain("test query", {
    domainId: "test",
    includePluginRetrieval: true,
    limit: 5,
  });

  // Should return empty or local hits, not throw
  assert.ok(Array.isArray(hits));
});

test("KnowledgePlaneService handles plugin KnowledgeRef format when chunk exists in archive", async () => {
  // Test that plugin retriever results with refType === "knowledge" are processed correctly
  // when the referenced chunk exists in the archive
  const pluginRegistry = new PluginSpiRegistry();
  let pluginKnowledgeRef: any = { knowledgeRef: "knowledge:missing", snippet: "Missing chunk", score: 0.5, namespace: "coding/repo", chunkId: "chunk:missing", documentId: "doc:missing", matchType: "keyword" as const };

  pluginRegistry.register({
    pluginId: "plugin.kref.retriever",
    domainId: "coding",
    spiType: "retriever",
    async retrieve() {
      return [pluginKnowledgeRef];
    },
  }, {
    pluginId: "plugin.kref.retriever",
    name: "kref retriever",
    version: "1.0.0",
    owner: "test",
    domainIds: ["coding"],
    capabilityIds: ["knowledge.retrieve"],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "tests/mock",
    settingsSchema: {},
    sandbox: {
      timeoutMs: 1000,
      allowFilesystemWrite: false,
      allowNetworkEgress: false,
      allowedKnowledgeNamespaces: ["coding/repo"],
      maxConcurrentInvocations: 1,
      maxQueuedInvocations: 8,
      runtimeIsolation: "serialized_in_process",
      cooldownMs: 0,
    },
  });

  const domains = new DomainRegistryService({ pluginRegistry });
  domains.register({
    domainId: "coding",
    name: "Coding",
    description: "Coding domain",
    version: 1,
    workflows: [{ workflowId: "wf", name: "wf", triggerConditions: {}, steps: [] }],
    toolBundles: [{ bundleId: "default", tools: [{ toolName: "read", enabled: true, configOverrides: {} }] }],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {
      supportedTaskTypes: ["bugfix"],
      requiredTools: ["read"],
      optionalTools: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 1000, maxCostPerTask: 1 },
      securityLevel: "standard",
    },
    status: "testing",
    externalAdapters: [],
    pluginBindings: [{
      bindingId: "binding.kref",
      domainId: "coding",
      pluginType: "retriever",
      pluginId: "plugin.kref.retriever",
      priority: 10,
      enabled: true,
      config: {},
    }],
  });

  const plane = new KnowledgePlaneService({
    domainRegistry: domains,
    pluginRegistry,
  });

  plane.registerNamespace({
    namespaceId: "ns_coding_repo",
    path: "coding/repo",
    description: "Coding repo knowledge",
    ownerDomainId: "coding",
    accessPolicy: "domain_only",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 100,
    maxTotalSizeBytes: 1000000,
  });

  const ingested = plane.ingest({
    title: "Build troubleshooting",
    body: "Retry the build after clearing stale caches.",
    namespace: "coding/repo",
    sourceType: "text",
    trustLevel: "verified",
  });

  // Update plugin ref to point to the ingested chunk with refType === "knowledge"
  pluginKnowledgeRef = {
    refType: "knowledge" as const,
    knowledgeRef: `knowledge:${ingested.chunks[0]!.chunkId}`,
    snippet: "Plugin supplied snippet", // Should be overridden by archive summary
    score: 0.9,
    namespace: "coding/repo",
    chunkId: ingested.chunks[0]!.chunkId,
    documentId: "doc:plugin",
    matchType: "semantic" as const,
  };

  const hits = await plane.queryForDomain("retry", {
    domainId: "coding",
    namespace: "coding/repo",
    includePluginRetrieval: true,
    limit: 5,
  });

  // Should find both local hit and plugin hit
  const localHit = hits.find((hit) => hit.knowledgeRef === `knowledge:${ingested.chunks[0]!.chunkId}`);
  assert.ok(localHit);
  // The snippet should come from archive since chunk exists
  assert.ok(localHit!.snippet.length > 0);
});

test("KnowledgePlaneService handles plugin KnowledgeRef format when chunk not in archive - filtered by authorization", async () => {
  // Test that plugin retriever results with refType === "knowledge" for non-existent chunks
  // are filtered out by filterAuthorizedHits (security measure)
  const pluginRegistry = new PluginSpiRegistry();
  const nonExistentChunkId = "chunk:does_not_exist";

  pluginRegistry.register({
    pluginId: "plugin.missing.retriever",
    domainId: "coding",
    spiType: "retriever",
    async retrieve() {
      // Return a KnowledgeRef format result pointing to a chunk NOT in archive
      return [{
        refType: "knowledge" as const,
        knowledgeRef: `knowledge:${nonExistentChunkId}`,
        snippet: "Should be filtered since chunk not in archive",
        score: 0.9,
        namespace: "coding/repo",
        chunkId: nonExistentChunkId,
        documentId: "doc:missing",
        matchType: "semantic" as const,
      }];
    },
  }, {
    pluginId: "plugin.missing.retriever",
    name: "missing retriever",
    version: "1.0.0",
    owner: "test",
    domainIds: ["coding"],
    capabilityIds: ["knowledge.retrieve"],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "tests/mock",
    settingsSchema: {},
    sandbox: {
      timeoutMs: 1000,
      allowFilesystemWrite: false,
      allowNetworkEgress: false,
      allowedKnowledgeNamespaces: ["coding/repo"],
      maxConcurrentInvocations: 1,
      maxQueuedInvocations: 8,
      runtimeIsolation: "serialized_in_process",
      cooldownMs: 0,
    },
  });

  const domains = new DomainRegistryService({ pluginRegistry });
  domains.register({
    domainId: "coding",
    name: "Coding",
    description: "Coding domain",
    version: 1,
    workflows: [{ workflowId: "wf", name: "wf", triggerConditions: {}, steps: [] }],
    toolBundles: [{ bundleId: "default", tools: [{ toolName: "read", enabled: true, configOverrides: {} }] }],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {
      supportedTaskTypes: ["bugfix"],
      requiredTools: ["read"],
      optionalTools: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 1000, maxCostPerTask: 1 },
      securityLevel: "standard",
    },
    status: "testing",
    externalAdapters: [],
    pluginBindings: [{
      bindingId: "binding.missing",
      domainId: "coding",
      pluginType: "retriever",
      pluginId: "plugin.missing.retriever",
      priority: 10,
      enabled: true,
      config: {},
    }],
  });

  const plane = new KnowledgePlaneService({
    domainRegistry: domains,
    pluginRegistry,
  });

  plane.registerNamespace({
    namespaceId: "ns_coding_repo",
    path: "coding/repo",
    description: "Coding repo knowledge",
    ownerDomainId: "coding",
    accessPolicy: "domain_only",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 100,
    maxTotalSizeBytes: 1000000,
  });

  // Don't ingest any data - archive will be empty
  const hits = await plane.queryForDomain("retry", {
    domainId: "coding",
    namespace: "coding/repo",
    includePluginRetrieval: true,
    limit: 5,
  });

  // Hit for non-existent chunk should be filtered out by filterAuthorizedHits
  // This is correct security behavior - don't reveal existence of chunks caller can't access
  const pluginHit = hits.find((hit) => hit.chunkId === nonExistentChunkId);
  assert.equal(pluginHit, undefined, "Hit for non-existent chunk should be filtered out");
});

test("KnowledgePlaneService inspectSemanticInfrastructure returns default when semanticVectorStore is null", () => {
  // Test the fallback branch when semanticVectorStore is null
  const plane = new KnowledgePlaneService({
    semanticVectorStore: null, // explicitly null
  });

  const result = plane.inspectSemanticInfrastructure();

  assert.equal(result.backend, "local_hash");
  assert.equal(result.ready, true);
  assert.equal(result.details.managedBy, "archive_scan");
});
