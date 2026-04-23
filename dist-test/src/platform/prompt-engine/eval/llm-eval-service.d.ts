/**
 * LLM Continuous Evaluation & Prompt Regression CI Service
 *
 * Provides:
 * - Golden task evaluation suite management
 * - Prompt regression detection across versions
 * - A/B evaluation framework with statistical comparison
 * - CI gate integration for prompt/model changes
 * - Quality scoring and auto-degradation decisions
 *
 * @see docs_zh/contracts/prompt_model_policy_governance_contract.md
 */
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
export { LLM_EVAL_DDL } from "./prompt-model-policy-governance-schema.js";
/** Status of an evaluation run */
export type EvalStatus = "pending" | "running" | "passed" | "failed" | "degraded";
/** Kind of evaluation suite */
export type EvalSuiteKind = "golden" | "regression" | "ab_test" | "smoke";
/** Quality verdict for an evaluation */
export type QualityVerdict = "pass" | "fail" | "degraded" | "inconclusive";
/** Structured output types supported by evaluation results */
export type EvalStructuredOutput = string | number | boolean | null | Record<string, unknown> | Array<unknown>;
/**
 * A defined evaluation suite containing test cases.
 */
export interface EvalSuiteRecord {
    id: string;
    name: string;
    kind: EvalSuiteKind;
    description: string;
    cases: string;
    createdAt: string;
    updatedAt: string;
}
/**
 * A single evaluation run against a suite with a specific model and prompt.
 */
export interface EvalRunRecord {
    id: string;
    suiteId: string;
    modelId: string;
    promptVersion: string;
    status: EvalStatus;
    totalCases: number;
    passedCases: number;
    failedCases: number;
    averageScore: number | null;
    verdict: QualityVerdict;
    startedAt: string;
    completedAt: string | null;
    triggeredBy: string;
    metadata: string | null;
}
/**
 * Definition of a single test case within a suite.
 */
export interface EvalCaseDefinition {
    id: string;
    input: string;
    expectedOutput: string;
    tags?: string[];
}
/**
 * Result of evaluating a single test case.
 */
export interface EvalCaseResult {
    id: string;
    runId: string;
    caseId: string;
    input: string;
    expectedOutput: string;
    actualOutput: string;
    score: number;
    passed: boolean;
    latencyMs: number;
    metadata: string | null;
}
/**
 * Configuration for an A/B test comparing two model/prompt combinations.
 */
export interface AbTestConfig {
    controlModelId: string;
    treatmentModelId: string;
    controlPromptVersion: string;
    treatmentPromptVersion: string;
    minSampleSize: number;
    significanceThreshold: number;
}
/**
 * Result of an A/B test evaluation.
 */
export interface AbTestResult {
    controlRunId: string;
    treatmentRunId: string;
    controlAvgScore: number;
    treatmentAvgScore: number;
    improvement: number;
    significant: boolean;
    verdict: QualityVerdict;
}
/**
 * Result of a CI gate evaluation determining if a release can proceed.
 */
export interface CiGateResult {
    passed: boolean;
    runId: string;
    verdict: QualityVerdict;
    regressions: string[];
    improvements: string[];
    summary: string;
}
/**
 * Evaluation result for a single test case.
 */
export interface EvalCaseEvaluation {
    actualOutput: EvalStructuredOutput;
    score: number;
    passed: boolean;
    latencyMs?: number;
    metadata?: Record<string, unknown>;
}
/**
 * Input provided to an evaluator function for a single case.
 */
export interface EvalCaseEvaluatorInput {
    suite: EvalSuiteRecord;
    caseDefinition: EvalCaseDefinition;
    modelId: string;
    promptVersion: string;
}
/**
 * Function type that evaluates a single test case.
 */
export type EvalCaseEvaluator = (input: EvalCaseEvaluatorInput) => EvalCaseEvaluation;
/**
 * Options for CI gate evaluation.
 */
export interface CiGateOptions {
    evaluator?: EvalCaseEvaluator;
    baselinePromptVersion?: string | null;
    improvementScoreThreshold?: number;
    passingVerdicts?: readonly QualityVerdict[];
}
/**
 * Service for LLM evaluation including suite management, run execution,
 * A/B testing, and CI gate evaluation for prompt/model releases.
 */
export declare class LlmEvalService {
    private readonly db;
    constructor(db: AuthoritativeSqlDatabase);
    /**
     * Defines a new evaluation suite with test cases.
     */
    defineSuite(input: {
        name: string;
        kind: EvalSuiteKind;
        description?: string;
        cases: EvalCaseDefinition[];
    }): EvalSuiteRecord;
    /**
     * Retrieves a suite by ID.
     */
    getSuite(suiteId: string): EvalSuiteRecord | null;
    /**
     * Lists all evaluation suites.
     */
    listSuites(): EvalSuiteRecord[];
    /**
     * Starts a new evaluation run for a suite with a specific model and prompt version.
     */
    startRun(suiteId: string, modelId: string, promptVersion?: string, triggeredBy?: string): EvalRunRecord;
    /**
     * Records the result of a single test case evaluation.
     */
    recordCaseResult(input: {
        runId: string;
        caseId: string;
        input: string;
        expectedOutput: string;
        actualOutput: string;
        score: number;
        passed: boolean;
        latencyMs: number;
        metadata?: Record<string, unknown>;
    }): EvalCaseResult;
    /**
     * Completes an evaluation run, computing aggregate scores and verdict.
     */
    completeRun(runId: string): EvalRunRecord | null;
    /**
     * Retrieves an evaluation run by ID.
     */
    getRun(runId: string): EvalRunRecord | null;
    /**
     * Lists evaluation runs, optionally filtered by suite.
     */
    listRuns(suiteId?: string, limit?: number): EvalRunRecord[];
    /**
     * Runs an A/B test comparing two model/prompt combinations.
     *
     * Executes the same evaluation suite against control and treatment configurations,
     * then computes statistical significance of the difference in scores.
     */
    runAbTest(suiteId: string, config: AbTestConfig): AbTestResult;
    /**
     * Runs a CI gate evaluation for a prompt/model release.
     *
     * Executes the evaluation suite and determines whether the release
     * passes the quality gate based on pass rate and regression detection.
     */
    runCiGate(suiteId: string, modelId: string, promptVersion: string, options?: CiGateOptions): CiGateResult;
    /**
     * Detects regression between two prompt versions by comparing scores.
     *
     * Compares the average score of the current version against the previous
     * version to identify if quality has degraded.
     */
    detectRegression(suiteId: string, modelId: string, currentVersion: string, previousVersion: string): {
        hasRegression: boolean;
        currentScore: number;
        previousScore: number;
        delta: number;
        regressedCases: string[];
    };
    private mapSuite;
    private mapRun;
    private parseCases;
}
