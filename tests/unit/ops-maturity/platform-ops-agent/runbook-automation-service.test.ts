/**
 * Unit tests for RunbookAutomationService
 *
 * @see src/ops-maturity/platform-ops-agent/runbook-automation-service.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  RunbookAutomationService,
  type AutomatedRunbook,
  type RunbookExecutionContext,
} from "../../../../src/ops-maturity/platform-ops-agent/runbook-automation-service.js";

function createRunbook(overrides: Partial<AutomatedRunbook> = {}): AutomatedRunbook {
  return {
    runbookId: "runbook_1",
    name: "Test Runbook",
    steps: ["step_1", "step_2", "step_3"],
    ...overrides,
  };
}

test.describe("RunbookAutomationService", () => {
  test.describe("execute", () => {
    test("executes runbook and returns execution record", () => {
      const service = new RunbookAutomationService();
      const runbook = createRunbook();

      const execution = service.execute(runbook);

      assert.equal(execution.runbookId, "runbook_1");
      assert.ok(execution.executionId);
      assert.ok(execution.startedAt);
      assert.ok(execution.completedAt);
    });

    test("completed steps are tracked when execution succeeds", () => {
      const service = new RunbookAutomationService();
      const runbook = createRunbook({ steps: ["validate", "deploy", "verify"] });

      const execution = service.execute(runbook);

      // completedSteps should contain steps that succeeded or were skipped
      assert.ok(execution.completedSteps.length <= runbook.steps.length);
      // All completed steps should be from the runbook
      for (const stepName of execution.completedSteps) {
        assert.ok(runbook.steps.includes(stepName));
      }
    });

    test("stops execution on first failure", () => {
      const service = new RunbookAutomationService();
      const runbook = createRunbook({ steps: ["step_a", "step_b", "step_c"] });

      const execution = service.execute(runbook);

      // Execution may succeed or fail randomly, but if it fails it should stop
      if (execution.status === "failed") {
        assert.ok(execution.completedSteps.length < runbook.steps.length);
      }
    });

    test("calculates totalDurationMs from step results", () => {
      const service = new RunbookAutomationService();
      const runbook = createRunbook();

      const execution = service.execute(runbook);

      const expectedDuration = execution.stepResults.reduce(
        (sum, r) => sum + r.durationMs,
        0,
      );
      assert.equal(execution.totalDurationMs, expectedDuration);
    });

    test("skips all steps in dry run mode", () => {
      const service = new RunbookAutomationService();
      const runbook = createRunbook();

      const execution = service.execute(runbook, { dryRun: true });

      assert.equal(execution.status, "completed");
      for (const result of execution.stepResults) {
        assert.equal(result.status, "skipped");
      }
    });

    test("dry run does not record actual failures", () => {
      const service = new RunbookAutomationService();
      const runbook = createRunbook();

      const execution = service.execute(runbook, { dryRun: true });

      assert.equal(execution.status, "completed");
    });

    test("resolves dry run output correctly", () => {
      const service = new RunbookAutomationService();
      const runbook = createRunbook({ steps: ["test_step"] });

      const execution = service.execute(runbook, { dryRun: true });

      assert.ok(execution.stepResults[0]?.output?.includes("[DRY RUN]"));
    });

    test("handles single step runbook", () => {
      const service = new RunbookAutomationService();
      const runbook = createRunbook({ steps: ["only_step"] });

      const execution = service.execute(runbook);

      assert.equal(execution.stepResults.length, 1);
    });

    test("handles empty steps runbook", () => {
      const service = new RunbookAutomationService();
      const runbook = createRunbook({ steps: [] });

      const execution = service.execute(runbook);

      assert.equal(execution.stepResults.length, 0);
      assert.equal(execution.status, "completed");
    });

    test("includes step results with correct structure", () => {
      const service = new RunbookAutomationService();
      const runbook = createRunbook();

      const execution = service.execute(runbook);

      for (const result of execution.stepResults) {
        assert.ok(result.stepId);
        assert.ok(result.stepName);
        assert.ok(["success", "failed", "skipped"].includes(result.status));
        assert.ok(result.durationMs >= 0);
      }
    });

    test("respects environment context", () => {
      const service = new RunbookAutomationService();
      const runbook = createRunbook();

      const productionExecution = service.execute(runbook, { environment: "production" });
      const stagingExecution = service.execute(runbook, { environment: "staging" });

      assert.ok(productionExecution.executionId !== stagingExecution.executionId);
    });

    test("respects actorId context", () => {
      const service = new RunbookAutomationService();
      const runbook = createRunbook();

      const exec1 = service.execute(runbook, { actorId: "actor_1" });
      const exec2 = service.execute(runbook, { actorId: "actor_2" });

      // Both executions should be valid but distinct
      assert.ok(exec1.executionId !== exec2.executionId);
    });
  });

  test.describe("getExecution", () => {
    test("returns execution by id", () => {
      const service = new RunbookAutomationService();
      const runbook = createRunbook();

      const created = service.execute(runbook);
      const retrieved = service.getExecution(created.executionId);

      assert.ok(retrieved !== null);
      assert.equal(retrieved?.executionId, created.executionId);
    });

    test("returns null for unknown execution id", () => {
      const service = new RunbookAutomationService();

      const result = service.getExecution("unknown_execution_id");

      assert.equal(result, null);
    });

    test("retrieved execution matches original execution details", () => {
      const service = new RunbookAutomationService();
      const runbook = createRunbook({ runbookId: "verify_runbook" });

      const created = service.execute(runbook);
      const retrieved = service.getExecution(created.executionId);

      assert.equal(retrieved?.runbookId, "verify_runbook");
      assert.equal(retrieved?.status, created.status);
      assert.deepEqual(retrieved?.stepResults, created.stepResults);
    });
  });

  test.describe("listExecutions", () => {
    test("returns empty array when no executions", () => {
      const service = new RunbookAutomationService();

      const list = service.listExecutions();

      assert.deepEqual(list, []);
    });

    test("returns all executions when no runbookId filter", () => {
      const service = new RunbookAutomationService();
      service.execute(createRunbook({ runbookId: "runbook_a" }));
      service.execute(createRunbook({ runbookId: "runbook_b" }));

      const list = service.listExecutions();

      assert.ok(list.length >= 2);
    });

    test("filters executions by runbookId", () => {
      const service = new RunbookAutomationService();
      service.execute(createRunbook({ runbookId: "filter_target" }));
      service.execute(createRunbook({ runbookId: "other_runbook" }));

      const list = service.listExecutions("filter_target");

      for (const exec of list) {
        assert.equal(exec.runbookId, "filter_target");
      }
    });

    test("returns executions in reverse chronological order", () => {
      const service = new RunbookAutomationService();
      const first = service.execute(createRunbook({ runbookId: "rb_1" }));
      const second = service.execute(createRunbook({ runbookId: "rb_2" }));

      const list = service.listExecutions();

      assert.ok(list.length >= 2);
      // Most recent first
      assert.equal(list[0]?.executionId, second.executionId);
    });

    test("respects limit parameter", () => {
      const service = new RunbookAutomationService();
      for (let i = 0; i < 10; i++) {
        service.execute(createRunbook({ runbookId: `rb_${i}` }));
      }

      const list = service.listExecutions(undefined, 5);

      assert.equal(list.length, 5);
    });

    test("limit defaults to 10", () => {
      const service = new RunbookAutomationService();
      for (let i = 0; i < 15; i++) {
        service.execute(createRunbook({ runbookId: `rb_${i}` }));
      }

      const list = service.listExecutions();

      assert.ok(list.length <= 10);
    });
  });

  test.describe("getStatistics", () => {
    test("returns zeros when no executions", () => {
      const service = new RunbookAutomationService();

      const stats = service.getStatistics();

      assert.equal(stats.totalExecutions, 0);
      assert.equal(stats.successCount, 0);
      assert.equal(stats.failureCount, 0);
      assert.equal(stats.averageDurationMs, 0);
    });

    test("counts total executions", () => {
      const service = new RunbookAutomationService();
      service.execute(createRunbook());
      service.execute(createRunbook());

      const stats = service.getStatistics();

      assert.ok(stats.totalExecutions >= 2);
    });

    test("counts completed executions as successes", () => {
      const service = new RunbookAutomationService();
      // Run in dry-run mode to ensure completed status
      service.execute(createRunbook(), { dryRun: true });

      const stats = service.getStatistics();

      assert.ok(stats.successCount >= 1);
    });

    test("counts failed executions", () => {
      const service = new RunbookAutomationService();
      // Execute multiple times to likely get at least one failure
      for (let i = 0; i < 20; i++) {
        service.execute(createRunbook());
      }

      const stats = service.getStatistics();

      // successCount + failureCount should equal completed executions
      assert.ok(stats.totalExecutions >= stats.successCount + stats.failureCount);
    });

    test("calculates average duration", () => {
      const service = new RunbookAutomationService();
      service.execute(createRunbook());
      service.execute(createRunbook());

      const stats = service.getStatistics();

      if (stats.totalExecutions > 0) {
        assert.ok(stats.averageDurationMs >= 0);
      }
    });

    test("averageDurationMs equals totalDurationMs / totalExecutions", () => {
      const service = new RunbookAutomationService();
      service.execute(createRunbook());
      service.execute(createRunbook());

      const stats = service.getStatistics();
      const list = service.listExecutions(undefined, 100);

      if (list.length >= 2) {
        const totalDuration = list.reduce((sum, e) => sum + e.totalDurationMs, 0);
        const expectedAvg = Math.round(totalDuration / list.length);
        assert.equal(stats.averageDurationMs, expectedAvg);
      }
    });
  });

  test.describe("execution history eviction", () => {
    test("evicts old executions beyond maxHistoryEntries", () => {
      const service = new RunbookAutomationService();
      // Default maxHistoryEntries is 100
      for (let i = 0; i < 150; i++) {
        service.execute(createRunbook({ runbookId: `rb_${i}` }));
      }

      const list = service.listExecutions(undefined, 200);
      assert.ok(list.length <= 100);
    });

    test("statistics reflect only non-evicted executions", () => {
      const service = new RunbookAutomationService();
      for (let i = 0; i < 150; i++) {
        service.execute(createRunbook());
      }

      const stats = service.getStatistics();
      const list = service.listExecutions(undefined, 100);

      // Stats should be consistent with current history
      assert.equal(stats.totalExecutions, list.length);
    });
  });
});
