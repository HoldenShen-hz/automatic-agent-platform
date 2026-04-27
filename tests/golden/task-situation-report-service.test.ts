/**
 * Golden Test: Task Situation Report Service Output
 *
 * Verifies task situation report service produces consistent
 * markdown rendering for task situations with various configurations.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { TaskSituationReportService } from "../../src/platform/shared/observability/task-situation-report-service.js";
import type { TaskSituation } from "../../src/platform/orchestration/oapeflir/types/task-situation.js";
import { assertGolden } from "../helpers/golden.js";

test("golden: task situation report renders minimal situation", () => {
  const service = new TaskSituationReportService();

  const situation: TaskSituation = {
    taskId: "test_task_001",
    timestamp: 1714214400000,
    objective: "Process user request for data analysis",
    currentPhase: "executing",
    userIntent: {
      raw: "analyze the sales data",
      normalized: "analyze sales data",
      confidence: 0.95,
    },
    blockers: [],
    codebaseSnapshot: {
      rootPath: "/project",
      fileCount: 150,
      relevantFiles: [],
      gitRef: "main",
    },
    environmentContext: {
      nodeVersion: "20.0.0",
      platform: "darwin",
      workingDirectory: "/project",
      availableTools: ["read_file", "write_file", "bash"],
    },
    historicalContext: {
      previousTaskIds: [],
      relatedMemoryRefs: [],
    },
    relevantMemory: [],
    fileRefs: [],
    metrics: {},
  };

  const report = service.renderMarkdown(situation);

  assert.ok(typeof report === "string", "Report should be string");
  assert.ok(report.length > 0, "Report should not be empty");
  assert.ok(report.includes("# Task Situation"), "Report should have header");
  assert.ok(report.includes("test_task_001"), "Report should include task ID");
  assert.ok(report.includes("executing"), "Report should include phase");
  assert.ok(report.includes("analyze sales data"), "Report should include normalized intent");

  assertGolden("task-situation-report-minimal", {
    hasHeader: report.includes("# Task Situation"),
    hasTaskId: report.includes("test_task_001"),
    hasPhase: report.includes("executing"),
    hasObjective: report.includes("Process user request"),
    hasIntent: report.includes("analyze sales data"),
    hasConfidence: report.includes("0.95"),
    hasNoBlockers: report.includes("- none"),
    hasNoFileRefs: report.includes("- none"),
    hasNoMetrics: report.includes("- none"),
  });
});

test("golden: task situation report renders situation with blockers", () => {
  const service = new TaskSituationReportService();

  const situation: TaskSituation = {
    taskId: "test_task_002",
    timestamp: 1714214400000,
    objective: "Deploy application to production",
    currentPhase: "planning",
    userIntent: {
      raw: "deploy to prod",
      normalized: "deploy to production environment",
      confidence: 0.88,
    },
    blockers: [
      {
        description: "Missing required environment variables",
        severity: "critical",
      },
      {
        description: "Database migration not completed",
        severity: "high",
      },
    ],
    codebaseSnapshot: {
      rootPath: "/project",
      fileCount: 200,
      relevantFiles: [
        { path: "/project/deploy.sh", language: "bash", linesOfCode: 150 },
        { path: "/project/Dockerfile", language: "dockerfile", linesOfCode: 50 },
      ],
      gitRef: "release/v2.0",
    },
    environmentContext: {
      nodeVersion: "20.0.0",
      platform: "linux",
      workingDirectory: "/project",
      availableTools: ["read_file", "write_file", "bash", "docker"],
    },
    historicalContext: {
      previousTaskIds: ["task_001", "task_002"],
      relatedMemoryRefs: ["memory_001"],
      lastExecutionOutcome: "failed",
    },
    relevantMemory: ["recent_deployment_failure"],
    fileRefs: ["/project/.env.example", "/project/docker-compose.yml"],
    metrics: {
      deploymentTimeMs: 120000,
      successRate: 0.75,
    },
  };

  const report = service.renderMarkdown(situation);

  assert.ok(typeof report === "string", "Report should be string");
  assert.ok(report.includes("[critical] Missing required environment variables"), "Should include critical blocker");
  assert.ok(report.includes("[high] Database migration not completed"), "Should include high blocker");
  assert.ok(report.includes("deploy to production environment"), "Should include normalized intent");
  assert.ok(report.includes("deploymentTimeMs"), "Should include metric key");

  assertGolden("task-situation-report-with-blockers", {
    hasHeader: report.includes("# Task Situation"),
    hasTaskId: report.includes("test_task_002"),
    hasPhase: report.includes("planning"),
    blockerCount: 2,
    hasCriticalBlocker: report.includes("[critical]"),
    hasHighBlocker: report.includes("[high]"),
    hasMetrics: report.includes("deploymentTimeMs"),
    hasFileRefs: report.includes("/.env.example"),
  });
});

test("golden: task situation report renders completed phase", () => {
  const service = new TaskSituationReportService();

  const situation: TaskSituation = {
    taskId: "test_task_003",
    timestamp: 1714214400000,
    objective: "Complete data migration",
    currentPhase: "completed",
    userIntent: {
      raw: "migrate the database",
      normalized: "migrate database to new schema",
      confidence: 0.99,
    },
    blockers: [],
    codebaseSnapshot: {
      rootPath: "/project",
      fileCount: 100,
      relevantFiles: [],
    },
    environmentContext: {
      nodeVersion: "20.0.0",
      platform: "linux",
      workingDirectory: "/project",
      availableTools: ["read_file", "write_file"],
    },
    historicalContext: {
      previousTaskIds: [],
      relatedMemoryRefs: [],
      lastExecutionOutcome: "success",
    },
    relevantMemory: [],
    fileRefs: [],
    metrics: {
      recordsMigrated: 10000,
      durationMs: 5000,
    },
  };

  const report = service.renderMarkdown(situation);

  assert.ok(report.includes("completed"), "Report should include completed phase");

  assertGolden("task-situation-report-completed", {
    hasHeader: report.includes("# Task Situation"),
    hasTaskId: report.includes("test_task_003"),
    hasPhase: report.includes("completed"),
    hasSuccessMetric: report.includes("recordsMigrated"),
  });
});

test("golden: task situation report renders reviewing phase with warnings", () => {
  const service = new TaskSituationReportService();

  const situation: TaskSituation = {
    taskId: "test_task_004",
    timestamp: 1714214400000,
    objective: "Review code changes",
    currentPhase: "reviewing",
    userIntent: {
      raw: "review the pull request",
      normalized: "review pull request for code quality",
      confidence: 0.92,
    },
    blockers: [
      {
        description: "Some tests failing in CI",
        severity: "medium",
      },
    ],
    codebaseSnapshot: {
      rootPath: "/project",
      fileCount: 250,
      relevantFiles: [
        { path: "/project/src/index.ts", language: "typescript", linesOfCode: 500 },
      ],
      gitRef: "feature/new-endpoint",
    },
    environmentContext: {
      nodeVersion: "20.0.0",
      platform: "darwin",
      workingDirectory: "/project",
      availableTools: ["read_file", "grep", "bash"],
    },
    historicalContext: {
      previousTaskIds: ["task_000"],
      relatedMemoryRefs: [],
    },
    relevantMemory: [],
    fileRefs: ["/project/src/index.ts"],
    metrics: {
      linesChanged: 150,
      testCoverage: 0.85,
    },
  };

  const report = service.renderMarkdown(situation);

  assert.ok(report.includes("reviewing"), "Report should include reviewing phase");
  assert.ok(report.includes("[medium] Some tests failing"), "Should include medium blocker");

  assertGolden("task-situation-report-reviewing", {
    hasPhase: report.includes("reviewing"),
    blockerSeverity: "medium",
    hasLinesChanged: report.includes("linesChanged"),
    hasTestCoverage: report.includes("testCoverage"),
  });
});

test("golden: task situation report handles intake phase", () => {
  const service = new TaskSituationReportService();

  const situation: TaskSituation = {
    taskId: "test_task_005",
    timestamp: 1714214400000,
    objective: "Initial task intake",
    currentPhase: "intake",
    userIntent: {
      raw: "do something awesome",
      normalized: "task objective to be determined",
      confidence: 0.3,
    },
    blockers: [],
    codebaseSnapshot: {
      rootPath: "/project",
      fileCount: 0,
      relevantFiles: [],
    },
    environmentContext: {
      nodeVersion: "unknown",
      platform: "unknown",
      workingDirectory: "unknown",
      availableTools: [],
    },
    historicalContext: {
      previousTaskIds: [],
      relatedMemoryRefs: [],
    },
    relevantMemory: [],
    fileRefs: [],
    metrics: {},
  };

  const report = service.renderMarkdown(situation);

  assert.ok(report.includes("intake"), "Report should include intake phase");
  assert.ok(report.includes("0.3"), "Should include low confidence");

  assertGolden("task-situation-report-intake", {
    hasPhase: report.includes("intake"),
    hasLowConfidence: report.includes("0.3"),
    hasUnknownEnvironment: report.includes("unknown"),
  });
});

test("golden: task situation report handles empty metrics and references", () => {
  const service = new TaskSituationReportService();

  const situation: TaskSituation = {
    taskId: "test_task_006",
    timestamp: 1714214400000,
    objective: "Task with no additional data",
    currentPhase: "executing",
    userIntent: {
      raw: "minimal task",
      normalized: "minimal task",
      confidence: 1.0,
    },
    blockers: [],
    codebaseSnapshot: {
      rootPath: "/project",
      fileCount: 0,
      relevantFiles: [],
    },
    environmentContext: {
      nodeVersion: "20.0.0",
      platform: "linux",
      workingDirectory: "/project",
      availableTools: [],
    },
    historicalContext: {
      previousTaskIds: [],
      relatedMemoryRefs: [],
      lastExecutionOutcome: undefined,
    },
    relevantMemory: [],
    fileRefs: [],
    metrics: {},
  };

  const report = service.renderMarkdown(situation);

  assert.ok(report.includes("- none"), "Should show -none for empty collections");
  assert.ok(report.includes("executing"), "Should have phase");
  assert.ok(report.includes("minimal task"), "Should have objective");

  assertGolden("task-situation-report-empty-data", {
    hasObjective: report.includes("minimal task"),
    hasPhase: report.includes("executing"),
    noneCount: (report.match(/- none/g) || []).length,
  });
});

test("golden: task situation report with all severity blockers", () => {
  const service = new TaskSituationReportService();

  const situation: TaskSituation = {
    taskId: "test_task_007",
    timestamp: 1714214400000,
    objective: "Task with all blocker severities",
    currentPhase: "planning",
    userIntent: {
      raw: "complex task",
      normalized: "complex task with issues",
      confidence: 0.7,
    },
    blockers: [
      { description: "Low severity issue", severity: "low" },
      { description: "Medium severity issue", severity: "medium" },
      { description: "High severity issue", severity: "high" },
      { description: "Critical severity issue", severity: "critical" },
    ],
    codebaseSnapshot: {
      rootPath: "/project",
      fileCount: 50,
      relevantFiles: [],
    },
    environmentContext: {
      nodeVersion: "20.0.0",
      platform: "linux",
      workingDirectory: "/project",
      availableTools: ["bash"],
    },
    historicalContext: {
      previousTaskIds: [],
      relatedMemoryRefs: [],
    },
    relevantMemory: [],
    fileRefs: [],
    metrics: {
      criticalIssues: 4,
    },
  };

  const report = service.renderMarkdown(situation);

  assert.ok(report.includes("[low] Low severity issue"), "Should include low blocker");
  assert.ok(report.includes("[medium] Medium severity issue"), "Should include medium blocker");
  assert.ok(report.includes("[high] High severity issue"), "Should include high blocker");
  assert.ok(report.includes("[critical] Critical severity issue"), "Should include critical blocker");

  assertGolden("task-situation-report-all-severities", {
    hasLowBlocker: report.includes("[low]"),
    hasMediumBlocker: report.includes("[medium]"),
    hasHighBlocker: report.includes("[high]"),
    hasCriticalBlocker: report.includes("[critical]"),
    blockerCount: 4,
  });
});
