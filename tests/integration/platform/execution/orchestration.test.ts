import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { runMultiStepOrchestration } from "../../../../src/platform/five-plane-execution/execution-engine/multi-step-orchestration.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { seedQueuedTasks } from "../../../helpers/seed.js";

test("multi-step orchestration runs intake routing, planned multi-step workflow, and streaming frames", async () => {
  const workspace = createTempWorkspace("aa-multi-step-");

  try {
    const result = await runMultiStepOrchestration({
      dbPath: join(workspace, "multi-step.db"),
      title: "Research orchestration test",
      request: "Summarize the task, investigate the details, analyze the findings, and produce final research report.",
    });

    assert.equal(result.routing.requiresOrchestration, true);
    // The request routes to research_orchestration (priority 40 > general_ops priority 10 when both match "review")
    assert.equal(result.plannedWorkflow.executionSteps.length, 4);
    assert.equal(result.snapshot.task.status, "done");
    assert.equal(result.snapshot.workflow?.status, "completed");
    assert.equal(result.snapshot.stepOutputs.length, 4);
    assert.deepEqual(
      result.snapshot.stepOutputs.map((item) => item.stepId),
      ["intake_triage", "conduct_research", "analyze_findings", "final_review"],
    );
    assert.ok(
      result.snapshot.events.some((event) => event.eventType === "division:completed"),
    );
    assert.ok(
      result.streamFrames.some((frame) => frame.eventType === "completed" || frame.eventType === "progress"),
    );
    assert.equal(result.compaction?.stage1Triggered ?? false, false);

    const db = new SqliteDatabase(join(workspace, "multi-step.db"));
    const store = new AuthoritativeTaskStore(db);
    const messages = store.listMessagesBySession(result.snapshot.session!.id);
    const assistantResponse = messages.find((message) => message.messageType === "assistant_response");
    const toolResult = messages.find((message) => message.messageType === "tool_result");
    const plan = messages.find((message) => message.messageType === "assistant_plan");

    assert.equal(messages.length >= 5, true);
    assert.equal(typeof assistantResponse?.partsJson, "string");
    assert.equal(typeof toolResult?.partsJson, "string");
    assert.equal(typeof plan?.partsJson, "string");
    assert.equal(JSON.parse(assistantResponse!.partsJson!).at(0)?.partType, "text");
    assert.deepEqual(
      JSON.parse(toolResult!.partsJson!).map((part: { partType: string }) => part.partType),
      ["summary", "artifact_ref", "tool_result"],
    );
    assert.equal(JSON.parse(plan!.partsJson!).at(0)?.partType, "text");

    // Verify cost events were recorded for each successful step
    const costEvents = store.listCostEventsByTask(result.snapshot.task.id);
    assert.equal(costEvents.length, 4, "expected one cost event per successful step");
    for (const cost of costEvents) {
      assert.equal(cost.taskId, result.snapshot.task.id);
      assert.equal(cost.budgetScope, "task_execution");
      assert.equal(cost.provider, "minimax");
      assert.ok(cost.costUsd > 0);
    }
    const totalCost = store.sumCostByTask(result.snapshot.task.id);
    assert.ok(totalCost > 0, "total cost should be positive");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("multi-step orchestration triggers context compaction under a constrained context budget", async () => {
  const workspace = createTempWorkspace("aa-multi-step-");

  try {
    const result = await runMultiStepOrchestration({
      dbPath: join(workspace, "multi-step-compaction.db"),
      title: "Research compaction test",
      request: "Research market trends, investigate sources, analyze findings, and produce final research report with extensive historical tool output.",
      contextBudgetTokens: 140,
    });

    assert.equal(result.routing.requiresOrchestration, true);
    assert.equal(result.snapshot.task.status, "done");
    assert.equal(result.compaction?.stage1Triggered, true);
    assert.equal(result.compaction?.stage2Triggered, true);
    assert.ok(result.compaction?.contextMessages.some((message) => message.messageType === "compaction_summary"));
  } finally {
    cleanupPath(workspace);
  }
});

test("multi-step orchestration records full role permissions and deferred visible tools in execution prechecks", async () => {
  const workspace = createTempWorkspace("aa-multi-step-");
  const dbPath = join(workspace, "multi-step-engineering-tools.db");

  try {
    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Engineering orchestration tool exposure",
      request: "Implement a code fix for a production defect, apply a patch to update repository, verify with bash, produce handoff summary.",
    });

    assert.equal(result.routing.divisionId, "engineering_ops");
    assert.equal(result.snapshot.workflow?.workflowId, "engineering_multi_step_delivery");

    const db = new SqliteDatabase(dbPath);
    const store = new AuthoritativeTaskStore(db);
    const executions = store.listExecutionsByTask(result.snapshot.task.id);
    const engineerExecutions = executions.filter((execution) => execution.roleId === "engineer");
    const reviewerExecution = executions.find((execution) => execution.roleId === "reviewer") ?? null;

    assert.equal(engineerExecutions.length >= 2, true);
    for (const execution of engineerExecutions) {
      const allowedTools = JSON.parse(execution.allowedToolsJson ?? "[]") as string[];
      const precheck = store.getExecutionPrecheck(execution.id);
      const visibleTools = JSON.parse(precheck?.resolvedToolsJson ?? "[]") as string[];

      assert.deepEqual(
        allowedTools,
        ["read", "edit_replace", "edit_batch", "apply_patch", "bash"],
      );
      assert.equal(visibleTools.length, 4);
      assert.ok(visibleTools.includes("apply_patch"));
      assert.ok(visibleTools.every((toolName) => allowedTools.includes(toolName)));
    }

    assert.ok(reviewerExecution != null);
    const reviewerPrecheck = store.getExecutionPrecheck(reviewerExecution!.id);
    assert.deepEqual(JSON.parse(reviewerExecution!.allowedToolsJson ?? "[]"), ["read"]);
    assert.deepEqual(JSON.parse(reviewerPrecheck?.resolvedToolsJson ?? "[]"), ["read"]);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("multi-step orchestration cancels new work when read-only admission backpressure is active", async () => {
  const workspace = createTempWorkspace("aa-multi-step-");

  try {
    const result = await runMultiStepOrchestration({
      dbPath: join(workspace, "multi-step-rejected.db"),
      title: "Multi-step admission reject",
      request: "This request should be rejected before orchestration starts.",
      admissionBackpressureSnapshot: () => ({
        status: "unhealthy",
        degradationMode: "read_only_operations_only",
        queueGovernance: {
          backlogSize: 0,
          dispatchableBacklogSize: 0,
          claimedBacklogSize: 0,
          oldestWaitSeconds: null,
          oldestClaimAgeSeconds: null,
          queueNames: [],
          starvationDetected: false,
        },
        findings: ["db_not_writable"],
      }),
    });

    assert.equal(result.snapshot.task.status, "cancelled");
    assert.equal(result.snapshot.workflow?.status, "cancelled");
    assert.equal(result.snapshot.session?.status, "cancelled");
    assert.equal(result.snapshot.execution, null);
    assert.deepEqual(
      result.snapshot.events.map((event) => event.eventType),
      ["routing:decided", "workflow:planned", "task:status_changed", "workflow:status_changed", "admission:rejected"],
    );
    assert.equal(result.snapshot.stepOutputs.length, 0);
    assert.equal(result.streamFrames.length, 0);
    assert.equal(result.compaction, null);
  } finally {
    cleanupPath(workspace);
  }
});

test("multi-step orchestration cascade-skips downstream steps when a hard dependency fails", async () => {
  const workspace = createTempWorkspace("aa-multi-step-");

  try {
    const result = await runMultiStepOrchestration({
      dbPath: join(workspace, "multi-step-cascade.db"),
      title: "Multi-step cascade skip run",
      request: "Summarize the task in detail and create a comprehensive summary document.",
      stepFailurePlans: {
        intake_triage: ["internal.unexpected_error"],
      },
    });

    // intake_triage fails → draft_solution and final_review should be cascade-skipped
    assert.equal(result.snapshot.task.status, "failed");
    assert.equal(result.snapshot.workflow?.status, "failed");
    assert.equal(result.snapshot.session?.status, "failed");
    assert.equal(result.snapshot.stepOutputs.length, 3);

    const statuses = result.snapshot.stepOutputs.map((item) => item.status);
    assert.deepEqual(statuses, ["failed", "skipped", "skipped"]);

    const skippedOutputs = result.snapshot.stepOutputs.filter((item) => item.status === "skipped");
    for (const output of skippedOutputs) {
      const data = JSON.parse(output.dataJson);
      assert.equal(data.reasonCode, "upstream_dependency_failed");
      assert.ok(Array.isArray(data.blockedBy));
    }

    // Verify cascade skip events were emitted
    assert.ok(
      result.snapshot.events.some((event) => event.eventType === "workflow:step_skipped"),
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("multi-step orchestration retries transient failures and still completes the workflow", async () => {
  const workspace = createTempWorkspace("aa-multi-step-");
  const dbPath = join(workspace, "multi-step-transient-retry.db");

  try {
    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Multi-step transient retry",
      request: "Summarize the task in detail and create a comprehensive summary document.",
      stepFailurePlans: {
        draft_solution: ["provider.rate_limited"],
      },
    });

    assert.equal(result.snapshot.task.status, "done");
    assert.equal(result.snapshot.workflow?.status, "completed");
    assert.equal(result.snapshot.workflow?.retryCount, 1);
    assert.equal(result.snapshot.workflow?.lastErrorCode, null);
    assert.equal(result.snapshot.stepOutputs.length, 3);
    assert.ok(result.snapshot.events.some((event) => event.eventType === "workflow:step_retry_scheduled"));

    const db = new SqliteDatabase(dbPath);
    const store = new AuthoritativeTaskStore(db);
    const executions = store.listExecutionsByTask(result.snapshot.task.id);
    const retryMessages = store.listMessagesBySession(result.snapshot.session!.id).filter(
      (message) => message.messageType === "workflow_retry",
    );

    assert.equal(executions.length, 4);
    assert.deepEqual(executions.map((execution) => execution.attempt), [1, 2, 3, 4]);
    assert.equal(executions[1]?.status, "failed");
    assert.equal(executions[1]?.lastErrorCode, "provider.rate_limited");
    assert.equal(retryMessages.length, 1);
    assert.equal(retryMessages[0]?.partsJson?.includes("\"partType\":\"retry_record\""), true);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("multi-step orchestration fail-closes permission failures without retry", async () => {
  const workspace = createTempWorkspace("aa-multi-step-");

  try {
    const result = await runMultiStepOrchestration({
      dbPath: join(workspace, "multi-step-permission-failure.db"),
      title: "Multi-step permission failure",
      request: "Summarize the task in detail and create a comprehensive summary document.",
      stepFailurePlans: {
        draft_solution: ["auth.permission_denied"],
      },
    });

    assert.equal(result.snapshot.task.status, "failed");
    assert.equal(result.snapshot.workflow?.status, "failed");
    assert.equal(result.snapshot.workflow?.retryCount, 0);
    assert.equal(result.snapshot.workflow?.lastErrorCode, "auth.permission_denied");
    assert.equal(result.snapshot.events.some((event) => event.eventType === "workflow:step_retry_scheduled"), false);

    const failedStep = result.snapshot.stepOutputs.find((output) => output.stepId === "draft_solution");
    assert.equal(failedStep?.status, "failed");
    assert.equal(JSON.parse(failedStep!.dataJson).reasonCode, "auth.permission_denied");
  } finally {
    cleanupPath(workspace);
  }
});

test("multi-step orchestration escalates destructive failures instead of retrying", async () => {
  const workspace = createTempWorkspace("aa-multi-step-");

  try {
    const result = await runMultiStepOrchestration({
      dbPath: join(workspace, "multi-step-destructive-escalation.db"),
      title: "Multi-step destructive escalation",
      request: "Summarize the task in detail and create a comprehensive summary document.",
      stepFailurePlans: {
        draft_solution: ["policy.approval_required"],
      },
    });

    assert.equal(result.snapshot.task.status, "awaiting_decision");
    assert.equal(result.snapshot.workflow?.status, "paused");
    assert.equal(result.snapshot.session?.status, "awaiting_user");
    assert.equal(result.snapshot.execution?.status, "blocked");
    assert.equal(result.snapshot.workflow?.lastErrorCode, "policy.approval_required");
    assert.equal(result.snapshot.events.some((event) => event.eventType === "workflow:step_retry_scheduled"), false);
    assert.deepEqual(
      result.snapshot.stepOutputs.map((output) => output.stepId),
      ["intake_triage"],
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("multi-step orchestration fails cleanly when semantic output validation still cannot recover", async () => {
  const workspace = createTempWorkspace("aa-multi-step-");

  try {
    const result = await runMultiStepOrchestration({
      dbPath: join(workspace, "multi-step-invalid-output.db"),
      title: "Multi-step invalid output",
      request: "Analyze the task, draft a solution, and review the final output.",
      stepOutputOverrides: {
        intake_triage: {
          summary: "",
        },
      },
    });

    assert.equal(result.snapshot.task.status, "failed");
    assert.equal(result.snapshot.workflow?.status, "failed");
    assert.equal(result.snapshot.workflow?.lastErrorCode, "validation.schema_mismatch");
    assert.equal(result.snapshot.stepOutputs[0]?.status, "failed");
    assert.equal(
      result.snapshot.events.some((event) => event.eventType === "workflow:step_retry_scheduled"),
      false,
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("multi-step orchestration retries semantic failures when attempts remain", async () => {
  const workspace = createTempWorkspace("aa-multi-step-");

  try {
    const result = await runMultiStepOrchestration({
      dbPath: join(workspace, "multi-step-semantic-retry.db"),
      title: "Multi-step semantic retry",
      request: "Summarize the task in detail and create a comprehensive summary document.",
      stepFailurePlans: {
        draft_solution: ["validation.schema_mismatch"],
      },
    });

    assert.equal(result.snapshot.task.status, "done");
    assert.equal(result.snapshot.workflow?.status, "completed");
    assert.equal(result.snapshot.workflow?.retryCount, 1);
    assert.equal(result.snapshot.events.some((event) => event.eventType === "workflow:step_retry_scheduled"), true);
  } finally {
    cleanupPath(workspace);
  }
});

test("multi-step orchestration derives queue-only admission backpressure from the local health snapshot by default", async () => {
  const workspace = createTempWorkspace("aa-multi-step-");
  const dbPath = join(workspace, "multi-step-default-health-queue.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedQueuedTasks(db, store, {
      count: 5,
      prefix: "multi-step-default-health",
    });
    db.close();

    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Multi-step queued by default health snapshot",
      request: "Queue this orchestration while the local runtime is overloaded.",
    });

    assert.equal(result.snapshot.task.status, "queued");
    assert.equal(result.snapshot.workflow?.status, "paused");
    assert.equal(result.snapshot.execution, null);
    assert.equal(result.snapshot.session?.status, "open");
    assert.deepEqual(
      result.snapshot.events.map((event) => event.eventType),
      ["routing:decided", "workflow:planned", "workflow:status_changed", "admission:queued"],
    );
    assert.equal(result.snapshot.events[3]?.payloadJson.includes("\"reasonCode\":\"admission.queue_backpressure\""), true);
    assert.equal(result.snapshot.stepOutputs.length, 0);
    assert.equal(result.streamFrames.length, 0);
    assert.equal(result.compaction, null);
  } finally {
    cleanupPath(workspace);
  }
});
