import assert from "node:assert/strict";
import test from "node:test";
import { computeMetaModelCompleteness, MetaModelValidator, } from "../../../../src/domains/canonical-meta-model/meta-model-validator.js";
import { META_MODEL_QUESTION_IDS } from "../../../../src/domains/canonical-meta-model/types.js";
function createCompleteModel(domainId) {
    return {
        domainId,
        displayName: "Test Domain",
        version: "v1",
        answers: META_MODEL_QUESTION_IDS.map((id) => ({
            questionId: id,
            title: "Test Question",
            answer: "Test answer content",
            evidenceRefs: ["ref1"],
            status: "complete",
        })),
    };
}
test("computeMetaModelCompleteness returns 100 for complete model", () => {
    const model = createCompleteModel("test-domain");
    const completeness = computeMetaModelCompleteness(model);
    assert.equal(completeness, 100);
});
test("computeMetaModelCompleteness returns 0 for empty answers", () => {
    const model = {
        domainId: "test-domain",
        displayName: "Test",
        version: "v1",
        answers: [],
    };
    const completeness = computeMetaModelCompleteness(model);
    assert.equal(completeness, 0);
});
test("computeMetaModelCompleteness ignores incomplete answers", () => {
    const model = {
        domainId: "test-domain",
        displayName: "Test",
        version: "v1",
        answers: META_MODEL_QUESTION_IDS.map((id, i) => ({
            questionId: id,
            title: "Test",
            answer: i === 0 ? "" : "some answer",
            evidenceRefs: [],
            status: i === 0 ? "pending" : "complete",
        })),
    };
    const completeness = computeMetaModelCompleteness(model);
    // 14 out of 15 questions answered (excluding the one with empty answer)
    assert.equal(completeness, 93.33);
});
test("MetaModelValidator.validate returns valid for complete model", () => {
    const validator = new MetaModelValidator();
    const model = createCompleteModel("test-domain");
    const result = validator.validate(model);
    assert.equal(result.valid, true);
    assert.equal(result.domainId, "test-domain");
    assert.equal(result.completeness, 100);
    assert.deepEqual(result.missingQuestionIds, []);
    assert.deepEqual(result.findings, []);
});
test("MetaModelValidator.validate detects duplicate questions", () => {
    const validator = new MetaModelValidator();
    const model = {
        domainId: "test-domain",
        displayName: "Test",
        version: "v1",
        answers: [
            {
                questionId: "Q1_primary_user",
                title: "Q1",
                answer: "answer 1",
                evidenceRefs: [],
                status: "complete",
            },
            {
                questionId: "Q1_primary_user",
                title: "Q1 duplicate",
                answer: "answer 2",
                evidenceRefs: [],
                status: "complete",
            },
        ],
    };
    const result = validator.validate(model);
    assert.equal(result.valid, false);
    assert.ok(result.findings.some(f => f.includes("duplicate_question")));
});
test("MetaModelValidator.validate detects incomplete answers", () => {
    const validator = new MetaModelValidator();
    const model = {
        domainId: "test-domain",
        displayName: "Test",
        version: "v1",
        answers: [
            {
                questionId: "Q1_primary_user",
                title: "Q1",
                answer: "",
                evidenceRefs: [],
                status: "complete",
            },
        ],
    };
    const result = validator.validate(model);
    assert.equal(result.valid, false);
    assert.ok(result.findings.some(f => f.includes("incomplete_answer")));
});
test("MetaModelValidator.validate detects missing questions", () => {
    const validator = new MetaModelValidator();
    const model = {
        domainId: "test-domain",
        displayName: "Test",
        version: "v1",
        answers: [
            {
                questionId: "Q1_primary_user",
                title: "Q1",
                answer: "answer",
                evidenceRefs: [],
                status: "complete",
            },
        ],
    };
    const result = validator.validate(model);
    assert.equal(result.valid, false);
    assert.ok(result.missingQuestionIds.length > 0);
    assert.ok(result.missingQuestionIds.includes("Q2_primary_outcomes"));
});
test("MetaModelValidator.validate handles pending status as incomplete", () => {
    const validator = new MetaModelValidator();
    const model = {
        domainId: "test-domain",
        displayName: "Test",
        version: "v1",
        answers: META_MODEL_QUESTION_IDS.map((id) => ({
            questionId: id,
            title: "Test",
            answer: "some answer",
            evidenceRefs: [],
            status: "pending",
        })),
    };
    const result = validator.validate(model);
    assert.equal(result.valid, false);
    assert.ok(result.findings.some(f => f.includes("incomplete_answer")));
});
test("MetaModelValidator.validate handles whitespace-only answer as incomplete", () => {
    const validator = new MetaModelValidator();
    const model = {
        domainId: "test-domain",
        displayName: "Test",
        version: "v1",
        answers: [
            {
                questionId: "Q1_primary_user",
                title: "Q1",
                answer: "   ",
                evidenceRefs: [],
                status: "complete",
            },
        ],
    };
    const result = validator.validate(model);
    assert.equal(result.valid, false);
    assert.ok(result.findings.some(f => f.includes("incomplete_answer")));
});
//# sourceMappingURL=meta-model-validator.test.js.map