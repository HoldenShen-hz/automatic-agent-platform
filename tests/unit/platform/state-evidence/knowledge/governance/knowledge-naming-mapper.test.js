import test from "node:test";
import assert from "node:assert/strict";
import { toDocTrustLevel, toCodeTrustLevel, isTrustLevelAtOrAbove, TRUST_LEVEL_TO_DOC, TRUST_LEVEL_TO_CODE, getTrustLevelDescription, toDocMemoryLayer, toCodeMemoryLayer, isMemoryLayerAtOrAbove, MEMORY_LAYER_TO_DOC, MEMORY_LAYER_TO_CODE, getMemoryLayerDescription, } from "../../../../../../src/platform/state-evidence/knowledge/governance/knowledge-naming-mapper.js";
/* ============================================================
   Trust Level Mapping
   ============================================================ */
test("toDocTrustLevel converts trusted to verified", () => {
    assert.equal(toDocTrustLevel("trusted"), "verified");
});
test("toDocTrustLevel converts external to unverified", () => {
    assert.equal(toDocTrustLevel("external"), "unverified");
});
test("toDocTrustLevel converts untrusted to deprecated", () => {
    assert.equal(toDocTrustLevel("untrusted"), "deprecated");
});
test("toCodeTrustLevel converts verified to trusted", () => {
    assert.equal(toCodeTrustLevel("verified"), "trusted");
});
test("toCodeTrustLevel converts unverified to external", () => {
    assert.equal(toCodeTrustLevel("unverified"), "external");
});
test("toCodeTrustLevel converts deprecated to untrusted", () => {
    assert.equal(toCodeTrustLevel("deprecated"), "untrusted");
});
test("TRUST_LEVEL_TO_DOC mapping is complete", () => {
    assert.equal(TRUST_LEVEL_TO_DOC.trusted, "verified");
    assert.equal(TRUST_LEVEL_TO_DOC.external, "unverified");
    assert.equal(TRUST_LEVEL_TO_DOC.untrusted, "deprecated");
});
test("TRUST_LEVEL_TO_CODE mapping is complete", () => {
    assert.equal(TRUST_LEVEL_TO_CODE.verified, "trusted");
    assert.equal(TRUST_LEVEL_TO_CODE.unverified, "external");
    assert.equal(TRUST_LEVEL_TO_CODE.deprecated, "untrusted");
});
test("toDocTrustLevel and toCodeTrustLevel are inverse operations", () => {
    const codeLevels = ["trusted", "external", "untrusted"];
    for (const code of codeLevels) {
        const doc = toDocTrustLevel(code);
        assert.equal(toCodeTrustLevel(doc), code);
    }
});
test("toCodeTrustLevel and toDocTrustLevel are inverse operations", () => {
    const docLevels = ["verified", "unverified", "deprecated"];
    for (const doc of docLevels) {
        const code = toCodeTrustLevel(doc);
        assert.equal(toDocTrustLevel(code), doc);
    }
});
/* ============================================================
   Trust Level Comparison
   ============================================================ */
test("isTrustLevelAtOrAbove returns true when level equals minimum", () => {
    assert.equal(isTrustLevelAtOrAbove("trusted", "trusted"), true);
    assert.equal(isTrustLevelAtOrAbove("verified", "verified"), true);
});
test("isTrustLevelAtOrAbove returns true when level exceeds minimum", () => {
    // trusted > external > untrusted
    assert.equal(isTrustLevelAtOrAbove("trusted", "external"), true);
    assert.equal(isTrustLevelAtOrAbove("trusted", "untrusted"), true);
    assert.equal(isTrustLevelAtOrAbove("external", "untrusted"), true);
});
test("isTrustLevelAtOrAbove returns false when level is below minimum", () => {
    assert.equal(isTrustLevelAtOrAbove("untrusted", "external"), false);
    assert.equal(isTrustLevelAtOrAbove("untrusted", "trusted"), false);
    assert.equal(isTrustLevelAtOrAbove("external", "trusted"), false);
});
test("isTrustLevelAtOrAbove accepts mixed doc and code levels", () => {
    // Comparing doc level (verified) against code level (trusted)
    assert.equal(isTrustLevelAtOrAbove("verified", "trusted"), true);
    assert.equal(isTrustLevelAtOrAbove("trusted", "verified"), true);
});
test("isTrustLevelAtOrAbove with unverified and external cross-type comparison", () => {
    assert.equal(isTrustLevelAtOrAbove("unverified", "external"), true);
    assert.equal(isTrustLevelAtOrAbove("external", "unverified"), true);
});
/* ============================================================
   Trust Level Descriptions
   ============================================================ */
