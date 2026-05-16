/**
 * Experience Distillation Service Unit Tests
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ExperienceDistillationService } from "/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/learn/experience-distillation-service.js";

function makeSignal(overrides: Partial<{
  learningSignalId: string;
  learningType: "failure_pattern" | "success_signal" | "correction" | "recovery_playbook";
  valueSummary: string;
  confidence: number;
  evidenceRefs: string[];
  sourceSignalIds: string[];
  generatedAt: string;
}> = {}): {
  learningSignalId: string;
  learningType: "failure_pattern" | "success_signal" | "correction" | "recovery_playbook";
  valueSummary: string;
  confidence: number;
  evidenceRefs: string[];
  sourceSignalIds: string[];
  generatedAt: string;
} {
  return {
    learningSignalId: "signal-001",
    learningType: "failure_pattern",
    valueSummary: "Test signal summary",
    confidence: 0.7,
    evidenceRefs: ["evidence-1"],
    sourceSignalIds: ["source-1"],
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

test("ExperienceDistillationService.distill creates learning object from signal", () => {
  const service = new ExperienceDistillationService();
  const signal = makeSignal({ learningSignalId: "sig-1" });
  const results = service.distill([signal]);

  assert.equal(results.length, 1);
  assert.equal(results[0].learningObjectId.length > 0, true);
  assert.equal(results[0].learningType, signal.learningType);
});

test("ExperienceDistillationService.distill maps title from learningType", () => {
  const service = new ExperienceDistillationService();
  const signal = makeSignal({ learningType: "failure_pattern" });
  const results = service.distill([signal]);

  assert.ok(results[0].title.includes("failure_pattern"));
});

test("ExperienceDistillationService.distill copies valueSummary to summary", () => {
  const service = new ExperienceDistillationService();
  const signal = makeSignal({ valueSummary: "Custom summary text" });
  const results = service.distill([signal]);

  assert.equal(results[0].summary, "Custom summary text");
});

test("ExperienceDistillationService.distill copies confidence", () => {
  const service = new ExperienceDistillationService();
  const signal = makeSignal({ confidence: 0.85 });
  const results = service.distill([signal]);

  assert.equal(results[0].confidence, 0.85);
});

test("ExperienceDistillationService.distill copies evidenceRefs", () => {
  const service = new ExperienceDistillationService();
  const signal = makeSignal({ evidenceRefs: ["ref-1", "ref-2"] });
  const results = service.distill([signal]);

  assert.deepEqual(results[0].evidenceRefs, ["ref-1", "ref-2"]);
});

test("ExperienceDistillationService.distill copies sourceSignalIds", () => {
  const service = new ExperienceDistillationService();
  const signal = makeSignal({ sourceSignalIds: ["source-A", "source-B"] });
  const results = service.distill([signal]);

  assert.deepEqual(results[0].sourceSignalIds, ["source-A", "source-B"]);
});

test("ExperienceDistillationService.distill sets validatedBy to none", () => {
  const service = new ExperienceDistillationService();
  const results = service.distill([makeSignal()]);

  assert.equal(results[0].validatedBy, "none");
});

test("ExperienceDistillationService.distill sets promotionStatus to draft", () => {
  const service = new ExperienceDistillationService();
  const results = service.distill([makeSignal()]);

  assert.equal(results[0].promotionStatus, "draft");
});

test("ExperienceDistillationService.distill uses generatedAt for createdAt", () => {
  const service = new ExperienceDistillationService();
  const signal = makeSignal({ generatedAt: "2024-01-15T10:30:00Z" });
  const results = service.distill([signal]);

  assert.equal(results[0].createdAt, "2024-01-15T10:30:00Z");
});

test("ExperienceDistillationService.distill builds recommendation for failure_pattern", () => {
  const service = new ExperienceDistillationService();
  const signal = makeSignal({ learningType: "failure_pattern" });
  const results = service.distill([signal]);

  assert.ok(results[0].recommendation.length > 0);
  assert.ok(results[0].recommendation.includes("preventive") || results[0].recommendation.includes("planning"));
});

test("ExperienceDistillationService.distill builds recommendation for recovery_playbook", () => {
  const service = new ExperienceDistillationService();
  const signal = makeSignal({ learningType: "recovery_playbook" });
  const results = service.distill([signal]);

  assert.ok(results[0].recommendation.includes("recovery") || results[0].recommendation.includes("persist"));
});

test("ExperienceDistillationService.distill handles multiple signals", () => {
  const service = new ExperienceDistillationService();
  const signals = [
    makeSignal({ learningSignalId: "sig-1" }),
    makeSignal({ learningSignalId: "sig-2" }),
    makeSignal({ learningSignalId: "sig-3" }),
  ];
  const results = service.distill(signals);

  assert.equal(results.length, 3);
});

test("ExperienceDistillationService.distill handles empty array", () => {
  const service = new ExperienceDistillationService();
  const results = service.distill([]);

  assert.equal(results.length, 0);
});

test("ExperienceDistillationService.distill generates unique learningObjectIds", () => {
  const service = new ExperienceDistillationService();
  const signals = [
    makeSignal({ learningSignalId: "sig-1" }),
    makeSignal({ learningSignalId: "sig-2" }),
  ];
  const results = service.distill(signals);

  assert.notEqual(results[0].learningObjectId, results[1].learningObjectId);
});
