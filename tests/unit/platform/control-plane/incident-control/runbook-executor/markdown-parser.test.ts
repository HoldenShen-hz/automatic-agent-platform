/**
 * Unit tests for Markdown Runbook Parser
 * Tests parsing of markdown runbooks into structured objects
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  parseRunbookMarkdown,
  createEmptyStepResult,
} from "../../../../../../src/platform/five-plane-control-plane/incident-control/runbook-executor/markdown-parser.js";
import type { ParsedRunbook, RunbookSection, RunbookStep, RunbookStepResult } from "../../../../../../src/platform/five-plane-control-plane/incident-control/runbook-executor/types.js";

// Re-export types for use in tests
type RunbookSeverity = "P0" | "P1" | "P2" | "P3";

test("parseRunbookMarkdown parses title from first heading", () => {
  const markdown = `# My Test Runbook

## Mitigation

1. Step one
`;
  const runbook = parseRunbookMarkdown(markdown);

  assert.equal(runbook.title, "My Test Runbook");
  assert.ok(runbook.runbookId.startsWith("runbook_"));
  assert.ok(runbook.parsedAt.length > 0);
});

test("parseRunbookMarkdown uses custom runbookId when provided", () => {
  const markdown = `# Test Runbook

## Mitigation

1. Step
`;
  const runbook = parseRunbookMarkdown(markdown, "custom-id-123");

  assert.equal(runbook.runbookId, "custom-id-123");
});

test("parseRunbookMarkdown defaults to 'Untitled Runbook' when no title", () => {
  const markdown = `## Mitigation

1. Step
`;
  const runbook = parseRunbookMarkdown(markdown);

  assert.equal(runbook.title, "Untitled Runbook");
});

test("parseRunbookMarkdown detects P0 severity from title", () => {
  const markdown = `# Critical P0 Outage Runbook

## Mitigation

1. Step
`;
  const runbook = parseRunbookMarkdown(markdown);

  assert.equal(runbook.severity, "P0");
});

test("parseRunbookMarkdown detects P0 severity from 'down' keyword", () => {
  const markdown = `# System Down Incident

## Mitigation

1. Step
`;
  const runbook = parseRunbookMarkdown(markdown);

  assert.equal(runbook.severity, "P0");
});

test("parseRunbookMarkdown detects P0 severity from 'critical' keyword", () => {
  const markdown = `# Critical System Failure

## Mitigation

1. Step
`;
  const runbook = parseRunbookMarkdown(markdown);

  assert.equal(runbook.severity, "P0");
});

test("parseRunbookMarkdown detects P1 severity from title", () => {
  const markdown = `# High Traffic Spike

## Mitigation

1. Step
`;
  const runbook = parseRunbookMarkdown(markdown);

  assert.equal(runbook.severity, "P1");
});

test("parseRunbookMarkdown detects P2 severity from 'degraded' keyword", () => {
  const markdown = `# Service Degraded Performance

## Mitigation

1. Step
`;
  const runbook = parseRunbookMarkdown(markdown);

  assert.equal(runbook.severity, "P2");
});

test("parseRunbookMarkdown detects P2 severity from 'warning' keyword", () => {
  const markdown = `# Warning State Alert

## Mitigation

1. Step
`;
  const runbook = parseRunbookMarkdown(markdown);

  assert.equal(runbook.severity, "P2");
});

test("parseRunbookMarkdown defaults to P2 when no severity keyword", () => {
  const markdown = `# Regular Maintenance Runbook

## Mitigation

1. Step
`;
  const runbook = parseRunbookMarkdown(markdown);

  assert.equal(runbook.severity, "P2");
});

test("parseRunbookMarkdown detects P3 severity from 'minor' keyword", () => {
  const markdown = `# Minor Issue Resolution

## Mitigation

1. Step
`;
  const runbook = parseRunbookMarkdown(markdown);

  assert.equal(runbook.severity, "P3");
});

test("parseRunbookMarkdown detects P3 severity from 'info' keyword", () => {
  const markdown = `# P3 Info Alert

## Mitigation

1. Step
`;
  const runbook = parseRunbookMarkdown(markdown);

  assert.equal(runbook.severity, "P3");
});

test("parseRunbookMarkdown parses executable sections correctly", () => {
  const markdown = `# Test Runbook

## Diagnosis

1. Step one

## Mitigation

1. Step two
`;
  const runbook = parseRunbookMarkdown(markdown);

  const diagnosis = runbook.sections.find((s: RunbookSection) => s.name === "Diagnosis");
  assert.ok(diagnosis);
  assert.equal(diagnosis.isExecutable, true);

  const mitigation = runbook.sections.find((s: RunbookSection) => s.name === "Mitigation");
  assert.ok(mitigation);
  assert.equal(mitigation.isExecutable, true);
});

test("parseRunbookMarkdown marks non-executable sections correctly", () => {
  const markdown = `# Test Runbook

## Background

Some background information.

## Symptoms

- Symptom one
`;
  const runbook = parseRunbookMarkdown(markdown);

  const background = runbook.sections.find((s: RunbookSection) => s.name === "Background");
  assert.ok(background);
  assert.equal(background.isExecutable, false);

  const symptoms = runbook.sections.find((s: RunbookSection) => s.name === "Symptoms");
  assert.ok(symptoms);
  assert.equal(symptoms.isExecutable, false);
});

test("parseRunbookMarkdown recognizes all executable section names", () => {
  const markdown = `# Test

## Diagnosis
1. D

## Mitigation
1. M

## Verification
1. V

## Resolution
1. R

## Remediation
1. Rem

## Recovery
1. Rec
`;
  const runbook = parseRunbookMarkdown(markdown);

  const sections = runbook.sections;
  assert.equal(sections.length, 6);
  for (const section of sections) {
    assert.equal(section.isExecutable, true);
  }
});

test("parseRunbookMarkdown parses numbered steps with period", () => {
  const markdown = `# Test

## Mitigation

1. First step
2. Second step
3. Third step
`;
  const runbook = parseRunbookMarkdown(markdown);

  const mitigation = runbook.sections.find((s: RunbookSection) => s.name === "Mitigation");
  assert.ok(mitigation);
  assert.equal(mitigation.steps.length, 3);

  assert.equal(mitigation.steps[0]!.stepNumber, 1);
  assert.equal(mitigation.steps[0]!.command, "First step");

  assert.equal(mitigation.steps[1]!.stepNumber, 2);
  assert.equal(mitigation.steps[1]!.command, "Second step");

  assert.equal(mitigation.steps[2]!.stepNumber, 3);
  assert.equal(mitigation.steps[2]!.command, "Third step");
});

test("parseRunbookMarkdown parses numbered steps with parenthesis", () => {
  const markdown = `# Test

## Mitigation

1) First step
2) Second step
`;
  const runbook = parseRunbookMarkdown(markdown);

  const mitigation = runbook.sections.find((s: RunbookSection) => s.name === "Mitigation");
  assert.ok(mitigation);
  assert.equal(mitigation.steps.length, 2);
  assert.equal(mitigation.steps[0]!.command, "First step");
  assert.equal(mitigation.steps[1]!.command, "Second step");
});

test("parseRunbookMarkdown parses bullet points", () => {
  const markdown = `# Test

## Symptoms

- First symptom
- Second symptom
- Third symptom
`;
  const runbook = parseRunbookMarkdown(markdown);

  const symptoms = runbook.sections.find((s: RunbookSection) => s.name === "Symptoms");
  assert.ok(symptoms);
  assert.equal(symptoms.steps.length, 3);
  assert.equal(symptoms.steps[0]!.command, "First symptom");
  assert.equal(symptoms.steps[1]!.command, "Second symptom");
  assert.equal(symptoms.steps[2]!.command, "Third symptom");
});

test("parseRunbookMarkdown parses asterisk bullet points", () => {
  const markdown = `# Test

## Symptoms

* First item
* Second item
`;
  const runbook = parseRunbookMarkdown(markdown);

  const symptoms = runbook.sections.find((s: RunbookSection) => s.name === "Symptoms");
  assert.ok(symptoms);
  assert.equal(symptoms.steps.length, 2);
  assert.equal(symptoms.steps[0]!.command, "First item");
  assert.equal(symptoms.steps[1]!.command, "Second item");
});

test("parseRunbookMarkdown parses checkboxes", () => {
  const markdown = `# Test

## Verification

[ ] Unchecked item
[x] Checked item
[ ] Another unchecked
`;
  const runbook = parseRunbookMarkdown(markdown);

  const verification = runbook.sections.find((s: RunbookSection) => s.name === "Verification");
  assert.ok(verification);
  assert.equal(verification.steps.length, 3);
  assert.equal(verification.steps[0]!.command, "Unchecked item");
  assert.equal(verification.steps[1]!.command, "Checked item");
  assert.equal(verification.steps[2]!.command, "Another unchecked");
});

test("parseRunbookMarkdown parses backtick commands as requiring confirmation", () => {
  const markdown = `# Test

## Mitigation

\`kubectl rollout status\`
`;
  const runbook = parseRunbookMarkdown(markdown);

  const mitigation = runbook.sections.find((s: RunbookSection) => s.name === "Mitigation");
  assert.ok(mitigation);
  assert.equal(mitigation.steps.length, 1);
  assert.equal(mitigation.steps[0]!.requiresConfirmation, true);
  assert.equal(mitigation.steps[0]!.command, "kubectl rollout status");
});

test("parseRunbookMarkdown parses kubectl commands without backticks as requiring confirmation", () => {
  const markdown = `# Test

## Mitigation

kubectl rollout undo deployment/app
`;
  const runbook = parseRunbookMarkdown(markdown);

  const mitigation = runbook.sections.find((s: RunbookSection) => s.name === "Mitigation");
  assert.ok(mitigation);
  assert.equal(mitigation.steps.length, 1);
  assert.equal(mitigation.steps[0]!.requiresConfirmation, true);
});

test("parseRunbookMarkdown parses npm commands without backticks as requiring confirmation", () => {
  const markdown = `# Test

## Mitigation

npm run build
`;
  const runbook = parseRunbookMarkdown(markdown);

  const mitigation = runbook.sections.find((s: RunbookSection) => s.name === "Mitigation");
  assert.ok(mitigation);
  assert.equal(mitigation.steps.length, 1);
  assert.equal(mitigation.steps[0]!.requiresConfirmation, true);
});

test("parseRunbookMarkdown parses docker commands without backticks as requiring confirmation", () => {
  const markdown = `# Test

## Mitigation

docker compose down
`;
  const runbook = parseRunbookMarkdown(markdown);

  const mitigation = runbook.sections.find((s: RunbookSection) => s.name === "Mitigation");
  assert.ok(mitigation);
  assert.equal(mitigation.steps.length, 1);
  assert.equal(mitigation.steps[0]!.requiresConfirmation, true);
});

test("parseRunbookMarkdown parses curl commands without backticks as requiring confirmation", () => {
  const markdown = `# Test

## Mitigation

curl -X POST https://api.example.com/deploy
`;
  const runbook = parseRunbookMarkdown(markdown);

  const mitigation = runbook.sections.find((s: RunbookSection) => s.name === "Mitigation");
  assert.ok(mitigation);
  assert.equal(mitigation.steps.length, 1);
  assert.equal(mitigation.steps[0]!.requiresConfirmation, true);
});

test("parseRunbookMarkdown parses git commands without backticks as requiring confirmation", () => {
  const markdown = `# Test

## Mitigation

git push origin main
`;
  const runbook = parseRunbookMarkdown(markdown);

  const mitigation = runbook.sections.find((s: RunbookSection) => s.name === "Mitigation");
  assert.ok(mitigation);
  assert.equal(mitigation.steps.length, 1);
  assert.equal(mitigation.steps[0]!.requiresConfirmation, true);
});

test("parseRunbookMarkdown treats non-command text as not requiring confirmation", () => {
  const markdown = `# Test

## Mitigation

1. Check the logs
2. Review the configuration
`;
  const runbook = parseRunbookMarkdown(markdown);

  const mitigation = runbook.sections.find((s: RunbookSection) => s.name === "Mitigation");
  assert.ok(mitigation);
  assert.equal(mitigation.steps[0]!.requiresConfirmation, false);
  assert.equal(mitigation.steps[1]!.requiresConfirmation, false);
});

test("parseRunbookMarkdown ignores empty lines", () => {
  const markdown = `# Test

## Mitigation

1. First step


2. Second step

`;
  const runbook = parseRunbookMarkdown(markdown);

  const mitigation = runbook.sections.find((s: RunbookSection) => s.name === "Mitigation");
  assert.ok(mitigation);
  assert.equal(mitigation.steps.length, 2);
});

test("parseRunbookMarkdown ignores lines that are not steps", () => {
  const markdown = `# Test

## Mitigation

Some descriptive text that is not a step.
Another line that should be ignored.

1. Actual step
`;
  const runbook = parseRunbookMarkdown(markdown);

  const mitigation = runbook.sections.find((s: RunbookSection) => s.name === "Mitigation");
  assert.ok(mitigation);
  assert.equal(mitigation.steps.length, 1);
  assert.equal(mitigation.steps[0]!.command, "Actual step");
});

test("parseRunbookMarkdown preserves rawMarkdown", () => {
  const markdown = `# Test Runbook

## Mitigation

1. Step one
`;
  const runbook = parseRunbookMarkdown(markdown);

  assert.equal(runbook.rawMarkdown, markdown);
});

test("parseRunbookMarkdown handles multiple sections", () => {
  const markdown = `# Test Runbook

## Symptoms

- Symptom one

## Diagnosis

1. Check logs
2. Check metrics

## Mitigation

1. Fix issue
`;
  const runbook = parseRunbookMarkdown(markdown);

  assert.equal(runbook.sections.length, 3);

  const symptoms = runbook.sections.find((s: RunbookSection) => s.name === "Symptoms");
  assert.ok(symptoms);
  assert.equal(symptoms.steps.length, 1);

  const diagnosis = runbook.sections.find((s: RunbookSection) => s.name === "Diagnosis");
  assert.ok(diagnosis);
  assert.equal(diagnosis.steps.length, 2);

  const mitigation = runbook.sections.find((s: RunbookSection) => s.name === "Mitigation");
  assert.ok(mitigation);
  assert.equal(mitigation.steps.length, 1);
});

test("parseRunbookMarkdown handles section name case insensitively for executable check", () => {
  const markdown = `# Test

## DIAGNOSIS
1. Step

## mitigation
1. Step
`;
  const runbook = parseRunbookMarkdown(markdown);

  const diagnosis = runbook.sections.find((s: RunbookSection) => s.name === "DIAGNOSIS");
  assert.ok(diagnosis);
  assert.equal(diagnosis.isExecutable, true);

  const mitigation = runbook.sections.find((s: RunbookSection) => s.name === "mitigation");
  assert.ok(mitigation);
  assert.equal(mitigation.isExecutable, true);
});

test("parseRunbookMarkdown assigns fallback numbers to bullet points", () => {
  const markdown = `# Test

## Symptoms

- First
- Second
- Third
`;
  const runbook = parseRunbookMarkdown(markdown);

  const symptoms = runbook.sections.find((s: RunbookSection) => s.name === "Symptoms");
  assert.ok(symptoms);
  assert.equal(symptoms.steps[0]!.stepNumber, 1);
  assert.equal(symptoms.steps[1]!.stepNumber, 2);
  assert.equal(symptoms.steps[2]!.stepNumber, 3);
});

test("createEmptyStepResult creates step result with pending status", () => {
  const step: RunbookStep = {
    stepNumber: 1,
    command: "kubectl rollout status",
    requiresConfirmation: true,
  };

  const result = createEmptyStepResult(step);

  assert.equal(result.step, step);
  assert.equal(result.status, "pending");
  assert.equal(result.command, "kubectl rollout status");
  assert.equal(result.output, "");
  assert.equal(result.startedAt, "");
  assert.equal(result.completedAt, "");
  assert.equal(result.durationMs, 0);
});

test("createEmptyStepResult works with steps that do not require confirmation", () => {
  const step: RunbookStep = {
    stepNumber: 1,
    command: "Check logs",
    requiresConfirmation: false,
  };

  const result = createEmptyStepResult(step);

  assert.equal(result.status, "pending");
  assert.equal(result.step.requiresConfirmation, false);
});
