import assert from "node:assert/strict";
import test from "node:test";

import {
  ToolGateway,
  ToolGatewayGovernanceError,
} from "../../../../../src/platform/five-plane-execution/tool-gateway/index.js";
import type { OutboxRecord } from "../../../../../src/platform/shared/outbox/outbox-types.js";

function createOutboxRecord(overrides: Partial<OutboxRecord> = {}): OutboxRecord {
  return {
    id: "outbox-1",
    aggregateType: "task",
    aggregateId: "task-1",
    eventType: "tool_gateway:prepare",
    payloadJson: "{}",
    traceId: "trace-1",
    createdAt: "2026-05-26T00:00:00.000Z",
    publishedAt: null,
    retryCount: 0,
    lastError: null,
    lastAttemptAt: null,
    ...overrides,
  };
}

test("ToolGateway prepare and commit actions emit receipts and outbox records [index]", () => {
  const written: OutboxRecord[] = [];
  const gateway = new ToolGateway({
    outbox: {
      writeOutboxEntry: (aggregateType, aggregateId, eventType, payload, traceId) => {
        const record = createOutboxRecord({
          id: `outbox-${written.length + 1}`,
          aggregateType,
          aggregateId,
          eventType,
          payloadJson: JSON.stringify(payload),
          traceId: traceId ?? null,
        });
        written.push(record);
        return record;
      },
    },
  });

  const context = {
    toolName: "bash",
    tenantId: "tenant-1",
    missionId: "mission-1",
    traceId: "trace-1",
    actorId: "runtime",
    taskId: "task-1",
    executionId: "exec-1",
  };

  const prepared = gateway.prepareToolAction(context);
  const committed = gateway.commitToolAction(context);

  assert.equal(prepared.receipt.status, "prepared");
  assert.equal(committed.receipt.status, "committed");
  assert.equal(prepared.outboxRecord?.eventType, "tool_gateway:prepare");
  assert.equal(committed.outboxRecord?.eventType, "tool_gateway:commit");
  assert.equal(written.length, 2);
});

test("ToolGateway verify action reports success or failure [index]", () => {
  const gateway = new ToolGateway();
  const context = {
    toolName: "web_fetch",
    tenantId: "tenant-2",
    missionId: "mission-2",
    traceId: "trace-2",
    actorId: "runtime",
    taskId: "task-2",
  };

  const success = gateway.verifyToolAction(context, {
    verified: true,
    evidenceIds: ["artifact-1"],
  });
  const failure = gateway.verifyToolAction(context, {
    verified: false,
  });

  assert.equal(success.receipt.status, "success");
  assert.deepEqual(success.receipt.evidenceIds, ["artifact-1"]);
  assert.equal(failure.receipt.status, "failed");
});

test("ToolGateway blocks regulated autonomous no-go modes unless prepared action is approved [index]", () => {
  const gateway = new ToolGateway();
  const context = {
    toolName: "web_fetch",
    tenantId: "tenant-3",
    missionId: "mission-3",
    traceId: "trace-3",
    actorId: "runtime",
    taskId: "task-3",
    familyId: "regulated",
    blockMode: "autonomous_final_decision",
  };

  assert.throws(() => gateway.prepareToolAction(context), /tool_gateway.no_go_policy_denied/);

  const approved = gateway.prepareToolAction({
    ...context,
    preparedActionApproved: true,
  });
  assert.equal(approved.receipt.status, "prepared");
});

test("ToolGateway emits governance denial receipts for tool risk violations [index]", () => {
  const written: OutboxRecord[] = [];
  const gateway = new ToolGateway({
    outbox: {
      writeOutboxEntry: (aggregateType, aggregateId, eventType, payload, traceId) => {
        const record = createOutboxRecord({
          id: `outbox-${written.length + 1}`,
          aggregateType,
          aggregateId,
          eventType,
          payloadJson: JSON.stringify(payload),
          traceId: traceId ?? null,
        });
        written.push(record);
        return record;
      },
    },
  });

  let error: unknown = null;
  try {
    gateway.prepareToolAction({
      toolName: "refund",
      actionId: "finalize_refund",
      tenantId: "tenant-risk",
      missionId: "mission-risk",
      traceId: "trace-risk",
      actorId: "runtime",
      familyId: "enterprise-ops",
      taskId: "task-risk",
    });
  } catch (candidate) {
    error = candidate;
  }

  assert.ok(error instanceof ToolGatewayGovernanceError);
  assert.match((error as ToolGatewayGovernanceError).message, /tool_gateway\.tool_risk_denied/);
  assert.equal((error as ToolGatewayGovernanceError).receipt.status, "failed");
  assert.equal(written[0]?.eventType, "tool_gateway:governance_denied");
});

test("ToolGateway blocks prepared-action-only R3 actions until approval is present [index]", () => {
  const gateway = new ToolGateway();

  assert.throws(() => gateway.prepareToolAction({
    toolName: "github",
    actionId: "create_pr_draft",
    tenantId: "tenant-pr",
    missionId: "mission-pr",
    traceId: "trace-pr",
    actorId: "runtime",
    familyId: "engineering",
    taskId: "task-pr",
    requestSource: "trusted",
  }), /tool_gateway\.tool_risk_denied/);

  const approved = gateway.prepareToolAction({
    toolName: "github",
    actionId: "create_pr_draft",
    tenantId: "tenant-pr",
    missionId: "mission-pr",
    traceId: "trace-pr",
    actorId: "runtime",
    familyId: "engineering",
    taskId: "task-pr",
    requestSource: "trusted",
    preparedActionApproved: true,
  });

  assert.equal(approved.receipt.status, "prepared");
});
