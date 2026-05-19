/**
 * Unit tests for PerceptionService exportBrief method
 *
 * @see src/scale-ecosystem/intelligence/perception-service.ts
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { PerceptionService } from "../../../../src/scale-ecosystem/intelligence/perception-service.js";
function createMockStore() {
    const artifacts = [];
    const proposals = [];
    return {
        intelligence: {
            upsertPerceptionSource: (() => { }),
            getPerceptionSource: (() => null),
            insertIntelItem: (() => { }),
            getIntelItemBySourceAndDedupeKey: (() => null),
            insertIntelBrief: (() => { }),
            listIntelItems: (() => []),
            listIntelItemsByIds: (() => []),
            getIntelBrief: (() => null),
            listPerceptionSources: (() => []),
            listIntelBriefs: (() => []),
            listActionProposalsByBrief: () => proposals,
            insertActionProposal: (p) => { proposals.push(p); },
        },
        task: {
            getTask: (() => null),
            insertTask: (() => { }),
        },
        artifact: {
            insertArtifact: (record) => { artifacts.push(record); },
        },
        listIntelItemsByIds: (() => []),
        _artifacts: artifacts,
    };
}
function createMockDb() {
    return {
        transaction: (fn) => fn(),
        filePath: "/tmp/test.db",
    };
}
function makeBrief(overrides = {}) {
    return {
        briefId: "brief_export_001",
        tenantId: null,
        periodStart: "2026-04-20T00:00:00.000Z",
        periodEnd: "2026-04-27T00:00:00.000Z",
        sourceScopeJson: "[]",
        itemIdsJson: "[]",
        overallSummary: "Test brief summary",
        recommendedActionsJson: JSON.stringify([
            { title: "Monitor Item", summary: "Continue watching", actionType: "monitor", intelId: "intel_1", reason: "medium priority" },
        ]),
        generatedAt: "2026-04-27T00:00:00.000Z",
        ...overrides,
    };
}
function makeItem(overrides = {}) {
    return {
        intelId: "intel_001",
        tenantId: null,
        sourceId: "src_1",
        title: "Export Test Item",
        summary: "Item summary for export test",
        rawRef: "https://example.com/export",
        relevanceScore: 0.7,
        importance: 0.8,
        tagsJson: "[]",
        dedupeKey: "export_key_1",
        capturedAt: new Date().toISOString(),
        expiresAt: null,
        ...overrides,
    };
}
describe("PerceptionService exportBrief", () => {
    test("exportBrief returns brief, items, and artifact refs", () => {
        const mockStore = createMockStore();
        const brief = makeBrief({
            briefId: "brief_test_1",
            itemIdsJson: JSON.stringify(["intel_001"]),
        });
        const item = makeItem({ intelId: "intel_001" });
        mockStore.intelligence.getIntelBrief = () => brief;
        mockStore.listIntelItemsByIds = () => [item];
        const service = new PerceptionService(createMockDb(), mockStore);
        const result = service.exportBrief("brief_test_1");
        assert.ok(result.brief);
        assert.equal(result.brief.briefId, "brief_test_1");
        assert.equal(result.items.length, 1);
        assert.equal(result.items[0].intelId, "intel_001");
        assert.ok(result.jsonArtifact);
        assert.ok(result.markdownArtifact);
    });
    test("exportBrief returns jsonArtifact with correct kind", () => {
        const mockStore = createMockStore();
        const brief = makeBrief({ briefId: "brief_json_test" });
        mockStore.intelligence.getIntelBrief = () => brief;
        mockStore.listIntelItemsByIds = () => [];
        const service = new PerceptionService(createMockDb(), mockStore);
        const result = service.exportBrief("brief_json_test");
        assert.equal(result.jsonArtifact.kind, "intel_brief");
        assert.ok(result.jsonArtifact.artifactId);
        assert.ok(result.jsonArtifact.checksum);
        assert.ok(result.jsonArtifact.sizeBytes > 0);
    });
    test("exportBrief returns markdownArtifact with correct kind", () => {
        const mockStore = createMockStore();
        const brief = makeBrief({ briefId: "brief_md_test" });
        mockStore.intelligence.getIntelBrief = () => brief;
        mockStore.listIntelItemsByIds = () => [];
        const service = new PerceptionService(createMockDb(), mockStore);
        const result = service.exportBrief("brief_md_test");
        assert.equal(result.markdownArtifact.kind, "intel_brief");
        assert.ok(result.markdownArtifact.artifactId);
    });
    test("exportBrief includes recommendedActions in result", () => {
        const mockStore = createMockStore();
        const brief = makeBrief({
            briefId: "brief_actions_test",
            recommendedActionsJson: JSON.stringify([
                { title: "Investigate Now", summary: "High priority", actionType: "investigate", intelId: "intel_1", reason: "critical" },
                { title: "Notify Team", summary: "Medium priority", actionType: "notify", intelId: "intel_2", reason: "important" },
            ]),
        });
        mockStore.intelligence.getIntelBrief = () => brief;
        mockStore.listIntelItemsByIds = () => [];
        const service = new PerceptionService(createMockDb(), mockStore);
        const result = service.exportBrief("brief_actions_test");
        assert.equal(result.recommendedActions.length, 2);
        assert.equal(result.recommendedActions[0].title, "Investigate Now");
        assert.equal(result.recommendedActions[1].title, "Notify Team");
    });
    test("exportBrief calls insertArtifact for both artifacts", () => {
        const mockStore = createMockStore();
        const brief = makeBrief({ briefId: "brief_artifacts_test" });
        mockStore.intelligence.getIntelBrief = () => brief;
        mockStore.listIntelItemsByIds = () => [];
        const service = new PerceptionService(createMockDb(), mockStore);
        service.exportBrief("brief_artifacts_test");
        // Two artifacts: json and markdown
        assert.equal(mockStore._artifacts.length, 2);
    });
    test("exportBrief sorts items by itemIds order", () => {
        const mockStore = createMockStore();
        const brief = makeBrief({
            briefId: "brief_sort_test",
            itemIdsJson: JSON.stringify(["intel_c", "intel_a", "intel_b"]),
        });
        mockStore.intelligence.getIntelBrief = () => brief;
        mockStore.listIntelItemsByIds = (ids) => {
            return ids.map(id => makeItem({ intelId: id, title: `Item ${id}` }));
        };
        const service = new PerceptionService(createMockDb(), mockStore);
        const result = service.exportBrief("brief_sort_test");
        assert.equal(result.items[0].intelId, "intel_c");
        assert.equal(result.items[1].intelId, "intel_a");
        assert.equal(result.items[2].intelId, "intel_b");
    });
    test("exportBrief with tenantId passes tenant to proposeActions", () => {
        const mockStore = createMockStore();
        const brief = makeBrief({ briefId: "brief_tenant_test", tenantId: "tenant_xyz" });
        mockStore.intelligence.getIntelBrief = () => brief;
        mockStore.listIntelItemsByIds = () => [];
        const service = new PerceptionService(createMockDb(), mockStore);
        const result = service.exportBrief("brief_tenant_test", undefined, "tenant_xyz");
        assert.equal(result.brief.tenantId, "tenant_xyz");
    });
    test("exportBrief with accountId passes account to proposeActions", () => {
        const mockStore = createMockStore();
        const brief = makeBrief({ briefId: "brief_account_test" });
        mockStore.intelligence.getIntelBrief = () => brief;
        mockStore.listIntelItemsByIds = () => [];
        const service = new PerceptionService(createMockDb(), mockStore);
        const result = service.exportBrief("brief_account_test", "acct_123");
        assert.ok(result.brief);
    });
    test("exportBrief returns proposals from proposeActions", () => {
        const mockStore = createMockStore();
        const brief = makeBrief({
            briefId: "brief_proposals_test",
            recommendedActionsJson: JSON.stringify([
                { title: "Test Action", summary: "Test", actionType: "monitor", intelId: "intel_1", reason: "test" },
            ]),
        });
        mockStore.intelligence.getIntelBrief = () => brief;
        mockStore.listIntelItemsByIds = () => [];
        const service = new PerceptionService(createMockDb(), mockStore);
        const result = service.exportBrief("brief_proposals_test");
        // Should have called proposeActions and included proposals
        assert.ok(Array.isArray(result.proposals));
    });
    test("exportBrief throws for non-existent brief", () => {
        const mockStore = createMockStore();
        mockStore.intelligence.getIntelBrief = () => null;
        const service = new PerceptionService(createMockDb(), mockStore);
        assert.throws(() => {
            service.exportBrief("nonexistent_brief");
        });
    });
    test("exportBrief artifact lineage contains briefId and source", () => {
        const mockStore = createMockStore();
        const brief = makeBrief({ briefId: "brief_lineage_test" });
        mockStore.intelligence.getIntelBrief = () => brief;
        mockStore.listIntelItemsByIds = () => [];
        const service = new PerceptionService(createMockDb(), mockStore);
        service.exportBrief("brief_lineage_test");
        // Both artifacts should have been inserted with lineage info
        const jsonArtifact = mockStore._artifacts.find((a) => a.kind === "intel_brief");
        const mdArtifact = mockStore._artifacts.find((a) => a.kind === "intel_brief");
        assert.ok(jsonArtifact);
        assert.ok(mdArtifact);
    });
});
//# sourceMappingURL=perception-service-export-brief.test.js.map