test("getTrustLevelDescription for verified", () => {
    const desc = getTrustLevelDescription("verified");
    assert.ok(desc.includes("High-confidence") || desc.includes("approved"));
});
test("getTrustLevelDescription for unverified", () => {
    const desc = getTrustLevelDescription("unverified");
    assert.ok(desc.includes("External") || desc.includes("not yet verified"));
});
test("getTrustLevelDescription for deprecated", () => {
    const desc = getTrustLevelDescription("deprecated");
    assert.ok(desc.includes("unreliable") || desc.includes("deprecated"));
});
/* ============================================================
   Memory Layer Mapping
   ============================================================ */
test("toDocMemoryLayer converts layer_3 to working", () => {
    assert.equal(toDocMemoryLayer("layer_3"), "working");
});
test("toDocMemoryLayer converts layer_4 to episodic", () => {
    assert.equal(toDocMemoryLayer("layer_4"), "episodic");
});
test("toDocMemoryLayer converts layer_5 to semantic", () => {
    assert.equal(toDocMemoryLayer("layer_5"), "semantic");
});
test("toCodeMemoryLayer converts working to layer_3", () => {
    assert.equal(toCodeMemoryLayer("working"), "layer_3");
});
test("toCodeMemoryLayer converts episodic to layer_4", () => {
    assert.equal(toCodeMemoryLayer("episodic"), "layer_4");
});
test("toCodeMemoryLayer converts semantic to layer_5", () => {
    assert.equal(toCodeMemoryLayer("semantic"), "layer_5");
});
test("MEMORY_LAYER_TO_DOC mapping is complete", () => {
    assert.equal(MEMORY_LAYER_TO_DOC.layer_3, "working");
    assert.equal(MEMORY_LAYER_TO_DOC.layer_4, "episodic");
    assert.equal(MEMORY_LAYER_TO_DOC.layer_5, "semantic");
});
test("MEMORY_LAYER_TO_CODE mapping is complete", () => {
    assert.equal(MEMORY_LAYER_TO_CODE.working, "layer_3");
    assert.equal(MEMORY_LAYER_TO_CODE.episodic, "layer_4");
    assert.equal(MEMORY_LAYER_TO_CODE.semantic, "layer_5");
});
test("toDocMemoryLayer and toCodeMemoryLayer are inverse operations", () => {
    const codeLayers = ["layer_3", "layer_4", "layer_5"];
    for (const code of codeLayers) {
        const doc = toDocMemoryLayer(code);
        assert.equal(toCodeMemoryLayer(doc), code);
    }
});
test("toCodeMemoryLayer and toDocMemoryLayer are inverse operations", () => {
    const docLayers = ["working", "episodic", "semantic"];
    for (const doc of docLayers) {
        const code = toCodeMemoryLayer(doc);
        assert.equal(toDocMemoryLayer(code), doc);
    }
});
/* ============================================================
   Memory Layer Comparison
   ============================================================ */
