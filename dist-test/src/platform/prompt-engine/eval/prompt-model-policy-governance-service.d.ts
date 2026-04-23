/**
 * Prompt, Model, and Policy Governance Service
 *
 * Manages the release lifecycle for prompts, models, and policies with CI gate evaluation.
 * Tracks releases through various stages: draft -> review_required -> approved -> canary -> active.
 * Integrates with LLM evaluation service to gate releases based on quality verdicts.
 */
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
export { PROMPT_MODEL_POLICY_GOVERNANCE_DDL } from "./prompt-model-policy-governance-schema.js";
import type { CiGateResult, EvalCaseEvaluator, LlmEvalService, QualityVerdict } from "./llm-eval-service.js";
/** Type of release being governed */
export type GovernanceReleaseType = "prompt" | "model" | "policy";
/** Status of a governance release */
export type GovernanceReleaseStatus = "draft" | "review_required" | "approved" | "canary" | "active" | "blocked" | "rolled_back";
/** Decision made by a governance gate */
export type GovernanceGateDecision = "promote" | "hold" | "rollback" | "degrade_to_fallback";
/**
 * A recorded release in the governance system.
 */
export interface GovernanceReleaseRecord {
    id: string;
    releaseType: GovernanceReleaseType;
    objectKey: string;
    version: string;
    owner: string;
    reviewRequired: boolean;
    rolloutScope: string;
    rollbackVersion: string | null;
    evaluationSuiteId: string | null;
    status: GovernanceReleaseStatus;
    metadata: string;
    createdAt: string;
    updatedAt: string;
}
/**
 * A gate evaluation event recording the decision and context.
 */
export interface GovernanceGateEventRecord {
    id: string;
    releaseId: string;
    suiteId: string | null;
    modelId: string;
    promptVersion: string;
    baselinePromptVersion: string | null;
    decision: GovernanceGateDecision;
    verdict: QualityVerdict;
    passed: boolean;
    shouldDegrade: boolean;
    recommendedFallbackKey: string | null;
    summary: string;
    createdAt: string;
    metadata: string | null;
}
/**
 * Metadata specific to prompt releases.
 */
export interface PromptReleaseMetadata {
    lintEvidence: string[];
}
/**
 * Metadata specific to model releases.
 */
export interface ModelReleaseMetadata {
    profileName: string;
    frozenModelId: string;
    fallbackProfiles: string[];
    rollbackProfileName: string | null;
    authProfileRouting: "preferred" | "sticky" | "pinned_allowed";
    sessionAffinity: boolean;
}
/**
 * Metadata specific to policy bundle releases.
 */
export interface PolicyBundleReleaseMetadata {
    changeTicket: string;
    effectiveScope: string;
    denyAllowDeltaSummary: string;
    auditEvidence: string[];
}
/**
 * Combined result of a gate evaluation including the gate result, release state, and event.
 */
export interface GovernanceGateEvaluationResult {
    gate: CiGateResult;
    release: GovernanceReleaseRecord;
    event: GovernanceGateEventRecord;
}
/**
 * Snapshot of model governance state for all active profiles.
 */
export interface ModelGovernanceSnapshot {
    profileStatuses: Record<string, "active" | "degraded" | "disabled">;
    rollbackTargets: Record<string, string | null>;
}
/**
 * Service for governing prompts, models, and policies through their release lifecycle.
 *
 * Handles registration of releases, evaluation at gates, status transitions,
 * and maintains rollback targets for degraded scenarios.
 */
export declare class PromptModelPolicyGovernanceService {
    private readonly db;
    private readonly evalService;
    constructor(db: AuthoritativeSqlDatabase, evalService: LlmEvalService);
    /**
     * Registers a new prompt release in the governance system.
     */
    registerPromptRelease(input: {
        promptKey: string;
        version: string;
        owner: string;
        reviewRequired?: boolean;
        rolloutScope?: string;
        rollbackVersion?: string | null;
        evaluationSuiteId?: string | null;
        lintEvidence?: string[];
    }): GovernanceReleaseRecord;
    /**
     * Registers a new model release in the governance system.
     */
    registerModelRelease(input: {
        profileName: string;
        version: string;
        owner: string;
        frozenModelId: string;
        fallbackProfiles?: string[];
        rollbackProfileName?: string | null;
        reviewRequired?: boolean;
        rolloutScope?: string;
        evaluationSuiteId?: string | null;
        authProfileRouting?: ModelReleaseMetadata["authProfileRouting"];
        sessionAffinity?: boolean;
    }): GovernanceReleaseRecord;
    /**
     * Registers a new policy bundle release in the governance system.
     */
    registerPolicyBundleRelease(input: {
        bundleName: string;
        version: string;
        owner: string;
        changeTicket: string;
        effectiveScope: string;
        denyAllowDeltaSummary: string;
        auditEvidence?: string[];
        reviewRequired?: boolean;
        rolloutScope?: string;
        rollbackVersion?: string | null;
        evaluationSuiteId?: string | null;
    }): GovernanceReleaseRecord;
    /**
     * Retrieves a release by ID.
     */
    getRelease(releaseId: string): GovernanceReleaseRecord | null;
    /**
     * Lists releases, optionally filtered by type.
     */
    listReleases(releaseType?: GovernanceReleaseType): GovernanceReleaseRecord[];
    /**
     * Lists gate events for a specific release.
     */
    listGateEvents(releaseId: string): GovernanceGateEventRecord[];
    /**
     * Evaluates a release at its governance gate, determining whether it can proceed.
     *
     * Runs the associated evaluation suite and makes a promotion decision
     * based on the quality verdict and regression analysis.
     */
    evaluateReleaseGate(input: {
        releaseId: string;
        modelId: string;
        promptVersion: string;
        baselinePromptVersion?: string | null;
        evaluator?: EvalCaseEvaluator;
        promoteTo?: Extract<GovernanceReleaseStatus, "canary" | "active">;
        passingVerdicts?: readonly QualityVerdict[];
        improvementScoreThreshold?: number;
    }): GovernanceGateEvaluationResult;
    /**
     * Builds a snapshot of model governance state across all profiles.
     *
     * Used by runtime to determine which models are active, degraded, or disabled
     * and what rollback targets are available.
     */
    buildModelGovernanceSnapshot(): ModelGovernanceSnapshot;
    /**
     * Inserts a new release record into the database.
     */
    private insertRelease;
    /**
     * Rolls back sibling releases when a new one becomes active.
     */
    private promoteSiblingRollbackState;
    /**
     * Retrieves a release, throwing if not found.
     */
    private requireRelease;
    /**
     * Maps a database row to a GovernanceReleaseRecord.
     */
    private mapRelease;
    /**
     * Maps a database row to a GovernanceGateEventRecord.
     */
    private mapGateEvent;
}
