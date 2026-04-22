import { META_MODEL_QUESTION_IDS, type DomainMetaModel, type MetaModelQuestionId, type MetaModelValidationResult } from "./types.js";

export function computeMetaModelCompleteness(model: DomainMetaModel): number {
  const answered = new Set<MetaModelQuestionId>();
  for (const answer of model.answers) {
    if (answer.status === "complete" && answer.answer.trim().length > 0) {
      answered.add(answer.questionId);
    }
  }
  return Number(((answered.size / META_MODEL_QUESTION_IDS.length) * 100).toFixed(2));
}

export class MetaModelValidator {
  public validate(model: DomainMetaModel): MetaModelValidationResult {
    const seen = new Set<MetaModelQuestionId>();
    const findings: string[] = [];

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
