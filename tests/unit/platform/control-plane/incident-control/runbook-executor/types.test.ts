/**
 * Unit tests for Runbook Executor Types
 */

import assert from "node:assert/strict";
import test from "node:test";
import type {
  RunbookStep,
  RunbookSection,
  ParsedRunbook,
  RunbookStepStatus,
  RunbookStepResult,
  RunbookExecutionStatus,
  RunbookExecutionResult,
  RunbookSectionExecutionResult,
  RunbookExecutorConfig,
  RunbookExecutionContext,
} from "../../../../../../src/platform/five-plane-control-plane/incident-control/runbook-executor/types.js";
import { DEFAULT_RUNBOOK_EXECUTOR_CONFIG } from "../../../../../../src/platform/five-plane-control-plane/incident-control/runbook-executor/types.js";

test("RunbookStepStatus is a string union type", () => {
  const statuses: RunbookStepStatus[] = [
    "pending",
    "running",
    "completed",
    "failed",
    "skipped",
    "requires_confirmation",
  ];

  assert.equal(statuses.length, 6);
  assert.ok(statuses.includes("pending"));
  assert.ok(statuses.includes("completed"));
  assert.ok(statuses.includes("requires_confirmation"));
});

test("RunbookExecutionStatus is a string union type", () => {
  const statuses: RunbookExecutionStatus[] = [
    "initialized",
    "running",
    "paused",
    "completed",
    "failed",
    "aborted",
  ];

  assert.equal(statuses.length, 6);
  assert.ok(statuses.includes("initialized"));
  assert.ok(statuses.includes("completed"));
  assert.ok(statuses.includes("aborted"));
});

test("RunbookStep can be used as a type", () => {
  const step: RunbookStep = {
    stepNumber: 1,
    command: "kubectl rollout status",
    requiresConfirmation: true,
  };

  assert.equal(step.stepNumber, 1);
  assert.equal(step.command, "kubectl rollout status");
  assert.equal(step.requiresConfirmation, true);
});

test("RunbookSection can be used as a type", () => {
  const section: RunbookSection = {
    name: "Mitigation",
    isExecutable: true,
    steps: [
      { stepNumber: 1, command: "Step 1", requiresConfirmation: false },
      { stepNumber: 2, command: "Step 2", requiresConfirmation: true },
    ],
  };

  assert.equal(section.name, "Mitigation");
  assert.equal(section.isExecutable, true);
  assert.equal(section.steps.length, 2);
});

test("RunbookSection isExecutable can be false", () => {
  const section: RunbookSection = {
    name: "Background",
    isExecutable: false,
    steps: [],
  };

  assert.equal(section.isExecutable, false);
  assert.equal(section.steps.length, 0);
});

test("ParsedRunbook can be used as a type", () => {
  const runbook: ParsedRunbook = {
    runbookId: "runbook-123",
    title: "Critical P0 Runbook",
    severity: "P0",
    sections: [],
    rawMarkdown: "# Test Runbook",
    parsedAt: "2026-01-01T00:00:00.000Z",
  };

  assert.equal(runbook.runbookId, "runbook-123");
  assert.equal(runbook.title, "Critical P0 Runbook");
  assert.equal(runbook.severity, "P0");
});

test("RunbookStepResult can be used as a type", () => {
  const result: RunbookStepResult = {
    step: { stepNumber: 1, command: "kubectl status", requiresConfirmation: false },
    status: "completed",
    command: "kubectl status",
    output: "All systems healthy",
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: "2026-01-01T00:00:05.000Z",
    durationMs: 5000,
  };

  assert.equal(result.status, "completed");
  assert.equal(result.output, "All systems healthy");
  assert.equal(result.durationMs, 5000);
});

test("RunbookStepResult can include errorMessage when failed", () => {
  const result: RunbookStepResult = {
    step: { stepNumber: 1, command: "kubectl exec", requiresConfirmation: true },
    status: "failed",
    command: "kubectl exec",
    output: "",
    errorMessage: "Command execution failed: connection refused",
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: "2026-01-01T00:00:02.000Z",
    durationMs: 2000,
  };

  assert.equal(result.status, "failed");
  assert.ok(result.errorMessage?.includes("connection refused"));
});

test("RunbookStepResult can have waitingForConfirmation", () => {
  const result: RunbookStepResult = {
    step: { stepNumber: 1, command: "kubectl rollout restart", requiresConfirmation: true },
    status: "requires_confirmation",
    command: "kubectl rollout restart",
    output: "Waiting for confirmation",
    waitingForConfirmation: true,
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: "2026-01-01T00:00:00.000Z",
    durationMs: 0,
  };

  assert.equal(result.waitingForConfirmation, true);
});

test("RunbookExecutionResult outcome is a string union", () => {
  const outcomes: RunbookExecutionResult["outcome"][] = [
    "success",
    "partial",
    "failed",
    "aborted",
  ];

  assert.equal(outcomes.length, 4);
  assert.ok(outcomes.includes("success"));
  assert.ok(outcomes.includes("partial"));
});

