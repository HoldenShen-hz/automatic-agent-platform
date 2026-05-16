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

import { newId, nowIso } from "../platform/contracts/types/ids.js";
import {
  type DomainEvalFramework,
  type DomainEvaluator,
  listBlockingEvaluators,
} from "./eval-framework/index.js";

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
    readonly scoreRange: { min: number; max: number };
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

export interface DomainEvalFrameworkServiceOptions {
  readonly maxDomains?: number;
  readonly maxRegressionDatasets?: number;
  readonly maxAxesPerDomain?: number;
  readonly maxChecksPerDomain?: number;
  readonly maxRubricsPerDomain?: number;
}

export class DomainEvalFrameworkService {
  private readonly frameworks = new Map<string, DomainEvalFramework>();
  private readonly qualityAxes = new Map<string, QualityAxis[]>();
  private readonly automatedChecks = new Map<string, AutomatedCheck[]>();
  private readonly rubrics = new Map<string, HumanEvalRubric[]>();
  private readonly regressionDatasets = new Map<string, RegressionDataset>();
  private readonly domainAccessOrder = new Map<string, number>();
  private readonly maxDomains: number;
  private readonly maxRegressionDatasets: number;
  private readonly maxAxesPerDomain: number;
  private readonly maxChecksPerDomain: number;
  private readonly maxRubricsPerDomain: number;

  public constructor(options: DomainEvalFrameworkServiceOptions = {}) {
    this.maxDomains = Math.max(1, Math.trunc(options.maxDomains ?? 256));
    this.maxRegressionDatasets = Math.max(1, Math.trunc(options.maxRegressionDatasets ?? 512));
    this.maxAxesPerDomain = Math.max(1, Math.trunc(options.maxAxesPerDomain ?? 64));
    this.maxChecksPerDomain = Math.max(1, Math.trunc(options.maxChecksPerDomain ?? 64));
    this.maxRubricsPerDomain = Math.max(1, Math.trunc(options.maxRubricsPerDomain ?? 32));
  }

  public register(framework: DomainEvalFramework): void {
    this.frameworks.delete(framework.domainId);
    this.frameworks.set(framework.domainId, framework);
    this.touchDomain(framework.domainId);
    this.evictOldestDomainIfNeeded();
  }

  public getFramework(domainId: string): DomainEvalFramework | null {
    return this.frameworks.get(domainId) ?? null;
  }

  public registerQualityAxis(domainId: string, axis: QualityAxis): void {
    const axes = this.qualityAxes.get(domainId) ?? [];
    const existingIndex = axes.findIndex((a) => a.axisId === axis.axisId);

    if (existingIndex >= 0) {
      axes[existingIndex] = axis;
    } else {
      axes.push(axis);
    }

    this.qualityAxes.set(domainId, axes.slice(-this.maxAxesPerDomain));
    this.touchDomain(domainId);
    this.evictOldestDomainIfNeeded();
  }

  public getQualityAxes(domainId: string): readonly QualityAxis[] {
    return this.qualityAxes.get(domainId) ?? [];
  }

  public registerAutomatedCheck(domainId: string, check: AutomatedCheck): void {
    const checks = this.automatedChecks.get(domainId) ?? [];
    const existingIndex = checks.findIndex((c) => c.checkId === check.checkId);

    if (existingIndex >= 0) {
      checks[existingIndex] = check;
    } else {
      checks.push(check);
    }

    this.automatedChecks.set(domainId, checks.slice(-this.maxChecksPerDomain));
    this.touchDomain(domainId);
    this.evictOldestDomainIfNeeded();
  }

  public getAutomatedChecks(domainId: string): readonly AutomatedCheck[] {
    return this.automatedChecks.get(domainId) ?? [];
  }

  public registerRubric(domainId: string, rubric: HumanEvalRubric): void {
    const rubrics = this.rubrics.get(domainId) ?? [];
    rubrics.push(rubric);
    this.rubrics.set(domainId, rubrics.slice(-this.maxRubricsPerDomain));
    this.touchDomain(domainId);
    this.evictOldestDomainIfNeeded();
  }

  public getRubrics(domainId: string): readonly HumanEvalRubric[] {
    return this.rubrics.get(domainId) ?? [];
  }

  public getLatestRubric(domainId: string): HumanEvalRubric | null {
    const domainRubrics = this.rubrics.get(domainId) ?? [];
    if (domainRubrics.length === 0) {
      return null;
    }
    return [...domainRubrics].sort((a, b) => b.version.localeCompare(a.version))[0] ?? null;
  }

  public registerRegressionDataset(dataset: RegressionDataset): void {
    this.regressionDatasets.delete(dataset.datasetId);
    this.regressionDatasets.set(dataset.datasetId, dataset);
    this.touchDomain(dataset.domainId);
    this.evictOldestRegressionDatasetIfNeeded();
    this.evictOldestDomainIfNeeded();
  }

  public getRegressionDataset(datasetId: string): RegressionDataset | null {
    return this.regressionDatasets.get(datasetId) ?? null;
  }

  public getRegressionDatasetsByDomain(domainId: string): readonly RegressionDataset[] {
    const datasets: RegressionDataset[] = [];
    for (const dataset of this.regressionDatasets.values()) {
      if (dataset.domainId === domainId) {
        datasets.push(dataset);
      }
    }
    return datasets;
  }

