import type { RetrievalHit } from "./knowledge-model.js";
import { KnowledgeArchive } from "./archive/knowledge-archive.js";
import type { ArchivedKnowledgeRecord } from "./archive/knowledge-archive.js";
import { KnowledgeSnapshotStore } from "./archive/knowledge-snapshot-store.js";
import { KnowledgeAuditLogger } from "./governance/knowledge-audit-logger.js";
import { NamespacePolicyStore } from "./governance/namespace-policy.js";
import { KeywordKnowledgeIndex } from "./keyword-index.js";
import { KnowledgeIngestionPipeline, type KnowledgeIngestionResult } from "./knowledge-ingestion-pipeline.js";
import { KnowledgeRetrievalService, type KnowledgeQueryOptions } from "./retrieval/knowledge-retrieval.js";
import { SemanticKnowledgeGraph } from "./semantic-knowledge-graph.js";
import type { SemanticVectorStore } from "./semantic-vector-store.js";
import { DomainRegistryService } from "../../../domains/registry/domain-registry-service.js";
import { PluginSpiRegistry } from "../../../domains/registry/plugin-spi-registry.js";
import type { RetrieverKnowledgeResult } from "../../../domains/registry/plugin-spi.js";
import type { TypedEventPublisher } from "../events/typed-event-publisher.js";
import { runtimeMetricsRegistry } from "../../shared/observability/runtime-metrics-registry.js";
import { startActiveSpan } from "../../shared/observability/otel-tracer.js";
import { nowIso } from "../../contracts/types/ids.js";

export interface KnowledgePlaneServiceOptions {
  index?: KeywordKnowledgeIndex;
  archive?: KnowledgeArchive;
  namespaces?: NamespacePolicyStore;
  domainRegistry?: DomainRegistryService;
  pluginRegistry?: PluginSpiRegistry;
  snapshotStore?: KnowledgeSnapshotStore;
  semanticGraph?: SemanticKnowledgeGraph;
  semanticVectorStore?: SemanticVectorStore | null;
  eventPublisher?: TypedEventPublisher;
  knowledgeAuditLogger?: KnowledgeAuditLogger;
}

function toKnowledgeHit(
  result: RetrieverKnowledgeResult,
  archive: KnowledgeArchive,
): RetrievalHit[] {
  // Handle KnowledgeRef (full structured result with refType discriminator)
  if (typeof result === "object" && result !== null && "refType" in result && result.refType === "knowledge") {
    const ref = result as { knowledgeRef: string; chunkId: string; documentId: string; score: number; matchType: "semantic" | "keyword" | "structural"; namespace: string };
    const record = archive.getChunk(ref.chunkId);
    if (record) {
      return [{
        chunkId: record.chunk.chunkId,
        documentId: record.record.document.documentId,
        score: ref.score,
        matchType: ref.matchType,
        snippet: record.chunk.summary,
        namespace: ref.namespace,
        knowledgeRef: ref.knowledgeRef,
      }];
    }
    // record not in archive - return hit with available metadata
    return [{
      chunkId: ref.chunkId,
      documentId: ref.documentId,
      score: ref.score,
      matchType: ref.matchType,
      snippet: "",
      namespace: ref.namespace,
      knowledgeRef: ref.knowledgeRef,
    }];
  }

  // Handle partial object form (anonymous object with optional fields)
  if (typeof result !== "object" || result === null) {
    return [];
  }

  const obj = result as { chunkId?: string; knowledgeRef?: string; score?: number; matchType?: string; snippet?: string; namespace?: string; documentId?: string };

  const chunkId = obj.chunkId ?? (obj.knowledgeRef ? obj.knowledgeRef.replace(/^knowledge:/, "") : null);
  if (chunkId != null) {
    const record = archive.getChunk(chunkId);
    if (record) {
      return [{
        chunkId: record.chunk.chunkId,
        documentId: record.record.document.documentId,
        score: obj.score ?? 1,
        matchType: (obj.matchType as "semantic" | "keyword" | "structural") ?? "semantic",
        snippet: obj.snippet ?? record.chunk.summary,
        namespace: obj.namespace ?? record.chunk.namespace,
        knowledgeRef: obj.knowledgeRef ?? `knowledge:${record.chunk.chunkId}`,
      }];
    }
  }

  if (obj.chunkId && obj.documentId && obj.snippet && obj.namespace && obj.knowledgeRef) {
    return [{
      chunkId: obj.chunkId,
      documentId: obj.documentId,
      score: obj.score ?? 1,
      matchType: (obj.matchType as "semantic" | "keyword" | "structural") ?? "semantic",
      snippet: obj.snippet,
      namespace: obj.namespace,
      knowledgeRef: obj.knowledgeRef,
    }];
  }

  return [];
}

