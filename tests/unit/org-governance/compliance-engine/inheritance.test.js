import test from "node:test";
import assert from "node:assert/strict";
import { inheritPolicyLayers } from "../../../../src/org-governance/compliance-engine/inheritance/index.js";
test("inheritPolicyLayers returns empty object for empty layers array", () => {
    const result = inheritPolicyLayers([]);
    assert.deepStrictEqual(result, {});
});
test("inheritPolicyLayers merges boolean values with OR logic", () => {
    const layers = [
        { policyId: "p1", rules: { segregationOfDuties: false } },
        { policyId: "p2", rules: { segregationOfDuties: true } },
    ];
    const result = inheritPolicyLayers(layers);
    assert.strictEqual(result.segregationOfDuties, true);
});
test("inheritPolicyLayers keeps retention-style numbers at the strictest value", () => {
    const layers = [
        { policyId: "p1", rules: { auditRetentionDays: 100 } },
        { policyId: "p2", rules: { auditRetentionDays: 2555 } },
    ];
    const result = inheritPolicyLayers(layers);
    assert.strictEqual(result.auditRetentionDays, 2555);
});
test("inheritPolicyLayers merges string values with restricted taking precedence", () => {
    const layers = [
        { policyId: "p1", rules: { dataClassification: "standard" } },
        { policyId: "p2", rules: { dataClassification: "restricted" } },
    ];
    const result = inheritPolicyLayers(layers);
    assert.strictEqual(result.dataClassification, "restricted");
});
test("inheritPolicyLayers prefers later non-empty string over earlier empty string", () => {
    const layers = [
        { policyId: "p1", rules: { dataClassification: "" } },
        { policyId: "p2", rules: { dataClassification: "standard" } },
    ];
    const result = inheritPolicyLayers(layers);
    assert.strictEqual(result.dataClassification, "standard");
});
test("inheritPolicyLayers later layer value overwrites non-boolean/number/string", () => {
    const layers = [
        { policyId: "p1", rules: { customRule: { a: 1 } } },
        { policyId: "p2", rules: { customRule: { b: 2 } } },
    ];
    const result = inheritPolicyLayers(layers);
    assert.deepStrictEqual(result.customRule, { b: 2 });
});
test("inheritPolicyLayers handles single layer", () => {
    const layers = [
        { policyId: "p1", rules: { approvalChainRequired: true } },
    ];
    const result = inheritPolicyLayers(layers);
    assert.strictEqual(result.approvalChainRequired, true);
});
test("inheritPolicyLayers merges multiple layers in order", () => {
    const layers = [
        { policyId: "p1", rules: { rule1: 1, rule2: "a" } },
        { policyId: "p2", rules: { rule1: 2, rule2: "restricted", rule3: false } },
        { policyId: "p3", rules: { rule1: 3, rule3: true } },
    ];
    const result = inheritPolicyLayers(layers);
    assert.strictEqual(result.rule1, 1);
    assert.strictEqual(result.rule2, "restricted");
    assert.strictEqual(result.rule3, true);
});
//# sourceMappingURL=inheritance.test.js.map