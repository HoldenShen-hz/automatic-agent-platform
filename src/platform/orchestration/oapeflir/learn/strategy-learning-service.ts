import type { LearningSignal } from "../../../../scale-ecosystem/feedback-loop/collector/feedback-model.js";
import type { LearningObject } from "./learning-object-model.js";
import { FailurePatternMiner } from "./failure-pattern-miner.js";
import { ExperienceDistillationService } from "./experience-distillation-service.js";
import { LearningObjectValidator } from "./learning-object-validator.js";

export class StrategyLearningService {
  private readonly miner = new FailurePatternMiner();
  private readonly distillation = new ExperienceDistillationService();
  private readonly validator = new LearningObjectValidator();

  public learn(signals: readonly LearningSignal[]): LearningObject[] {
    const mined = this.miner.mine(signals);
    const distilled = this.distillation.distill(
      signals.filter((signal) => signal.learningType !== "failure_pattern"),
    );
    return this.validator.validateMany([...mined, ...distilled]);
  }
}
