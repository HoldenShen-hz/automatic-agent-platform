import test from "node:test";
import assert from "node:assert/strict";

import { FeedbackImprovementService } from "../../../../src/scale-ecosystem/feedback-loop/feedback-improvement-service.js";

test("FeedbackImprovementService.ingest creates candidates from learning signals", () => {
  const service = new FeedbackImprovementService();
  const result = service.ingest({
    taskId: "task_1",
    signals: [
      {
        signalId: "sig_1",
        taskId: "task_1",
        source: "execution",
        category: "failure",
        severity: "error",
        payload: {},
        stepOutputRefs: [],
        timestamp: 1,
      },
    ],
  });

  assert.ok(result.feedback !== undefined);
  assert.ok(Array.isArray(result.learningSignals));
  assert.ok(Array.isArray(result.candidates));
  assert.ok(result.candidates.length > 0);
});

test("FeedbackImprovementService.createCandidate throws for signal without sourceSignalIds", () => {
  const service = new FeedbackImprovementService();
  const signal = {
    learningSignalId: "sig_test",
    taskId: "task_test",
    sourceFeedbackId: "fb_test",
    learningType: "failure_pattern" as const,
    confidence: 0.9,
    valueSummary: "test summary",
    evidenceRefs: [],
    sourceSignalIds: [],
    relatedSignalIds: [],
    evidence: {},
    generatedAt: Date.now(),
  };

  assert.throws(
    () => service.createCandidate(signal),
    /feedback_improvement\.missing_source_signal/,
  );
});

test("FeedbackImprovementService.createCandidate maps signal types correctly", () => {
  const service = new FeedbackImprovementService();

  const failureSignal = {
    learningSignalId: "sig_fail",
    taskId: "task_fail",
    sourceFeedbackId: "fb_fail",
    learningType: "failure_pattern" as const,
    confidence: 0.9,
    valueSummary: "failure pattern detected",
    evidenceRefs: [],
    sourceSignalIds: ["sig_1"],
    relatedSignalIds: [],
    evidence: {},
    generatedAt: Date.now(),
  };
  const failureCandidate = service.createCandidate(failureSignal);
  assert.equal(failureCandidate.candidateType, "workflow_patch");

  const correctionSignal = {
    learningSignalId: "sig_corr",
    taskId: "task_corr",
    sourceFeedbackId: "fb_corr",
    learningType: "user_correction" as const,
    confidence: 0.9,
    valueSummary: "user correction made",
    evidenceRefs: [],
    sourceSignalIds: ["sig_2"],
    relatedSignalIds: [],
    evidence: {},
    generatedAt: Date.now(),
  };
  const correctionCandidate = service.createCandidate(correctionSignal);
  assert.equal(correctionCandidate.candidateType, "prompt_tuning");

  const retrainingSignal = {
    learningSignalId: "sig_retrain",
    taskId: "task_retrain",
    sourceFeedbackId: "fb_retrain",
    learningType: "model_retraining" as const,
    confidence: 0.9,
    valueSummary: "model needs retraining",
    evidenceRefs: [],
    sourceSignalIds: ["sig_3"],
    relatedSignalIds: [],
    evidence: {},
    generatedAt: Date.now(),
  };
  const retrainingCandidate = service.createCandidate(retrainingSignal);
  assert.equal(retrainingCandidate.candidateType, "model_retraining");

  const datasetSignal = {
    learningSignalId: "sig_data",
    taskId: "task_data",
    sourceFeedbackId: "fb_data",
    learningType: "dataset_gap" as const,
    confidence: 0.9,
    valueSummary: "dataset gap identified",
    evidenceRefs: [],
    sourceSignalIds: ["sig_4"],
    relatedSignalIds: [],
    evidence: {},
    generatedAt: Date.now(),
  };
  const datasetCandidate = service.createCandidate(datasetSignal);
  assert.equal(datasetCandidate.candidateType, "data_augmentation");
});

test("FeedbackImprovementService.createCandidate risk assessment based on confidence", () => {
  const service = new FeedbackImprovementService();

  const highConfidenceSignal = {
    learningSignalId: "sig_high",
    taskId: "task_high",
    sourceFeedbackId: "fb_high",
    learningType: "failure_pattern" as const,
    confidence: 0.9,
    valueSummary: "high confidence",
    evidenceRefs: [],
    sourceSignalIds: ["sig_1"],
    relatedSignalIds: [],
    evidence: {},
    generatedAt: Date.now(),
  };
  const highCandidate = service.createCandidate(highConfidenceSignal);
  assert.equal(highCandidate.riskAssessment, "low");

  const mediumConfidenceSignal = {
    learningSignalId: "sig_med",
    taskId: "task_med",
    sourceFeedbackId: "fb_med",
    learningType: "failure_pattern" as const,
    confidence: 0.7,
    valueSummary: "medium confidence",
    evidenceRefs: [],
    sourceSignalIds: ["sig_2"],
    relatedSignalIds: [],
    evidence: {},
    generatedAt: Date.now(),
  };
  const mediumCandidate = service.createCandidate(mediumConfidenceSignal);
  assert.equal(mediumCandidate.riskAssessment, "medium");

  const lowConfidenceSignal = {
    learningSignalId: "sig_low",
    taskId: "task_low",
    sourceFeedbackId: "fb_low",
    learningType: "failure_pattern" as const,
    confidence: 0.5,
    valueSummary: "low confidence",
    evidenceRefs: [],
    sourceSignalIds: ["sig_3"],
    relatedSignalIds: [],
    evidence: {},
    generatedAt: Date.now(),
  };
  const lowCandidate = service.createCandidate(lowConfidenceSignal);
  assert.equal(lowCandidate.riskAssessment, "high");
});

