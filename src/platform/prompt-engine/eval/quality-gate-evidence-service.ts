/**
 * Quality Gate Evidence Service
 *
 * Persists quality gate evaluation results to the artifact store as evidence.
 * Supports §17 requirement for evaluation result persistence.
 *
 * @see docs_zh/architecture/00-platform-architecture.md §17.4
 */

import type { ArtifactStore, ArtifactWriteInput } from "../../state-evidence/artifacts/artifact-store.js";
import type { QualityGateConfig, QualityEvaluationEvidence } from "./types.js";
import type { ExecutionOutcomeEvaluation } from "./execution-outcome-evaluator.js";
import type { PostExecutionQualityGateDecision } from "./post-execution-quality-gate.js";
import { newId, nowIso } from "../../contracts/types/ids.js";

export interface QualityGateEvidenceOptions {
  readonly artifactStore: ArtifactStore;
  readonly config: QualityGateConfig;
}

export class QualityGateEvidenceService {
  private readonly artifactStore: ArtifactStore;
  private readonly config: QualityGateConfig;

  public constructor(options: QualityGateEvidenceOptions) {
    this.artifactStore = options.artifactStore;
    this.config = options.config;
  }

  /**
   * Persists a quality gate evaluation result to the artifact store.
   *
   * @param evaluation - The execution outcome evaluation result
   * @param decision - The quality gate decision
   * @param executionId - Optional execution ID for linkage
   * @returns The artifact ID if persistence was enabled, empty string otherwise
   */
  public persistEvaluation(
    evaluation: ExecutionOutcomeEvaluation,
    decision: PostExecutionQualityGateDecision,
    executionId?: string,
  ): string {
    if (!this.config.evidence.enabled) {
      return "";
    }

    const verdict = this.computeVerdict(evaluation, decision);
    const evidence = this.buildEvidence(evaluation, decision, verdict, executionId);

    const artifactInput: ArtifactWriteInput = {
      taskId: evaluation.taskId,
      executionId: executionId ?? null,
      stepId: null,
      kind: this.config.evidence.artifactKind,
      fileName: `quality-evaluation-${evaluation.evaluationId}.json`,
      mimeType: "application/json",
      content: JSON.stringify(evidence, null, 2),
      lineage: {
        evaluationId: evaluation.evaluationId,
        taskId: evaluation.taskId,
        executionId: executionId ?? null,
        verdict,
      },
    };

    const result = this.artifactStore.writeTextArtifact(artifactInput);
    return result.record.artifactId;
  }

  /**
   * Computes the overall verdict based on evaluation and decision.
   */
  private computeVerdict(
    evaluation: ExecutionOutcomeEvaluation,
    decision: PostExecutionQualityGateDecision,
  ): QualityEvaluationEvidence["verdict"] {
    if (!evaluation.passed && decision.releaseStage === "blocked") {
      return "fail";
    }
    if (!evaluation.passed && decision.releaseStage === "approval") {
      return "degraded";
    }
    if (evaluation.passed && evaluation.qualityScore >= this.config.qualityGate.criticalPassThreshold) {
      return "pass";
    }
    if (evaluation.passed) {
      return "degraded";
    }
    return "inconclusive";
  }

  /**
   * Builds the evidence structure for persistence.
   */
  private buildEvidence(
    evaluation: ExecutionOutcomeEvaluation,
    decision: PostExecutionQualityGateDecision,
    verdict: QualityEvaluationEvidence["verdict"],
    executionId?: string,
  ): QualityEvaluationEvidence {
    return {
      evaluationId: evaluation.evaluationId,
      taskId: evaluation.taskId,
      ...(executionId !== undefined && { executionId }),
      qualityScore: evaluation.qualityScore,
      passed: evaluation.passed,
      verdict,
      releaseStage: decision.releaseStage,
      reasonCodes: [...evaluation.reasons, ...decision.reasonCodes],
      factorBreakdown: evaluation.factorBreakdown,
      evaluatedAt: nowIso(),
      configSnapshot: {
        passThreshold: this.config.qualityGate.defaultPassThreshold,
        weights: this.config.qualityScoreWeights,
      },
    };
  }
}
