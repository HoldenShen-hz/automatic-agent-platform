/**
 * Fine-tuning Dataset Exporter
 *
 * Exports high-quality feedback signals as JSONL datasets
 * suitable for model fine-tuning pipelines.
 */
import { nowIso } from "../../platform/contracts/types/ids.js";
function extractInputOutput(signal) {
    const payload = signal.payload;
    const input = typeof payload["input"] === "string"
        ? payload["input"]
        : typeof payload["taskDescription"] === "string"
            ? payload["taskDescription"]
            : signal.taskId;
    const output = typeof payload["output"] === "string"
        ? payload["output"]
        : typeof payload["summary"] === "string"
            ? payload["summary"]
            : typeof payload["reasonCode"] === "string"
                ? payload["reasonCode"]
                : "";
    return { input, output };
}
function signalToExport(signal, feedbackType) {
    const { input, output } = extractInputOutput(signal);
    if (!input && !output) {
        return null;
    }
    return {
        taskId: signal.taskId,
        input,
        output,
        feedbackType,
        confidence: 0.8,
        signalIds: [signal.signalId],
        source: signal.source,
        category: signal.category,
        severity: signal.severity,
        reasonCode: typeof signal.payload["reasonCode"] === "string" ? signal.payload["reasonCode"] : null,
        stepRefs: [...signal.stepOutputRefs],
        timestamp: signal.timestamp,
    };
}
function learningSignalToExport(signal) {
    const evidence = signal.evidence;
    const rawCategory = typeof evidence["category"] === "string" ? evidence["category"] : signal.learningType;
    const category = rawCategory === "failure" ? "failure"
        : rawCategory === "correction" ? "correction"
            : rawCategory === "timeout" ? "timeout"
                : rawCategory === "partial" ? "partial"
                    : signal.learningType === "failure_pattern" ? "failure"
                        : signal.learningType === "user_correction" ? "correction"
                            : "partial";
    return {
        taskId: signal.taskId,
        input: signal.valueSummary,
        output: signal.learningType,
        feedbackType: signal.learningType,
        confidence: signal.confidence,
        signalIds: [...signal.sourceSignalIds],
        source: evidence["source"] ?? "execution",
        category,
        severity: "error",
        reasonCode: signal.learningType,
        stepRefs: [...signal.evidenceRefs],
        timestamp: signal.generatedAt,
    };
}
function toFineTuningExample(exportItem, id) {
    return {
        id,
        taskId: exportItem.taskId,
        input: exportItem.input,
        output: exportItem.output,
        feedbackType: exportItem.feedbackType,
        confidence: exportItem.confidence,
        sourceSignals: exportItem.signalIds,
        metadata: {
            source: exportItem.source,
            category: exportItem.category,
            severity: exportItem.severity,
            reasonCode: exportItem.reasonCode,
            stepRefs: exportItem.stepRefs,
            timestamp: exportItem.timestamp,
        },
    };
}
function gradeToMinScore(grade) {
    switch (grade) {
        case "high":
            return 0.8;
        case "medium":
            return 0.6;
        case "low":
            return 0.5;
    }
}
export class FineTuningExporter {
    idCounter = 0;
    exportFromSignals(signals, grader, options = {}) {
        const grade = grader.gradeSignals(signals);
        const minScore = gradeToMinScore(options.minQualityGrade ?? "medium");
        const exports = [];
        for (const signal of signals) {
            if (grade.score.overall < minScore)
                continue;
            const feedbackType = signal.category;
            const exportItem = signalToExport(signal, feedbackType);
            if (exportItem) {
                exports.push(exportItem);
            }
        }
        return this.buildDataset(exports, options.maxExamples);
    }
    exportFromLearningSignals(learningSignals, grader, options = {}) {
        const grade = grader.gradeLearningSignals(learningSignals);
        const minScore = gradeToMinScore(options.minQualityGrade ?? "medium");
        const exports = [];
        for (const signal of learningSignals) {
            if (signal.confidence < minScore)
                continue;
            const exportItem = learningSignalToExport(signal);
            if (exportItem) {
                exports.push(exportItem);
            }
        }
        return this.buildDataset(exports, options.maxExamples);
    }
    exportFromImprovementService(service, grader, options = {}) {
        const candidates = service.listCandidates();
        const exports = [];
        for (const candidate of candidates) {
            if (candidate.reviewStatus !== "released")
                continue;
            if (candidate.reviewStatus === "released" && candidate.candidateType === "prompt_tuning") {
                exports.push({
                    taskId: candidate.sourceSignalIds[0] ?? "unknown",
                    input: candidate.proposedChange,
                    output: candidate.candidateType,
                    feedbackType: "user_correction",
                    confidence: candidate.riskAssessment === "low" ? 0.9 : candidate.riskAssessment === "medium" ? 0.7 : 0.5,
                    signalIds: [...candidate.sourceSignalIds],
                    source: "user",
                    category: "correction",
                    severity: "warning",
                    reasonCode: null,
                    stepRefs: [],
                    timestamp: Date.now(),
                });
            }
        }
        return this.buildDataset(exports, options.maxExamples);
    }
    exportToJsonl(dataset) {
        return dataset.examples.map((example) => JSON.stringify(example)).join("\n");
    }
    exportToJson(dataset) {
        return JSON.stringify(dataset, null, 2);
    }
    buildDataset(exports, maxExamples) {
        let selected = exports;
        if (maxExamples != null && exports.length > maxExamples) {
            selected = exports.slice(0, maxExamples);
        }
        let highCount = 0;
        let mediumCount = 0;
        for (const item of selected) {
            if (item.confidence >= 0.8)
                highCount++;
            else if (item.confidence >= 0.6)
                mediumCount++;
        }
        const examples = selected.map((item) => {
            this.idCounter++;
            return toFineTuningExample(item, `ft_example_${this.idCounter}`);
        });
        return {
            datasetId: `ft_dataset_${Date.now()}`,
            exportedAt: nowIso(),
            totalExamples: examples.length,
            highQualityCount: highCount,
            mediumQualityCount: mediumCount,
            examples,
        };
    }
    reset() {
        this.idCounter = 0;
    }
}
//# sourceMappingURL=fine-tuning-exporter.js.map