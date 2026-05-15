/**
 * Fine-tuning Dataset Exporter
 *
 * Exports high-quality feedback signals as JSONL datasets
 * suitable for model fine-tuning pipelines.
 */

import { nowIso } from "../../platform/contracts/types/ids.js";
import type { FeedbackSignal } from "../../platform/five-plane-orchestration/oapeflir/types/feedback-signal.js";
import type { LearningSignal } from "./collector/feedback-model.js";
import type { FeedbackImprovementService } from "./feedback-improvement-service.js";
import type { FeedbackQualityGrader, QualityGrade } from "./quality-grader.js";

export interface FineTuningExample {
  readonly id: string;
  readonly taskId: string;
  readonly input: string;
  readonly output: string;
  readonly feedbackType: string;
  readonly confidence: number;
  readonly sourceSignals: readonly string[];
  readonly metadata: {
    readonly source: string;
    readonly category: string;
    readonly severity: string;
    readonly reasonCode: string | null;
    readonly stepRefs: readonly string[];
    readonly timestamp: number;
  };
}

export interface FineTuningDataset {
  readonly datasetId: string;
  readonly exportedAt: string;
  readonly totalExamples: number;
  readonly highQualityCount: number;
  readonly mediumQualityCount: number;
  readonly examples: readonly FineTuningExample[];
}

export interface ExportOptions {
  minQualityGrade?: "low" | "medium" | "high";
  maxExamples?: number;
  includeMetadata?: boolean;
}

interface FeedbackToExport {
  taskId: string;
  input: string;
  output: string;
  feedbackType: string;
  confidence: number;
  signalIds: string[];
  source: FeedbackSignal["source"];
  category: FeedbackSignal["category"];
  severity: FeedbackSignal["severity"];
  reasonCode: string | null;
  stepRefs: string[];
  timestamp: number;
}

function extractInputOutput(signal: FeedbackSignal): { input: string; output: string } {
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

function signalToExport(signal: FeedbackSignal, feedbackType: string): FeedbackToExport | null {
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
    reasonCode: typeof signal.payload["reasonCode"] === "string" ? signal.payload["reasonCode"] as string : null,
    stepRefs: [...signal.stepOutputRefs],
    timestamp: signal.timestamp,
  };
}

function learningSignalToExport(signal: LearningSignal): FeedbackToExport | null {
  const evidence = signal.evidence as Record<string, unknown>;
  const rawCategory = typeof evidence["category"] === "string" ? evidence["category"] : signal.learningType;
  const category: FeedbackSignal["category"] =
    rawCategory === "failure" ? "failure"
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
    source: (evidence["source"] as FeedbackSignal["source"]) ?? "execution",
    category,
    severity: "error",
    reasonCode: signal.learningType,
    stepRefs: [...signal.evidenceRefs],
    timestamp: signal.generatedAt,
  };
}

function toFineTuningExample(exportItem: FeedbackToExport, id: string): FineTuningExample {
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

function gradeToMinScore(grade: "low" | "medium" | "high"): number {
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
  private idCounter = 0;

  public exportFromSignals(
    signals: readonly FeedbackSignal[],
    grader: FeedbackQualityGrader,
    options: ExportOptions = {},
  ): FineTuningDataset {
    const grade = grader.gradeSignals(signals);
    const minScore = gradeToMinScore(options.minQualityGrade ?? "medium");

    const exports: FeedbackToExport[] = [];
    for (const signal of signals) {
      if (grade.score.overall < minScore) continue;

      const feedbackType = signal.category;
      const exportItem = signalToExport(signal, feedbackType);
      if (exportItem) {
        exports.push(exportItem);
      }
    }

    return this.buildDataset(exports, options.maxExamples);
  }

  public exportFromLearningSignals(
    learningSignals: readonly LearningSignal[],
    grader: FeedbackQualityGrader,
    options: ExportOptions = {},
  ): FineTuningDataset {
    const grade = grader.gradeLearningSignals(learningSignals);
    const minScore = gradeToMinScore(options.minQualityGrade ?? "medium");

    const exports: FeedbackToExport[] = [];
    for (const signal of learningSignals) {
      if (signal.confidence < minScore) continue;

      const exportItem = learningSignalToExport(signal);
      if (exportItem) {
        exports.push(exportItem);
      }
    }

    return this.buildDataset(exports, options.maxExamples);
  }

  public exportFromImprovementService(
    service: FeedbackImprovementService,
    grader: FeedbackQualityGrader,
    options: ExportOptions = {},
  ): FineTuningDataset {
    const candidates = service.listCandidates();
    const exports: FeedbackToExport[] = [];

    for (const candidate of candidates) {
      if (candidate.reviewStatus !== "released") continue;
      if (candidate.reviewStatus === "released" && candidate.candidateType === "prompt_tuning") {
        exports.push({
          taskId: candidate.sourceSignalIds[0] ?? "unknown",
          input: candidate.proposedChange.summary,
          output: candidate.candidateType,
          feedbackType: "user_correction",
          confidence: candidate.riskAssessment === "low" ? 0.9 : candidate.riskAssessment === "medium" ? 0.7 : 0.5,
          signalIds: [...candidate.sourceSignalIds],
          source: "user",
          category: "correction",
          severity: "warning",
          reasonCode: null,
          stepRefs: [] as string[],
          timestamp: Date.now(),
        });
      }
    }

    return this.buildDataset(exports, options.maxExamples);
  }

  public exportToJsonl(dataset: FineTuningDataset): string {
    return dataset.examples.map((example) => JSON.stringify(example)).join("\n");
  }

  public exportToJson(dataset: FineTuningDataset): string {
    return JSON.stringify(dataset, null, 2);
  }

  private buildDataset(exports: FeedbackToExport[], maxExamples?: number): FineTuningDataset {
    let selected = exports;
    if (maxExamples != null && exports.length > maxExamples) {
      selected = exports.slice(0, maxExamples);
    }

    let highCount = 0;
    let mediumCount = 0;
    for (const item of selected) {
      if (item.confidence >= 0.8) highCount++;
      else if (item.confidence >= 0.6) mediumCount++;
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

  public reset(): void {
    this.idCounter = 0;
  }
}
