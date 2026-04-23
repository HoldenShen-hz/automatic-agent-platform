import assert from "node:assert/strict";
import test from "node:test";
import { MetaModelValidator, computeMetaModelCompleteness } from "../../../../src/domains/canonical-meta-model/index.js";
import { META_MODEL_QUESTION_IDS } from "../../../../src/domains/canonical-meta-model/types.js";
function createCompleteAnswer(questionId) {
    return {
        questionId,
        title: `Answer to ${questionId}`,
        answer: "This is a complete answer with sufficient detail.",
        evidenceRefs: ["ref1", "ref2"],
        status: "complete",
    };
}
test("integration: MetaModelValidator validates complete model", () => {
    const validator = new MetaModelValidator();
    const model = {
        domainId: "complete-domain",
        displayName: "Complete Domain",
        version: "1.0.0",
        answers: META_MODEL_QUESTION_IDS.map((qId) => createCompleteAnswer(qId)),
    };
    const result = validator.validate(model);
    assert.equal(result.valid, true);
    assert.equal(result.completeness, 100);
    assert.equal(result.missingQuestionIds.length, 0);
    assert.equal(result.findings.length, 0);
});
test("integration: MetaModelValidator detects missing questions", () => {
    const validator = new MetaModelValidator();
    const model = {
        domainId: "incomplete-domain",
        displayName: "Incomplete Domain",
        version: "1.0.0",
        answers: META_MODEL_QUESTION_IDS.slice(0, 6).map((qId) => createCompleteAnswer(qId)),
    };
    const result = validator.validate(model);
    assert.equal(result.valid, false);
    assert.equal(result.missingQuestionIds.length, META_MODEL_QUESTION_IDS.length - 6);
    assert.ok(result.findings.some((f) => f.includes("missing_question")));
});
test("integration: MetaModelValidator detects incomplete answers", () => {
    const validator = new MetaModelValidator();
    const answers = META_MODEL_QUESTION_IDS.map((qId, index) => {
        if (index === 3) {
            return {
                questionId: qId,
                title: `Answer to ${qId}`,
                answer: "",
                evidenceRefs: [],
                status: "pending",
            };
        }
        return createCompleteAnswer(qId);
    });
    const model = {
        domainId: "pending-domain",
        displayName: "Pending Domain",
        version: "1.0.0",
        answers,
    };
    const result = validator.validate(model);
    assert.equal(result.valid, false);
    assert.ok(result.findings.some((f) => f.includes("incomplete_answer")));
});
test("integration: MetaModelValidator detects duplicate questions", () => {
    const validator = new MetaModelValidator();
    const answers = [
        createCompleteAnswer("Q1_primary_user"),
        createCompleteAnswer("Q1_primary_user"),
        createCompleteAnswer("Q2_primary_outcomes"),
    ];
    const model = {
        domainId: "duplicate-domain",
        displayName: "Duplicate Domain",
        version: "1.0.0",
        answers,
    };
    const result = validator.validate(model);
    assert.equal(result.valid, false);
    assert.ok(result.findings.some((f) => f.includes("duplicate_question")));
});
test("integration: MetaModelValidator computes completeness correctly", () => {
    const model = {
        domainId: "partial-domain",
        displayName: "Partial Domain",
        version: "1.0.0",
        answers: META_MODEL_QUESTION_IDS.slice(0, 6).map((qId) => createCompleteAnswer(qId)),
    };
    const completeness = computeMetaModelCompleteness(model);
    assert.equal(completeness, 50);
});
test("integration: MetaModelValidator partial answers count as incomplete", () => {
    const validator = new MetaModelValidator();
    const answers = META_MODEL_QUESTION_IDS.map((qId, index) => {
        if (index < 8) {
            return createCompleteAnswer(qId);
        }
        return {
            questionId: qId,
            title: `Answer to ${qId}`,
            answer: "Partial",
            evidenceRefs: [],
            status: "partial",
        };
    });
    const model = {
        domainId: "partial-status-domain",
        displayName: "Partial Status Domain",
        version: "1.0.0",
        answers,
    };
    const result = validator.validate(model);
    assert.equal(result.completeness < 100, true);
});
test("integration: MetaModelValidator empty answer string is incomplete", () => {
    const validator = new MetaModelValidator();
    const answers = META_MODEL_QUESTION_IDS.map((qId) => {
        return {
            questionId: qId,
            title: `Answer to ${qId}`,
            answer: "   ",
            evidenceRefs: [],
            status: "complete",
        };
    });
    const model = {
        domainId: "empty-domain",
        displayName: "Empty Domain",
        version: "1.0.0",
        answers,
    };
    const result = validator.validate(model);
    assert.equal(result.valid, false);
    assert.ok(result.findings.some((f) => f.includes("incomplete_answer")));
});
//# sourceMappingURL=meta-model-integration.test.js.map