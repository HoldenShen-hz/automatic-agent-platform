import assert from "node:assert/strict";
import test from "node:test";
import * as RetrieversIndex from "../../../../src/plugins/retrievers/index.js";
test("RetrieversIndex exports asset-production-retriever", () => {
    assert.ok(RetrieversIndex.createAssetProductionRetrieverPlugin !== undefined);
});
test("RetrieversIndex exports coding-retriever", () => {
    assert.ok(RetrieversIndex.createCodingRetrieverPlugin !== undefined);
});
test("RetrieversIndex exports game-dev-retriever", () => {
    assert.ok(RetrieversIndex.createGameDevRetrieverPlugin !== undefined);
});
test("RetrieversIndex exports growth-retriever", () => {
    assert.ok(RetrieversIndex.createGrowthRetrieverPlugin !== undefined);
});
test("RetrieversIndex exports livestream-retriever", () => {
    assert.ok(RetrieversIndex.createLivestreamRetrieverPlugin !== undefined);
});
test("RetrieversIndex exports operations-retriever", () => {
    assert.ok(RetrieversIndex.createOperationsRetrieverPlugin !== undefined);
});
test("RetrieversIndex creates all retriever plugins successfully", () => {
    const plugins = [
        RetrieversIndex.createAssetProductionRetrieverPlugin(),
        RetrieversIndex.createCodingRetrieverPlugin(),
        RetrieversIndex.createGameDevRetrieverPlugin(),
        RetrieversIndex.createGrowthRetrieverPlugin(),
        RetrieversIndex.createLivestreamRetrieverPlugin(),
        RetrieversIndex.createOperationsRetrieverPlugin(),
    ];
    assert.equal(plugins.length, 6);
    assert.ok(plugins.every(p => p !== undefined));
});
test("RetrieversIndex retriever plugins have correct spiType", () => {
    const retrieverTypes = [
        { create: RetrieversIndex.createAssetProductionRetrieverPlugin, expected: "retriever" },
        { create: RetrieversIndex.createCodingRetrieverPlugin, expected: "retriever" },
        { create: RetrieversIndex.createGameDevRetrieverPlugin, expected: "retriever" },
        { create: RetrieversIndex.createGrowthRetrieverPlugin, expected: "retriever" },
        { create: RetrieversIndex.createLivestreamRetrieverPlugin, expected: "retriever" },
        { create: RetrieversIndex.createOperationsRetrieverPlugin, expected: "retriever" },
    ];
    for (const { create, expected } of retrieverTypes) {
        const plugin = create();
        assert.equal(plugin.spiType, expected, `${plugin.pluginId} should have spiType "retriever"`);
    }
});
test("RetrieversIndex retriever plugins have retrieve method", () => {
    const retrievers = [
        RetrieversIndex.createAssetProductionRetrieverPlugin(),
        RetrieversIndex.createCodingRetrieverPlugin(),
        RetrieversIndex.createGameDevRetrieverPlugin(),
        RetrieversIndex.createGrowthRetrieverPlugin(),
        RetrieversIndex.createLivestreamRetrieverPlugin(),
        RetrieversIndex.createOperationsRetrieverPlugin(),
    ];
    assert.ok(retrievers.every(p => typeof p.retrieve === "function"));
});
test("RetrieversIndex AssetProductionRetriever has correct pluginId", () => {
    const plugin = RetrieversIndex.createAssetProductionRetrieverPlugin();
    assert.equal(plugin.pluginId, "plugin.assetproduction.retriever");
});
test("RetrieversIndex CodingRetriever has correct pluginId", () => {
    const plugin = RetrieversIndex.createCodingRetrieverPlugin();
    assert.equal(plugin.pluginId, "plugin.coding.retriever");
});
test("RetrieversIndex GameDevRetriever has correct pluginId", () => {
    const plugin = RetrieversIndex.createGameDevRetrieverPlugin();
    assert.equal(plugin.pluginId, "plugin.gamedev.retriever");
});
test("RetrieversIndex GrowthRetriever has correct pluginId", () => {
    const plugin = RetrieversIndex.createGrowthRetrieverPlugin();
    assert.equal(plugin.pluginId, "plugin.growth.retriever");
});
test("RetrieversIndex LivestreamRetriever has correct pluginId", () => {
    const plugin = RetrieversIndex.createLivestreamRetrieverPlugin();
    assert.equal(plugin.pluginId, "plugin.livestream.retriever");
});
test("RetrieversIndex OperationsRetriever has correct pluginId", () => {
    const plugin = RetrieversIndex.createOperationsRetrieverPlugin();
    assert.equal(plugin.pluginId, "plugin.operations.retriever");
});
test("RetrieversIndex retriever plugins have correct domainId", () => {
    assert.equal(RetrieversIndex.createAssetProductionRetrieverPlugin().domainId, "assetproduction");
    assert.equal(RetrieversIndex.createCodingRetrieverPlugin().domainId, "coding");
    assert.equal(RetrieversIndex.createGameDevRetrieverPlugin().domainId, "gamedev");
    assert.equal(RetrieversIndex.createGrowthRetrieverPlugin().domainId, "growth");
    assert.equal(RetrieversIndex.createLivestreamRetrieverPlugin().domainId, "livestream");
    assert.equal(RetrieversIndex.createOperationsRetrieverPlugin().domainId, "operations");
});
test("RetrieversIndex retriever plugins have capabilityIds", () => {
    const plugins = [
        RetrieversIndex.createAssetProductionRetrieverPlugin(),
        RetrieversIndex.createCodingRetrieverPlugin(),
        RetrieversIndex.createGameDevRetrieverPlugin(),
        RetrieversIndex.createGrowthRetrieverPlugin(),
        RetrieversIndex.createLivestreamRetrieverPlugin(),
        RetrieversIndex.createOperationsRetrieverPlugin(),
    ];
    assert.ok(plugins.every(p => Array.isArray(p.capabilityIds)));
    assert.ok(plugins.every(p => (p.capabilityIds?.length ?? 0) > 0));
});
test("RetrieversIndex retriever plugins have knowledge.retrieve capability", () => {
    const plugins = [
        RetrieversIndex.createAssetProductionRetrieverPlugin(),
        RetrieversIndex.createCodingRetrieverPlugin(),
        RetrieversIndex.createGameDevRetrieverPlugin(),
        RetrieversIndex.createGrowthRetrieverPlugin(),
        RetrieversIndex.createLivestreamRetrieverPlugin(),
        RetrieversIndex.createOperationsRetrieverPlugin(),
    ];
    assert.ok(plugins.every(p => p.capabilityIds.includes("knowledge.retrieve")));
});
//# sourceMappingURL=index.test.js.map