/**
 * Unit tests for TaskSituationReportService.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { TaskSituationReportService } from "../../../../../src/platform/shared/observability/task-situation-report-service.js";
import type { TaskSituation } from "../../../../../src/platform/shared/observability/task-situation-builder.js";

test("TaskSituationReportService.renderMarkdown creates markdown with task title", () => {
  const service = new TaskSituationReportService();
  const situation: TaskSituation = {
    taskId: "task-report-1",
    timestamp: Date.now(),
    objective: "Deploy application",
    currentPhase: "executing",
    userIntent: { raw: "deploy app", normalized: "deploy application", confidence: 0.95 },
    blockers: [],
    codebaseSnapshot: { rootPath: "/workspace", fileCount: 0, relevantFiles: [], gitRef: "main" },
    environmentContext: { nodeVersion: "20.0.0", platform: "darwin", workingDirectory: "/workspace", availableTools: ["read", "apply_patch"] },
    historicalContext: { previousTaskIds: [], relatedMemoryRefs: [], lastExecutionOutcome: undefined },
    relevantMemory: [],
    fileRefs: [],
    metrics: {},
  };

  const markdown = service.renderMarkdown(situation);

  assert.ok(markdown.includes("# Task Situation task-report-1"));
  assert.ok(markdown.includes("- objective: Deploy application"));
  assert.ok(markdown.includes("- phase: executing"));
});

test("TaskSituationReportService.renderMarkdown shows blockers", () => {
  const service = new TaskSituationReportService();
  const situation: TaskSituation = {
    taskId: "task-report-2",
    timestamp: Date.now(),
    objective: "Fix bug",
    currentPhase: "executing",
    userIntent: { raw: "fix bug", normalized: "fix authentication bug", confidence: 0.8 },
    blockers: [
      { description: "Missing API key", severity: "high" },
      { description: "Rate limit exceeded", severity: "medium" },
    ],
    codebaseSnapshot: { rootPath: "/workspace", fileCount: 1, relevantFiles: [], gitRef: "main" },
    environmentContext: { nodeVersion: "20.0.0", platform: "darwin", workingDirectory: "/workspace", availableTools: ["read"] },
    historicalContext: { previousTaskIds: [], relatedMemoryRefs: [], lastExecutionOutcome: undefined },
    relevantMemory: [],
    fileRefs: [],
    metrics: {},
  };

  const markdown = service.renderMarkdown(situation);

  assert.ok(markdown.includes("## Blockers"));
  assert.ok(markdown.includes("[high] Missing API key"));
  assert.ok(markdown.includes("[medium] Rate limit exceeded"));
});

test("TaskSituationReportService.renderMarkdown shows fileRefs", () => {
  const service = new TaskSituationReportService();
  const situation: TaskSituation = {
    taskId: "task-report-3",
    timestamp: Date.now(),
    objective: "Review files",
    currentPhase: "executing",
    userIntent: { raw: "review", normalized: "review changes", confidence: 0.9 },
    blockers: [],
    codebaseSnapshot: { rootPath: "/workspace", fileCount: 2, relevantFiles: [], gitRef: "main" },
    environmentContext: { nodeVersion: "20.0.0", platform: "darwin", workingDirectory: "/workspace", availableTools: ["read"] },
    historicalContext: { previousTaskIds: [], relatedMemoryRefs: [], lastExecutionOutcome: undefined },
    relevantMemory: [],
    fileRefs: ["/src/auth.ts", "/src/config.ts"],
    metrics: {},
  };

  const markdown = service.renderMarkdown(situation);

  assert.ok(markdown.includes("## File Refs"));
  assert.ok(markdown.includes("- /src/auth.ts"));
  assert.ok(markdown.includes("- /src/config.ts"));
});

test("TaskSituationReportService.renderMarkdown shows metrics", () => {
  const service = new TaskSituationReportService();
  const situation: TaskSituation = {
    taskId: "task-report-4",
    timestamp: Date.now(),
    objective: "Process data",
    currentPhase: "executing",
    userIntent: { raw: "process", normalized: "process data", confidence: 0.85 },
    blockers: [],
    codebaseSnapshot: { rootPath: "/workspace", fileCount: 0, relevantFiles: [], gitRef: "main" },
    environmentContext: { nodeVersion: "20.0.0", platform: "darwin", workingDirectory: "/workspace", availableTools: ["read"] },
    historicalContext: { previousTaskIds: [], relatedMemoryRefs: [], lastExecutionOutcome: undefined },
    relevantMemory: [],
    fileRefs: [],
    metrics: { filesProcessed: 150, errorsEncountered: 2, durationMs: 5000 },
  };

  const markdown = service.renderMarkdown(situation);

  assert.ok(markdown.includes("## Metrics"));
  assert.ok(markdown.includes("filesProcessed: 150"));
  assert.ok(markdown.includes("errorsEncountered: 2"));
  assert.ok(markdown.includes("durationMs: 5000"));
});

test("TaskSituationReportService.renderMarkdown shows none when no blockers", () => {
  const service = new TaskSituationReportService();
  const situation: TaskSituation = {
    taskId: "task-report-5",
    timestamp: Date.now(),
    objective: "Simple task",
    currentPhase: "executing",
    userIntent: { raw: "simple", normalized: "simple task", confidence: 0.9 },
    blockers: [],
    codebaseSnapshot: { rootPath: "/workspace", fileCount: 0, relevantFiles: [], gitRef: "main" },
    environmentContext: { nodeVersion: "20.0.0", platform: "darwin", workingDirectory: "/workspace", availableTools: ["read"] },
    historicalContext: { previousTaskIds: [], relatedMemoryRefs: [], lastExecutionOutcome: undefined },
    relevantMemory: [],
    fileRefs: [],
    metrics: {},
  };

  const markdown = service.renderMarkdown(situation);

  assert.ok(markdown.includes("## Blockers"));
  assert.ok(markdown.includes("- none"));
});