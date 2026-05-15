import { createHash } from "node:crypto";

import { newId, nowIso } from "../../contracts/types/ids.js";
import { KnowledgeArchive } from "./archive/knowledge-archive.js";
import { NamespacePolicyStore } from "./governance/namespace-policy.js";
import { AstStructuralIndex } from "./indexing/ast-index.js";
import {
  compareTrustLevels,
  normalizeTrustLevel,
  type ChunkingConfig,
  type KnowledgeChunk,
  type KnowledgeDocument,
  type KnowledgeNamespace,
  type KnowledgeSource,
  type TrustLevel,
} from "./knowledge-model.js";
import { KeywordKnowledgeIndex } from "./keyword-index.js";
import { KnowledgeRetrievalService } from "./retrieval/knowledge-retrieval.js";
import { buildSemanticEmbedding, semanticEmbeddingId } from "./semantic-embedding.js";

export interface KnowledgeIngestionResult {
  source: KnowledgeSource;
  document: KnowledgeDocument;
  chunks: KnowledgeChunk[];
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function extractKeywords(body: string): string[] {
  return Array.from(
    new Set(
      body
        .toLowerCase()
        .split(/[^a-z0-9_]+/i)
        .filter((token) => token.length >= 4),
    ),
  ).slice(0, 12);
}

function mergeKeywords(content: string, tags: readonly string[] = []): string[] {
  return Array.from(
    new Set([
      ...extractKeywords(content),
      ...tags
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length >= 2),
    ]),
  ).slice(0, 12);
}

function estimateTokenCount(content: string): number {
  return Math.max(1, Math.ceil(content.length / 4));
}

function summarize(content: string): string {
  return content.length <= 120 ? content : `${content.slice(0, 117)}...`;
}

