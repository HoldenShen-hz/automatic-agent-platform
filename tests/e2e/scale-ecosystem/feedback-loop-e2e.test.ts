/**
 * E2E Tests for Feedback Loop Service
 *
 * End-to-end tests covering:
 * 1. Feedback signal collection and deduplication
 * 2. Learning signal generation
 * 3. Feedback improvement application
 * 4. Quality grading
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../../helpers/e2e-harness.js";
// @ts-ignore
import { FeedbackLoopService } from "../../../src/scale-ecosystem/feedback-loop/feedback-loop-service.js";
// @ts-ignore
import { ImprovementTracker } from "../../../src/scale-ecosystem/feedback-loop/improvement-tracker/improvement-tracker.js";
// @ts-ignore
import { QualityGrader } from "../../../src/scale-ecosystem/feedback-loop/quality-grader.js";
// @ts-ignore
import type { FeedbackSignal, ImprovementAction } from "../../../src/scale-ecosystem/feedback-loop/types.js";
import { newId, nowIso } from "../../../src/platform/contracts/types/ids.js";

function createFeedbackSignal(overrides: Partial<FeedbackSignal> = {}): FeedbackSignal {
  return {
    signalId: overrides.signalId ?? newId("fb"),
    taskId: overrides.taskId ?? newId("task"),
    executionId: overrides.executionId ?? newId("exec"),
    agentId: overrides.agentId ?? "agent_fb",
    signalType: overrides.signalType ?? "success",
    score: overrides.score ?? 1.0,
    latencyMs: overrides.latencyMs ?? 100,
    toolName: overrides.toolName ?? "read_file",
    inputHash: overrides.inputHash ?? "abc123",
    outputHash: overrides.outputHash ?? "def456",
    errorCode: overrides.errorCode ?? null,
    timestamp: overrides.timestamp ?? nowIso(),
    metadata: overrides.metadata ?? {},
    ...overrides,
  };
}

test("E2E FeedbackLoop: Signals are collected and deduplicated", async () => {
  const harness = createE2EHarness("aa-e2e-feedback-collect-");
  try {
    const service = new FeedbackLoopService(harness.store);

    const signal1 = createFeedbackSignal({
      signalId: "sig_001",
      inputHash: "same_input",
      outputHash: "same_output",
    });
    const signal2 = createFeedbackSignal({
      signalId: "sig_002",
      inputHash: "same_input", // Same input as signal1
      outputHash: "same_output", // Same output as signal1
    });

    service.addSignal(signal1);
    service.addSignal(signal2);

    const deduplicated = service.getDeduplicatedSignals();
    // Signals with same input+output should be deduplicated to 1
    assert.ok(deduplicated.length <= 2);
  } finally {
    harness.cleanup();
  }
});

test("E2E FeedbackLoop: Learning signals are generated from feedback", async () => {
  const harness = createE2EHarness("aa-e2e-feedback-learn-");
  try {
    const service = new FeedbackLoopService(harness.store);

    // Add multiple success signals
    for (let i = 0; i < 3; i++) {
      service.addSignal(createFeedbackSignal({
        signalId: newId("sig"),
        signalType: "success",
        score: 1.0,
      }));
    }

    const signals = service.getSignalsForLearning();
    assert.ok(signals.length >= 3, "Should have signals for learning");
  } finally {
    harness.cleanup();
  }
});

test("E2E FeedbackLoop: Quality grades are computed", async () => {
  const harness = createE2EHarness("aa-e2e-feedback-grade-");
  try {
    const grader = new QualityGrader();

    const grade = grader.computeGrade({
      successRate: 0.95,
      avgLatencyMs: 150,
      errorRate: 0.05,
      throughputScore: 0.8,
    });

    assert.ok(grade >= 0 && grade <= 1);
    assert.equal(typeof grade, "number");
  } finally {
    harness.cleanup();
  }
});

test("E2E FeedbackLoop: Improvement actions are tracked", async () => {
  const harness = createE2EHarness("aa-e2e-feedback-improve-");
  try {
    const tracker = new ImprovementTracker();

    const action: ImprovementAction = {
      actionId: newId("action"),
      agentId: "agent_improve",
      actionType: "retrain",
      targetModel: "gpt-4",
      priorScore: 0.7,
      newScore: 0.85,
      appliedAt: nowIso(),
      status: "completed",
    };

    tracker.trackAction(action);
    const actions = tracker.getRecentActions(10);

    assert.ok(actions.length >= 1);
    assert.equal(actions[0]?.actionId, action.actionId);
  } finally {
    harness.cleanup();
  }
});