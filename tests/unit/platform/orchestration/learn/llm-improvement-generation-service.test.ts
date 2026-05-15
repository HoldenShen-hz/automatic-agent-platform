import assert from "node:assert/strict";
import test from "node:test";

import type { LearningSignal } from "../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";
import type { UnifiedChatProvider, ChatMessage } from "../../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js";
import { LLMImprovementGenerationService } from "../../../../../src/platform/five-plane-orchestration/learn/llm-improvement-generation-service.js";
import type { LearningObject } from "../../../../../src/platform/five-plane-orchestration/learn/learning-object-model.js";

function makeSignal(overrides: Partial<LearningSignal> = {}): LearningSignal {
  return {
    learningSignalId: overrides.learningSignalId ?? "sig-1",
    taskId: overrides.taskId ?? "task-1",
    sourceFeedbackId: overrides.sourceFeedbackId ?? "feedback-1",
    learningType: overrides.learningType ?? "failure_pattern",
    valueSummary: overrides.valueSummary ?? "Step failed with validation error",
    confidence: overrides.confidence ?? 0.8,
    evidence: overrides.evidence ?? { stepId: "step-1" },
    evidenceRefs: overrides.evidenceRefs ?? [],
    sourceSignalIds: overrides.sourceSignalIds ?? [],
    relatedSignalIds: overrides.relatedSignalIds ?? [],
    generatedAt: overrides.generatedAt ?? Date.now(),
  };
}

function createMockProvider(responses: Array<{ content: string }>): Partial<UnifiedChatProvider> {
  let callCount = 0;
  return {
    createChatCompletion: async (args: {
      model: string;
      messages: ChatMessage[];
      maxTokens: number;
      temperature: number;
    }) => {
      const response = responses[callCount % responses.length];
      callCount++;
      return { content: response.content };
    },
  };
}

test("LLMImprovementGenerationService.generateImprovements returns empty array for empty signals", async () => {
  const mockProvider = createMockProvider([]);
  const service = new LLMImprovementGenerationService({ provider: mockProvider as UnifiedChatProvider });

  const result = await service.generateImprovements([]);

  assert.deepEqual(result, []);
});

test("LLMImprovementGenerationService.generateImprovements returns fallback objects when LLM returns empty content", async () => {
  const mockProvider = createMockProvider([{ content: "" }]);
  const service = new LLMImprovementGenerationService({ provider: mockProvider as UnifiedChatProvider });
  const signals = [makeSignal({ learningSignalId: "sig-1", learningType: "failure_pattern" })];

  const result = await service.generateImprovements(signals);

  assert.equal(result.length, 1);
  assert.equal(result[0]!.learningType, "failure_pattern");
  assert.equal(result[0]!.learningObjectId.startsWith("learning_"), true);
});

test("LLMImprovementGenerationService.generateImprovements uses fallback template for failure_pattern", async () => {
  const mockProvider = createMockProvider([{ content: "" }]);
  const service = new LLMImprovementGenerationService({ provider: mockProvider as UnifiedChatProvider });
  const signals = [makeSignal({ learningSignalId: "sig-1", learningType: "failure_pattern", valueSummary: "Test failure" })];

  const result = await service.generateImprovements(signals);

  assert.equal(result[0]!.learningType, "failure_pattern");
  assert.ok(result[0]!.recommendation.includes("Analyze the root cause"));
});

test("LLMImprovementGenerationService.generateImprovements uses fallback template for user_correction", async () => {
  const mockProvider = createMockProvider([{ content: "" }]);
  const service = new LLMImprovementGenerationService({ provider: mockProvider as UnifiedChatProvider });
  const signals = [makeSignal({ learningSignalId: "sig-1", learningType: "user_correction", valueSummary: "User corrected the approach" })];

  const result = await service.generateImprovements(signals);

  assert.equal(result[0]!.learningType, "user_correction");
  assert.ok(result[0]!.recommendation.includes("Adopt the user's correction"));
});

test("LLMImprovementGenerationService.generateImprovements uses fallback template for recovery_playbook", async () => {
  const mockProvider = createMockProvider([{ content: "" }]);
  const service = new LLMImprovementGenerationService({ provider: mockProvider as UnifiedChatProvider });
  const signals = [makeSignal({ learningSignalId: "sig-1", learningType: "recovery_playbook", valueSummary: "Recovery action was taken" })];

  const result = await service.generateImprovements(signals);

  assert.equal(result[0]!.learningType, "recovery_playbook");
  assert.ok(result[0]!.recommendation.includes("Automate the recovery steps"));
});