test("FeedbackImprovementService.review approves when all gates pass", () => {
  const service = new FeedbackImprovementService();
  const signal = {
    learningSignalId: "sig_review",
    taskId: "task_review",
    sourceFeedbackId: "fb_review",
    learningType: "failure_pattern" as const,
    confidence: 0.9,
    valueSummary: "review test",
    evidenceRefs: [],
    sourceSignalIds: ["sig_1"],
    relatedSignalIds: [],
    evidence: {},
    generatedAt: Date.now(),
  };
  const candidate = service.createCandidate(signal);

  const decision = service.review(candidate.candidateId, "reviewer_1", "approved", {
    rolloutGatePassed: true,
    policyGatePassed: true,
  });

  assert.equal(decision.decision, "approved");
  assert.equal(decision.reviewer, "reviewer_1");
  assert.equal(decision.rolloutGatePassed, true);
  assert.equal(decision.policyGatePassed, true);
});

test("FeedbackImprovementService.review rejects when rollout gate fails", () => {
  const service = new FeedbackImprovementService();
  const signal = {
    learningSignalId: "sig_reject",
    taskId: "task_reject",
    sourceFeedbackId: "fb_reject",
    learningType: "failure_pattern" as const,
    confidence: 0.9,
    valueSummary: "reject test",
    evidenceRefs: [],
    sourceSignalIds: ["sig_1"],
    relatedSignalIds: [],
    evidence: {},
    generatedAt: Date.now(),
  };
  const candidate = service.createCandidate(signal);

  const decision = service.review(candidate.candidateId, "reviewer_1", "approved", {
    rolloutGatePassed: false,
    policyGatePassed: true,
  });

  assert.equal(decision.decision, "rejected");
});

test("FeedbackImprovementService.release throws if candidate not approved", () => {
  const service = new FeedbackImprovementService();
  const signal = {
    learningSignalId: "sig_release",
    taskId: "task_release",
    sourceFeedbackId: "fb_release",
    learningType: "failure_pattern" as const,
    confidence: 0.9,
    valueSummary: "release test",
    evidenceRefs: [],
    sourceSignalIds: ["sig_1"],
    relatedSignalIds: [],
    evidence: {},
    generatedAt: Date.now(),
  };
  const candidate = service.createCandidate(signal);

  assert.throws(
    () => service.release(candidate.candidateId, "owner_1"),
    /feedback_improvement\.release_requires_approval/,
  );
});

test("FeedbackImprovementService.release succeeds for approved candidate", () => {
  const service = new FeedbackImprovementService();
  const signal = {
    learningSignalId: "sig_approved",
    taskId: "task_approved",
    sourceFeedbackId: "fb_approved",
    learningType: "failure_pattern" as const,
    confidence: 0.9,
    valueSummary: "approved test",
    evidenceRefs: [],
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

  const released = service.release(candidate.candidateId, "owner_1");

  assert.equal(released.reviewStatus, "released");
});

test("FeedbackImprovementService.buildSnapshot returns analysis summary", () => {
  const service = new FeedbackImprovementService();
  const signals = [
    {
      signalId: "sig_snapshot",
      taskId: "task_snapshot",
      source: "execution" as const,
      category: "failure" as const,
      severity: "error" as const,
      payload: {},
      stepOutputRefs: [],
      timestamp: 1,
    },
  ];

  const snapshot = service.buildSnapshot(signals);

  assert.equal(snapshot.generatedAt !== undefined, true);
  assert.equal(snapshot.analysis !== undefined, true);
  assert.equal(snapshot.candidateCount >= 0, true);
});

test("FeedbackImprovementService.listCandidates returns all candidates", () => {
  const service = new FeedbackImprovementService();
  service.ingest({
    taskId: "task_list",
    signals: [
      {
        signalId: "sig_list",
        taskId: "task_list",
        source: "execution",
        category: "failure",
        severity: "error",
        payload: {},
        stepOutputRefs: [],
        timestamp: 1,
      },
    ],
  });

  const candidates = service.listCandidates();

  assert.ok(Array.isArray(candidates));
  assert.ok(candidates.length > 0);
});