  public assessQuality(
    domainId: string,
    observedMetrics: Record<string, number>,
  ): QualityAssessment {
    const framework = this.requireFramework(domainId);
    const axes = this.qualityAxes.get(domainId) ?? [];
    const axisResults: {
      readonly axisId: string;
      readonly name: string;
      readonly observedValue: number;
      readonly targetValue: number;
      readonly passed: boolean;
      readonly delta: number;
    }[] = [];

    let totalWeight = 0;
    let weightedScore = 0;

    for (const axis of axes) {
      const observedValue = observedMetrics[axis.name] ?? 0;
      const passed = this.evaluateAxis(axis, observedValue);
      const delta = observedValue - axis.targetValue;

      axisResults.push({
        axisId: axis.axisId,
        name: axis.name,
        observedValue,
        targetValue: axis.targetValue,
        passed,
        delta,
      });

      totalWeight += axis.weight;
      weightedScore += passed ? axis.weight * 100 : 0;
    }

    for (const evaluator of framework.evaluators) {
      const observedValue = observedMetrics[evaluator.metric] ?? 0;
      const passed = observedValue >= evaluator.threshold;

      axisResults.push({
        axisId: evaluator.evaluatorId,
        name: evaluator.metric,
        observedValue,
        targetValue: evaluator.threshold,
        passed,
        delta: observedValue - evaluator.threshold,
      });

      totalWeight += 1;
      weightedScore += passed ? 100 : 0;
    }

    const overallScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
    const blockingEvaluators = listBlockingEvaluators(framework);
    const overallPassed = blockingEvaluators.every((evaluator) => {
      const metricValue = observedMetrics[evaluator.metric] ?? 0;
      return metricValue >= evaluator.threshold;
    });

    return {
      assessmentId: newId("quality_assessment"),
      frameworkId: framework.frameworkId,
      domainId,
      axisResults,
      overallScore: Math.round(overallScore * 100) / 100,
      overallPassed,
      evaluatedAt: nowIso(),
    };
  }

  public createRegressionDataset(
    domainId: string,
    name: string,
    cases: readonly RegressionCase[],
  ): RegressionDataset {
    const datasetId = newId("regression_dataset");
    const now = nowIso();

    const dataset: RegressionDataset = {
      datasetId,
      domainId,
      name,
      version: "1.0.0",
      cases,
      createdAt: now,
      updatedAt: now,
    };

    this.regressionDatasets.set(datasetId, dataset);
    this.touchDomain(domainId);
    this.evictOldestRegressionDatasetIfNeeded();
    this.evictOldestDomainIfNeeded();
    return dataset;
  }

  public addRegressionCase(datasetId: string, case_: RegressionCase): boolean {
    const dataset = this.regressionDatasets.get(datasetId);
    if (!dataset) {
      return false;
    }

    const updated: RegressionDataset = {
      ...dataset,
      cases: [...dataset.cases, case_],
      updatedAt: nowIso(),
    };
    this.regressionDatasets.set(datasetId, updated);
    this.touchDomain(dataset.domainId);
    return true;
  }

  public removeRegressionCase(datasetId: string, caseId: string): boolean {
    const dataset = this.regressionDatasets.get(datasetId);
    if (!dataset) {
      return false;
    }

    const index = dataset.cases.findIndex((c) => c.caseId === caseId);
    if (index === -1) {
      return false;
    }

    const updated: RegressionDataset = {
      ...dataset,
      cases: [...dataset.cases.slice(0, index), ...dataset.cases.slice(index + 1)],
      updatedAt: nowIso(),
    };
    this.regressionDatasets.set(datasetId, updated);
    this.touchDomain(dataset.domainId);
    return true;
  }

  private touchDomain(domainId: string): void {
    this.domainAccessOrder.delete(domainId);
    this.domainAccessOrder.set(domainId, Date.now());
  }

  private evictOldestDomainIfNeeded(): void {
    while (this.domainAccessOrder.size > this.maxDomains) {
      const oldestDomainId = this.domainAccessOrder.keys().next().value;
      if (oldestDomainId === undefined) {
        return;
      }
      this.domainAccessOrder.delete(oldestDomainId);
      this.frameworks.delete(oldestDomainId);
      this.qualityAxes.delete(oldestDomainId);
      this.automatedChecks.delete(oldestDomainId);
      this.rubrics.delete(oldestDomainId);
      for (const [datasetId, dataset] of this.regressionDatasets.entries()) {
        if (dataset.domainId === oldestDomainId) {
          this.regressionDatasets.delete(datasetId);
        }
      }
    }
  }

  private evictOldestRegressionDatasetIfNeeded(): void {
    while (this.regressionDatasets.size > this.maxRegressionDatasets) {
      const oldestDatasetId = this.regressionDatasets.keys().next().value;
      if (oldestDatasetId === undefined) {
        return;
      }
      this.regressionDatasets.delete(oldestDatasetId);
    }
  }

  private evaluateAxis(axis: QualityAxis, observedValue: number): boolean {
    if (axis.criticalThreshold !== undefined) {
      return observedValue >= axis.criticalThreshold;
    }
    return observedValue >= axis.targetValue;
  }

  private requireFramework(domainId: string): DomainEvalFramework {
    const framework = this.frameworks.get(domainId);
    if (!framework) {
      throw new Error(`domain_eval.framework_not_found:${domainId}`);
    }
    return framework;
  }
}
