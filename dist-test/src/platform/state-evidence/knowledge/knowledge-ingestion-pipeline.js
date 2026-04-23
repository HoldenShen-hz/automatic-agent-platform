import { createHash } from "node:crypto";
import { newId, nowIso } from "../../contracts/types/ids.js";
import { KnowledgeArchive } from "./archive/knowledge-archive.js";
import { NamespacePolicyStore } from "./governance/namespace-policy.js";
import { AstStructuralIndex } from "./indexing/ast-index.js";
import { KeywordKnowledgeIndex } from "./keyword-index.js";
import { KnowledgeRetrievalService } from "./retrieval/knowledge-retrieval.js";
import { buildSemanticEmbedding, semanticEmbeddingId } from "./semantic-embedding.js";
function sha256(value) {
    return createHash("sha256").update(value, "utf8").digest("hex");
}
function extractKeywords(body) {
    return Array.from(new Set(body
        .toLowerCase()
        .split(/[^a-z0-9_]+/i)
        .filter((token) => token.length >= 4))).slice(0, 12);
}
function estimateTokenCount(content) {
    return Math.max(1, Math.ceil(content.length / 4));
}
function summarize(content) {
    return content.length <= 120 ? content : `${content.slice(0, 117)}...`;
}
function resolveChunkType(content, index) {
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
function chunkFixed(body) {
    return body
        .split(/\n{2,}/)
        .map((content) => content.trim())
        .filter((content) => content.length > 0);
}
function chunkSectionAware(body) {
    const lines = body.split("\n");
    const sections = [];
    let currentHeading;
    let currentLines = [];
    const flush = () => {
        const content = currentLines.join("\n").trim();
        if (content.length === 0) {
            return;
        }
        const sectionObj = { content };
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
export class KnowledgeIngestionPipeline {
    index;
    astIndex;
    archive;
    namespaces;
    retrieval;
    constructor(index = new KeywordKnowledgeIndex(), archive = new KnowledgeArchive(), namespaces = new NamespacePolicyStore(), astIndex = new AstStructuralIndex()) {
        this.index = index;
        this.astIndex = astIndex;
        this.archive = archive;
        this.namespaces = namespaces;
        this.retrieval = new KnowledgeRetrievalService(this.index, this.archive, this.namespaces);
    }
    registerNamespace(namespace) {
        return this.namespaces.register(namespace);
    }
    ingest(input) {
        const contentHash = sha256(input.body);
        const timestamp = nowIso();
        const source = {
            sourceId: newId("knowledge_source"),
            type: input.sourceType ?? "text",
            uri: input.uri ?? `memory://${input.namespace}/${newId("doc")}`,
            contentHash,
            metadata: {},
            ingestedAt: timestamp,
            namespace: input.namespace,
            language: input.language ?? null,
            tags: [...(input.tags ?? [])],
            trustLevel: input.trustLevel ?? "community",
            freshnessTimestamp: timestamp,
            checksum: contentHash,
            chunking: input.chunking,
        };
        const document = {
            documentId: newId("knowledge_document"),
            sourceId: source.sourceId,
            title: input.title,
            version: 1,
            tags: [...(input.tags ?? [])],
            domainScope: [input.namespace.split("/")[0] ?? "shared"],
            status: "indexed",
            namespace: input.namespace,
            mimeType: "text/plain",
            rawText: input.body,
            structuredText: null,
            archived: false,
            archivedAt: null,
        };
        const chunkDefinitions = this.createChunks(input.body, input.chunking);
        const chunks = chunkDefinitions
            .map(({ content, section }, index) => ({
            chunkId: newId("knowledge_chunk"),
            documentId: document.documentId,
            content,
            chunkType: resolveChunkType(content, index),
            metadata: {
                language: input.language ?? undefined,
                relevantFiles: [],
            },
            embedding: buildSemanticEmbedding(`${input.title}\n${content}`, extractKeywords(content)),
            tokenCount: estimateTokenCount(content),
            namespace: input.namespace,
            ordinal: index,
            summary: summarize(content),
            keywords: extractKeywords(content),
            embeddingId: semanticEmbeddingId(`${input.title}\n${content}`, extractKeywords(content)),
            locator: section ? { section } : {},
        }));
        const archived = this.archive.upsert({ source, document, chunks });
        for (const chunk of archived.chunks) {
            this.index.upsert(chunk);
        }
        this.astIndex.upsertDocument({
            documentId: document.documentId,
            sourceUri: source.uri,
            namespace: input.namespace,
            content: input.body,
            language: input.language ?? null,
        });
        return archived;
    }
    query(keyword, options) {
        return this.retrieval.query(keyword, options);
    }
    createChunks(body, chunking) {
        if (!chunking || chunking.mode === "fixed" || chunking.mode === "semantic") {
            return chunkFixed(body).map((content) => ({ content }));
        }
        return chunkSectionAware(body);
    }
}
//# sourceMappingURL=knowledge-ingestion-pipeline.js.map