function resolveChunkType(content: string, index: number): KnowledgeChunk["chunkType"] {
  const normalized = content.trim();
  if (/^(#+\s+|export\s+(class|function|interface|type)\s+)/m.test(normalized)) {
    return "api_signature";
  }
  if (/\b(must|should|required|never|always)\b/i.test(normalized)) {
    return "constraint";
  }
  if (index === 0) {
    return "concept";
  }
  return "rule";
}

function chunkFixed(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map((content) => content.trim())
    .filter((content) => content.length > 0);
}

function chunkSectionAware(body: string): Array<{ content: string; section?: string }> {
  const lines = body.split("\n");
  const sections: Array<{ content: string; section?: string }> = [];
  let currentHeading: string | undefined;
  let currentLines: string[] = [];

  const flush = (): void => {
    const content = currentLines.join("\n").trim();
    if (content.length === 0) {
      return;
    }
    const sectionObj: { content: string; section?: string } = { content };
    if (currentHeading !== undefined) {
      sectionObj.section = currentHeading;
    }
    sections.push(sectionObj);
    currentLines = [];
  };

  for (const line of lines) {
    if (/^#{1,6}\s+/.test(line.trim())) {
      flush();
      currentHeading = line.trim().replace(/^#{1,6}\s+/, "");
      currentLines.push(line);
      continue;
    }
    if (/^```/.test(line.trim()) && currentLines.length > 0) {
      flush();
      currentLines.push(line);
      continue;
    }
    currentLines.push(line);
  }
  flush();

  if (sections.length > 0) {
    return sections;
  }
  return chunkFixed(body).map((content) => ({ content }));
}

function shouldPromoteKnowledge(trustLevel: TrustLevel): boolean {
  return compareTrustLevels(trustLevel, "team_reviewed") >= 0;
}

export class KnowledgeIngestionPipeline {
  private readonly archive: KnowledgeArchive;
  private readonly namespaces: NamespacePolicyStore;
  private readonly retrieval: KnowledgeRetrievalService;

  public constructor(
    private readonly index: KeywordKnowledgeIndex = new KeywordKnowledgeIndex(),
    archive: KnowledgeArchive = new KnowledgeArchive(),
    namespaces: NamespacePolicyStore = new NamespacePolicyStore(),
    private readonly astIndex: AstStructuralIndex = new AstStructuralIndex(),
  ) {
    this.archive = archive;
    this.namespaces = namespaces;
    this.retrieval = new KnowledgeRetrievalService(this.index, this.archive, this.namespaces);
  }

  public registerNamespace(namespace: KnowledgeNamespace): KnowledgeNamespace {
    return this.namespaces.register(namespace);
  }

  public ingest(input: {
    title: string;
    body: string;
    namespace: string;
    uri?: string;
    sourceType?: KnowledgeSource["type"];
    trustLevel?: TrustLevel;
    tags?: readonly string[];
    language?: string | null;
    chunking?: ChunkingConfig;
  }): KnowledgeIngestionResult {
    const contentHash = sha256(input.body);
    const timestamp = nowIso();
    const normalizedTrustLevel = normalizeTrustLevel(input.trustLevel ?? "team_reviewed");
    const promoted = shouldPromoteKnowledge(normalizedTrustLevel);
    const source: KnowledgeSource = {
      sourceId: newId("knowledge_source"),
      type: input.sourceType ?? "text",
      uri: input.uri ?? `memory://${input.namespace}/${newId("doc")}`,
      contentHash,
      metadata: promoted
        ? {
            ingestionLifecycle: "promoted",
            quarantinedAt: timestamp,
            promotedAt: timestamp,
          }
        : {
            ingestionLifecycle: "quarantined",
            quarantinedAt: timestamp,
          },
      ingestedAt: timestamp,
      namespace: input.namespace,
      language: input.language ?? null,
      tags: [...(input.tags ?? [])],
      trustLevel: input.trustLevel ?? normalizedTrustLevel,
      freshnessTimestamp: timestamp,
      checksum: contentHash,
      chunking: input.chunking,
    };
    const document: KnowledgeDocument = {
      documentId: newId("knowledge_document"),
      sourceId: source.sourceId,
      title: input.title,
      version: 1,
      tags: [...(input.tags ?? [])],
      domainScope: [input.namespace.split("/")[0] ?? "shared"],
      status: promoted ? "indexed" : "draft",
      namespace: input.namespace,
      mimeType: "text/plain",
      rawText: input.body,
      structuredText: null,
      archived: false,
      archivedAt: null,
    };
    const chunkDefinitions = this.createChunks(input.body, input.chunking);
    const chunks: KnowledgeChunk[] = chunkDefinitions
      .map(({ content, section }, index) => {
        const keywords = mergeKeywords(content, input.tags ?? []);
        const embeddingInput = `${input.title}\n${content}\n${(input.tags ?? []).join(" ")}`;
        return {
        chunkId: newId("knowledge_chunk"),
        documentId: document.documentId,
        content,
        chunkType: resolveChunkType(content, index),
        metadata: {
          language: input.language ?? undefined,
          relevantFiles: [],
        },
        embedding: buildSemanticEmbedding(embeddingInput, keywords),
        tokenCount: estimateTokenCount(content),
        namespace: input.namespace,
        ordinal: index,
        summary: summarize(content),
        keywords,
        embeddingId: semanticEmbeddingId(embeddingInput, keywords),
        locator: section ? { section } : {},
      };
      });
    const archived = this.archive.upsert({ source, document, chunks });
    if (archived.document.status === "indexed") {
      for (const chunk of archived.chunks) {
        this.index.upsert(chunk);
      }
      this.astIndex.upsertDocument({
        documentId: archived.document.documentId,
        sourceUri: archived.source.uri,
        namespace: input.namespace,
        content: input.body,
        language: input.language ?? null,
      });
    }
    return archived;
  }

  public query(keyword: string, options?: Parameters<KnowledgeRetrievalService["query"]>[1]) {
    return this.retrieval.query(keyword, options);
  }

  private createChunks(body: string, chunking?: ChunkingConfig): Array<{ content: string; section?: string }> {
    if (!chunking || chunking.mode === "fixed" || chunking.mode === "semantic") {
      return chunkFixed(body).map((content) => ({ content }));
    }
    return chunkSectionAware(body);
  }
}
