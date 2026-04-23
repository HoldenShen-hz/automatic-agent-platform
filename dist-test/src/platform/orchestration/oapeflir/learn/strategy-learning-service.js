import { FailurePatternMiner } from "./failure-pattern-miner.js";
import { LLMImprovementGenerationService } from "./llm-improvement-generation-service.js";
import { LearningObjectValidator } from "./learning-object-validator.js";
import { ExperienceDistillationService } from "./experience-distillation-service.js";
export class StrategyLearningService {
    miner = new FailurePatternMiner();
    distillation = new ExperienceDistillationService();
    llmImprovement;
    validator = new LearningObjectValidator();
    constructor(options = {}) {
        this.llmImprovement = options.llmImprovementService ?? new LLMImprovementGenerationService();
    }
    async learn(signals) {
        const mined = this.miner.mine(signals);
        const nonFailureSignals = signals.filter((signal) => signal.learningType !== "failure_pattern");
        const distilled = await this.llmImprovement.generateImprovements(nonFailureSignals);
        return this.validator.validateMany([...mined, ...distilled]);
    }
    learnSync(signals) {
        const mined = this.miner.mine(signals);
        const nonFailureSignals = signals.filter((signal) => signal.learningType !== "failure_pattern");
        const distilled = this.distillation.distill(nonFailureSignals);
        return this.validator.validateMany([...mined, ...distilled]);
    }
}
//# sourceMappingURL=strategy-learning-service.js.map