test("LLMImprovementGenerationService.generateImprovements uses fallback template for model_retraining", async () => {
  const mockProvider = createMockProvider([{ content: "" }]);
  const service = new LLMImprovementGenerationService({ provider: mockProvider as UnifiedChatProvider });
  const signals = [makeSignal({ learningSignalId: "sig-1", learningType: "model_retraining", valueSummary: "Model underperformed" })];

  const result = await service.generateImprovements(signals);

  assert.equal(result[0]!.learningType, "model_retraining");
  assert.ok(result[0]!.recommendation.includes("Initiate model retraining"));
});

test("LLMImprovementGenerationService.generateImprovements uses fallback template for dataset_gap", async () => {
  const mockProvider = createMockProvider([{ content: "" }]);
  const service = new LLMImprovementGenerationService({ provider: mockProvider as UnifiedChatProvider });
  const signals = [makeSignal({ learningSignalId: "sig-1", learningType: "dataset_gap", valueSummary: "Missing training data" })];

  const result = await service.generateImprovements(signals);

  assert.equal(result[0]!.learningType, "dataset_gap");
  assert.ok(result[0]!.recommendation.includes("Collect training data"));
});

test("LLMImprovementGenerationService.generateImprovements parses valid JSON array from LLM response", async () => {
  const mockProvider = createMockProvider([{
    content: JSON.stringify([
      {
        learningType: "failure_pattern",
        title: "Test Title",
        summary: "Test Summary",
        confidence: 0.9,
        recommendation: "Take action",
      },
    ]),
  }]);
  const service = new LLMImprovementGenerationService({ provider: mockProvider as UnifiedChatProvider });
  const signals = [makeSignal({ learningSignalId: "sig-1", learningType: "failure_pattern" })];

  const result = await service.generateImprovements(signals);

  assert.equal(result.length, 1);
  assert.equal(result[0]!.learningType, "failure_pattern");
  assert.equal(result[0]!.title, "Test Title");
  assert.equal(result[0]!.summary, "Test Summary");
  assert.equal(result[0]!.confidence, 0.9);
  assert.equal(result[0]!.recommendation, "Take action");
});

test("LLMImprovementGenerationService.generateImprovements falls back to template when JSON has no array match", async () => {
  const mockProvider = createMockProvider([{ content: "This is not JSON array format" }]);
  const service = new LLMImprovementGenerationService({ provider: mockProvider as UnifiedChatProvider });
  const signals = [makeSignal({ learningSignalId: "sig-1", learningType: "failure_pattern" })];

  const result = await service.generateImprovements(signals);

  assert.equal(result.length, 1);
  assert.equal(result[0]!.learningType, "failure_pattern");
});

test("LLMImprovementGenerationService.generateImprovements falls back to template when JSON parsing fails", async () => {
  const mockProvider = createMockProvider([{ content: "[{ invalid json }]" }]);
  const service = new LLMImprovementGenerationService({ provider: mockProvider as UnifiedChatProvider });
  const signals = [makeSignal({ learningSignalId: "sig-1", learningType: "failure_pattern" })];

  const result = await service.generateImprovements(signals);

  assert.equal(result.length, 1);
  assert.equal(result[0]!.learningType, "failure_pattern");
});

test("LLMImprovementGenerationService.generateImprovements processes multiple signals", async () => {
  const mockProvider = createMockProvider([{
    content: JSON.stringify([
      { learningType: "failure_pattern", title: "First", summary: "Summary 1", confidence: 0.8, recommendation: "Rec 1" },
      { learningType: "user_correction", title: "Second", summary: "Summary 2", confidence: 0.85, recommendation: "Rec 2" },
    ]),
  }]);
  const service = new LLMImprovementGenerationService({ provider: mockProvider as UnifiedChatProvider });
  const signals = [
    makeSignal({ learningSignalId: "sig-1", learningType: "failure_pattern" }),
    makeSignal({ learningSignalId: "sig-2", learningType: "user_correction" }),
  ];

  const result = await service.generateImprovements(signals);

  assert.equal(result.length, 2);
  assert.equal(result[0]!.learningType, "failure_pattern");
  assert.equal(result[1]!.learningType, "user_correction");
});

test("LLMImprovementGenerationService.generateImprovements uses default model when not specified", async () => {
  let capturedModel = "";
  const mockProvider: Partial<UnifiedChatProvider> = {
    createChatCompletion: async (args: {
      model: string;
      messages: ChatMessage[];
      maxTokens: number;
      temperature: number;
    }) => {
      capturedModel = args.model;
      return { content: "" };
    },
  };
  const service = new LLMImprovementGenerationService({ provider: mockProvider as UnifiedChatProvider });

  await service.generateImprovements([makeSignal()]);

  assert.equal(capturedModel, "MiniMax-M2.7");
});

