import assert from "node:assert/strict";
import test from "node:test";
import { META_MODEL_QUESTION_IDS, MetaModelValidator, computeMetaModelCompleteness, seedDomainMetaModel } from "../../../../src/domains/canonical-meta-model/index.js";
test("MetaModelValidator accepts a fully seeded 12-question domain meta-model", () => {
    const model = seedDomainMetaModel({
        domainId: "quant-trading",
        displayName: "Quant Trading",
        ownerOrgNodeId: "org.trading",
        taskTypes: ["research", "simulate", "trade"],
        tags: ["trading", "finance"],
        riskLevel: "critical",
    });
    const validation = new MetaModelValidator().validate(model);
    assert.equal(validation.valid, true);
    assert.equal(validation.completeness, 100);
    assert.deepEqual(validation.missingQuestionIds, []);
});
test("MetaModelValidator reports missing questions and incomplete completeness", () => {
    const model = seedDomainMetaModel({
        domainId: "legal",
        displayName: "Legal",
        ownerOrgNodeId: "org.legal",
        taskTypes: ["review", "redline"],
        tags: ["legal"],
        riskLevel: "critical",
    });
    const truncated = {
        ...model,
        answers: model.answers.filter((answer) => answer.questionId !== META_MODEL_QUESTION_IDS[11]).slice(0, 10),
    };
    const validation = new MetaModelValidator().validate(truncated);
    assert.equal(validation.valid, false);
    assert.equal(validation.completeness < 100, true);
    assert.ok(validation.findings.some((finding) => finding.startsWith("domain_meta_model.missing_question:")));
});
test("computeMetaModelCompleteness only counts complete answers", () => {
    const model = seedDomainMetaModel({
        domainId: "marketing",
        displayName: "Marketing",
        ownerOrgNodeId: "org.marketing",
        taskTypes: ["plan"],
        tags: ["marketing"],
        riskLevel: "medium",
    });
    const partial = {
        ...model,
        answers: model.answers.map((answer, index) => index < 6 ? answer : { ...answer, status: "partial" }),
    };
    assert.equal(computeMetaModelCompleteness(partial), 50);
});
//# sourceMappingURL=meta-model-validator.test.js.map