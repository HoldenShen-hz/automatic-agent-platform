import assert from "node:assert/strict";
import test from "node:test";
import * as PresentersIndex from "../../../../src/plugins/presenters/index.js";
test("PresentersIndex exports coding-presenter", () => {
    assert.ok(PresentersIndex.createCodingPresenterPlugin !== undefined);
});
test("PresentersIndex exports growth-presenter", () => {
    assert.ok(PresentersIndex.createGrowthPresenterPlugin !== undefined);
});
test("PresentersIndex exports operations-presenter", () => {
    assert.ok(PresentersIndex.createOperationsPresenterPlugin !== undefined);
});
test("PresentersIndex creates all presenter plugins successfully", () => {
    const plugins = [
        PresentersIndex.createCodingPresenterPlugin(),
        PresentersIndex.createGrowthPresenterPlugin(),
        PresentersIndex.createOperationsPresenterPlugin(),
    ];
    assert.equal(plugins.length, 3);
    assert.ok(plugins.every(p => p !== undefined));
});
test("PresentersIndex presenter plugins have correct spiType", () => {
    const presenterTypes = [
        { create: PresentersIndex.createCodingPresenterPlugin, expected: "presenter" },
        { create: PresentersIndex.createGrowthPresenterPlugin, expected: "presenter" },
        { create: PresentersIndex.createOperationsPresenterPlugin, expected: "presenter" },
    ];
    for (const { create, expected } of presenterTypes) {
        const plugin = create();
        assert.equal(plugin.spiType, expected, `${plugin.pluginId} should have spiType "presenter"`);
    }
});
test("PresentersIndex presenter plugins have formatOutput method", () => {
    const presenters = [
        PresentersIndex.createCodingPresenterPlugin(),
        PresentersIndex.createGrowthPresenterPlugin(),
        PresentersIndex.createOperationsPresenterPlugin(),
    ];
    assert.ok(presenters.every(p => typeof p.formatOutput === "function"));
});
test("PresentersIndex CodingPresenter has correct pluginId", () => {
    const plugin = PresentersIndex.createCodingPresenterPlugin();
    assert.equal(plugin.pluginId, "plugin.coding.presenter");
});
test("PresentersIndex GrowthPresenter has correct pluginId", () => {
    const plugin = PresentersIndex.createGrowthPresenterPlugin();
    assert.equal(plugin.pluginId, "plugin.growth.presenter");
});
test("PresentersIndex OperationsPresenter has correct pluginId", () => {
    const plugin = PresentersIndex.createOperationsPresenterPlugin();
    assert.equal(plugin.pluginId, "plugin.operations.presenter");
});
//# sourceMappingURL=index.test.js.map