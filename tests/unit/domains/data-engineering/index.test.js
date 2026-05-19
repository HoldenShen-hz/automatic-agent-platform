import assert from "node:assert/strict";
import test from "node:test";
import { DataEngineeringTaskTypeSchema, DATA_ENGINEERING_DOMAIN_PRESET, requiresDataEngineeringReview, } from "../../../../src/domains/data-engineering/index.js";
test("DataEngineeringTaskTypeSchema accepts valid task types", () => {
    const types = ["ingest", "clean", "transform"];
    for (const type of types) {
        const result = DataEngineeringTaskTypeSchema.safeParse(type);
        assert.equal(result.success, true, `Expected ${type} to be valid`);
    }
});
test("DataEngineeringTaskTypeSchema rejects invalid task types", () => {
    const result = DataEngineeringTaskTypeSchema.safeParse("invalid");
    assert.equal(result.success, false);
});
test("DATA_ENGINEERING_DOMAIN_PRESET has correct structure", () => {
    assert.equal(DATA_ENGINEERING_DOMAIN_PRESET.domainId, "data-engineering");
    assert.ok(Array.isArray(DATA_ENGINEERING_DOMAIN_PRESET.defaultWorkflowIds));
    assert.ok(Array.isArray(DATA_ENGINEERING_DOMAIN_PRESET.defaultToolBundleIds));
    assert.ok(Array.isArray(DATA_ENGINEERING_DOMAIN_PRESET.requiredCapabilities));
    assert.ok(Array.isArray(DATA_ENGINEERING_DOMAIN_PRESET.reviewRequiredTaskTypes));
});
test("DATA_ENGINEERING_DOMAIN_PRESET has correct required capabilities", () => {
    assert.deepEqual(DATA_ENGINEERING_DOMAIN_PRESET.requiredCapabilities, ["ingest", "clean", "transform"]);
});
test("DATA_ENGINEERING_DOMAIN_PRESET has correct review required task types", () => {
    assert.deepEqual(DATA_ENGINEERING_DOMAIN_PRESET.reviewRequiredTaskTypes, ["clean", "transform"]);
});
test("requiresDataEngineeringReview returns true for clean task type", () => {
    assert.equal(requiresDataEngineeringReview("clean"), true);
});
test("requiresDataEngineeringReview returns true for transform task type", () => {
    assert.equal(requiresDataEngineeringReview("transform"), true);
});
test("requiresDataEngineeringReview returns false for ingest task type", () => {
    assert.equal(requiresDataEngineeringReview("ingest"), false);
});
//# sourceMappingURL=index.test.js.map