/**
 * Golden Test: Task Situation Builder Output Structure
 *
 * Verifies task situation builder produces consistent situation reports
 * with proper phase tracking, blockers, and environment context.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { TaskSituationBuilder, type TaskSituationInput } from "../../src/platform/shared/observability/task-situation-builder.js";
import { assertGolden } from "../helpers/golden.js";
import { seedTaskAndExecution } from "../helpers/seed.js";
import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";

test("golden: task situation builder produces valid situation with required fields", () => {
  const builder = new TaskSituationBuilder();

  const input: TaskSituationInput = {
    taskId: "situation_task_001",
    objective: "Build a REST API endpoint",
    currentPhase: "executing",
  };

  const situation = builder.build(input);

  // Verify structure
  assert.ok(situation, "Situation should exist");
  assert.equal(situation.taskId, input.taskId);
  assert.equal(situation.objective, input.objective);
  assert.equal(situation.currentPhase, input.currentPhase);
  assert.ok(situation.timestamp, "Should have timestamp");
  assert.ok(situation.userIntent, "Should have userIntent");
  assert.ok(situation.blockers, "Should have blockers array");
  assert.ok(situation.codebaseSnapshot, "Should have codebaseSnapshot");
  assert.ok(situation.environmentContext, "Should have environmentContext");
  assert.ok(situation.historicalContext, "Should have historicalContext");

  assertGolden("task-situation-builder-basic", {
    taskId: situation.taskId,
    objective: situation.objective,
    currentPhase: situation.currentPhase,
    hasUserIntent: situation.userIntent !== undefined,
    blockerCount: situation.blockers.length,
    hasCodebaseSnapshot: situation.codebaseSnapshot !== undefined,
    hasEnvironmentContext: situation.environmentContext !== undefined,
    hasHistoricalContext: situation.historicalContext !== undefined,
  });
});

test("golden: task situation builder with blockers preserves severity", () => {
  const builder = new TaskSituationBuilder();

  const input: TaskSituationInput = {
    taskId: "situation_blockers_001",
    objective: "Deploy to production",
    currentPhase: "planning",
    blockers: [
      { description: "Missing environment variables", severity: "critical" },
      { description: "Database migration not complete", severity: "high" },
    ],
  };

  const situation = builder.build(input);

  assert.ok(situation.blockers.length === 2, "Should have 2 blockers");
  assert.equal(situation.blockers[0]!.severity, "critical");
  assert.equal(situation.blockers[1]!.severity, "high");

  assertGolden("task-situation-blockers", {
    blockerCount: situation.blockers.length,
    severities: situation.blockers.map((b) => b.severity),
  });
});

test("golden: task situation builder with relevant files includes file count", () => {
  const builder = new TaskSituationBuilder();

  const input: TaskSituationInput = {
    taskId: "situation_files_001",
    objective: "Refactor authentication module",
    currentPhase: "executing",
    relevantFiles: [
      { path: "/src/auth/login.ts", description: "Login handler" },
      { path: "/src/auth/logout.ts", description: "Logout handler" },
      { path: "/src/auth/session.ts", description: "Session management" },
    ],
  };

  const situation = builder.build(input);

  assert.ok(situation.codebaseSnapshot.relevantFiles.length === 3, "Should have 3 relevant files");
  assert.ok(situation.codebaseSnapshot.fileCount === 3, "File count should match");

  assertGolden("task-situation-relevant-files", {
    fileCount: situation.codebaseSnapshot.fileCount,
    relevantFileCount: situation.codebaseSnapshot.relevantFiles.length,
  });
});

test("golden: task situation builder with metrics preserves custom metrics", () => {
  const builder = new TaskSituationBuilder();

  const input: TaskSituationInput = {
    taskId: "situation_metrics_001",
    objective: "Process batch jobs",
    currentPhase: "executing",
    metrics: {
      tasksCompleted: 42,
      successRate: 0.95,
      averageLatencyMs: 150,
    },
  };

  const situation = builder.build(input);

  assert.ok(situation.metrics, "Should have metrics");
  assert.equal(situation.metrics.tasksCompleted, 42);
  assert.equal(situation.metrics.successRate, 0.95);

  assertGolden("task-situation-metrics", {
    hasMetrics: situation.metrics !== undefined,
    taskCount: situation.metrics.tasksCompleted,
    successRate: situation.metrics.successRate,
  });
});

test("golden: task situation builder environment context has required fields", () => {
  const builder = new TaskSituationBuilder();

  const input: TaskSituationInput = {
    taskId: "situation_env_001",
    objective: "Run tests",
    currentPhase: "executing",
    workingDirectory: "/app",
    availableTools: ["read", "write", "execute"],
    gitRef: "main",
  };

  const situation = builder.build(input);

  assert.ok(situation.environmentContext, "Should have environment context");
  assert.ok(situation.environmentContext.nodeVersion, "Should have nodeVersion");
  assert.ok(situation.environmentContext.platform, "Should have platform");
  assert.ok(situation.environmentContext.workingDirectory, "Should have workingDirectory");
  assert.ok(Array.isArray(situation.environmentContext.availableTools), "Should have availableTools array");

  assertGolden("task-situation-environment", {
    hasNodeVersion: situation.environmentContext.nodeVersion.length > 0,
    hasPlatform: situation.environmentContext.platform.length > 0,
    toolCount: situation.environmentContext.availableTools.length,
  });
});

test("golden: task situation builder historical context preserves previous tasks", () => {
  const builder = new TaskSituationBuilder();

  const input: TaskSituationInput = {
    taskId: "situation_history_001",
    objective: "Continue integration work",
    currentPhase: "executing",
    previousTaskIds: ["task_001", "task_002", "task_003"],
    lastExecutionOutcome: "success",
  };

  const situation = builder.build(input);

  assert.ok(situation.historicalContext, "Should have historical context");
  assert.ok(situation.historicalContext.previousTaskIds.length === 3, "Should have 3 previous tasks");
  assert.equal(situation.historicalContext.lastExecutionOutcome, "success");

  assertGolden("task-situation-historical", {
    previousTaskCount: situation.historicalContext.previousTaskIds.length,
    hasLastOutcome: situation.historicalContext.lastExecutionOutcome !== undefined,
  });
});

test("golden: task situation builder with normalized intent preserves confidence", () => {
  const builder = new TaskSituationBuilder();

  const input: TaskSituationInput = {
    taskId: "situation_intent_001",
    objective: "Create user account",
    currentPhase: "planning",
    normalizedIntent: "user.create account registration",
    intentConfidence: 0.87,
  };

  const situation = builder.build(input);

  assert.ok(situation.userIntent, "Should have userIntent");
  assert.equal(situation.userIntent.normalized, input.normalizedIntent);
  assert.equal(situation.userIntent.confidence, input.intentConfidence);

  assertGolden("task-situation-intent", {
    normalizedLength: situation.userIntent.normalized.length,
    confidence: situation.userIntent.confidence,
  });
});