test("LLMImprovementGenerationService.generateImprovements uses custom model when specified", async () => {
  let capturedModel = "";
  const mockProvider: Partial<UnifiedChatProvider> = {
    createChatCompletion: async (args: {
      model: string;
      messages: ChatMessage[];
      maxTokens: number;
      temperature: number;
    }) => {
      capturedModel = args.model;
      return { content: "" };
    },
  };
  const service = new LLMImprovementGenerationService({
    provider: mockProvider as UnifiedChatProvider,
    model: "custom-model",
  });

  await service.generateImprovements([makeSignal()]);

  assert.equal(capturedModel, "custom-model");
});

test("LLMImprovementGenerationService.generateImprovements uses default maxTokens when not specified", async () => {
  let capturedMaxTokens = 0;
  const mockProvider: Partial<UnifiedChatProvider> = {
    createChatCompletion: async (args: {
      model: string;
      messages: ChatMessage[];
      maxTokens: number;
      temperature: number;
    }) => {
      capturedMaxTokens = args.maxTokens;
      return { content: "" };
    },
  };
  const service = new LLMImprovementGenerationService({ provider: mockProvider as UnifiedChatProvider });

  await service.generateImprovements([makeSignal()]);

  assert.equal(capturedMaxTokens, 1024);
});

test("LLMImprovementGenerationService.generateImprovements uses custom maxTokens when specified", async () => {
  let capturedMaxTokens = 0;
  const mockProvider: Partial<UnifiedChatProvider> = {
    createChatCompletion: async (args: {
      model: string;
      messages: ChatMessage[];
      maxTokens: number;
      temperature: number;
    }) => {
      capturedMaxTokens = args.maxTokens;
      return { content: "" };
    },
  };
  const service = new LLMImprovementGenerationService({
    provider: mockProvider as UnifiedChatProvider,
    maxTokens: 500,
  });

  await service.generateImprovements([makeSignal()]);

  assert.equal(capturedMaxTokens, 500);
});

test("LLMImprovementGenerationService.generateImprovements uses default temperature when not specified", async () => {
  let capturedTemperature = 0;
  const mockProvider: Partial<UnifiedChatProvider> = {
    createChatCompletion: async (args: {
      model: string;
      messages: ChatMessage[];
      maxTokens: number;
      temperature: number;
    }) => {
      capturedTemperature = args.temperature;
      return { content: "" };
    },
  };
  const service = new LLMImprovementGenerationService({ provider: mockProvider as UnifiedChatProvider });

  await service.generateImprovements([makeSignal()]);

  assert.equal(capturedTemperature, 0.3);
});

test("LLMImprovementGenerationService.generateImprovements uses custom temperature when specified", async () => {
  let capturedTemperature = 0;
  const mockProvider: Partial<UnifiedChatProvider> = {
    createChatCompletion: async (args: {
      model: string;
      messages: ChatMessage[];
      maxTokens: number;
      temperature: number;
    }) => {
      capturedTemperature = args.temperature;
      return { content: "" };
    },
  };
  const service = new LLMImprovementGenerationService({
    provider: mockProvider as UnifiedChatProvider,
    temperature: 0.7,
  });

  await service.generateImprovements([makeSignal()]);

  assert.equal(capturedTemperature, 0.7);
});

test("LLMImprovementGenerationService.generateImprovements includes system and user messages", async () => {
  let capturedMessages: ChatMessage[] = [];
  const mockProvider: Partial<UnifiedChatProvider> = {
    createChatCompletion: async (args: {
      model: string;
      messages: ChatMessage[];
      maxTokens: number;
      temperature: number;
    }) => {
      capturedMessages = args.messages;
      return { content: "" };
    },
  };
  const service = new LLMImprovementGenerationService({ provider: mockProvider as UnifiedChatProvider });

  await service.generateImprovements([makeSignal()]);

  assert.ok(capturedMessages.length >= 2);
  assert.equal(capturedMessages[0]!.role, "system");
  assert.equal(capturedMessages[1]!.role, "user");
});

test("LLMImprovementGenerationService.generateImprovements sets validatedBy to none", async () => {
  const mockProvider = createMockProvider([{ content: "" }]);
  const service = new LLMImprovementGenerationService({ provider: mockProvider as UnifiedChatProvider });

  const result = await service.generateImprovements([makeSignal()]);

  assert.equal(result[0]!.validatedBy, "none");
});

test("LLMImprovementGenerationService.generateImprovements sets promotionStatus to draft", async () => {
  const mockProvider = createMockProvider([{ content: "" }]);
  const service = new LLMImprovementGenerationService({ provider: mockProvider as UnifiedChatProvider });

  const result = await service.generateImprovements([makeSignal()]);

  assert.equal(result[0]!.promotionStatus, "draft");
});

