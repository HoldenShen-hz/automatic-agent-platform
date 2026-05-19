// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import { PerceptionServiceAsync } from "../../../../src/scale-ecosystem/intelligence/perception-service-async.js";
function createMockStore() {
    const sources = new Map();
    const intelItems = new Map();
    const briefs = new Map();
    const proposals = [];
    const artifacts = [];
    return {
        intelligence: {
            upsertPerceptionSource: (source) => sources.set(source.sourceId, source),
            getPerceptionSource: (sourceId) => sources.get(sourceId) || null,
            insertIntelItem: (item) => intelItems.set(item.intelId, item),
            getIntelItemBySourceAndDedupeKey: (sourceId, dedupeKey) => {
                for (const item of intelItems.values()) {
                    if (item.sourceId === sourceId && item.dedupeKey === dedupeKey) {
                        return item;
                    }
                }
                return null;
            },
            listIntelItems: ({ sourceIds }) => {
                let items = Array.from(intelItems.values());
                if (sourceIds && sourceIds.length > 0) {
                    items = items.filter(i => sourceIds.includes(i.sourceId));
                }
                return items;
            },
            listIntelItemsByIds: (ids) => {
                return ids.map(id => intelItems.get(id)).filter(Boolean);
            },
            insertIntelBrief: (brief) => briefs.set(brief.briefId, brief),
            getIntelBrief: (briefId) => briefs.get(briefId) || null,
            listIntelBriefs: () => Array.from(briefs.values()),
            listPerceptionSources: (enabledOnly, tenantId) => {
                let result = Array.from(sources.values());
                if (enabledOnly)
                    result = result.filter(s => s.enabled === 1);
                return result;
            },
            listActionProposalsByBrief: () => proposals,
            insertActionProposal: (proposal) => proposals.push(proposal),
        },
        task: {
            getTask: () => null,
            insertTask: (task) => { },
        },
        artifact: {
            insertArtifact: (record) => artifacts.push(record),
        },
        listIntelItems: ({ tenantId, since, until, limit }) => {
            let items = Array.from(intelItems.values());
            if (since)
                items = items.filter(i => i.capturedAt >= since);
            if (until)
                items = items.filter(i => i.capturedAt <= until);
            return items.slice(0, limit || 25);
        },
    };
}
function createMockDb() {
    return {
        transaction: (fn) => fn(),
        filePath: "/tmp/test.db",
    };
}
test("PerceptionServiceAsync registerSource returns Promise", async () => {
    const store = createMockStore();
    const db = createMockDb();
    const service = new PerceptionServiceAsync(db, store);
    const result = service.registerSource({
        type: "api",
        name: "Test Source",
    });
    assert.ok(result instanceof Promise);
    const source = await result;
    assert.equal(source.name, "Test Source");
    assert.equal(source.type, "api");
    assert.ok(source.sourceId);
});
test("PerceptionServiceAsync registerSource with custom id", async () => {
    const store = createMockStore();
    const db = createMockDb();
    const service = new PerceptionServiceAsync(db, store);
    const source = await service.registerSource({
        sourceId: "custom_source_async",
        type: "feed",
        name: "Custom Source",
    });
    assert.equal(source.sourceId, "custom_source_async");
});
test("PerceptionServiceAsync registerSource with priority", async () => {
    const store = createMockStore();
    const db = createMockDb();
    const service = new PerceptionServiceAsync(db, store);
    const source = await service.registerSource({
        type: "api",
        name: "Priority Source",
        priority: 10,
    });
    assert.equal(source.priority, 10);
});
test("PerceptionServiceAsync registerSource disabled source", async () => {
    const store = createMockStore();
    const db = createMockDb();
    const service = new PerceptionServiceAsync(db, store);
    const source = await service.registerSource({
        type: "api",
        name: "Disabled Source",
        enabled: false,
    });
    assert.equal(source.enabled, 0);
});
test("PerceptionServiceAsync ingestIntel returns Promise", async () => {
    const store = createMockStore();
    const db = createMockDb();
    const service = new PerceptionServiceAsync(db, store);
    const source = await service.registerSource({
        sourceId: "src_async_1",
        type: "api",
        name: "Test Source",
    });
    const result = service.ingestIntel({
        sourceId: source.sourceId,
        items: [
            {
                title: "Important Update",
                summary: "There is a critical update available",
                rawRef: "https://example.com/update",
                relevanceScore: 0.8,
                importance: 0.9,
            },
        ],
    });
    assert.ok(result instanceof Promise);
    const intelResult = await result;
    assert.equal(intelResult.insertedItems.length, 1);
    assert.equal(intelResult.skippedDuplicateCount, 0);
});
test("PerceptionServiceAsync ingestIntel skips duplicates", async () => {
    const store = createMockStore();
    const db = createMockDb();
    const service = new PerceptionServiceAsync(db, store);
    const source = await service.registerSource({
        sourceId: "src_async_2",
        type: "api",
        name: "Test Source 2",
    });
    await service.ingestIntel({
        sourceId: source.sourceId,
        items: [
            {
                title: "Duplicate Title",
                summary: "This is a duplicate",
                rawRef: "https://example.com/duplicate",
                relevanceScore: 0.5,
                importance: 0.5,
                dedupeKey: "dup_key_1",
            },
        ],
    });
    const result = await service.ingestIntel({
        sourceId: source.sourceId,
        items: [
            {
                title: "Duplicate Title",
                summary: "This is a duplicate",
                rawRef: "https://example.com/duplicate",
                relevanceScore: 0.5,
                importance: 0.5,
                dedupeKey: "dup_key_1",
            },
        ],
    });
    assert.equal(result.insertedItems.length, 0);
    assert.equal(result.skippedDuplicateCount, 1);
});
test("PerceptionServiceAsync ingestIntelAsync is alias for ingestIntel", async () => {
    const store = createMockStore();
    const db = createMockDb();
    const service = new PerceptionServiceAsync(db, store);
    const source = await service.registerSource({
        sourceId: "src_async_3",
        type: "api",
        name: "Test Source 3",
    });
    const result = await service.ingestIntelAsync({
        sourceId: source.sourceId,
        items: [
            {
                title: "Async Test Item",
                summary: "Testing async ingest",
                rawRef: "https://example.com/async",
                relevanceScore: 0.6,
                importance: 0.7,
            },
        ],
    });
    assert.equal(result.insertedItems.length, 1);
    assert.equal(result.insertedItems[0].title, "Async Test Item");
});
test("PerceptionServiceAsync proposeActions returns Promise", async () => {
    const store = createMockStore();
    const db = createMockDb();
    const service = new PerceptionServiceAsync(db, store);
    const source = await service.registerSource({
        sourceId: "src_async_4",
        type: "api",
        name: "Test Source 4",
    });
    await service.ingestIntel({
        sourceId: source.sourceId,
        items: [
            {
                title: "Action Item",
                summary: "This should trigger an action",
                rawRef: "https://example.com/action",
                relevanceScore: 0.9,
                importance: 0.85,
            },
        ],
    });
    const briefResult = service.buildBrief({});
    assert.ok(briefResult instanceof Promise);
    const brief = await briefResult;
    const proposalsResult = service.proposeActions({ briefId: brief.brief.briefId });
    assert.ok(proposalsResult instanceof Promise);
    const proposals = await proposalsResult;
    assert.ok(proposals.length > 0);
});
test("PerceptionServiceAsync proposeActions idempotent", async () => {
    const store = createMockStore();
    const db = createMockDb();
    const service = new PerceptionServiceAsync(db, store);
    const source = await service.registerSource({
        sourceId: "src_async_5",
        type: "api",
        name: "Test Source 5",
    });
    await service.ingestIntel({
        sourceId: source.sourceId,
        items: [
            {
                title: "Idempotent Test",
                summary: "Testing idempotency",
                rawRef: "https://example.com/idempotent",
                relevanceScore: 0.7,
                importance: 0.7,
            },
        ],
    });
    const brief = await service.buildBrief({});
    const proposals1 = await service.proposeActions({ briefId: brief.brief.briefId });
    const proposals2 = await service.proposeActions({ briefId: brief.brief.briefId });
    assert.equal(proposals1.length, proposals2.length);
});
test("PerceptionServiceAsync buildBrief returns Promise", async () => {
    const store = createMockStore();
    const db = createMockDb();
    const service = new PerceptionServiceAsync(db, store);
    await service.registerSource({
        sourceId: "src_async_6",
        type: "api",
        name: "Test Source 6",
    });
    const result = service.buildBrief({});
    assert.ok(result instanceof Promise);
    const briefResult = await result;
    assert.ok(briefResult.brief);
    assert.ok(Array.isArray(briefResult.items));
});
test("PerceptionServiceAsync normalizes tags on ingest", async () => {
    const store = createMockStore();
    const db = createMockDb();
    const service = new PerceptionServiceAsync(db, store);
    const source = await service.registerSource({
        sourceId: "src_async_7",
        type: "api",
        name: "Test Source 7",
    });
    const result = await service.ingestIntel({
        sourceId: source.sourceId,
        items: [
            {
                title: "Tagged Item",
                summary: "Item with tags for normalization",
                rawRef: "https://example.com/tagged",
                relevanceScore: 0.5,
                importance: 0.5,
                tags: ["IMPORTANT", "update", "SECURITY"],
            },
        ],
    });
    const tags = JSON.parse(result.insertedItems[0].tagsJson);
    assert.ok(tags.includes("important"));
    assert.ok(tags.includes("update"));
    assert.ok(tags.includes("security"));
});
test("PerceptionServiceAsync multiple items in single ingest", async () => {
    const store = createMockStore();
    const db = createMockDb();
    const service = new PerceptionServiceAsync(db, store);
    const source = await service.registerSource({
        sourceId: "src_async_8",
        type: "api",
        name: "Test Source 8",
    });
    const result = await service.ingestIntel({
        sourceId: source.sourceId,
        items: [
            {
                title: "Item One",
                summary: "First item summary",
                rawRef: "https://example.com/one",
                relevanceScore: 0.6,
                importance: 0.6,
            },
            {
                title: "Item Two",
                summary: "Second item summary",
                rawRef: "https://example.com/two",
                relevanceScore: 0.7,
                importance: 0.8,
            },
            {
                title: "Item Three",
                summary: "Third item summary",
                rawRef: "https://example.com/three",
                relevanceScore: 0.5,
                importance: 0.4,
            },
        ],
    });
    assert.equal(result.insertedItems.length, 3);
});
//# sourceMappingURL=perception-service-async.test.js.map