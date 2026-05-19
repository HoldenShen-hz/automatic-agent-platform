import assert from "node:assert/strict";
import test from "node:test";
import { KnowledgeBaseTaskTypeSchema, KNOWLEDGE_BASE_DOMAIN_PRESET, requiresKnowledgeBaseReview, } from "../../../../src/domains/knowledge-base/index.js";
test("KnowledgeBaseTaskTypeSchema accepts valid task types", () => {
    const types = ["ingest", "search", "curate"];
    for (const type of types) {
        const result = KnowledgeBaseTaskTypeSchema.safeParse(type);
        assert.equal(result.success, true, `Expected ${type} to be valid`);
    }
});
test("KnowledgeBaseTaskTypeSchema rejects invalid task types", () => {
    const result = KnowledgeBaseTaskTypeSchema.safeParse("invalid");
    assert.equal(result.success, false);
});
test("KNOWLEDGE_BASE_DOMAIN_PRESET has correct domainId", () => {
    assert.equal(KNOWLEDGE_BASE_DOMAIN_PRESET.domainId, "knowledge-base");
});
test("KNOWLEDGE_BASE_DOMAIN_PRESET has correct displayName", () => {
    assert.equal(KNOWLEDGE_BASE_DOMAIN_PRESET.displayName, "Knowledge Base");
});
test("KNOWLEDGE_BASE_DOMAIN_PRESET has correct task types", () => {
    assert.deepEqual(KNOWLEDGE_BASE_DOMAIN_PRESET.requiredCapabilities, ["ingest", "search", "curate"]);
});
test("KNOWLEDGE_BASE_DOMAIN_PRESET reviewRequiredTaskTypes includes curate", () => {
    assert.deepEqual(KNOWLEDGE_BASE_DOMAIN_PRESET.reviewRequiredTaskTypes, ["curate"]);
});
test("requiresKnowledgeBaseReview returns true for curate task type", () => {
    assert.equal(requiresKnowledgeBaseReview("curate"), true);
});
test("requiresKnowledgeBaseReview returns false for ingest task type", () => {
    assert.equal(requiresKnowledgeBaseReview("ingest"), false);
});
test("requiresKnowledgeBaseReview returns false for search task type", () => {
    assert.equal(requiresKnowledgeBaseReview("search"), false);
});
//# sourceMappingURL=index.test.js.map