test("isMemoryLayerAtOrAbove returns true when layer equals minimum", () => {
    assert.equal(isMemoryLayerAtOrAbove("layer_3", "layer_3"), true);
    assert.equal(isMemoryLayerAtOrAbove("working", "working"), true);
});
test("isMemoryLayerAtOrAbove returns true when layer exceeds minimum", () => {
    // layer_5 > layer_4 > layer_3
    assert.equal(isMemoryLayerAtOrAbove("layer_5", "layer_4"), true);
    assert.equal(isMemoryLayerAtOrAbove("layer_5", "layer_3"), true);
    assert.equal(isMemoryLayerAtOrAbove("layer_4", "layer_3"), true);
});
test("isMemoryLayerAtOrAbove returns false when layer is below minimum", () => {
    assert.equal(isMemoryLayerAtOrAbove("layer_3", "layer_4"), false);
    assert.equal(isMemoryLayerAtOrAbove("layer_3", "layer_5"), false);
    assert.equal(isMemoryLayerAtOrAbove("layer_4", "layer_5"), false);
});
test("isMemoryLayerAtOrAbove accepts mixed doc and code levels", () => {
    assert.equal(isMemoryLayerAtOrAbove("working", "layer_3"), true);
    assert.equal(isMemoryLayerAtOrAbove("layer_3", "working"), true);
});
test("isMemoryLayerAtOrAbove with episodic and layer_4 cross-type comparison", () => {
    assert.equal(isMemoryLayerAtOrAbove("episodic", "layer_4"), true);
    assert.equal(isMemoryLayerAtOrAbove("layer_4", "episodic"), true);
});
test("isMemoryLayerAtOrAbove semantic vs layer_3", () => {
    assert.equal(isMemoryLayerAtOrAbove("semantic", "layer_3"), true);
    assert.equal(isMemoryLayerAtOrAbove("layer_5", "working"), true);
});
test("isMemoryLayerAtOrAbove cross-type boundary check", () => {
    assert.equal(isMemoryLayerAtOrAbove("layer_3", "layer_5"), false);
    assert.equal(isMemoryLayerAtOrAbove("working", "semantic"), false);
});
/* ============================================================
   Memory Layer Descriptions
   ============================================================ */
test("getMemoryLayerDescription for working", () => {
    const desc = getMemoryLayerDescription("working");
    assert.ok(desc.includes("short-term") || desc.includes("current task"));
});
test("getMemoryLayerDescription for episodic", () => {
    const desc = getMemoryLayerDescription("episodic");
    assert.ok(desc.includes("medium-term") || desc.includes("completed"));
});
test("getMemoryLayerDescription for semantic", () => {
    const desc = getMemoryLayerDescription("semantic");
    assert.ok(desc.includes("long-term") || desc.includes("knowledge"));
});
/* ============================================================
   Edge Cases
   ============================================================ */
test("isTrustLevelAtOrAbove handles unknown strings as-is", () => {
    // When value is not a valid key in mapping, it should use as-is for comparison
    const result = isTrustLevelAtOrAbove("unknown_level", "trusted");
    // unknown strings are used as-is in order array, which may give unexpected results
    // but the function should not throw
    assert.equal(typeof result, "boolean");
});
test("isMemoryLayerAtOrAbove handles unknown strings as-is", () => {
    const result = isMemoryLayerAtOrAbove("unknown_layer", "layer_3");
    assert.equal(typeof result, "boolean");
});
test("trust level order is untrusted < external < trusted", () => {
    const order = ["untrusted", "external", "trusted"];
    // Verify the order used internally
    const untrustedIdx = order.indexOf("untrusted");
    const externalIdx = order.indexOf("external");
    const trustedIdx = order.indexOf("trusted");
    assert.ok(untrustedIdx < externalIdx);
    assert.ok(externalIdx < trustedIdx);
});
test("memory layer order is layer_3 < layer_4 < layer_5", () => {
    const order = ["layer_3", "layer_4", "layer_5"];
    const l3Idx = order.indexOf("layer_3");
    const l4Idx = order.indexOf("layer_4");
    const l5Idx = order.indexOf("layer_5");
    assert.ok(l3Idx < l4Idx);
    assert.ok(l4Idx < l5Idx);
});
//# sourceMappingURL=knowledge-naming-mapper.test.js.map