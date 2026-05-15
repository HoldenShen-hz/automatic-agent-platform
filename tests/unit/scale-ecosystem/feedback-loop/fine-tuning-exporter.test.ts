import test from "node:test";
import assert from "node:assert/strict";

import { FineTuningExporter } from "../../../../src/scale-ecosystem/feedback-loop/fine-tuning-exporter.js";
import { FeedbackQualityGrader } from "../../../../src/scale-ecosystem/feedback-loop/quality-grader.js";
import { parseLearningSignal } from "../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";
import type { FeedbackSignal } from "../../../../src/platform/five-plane-orchestration/oapeflir/types/feedback-signal.js";

function createSignal(overrides: Partial<FeedbackSignal> = {}): FeedbackSignal {
  return {
    signalId: "sig_test_1",
    taskId: "task_1",
    source: "user",
    category: "correction",
    severity: "error",
    payload: { reasonCode: "wrong_output", summary: "Corrected output was wrong" },
    stepOutputRefs: ["step:1"],
    timestamp: Date.now(),
    ...overrides,
  };
}

test("FineTuningExporter exports high-quality signals as JSONL", () => {
  const exporter = new FineTuningExporter();
  const grader = new FeedbackQualityGrader();
  const signals = [
    createSignal({
      signalId: "sig_1",
      source: "user",
      category: "correction",
      severity: "critical",
      payload: { reasonCode: "wrong_output", summary: "User corrected wrong output" },
      stepOutputRefs: ["step:1", "step:2"],
    }),
  ];

  const dataset = exporter.exportFromSignals(signals, grader);

  assert.ok(dataset.totalExamples >= 1);
  assert.ok(dataset.examples.length >= 1);
  assert.ok(dataset.datasetId.startsWith("ft_dataset_"));
  assert.ok(dataset.exportedAt.length > 0);
});

test("FineTuningExporter exports to JSONL format correctly", () => {
  const exporter = new FineTuningExporter();
  const grader = new FeedbackQualityGrader();
  const signals = [
    createSignal({
      signalId: "sig_1",
      source: "user",
      category: "correction",
      payload: { reasonCode: "wrong", summary: "summary" },
    }),
  ];

  const dataset = exporter.exportFromSignals(signals, grader);
  const jsonl = exporter.exportToJsonl(dataset);

  assert.ok(jsonl.length > 0);
  assert.ok(jsonl.includes("\n") || JSON.parse(jsonl));
  const parsed = JSON.parse(jsonl.split("\n")[0] ?? jsonl);
  assert.ok(parsed.id);
  assert.ok(parsed.input);
  assert.ok(parsed.output);
});

test("FineTuningExporter respects maxExamples limit", () => {
  const exporter = new FineTuningExporter();
  const grader = new FeedbackQualityGrader();
  const signals = [
    createSignal({ signalId: "sig_1", source: "user", category: "correction" }),
    createSignal({ signalId: "sig_2", source: "user", category: "correction" }),
    createSignal({ signalId: "sig_3", source: "user", category: "correction" }),
  ];

  const dataset = exporter.exportFromSignals(signals, grader, { maxExamples: 2 });

  assert.ok(dataset.totalExamples <= 2);
});

test("FineTuningExporter exports from learning signals", () => {
  const exporter = new FineTuningExporter();
  const grader = new FeedbackQualityGrader();
  const learningSignals = [
    parseLearningSignal({
      learningSignalId: "ls_1",
      taskId: "task_1",
      sourceFeedbackId: "fb_1",
      learningType: "failure_pattern",
      confidence: 0.85,
      valueSummary: "Agent consistently failed on schema validation",
      evidenceRefs: ["step:1"],
      sourceSignalIds: ["sig_1"],
      relatedSignalIds: ["sig_1"],
      evidence: { source: "execution", category: "failure" },
      generatedAt: Date.now(),
    }),
  ];

  const dataset = exporter.exportFromLearningSignals(learningSignals, grader);

  assert.ok(dataset.totalExamples >= 1);
});

test("FineTuningExporter exportToJson produces valid JSON", () => {
  const exporter = new FineTuningExporter();
  const grader = new FeedbackQualityGrader();
  const signals = [
    createSignal({ signalId: "sig_1", source: "user", category: "correction" }),
  ];

  const dataset = exporter.exportFromSignals(signals, grader);
  const json = exporter.exportToJson(dataset);

  const parsed = JSON.parse(json);
  assert.equal(parsed.totalExamples, dataset.totalExamples);
  assert.ok(Array.isArray(parsed.examples));
});

test("FineTuningExporter reset allows reuse of exporter", () => {
  const exporter = new FineTuningExporter();
  const grader = new FeedbackQualityGrader();
  const signals = [createSignal({ signalId: "sig_1", payload: { summary: "test" } })];

  const dataset1 = exporter.exportFromSignals(signals, grader);
  exporter.reset();
  const dataset2 = exporter.exportFromSignals(signals, grader);

  assert.ok(dataset1.examples.length >= 1);
  assert.ok(dataset2.examples.length >= 1);
  assert.ok(typeof dataset1.examples[0]?.id === "string");
  assert.ok(typeof dataset2.examples[0]?.id === "string");
});

test("FineTuningExporter skips signals without input or output", () => {
  const exporter = new FineTuningExporter();
  const grader = new FeedbackQualityGrader();
  const signals = [
    createSignal({
      signalId: "sig_1",
      taskId: "task_empty",
      payload: {},
      stepOutputRefs: [],
    }),
  ];

  const dataset = exporter.exportFromSignals(signals, grader, { minQualityGrade: "high" });

  assert.ok(dataset.totalExamples === 0 || dataset.examples.every((ex) => ex.input === ex.output));
});

test("FineTuningExporter counts high and medium quality correctly", () => {
  const exporter = new FineTuningExporter();
  const grader = new FeedbackQualityGrader();
  const signals = [
    createSignal({ signalId: "sig_1", source: "user", category: "correction", severity: "critical" }),
  ];

  const dataset = exporter.exportFromSignals(signals, grader);

  assert.equal(dataset.highQualityCount + dataset.mediumQualityCount, dataset.totalExamples);
});

test("FineTuningExporter respects minQualityGrade option", () => {
  const exporter = new FineTuningExporter();
  const grader = new FeedbackQualityGrader();
  const signals = [
    createSignal({
      source: "system",
      category: "success",
      severity: "info",
      payload: {},
    }),
  ];

  const dataset = exporter.exportFromSignals(signals, grader, { minQualityGrade: "high" });

  assert.ok(dataset.totalExamples === 0);
});