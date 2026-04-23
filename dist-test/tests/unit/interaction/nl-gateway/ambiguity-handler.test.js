import test from "node:test";
import assert from "node:assert/strict";
import { detectAmbiguity } from "../../../../src/interaction/nl-gateway/ambiguity-handler/index.js";
test("detectAmbiguity returns true for short messages under 6 characters", () => {
    assert.equal(detectAmbiguity("hi", 0.9, 1, 1), true);
    assert.equal(detectAmbiguity("abc", 0.9, 1, 1), true);
    assert.equal(detectAmbiguity("a", 0.9, 1, 1), true);
    assert.equal(detectAmbiguity("", 0.9, 1, 1), true);
});
test("detectAmbiguity returns true for low confidence below 0.7", () => {
    assert.equal(detectAmbiguity("create a task for user", 0.5, 1, 1), true);
    assert.equal(detectAmbiguity("create a task for user", 0.69, 1, 1), true);
    assert.equal(detectAmbiguity("create a task for user", 0.0, 1, 1), true);
});
test("detectAmbiguity returns true when extracted entities are fewer than required", () => {
    assert.equal(detectAmbiguity("create a task for user", 0.9, 2, 1), true);
    assert.equal(detectAmbiguity("create a task for user", 0.9, 3, 0), true);
    assert.equal(detectAmbiguity("create a task for user", 0.9, 1, 0), true);
});
test("detectAmbiguity returns false when all conditions are met", () => {
    assert.equal(detectAmbiguity("create a task for user", 0.9, 1, 1), false);
    assert.equal(detectAmbiguity("create a task for user", 0.7, 1, 1), false);
    assert.equal(detectAmbiguity("create a task for user", 0.8, 2, 2), false);
});
test("detectAmbiguity edge case at boundary conditions", () => {
    // Exactly 6 characters should not trigger short message ambiguity
    assert.equal(detectAmbiguity("create", 0.9, 1, 1), false);
    // Exactly 0.7 confidence should not trigger low confidence ambiguity
    assert.equal(detectAmbiguity("create a task", 0.7, 1, 1), false);
    // Just below boundary
    assert.equal(detectAmbiguity("create", 0.69, 1, 1), true);
});
test("detectAmbiguity with default entity parameters", () => {
    // Default requiredEntityCount = 1, extractedEntityCount = 0
    assert.equal(detectAmbiguity("create a task for user", 0.9), true);
    // With extractedEntityCount meeting default requirement
    assert.equal(detectAmbiguity("create a task for user", 0.9, 1, 1), false);
});
test("detectAmbiguity trims whitespace before checking length", () => {
    // Whitespace-padded message should be evaluated after trim
    assert.equal(detectAmbiguity("  create", 0.9, 1, 1), false);
    assert.equal(detectAmbiguity("     ", 0.9, 1, 1), true);
});
test("detectAmbiguity handles various message types", () => {
    // English message
    assert.equal(detectAmbiguity("create a new task", 0.8, 1, 1), false);
    // Chinese message
    assert.equal(detectAmbiguity("创建一个新任务", 0.8, 1, 1), false);
    // Mixed content
    assert.equal(detectAmbiguity("create task 任务", 0.8, 1, 1), false);
});
test("detectAmbiguity high confidence with sufficient entities returns false", () => {
    assert.equal(detectAmbiguity("modify the configuration file", 0.95, 1, 2), false);
    assert.equal(detectAmbiguity("delete all temporary files", 0.88, 0, 0), false);
});
//# sourceMappingURL=ambiguity-handler.test.js.map