function mergeHits(localHits: readonly RetrievalHit[], pluginHits: readonly RetrievalHit[], limit: number): RetrievalHit[] {
  const merged = new Map<string, RetrievalHit>();
  for (const hit of [...localHits, ...pluginHits]) {
    const current = merged.get(hit.knowledgeRef);
    if (!current || current.score < hit.score) {
      merged.set(hit.knowledgeRef, hit);
    }
  }
  return [...merged.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

export class KnowledgePlaneService {
  private readonly archive: KnowledgeArchive;
  private readonly retrieval: KnowledgeRetrievalService;
  private readonly pipeline: KnowledgeIngestionPipeline;
  private readonly namespaces: NamespacePolicyStore;
  private readonly domainRegistry: DomainRegistryService | null;
  private readonly pluginRegistry: PluginSpiRegistry | null;
  private readonly snapshotStore: KnowledgeSnapshotStore | null;
  private readonly semanticGraph: SemanticKnowledgeGraph;
  private readonly semanticVectorStore: SemanticVectorStore | null;
  private readonly eventPublisher: TypedEventPublisher | null;
  private pendingSemanticSync: Promise<void> = Promise.resolve();
  private semanticSyncScheduled = false;

  public constructor(options: KnowledgePlaneServiceOptions = {}) {
    const index = options.index ?? new KeywordKnowledgeIndex();
    this.archive = options.archive ?? new KnowledgeArchive();
    const namespaces = options.namespaces ?? new NamespacePolicyStore();
    this.namespaces = namespaces;
    this.semanticGraph = options.semanticGraph ?? new SemanticKnowledgeGraph();
    this.semanticVectorStore = options.semanticVectorStore ?? null;
    this.retrieval = new KnowledgeRetrievalService(
      index,
      this.archive,
      namespaces,
      this.semanticGraph,
      this.semanticVectorStore,
      options.knowledgeAuditLogger ?? new KnowledgeAuditLogger(),
    );
    this.pipeline = new KnowledgeIngestionPipeline(index, this.archive, namespaces);
    this.domainRegistry = options.domainRegistry ?? null;
    this.pluginRegistry = options.pluginRegistry ?? null;
    this.snapshotStore = options.snapshotStore ?? null;
    this.eventPublisher = options.eventPublisher ?? null;
    this.restoreSnapshot(index);
  }

  public async initialize(): Promise<void> {
    if (!this.semanticVectorStore) {
      return;
    }
    if (!this.semanticSyncScheduled) {
      this.scheduleSemanticUpsertRecords([]);
    }
    await this.awaitSemanticSync();
  }

  public registerNamespace(...args: Parameters<KnowledgeIngestionPipeline["registerNamespace"]>) {
    const namespace = this.pipeline.registerNamespace(...args);
    this.persistSnapshot();
    return namespace;
  }

  public query(keyword: string, options: KnowledgeQueryOptions = {}): RetrievalHit[] {
    const startedAt = Date.now();
    try {
      const hits = this.retrieval.query(keyword, options);
      runtimeMetricsRegistry.recordKnowledgeQuery("sync", Date.now() - startedAt, "ok");
      return hits;
    } catch (error) {
      runtimeMetricsRegistry.recordKnowledgeQuery("sync", Date.now() - startedAt, "error");
      throw error;
    }
  }

  public async queryAsync(keyword: string, options: KnowledgeQueryOptions = {}): Promise<RetrievalHit[]> {
    const startedAt = Date.now();
    try {
      return await startActiveSpan("knowledge.query_async", {
        tracerName: "automatic-agent-platform.knowledge",
        attributes: {
          "aa.knowledge.namespace": options.namespace ?? "all",
        },
      }, async () => {
        await this.awaitSemanticSync();
        const hits = await this.retrieval.queryAsync(keyword, options);
        runtimeMetricsRegistry.recordKnowledgeQuery("async", Date.now() - startedAt, "ok");
        return hits;
      });
    } catch (error) {
      runtimeMetricsRegistry.recordKnowledgeQuery("async", Date.now() - startedAt, "error");
      throw error;
    }
  }

  public listNamespaces() {
    return this.namespaces.list();
  }

  public inspectNamespace(namespace: string) {
    const policy = this.namespaces.get(namespace);
    const records = this.archive.list(namespace);
    return {
      namespace,
      status: policy == null ? "not_found" : "enabled",
      policy,
      documentCount: records.length,
      chunkCount: records.reduce((total, record) => total + record.chunks.length, 0),
      documents: records.map((record) => ({
        documentId: record.document.documentId,
        title: record.document.title,
        version: record.document.version,
        status: record.document.status,
        sourceId: record.source.sourceId,
        trustLevel: record.source.trustLevel,
        chunkCount: record.chunks.length,
      })),
    };
  }

  public inspectGraph(input: {
    namespace?: string;
    knowledgeRef?: string;
    keyword?: string;
    limit?: number;
  } = {}) {
    return this.semanticGraph.inspect(input);
  }

  public async queryForDomain(
    keyword: string,
    options: KnowledgeQueryOptions & {
      domainId: string;
      includePluginRetrieval?: boolean;
      tokenBudget?: number;
    },
  ): Promise<RetrievalHit[]> {
    const startedAt = Date.now();
    try {
      return await startActiveSpan("knowledge.query_for_domain", {
        tracerName: "automatic-agent-platform.knowledge",
        attributes: {
          "aa.domain.id": options.domainId,
          "aa.knowledge.namespace": options.namespace ?? "all",
        },
      }, async () => {
        await this.awaitSemanticSync();
        const localHits = await this.retrieval.queryAsync(keyword, options);
        if (options.includePluginRetrieval === false || !this.domainRegistry || !this.pluginRegistry) {
          runtimeMetricsRegistry.recordKnowledgeQuery("domain", Date.now() - startedAt, "ok");
          return localHits;
        }

        const bindings = this.domainRegistry.getPluginBindings(options.domainId, "retriever");
        if (bindings.length === 0) {
          runtimeMetricsRegistry.recordKnowledgeQuery("domain", Date.now() - startedAt, "ok");
          return localHits;
        }

        const pluginHits: RetrievalHit[] = [];
        for (const binding of bindings) {
          let results: readonly RetrieverKnowledgeResult[] = [];
          try {
            results = await this.pluginRegistry.invokeRetriever(binding.pluginId, {
              domainId: options.domainId,
              bindingId: binding.bindingId,
              config: binding.config,
              namespace: options.namespace ?? null,
              query: {
                taskId: `knowledge_query:${options.domainId}`,
                intent: keyword,
                context: {
                  keyword,
                  namespace: options.namespace ?? null,
                  localHitCount: localHits.length,
                },
                tokenBudget: options.tokenBudget ?? 1024,
              },
            });
          } catch {
            continue;
          }
          for (const result of results) {
            pluginHits.push(...toKnowledgeHit(result, this.archive));
          }
        }

        const authorizedPluginHits = this.retrieval.filterAuthorizedHits(pluginHits, options);
        const merged = mergeHits(localHits, authorizedPluginHits, options.limit ?? 10);
        runtimeMetricsRegistry.recordKnowledgeQuery("domain", Date.now() - startedAt, "ok");
        return merged;
      });
    } catch (error) {
      runtimeMetricsRegistry.recordKnowledgeQuery("domain", Date.now() - startedAt, "error");
      throw error;
    }
  }

  private restoreSnapshot(index: KeywordKnowledgeIndex): void {
    const snapshot = this.snapshotStore?.load();
    if (!snapshot) {
      return;
    }
    index.reset();
    for (const namespace of snapshot.namespaces) {
      this.namespaces.register(namespace);
    }
    this.archive.replace(snapshot.records);
    this.semanticGraph.replace(snapshot.records);
    for (const record of snapshot.records) {
      for (const chunk of record.chunks) {
        index.upsert(chunk);
      }
    }
    this.scheduleSemanticUpsertRecords(snapshot.records);
  }

  private persistSnapshot(): void {
    this.snapshotStore?.save({
      namespaces: this.namespaces.list(),
      records: this.archive.exportRecords(),
    });
  }

  public ingest(...args: Parameters<KnowledgeIngestionPipeline["ingest"]>): KnowledgeIngestionResult {
    const result = this.pipeline.ingest(...args);
    this.semanticGraph.upsertRecord({
      source: result.source,
      document: result.document,
      chunks: result.chunks,
    });
    for (const chunk of result.chunks) {
      this.eventPublisher?.publish({
        eventType: "knowledge:chunk_indexed",
        payload: {
          namespace: result.document.namespace,
          documentId: result.document.documentId,
          chunkId: chunk.chunkId,
          trustLevel: result.source.trustLevel,
          keywordCount: chunk.keywords.length,
          relationCount: this.semanticGraph.inspect({ knowledgeRef: `knowledge:${chunk.chunkId}`, limit: 16 }).edges.length,
          occurredAt: nowIso(),
        },
      });
    }
    this.scheduleSemanticUpsert(result);
    this.persistSnapshot();
    return result;
  }

  public async ingestAsync(...args: Parameters<KnowledgeIngestionPipeline["ingest"]>): Promise<KnowledgeIngestionResult> {
    const result = this.ingest(...args);
    await this.awaitSemanticSync();
    return result;
  }

  public inspectSemanticInfrastructure() {
    return this.semanticVectorStore?.inspect() ?? {
      backend: "local_hash",
      ready: true,
      details: {
        managedBy: "archive_scan",
      },
    };
  }

  private scheduleSemanticUpsert(result: KnowledgeIngestionResult): void {
    this.scheduleSemanticUpsertRecords([{
      source: result.source,
      document: result.document,
      chunks: result.chunks,
    }]);
  }

  private scheduleSemanticUpsertRecords(records: readonly ArchivedKnowledgeRecord[]): void {
    if (!this.semanticVectorStore) {
      return;
    }
    this.semanticSyncScheduled = true;
    this.pendingSemanticSync = this.pendingSemanticSync
      .then(async () => {
        await this.semanticVectorStore?.upsertChunks(records.flatMap((record) => (
          record.chunks
            .filter((chunk) => Array.isArray(chunk.embedding) && chunk.embedding.length > 0)
            .map((chunk) => ({
              knowledgeRef: `knowledge:${chunk.chunkId}`,
              chunkId: chunk.chunkId,
              documentId: record.document.documentId,
              namespace: chunk.namespace,
              embeddingId: chunk.embeddingId,
              embedding: chunk.embedding,
              updatedAt: record.source.ingestedAt,
            }))
        )));
      });
  }

  private async awaitSemanticSync(): Promise<void> {
    await this.pendingSemanticSync;
  }
}
