import { AuthoritativeTaskStore } from "../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";

export const PMF_EVALUATED_AT = "2026-04-08T12:00:00.000Z";

export function seedPmfValidationDataset(db: SqliteDatabase, store: AuthoritativeTaskStore): void {
  db.transaction(() => {
    insertTask(store, {
      id: "task-alpha-1",
      rootId: "root-alpha",
      divisionId: "general-ops",
      status: "done",
      actualCostUsd: 1,
      createdAt: "2026-04-02T09:00:00.000Z",
    });
    insertTask(store, {
      id: "task-alpha-2",
      rootId: "root-alpha",
      divisionId: "general-ops",
      status: "done",
      actualCostUsd: 1.2,
      createdAt: "2026-04-03T09:00:00.000Z",
    });
    insertTask(store, {
      id: "task-beta-1",
      rootId: "root-beta",
      divisionId: "general-ops",
      status: "done",
      actualCostUsd: 0.8,
      createdAt: "2026-04-04T09:00:00.000Z",
    });
    insertTask(store, {
      id: "task-gamma-1",
      rootId: "root-gamma",
      divisionId: "general-ops",
      status: "failed",
      actualCostUsd: 0.2,
      createdAt: "2026-04-05T09:00:00.000Z",
    });
    insertTask(store, {
      id: "task-delta-1",
      rootId: "root-delta",
      divisionId: "general-ops",
      status: "done",
      actualCostUsd: 1.1,
      createdAt: "2026-04-06T09:00:00.000Z",
    });
    insertTask(store, {
      id: "task-research-1",
      rootId: "root-research",
      divisionId: "research_lab",
      status: "done",
      actualCostUsd: 1.4,
      createdAt: "2026-04-06T11:00:00.000Z",
    });
    insertTask(store, {
      id: "task-old-1",
      rootId: "root-old",
      divisionId: "general-ops",
      status: "done",
      actualCostUsd: 9.9,
      createdAt: "2026-03-01T09:00:00.000Z",
    });

    insertSession(store, {
      id: "session-alpha-1",
      taskId: "task-alpha-1",
      createdAt: "2026-04-02T09:05:00.000Z",
    });
    insertSession(store, {
      id: "session-beta-1",
      taskId: "task-beta-1",
      createdAt: "2026-04-04T09:05:00.000Z",
    });
    insertSession(store, {
      id: "session-gamma-1",
      taskId: "task-gamma-1",
      createdAt: "2026-04-05T09:05:00.000Z",
    });
    insertSession(store, {
      id: "session-research-1",
      taskId: "task-research-1",
      createdAt: "2026-04-06T11:05:00.000Z",
    });

    insertStepOutput(store, {
      id: "step-alpha-1",
      taskId: "task-alpha-1",
      durationMs: 1_000,
      producedAt: "2026-04-02T09:20:00.000Z",
    });
    insertStepOutput(store, {
      id: "step-alpha-2",
      taskId: "task-alpha-2",
      durationMs: 1_500,
      producedAt: "2026-04-03T09:20:00.000Z",
    });
    insertStepOutput(store, {
      id: "step-beta-1",
      taskId: "task-beta-1",
      durationMs: 2_000,
      producedAt: "2026-04-04T09:20:00.000Z",
    });
    insertStepOutput(store, {
      id: "step-gamma-1",
      taskId: "task-gamma-1",
      durationMs: 3_000,
      producedAt: "2026-04-05T09:20:00.000Z",
    });
    insertStepOutput(store, {
      id: "step-delta-1",
      taskId: "task-delta-1",
      durationMs: 1_200,
      producedAt: "2026-04-06T09:20:00.000Z",
    });
    insertStepOutput(store, {
      id: "step-research-1",
      taskId: "task-research-1",
      durationMs: 2_200,
      producedAt: "2026-04-06T11:20:00.000Z",
    });

    insertApproval(store, {
      id: "approval-1",
      taskId: "task-alpha-1",
      status: "approved",
      requestedAt: "2026-04-02T09:10:00.000Z",
      respondedAt: "2026-04-02T09:15:00.000Z",
    });
    insertApproval(store, {
      id: "approval-2",
      taskId: "task-beta-1",
      status: "rejected",
      requestedAt: "2026-04-04T09:10:00.000Z",
      respondedAt: "2026-04-04T09:18:00.000Z",
    });
    insertApproval(store, {
      id: "approval-3",
      taskId: "task-gamma-1",
      status: "rejected",
      requestedAt: "2026-04-05T09:10:00.000Z",
      respondedAt: "2026-04-05T09:16:00.000Z",
    });
    insertApproval(store, {
      id: "approval-old",
      taskId: "task-old-1",
      status: "approved",
      requestedAt: "2026-03-01T09:10:00.000Z",
      respondedAt: "2026-03-01T09:15:00.000Z",
    });
  });
}

function insertTask(
  store: AuthoritativeTaskStore,
  input: {
    id: string;
    rootId: string;
    divisionId: string;
    status: "done" | "failed";
    actualCostUsd: number;
    createdAt: string;
  },
): void {
  store.insertTask({
    id: input.id,
    parentId: null,
    rootId: input.rootId,
    divisionId: input.divisionId,
    title: input.id,
    status: input.status,
    source: "user",
    priority: "normal",
    inputJson: "{}",
    normalizedInputJson: "{}",
    outputJson: input.status === "done" ? "{\"ok\":true}" : null,
    estimatedCostUsd: input.actualCostUsd,
    actualCostUsd: input.actualCostUsd,
    errorCode: input.status === "failed" ? "pmf.synthetic_failure" : null,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    completedAt: input.createdAt,
  });
}

function insertSession(
  store: AuthoritativeTaskStore,
  input: {
    id: string;
    taskId: string;
    createdAt: string;
  },
): void {
  store.insertSession({
    id: input.id,
    taskId: input.taskId,
    channel: "cli",
    status: "completed",
    externalSessionId: null,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  });
}

function insertStepOutput(
  store: AuthoritativeTaskStore,
  input: {
    id: string;
    taskId: string;
    durationMs: number;
    producedAt: string;
  },
): void {
  store.insertStepOutput({
    id: input.id,
    nodeRunId: input.id,
    taskId: input.taskId,
    stepId: "deliver_result",
    roleId: "general_executor",
    status: "succeeded",
    dataJson: "{\"ok\":true}",
    summary: "pmf synthetic step",
    artifactsJson: null,
    tokenCost: 42,
    durationMs: input.durationMs,
    validationJson: null,
    producedAt: input.producedAt,
  });
}

function insertApproval(
  store: AuthoritativeTaskStore,
  input: {
    id: string;
    taskId: string;
    status: "requested" | "approved" | "rejected";
    requestedAt: string;
    respondedAt: string | null;
  },
): void {
  store.insertApproval({
    id: input.id,
    taskId: input.taskId,
    executionId: null,
    status: input.status,
    requestJson: JSON.stringify({ reason: "pmf synthetic approval" }),
    responseJson: input.respondedAt ? JSON.stringify({ status: input.status }) : null,
    timeoutPolicy: "reject",
    createdAt: input.requestedAt,
    respondedAt: input.respondedAt,
  });
}
