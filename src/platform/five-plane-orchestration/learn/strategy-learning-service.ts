import type { LearningSignal } from "../../../scale-ecosystem/feedback-loop/collector/feedback-model.js";
import type { LearningObject } from "./learning-object-model.js";
import { FailurePatternMiner } from "./failure-pattern-miner.js";
import { LLMImprovementGenerationService } from "./llm-improvement-generation-service.js";
import { LearningObjectValidator } from "./learning-object-validator.js";
import { ExperienceDistillationService } from "./experience-distillation-service.js";
import type { EvidenceStore } from "../../../ops-maturity/drift-detection/evidence-store.js";

export interface StrategyLearningServiceOptions {
  llmImprovementService?: LLMImprovementGenerationService;
  /** §56: Shared evidence store for unified learning pipeline - connects to EvolutionIntegrationService */
  evidenceStore?: EvidenceStore;
}

export class StrategyLearningService {
  private readonly miner = new FailurePatternMiner();
  private readonly distillation = new ExperienceDistillationService();
  private readonly llmImprovement: LLMImprovementGenerationService;
  private readonly validator = new LearningObjectValidator();
  private readonly evidenceStore: EvidenceStore | undefined;

  public constructor(options: StrategyLearningServiceOptions = {}) {
    this.llmImprovement = options.llmImprovementService ?? new LLMImprovementGenerationService();
    this.evidenceStore = options.evidenceStore;
  }

  public async learn(signals: readonly LearningSignal[]): Promise<LearningObject[]> {
    const normalizedSignals = signals.map((signal) => this.normalizeSignal(signal));
    // §56: Record evidence to shared store for unified pipeline correlation
    await this.recordEvidence(normalizedSignals);
    const mined = this.miner.mine(normalizedSignals);
    const nonFailureSignals = normalizedSignals.filter((signal) => signal.learningType !== "failure_pattern");
    const distilled = await this.llmImprovement.generateImprovements(nonFailureSignals);
    return this.validator.validateMany([...mined, ...distilled]);
  }

  public learnSync(signals: readonly LearningSignal[]): LearningObject[] {
    const normalizedSignals = signals.map((signal) => this.normalizeSignal(signal));
    // §56: Record evidence to shared store for unified pipeline correlation
    this.recordEvidenceSync(normalizedSignals);
    const mined = this.miner.mine(normalizedSignals);
    const nonFailureSignals = normalizedSignals.filter((signal) => signal.learningType !== "failure_pattern");
    const distilled = this.distillation.distill(nonFailureSignals);
    return this.validator.validateMany([...mined, ...distilled]);
  }

  /** §56: Record signals as evidence to shared store - enables success+failure correlation */
  private async recordEvidence(signals: readonly LearningSignal[]): Promise<void> {
    if (!this.evidenceStore) return;
    for (const signal of signals) {
      const evidence = this.signalToEvidence(signal);
      await this.evidenceStore.append(evidence);
    }
  }

  /** §56: Sync version for recordEvidence */
  private recordEvidenceSync(signals: readonly LearningSignal[]): void {
    if (!this.evidenceStore) return;
    for (const signal of signals) {
      const evidence = this.signalToEvidence(signal);
      this.evidenceStore.append(evidence); // Fire and forget for sync path
    }
  }

  /** §56: Convert LearningSignal to EvidenceRecord for unified pipeline */
  private signalToEvidence(signal: LearningSignal) {
    const evidence = signal.evidence as Record<string, unknown>;
    const taskType = readString(evidence.taskType) ?? "general";
    const costUsd = readNumber(evidence.costUsd) ?? 0;
    const latencyMs = readNumber(evidence.latencyMs) ?? 0;
    const toolCalls = readNumber(evidence.toolCalls) ?? 0;
    const repairRounds = readNumber(evidence.repairRounds) ?? 0;
    const failureMode = signal.learningType === "failure_pattern"
      ? readString(evidence.failureMode) ?? signal.valueSummary
      : undefined;

    return {
      id: `ev_from_signal_${signal.learningSignalId}`,
      taskType,
      sessionId: signal.sourceFeedbackId,
      traceId: signal.learningSignalId,
      success: signal.learningType !== "failure_pattern",
      ...(failureMode !== undefined ? { failureMode } : {}),
      ...(signal.learningType === "failure_pattern" ? { failureCategory: "complex_repair_failure" as const } : {}),
      costUsd,
      latencyMs,
      toolCalls,
      repairRounds,
      rollback: false,
      createdAt: new Date().toISOString(),
      metadata: {
        learningType: signal.learningType,
        confidence: signal.confidence,
        valueSummary: signal.valueSummary,
        sourceSignalIds: signal.sourceSignalIds,
        relatedSignalIds: signal.relatedSignalIds,
      },
    };
  }

  private normalizeSignal(signal: LearningSignal): LearningSignal {
    const evidenceRefs = signal.evidenceRefs.length > 0
      ? signal.evidenceRefs
      : [signal.sourceFeedbackId, signal.learningSignalId];
    const sourceSignalIds = signal.sourceSignalIds.length > 0
      ? signal.sourceSignalIds
      : [signal.learningSignalId];

    return {
      ...signal,
      evidenceRefs: [...new Set(evidenceRefs)],
      sourceSignalIds: [...new Set(sourceSignalIds)],
    };
  }
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
