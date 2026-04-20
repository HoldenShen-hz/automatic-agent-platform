import test from "node:test";
import assert from "node:assert/strict";

import { LLMImprovementGenerationService } from "../../../../../../src/platform/orchestration/oapeflir/learn/llm-improvement-generation-service.js";
import type { LearningSignal } from "../../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";

const createMockProvider = (response: { content: string }) => ({
  createChatCompletion: async () => ({ content: response.content, id: "mock", finishReason: "stop", toolCalls: [], usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }, model: "mock", provider: "mock" }),
  createStreamingChatCompletion: async () => { /* noop for streaming */ },
  hasProvider: () => true,
  dispose: () => {},
});

test("LLMImprovementGenerationService returns empty array for empty signals", async () => {
  const service = new LLMImprovementGenerationService();
  const results = await service.generateImprovements([]);
  assert.equal(results.length, 0);
});

test("LLMImprovementGenerationService generates improvements from LLM response", async () => {
  const mockResponse = JSON.stringify([
    {
      learningObjectId: "placeholder",
      learningType: "user_correction",
      title: "Use narrower scope for retries",
      summary: "User corrected the approach to use narrower scope",
      confidence: 0.85,
      evidenceRefs: ["artifact:f"],
      sourceSignalIds: ["signal_6"],
      recommendation: "Adopt the narrower scope pattern for future similar tasks",
      validatedBy: "none",
      promotionStatus: "draft",
      createdAt: Date.now(),
    },
  ]);

  const mockProvider = createMockProvider({ content: mockResponse });
  const service = new LLMImprovementGenerationService({ provider: mockProvider as any });

  const signals: readonly LearningSignal[] = [
    {
      learningSignalId: "ls_1",
      taskId: "task_1",
      sourceFeedbackId: "fb_1",
      learningType: "user_correction",
      confidence: 0.9,
      valueSummary: "user corrected the approach",
      evidenceRefs: ["artifact:f"],
      sourceSignalIds: ["signal_1"],
      relatedSignalIds: [],
      evidence: { source: "user", category: "correction" },
      generatedAt: Date.now(),
    },
  ];

  const results = await service.generateImprovements(signals);
  assert.equal(results.length, 1);
  assert.equal(results[0]?.learningType, "user_correction");
  assert.equal(results[0]?.title, "Use narrower scope for retries");
});

test("LLMImprovementGenerationService falls back to template on invalid JSON", async () => {
  const mockProvider = createMockProvider({ content: "This is not valid JSON" });
  const service = new LLMImprovementGenerationService({ provider: mockProvider as any });

  const signals: readonly LearningSignal[] = [
    {
      learningSignalId: "ls_2",
      taskId: "task_2",
      sourceFeedbackId: "fb_2",
      learningType: "recovery_playbook",
      confidence: 0.8,
      valueSummary: "retry with backoff works",
      evidenceRefs: ["artifact:c"],
      sourceSignalIds: ["signal_2"],
      relatedSignalIds: [],
      evidence: { pattern: "retry_path" },
      generatedAt: Date.now(),
    },
  ];

  const results = await service.generateImprovements(signals);
  assert.equal(results.length, 1);
  assert.equal(results[0]?.learningType, "recovery_playbook");
  assert.ok(results[0]?.title.includes("recovery_playbook"));
});

test("LLMImprovementGenerationService falls back to template on non-JSON response", async () => {
  const mockProvider = createMockProvider({ content: "Some text response without JSON" });
  const service = new LLMImprovementGenerationService({ provider: mockProvider as any });

  const signals: readonly LearningSignal[] = [
    {
      learningSignalId: "ls_3",
      taskId: "task_3",
      sourceFeedbackId: "fb_3",
      learningType: "failure_pattern",
      confidence: 0.75,
      valueSummary: "schema mismatch in output",
      evidenceRefs: ["artifact:a"],
      sourceSignalIds: ["signal_3"],
      relatedSignalIds: [],
      evidence: { source: "execution", category: "failure" },
      generatedAt: Date.now(),
    },
  ];

  const results = await service.generateImprovements(signals);
  assert.equal(results.length, 1);
  assert.equal(results[0]?.learningType, "failure_pattern");
});

