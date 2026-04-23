/**
 * Quality Gate Evidence Service
 *
 * Persists quality gate evaluation results to the artifact store as evidence.
 * Supports §17 requirement for evaluation result persistence.
 *
 * @see docs_zh/architecture/00-platform-architecture.md §17.4
 */
import type { ArtifactStore } from "../../state-evidence/artifacts/artifact-store.js";
import type { QualityGateConfig } from "./types.js";
import type { ExecutionOutcomeEvaluation } from "./execution-outcome-evaluator.js";
import type { PostExecutionQualityGateDecision } from "./post-execution-quality-gate.js";
export interface QualityGateEvidenceOptions {
    readonly artifactStore: ArtifactStore;
    readonly config: QualityGateConfig;
}
export declare class QualityGateEvidenceService {
    private readonly artifactStore;
    private readonly config;
    constructor(options: QualityGateEvidenceOptions);
    /**
     * Persists a quality gate evaluation result to the artifact store.
     *
     * @param evaluation - The execution outcome evaluation result
     * @param decision - The quality gate decision
     * @param executionId - Optional execution ID for linkage
     * @returns The artifact ID if persistence was enabled, empty string otherwise
     */
    persistEvaluation(evaluation: ExecutionOutcomeEvaluation, decision: PostExecutionQualityGateDecision, executionId?: string): string;
    /**
     * Computes the overall verdict based on evaluation and decision.
     */
    private computeVerdict;
    /**
     * Builds the evidence structure for persistence.
     */
    private buildEvidence;
}
