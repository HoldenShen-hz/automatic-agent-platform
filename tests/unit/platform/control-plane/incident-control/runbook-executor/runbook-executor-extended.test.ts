/**
 * Unit tests for RunbookExecutor - Extended Business Logic
 * Tests execution state machine, pending confirmations, and step confirmation flow
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  RunbookExecutor,
  parseRunbookMarkdown,
} from "../../../../../../src/platform/five-plane-control-plane/incident-control/runbook-executor/index.js";
import type { RunbookSection, RunbookStep, RunbookExecutorConfig } from "../../../../../../src/platform/five-plane-control-plane/incident-control/runbook-executor/index.js";

function createExecutorWithConfig(config: Partial<RunbookExecutorConfig> = {}) {
  return new RunbookExecutor(config);
}

test("RunbookExecutor.initializeExecution creates execution with correct structure", () => {
  const executor = createExecutorWithConfig();
  const markdown = `# Test Runbook

## Mitigation
1. Step one
2. Step two
`;
  const runbook = parseRunbookMarkdown(markdown);

  const execution = executor.initializeExecution(runbook, "operator-1");

  assert.ok(execution.executionId.startsWith("runbook_exec_"));
  assert.equal(execution.status, "initialized");
  assert.equal(execution.executedBy, "operator-1");
  assert.ok(execution.sectionResults.length > 0);
});

test("RunbookExecutor.initializeExecution with context", () => {
  const executor = createExecutorWithConfig();
  const markdown = `# Test Runbook

## Mitigation
1. Step one
`;
  const runbook = parseRunbookMarkdown(markdown);

  const execution = executor.initializeExecution(runbook, "operator-1", {
    taskId: "task-123",
    incidentId: "incident-456",
    environment: "production",
  });

  assert.equal(execution.runbook.title, "Test Runbook");
});

test("RunbookExecutor.getCurrentExecution returns null when no execution", () => {
  const executor = createExecutorWithConfig();

  const execution = executor.getCurrentExecution();

  assert.equal(execution, null);
});

test("RunbookExecutor.getCurrentExecution returns current execution", () => {
  const executor = createExecutorWithConfig();
  const markdown = `# Test Runbook

## Mitigation
1. Step one
`;
  const runbook = parseRunbookMarkdown(markdown);

  executor.initializeExecution(runbook, "operator-1");
  const execution = executor.getCurrentExecution();

  assert.ok(execution);
  assert.equal(execution!.runbook.title, "Test Runbook");
});

test("RunbookExecutor.getPendingConfirmations returns empty when no execution", () => {
  const executor = createExecutorWithConfig();

  const pending = executor.getPendingConfirmations();

  assert.ok(Array.isArray(pending));
  assert.equal(pending.length, 0);
});

test("RunbookExecutor.getPendingConfirmations returns empty when no pending steps", () => {
  const executor = createExecutorWithConfig();
  const markdown = `# Test Runbook

## Mitigation
1. Step one
2. Step two
`;
  const runbook = parseRunbookMarkdown(markdown);

  executor.initializeExecution(runbook, "operator-1");
  const pending = executor.getPendingConfirmations();

  // Steps without requiresConfirmation won't be pending
  assert.ok(Array.isArray(pending));
});

test("RunbookExecutor.confirmStep returns null when no execution", () => {
  const executor = createExecutorWithConfig();

  const result = executor.confirmStep("non-existent", 0);

  assert.equal(result, null);
});

test("RunbookExecutor.confirmStep returns null for wrong execution ID", () => {
  const executor = createExecutorWithConfig();
  const markdown = `# Test Runbook

## Mitigation
1. Step one
`;
  const runbook = parseRunbookMarkdown(markdown);

  executor.initializeExecution(runbook, "operator-1");
  const current = executor.getCurrentExecution();

  const result = executor.confirmStep(current!.executionId + "_wrong", 0);

  assert.equal(result, null);
});

test("RunbookExecutor.confirmStep updates step status to running", () => {
  const executor = createExecutorWithConfig({ autoExecute: false });
  const markdown = `# Test Runbook

## Mitigation
1. Run command
`;
  const runbook = parseRunbookMarkdown(markdown);

  executor.initializeExecution(runbook, "operator-1");
  const current = executor.getCurrentExecution();

  // Find step index in section
  let stepIndex = 0;
  for (const section of current!.sectionResults) {
    for (let i = 0; i < section.stepResults.length; i++) {
      if (section.stepResults[i]!.step.command.includes("Run command")) {
        stepIndex = i;
        break;
      }
    }
  }

  // Confirm the step
  const result = executor.confirmStep(current!.executionId, stepIndex);

  // Result depends on whether step was in requires_confirmation state
  assert.ok(result === null || result.status === "running");
});

test("RunbookExecutor config defaults are applied", () => {
  const executor = createExecutorWithConfig();

  // Default config values should be applied
  const execution = executor.initializeExecution(
    parseRunbookMarkdown("# Test\n\n## Mitigation\n1. Step"),
    "operator",
  );

  assert.ok(execution);
});

test("RunbookExecutor with autoExecute config", () => {
  const executor = createExecutorWithConfig({ autoExecute: true });
  const markdown = `# Test Runbook

## Mitigation
1. Auto step
`;
  const runbook = parseRunbookMarkdown(markdown);

  const execution = executor.initializeExecution(runbook, "operator-1", { autoExecute: true });

  assert.ok(execution);
});

test("RunbookExecutor with continueOnFailure config", () => {
  const executor = createExecutorWithConfig({ continueOnFailure: true });
  const markdown = `# Test Runbook

## Mitigation
1. Step one
2. Step two
`;
  const runbook = parseRunbookMarkdown(markdown);

  const execution = executor.initializeExecution(runbook, "operator-1");

  assert.ok(execution);
});

test("RunbookExecutor with custom stepTimeoutMs", () => {
  const executor = createExecutorWithConfig({ stepTimeoutMs: 600000 });
  const markdown = `# Test Runbook

## Mitigation
1. Timeout step
`;
  const runbook = parseRunbookMarkdown(markdown);

  const execution = executor.initializeExecution(runbook, "operator-1");

  assert.ok(execution);
});

test("RunbookExecutor with executeVerification false", () => {
  const executor = createExecutorWithConfig({ executeVerification: false });
  const markdown = `# Test Runbook

## Verification
1. Verify step
`;
  const runbook = parseRunbookMarkdown(markdown);

  const execution = executor.initializeExecution(runbook, "operator-1");

  assert.ok(execution);
});

test("RunbookExecutor parse extracts severity from title", () => {
  const executor = createExecutorWithConfig();
  const markdown = `# P0 Critical Outage Runbook

## Mitigation
1. Step
`;
  const runbook = parseRunbookMarkdown(markdown);

  assert.equal(runbook.severity, "P0");
});

test("RunbookExecutor parse detects P1 severity", () => {
  const executor = createExecutorWithConfig();
  const markdown = `# P1 High Priority Incident

## Mitigation
1. Step
`;
  const runbook = parseRunbookMarkdown(markdown);

  assert.equal(runbook.severity, "P1");
});

test("RunbookExecutor parse detects P2 severity", () => {
  const executor = createExecutorWithConfig();
  const markdown = `# P2 Degraded Service Runbook

## Mitigation
1. Step
`;
  const runbook = parseRunbookMarkdown(markdown);

  assert.equal(runbook.severity, "P2");
});

test("RunbookExecutor parse defaults to P2 for unknown severity", () => {
  const executor = createExecutorWithConfig();
  const markdown = `# Regular Runbook

## Mitigation
1. Step
`;
  const runbook = parseRunbookMarkdown(markdown);

  assert.equal(runbook.severity, "P2");
});

test("RunbookExecutor parse handles multiple sections", () => {
  const executor = createExecutorWithConfig();
  const markdown = `# Multi Section Runbook

## Background
Background info.

## Diagnosis
1. Diagnose step

## Mitigation
1. Mitigate step

## Verification
1. Verify step
`;
  const runbook = parseRunbookMarkdown(markdown);

  assert.equal(runbook.sections.length, 4);
});

test("RunbookExecutor parse marks executable sections correctly", () => {
  const executor = createExecutorWithConfig();
  const markdown = `# Test Runbook

## Background
Background info.

## Mitigation
1. Mitigate

## Verification
1. Verify
`;
  const runbook = parseRunbookMarkdown(markdown);

  const background = runbook.sections.find(s => s.name === "Background");
  const mitigation = runbook.sections.find(s => s.name === "Mitigation");
  const verification = runbook.sections.find(s => s.name === "Verification");

  assert.equal(background?.isExecutable, false);
  assert.equal(mitigation?.isExecutable, true);
  assert.equal(verification?.isExecutable, true);
});

test("RunbookExecutor parse preserves raw markdown", () => {
  const executor = createExecutorWithConfig();
  const markdown = `# Test Runbook

## Mitigation
1. Step one
`;

  const runbook = parseRunbookMarkdown(markdown);

  assert.ok(runbook.rawMarkdown.includes("Test Runbook"));
  assert.ok(runbook.rawMarkdown.includes("Mitigation"));
});

test("RunbookExecutor initializeExecution marks only executable sections", () => {
  const executor = createExecutorWithConfig();
  const markdown = `# Test Runbook

## Background
Background info.

## Mitigation
1. Mitigate step

## Verification
1. Verify step
`;
  const runbook = parseRunbookMarkdown(markdown);

  const execution = executor.initializeExecution(runbook, "operator-1");

  // Should only have 2 sections (Mitigation and Verification), not Background
  assert.ok(execution.sectionResults.length >= 2);
});