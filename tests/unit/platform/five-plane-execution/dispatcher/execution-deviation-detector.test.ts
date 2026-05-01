import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ExecutionDeviationDetector } from "../../../../../src/platform/five-plane-execution/dispatcher/execution-deviation-detector.js";
import type { Plan } from "../../../../../src/platform/orchestration/oapeflir/types/index.js";

describe("ExecutionDeviationDetector", () => {
  describe("detect", () => {
    const createMockPlan = (overrides: Partial<Plan> = {}): Plan =>
      ({
        taskId: "test-task-123",
        workflowId: "test-workflow",
        planId: "test-plan",
        steps: [],
        status: "in_progress",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        ...overrides,
      } as Plan);

    const createMockFeedback = (overrides: {
      outcome?: "repairable" | "failed" | "escalated" | "completed";
      signals?: Array<{ category: string; signal: string }>;
    } = {}) => ({
      outcome: overrides.outcome ?? "completed",
      signals: overrides.signals ?? [],
      batchId: "test-batch",
      collectedAt: "2026-01-01T00:00:00.000Z",
    });

    it("should detect deviation when outcome is repairable", () => {
      const detector = new ExecutionDeviationDetector();
      const plan = createMockPlan();
      const feedback = createMockFeedback({ outcome: "repairable" });

      const deviations = detector.detect(plan, feedback);

      assert.equal(deviations.length, 1);
      assert.equal(deviations[0].severity, "high");
      assert.equal(deviations[0].reasonCode, "execution.repairable");
      assert.equal(deviations[0].taskId, "test-task-123");
    });

    it("should detect deviation when outcome is failed", () => {
      const detector = new ExecutionDeviationDetector();
      const plan = createMockPlan();
      const feedback = createMockFeedback({ outcome: "failed" });

      const deviations = detector.detect(plan, feedback);

      assert.equal(deviations.length, 1);
      assert.equal(deviations[0].severity, "critical");
      assert.equal(deviations[0].reasonCode, "execution.failed");
    });

    it("should detect deviation when outcome is escalated", () => {
      const detector = new ExecutionDeviationDetector();
      const plan = createMockPlan();
      const feedback = createMockFeedback({ outcome: "escalated" });

      const deviations = detector.detect(plan, feedback);

      assert.equal(deviations.length, 1);
      assert.equal(deviations[0].severity, "critical");
      assert.equal(deviations[0].reasonCode, "execution.escalated");
    });

    it("should detect deviation when outcome is completed (no deviation)", () => {
      const detector = new ExecutionDeviationDetector();
      const plan = createMockPlan();
      const feedback = createMockFeedback({ outcome: "completed" });

      const deviations = detector.detect(plan, feedback);

      assert.equal(deviations.length, 0);
    });

    it("should detect timeout signal deviation", () => {
      const detector = new ExecutionDeviationDetector();
      const plan = createMockPlan();
      const feedback = createMockFeedback({
        signals: [{ category: "timeout", signal: "execution_timed_out" }],
      });

      const deviations = detector.detect(plan, feedback);

      assert.equal(deviations.length, 1);
      assert.equal(deviations[0].severity, "high");
      assert.equal(deviations[0].reasonCode, "execution.timeout");
    });

    it("should not detect timeout for non-timeout signals", () => {
      const detector = new ExecutionDeviationDetector();
      const plan = createMockPlan();
      const feedback = createMockFeedback({
        signals: [{ category: "performance", signal: "slow_response" }],
      });

      const deviations = detector.detect(plan, feedback);

      assert.equal(deviations.length, 0);
    });

    it("should detect multiple deviations from different feedback conditions", () => {
      const detector = new ExecutionDeviationDetector();
      const plan = createMockPlan();
      const feedback = createMockFeedback({
        outcome: "repairable",
        signals: [{ category: "timeout", signal: "execution_timed_out" }],
      });

      const deviations = detector.detect(plan, feedback);

      assert.equal(deviations.length, 2);
      assert.ok(deviations.some((d) => d.reasonCode === "execution.repairable"));
      assert.ok(deviations.some((d) => d.reasonCode === "execution.timeout"));
    });

    it("should generate unique deviation IDs", () => {
      const detector = new ExecutionDeviationDetector();
      const plan = createMockPlan();
      const feedback = createMockFeedback({
        outcome: "failed",
        signals: [{ category: "timeout", signal: "execution_timed_out" }],
      });

      const deviations = detector.detect(plan, feedback);

      assert.equal(deviations.length, 2);
      assert.notEqual(deviations[0].deviationId, deviations[1].deviationId);
    });

    it("should use plan.taskId in deviation", () => {
      const detector = new ExecutionDeviationDetector();
      const plan = createMockPlan({ taskId: "specific-task-id" });
      const feedback = createMockFeedback({ outcome: "failed" });

      const deviations = detector.detect(plan, feedback);

      assert.equal(deviations[0].taskId, "specific-task-id");
    });

    it("should include detectedAt timestamp", () => {
      const detector = new ExecutionDeviationDetector();
      const plan = createMockPlan();
      const feedback = createMockFeedback({ outcome: "failed" });

      const before = Date.now();
      const deviations = detector.detect(plan, feedback);
      const after = Date.now();

      assert.ok(deviations[0].detectedAt >= before);
      assert.ok(deviations[0].detectedAt <= after);
    });
  });
});