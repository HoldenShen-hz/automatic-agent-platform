import test from "node:test";
import assert from "node:assert/strict";

import { ApprovalContextSummaryService, type ExecutionContextForSummary } from "../../../../../src/platform/orchestration/hitl/approval-context-summary-service.js";

const createMockProvider = (response: { content: string }) => ({
  createChatCompletion: async () => ({
    content: response.content,
    id: "mock",
    finishReason: "stop",
    toolCalls: [],
    usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    model: "mock",
    provider: "mock",
  }),
  createStreamingChatCompletion: async () => { /* noop */ },
  hasProvider: () => true,
  dispose: () => {},
});

test("ApprovalContextSummaryService generates summary for basic context", async () => {
  const mockResponse = JSON.stringify({
    summary: "Task requires approval due to high risk level",
    keyPoints: ["High risk operation", "3 errors encountered", "Risk level: critical"],
    riskFactors: ["Critical risk requires explicit approval"],
    recommendedAction: "Review carefully before approving",
    confidence: 0.85,
  });

  const mockProvider = createMockProvider({ content: mockResponse });
  const service = new ApprovalContextSummaryService({ provider: mockProvider as any });

  const context: ExecutionContextForSummary = {
    taskId: "task_1",
    executionId: "exec_1",
    title: "High risk task",
    stageRef: "execute",
    riskLevel: "critical",
    errorCount: 3,
    retryCount: 1,
  };

  const result = await service.generateSummary(context);

  assert.equal(result.taskId, "task_1");
  assert.equal(result.executionId, "exec_1");
  assert.ok(result.summary.length > 0);
  assert.ok(result.keyPoints.length >= 0);
});

test("ApprovalContextSummaryService falls back to template on invalid JSON", async () => {
  const mockProvider = createMockProvider({ content: "This is not valid JSON" });
  const service = new ApprovalContextSummaryService({ provider: mockProvider as any });

  const context: ExecutionContextForSummary = {
    taskId: "task_2",
    executionId: null,
    stageRef: "plan",
    riskLevel: "medium",
  };

  const result = await service.generateSummary(context);

  assert.equal(result.taskId, "task_2");
  assert.ok(result.summary.length > 0);
  assert.equal(result.confidence, 0.4);
});

test("ApprovalContextSummaryService falls back on non-JSON response", async () => {
  const mockProvider = createMockProvider({ content: "Some text response without JSON" });
  const service = new ApprovalContextSummaryService({ provider: mockProvider as any });

  const context: ExecutionContextForSummary = {
    taskId: "task_3",
    stageRef: "assess",
    riskLevel: "low",
  };

  const result = await service.generateSummary(context);

  assert.equal(result.taskId, "task_3");
  assert.ok(result.summary.length > 0);
});

test("ApprovalContextSummaryService template summary for error context", async () => {
  const mockProvider = createMockProvider({ content: "invalid" });
  const service = new ApprovalContextSummaryService({ provider: mockProvider as any });

  const context: ExecutionContextForSummary = {
    taskId: "task_4",
    stageRef: "execute",
    riskLevel: "high",
    errorCount: 5,
    retryCount: 3,
  };

  const result = await service.generateSummary(context);

  assert.ok(result.summary.includes("task_4") || result.summary.includes("error"));
  assert.ok(result.keyPoints.some((p: string) => p.includes("error") || p.includes("5")));
});

test("ApprovalContextSummaryService template summary for blocked context", async () => {
  const mockProvider = createMockProvider({ content: "invalid" });
  const service = new ApprovalContextSummaryService({ provider: mockProvider as any });

  const context: ExecutionContextForSummary = {
    taskId: "task_5",
    stageRef: "feedback",
    riskLevel: "medium",
    blockers: ["Waiting for user input", "Resource unavailable"],
  };

  const result = await service.generateSummary(context);

  assert.ok(result.summary.includes("blocked") || result.keyPoints.some((p: string) => p.includes("blocker")));
});

test("ApprovalContextSummaryService handles context with completed steps", async () => {
  const mockProvider = createMockProvider({ content: "invalid" });
  const service = new ApprovalContextSummaryService({ provider: mockProvider as any });

  const context: ExecutionContextForSummary = {
    taskId: "task_6",
    executionId: "exec_6",
    stageRef: "execute",
    riskLevel: "medium",
    completedSteps: [
      { stepId: "step_1", stepName: "Validate input", status: "completed", durationMs: 100 },
      { stepId: "step_2", stepName: "Process data", status: "completed", durationMs: 500 },
      { stepId: "step_3", stepName: "Generate output", status: "failed" },
    ],
  };

  const result = await service.generateSummary(context);

  assert.ok(result.keyPoints.some((p: string) => p.includes("3 step") || p.includes("execute")));
});

test("ApprovalContextSummaryService uses custom model configuration", async () => {
  const mockProvider = createMockProvider({ content: "[]" });
  const service = new ApprovalContextSummaryService({
    provider: mockProvider as any,
    model: "custom-model",
    maxTokens: 500,
    temperature: 0.5,
  });

  const context: ExecutionContextForSummary = {
    taskId: "task_7",
    stageRef: "plan",
    riskLevel: "low",
  };

  const result = await service.generateSummary(context);
  assert.equal(result.taskId, "task_7");
});

test("ApprovalContextSummaryService handles empty context", async () => {
  const mockProvider = createMockProvider({ content: "invalid" });
  const service = new ApprovalContextSummaryService({ provider: mockProvider as any });

  const context: ExecutionContextForSummary = {
    taskId: "task_8",
  };

  const result = await service.generateSummary(context);

  assert.equal(result.taskId, "task_8");
  assert.ok(result.summary.length > 0);
});
