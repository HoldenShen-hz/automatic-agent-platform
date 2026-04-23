import test from "node:test";
import assert from "node:assert/strict";

import { TaskSituationBuilder } from "../../../../../src/platform/shared/observability/task-situation-builder.js";
import { AgentStateViewService } from "../../../../../src/platform/shared/observability/agent-state-view-service.js";
import { TaskSituationReportService } from "../../../../../src/platform/shared/observability/task-situation-report-service.js";

test("task situation services build and render consistent views", () => {
  const situation = new TaskSituationBuilder().build({
    taskId: "task_1",
    objective: "stabilize deployment",
    currentPhase: "executing",
    blockers: ["await approval"],
    fileRefs: ["src/deploy.ts"],
    metrics: {
      approvalPending: 1,
    },
  });

  const view = new AgentStateViewService().build({
    agentId: "agent_exec",
    taskId: "task_1",
    executionId: "exec_1",
    currentPhase: "executing",
    blockerSummaries: situation.blockers.map((blocker) => blocker.description),
    activeToolNames: ["read", "apply_patch"],
    pendingApprovals: ["approval_1"],
  });
  const markdown = new TaskSituationReportService().renderMarkdown(situation);

  assert.equal(view.blockerCount, 1);
  assert.match(markdown, /Task Situation task_1/);
  assert.match(markdown, /await approval/);
  assert.match(markdown, /src\/deploy.ts/);
});

test("TaskSituationBuilder handles situation with no blockers", () => {
  const situation = new TaskSituationBuilder().build({
    taskId: "task_2",
    objective: "simple read",
    currentPhase: "completed",
    blockers: [],
    fileRefs: ["README.md"],
    metrics: {},
  });

  assert.equal(situation.blockers.length, 0);
  assert.equal(situation.objective, "simple read");
});

test("AgentStateViewService reports zero blockers when none present", () => {
  const view = new AgentStateViewService().build({
    agentId: "agent_simple",
    taskId: "task_3",
    executionId: "exec_3",
    currentPhase: "executing",
    blockerSummaries: [],
    activeToolNames: ["read"],
    pendingApprovals: [],
  });

  assert.equal(view.blockerCount, 0);
  assert.equal(view.activeToolNames.length, 1);
});

test("TaskSituationReportService renders empty blockers gracefully", () => {
  const situation = new TaskSituationBuilder().build({
    taskId: "task_4",
    objective: "no-blockers task",
    currentPhase: "planning",
    blockers: [],
    fileRefs: [],
    metrics: {},
  });

  const markdown = new TaskSituationReportService().renderMarkdown(situation);
  assert.match(markdown, /Task Situation task_4/);
});

test("TaskSituationBuilder defaults derived fields from file refs and runtime context", () => {
  const situation = new TaskSituationBuilder().build({
    taskId: "task_5",
    objective: "inspect repo state",
    currentPhase: "planning",
    fileRefs: ["src/index.ts", "README.md"],
  });

  assert.equal(situation.userIntent.raw, "inspect repo state");
  assert.equal(situation.userIntent.normalized, "inspect repo state");
  assert.equal(situation.userIntent.confidence, 0.9);
  assert.equal(situation.codebaseSnapshot.relevantFiles.length, 2);
  assert.deepEqual(
    situation.codebaseSnapshot.relevantFiles.map((file) => file.path),
    ["src/index.ts", "README.md"],
  );
  assert.deepEqual(situation.environmentContext.availableTools, ["read", "apply_patch", "test"]);
});

test("AgentStateViewService defaults optional execution and approval state", () => {
  const view = new AgentStateViewService().build({
    agentId: "agent_defaults",
    taskId: "task_6",
    currentPhase: "planning",
  });

  assert.equal(view.executionId, null);
  assert.equal(view.blockerCount, 0);
  assert.deepEqual(view.activeToolNames, []);
  assert.deepEqual(view.pendingApprovals, []);
  assert.match(view.viewId, /^agent_state_view_/);
  assert.match(view.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
});
