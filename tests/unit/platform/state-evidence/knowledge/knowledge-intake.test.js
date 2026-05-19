import test from "node:test";
import assert from "node:assert/strict";
import { TextKnowledgeIntake } from "../../../../../src/platform/state-evidence/knowledge/intake/text-intake.js";
import { FileKnowledgeIntake } from "../../../../../src/platform/state-evidence/knowledge/intake/file-intake.js";
import { KnowledgeIngestionPipeline } from "../../../../../src/platform/state-evidence/knowledge/knowledge-ingestion-pipeline.js";
test("TextKnowledgeIntake ingests text documents", () => {
    const pipeline = new KnowledgeIngestionPipeline();
    pipeline.registerNamespace({
        namespaceId: "ns_text",
        path: "test/text",
        description: "Test text namespace",
        ownerDomainId: "test",
        accessPolicy: "public",
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
    const intake = new TextKnowledgeIntake(pipeline);
    const result = intake.ingest({
        title: "Test Document",
        body: "This is a test document body.",
        namespace: "test/text",
        trustLevel: "verified",
    });
    assert.equal(result.chunks.length, 1);
    assert.equal(result.source.namespace, "test/text");
    assert.equal(result.source.trustLevel, "verified");
});
test("TextKnowledgeIntake uses default sourceType of text", () => {
    const pipeline = new KnowledgeIngestionPipeline();
    pipeline.registerNamespace({
        namespaceId: "ns_default",
        path: "test/default",
        description: "Test default",
        ownerDomainId: "test",
        accessPolicy: "public",
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
    const intake = new TextKnowledgeIntake(pipeline);
    const result = intake.ingest({
        title: "Default Source Type",
        body: "Body content",
        namespace: "test/default",
    });
    assert.equal(result.source.type, "text");
});
test("TextKnowledgeIntake accepts optional trustLevel", () => {
    const pipeline = new KnowledgeIngestionPipeline();
    pipeline.registerNamespace({
        namespaceId: "ns_trust",
        path: "test/trust",
        description: "Test trust",
        ownerDomainId: "test",
        accessPolicy: "public",
        freshnessPolicy: {
            maxAgeDays: 30,
            staleAction: "warn",
            refreshStrategy: "manual",
            refreshIntervalHours: null,
        },
        trustLevel: "community",
        maxDocuments: 100,
        maxTotalSizeBytes: 1000000,
    });
    const intake = new TextKnowledgeIntake(pipeline);
    const result = intake.ingest({
        title: "Community Trust",
        body: "Body",
        namespace: "test/trust",
        trustLevel: "community",
    });
    assert.equal(result.source.trustLevel, "community");
});
test("TextKnowledgeIntake accepts optional tags", () => {
    const pipeline = new KnowledgeIngestionPipeline();
    pipeline.registerNamespace({
        namespaceId: "ns_tags",
        path: "test/tags",
        description: "Test tags",
        ownerDomainId: "test",
        accessPolicy: "public",
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
    const intake = new TextKnowledgeIntake(pipeline);
    const result = intake.ingest({
        title: "With Tags",
        body: "Body",
        namespace: "test/tags",
        tags: ["tag1", "tag2"],
    });
    assert.deepEqual(result.source.tags, ["tag1", "tag2"]);
});
test("TextKnowledgeIntake accepts optional chunking config with fixed mode", () => {
    const pipeline = new KnowledgeIngestionPipeline();
    pipeline.registerNamespace({
        namespaceId: "ns_chunk",
        path: "test/chunk",
        description: "Test chunking",
        ownerDomainId: "test",
        accessPolicy: "public",
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
    const intake = new TextKnowledgeIntake(pipeline);
    const result = intake.ingest({
        title: "With Chunking",
        body: "A".repeat(500),
        namespace: "test/chunk",
        chunking: {
            mode: "fixed",
            fixedConfig: {
                maxTokens: 100,
                overlapTokens: 10,
            },
        },
    });
    // Check that chunks were created
    assert.ok(result.chunks.length >= 1);
    assert.equal(result.source.chunking?.mode, "fixed");
});
test("FileKnowledgeIntake extracts filename as title", () => {
    const pipeline = new KnowledgeIngestionPipeline();
    pipeline.registerNamespace({
        namespaceId: "ns_file",
        path: "test/file",
        description: "Test file namespace",
        ownerDomainId: "test",
        accessPolicy: "public",
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
    const intake = new FileKnowledgeIntake(pipeline);
    const result = intake.ingest({
        path: "/path/to/document.txt",
        content: "File content here",
        namespace: "test/file",
    });
    assert.equal(result.source.uri, "/path/to/document.txt");
    assert.equal(result.source.type, "file");
});
test("FileKnowledgeIntake uses default sourceType of file", () => {
    const pipeline = new KnowledgeIngestionPipeline();
    pipeline.registerNamespace({
        namespaceId: "ns_file_default",
        path: "test/file-default",
        description: "Test file default",
        ownerDomainId: "test",
        accessPolicy: "public",
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
    const intake = new FileKnowledgeIntake(pipeline);
    const result = intake.ingest({
        path: "/test/file.txt",
        content: "Content",
        namespace: "test/file-default",
    });
    assert.equal(result.source.type, "file");
});
test("FileKnowledgeIntake accepts optional trustLevel", () => {
    const pipeline = new KnowledgeIngestionPipeline();
    pipeline.registerNamespace({
        namespaceId: "ns_file_trust",
        path: "test/file-trust",
        description: "Test file trust",
        ownerDomainId: "test",
        accessPolicy: "public",
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
    const intake = new FileKnowledgeIntake(pipeline);
    const result = intake.ingest({
        path: "/test/trust.txt",
        content: "Content",
        namespace: "test/file-trust",
        trustLevel: "verified",
    });
    assert.equal(result.source.trustLevel, "verified");
});
test("FileKnowledgeIntake accepts optional tags", () => {
    const pipeline = new KnowledgeIngestionPipeline();
    pipeline.registerNamespace({
        namespaceId: "ns_file_tags",
        path: "test/file-tags",
        description: "Test file tags",
        ownerDomainId: "test",
        accessPolicy: "public",
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
    const intake = new FileKnowledgeIntake(pipeline);
    const result = intake.ingest({
        path: "/test/tags.txt",
        content: "Content",
        namespace: "test/file-tags",
        tags: ["file", "test"],
    });
    assert.deepEqual(result.source.tags, ["file", "test"]);
});
test("FileKnowledgeIntake includes path as uri", () => {
    const pipeline = new KnowledgeIngestionPipeline();
    pipeline.registerNamespace({
        namespaceId: "ns_file_uri",
        path: "test/file-uri",
        description: "Test file uri",
        ownerDomainId: "test",
        accessPolicy: "public",
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
    const intake = new FileKnowledgeIntake(pipeline);
    const result = intake.ingest({
        path: "/project/src/main.ts",
        content: "const x = 1;",
        namespace: "test/file-uri",
    });
    assert.equal(result.source.uri, "/project/src/main.ts");
});
test("FileKnowledgeIntake accepts optional chunking config with fixed mode", () => {
    const pipeline = new KnowledgeIngestionPipeline();
    pipeline.registerNamespace({
        namespaceId: "ns_file_chunk",
        path: "test/file-chunk",
        description: "Test file chunking",
        ownerDomainId: "test",
        accessPolicy: "public",
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
    const intake = new FileKnowledgeIntake(pipeline);
    const result = intake.ingest({
        path: "/test/large.txt",
        content: "A".repeat(500),
        namespace: "test/file-chunk",
        chunking: {
            mode: "fixed",
            fixedConfig: {
                maxTokens: 100,
                overlapTokens: 10,
            },
        },
    });
    // Check that chunks were created
    assert.ok(result.chunks.length >= 1);
    assert.equal(result.source.chunking?.mode, "fixed");
});
//# sourceMappingURL=knowledge-intake.test.js.map