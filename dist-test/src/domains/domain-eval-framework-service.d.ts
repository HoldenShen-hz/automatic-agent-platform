/**
 * Domain Eval Framework Service
 *
 * Enhanced evaluation framework handling:
 * - Quality axes definitions
 * - Automated check configurations
 * - Human evaluation rubric management
 * - Regression dataset management
 *
 * As defined in architecture doc §37.5 DomainEvalFramework.
 */
import { type DomainEvalFramework } from "./eval-framework/index.js";
export interface QualityAxis {
    readonly axisId: string;
    readonly name: string;
    readonly description: string;
    readonly weight: number;
    readonly unit: "percentage" | "count" | "boolean" | "latency" | "cost";
    readonly targetValue: number;
    readonly criticalThreshold?: number;
}
export interface AutomatedCheck {
    readonly checkId: string;
    readonly name: string;
    readonly metric: string;
    readonly threshold: number;
    readonly enabled: boolean;
    readonly executionMode: "realtime" | "batch" | "on_demand";
}
export interface HumanEvalRubric {
    readonly rubricId: string;
    readonly name: string;
    readonly version: string;
    readonly criteria: readonly {
        readonly criterionId: string;
        readonly name: string;
        readonly description: string;
        readonly scoreRange: {
            min: number;
            max: number;
        };
        readonly weight: number;
    }[];
    readonly instructions: string;
}
export interface RegressionCase {
    readonly caseId: string;
    readonly name: string;
    readonly domainId: string;
    readonly input: Record<string, unknown>;
    readonly expectedOutput: Record<string, unknown>;
    readonly expectedClass: string;
    readonly metadata: Record<string, unknown>;
}
export interface RegressionDataset {
    readonly datasetId: string;
    readonly domainId: string;
    readonly name: string;
    readonly version: string;
    readonly cases: readonly RegressionCase[];
    readonly createdAt: string;
    readonly updatedAt: string;
}
export interface QualityAssessment {
    readonly assessmentId: string;
    readonly frameworkId: string;
    readonly domainId: string;
    readonly axisResults: readonly {
        readonly axisId: string;
        readonly name: string;
        readonly observedValue: number;
        readonly targetValue: number;
        readonly passed: boolean;
        readonly delta: number;
    }[];
    readonly overallScore: number;
    readonly overallPassed: boolean;
    readonly evaluatedAt: string;
}
export declare class DomainEvalFrameworkService {
    private readonly frameworks;
    private readonly qualityAxes;
    private readonly automatedChecks;
    private readonly rubrics;
    private readonly regressionDatasets;
    register(framework: DomainEvalFramework): void;
    getFramework(domainId: string): DomainEvalFramework | null;
    registerQualityAxis(domainId: string, axis: QualityAxis): void;
    getQualityAxes(domainId: string): readonly QualityAxis[];
    registerAutomatedCheck(domainId: string, check: AutomatedCheck): void;
    getAutomatedChecks(domainId: string): readonly AutomatedCheck[];
    registerRubric(domainId: string, rubric: HumanEvalRubric): void;
    getRubrics(domainId: string): readonly HumanEvalRubric[];
    getLatestRubric(domainId: string): HumanEvalRubric | null;
    registerRegressionDataset(dataset: RegressionDataset): void;
    getRegressionDataset(datasetId: string): RegressionDataset | null;
    getRegressionDatasetsByDomain(domainId: string): readonly RegressionDataset[];
    assessQuality(domainId: string, observedMetrics: Record<string, number>): QualityAssessment;
    createRegressionDataset(domainId: string, name: string, cases: readonly RegressionCase[]): RegressionDataset;
    addRegressionCase(datasetId: string, case_: RegressionCase): boolean;
    removeRegressionCase(datasetId: string, caseId: string): boolean;
    private evaluateAxis;
    private requireFramework;
}
