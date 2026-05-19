import assert from "node:assert/strict";
import test from "node:test";
import { TrustLevelSchema, KnowledgeNamespaceSchema, KnowledgeDocumentSchema, RetrievalHitSchema, SourceTrustPolicySchema, KeywordKnowledgeIndex, KnowledgeIngestionPipeline, KnowledgePlaneService, SemanticKnowledgeGraph, buildSemanticEmbedding, semanticEmbeddingId, cosineSimilarity, validateSemanticVectorReadiness, KnowledgeArchive, KnowledgeSnapshotStore, KnowledgeRetrievalService, KnowledgeQueryService, AstStructuralIndex, TextKnowledgeIntake, FileKnowledgeIntake, NamespacePolicyStore, SourceTrustPolicyRegistry, CitationBuilder, FreshnessTracker, KnowledgeAccessControl, KnowledgeAuditLogger, } from "../../../../../src/platform/state-evidence/knowledge/index.js";
test("knowledge barrel exports core schemas", () => {
    assert.equal(TrustLevelSchema.safeParse("reviewed").success, true);
    assert.equal(KnowledgeNamespaceSchema.safeParse({
        namespaceId: "ns_1",
        path: "/docs/runtime",
        description: "Runtime docs",
        ownerDomainId: "domain_runtime",
        accessPolicy: "public",
        freshnessPolicy: {
            maxAgeDays: 30,
            staleAction: "warn",
            refreshStrategy: "manual",
            refreshIntervalHours: null,
        },
        trustLevel: "verified",
        maxDocuments: 100,
        maxTotalSizeBytes: 1024,
    }).success, true);
    assert.equal(KnowledgeDocumentSchema.safeParse({
        documentId: "doc_1",
        sourceId: "src_1",
        title: "Design",
        version: 1,
        tags: ["design"],
        domainScope: ["runtime"],
        status: "indexed",
        namespace: "docs/runtime",
        mimeType: "text/markdown",
        rawText: null,
        structuredText: null,
        archived: false,
        archivedAt: null,
    }).success, true);
    assert.equal(RetrievalHitSchema.safeParse({
        chunkId: "chunk_1",
        documentId: "doc_1",
        score: 0.92,
        matchType: "semantic",
        snippet: "Runtime orchestration summary",
        namespace: "docs/runtime",
        knowledgeRef: "knowledge:chunk_1",
    }).success, true);
    assert.equal(SourceTrustPolicySchema.safeParse({
        level: "verified",
        allowedInFinalResponse: true,
        requiresCitation: true,
        maxRetrievalWeight: 1,
        humanReviewRequired: false,
    }).success, true);
});
test("knowledge barrel exports primary classes", () => {
    assert.equal(typeof KeywordKnowledgeIndex, "function");
    assert.equal(typeof KnowledgeIngestionPipeline, "function");
    assert.equal(typeof KnowledgePlaneService, "function");
    assert.equal(typeof SemanticKnowledgeGraph, "function");
    assert.equal(typeof KnowledgeArchive, "function");
    assert.equal(typeof KnowledgeSnapshotStore, "function");
    assert.equal(typeof KnowledgeRetrievalService, "function");
    assert.equal(typeof KnowledgeQueryService, "function");
    assert.equal(typeof AstStructuralIndex, "function");
    assert.equal(typeof TextKnowledgeIntake, "function");
    assert.equal(typeof FileKnowledgeIntake, "function");
    assert.equal(typeof NamespacePolicyStore, "function");
    assert.equal(typeof SourceTrustPolicyRegistry, "function");
    assert.equal(typeof CitationBuilder, "function");
    assert.equal(typeof FreshnessTracker, "function");
    assert.equal(typeof KnowledgeAccessControl, "function");
    assert.equal(typeof KnowledgeAuditLogger, "function");
});
test("knowledge barrel exports semantic helpers", () => {
    const embedding = buildSemanticEmbedding("build retries and cache failures");
    const embeddingId = semanticEmbeddingId("build retries and cache failures");
    assert.ok(Array.isArray(embedding));
    assert.ok(embedding.length > 0);
    assert.ok(typeof embeddingId === "string");
    assert.equal(cosineSimilarity(embedding, embedding), 1);
    assert.equal(typeof validateSemanticVectorReadiness, "function");
});
//# sourceMappingURL=index.test.js.map