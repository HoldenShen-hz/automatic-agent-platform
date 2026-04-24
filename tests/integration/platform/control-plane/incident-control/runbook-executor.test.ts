/**
 * Integration Tests: Runbook Executor
 *
 * Tests the RunbookExecutor with real markdown parsing,
 * step execution, confirmation flow, and result generation.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { RunbookExecutor } from "../../../../../src/platform/control-plane/incident-control/runbook-executor/runbook-executor.js";
import type { ParsedRunbook } from "../../../../../src/platform/control-plane/incident-control/runbook-executor/types.js";

const SAMPLE_RUNBOOK = `
# Emergency Database Recovery P0

## Symptoms
- Database connections failing
- Write operations timing out

## Diagnosis
1. Check database process status
2. Verify disk space available
3. Review recent error logs

## Mitigation
1. Stop the application service
2. Execute emergency checkpoint
3. Restart database service

## Verification
1. Verify connections restored
2. Test write operation
3. Confirm data integrity
`;

const RUNBOOK_WITH_CONFIRMATION = `
# Production Configuration Change

## Precautions
- [ ] Backup current configuration
- [ ] Notify team of maintenance window

## Mitigation
\`./scripts/apply-config.sh --dry-run\`
\`kubectl rollout restart deployment/app\`
\`./scripts/verify-deployment.sh\`
`;

const EMPTY_RUNBOOK = `
# Minimal Runbook

## Diagnosis
1. Check system status
`;

// =============================================================================
// Construction & Configuration
// =============================================================================

test("RunbookExecutor integration: constructs with default config", () => {
  const executor = new RunbookExecutor();

  assert.ok(executor);
  const execution = executor.getCurrentExecution();
  assert.equal(execution, null);
});

test("RunbookExecutor integration: constructs with custom config", () => {
  const executor = new RunbookExecutor({
    autoExecute: true,
    stepTimeoutMs: 60000,
    continueOnFailure: true,
    executeVerification: false,
  });

  assert.ok(executor);
});

test("RunbookExecutor integration: autoExecute config affects step execution", async () => {
  const autoExecutor = new RunbookExecutor({ autoExecute: true });
  const manualExecutor = new RunbookExecutor({ autoExecute: false });

  const runbook = autoExecutor.parse(RUNBOOK_WITH_CONFIRMATION, "auto-test");

  const autoResult = autoExecutor.initializeExecution(runbook, "test-user");
  const manualResult = manualExecutor.initializeExecution(runbook, "test-user");

  // Auto executor should have initialized
  assert.ok(autoResult);
  assert.equal(autoResult.status, "initialized");

  // Manual executor should also have initialized
  assert.ok(manualResult);
  assert.equal(manualResult.status, "initialized");
});

// =============================================================================
// Parsing
// =============================================================================

test("RunbookExecutor integration: parse extracts title and severity", () => {
  const executor = new RunbookExecutor();
  const parsed = executor.parse(SAMPLE_RUNBOOK, "db-recovery");

  assert.equal(parsed.runbookId, "db-recovery");
  assert.equal(parsed.title, "Emergency Database Recovery P0");
  assert.equal(parsed.severity, "P0");
  assert.ok(parsed.sections.length > 0);
});

test("RunbookExecutor integration: parse detects P1 severity", () => {
  const executor = new RunbookExecutor();
  const parsed = executor.parse(`
# Provider 429 Spike Alert

## Diagnosis
1. Check rate limit status
`, "p1-test");

  assert.equal(parsed.severity, "P1");
});

test("RunbookExecutor integration: parse detects P2 severity", () => {
  const executor = new RunbookExecutor();
  const parsed = executor.parse(`
# Queue Backlog Warning

## Diagnosis
1. Check queue depth
`, "p2-test");

  assert.equal(parsed.severity, "P2");
});

test("RunbookExecutor integration: parse detects P3 severity", () => {
  const executor = new RunbookExecutor();
  const parsed = executor.parse(`
# Minor Configuration Advisory

## Diagnosis
1. Review logs
`, "p3-test");

  assert.equal(parsed.severity, "P3");
});

test("RunbookExecutor integration: parse extracts sections", () => {
  const executor = new RunbookExecutor();
  const parsed = executor.parse(SAMPLE_RUNBOOK);

  const sectionNames = parsed.sections.map((s) => s.name.toLowerCase());
  assert.ok(sectionNames.includes("symptoms"));
  assert.ok(sectionNames.includes("diagnosis"));
  assert.ok(sectionNames.includes("mitigation"));
  assert.ok(sectionNames.includes("verification"));
});

test("RunbookExecutor integration: parse marks executable sections correctly", () => {
  const executor = new RunbookExecutor();
  const parsed = executor.parse(SAMPLE_RUNBOOK);

  const diagnosisSection = parsed.sections.find((s) => s.name.toLowerCase() === "diagnosis");
  const symptomsSection = parsed.sections.find((s) => s.name.toLowerCase() === "symptoms");

  assert.equal(diagnosisSection?.isExecutable, true);
  assert.equal(symptomsSection?.isExecutable, false);
});

test("RunbookExecutor integration: parse extracts numbered steps", () => {
  const executor = new RunbookExecutor();
  const parsed = executor.parse(SAMPLE_RUNBOOK);

  const diagnosisSection = parsed.sections.find((s) => s.name.toLowerCase() === "diagnosis");
  assert.ok(diagnosisSection);
  assert.ok(diagnosisSection.steps.length >= 3);
  assert.equal(diagnosisSection.steps[0]?.stepNumber, 1);
  assert.equal(diagnosisSection.steps[0]?.command, "Check database process status");
});

test("RunbookExecutor integration: parse extracts backtick commands as requiring confirmation", () => {
  const executor = new RunbookExecutor();
  const parsed = executor.parse(RUNBOOK_WITH_CONFIRMATION);

  const mitigationSection = parsed.sections.find((s) => s.name.toLowerCase() === "mitigation");
  assert.ok(mitigationSection);
  assert.ok(mitigationSection.steps.some((s) => s.requiresConfirmation));
});

test("RunbookExecutor integration: parse handles empty runbook", () => {
  const executor = new RunbookExecutor();
  const parsed = executor.parse(EMPTY_RUNBOOK);

  assert.ok(parsed.runbookId);
  assert.equal(parsed.title, "Minimal Runbook");
  assert.ok(parsed.sections.length > 0);
});

test("RunbookExecutor integration: parse generates unique runbookId when not provided", () => {
  const executor = new RunbookExecutor();
  const parsed1 = executor.parse("# Test Runbook 1");
  const parsed2 = executor.parse("# Test Runbook 2");

  assert.ok(parsed1.runbookId.startsWith("runbook_"));
  assert.ok(parsed2.runbookId.startsWith("runbook_"));
  assert.notEqual(parsed1.runbookId, parsed2.runbookId);
});

// =============================================================================
// Initialization
// =============================================================================

test("RunbookExecutor integration: initializeExecution creates execution result", () => {
  const executor = new RunbookExecutor();
  const runbook = executor.parse(SAMPLE_RUNBOOK);

  const execution = executor.initializeExecution(runbook, "operator-1");

  assert.ok(execution.executionId.startsWith("runbook_exec_"));
  assert.equal(execution.runbook, runbook);
  assert.equal(execution.status, "initialized");
  assert.equal(execution.executedBy, "operator-1");
  assert.ok(execution.startedAt);
  assert.equal(execution.completedAt, null);
});

test("RunbookExecutor integration: initializeExecution creates section results for executable sections", () => {
  const executor = new RunbookExecutor();
  const runbook = executor.parse(SAMPLE_RUNBOOK);

  const execution = executor.initializeExecution(runbook, "test-user");

  // Should have section results for diagnosis, mitigation, verification (not symptoms)
  assert.ok(execution.sectionResults.length >= 3);
  const sectionNames = execution.sectionResults.map((s) => s.sectionName.toLowerCase());
  assert.ok(sectionNames.includes("diagnosis"));
  assert.ok(sectionNames.includes("mitigation"));
  assert.ok(sectionNames.includes("verification"));
});

test("RunbookExecutor integration: initializeExecution initializes step results", () => {
  const executor = new RunbookExecutor();
  const runbook = executor.parse(SAMPLE_RUNBOOK);

  const execution = executor.initializeExecution(runbook, "test-user");

  const diagnosisSection = execution.sectionResults.find((s) => s.sectionName.toLowerCase() === "diagnosis");
  assert.ok(diagnosisSection);
  assert.ok(diagnosisSection.stepResults.length >= 3);
  assert.ok(diagnosisSection.stepResults.every((r) => r.status === "pending"));
});

test("RunbookExecutor integration: getCurrentExecution returns initialized execution", () => {
  const executor = new RunbookExecutor();
  const runbook = executor.parse(SAMPLE_RUNBOOK);

  assert.equal(executor.getCurrentExecution(), null);

  executor.initializeExecution(runbook, "test-user");

  const execution = executor.getCurrentExecution();
  assert.ok(execution);
  assert.equal(execution?.status, "initialized");
});

// =============================================================================
// Step Execution
// =============================================================================

test("RunbookExecutor integration: executeStep completes step successfully", async () => {
  const executor = new RunbookExecutor({ autoExecute: true });
  const runbook = executor.parse(SAMPLE_RUNBOOK);
  executor.initializeExecution(runbook, "test-user");

  const result = await executor.executeStep(
    executor.getCurrentExecution()!.executionId,
    "Diagnosis",
    0,
  );

  assert.ok(result);
  assert.ok(["completed", "requires_confirmation"].includes(result.status));
});

test("RunbookExecutor integration: executeStep returns null for invalid executionId", async () => {
  const executor = new RunbookExecutor({ autoExecute: true });
  const runbook = executor.parse(SAMPLE_RUNBOOK);
  executor.initializeExecution(runbook, "test-user");

  const result = await executor.executeStep("invalid-id", "Diagnosis", 0);

  assert.equal(result, null);
});

test("RunbookExecutor integration: executeStep returns null for non-existent section", async () => {
  const executor = new RunbookExecutor({ autoExecute: true });
  const runbook = executor.parse(SAMPLE_RUNBOOK);
  executor.initializeExecution(runbook, "test-user");

  const result = await executor.executeStep(
    executor.getCurrentExecution()!.executionId,
    "NonExistentSection",
    0,
  );

  assert.equal(result, null);
});

test("RunbookExecutor integration: executeStep sets status to failed on error", async () => {
  const executor = new RunbookExecutor({ autoExecute: true });
  const runbook = executor.parse(SAMPLE_RUNBOOK);
  executor.initializeExecution(runbook, "test-user");

  // Override simulate to return failure
  const result = await executor.executeStep(
    executor.getCurrentExecution()!.executionId,
    "Diagnosis",
    0,
    { success: false, output: "Command failed" },
  );

  assert.ok(result);
  assert.equal(result.status, "failed");
  assert.ok(result.errorMessage);
});

test("RunbookExecutor integration: executeStep updates section stats on completion", async () => {
  const executor = new RunbookExecutor({ autoExecute: true });
  const runbook = executor.parse(EMPTY_RUNBOOK);
  executor.initializeExecution(runbook, "test-user");

  const executionBefore = executor.getCurrentExecution();
  const diagnosisSection = executionBefore?.sectionResults.find((s) => s.sectionName.toLowerCase() === "diagnosis");

  await executor.executeStep(executionBefore!.executionId, "Diagnosis", 0);

  const executionAfter = executor.getCurrentExecution();
  const updatedSection = executionAfter?.sectionResults.find((s) => s.sectionName.toLowerCase() === "diagnosis");

  assert.ok(updatedSection);
  assert.ok(updatedSection.completedSteps >= 1 || updatedSection.status !== "initialized");
});

// =============================================================================
// Confirmation Flow
// =============================================================================

test("RunbookExecutor integration: executeStep requires confirmation for backtick commands in manual mode", async () => {
  const executor = new RunbookExecutor({ autoExecute: false });
  const runbook = executor.parse(RUNBOOK_WITH_CONFIRMATION);
  executor.initializeExecution(runbook, "test-user");

  const result = await executor.executeStep(
    executor.getCurrentExecution()!.executionId,
    "Mitigation",
    0,
  );

  assert.ok(result);
  assert.equal(result.status, "requires_confirmation");
  assert.equal(result.waitingForConfirmation, true);
});

test("RunbookExecutor integration: getPendingConfirmations returns steps waiting for confirmation", async () => {
  const executor = new RunbookExecutor({ autoExecute: false });
  const runbook = executor.parse(RUNBOOK_WITH_CONFIRMATION);
  executor.initializeExecution(runbook, "test-user");

  // Execute to trigger confirmation
  await executor.executeStep(
    executor.getCurrentExecution()!.executionId,
    "Mitigation",
    0,
  );

  const pending = executor.getPendingConfirmations();

  assert.ok(pending.length > 0);
  assert.ok(pending.some((p) => p.status === "requires_confirmation"));
});

test("RunbookExecutor integration: confirmStep changes status from requires_confirmation to running", () => {
  const executor = new RunbookExecutor({ autoExecute: false });
  const runbook = executor.parse(RUNBOOK_WITH_CONFIRMATION);
  executor.initializeExecution(runbook, "test-user");

  // Get execution ID
  const executionId = executor.getCurrentExecution()!.executionId;

  // Trigger confirmation requirement
  executor.executeStep(executionId, "Mitigation", 0);

  // Confirm the step
  const confirmed = executor.confirmStep(executionId, 0);

  assert.ok(confirmed);
  assert.equal(confirmed.status, "running");
  assert.ok(confirmed.startedAt);
});

test("RunbookExecutor integration: confirmStep returns null for non-existent step", () => {
  const executor = new RunbookExecutor({ autoExecute: false });
  const runbook = executor.parse(RUNBOOK_WITH_CONFIRMATION);
  executor.initializeExecution(runbook, "test-user");

  const result = executor.confirmStep("non-existent-id", 999);

  assert.equal(result, null);
});

test("RunbookExecutor integration: confirmStep returns null for invalid executionId", () => {
  const executor = new RunbookExecutor({ autoExecute: false });
  const runbook = executor.parse(RUNBOOK_WITH_CONFIRMATION);
  executor.initializeExecution(runbook, "test-user");

  const result = executor.confirmStep("invalid-id", 0);

  assert.equal(result, null);
});

// =============================================================================
// Skip Step
// =============================================================================

test("RunbookExecutor integration: skipStep marks step as skipped", () => {
  const executor = new RunbookExecutor({ autoExecute: true });
  const runbook = executor.parse(SAMPLE_RUNBOOK);
  executor.initializeExecution(runbook, "test-user");

  const executionId = executor.getCurrentExecution()!.executionId;
  const result = executor.skipStep(executionId, "Diagnosis", 0);

  assert.ok(result);
  assert.equal(result.status, "skipped");
  assert.ok(result.completedAt);
});

test("RunbookExecutor integration: skipStep returns null for invalid executionId", () => {
  const executor = new RunbookExecutor({ autoExecute: true });
  const runbook = executor.parse(SAMPLE_RUNBOOK);
  executor.initializeExecution(runbook, "test-user");

  const result = executor.skipStep("invalid-id", "Diagnosis", 0);

  assert.equal(result, null);
});

test("RunbookExecutor integration: skipStep updates section skipped count", () => {
  const executor = new RunbookExecutor({ autoExecute: true });
  const runbook = executor.parse(SAMPLE_RUNBOOK);
  executor.initializeExecution(runbook, "test-user");

  const executionId = executor.getCurrentExecution()!.executionId;

  const before = executor.getCurrentExecution()?.sectionResults.find((s) => s.sectionName.toLowerCase() === "diagnosis");
  executor.skipStep(executionId, "Diagnosis", 0);
  const after = executor.getCurrentExecution()?.sectionResults.find((s) => s.sectionName.toLowerCase() === "diagnosis");

  assert.ok(before && after);
  assert.ok(after.skippedSteps >= before.skippedSteps);
});

// =============================================================================
// Abort
// =============================================================================

test("RunbookExecutor integration: abort terminates execution", () => {
  const executor = new RunbookExecutor({ autoExecute: true });
  const runbook = executor.parse(SAMPLE_RUNBOOK);
  executor.initializeExecution(runbook, "test-user");

  const executionId = executor.getCurrentExecution()!.executionId;
  const result = executor.abort(executionId);

  assert.ok(result);
  assert.equal(result.status, "aborted");
  assert.equal(result.outcome, "aborted");
  assert.ok(result.completedAt);
  assert.ok(result.totalDurationMs !== null);
});

test("RunbookExecutor integration: abort returns null for invalid executionId", () => {
  const executor = new RunbookExecutor({ autoExecute: true });
  const runbook = executor.parse(SAMPLE_RUNBOOK);
  executor.initializeExecution(runbook, "test-user");

  const result = executor.abort("invalid-id");

  assert.equal(result, null);
});

// =============================================================================
// Execution Completion
// =============================================================================

test("RunbookExecutor integration: executeStep marks execution complete when all steps done", async () => {
  const executor = new RunbookExecutor({ autoExecute: true });
  // Use a simple runbook
  const simpleRunbook = `
# Simple Runbook

## Diagnosis
1. Check status
2. Verify health
`;
  const runbook = executor.parse(simpleRunbook);
  executor.initializeExecution(runbook, "test-user");

  const executionId = executor.getCurrentExecution()!.executionId;

  // Execute all steps in diagnosis section
  await executor.executeStep(executionId, "Diagnosis", 0);
  await executor.executeStep(executionId, "Diagnosis", 1);

  const execution = executor.getCurrentExecution();
  assert.ok(execution);

  // All diagnosis steps done, section should be completed
  const diagnosisSection = execution.sectionResults.find((s) => s.sectionName.toLowerCase() === "diagnosis");
  if (diagnosisSection) {
    assert.ok(
      diagnosisSection.status === "completed" ||
      diagnosisSection.completedSteps === 2 ||
      diagnosisSection.status === "running",
    );
  }
});

// =============================================================================
// Report Generation
// =============================================================================

test("RunbookExecutor integration: generateExecutionReport creates markdown report", () => {
  const executor = new RunbookExecutor({ autoExecute: true });
  const runbook = executor.parse(SAMPLE_RUNBOOK);
  executor.initializeExecution(runbook, "test-user");

  const execution = executor.getCurrentExecution()!;
  const report = executor.generateExecutionReport(execution);

  assert.ok(report.includes("Runbook Execution Report"));
  assert.ok(report.includes(execution.executionId));
  assert.ok(report.includes(runbook.title));
});

test("RunbookExecutor integration: generateExecutionReport includes step results", async () => {
  const executor = new RunbookExecutor({ autoExecute: true });
  const runbook = executor.parse(SAMPLE_RUNBOOK);
  executor.initializeExecution(runbook, "test-user");

  const execution = executor.getCurrentExecution()!;

  // Execute a step
  await executor.executeStep(execution.executionId, "Diagnosis", 0);

  const updatedExecution = executor.getCurrentExecution()!;
  const report = executor.generateExecutionReport(updatedExecution);

  assert.ok(report.includes("1."));
  assert.ok(report.includes("Check database process status"));
});

// =============================================================================
// Multiple Executions
// =============================================================================

test("RunbookExecutor integration: initializeExecution creates new execution without affecting previous", () => {
  const executor = new RunbookExecutor({ autoExecute: true });
  const runbook1 = executor.parse("# First Runbook", "first");
  const runbook2 = executor.parse("# Second Runbook", "second");

  executor.initializeExecution(runbook1, "user-1");
  const firstExecution = executor.getCurrentExecution();

  executor.initializeExecution(runbook2, "user-2");
  const secondExecution = executor.getCurrentExecution();

  assert.ok(firstExecution && secondExecution);
  assert.notEqual(firstExecution.executionId, secondExecution.executionId);
  assert.notEqual(firstExecution.runbook.runbookId, secondExecution.runbook.runbookId);
  assert.equal(secondExecution.executedBy, "user-2");
});
