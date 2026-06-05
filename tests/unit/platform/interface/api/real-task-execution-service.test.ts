import assert from "node:assert/strict";
import test from "node:test";

import { RealTaskExecutionService } from "../../../../../src/platform/five-plane-interface/api/real-task-execution-service.js";

function createStoreMock() {
  const taskStatusCalls: Array<{ taskId: string; status: string; updatedAt: string; errorCode?: string | null; completedAt?: string | null }> = [];
  const taskOutputCalls: Array<{ taskId: string; outputJson: string | null; updatedAt: string }> = [];
  const workflowInsertCalls: Array<Record<string, unknown>> = [];
  const workflowUpdateCalls: Array<Record<string, unknown>> = [];
  const stepOutputCalls: Array<Record<string, unknown>> = [];
  const eventCalls: Array<Record<string, unknown>> = [];
  const artifactCalls: Array<Record<string, unknown>> = [];

  return {
    store: {
      task: {
        updateTaskStatus(taskId: string, status: string, updatedAt: string, errorCode?: string | null, completedAt?: string | null) {
          taskStatusCalls.push({ taskId, status, updatedAt, errorCode, completedAt });
        },
        updateTaskOutput(taskId: string, outputJson: string | null, updatedAt: string) {
          taskOutputCalls.push({ taskId, outputJson, updatedAt });
        },
      },
      workflow: {
        getWorkflowState() {
          return null;
        },
        insertWorkflowState(input: Record<string, unknown>) {
          workflowInsertCalls.push(input);
        },
        updateWorkflowState(
          taskId: string,
          status: string,
          currentStepIndex: number,
          outputsJson: string,
          updatedAt: string,
          resumableFromStep?: string | null,
        ) {
          workflowUpdateCalls.push({ taskId, status, currentStepIndex, outputsJson, updatedAt, resumableFromStep });
        },
        insertStepOutput(input: Record<string, unknown>) {
          stepOutputCalls.push(input);
        },
      },
      event: {
        createTier1StatusEvent(input: Record<string, unknown>) {
          eventCalls.push(input);
          return input;
        },
      },
      artifact: {
        insertArtifact(input: Record<string, unknown>) {
          artifactCalls.push(input);
        },
      },
    },
    taskStatusCalls,
    taskOutputCalls,
    workflowInsertCalls,
    workflowUpdateCalls,
    stepOutputCalls,
    eventCalls,
    artifactCalls,
  };
}

test("RealTaskExecutionService persists workflow, step outputs, artifacts, and events for successful real tasks", async () => {
  const mock = createStoreMock();
  const service = new RealTaskExecutionService(mock.store as never, {
    reportRoot: "/tmp/aa-real-task-tests",
    provider: {} as never,
    model: "minimax-m2.7",
  });

  (service as unknown as { generateReportWithRetry: (input: unknown) => Promise<unknown> }).generateReportWithRetry = async () => ({
    outputSummary: "代码工作效率提升报告",
    reportPath: "/tmp/aa-real-task-tests/report.md",
    reportJsonPath: "/tmp/aa-real-task-tests/report.json",
    planTaskCount: 5,
    markdown: "# report\n",
    reportJson: "{\"ok\":true}",
  });

  await (service as unknown as { runTask: (input: unknown) => Promise<void> }).runTask({
    taskId: "task-real-1",
    title: "Research code productivity improvements",
    divisionId: "platform",
    requestedBy: "tester",
  });

  assert.equal(mock.workflowInsertCalls.length, 1);
  assert.equal(mock.stepOutputCalls.length, 1);
  assert.equal(mock.artifactCalls.length, 2);
  assert.equal(mock.eventCalls.length, 2);
  assert.equal(mock.taskStatusCalls[0]?.status, "in_progress");
  assert.equal(mock.taskStatusCalls.at(-1)?.status, "done");
  assert.equal(mock.workflowUpdateCalls.at(-1)?.status, "completed");

  const storedOutput = JSON.parse(String(mock.taskOutputCalls.at(-1)?.outputJson ?? "{}")) as Record<string, unknown>;
  assert.equal(storedOutput.executionMode, "real_model");
  assert.equal(storedOutput.modelCallStatus, "succeeded");
  assert.equal(storedOutput.modelProvider, "minimax");
  assert.equal(storedOutput.modelName, "minimax-m2.7");

  const stepOutput = mock.stepOutputCalls[0] as { stepId?: string; status?: string; artifactsJson?: string };
  assert.equal(stepOutput.stepId, "real_model");
  assert.equal(stepOutput.status, "succeeded");
  assert.match(stepOutput.artifactsJson ?? "", /artifact:\/\//);

  const artifactKinds = mock.artifactCalls.map((artifact) => String((artifact as { kind?: string }).kind));
  assert.deepEqual(artifactKinds, ["report_markdown", "report_json"]);
  assert.deepEqual(
    mock.eventCalls.map((event) => (event as { eventType?: string }).eventType),
    ["workflow:step_started", "workflow:step_completed"],
  );
});

test("RealTaskExecutionService records failed step output and workflow failure on real task errors", async () => {
  const mock = createStoreMock();
  const service = new RealTaskExecutionService(mock.store as never, {
    reportRoot: "/tmp/aa-real-task-tests",
    provider: {} as never,
    model: "minimax-m2.7",
  });

  (service as unknown as { generateReportWithRetry: () => Promise<never> }).generateReportWithRetry = async () => {
    throw new Error("MiniMax API business error: 1000 - unknown error, 520");
  };

  await (service as unknown as { runTask: (input: unknown) => Promise<void> }).runTask({
    taskId: "task-real-fail-1",
    title: "Research code productivity improvements",
    divisionId: "platform",
    requestedBy: "tester",
  });

  assert.equal(mock.stepOutputCalls.length, 1);
  assert.equal(mock.artifactCalls.length, 0);
  assert.equal(mock.taskStatusCalls.at(-1)?.status, "failed");
  assert.equal(mock.workflowUpdateCalls.at(-1)?.status, "failed");
  assert.deepEqual(
    mock.eventCalls.map((event) => (event as { eventType?: string }).eventType),
    ["workflow:step_started", "workflow:step_failed"],
  );
});
