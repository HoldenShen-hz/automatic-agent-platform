import { type DomainEvalFramework } from "./index.js";
export interface RegressionCaseResult {
    readonly caseId: string;
    readonly metric: string;
    readonly score: number;
    readonly expectedClass: string;
    readonly costUsd?: number;
    readonly latencyMs?: number;
    readonly approvalMatched?: boolean;
}
export interface RegressionSuiteRun {
    readonly suiteId: string;
    readonly domainId: string;
    readonly releaseType: "daily" | "pre_release" | "canary";
    readonly executionMode: "supervised" | "auto" | "full_auto";
    readonly storageMode: "sqlite" | "postgres" | "mixed";
    readonly cases: readonly RegressionCaseResult[];
}
export interface EvaluatorGateResult {
    readonly evaluatorId: string;
    readonly metric: string;
    readonly threshold: number;
    readonly observedScore: number | null;
    readonly blocking: boolean;
    readonly passed: boolean;
}
export interface ReleaseGateReport {
    readonly reportId: string;
    readonly suiteId: string;
    readonly frameworkId: string;
    readonly domainId: string;
    readonly overallPass: boolean;
    readonly releaseDecision: "promote" | "hold";
    readonly blockingFailures: readonly string[];
    readonly nonBlockingFindings: readonly string[];
    readonly evaluatorResults: readonly EvaluatorGateResult[];
    readonly coveredMetrics: readonly string[];
    readonly missingOnlineMetrics: readonly string[];
    readonly createdAt: string;
}
export declare class DomainEvaluationGateService {
    evaluateSuite(framework: DomainEvalFramework, run: RegressionSuiteRun): ReleaseGateReport;
}
