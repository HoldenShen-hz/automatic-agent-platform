import type { LearningSignal } from "../../../../scale-ecosystem/feedback-loop/collector/feedback-model.js";
import type { LearningObject } from "./learning-object-model.js";
import { FailurePatternMiner } from "./failure-pattern-miner.js";
import { LLMImprovementGenerationService } from "./llm-improvement-generation-service.js";
import { LearningObjectValidator } from "./learning-object-validator.js";
import { ExperienceDistillationService } from "./experience-distillation-service.js";

export interface StrategyLearningServiceOptions {
  llmImprovementService?: LLMImprovementGenerationService;
}

export class StrategyLearningService {
  private readonly miner = new FailurePatternMiner();
  private readonly distillation = new ExperienceDistillationService();
  private readonly llmImprovement: LLMImprovementGenerationService;
  private readonly validator = new LearningObjectValidator();

  public constructor(options: StrategyLearningServiceOptions = {}) {
    this.llmImprovement = options.llmImprovementService ?? new LLMImprovementGenerationService();
  }

  public async learn(signals: readonly LearningSignal[]): Promise<LearningObject[]> {
    const mined = this.miner.mine(signals);
    const nonFailureSignals = signals.filter((signal) => signal.learningType !== "failure_pattern");
    const distilled = await this.llmImprovement.generateImprovements(nonFailureSignals);
    return this.validator.validateMany([...mined, ...distilled]);
  }

  public learnSync(signals: readonly LearningSignal[]): LearningObject[] {
    const mined = this.miner.mine(signals);
    const nonFailureSignals = signals.filter((signal) => signal.learningType !== "failure_pattern");
    const distilled = this.distillation.distill(nonFailureSignals);
    return this.validator.validateMany([...mined, ...distilled]);
  }
}
