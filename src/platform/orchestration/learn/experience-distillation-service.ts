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
      recommendation:
        signal.learningType === "recovery_playbook"
          ? "Persist a recovery playbook for the next similar execution."
          : "Convert the observed signal into reusable planning guidance.",
      validatedBy: "none",
      promotionStatus: "draft",
      createdAt: Date.now(),
    }));
  }
}