test("RunbookExecutionResult can be used as a type", () => {
  const result: RunbookExecutionResult = {
    executionId: "exec-123",
    runbook: {
      runbookId: "runbook-123",
      title: "Test Runbook",
      severity: "P2",
      sections: [],
      rawMarkdown: "# Test",
      parsedAt: "2026-01-01T00:00:00.000Z",
    },
    status: "completed",
    sectionResults: [],
    outcome: "success",
    summary: "Runbook executed successfully",
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: "2026-01-01T00:05:00.000Z",
    totalDurationMs: 300000,
    executedBy: "operator-1",
  };

  assert.equal(result.executionId, "exec-123");
  assert.equal(result.outcome, "success");
  assert.equal(result.totalDurationMs, 300000);
  assert.equal(result.executedBy, "operator-1");
});

test("RunbookSectionExecutionResult can be used as a type", () => {
  const result: RunbookSectionExecutionResult = {
    sectionName: "Mitigation",
    status: "completed",
    stepResults: [],
    completedSteps: 3,
    failedSteps: 0,
    skippedSteps: 1,
  };

  assert.equal(result.sectionName, "Mitigation");
  assert.equal(result.status, "completed");
  assert.equal(result.completedSteps, 3);
  assert.equal(result.skippedSteps, 1);
});

test("RunbookExecutorConfig can be used as a type", () => {
  const config: RunbookExecutorConfig = {
    autoExecute: false,
    stepTimeoutMs: 600_000, // 10 minutes
    continueOnFailure: true,
    executeVerification: false,
  };

  assert.equal(config.autoExecute, false);
  assert.equal(config.stepTimeoutMs, 600_000);
  assert.equal(config.continueOnFailure, true);
  assert.equal(config.executeVerification, false);
});

test("RunbookExecutionContext can be used as a type", () => {
  const context: RunbookExecutionContext = {
    taskId: "task-123",
    incidentId: "incident-456",
    environment: "production",
    variables: { REGION: "us-east-1" },
  };

  assert.equal(context.taskId, "task-123");
  assert.equal(context.incidentId, "incident-456");
  assert.equal(context.environment, "production");
  assert.deepEqual(context.variables, { REGION: "us-east-1" });
});

test("RunbookExecutionContext fields are all optional", () => {
  const context: RunbookExecutionContext = {};

  assert.ok(context.taskId === undefined);
  assert.ok(context.incidentId === undefined);
  assert.ok(context.environment === undefined);
  assert.ok(context.variables === undefined);
});

test("DEFAULT_RUNBOOK_EXECUTOR_CONFIG has correct values", () => {
  assert.equal(DEFAULT_RUNBOOK_EXECUTOR_CONFIG.autoExecute, false);
  assert.equal(DEFAULT_RUNBOOK_EXECUTOR_CONFIG.stepTimeoutMs, 300_000); // 5 minutes
  assert.equal(DEFAULT_RUNBOOK_EXECUTOR_CONFIG.continueOnFailure, false);
  assert.equal(DEFAULT_RUNBOOK_EXECUTOR_CONFIG.executeVerification, true);
});

test("RunbookStepResult completedAt can be ISO string", () => {
  const result: RunbookStepResult = {
    step: { stepNumber: 1, command: "test", requiresConfirmation: false },
    status: "running",
    command: "test",
    output: "",
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: "2026-01-01T00:00:00.000Z", // Can be same as startedAt for running
    durationMs: 0,
  };

  assert.equal(result.status, "running");
});

test("RunbookExecutionResult completedAt can be null when not finished", () => {
  const result: RunbookExecutionResult = {
    executionId: "exec-123",
    runbook: {
      runbookId: "runbook-123",
      title: "Test",
      severity: "P3",
      sections: [],
      rawMarkdown: "# Test",
      parsedAt: "2026-01-01T00:00:00.000Z",
    },
    status: "running",
    sectionResults: [],
    outcome: "success", // default
    summary: "Running...",
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: null,
    totalDurationMs: null,
    executedBy: "operator-1",
  };

  assert.equal(result.completedAt, null);
  assert.equal(result.totalDurationMs, null);
});

test("RunbookSectionExecutionResult stepResults can contain multiple results", () => {
  const result: RunbookSectionExecutionResult = {
    sectionName: "Mitigation",
    status: "completed",
    stepResults: [
      {
        step: { stepNumber: 1, command: "step-1", requiresConfirmation: false },
        status: "completed",
        command: "step-1",
        output: "OK",
        startedAt: "2026-01-01T00:00:00.000Z",
        completedAt: "2026-01-01T00:00:01.000Z",
        durationMs: 1000,
      },
      {
        step: { stepNumber: 2, command: "step-2", requiresConfirmation: false },
        status: "failed",
        command: "step-2",
        output: "",
        errorMessage: "Failed",
        startedAt: "2026-01-01T00:00:01.000Z",
        completedAt: "2026-01-01T00:00:02.000Z",
        durationMs: 1000,
      },
    ],
    completedSteps: 1,
    failedSteps: 1,
    skippedSteps: 0,
  };

  assert.equal(result.stepResults.length, 2);
  assert.equal(result.completedSteps, 1);
  assert.equal(result.failedSteps, 1);
});
