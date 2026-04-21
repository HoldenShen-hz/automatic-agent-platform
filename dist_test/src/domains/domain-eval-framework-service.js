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
import { listBlockingEvaluators, } from "./eval-framework/index.js";
export class DomainEvalFrameworkService {
    frameworks = new Map();
    qualityAxes = new Map();
    automatedChecks = new Map();
    rubrics = new Map();
    regressionDatasets = new Map();
    register(framework) {
        this.frameworks.set(framework.domainId, framework);
    }
    getFramework(domainId) {
        return this.frameworks.get(domainId) ?? null;
    }
    registerQualityAxis(domainId, axis) {
        const axes = this.qualityAxes.get(domainId) ?? [];
        const existingIndex = axes.findIndex((a) => a.axisId === axis.axisId);
        if (existingIndex >= 0) {
            axes[existingIndex] = axis;
        }
        else {
            axes.push(axis);
        }
        this.qualityAxes.set(domainId, axes);
    }
    getQualityAxes(domainId) {
        return this.qualityAxes.get(domainId) ?? [];
    }
    registerAutomatedCheck(domainId, check) {
        const checks = this.automatedChecks.get(domainId) ?? [];
        const existingIndex = checks.findIndex((c) => c.checkId === check.checkId);
        if (existingIndex >= 0) {
            checks[existingIndex] = check;
        }
        else {
            checks.push(check);
        }
        this.automatedChecks.set(domainId, checks);
    }
    getAutomatedChecks(domainId) {
        return this.automatedChecks.get(domainId) ?? [];
    }
    registerRubric(domainId, rubric) {
        const rubrics = this.rubrics.get(domainId) ?? [];
        rubrics.push(rubric);
        this.rubrics.set(domainId, rubrics);
    }
    getRubrics(domainId) {
        return this.rubrics.get(domainId) ?? [];
    }
    getLatestRubric(domainId) {
        const domainRubrics = this.rubrics.get(domainId) ?? [];
        if (domainRubrics.length === 0) {
            return null;
        }
        return [...domainRubrics].sort((a, b) => b.version.localeCompare(a.version))[0] ?? null;
    }
    registerRegressionDataset(dataset) {
        this.regressionDatasets.set(dataset.datasetId, dataset);
    }
    getRegressionDataset(datasetId) {
        return this.regressionDatasets.get(datasetId) ?? null;
    }
    getRegressionDatasetsByDomain(domainId) {
        const datasets = [];
        for (const dataset of this.regressionDatasets.values()) {
            if (dataset.domainId === domainId) {
                datasets.push(dataset);
            }
        }
        return datasets;
    }
    assessQuality(domainId, observedMetrics) {
        const framework = this.requireFramework(domainId);
        const axes = this.qualityAxes.get(domainId) ?? [];
        const axisResults = [];
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
    createRegressionDataset(domainId, name, cases) {
        const datasetId = newId("regression_dataset");
        const now = nowIso();
        const dataset = {
            datasetId,
            domainId,
            name,
            version: "1.0.0",
            cases,
            createdAt: now,
            updatedAt: now,
        };
        this.regressionDatasets.set(datasetId, dataset);
        return dataset;
    }
    addRegressionCase(datasetId, case_) {
        const dataset = this.regressionDatasets.get(datasetId);
        if (!dataset) {
            return false;
        }
        const updated = {
            ...dataset,
            cases: [...dataset.cases, case_],
            updatedAt: nowIso(),
        };
        this.regressionDatasets.set(datasetId, updated);
        return true;
    }
    removeRegressionCase(datasetId, caseId) {
        const dataset = this.regressionDatasets.get(datasetId);
        if (!dataset) {
            return false;
        }
        const index = dataset.cases.findIndex((c) => c.caseId === caseId);
        if (index === -1) {
            return false;
        }
        const updated = {
            ...dataset,
            cases: [...dataset.cases.slice(0, index), ...dataset.cases.slice(index + 1)],
            updatedAt: nowIso(),
        };
        this.regressionDatasets.set(datasetId, updated);
        return true;
    }
    evaluateAxis(axis, observedValue) {
        if (axis.criticalThreshold !== undefined) {
            return observedValue >= axis.criticalThreshold;
        }
        return observedValue >= axis.targetValue;
    }
    requireFramework(domainId) {
        const framework = this.frameworks.get(domainId);
        if (!framework) {
            throw new Error(`domain_eval.framework_not_found:${domainId}`);
        }
        return framework;
    }
}
//# sourceMappingURL=domain-eval-framework-service.js.map