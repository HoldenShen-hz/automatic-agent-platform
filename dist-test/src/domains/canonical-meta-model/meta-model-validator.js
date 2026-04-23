import { META_MODEL_QUESTION_IDS } from "./types.js";
export function computeMetaModelCompleteness(model) {
    const answered = new Set();
    for (const answer of model.answers) {
        if (answer.status === "complete" && answer.answer.trim().length > 0) {
            answered.add(answer.questionId);
        }
    }
    return Number(((answered.size / META_MODEL_QUESTION_IDS.length) * 100).toFixed(2));
}
export class MetaModelValidator {
    validate(model) {
        const seen = new Set();
        const findings = [];
        for (const answer of model.answers) {
            if (seen.has(answer.questionId)) {
                findings.push(`domain_meta_model.duplicate_question:${answer.questionId}`);
            }
            seen.add(answer.questionId);
            if (answer.answer.trim().length === 0 || answer.status !== "complete") {
                findings.push(`domain_meta_model.incomplete_answer:${answer.questionId}`);
            }
        }
        const missingQuestionIds = META_MODEL_QUESTION_IDS.filter((questionId) => !seen.has(questionId));
        for (const questionId of missingQuestionIds) {
            findings.push(`domain_meta_model.missing_question:${questionId}`);
        }
        const completeness = computeMetaModelCompleteness(model);
        return {
            domainId: model.domainId,
            valid: findings.length === 0 && missingQuestionIds.length === 0 && completeness === 100,
            completeness,
            missingQuestionIds,
            findings,
        };
    }
}
//# sourceMappingURL=meta-model-validator.js.map