test("LLMImprovementGenerationService.generateImprovements preserves signal evidenceRefs in fallback", async () => {
  const mockProvider = createMockProvider([{ content: "" }]);
  const service = new LLMImprovementGenerationService({ provider: mockProvider as UnifiedChatProvider });
  const signals = [makeSignal({ evidenceRefs: ["ref-1", "ref-2"] })];

  const result = await service.generateImprovements(signals);

  assert.deepEqual(result[0]!.evidenceRefs, ["ref-1", "ref-2"]);
});

test("LLMImprovementGenerationService.generateImprovements preserves signal sourceSignalIds in fallback", async () => {
  const mockProvider = createMockProvider([{ content: "" }]);
  const service = new LLMImprovementGenerationService({ provider: mockProvider as UnifiedChatProvider });
  const signals = [makeSignal({ sourceSignalIds: ["src-1", "src-2"] })];

  const result = await service.generateImprovements(signals);

  assert.deepEqual(result[0]!.sourceSignalIds, ["src-1", "src-2"]);
});

test("LLMImprovementGenerationService.generateImprovements clamps confidence to 0-1 range", async () => {
  const mockProvider = createMockProvider([{
    content: JSON.stringify([
      { learningType: "failure_pattern", title: "Test", summary: "Test", confidence: 1.5, recommendation: "Test" },
    ]),
  }]);
  const service = new LLMImprovementGenerationService({ provider: mockProvider as UnifiedChatProvider });
  const signals = [makeSignal()];

  const result = await service.generateImprovements(signals);

  assert.equal(result[0]!.confidence, 1.0);
});

test("LLMImprovementGenerationService.generateImprovements clamps negative confidence to 0", async () => {
  const mockProvider = createMockProvider([{
    content: JSON.stringify([
      { learningType: "failure_pattern", title: "Test", summary: "Test", confidence: -0.5, recommendation: "Test" },
    ]),
  }]);
  const service = new LLMImprovementGenerationService({ provider: mockProvider as UnifiedChatProvider });
  const signals = [makeSignal()];

  const result = await service.generateImprovements(signals);

  assert.equal(result[0]!.confidence, 0);
});

test("LLMImprovementGenerationService.generateImprovements uses signal learningType when not provided in response", async () => {
  const mockProvider = createMockProvider([{
    content: JSON.stringify([
      { title: "Test", summary: "Test", confidence: 0.8, recommendation: "Test" },
    ]),
  }]);
  const service = new LLMImprovementGenerationService({ provider: mockProvider as UnifiedChatProvider });
  const signals = [makeSignal({ learningType: "user_correction" })];

  const result = await service.generateImprovements(signals);

  assert.equal(result[0]!.learningType, "user_correction");
});

test("LLMImprovementGenerationService.generateImprovements generates unique learningObjectIds", async () => {
  const mockProvider = createMockProvider([{ content: "" }]);
  const service = new LLMImprovementGenerationService({ provider: mockProvider as UnifiedChatProvider });
  const signals = [makeSignal(), makeSignal(), makeSignal()];

  const result = await service.generateImprovements(signals);

  const ids = result.map((obj) => obj.learningObjectId);
  assert.equal(new Set(ids).size, 3);
});

test("LLMImprovementGenerationService.generateImprovements handles JSON array that is shorter than signals", async () => {
  const mockProvider = createMockProvider([{
    content: JSON.stringify([
      { learningType: "failure_pattern", title: "First", summary: "Summary", confidence: 0.8, recommendation: "Rec" },
    ]),
  }]);
  const service = new LLMImprovementGenerationService({ provider: mockProvider as UnifiedChatProvider });
  const signals = [
    makeSignal({ learningSignalId: "sig-1" }),
    makeSignal({ learningSignalId: "sig-2" }),
    makeSignal({ learningSignalId: "sig-3" }),
  ];

  const result = await service.generateImprovements(signals);

  // Implementation returns only the number of elements in the JSON array
  assert.equal(result.length, 1);
  assert.equal(result[0]!.title, "First");
});

test("LLMImprovementGenerationService.generateImprovements handles malformed JSON in array element", async () => {
  // Use a manually constructed malformed JSON string since JSON.stringify can't create invalid JSON
  const mockProvider = createMockProvider([{
    content: '[{ "learningType": "failure_pattern" }, malformed_element, { "learningType": "user_correction" }]',
  }]);
  const service = new LLMImprovementGenerationService({ provider: mockProvider as UnifiedChatProvider });
  const signals = [
    makeSignal({ learningSignalId: "sig-1", learningType: "failure_pattern" }),
    makeSignal({ learningSignalId: "sig-2", learningType: "user_correction" }),
  ];

  const result = await service.generateImprovements(signals);

  // Should fall back to template generation and return 2 learning objects (one per signal)
  assert.equal(result.length, 2);
});
