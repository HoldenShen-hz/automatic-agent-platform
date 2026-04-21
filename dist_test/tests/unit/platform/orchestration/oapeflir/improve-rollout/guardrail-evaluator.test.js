import test from "node:test";
import assert from "node:assert/strict";
import { GuardrailEvaluator } from "../../../../../../src/platform/orchestration/oapeflir/improve-rollout/guardrail-evaluator.js";
import { createStrategyVersion } from "../../../../../../src/platform/orchestration/oapeflir/improve-rollout/strategy-versioning.js";
test("GuardrailEvaluator allows candidate with all evidence", () => {
    const evaluator = new GuardrailEvaluator();
    const learningObjects = [
        { learningObjectId: "lo_1", learningType: "failure_pattern", title: "Test", summary: "Summary", confidence: 0.9, evidenceRefs: ["evidence:1"], sourceSignalIds: [], recommendation: "Rec", validatedBy: "evidence", promotionStatus: "validated", createdAt: Date.now() },
    ];
    const strategyVersion = createStrategyVersion("Test", learningObjects, "stable");
    const candidate = {
        candidateId: "candidate_1",
        taskId: "task_1",
        target: "planning_policy",
        learningObjects: [],
        description: "Test",
        expectedBenefit: "Test benefit",
        changeScope: "policy",
        status: "approved",
        sourceSignalRefs: ["evidence:1"],
        sourceLearningObjectIds: ["lo_1"],
        createdAt: Date.now(),
    };
    const result = evaluator.evaluate(candidate, strategyVersion);
    assert.equal(result.allowed, true);
    assert.deepEqual(result.reasonCodes, []);
});
test("GuardrailEvaluator blocks candidate with missing signal refs", () => {
    const evaluator = new GuardrailEvaluator();
    const strategyVersion = createStrategyVersion("Test", [], "stable");
    const candidate = {
        candidateId: "candidate_1",
        taskId: "task_1",
        target: "planning_policy",
        learningObjects: [],
        description: "Test",
        expectedBenefit: "Test benefit",
        changeScope: "policy",
        status: "approved",
        sourceSignalRefs: [],
        sourceLearningObjectIds: ["lo_1"],
        createdAt: Date.now(),
    };
    const result = evaluator.evaluate(candidate, strategyVersion);
    assert.equal(result.allowed, false);
    assert.ok(result.reasonCodes.includes("improvement.guardrail_missing_evidence"));
});
test("GuardrailEvaluator blocks candidate with missing learning objects", () => {
    const evaluator = new GuardrailEvaluator();
    const strategyVersion = createStrategyVersion("Test", [], "stable");
    const candidate = {
        candidateId: "candidate_1",
        taskId: "task_1",
        target: "planning_policy",
        learningObjects: [],
        description: "Test",
        expectedBenefit: "Test benefit",
        changeScope: "policy",
        status: "approved",
        sourceSignalRefs: ["evidence:1"],
        sourceLearningObjectIds: [],
        createdAt: Date.now(),
    };
    const result = evaluator.evaluate(candidate, strategyVersion);
    assert.equal(result.allowed, false);
    assert.ok(result.reasonCodes.includes("improvement.guardrail_missing_learning_object"));
});
test("GuardrailEvaluator blocks unlinked strategy", () => {
    const evaluator = new GuardrailEvaluator();
    const strategyVersion = createStrategyVersion("Test", [], "stable");
    const candidate = {
        candidateId: "candidate_1",
        taskId: "task_1",
        target: "planning_policy",
        learningObjects: [],
        description: "Test",
        expectedBenefit: "Test benefit",
        changeScope: "policy",
        status: "approved",
        sourceSignalRefs: ["evidence:1"],
        sourceLearningObjectIds: ["lo_1"],
        createdAt: Date.now(),
    };
    // Strategy version has empty sourceLearningObjectIds
    const result = evaluator.evaluate(candidate, strategyVersion);
    assert.equal(result.allowed, false);
    assert.ok(result.reasonCodes.includes("improvement.guardrail_unlinked_strategy"));
});
test("GuardrailEvaluator blocks shadow release without approval", () => {
    const evaluator = new GuardrailEvaluator();
    const strategyVersion = createStrategyVersion("Test", [], "shadow");
    const candidate = {
        candidateId: "candidate_1",
        taskId: "task_1",
        target: "planning_policy",
        learningObjects: [],
        description: "Test",
        expectedBenefit: "Test benefit",
        changeScope: "policy",
        status: "proposed",
        sourceSignalRefs: ["evidence:1"],
        sourceLearningObjectIds: ["lo_1"],
        createdAt: Date.now(),
    };
    const result = evaluator.evaluate(candidate, strategyVersion);
    assert.equal(result.allowed, false);
    assert.ok(result.reasonCodes.includes("improvement.guardrail_shadow_requires_approval"));
});
test("GuardrailEvaluator allows shadow with approved status", () => {
    const evaluator = new GuardrailEvaluator();
    const learningObjects = [
        { learningObjectId: "lo_1", learningType: "failure_pattern", title: "Test", summary: "Summary", confidence: 0.9, evidenceRefs: ["evidence:1"], sourceSignalIds: [], recommendation: "Rec", validatedBy: "evidence", promotionStatus: "validated", createdAt: Date.now() },
    ];
    const strategyVersion = createStrategyVersion("Test", learningObjects, "shadow");
    const candidate = {
        candidateId: "candidate_1",
        taskId: "task_1",
        target: "planning_policy",
        learningObjects: [],
        description: "Test",
        expectedBenefit: "Test benefit",
        changeScope: "policy",
        status: "approved",
        sourceSignalRefs: ["evidence:1"],
        sourceLearningObjectIds: ["lo_1"],
        createdAt: Date.now(),
    };
    const result = evaluator.evaluate(candidate, strategyVersion);
    assert.equal(result.allowed, true);
});
test("GuardrailEvaluator allows shadow_running status", () => {
    const evaluator = new GuardrailEvaluator();
    const learningObjects = [
        { learningObjectId: "lo_1", learningType: "failure_pattern", title: "Test", summary: "Summary", confidence: 0.9, evidenceRefs: ["evidence:1"], sourceSignalIds: [], recommendation: "Rec", validatedBy: "evidence", promotionStatus: "validated", createdAt: Date.now() },
    ];
    const strategyVersion = createStrategyVersion("Test", learningObjects, "shadow");
    const candidate = {
        candidateId: "candidate_1",
        taskId: "task_1",
        target: "planning_policy",
        learningObjects: [],
        description: "Test",
        expectedBenefit: "Test benefit",
        changeScope: "policy",
        status: "shadow_running",
        sourceSignalRefs: ["evidence:1"],
        sourceLearningObjectIds: ["lo_1"],
        createdAt: Date.now(),
    };
    const result = evaluator.evaluate(candidate, strategyVersion);
    assert.equal(result.allowed, true);
});
//# sourceMappingURL=guardrail-evaluator.test.js.map