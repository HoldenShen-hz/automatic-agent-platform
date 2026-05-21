/**
 * Tests for src/platform/contracts/result-envelope/result-envelope.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import {
  buildTaskResultEnvelope,
  buildStepResultEnvelope,
  type ResultEnvelope,
  type ResultEnvelopeStatus,
  type ResultEnvelopeError,
} from "../../../../src/platform/contracts/result-envelope/result-envelope.js";

describe("contracts/result-envelope", () => {
  describe("ResultEnvelopeStatus", () => {
    it("should be one of success, partial, error", () => {
      const statuses: ResultEnvelopeStatus[] = ["success", "partial", "error"];
      assert.deepStrictEqual(statuses, ["success", "partial", "error"]);
    });
  });

  describe("buildTaskResultEnvelope", () => {
    it("should return null when task has no output and no step outputs or artifacts", () => {
      const result = buildTaskResultEnvelope({
        task: {
          id: "task-1",
          tenantId: "tenant-1",
          status: "pending",
          title: "Test Task",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
          outputJson: null,
        },
        workflowState: null,
        stepOutputs: [],
        artifacts: [],
      });
      assert.strictEqual(result, null);
    });

    it("should build result envelope with success status for done task", () => {
      const result = buildTaskResultEnvelope({
        task: {
          id: "task-1",
          tenantId: "tenant-1",
          status: "done",
          title: "Test Task",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
          outputJson: JSON.stringify({ result: "success" }),
        },
        workflowState: null,
        stepOutputs: [],
        artifacts: [],
      });
      assert.notStrictEqual(result, null);
      assert.strictEqual(result!.status, "success");
      assert.strictEqual(result!.resultId, "task-1");
    });

    it("should build result envelope with error status for failed task", () => {
      const result = buildTaskResultEnvelope({
        task: {
          id: "task-1",
          tenantId: "tenant-1",
          status: "failed",
          title: "Test Task",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
          outputJson: JSON.stringify({ error: "something went wrong" }),
          errorCode: "task.failed",
        },
        workflowState: null,
        stepOutputs: [],
        artifacts: [],
      });
      assert.notStrictEqual(result, null);
      assert.strictEqual(result!.status, "error");
      assert.notStrictEqual(result!.error, null);
      assert.strictEqual(result!.error!.code, "task.failed");
    });

    it("should build result envelope with partial status for pending task", () => {
      const result = buildTaskResultEnvelope({
        task: {
          id: "task-1",
          tenantId: "tenant-1",
          status: "in_progress",
          title: "Test Task",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
          outputJson: JSON.stringify({ progress: 50 }),
        },
        workflowState: null,
        stepOutputs: [],
        artifacts: [],
      });
      assert.notStrictEqual(result, null);
      assert.strictEqual(result!.status, "partial");
    });

    it("should aggregate step output metrics", () => {
      const result = buildTaskResultEnvelope({
        task: {
          id: "task-1",
          tenantId: "tenant-1",
          status: "done",
          title: "Test Task",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
          outputJson: JSON.stringify({ summary: "task completed" }),
        },
        workflowState: {
          workflowId: "wf-1",
          status: "running",
          taskId: "task-1",
          currentStepIndex: 1,
          steps: [],
        },
        stepOutputs: [
          {
            id: "step-1",
            taskId: "task-1",
            nodeRunId: "node-1",
            roleId: "role-1",
            status: "succeeded",
            dataJson: "{}",
            summary: "Step 1",
            createdAt: "2024-01-01T00:00:00Z",
            producedAt: "2024-01-01T00:01:00Z",
            tokenCost: 100,
            durationMs: 500,
            stepId: "step-1",
            artifactsJson: null,
            validationJson: null,
          },
          {
            id: "step-2",
            taskId: "task-1",
            nodeRunId: "node-2",
            roleId: "role-1",
            status: "succeeded",
            dataJson: "{}",
            summary: "Step 2",
            createdAt: "2024-01-01T00:01:00Z",
            producedAt: "2024-01-01T00:02:00Z",
            tokenCost: 200,
            durationMs: 1000,
            stepId: "step-2",
            artifactsJson: null,
            validationJson: null,
          },
        ],
        artifacts: [],
      });
      assert.notStrictEqual(result, null);
      assert.notStrictEqual(result!.metrics, null);
      assert.strictEqual(result!.metrics!.tokenCost, 300);
      assert.strictEqual(result!.metrics!.durationMs, 1500);
    });

    it("should include provenance information", () => {
      const result = buildTaskResultEnvelope({
        task: {
          id: "task-1",
          tenantId: "tenant-1",
          status: "done",
          title: "Test Task",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:05:00Z",
          completedAt: "2024-01-01T00:05:00Z",
          outputJson: JSON.stringify({ result: "done" }),
        },
        workflowState: {
          workflowId: "wf-1",
          status: "completed",
          taskId: "task-1",
          currentStepIndex: 2,
          steps: [],
        },
        stepOutputs: [],
        artifacts: [],
      });
      assert.notStrictEqual(result, null);
      assert.deepStrictEqual(result!.provenance, {
        entity: "task",
        taskId: "task-1",
        workflowId: "wf-1",
        workflowStatus: "completed",
        updatedAt: "2024-01-01T00:05:00Z",
        completedAt: "2024-01-01T00:05:00Z",
        stepCount: 0,
      });
    });
  });

  describe("buildStepResultEnvelope", () => {
    it("should build result envelope with success status for succeeded step", () => {
      const stepOutput = {
        id: "step-1",
        taskId: "task-1",
        nodeRunId: "node-1",
        roleId: "role-1",
        status: "succeeded" as const,
        dataJson: JSON.stringify({ output: "result" }),
        summary: "Step completed",
        createdAt: "2024-01-01T00:00:00Z",
        producedAt: "2024-01-01T00:01:00Z",
        tokenCost: 50,
        durationMs: 200,
        stepId: "step-1",
        artifactsJson: null,
        validationJson: null,
      };
      const result = buildStepResultEnvelope(stepOutput, []);
      assert.strictEqual(result.status, "success");
      assert.strictEqual(result.resultId, "step-1");
      assert.deepStrictEqual(result.metrics, { tokenCost: 50, durationMs: 200 });
    });

    it("should build result envelope with error status for failed step", () => {
      const stepOutput = {
        id: "step-1",
        taskId: "task-1",
        nodeRunId: "node-1",
        roleId: "role-1",
        status: "failed" as const,
        dataJson: JSON.stringify({ error: "step failed" }),
        summary: "Step failed",
        createdAt: "2024-01-01T00:00:00Z",
        producedAt: "2024-01-01T00:01:00Z",
        tokenCost: 50,
        durationMs: 200,
        stepId: "step-1",
        artifactsJson: null,
        validationJson: null,
      };
      const result = buildStepResultEnvelope(stepOutput, []);
      assert.strictEqual(result.status, "error");
      assert.notStrictEqual(result.error, null);
      assert.strictEqual(result.error!.code, "step_output.failed");
    });

    it("should build result envelope with partial status for partial_success step", () => {
      const stepOutput = {
        id: "step-1",
        taskId: "task-1",
        nodeRunId: "node-1",
        roleId: "role-1",
        status: "partial_success" as const,
        dataJson: JSON.stringify({ warning: "partial" }),
        summary: "Step partially succeeded",
        createdAt: "2024-01-01T00:00:00Z",
        producedAt: "2024-01-01T00:01:00Z",
        tokenCost: 50,
        durationMs: 200,
        stepId: "step-1",
        artifactsJson: null,
        validationJson: null,
      };
      const result = buildStepResultEnvelope(stepOutput, []);
      assert.strictEqual(result.status, "partial");
      assert.ok(result.warnings.includes("partial_success"));
    });

    it("should extract human summary from structured data", () => {
      const stepOutput = {
        id: "step-1",
        taskId: "task-1",
        nodeRunId: "node-1",
        roleId: "role-1",
        status: "succeeded" as const,
        dataJson: JSON.stringify({ humanSummary: "Custom summary from data" }),
        summary: null,
        createdAt: "2024-01-01T00:00:00Z",
        producedAt: "2024-01-01T00:01:00Z",
        tokenCost: 50,
        durationMs: 200,
        stepId: "step-1",
        artifactsJson: null,
        validationJson: null,
      };
      const result = buildStepResultEnvelope(stepOutput, []);
      assert.strictEqual(result.humanSummary, "Custom summary from data");
    });

    it("should include provenance with nodeRunId", () => {
      const stepOutput = {
        id: "step-1",
        taskId: "task-1",
        nodeRunId: "node-123",
        roleId: "role-1",
        status: "succeeded" as const,
        dataJson: "{}",
        summary: null,
        createdAt: "2024-01-01T00:00:00Z",
        producedAt: "2024-01-01T00:01:00Z",
        tokenCost: 50,
        durationMs: 200,
        stepId: "step-1",
        artifactsJson: null,
        validationJson: null,
      };
      const result = buildStepResultEnvelope(stepOutput, []);
      assert.deepStrictEqual(result.provenance, {
        entity: "step_output",
        taskId: "task-1",
        nodeRunId: "node-123",
        roleId: "role-1",
        producedAt: "2024-01-01T00:01:00Z",
      });
    });
  });
});