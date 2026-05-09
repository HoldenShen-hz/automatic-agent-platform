import { newId } from "../../contracts/types/ids.js";
import type { LearningSignal } from "../../../scale-ecosystem/feedback-loop/collector/feedback-model.js";
import { normalizeLearningType, type LearningObject } from "./learning-object-model.js";

export class ExperienceDistillationService {
  public distill(signals: readonly LearningSignal[]): LearningObject[] {
    return signals.map((signal) => ({
      learningObjectId: newId("learning"),
      learningType: normalizeLearningType(signal.learningType),
      title: `Distilled ${signal.learningType}`,
      summary: signal.valueSummary,
      confidence: signal.confidence,
      evidenceRefs: signal.evidenceRefs,
      sourceSignalIds: signal.sourceSignalIds,
      recommendation: this.buildRecommendation(signal.learningType),
      validatedBy: "none",
      promotionStatus: "quarantine",
      createdAt: String(signal.generatedAt),
    }));
  }

  private buildRecommendation(learningType: LearningSignal["learningType"]): string {
    switch (learningType) {
      case "failure_pattern":
        return "Capture preventive measures and convert the signal into reusable planning guidance.";
      case "recovery_playbook":
        return "Persist a recovery playbook for the next similar execution.";
      case "user_correction":
        return "Incorporate user feedback to improve future task execution.";
      case "model_retraining":
        return "Flag this pattern for model retraining consideration.";
      case "dataset_gap":
        return "Document this gap for future dataset enrichment.";
      default:
        return "Convert the observed signal into reusable planning guidance.";
    }
  }
}
