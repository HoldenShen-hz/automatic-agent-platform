/**
 * FineTuningExporter.exportFromImprovementService Tests
 *
 * Tests for the exportFromImprovementService method which exports datasets
 * from released improvement candidates.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { FineTuningExporter } from "../../../../src/scale-ecosystem/feedback-loop/fine-tuning-exporter.js";
import { FeedbackQualityGrader } from "../../../../src/scale-ecosystem/feedback-loop/quality-grader.js";
import { FeedbackImprovementService } from "../../../../src/scale-ecosystem/feedback-loop/feedback-improvement-service.js";

test("exportFromImprovementService exports released prompt_tuning candidates", () => {
  const exporter = new FineTuningExporter();
  const grader = new FeedbackQualityGrader();
  const service = new FeedbackImprovementService();

  // Create and release a prompt_tuning candidate
  const signal = {
    learningSignalId: "sig_prompt_tuning",
    taskId: "task_1",
    sourceFeedbackId: "fb_1",
    learningType: "user_correction" as const,
    confidence: 0.9,
    valueSummary: "Improve prompt clarity",
    evidenceRefs: ["step:1"],
    sourceSignalIds: ["sig_1"],
    relatedSignalIds: [],
    evidence: {},
    generatedAt: Date.now(),
  };
  const candidate = service.createCandidate(signal);
  service.review(candidate.candidateId, "reviewer_1", "approved", {
    rolloutGatePassed: true,
    policyGatePassed: true,
  });
  service.release(candidate.candidateId, "owner_1");

  const dataset = exporter.exportFromImprovementService(service, grader);

  assert.ok(dataset.totalExamples >= 1);
  assert.ok(dataset.examples.some((ex) => ex.feedbackType === "user_correction"));
});

test("exportFromImprovementService skips non-released candidates", () => {
  const exporter = new FineTuningExporter();
  const grader = new FeedbackQualityGrader();
  const service = new FeedbackImprovementService();

  // Create a candidate but do NOT release it
  const signal = {
    learningSignalId: "sig_not_released",
    taskId: "task_2",
    sourceFeedbackId: "fb_2",
    learningType: "failure_pattern" as const,
    confidence: 0.9,
    valueSummary: "Fix workflow issue",
    evidenceRefs: ["step:1"],
    sourceSignalIds: ["sig_2"],
    relatedSignalIds: [],
    evidence: {},
    generatedAt: Date.now(),
  };
  service.createCandidate(signal);

  const dataset = exporter.exportFromImprovementService(service, grader);

  // Should have 0 examples since nothing is released
  assert.equal(dataset.totalExamples, 0);
});

test("exportFromImprovementService skips rejected candidates", () => {
  const exporter = new FineTuningExporter();
  const grader = new FeedbackQualityGrader();
  const service = new FeedbackImprovementService();

  const signal = {
    learningSignalId: "sig_rejected",
    taskId: "task_3",
    sourceFeedbackId: "fb_3",
    learningType: "failure_pattern" as const,
    confidence: 0.9,
    valueSummary: "Rejected improvement",
    evidenceRefs: ["step:1"],
    sourceSignalIds: ["sig_3"],
    relatedSignalIds: [],
    evidence: {},
    generatedAt: Date.now(),
  };
  const candidate = service.createCandidate(signal);
  service.review(candidate.candidateId, "reviewer_1", "approved", {
    rolloutGatePassed: false, // fails rollout gate
    policyGatePassed: true,
  });

  const dataset = exporter.exportFromImprovementService(service, grader);

  assert.equal(dataset.totalExamples, 0);
});

test("exportFromImprovementService respects maxExamples option", () => {
  const exporter = new FineTuningExporter();
  const grader = new FeedbackQualityGrader();
  const service = new FeedbackImprovementService();

  // Create multiple released candidates
  for (let i = 0; i < 5; i++) {
    const signal = {
      learningSignalId: `sig_multi_${i}`,
      taskId: `task_${i}`,
      sourceFeedbackId: `fb_${i}`,
      learningType: "user_correction" as const,
      confidence: 0.9,
      valueSummary: `Improvement ${i}`,
      evidenceRefs: [`step:${i}`],
      sourceSignalIds: [`sig_${i}`],
      relatedSignalIds: [],
      evidence: {},
      generatedAt: Date.now(),
    };
    const candidate = service.createCandidate(signal);
    service.review(candidate.candidateId, "reviewer_1", "approved", {
      rolloutGatePassed: true,
      policyGatePassed: true,
    });
    service.release(candidate.candidateId, "owner_1");
  }

  const dataset = exporter.exportFromImprovementService(service, grader, { maxExamples: 3 });

  assert.ok(dataset.totalExamples <= 3);
});

test("exportFromImprovementService maps risk assessment to confidence", () => {
  const exporter = new FineTuningExporter();
  const grader = new FeedbackQualityGrader();
  const service = new FeedbackImprovementService();

  // Create a low risk candidate
  const lowRiskSignal = {
    learningSignalId: "sig_low_risk",
    taskId: "task_low",
    sourceFeedbackId: "fb_low",
    learningType: "user_correction" as const,
    confidence: 0.9, // high confidence = low risk
    valueSummary: "Low risk improvement",
    evidenceRefs: ["step:1"],
    sourceSignalIds: ["sig_low"],
    relatedSignalIds: [],
    evidence: {},
    generatedAt: Date.now(),
  };
  const lowRiskCandidate = service.createCandidate(lowRiskSignal);
  service.review(lowRiskCandidate.candidateId, "reviewer_1", "approved", {
    rolloutGatePassed: true,
    policyGatePassed: true,
  });
  service.release(lowRiskCandidate.candidateId, "owner_1");

  // Create a high risk candidate
  const highRiskSignal = {
    learningSignalId: "sig_high_risk",
    taskId: "task_high",
    sourceFeedbackId: "fb_high",
    learningType: "user_correction" as const,
    confidence: 0.5, // low confidence = high risk
    valueSummary: "High risk improvement",
    evidenceRefs: ["step:2"],
    sourceSignalIds: ["sig_high"],
    relatedSignalIds: [],
    evidence: {},
    generatedAt: Date.now(),
  };
  const highRiskCandidate = service.createCandidate(highRiskSignal);
  service.review(highRiskCandidate.candidateId, "reviewer_1", "approved", {
    rolloutGatePassed: true,
    policyGatePassed: true,
  });
  service.release(highRiskCandidate.candidateId, "owner_1");

  const dataset = exporter.exportFromImprovementService(service, grader);

  const lowRiskExample = dataset.examples.find((ex) => ex.sourceSignals.includes("sig_low"));
  const highRiskExample = dataset.examples.find((ex) => ex.sourceSignals.includes("sig_high"));

  assert.ok(lowRiskExample, "lowRiskExample should exist");
  assert.ok(highRiskExample, "highRiskExample should exist");
  // Low risk should have higher confidence (0.9) than high risk (0.5)
  assert.ok(lowRiskExample!.confidence > highRiskExample!.confidence);
});

test("exportFromImprovementService handles empty candidate list", () => {
  const exporter = new FineTuningExporter();
  const grader = new FeedbackQualityGrader();
  const service = new FeedbackImprovementService();

  const dataset = exporter.exportFromImprovementService(service, grader);

  assert.equal(dataset.totalExamples, 0);
  assert.deepEqual(dataset.examples, []);
});

test("exportFromImprovementService only processes prompt_tuning type", () => {
  const exporter = new FineTuningExporter();
  const grader = new FeedbackQualityGrader();
  const service = new FeedbackImprovementService();

  // Create a failure_pattern candidate (maps to workflow_patch, not prompt_tuning)
  const signal = {
    learningSignalId: "sig_workflow",
    taskId: "task_workflow",
    sourceFeedbackId: "fb_workflow",
    learningType: "failure_pattern" as const,
    confidence: 0.9,
    valueSummary: "Workflow improvement",
    evidenceRefs: ["step:1"],
    sourceSignalIds: ["sig_workflow"],
    relatedSignalIds: [],
    evidence: {},
    generatedAt: Date.now(),
  };
  const candidate = service.createCandidate(signal);
  service.review(candidate.candidateId, "reviewer_1", "approved", {
    rolloutGatePassed: true,
    policyGatePassed: true,
  });
  service.release(candidate.candidateId, "owner_1");

  const dataset = exporter.exportFromImprovementService(service, grader);

  // workflow_patch type is not exported by exportFromImprovementService
  assert.equal(dataset.totalExamples, 0);
});