test("LLMImprovementGenerationService uses custom model configuration", async () => {
  const mockProvider = createMockProvider({ content: "[]" });
  const service = new LLMImprovementGenerationService({
    provider: mockProvider as any,
    model: "custom-model",
    maxTokens: 500,
    temperature: 0.5,
  });

  const signals: readonly LearningSignal[] = [
    {
      learningSignalId: "ls_4",
      taskId: "task_4",
      sourceFeedbackId: "fb_4",
      learningType: "user_correction",
      confidence: 0.9,
      valueSummary: "test signal",
      evidenceRefs: [],
      sourceSignalIds: [],
      relatedSignalIds: [],
      evidence: {},
      generatedAt: Date.now(),
    },
  ];

  const results = await service.generateImprovements(signals);
  assert.equal(results.length, 0);
});

test("LLMImprovementGenerationService handles signals without evidence gracefully", async () => {
  const mockProvider = createMockProvider({ content: "[]" });
  const service = new LLMImprovementGenerationService({ provider: mockProvider as any });

  const signals: readonly LearningSignal[] = [
    {
      learningSignalId: "ls_5",
      taskId: "task_5",
      sourceFeedbackId: "fb_5",
      learningType: "user_correction",
      confidence: 0.5,
      valueSummary: "low confidence signal",
      evidenceRefs: [],
      sourceSignalIds: [],
      relatedSignalIds: [],
      evidence: {},
      generatedAt: Date.now(),
    },
  ];

  const results = await service.generateImprovements(signals);
  assert.equal(results.length, 1);
  assert.equal(results[0]?.learningType, "user_correction");
});

test("LLMImprovementGenerationService template recommendation for failure_pattern", async () => {
  const mockProvider = createMockProvider({ content: "invalid" });
  const service = new LLMImprovementGenerationService({ provider: mockProvider as any });

  const signals: readonly LearningSignal[] = [
    {
      learningSignalId: "ls_6",
      taskId: "task_6",
      sourceFeedbackId: "fb_6",
      learningType: "failure_pattern",
      confidence: 0.6,
      valueSummary: "something went wrong",
      evidenceRefs: ["ref1"],
      sourceSignalIds: [],
      relatedSignalIds: [],
      evidence: {},
      generatedAt: Date.now(),
    },
  ];

  const results = await service.generateImprovements(signals);
  assert.equal(results.length, 1);
  assert.ok(results[0]?.recommendation.includes("root cause") || results[0]?.recommendation.includes("preventive"));
});

test("LLMImprovementGenerationService template recommendation for user_correction", async () => {
  const mockProvider = createMockProvider({ content: "invalid" });
  const service = new LLMImprovementGenerationService({ provider: mockProvider as any });

  const signals: readonly LearningSignal[] = [
    {
      learningSignalId: "ls_7",
      taskId: "task_7",
      sourceFeedbackId: "fb_7",
      learningType: "user_correction",
      confidence: 0.9,
      valueSummary: "user provided correction",
      evidenceRefs: ["ref2"],
      sourceSignalIds: [],
      relatedSignalIds: [],
      evidence: {},
      generatedAt: Date.now(),
    },
  ];

  const results = await service.generateImprovements(signals);
  assert.equal(results.length, 1);
  assert.ok(results[0]?.recommendation.includes("Adopt") || results[0]?.recommendation.includes("canonical"));
});

test("LLMImprovementGenerationService template recommendation for recovery_playbook", async () => {
  const mockProvider = createMockProvider({ content: "invalid" });
  const service = new LLMImprovementGenerationService({ provider: mockProvider as any });

  const signals: readonly LearningSignal[] = [
    {
      learningSignalId: "ls_8",
      taskId: "task_8",
      sourceFeedbackId: "fb_8",
      learningType: "recovery_playbook",
      confidence: 0.8,
      valueSummary: "recovery was successful",
      evidenceRefs: ["ref3"],
      sourceSignalIds: [],
      relatedSignalIds: [],
      evidence: {},
      generatedAt: Date.now(),
    },
  ];

  const results = await service.generateImprovements(signals);
  assert.equal(results.length, 1);
  assert.ok(results[0]?.recommendation.includes("Automate") || results[0]?.recommendation.includes("recovery"));
});
