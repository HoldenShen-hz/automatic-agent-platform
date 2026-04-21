import { ValidationError } from "../../contracts/errors.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
export class EvalDatasetJudgeService {
    customEvaluators;
    datasets = new Map();
    judges = new Map();
    reports = new Map();
    constructor(customEvaluators = {}) {
        this.customEvaluators = customEvaluators;
    }
    registerDataset(input) {
        const datasetId = normalizeRequired(input.datasetId, "datasetId");
        if (this.datasets.has(datasetId)) {
            throw new ValidationError(`eval_dataset.duplicate:${datasetId}`, `Evaluation dataset ${datasetId} is already registered.`);
        }
        const now = nowIso();
        const cases = input.cases.map((item) => normalizeCase(item));
        ensureUniqueIds(cases.map((item) => item.caseId), "eval_dataset.case_id_duplicate", "Evaluation dataset case IDs must be unique.");
        const record = {
            datasetId,
            name: normalizeRequired(input.name, "name"),
            version: normalizeRequired(input.version, "version"),
            stage: input.stage,
            cases,
            createdBy: normalizeRequired(input.createdBy, "createdBy"),
            packId: normalizeOptional(input.packId ?? null),
            status: input.status ?? "draft",
            createdAt: now,
            updatedAt: now,
        };
        this.datasets.set(record.datasetId, record);
        return record;
    }
    activateDataset(datasetId) {
        const current = this.getDatasetOrThrow(datasetId);
        const updated = {
            ...current,
            status: "active",
            updatedAt: nowIso(),
        };
        this.datasets.set(datasetId, updated);
        return updated;
    }
    getDataset(datasetId) {
        return this.datasets.get(datasetId) ?? null;
    }
    listDatasets(status) {
        return [...this.datasets.values()].filter((item) => status == null || item.status === status);
    }
    registerJudge(input) {
        const judgeId = normalizeRequired(input.judgeId, "judgeId");
        if (this.judges.has(judgeId)) {
            throw new ValidationError(`eval_judge.duplicate:${judgeId}`, `Judge profile ${judgeId} is already registered.`);
        }
        const now = nowIso();
        const record = {
            judgeId,
            provider: normalizeRequired(input.provider, "provider"),
            providerFamily: normalizeRequired(input.providerFamily ?? input.provider, "providerFamily"),
            modelId: normalizeRequired(input.modelId, "modelId"),
            capabilities: dedupeStrings(input.capabilities ?? ["llm_judge"]),
            maxCostUsd: normalizePositiveNumber(input.maxCostUsd, "maxCostUsd"),
            status: input.status ?? "ready",
            createdAt: now,
            updatedAt: now,
        };
        this.judges.set(record.judgeId, record);
        return record;
    }
    getJudge(judgeId) {
        return this.judges.get(judgeId) ?? null;
    }
    suggestJudges(input) {
        const candidateProvider = normalizeRequired(input.candidateProvider, "candidateProvider").toLowerCase();
        const candidateFamily = normalizeRequired(input.candidateProviderFamily ?? input.candidateProvider, "candidateProviderFamily").toLowerCase();
        const capability = input.requiredCapability?.trim().toLowerCase() ?? null;
        return [...this.judges.values()]
            .filter((judge) => judge.status === "ready")
            .filter((judge) => judge.provider.toLowerCase() !== candidateProvider)
            .filter((judge) => judge.providerFamily.toLowerCase() !== candidateFamily)
            .filter((judge) => capability == null || judge.capabilities.some((item) => item.toLowerCase() === capability))
            .sort((left, right) => left.maxCostUsd - right.maxCostUsd);
    }
    evaluateDataset(input) {
        const dataset = this.getDatasetOrThrow(input.datasetId);
        if (dataset.status !== "active") {
            throw new ValidationError(`eval_dataset.inactive:${dataset.datasetId}`, `Evaluation dataset ${dataset.datasetId} must be active before use.`);
        }
        const requiresJudge = dataset.cases.some((item) => item.qualityCriteria.some((criterion) => criterion.type === "llm_judge"));
        const selectedJudge = requiresJudge
            ? this.resolveJudge({
                judgeId: input.judgeId ?? null,
                candidateProvider: input.candidateProvider,
                candidateProviderFamily: input.candidateProviderFamily,
            })
            : null;
        const submissions = new Map(input.results.map((item) => [item.caseId, item]));
        const caseResults = [];
        const blockingFindings = [];
        const advisoryFindings = [];
        for (const testCase of dataset.cases) {
            const submission = submissions.get(testCase.caseId);
            if (submission == null) {
                blockingFindings.push(`missing_case_result:${testCase.caseId}`);
                caseResults.push({
                    caseId: testCase.caseId,
                    passed: false,
                    weightedQualityScore: 0,
                    priority: testCase.priority,
                    latencyMs: 0,
                    costUsd: 0,
                    criterionResults: [],
                });
                continue;
            }
            const criterionSignals = submission.criterionSignals ?? {};
            const metadata = submission.metadata ?? {};
            const criterionResults = testCase.qualityCriteria.map((criterion) => this.evaluateCriterion({
                criterion,
                expectedOutput: testCase.expectedOutput,
                output: submission.output,
                criterionSignals,
                metadata,
                judgeId: selectedJudge?.judgeId ?? null,
            }));
            const weightedQualityScore = computeWeightedAverage(criterionResults.map((item) => ({ score: item.score, weight: item.weight })));
            const passed = criterionResults.every((item) => item.passed);
            if (!passed) {
                advisoryFindings.push(`case_failed:${testCase.caseId}`);
            }
            caseResults.push({
                caseId: testCase.caseId,
                passed,
                weightedQualityScore,
                priority: testCase.priority,
                latencyMs: roundMetric(submission.latencyMs ?? 0),
                costUsd: roundMetric(submission.costUsd ?? 0),
                criterionResults,
            });
        }
        const passRate = computeRate(caseResults.filter((item) => item.passed).length, dataset.cases.length);
        const criticalCases = caseResults.filter((item) => item.priority === "critical");
        const criticalPassRate = criticalCases.length === 0
            ? 1
            : computeRate(criticalCases.filter((item) => item.passed).length, criticalCases.length);
        const averageLatencyMs = average(caseResults.map((item) => item.latencyMs));
        const averageCostUsd = average(caseResults.map((item) => item.costUsd));
        const weightedQualityScore = average(caseResults.map((item) => item.weightedQualityScore));
        const policy = {
            minPassRate: input.gatePolicy?.minPassRate ?? 0.95,
            requireCriticalPass: input.gatePolicy?.requireCriticalPass ?? true,
            maxLatencyRegressionRatio: input.gatePolicy?.maxLatencyRegressionRatio ?? 1.2,
            maxCostRegressionRatio: input.gatePolicy?.maxCostRegressionRatio ?? 1.5,
            minQualityDelta: input.gatePolicy?.minQualityDelta ?? -0.05,
        };
        if (passRate < policy.minPassRate) {
            blockingFindings.push(`pass_rate_below_threshold:${passRate}`);
        }
        if (policy.requireCriticalPass && criticalPassRate < 1) {
            blockingFindings.push(`critical_case_failed:${criticalPassRate}`);
        }
        if (input.baseline?.averageLatencyMs != null && input.baseline.averageLatencyMs > 0) {
            const ratio = averageLatencyMs / input.baseline.averageLatencyMs;
            if (ratio > policy.maxLatencyRegressionRatio) {
                blockingFindings.push(`latency_regressed:${roundMetric(ratio)}`);
            }
        }
        if (input.baseline?.averageCostUsd != null && input.baseline.averageCostUsd > 0) {
            const ratio = averageCostUsd / input.baseline.averageCostUsd;
            if (ratio > policy.maxCostRegressionRatio) {
                blockingFindings.push(`cost_regressed:${roundMetric(ratio)}`);
            }
        }
        if (input.baseline?.weightedQualityScore != null) {
            const delta = roundMetric(weightedQualityScore - input.baseline.weightedQualityScore);
            if (delta < policy.minQualityDelta) {
                blockingFindings.push(`quality_score_regressed:${delta}`);
            }
        }
        if (selectedJudge != null) {
            advisoryFindings.push(`judge_assigned:${selectedJudge.judgeId}`);
        }
        const phase = input.phase ?? "offline";
        const report = {
            runId: newId("eval_dataset_run"),
            datasetId: dataset.datasetId,
            candidateProvider: normalizeRequired(input.candidateProvider, "candidateProvider"),
            candidateModel: normalizeRequired(input.candidateModel, "candidateModel"),
            judgeId: selectedJudge?.judgeId ?? null,
            phase,
            gateDecision: blockingFindings.length === 0 ? "promote" : phase === "canary" ? "rollback" : "hold",
            passRate,
            criticalPassRate,
            averageLatencyMs,
            averageCostUsd,
            weightedQualityScore,
            blockingFindings,
            advisoryFindings,
            caseResults,
            createdAt: nowIso(),
        };
        this.reports.set(report.runId, report);
        return report;
    }
    listReports(datasetId) {
        return [...this.reports.values()].filter((item) => datasetId == null || item.datasetId === datasetId);
    }
    resolveJudge(input) {
        const judge = input.judgeId == null
            ? this.suggestJudges({
                candidateProvider: input.candidateProvider,
                candidateProviderFamily: input.candidateProviderFamily,
                requiredCapability: "llm_judge",
            })[0] ?? null
            : this.getJudge(input.judgeId);
        if (judge == null) {
            throw new ValidationError("eval_judge.not_available", "No compatible judge profile is available for llm_judge criteria.");
        }
        if (judge.status !== "ready") {
            throw new ValidationError(`eval_judge.unavailable:${judge.judgeId}`, `Judge profile ${judge.judgeId} is not available.`);
        }
        const candidateProvider = normalizeRequired(input.candidateProvider, "candidateProvider").toLowerCase();
        const candidateFamily = normalizeRequired(input.candidateProviderFamily ?? input.candidateProvider, "candidateProviderFamily").toLowerCase();
        if (judge.provider.toLowerCase() === candidateProvider || judge.providerFamily.toLowerCase() === candidateFamily) {
            throw new ValidationError(`eval_judge.provider_conflict:${judge.judgeId}`, "Judge LLM must use a different provider family from the evaluated candidate.");
        }
        return judge;
    }
    getDatasetOrThrow(datasetId) {
        const dataset = this.getDataset(datasetId);
        if (dataset == null) {
            throw new ValidationError(`eval_dataset.not_found:${datasetId}`, `Evaluation dataset ${datasetId} was not found.`);
        }
        return dataset;
    }
    evaluateCriterion(input) {
        const { criterion } = input;
        let score = 0;
        let reason = "criterion_failed";
        switch (criterion.type) {
            case "exact_match": {
                const matched = stableStringify(input.expectedOutput) === stableStringify(input.output);
                score = matched ? 1 : 0;
                reason = matched ? "exact_match_passed" : "exact_match_failed";
                break;
            }
            case "contains": {
                const needle = normalizeRequired(String(criterion.config.substring ?? criterion.config.needle ?? input.expectedOutput ?? ""), "substring");
                const haystack = stringifyText(input.output);
                const matched = haystack.includes(needle);
                score = matched ? 1 : 0;
                reason = matched ? "contains_passed" : "contains_failed";
                break;
            }
            case "json_schema": {
                const requiredKeys = Array.isArray(criterion.config.requiredKeys)
                    ? criterion.config.requiredKeys.filter((item) => typeof item === "string")
                    : [];
                const output = input.output;
                const matched = isRecord(output) && requiredKeys.every((key) => key in output);
                score = matched ? 1 : 0;
                reason = matched ? "json_schema_passed" : "json_schema_failed";
                break;
            }
            case "semantic_similarity":
            case "llm_judge": {
                if (criterion.type === "llm_judge" && input.judgeId == null) {
                    throw new ValidationError(`eval_judge.required:${criterion.criterionId}`, `Criterion ${criterion.criterionId} requires an assigned judge profile.`);
                }
                score = roundMetric(input.criterionSignals[criterion.criterionId] ?? 0);
                reason = score >= criterion.threshold ? `${criterion.type}_passed` : `${criterion.type}_failed`;
                break;
            }
            case "custom_function": {
                const functionId = normalizeRequired(String(criterion.config.functionId ?? criterion.criterionId), "functionId");
                const evaluator = this.customEvaluators[functionId];
                if (evaluator == null) {
                    throw new ValidationError(`eval_dataset.custom_evaluator_missing:${functionId}`, `Custom evaluator ${functionId} is not registered.`);
                }
                const result = evaluator({
                    criterion,
                    expectedOutput: input.expectedOutput,
                    output: input.output,
                    criterionSignals: input.criterionSignals,
                    metadata: input.metadata,
                });
                score = roundMetric(result.score);
                reason = result.reason?.trim() || (score >= criterion.threshold ? "custom_function_passed" : "custom_function_failed");
                return {
                    criterionId: criterion.criterionId,
                    type: criterion.type,
                    score,
                    passed: result.passed ?? score >= criterion.threshold,
                    weight: criterion.weight,
                    threshold: criterion.threshold,
                    reason,
                };
            }
        }
        return {
            criterionId: criterion.criterionId,
            type: criterion.type,
            score,
            passed: score >= criterion.threshold,
            weight: criterion.weight,
            threshold: criterion.threshold,
            reason,
        };
    }
}
function normalizeCase(input) {
    const qualityCriteria = input.qualityCriteria.map((criterion) => ({
        criterionId: normalizeRequired(criterion.criterionId, "criterionId"),
        type: criterion.type,
        config: criterion.config ?? {},
        weight: normalizePositiveNumber(criterion.weight, "weight"),
        threshold: normalizeThreshold(criterion.threshold, "threshold"),
    }));
    ensureUniqueIds(qualityCriteria.map((item) => item.criterionId), "eval_dataset.criterion_id_duplicate", "Evaluation case criterion IDs must be unique.");
    if (qualityCriteria.length === 0) {
        throw new ValidationError("eval_dataset.case_without_criteria", "Every evaluation case must define at least one quality criterion.");
    }
    return {
        caseId: normalizeRequired(input.caseId, "caseId"),
        input: input.input ?? {},
        expectedOutput: input.expectedOutput,
        qualityCriteria,
        tags: dedupeStrings(input.tags),
        priority: input.priority,
    };
}
function ensureUniqueIds(values, code, message) {
    const seen = new Set();
    for (const value of values) {
        if (seen.has(value)) {
            throw new ValidationError(code, message);
        }
        seen.add(value);
    }
}
function computeRate(passed, total) {
    if (total <= 0) {
        return 0;
    }
    return roundMetric(passed / total);
}
function computeWeightedAverage(values) {
    const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);
    if (totalWeight <= 0) {
        return 0;
    }
    return roundMetric(values.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight);
}
function average(values) {
    if (values.length === 0) {
        return 0;
    }
    return roundMetric(values.reduce((sum, value) => sum + value, 0) / values.length);
}
function stableStringify(value) {
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(",")}]`;
    }
    if (isRecord(value)) {
        const keys = Object.keys(value).sort();
        return `{${keys.map((key) => `${key}:${stableStringify(value[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
}
function stringifyText(value) {
    if (typeof value === "string") {
        return value;
    }
    return stableStringify(value);
}
function normalizeRequired(value, field) {
    const normalized = value.trim();
    if (normalized.length === 0) {
        throw new ValidationError(`eval_dataset.invalid_${field}`, `Field ${field} must be a non-empty string.`);
    }
    return normalized;
}
function normalizeOptional(value) {
    if (value == null) {
        return null;
    }
    const normalized = value.trim();
    return normalized.length === 0 ? null : normalized;
}
function normalizePositiveNumber(value, field) {
    if (!Number.isFinite(value) || value <= 0) {
        throw new ValidationError(`eval_dataset.invalid_${field}`, `Field ${field} must be a positive number.`);
    }
    return roundMetric(value);
}
function normalizeThreshold(value, field) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new ValidationError(`eval_dataset.invalid_${field}`, `Field ${field} must be between 0 and 1.`);
    }
    return roundMetric(value);
}
function roundMetric(value) {
    return Number(value.toFixed(4));
}
function dedupeStrings(values) {
    return [...new Set(values.map((item) => item.trim()).filter((item) => item.length > 0))];
}
function isRecord(value) {
    return value != null && typeof value === "object" && !Array.isArray(value);
}
//# sourceMappingURL=eval-dataset-judge-service.js.map