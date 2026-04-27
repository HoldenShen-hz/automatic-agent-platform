import { newId } from "../../contracts/types/ids.js";
import type { LearningSignal } from "../../../scale-ecosystem/feedback-loop/collector/feedback-model.js";
import type { LearningObject } from "./learning-object-model.js";

export class ExperienceDistillationService {
  public distill(signals: readonly LearningSignal[]): LearningObject[] {
    return signals.map((signal) => ({
      learningObjectId: newId("learning"),
      learningType: signal.learningType,
      title: `Distilled ${signal.learningType}`,
      summary: signal.valueSummary,
      confidence: signal.confidence,
      evidenceRefs: signal.evidenceRefs,
      sourceSignalIds: signal.sourceSignalIds,
      recommendation: this.buildRecommendation(signal.learningType),
      validatedBy: "none",
      promotionStatus: "draft",
      createdAt: signal.generatedAt,
    }));
  }

  private buildRecommendation(learningType: LearningSignal["learningType"]): string {
    switch (learningType) {
      case "failure_pattern":
        return "Capture preventive measures and convert the signal into reusable planning guidance.";
      case "recovery_playbook":
        return "Persist a recovery playbook for the next similar execution.";
      default:
        return "Convert the observed signal into reusable planning guidance.";
    }
  }
}
