import assert from "node:assert/strict";
import { createServer, type IncomingMessage } from "node:http";
import { PassThrough } from "node:stream";
import test from "node:test";

import { AppError } from "../../../src/platform/contracts/errors.js";
import { HttpApiServer } from "../../../src/platform/five-plane-interface/api/http-api-server.js";
import { buildJsonErrorResponse } from "../../../src/platform/five-plane-interface/api/http-server/utils.js";
import { normalizeError } from "../../../src/platform/five-plane-interface/api/http-server/api-error.js";
import { GatewayTargetNotFoundError } from "../../../src/platform/five-plane-interface/channel-gateway/gateway-target-directory-service.js";
import {
  CHANNEL_DELIVERY_DDL,
  ChannelGatewayDeliveryService,
} from "../../../src/platform/five-plane-interface/channel-gateway/channel-gateway-delivery-service.js";
import { WebSocketBridge } from "../../../src/platform/five-plane-interface/channel-gateway/websocket-bridge.js";
import { StreamBridge } from "../../../src/platform/five-plane-interface/channel-gateway/stream-bridge.js";
import { SqliteDatabase } from "../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../helpers/fs.js";
import { join } from "node:path";

function createHttpApiServer(options: {
  apiDefaultTimeoutMs?: number;
  apiMaxTimeoutMs?: number;
} = {}): HttpApiServer {
  const inspectService = {
    queryTaskInspectSummaries: () => [],
    getTaskInspectView: () => ({
      task: { id: "task-1", tenantId: null },
      steps: [],
      executions: [],
      approvals: [],
      artifacts: [],
      dispatchDecisions: [],
      stepResults: [],
      runtimeRecovery: { candidates: [] },
      workflowState: null,
    }),
  };
  const missionControlService = {
    getTaskCockpit: () => ({
      snapshot: {
        task: { id: "task-1", tenantId: null, createdAt: null, updatedAt: null },
        events: [],
        artifacts: [],
      },
      inspect: {
        task: { id: "task-1", tenantId: null },
        steps: [],
        executions: [],
        approvals: [],
        artifacts: [],
        dispatchDecisions: [],
        stepResults: [],
        runtimeRecovery: { candidates: [] },
        workflowState: null,
      },
      timeline: { entries: [] },
    }),
    listWorkflowCockpits: () => [],
    getWorkflowCockpit: () => ({
      summary: { taskId: "task-1", workflowId: "wf-1", workflowStatus: "pending", currentStepIndex: 0, pendingApprovalCount: 0, retryCount: 0, resumableFromStep: null },
      inspect: { task: { id: "task-1", tenantId: null }, steps: [], executions: [], approvals: [], artifacts: [], dispatchDecisions: [], stepResults: [], runtimeRecovery: { candidates: [] }, workflowState: null },
      timeline: { entries: [] },
    }),
    getSnapshot: () => ({
      generatedAt: new Date().toISOString(),
      health: { status: "ok", queuedTasks: 0, activeExecutions: 0, tier1AckBacklog: 0 },
      metrics: { tasksTotal: 0, tasksActive: 0, tasksDone: 0, tasksFailed: 0 },
      taskBoard: [],
      pendingApprovals: [],
      divisions: [],
      gatewayTargets: [],
      productSignals: { billingAccounts: [], latestPmfReport: null, perceptionBriefs: [] },
    }),
  };
  const approvalService = {
    applyDecision: () => undefined,
  };
  return new HttpApiServer({
    approvalService: approvalService as never,
    inspectService: inspectService as never,
    missionControlService: missionControlService as never,
    ...options,
  });
}

function createDeliveryHarness() {
  const workspace = createTempWorkspace("reaudit-r25-delivery-");
  const db = new SqliteDatabase(join(workspace, "delivery.db"));
  db.migrate();
  db.connection.exec(CHANNEL_DELIVERY_DDL);
  const service = new ChannelGatewayDeliveryService(db);
  return {
    workspace,
    db,
    service,
    cleanup() {
      db.close();
      cleanupPath(workspace);
    },
  };
}

function createDelayedIncomingMessage(data: string, delayMs: number): IncomingMessage {
  const passthrough = new PassThrough();
  const request = Object.assign(passthrough, {
    headers: {},
    method: "POST",
    url: "/timeout-body",
  });
  setTimeout(() => {
    passthrough.write(data, () => passthrough.end());
  }, delayMs);
  return request as unknown as IncomingMessage;
}

test("R25-03 normalizeError maps gateway target lookup errors before generic AppError handling", () => {
  const normalized = normalizeError(new GatewayTargetNotFoundError("missing-target"));
  assert.equal(normalized.code, "gateway.target_not_found");
  assert.equal(normalized.statusCode, 404);
});

test("R25-04 buildJsonErrorResponse includes traceId and structured details", () => {
  const payload = buildJsonErrorResponse("req-1", 409, {
    code: "gateway.target_ambiguous",
    message: "Ambiguous",
    traceId: "trace-1",
    details: { candidates: 2 },
  });
  const body = JSON.parse(payload.body) as {
    requestId: string;
    traceId: string;
    error: { code: string; message: string; details: { candidates: number } };
  };

  assert.equal(body.requestId, "req-1");
  assert.equal(body.traceId, "trace-1");
  assert.equal(body.error.code, "gateway.target_ambiguous");
  assert.equal(body.error.details.candidates, 2);
});

test("R25-04 HttpApiServer error responses preserve AppError traceId and details", async () => {
  const server = createHttpApiServer();
  (server as unknown as {
    routeTable: Array<{ method: string; pathname: string; handler: () => never }>;
  }).routeTable.unshift({
    method: "GET",
    pathname: "/reaudit-error",
    handler: () => {
      throw new AppError("reaudit.synthetic", "Synthetic failure", {
        statusCode: 418,
        traceId: "trace-app-error",
        details: { reason: "reaudit" },
      });
    },
  });

  try {
    const response = await server.inject({
      method: "GET",
      url: "/reaudit-error",
      headers: {
        "x-correlation-id": "corr-ignored-because-app-error-has-trace",
      },
    });
    const body = response.json<{
      traceId: string;
      error: { code: string; message: string; details: { reason: string } };
    }>();
    assert.equal(response.statusCode, 418);
    assert.equal(body.traceId, "trace-app-error");
    assert.equal(body.error.details.reason, "reaudit");
  } finally {
    await server.stop();
  }
});

test("R25-05 generateNonce returns full 32-byte entropy as 64 hex characters", () => {
  const harness = createDeliveryHarness();
  try {
    const nonce = harness.service.generateNonce();
    assert.equal(nonce.length, 64);
    assert.match(nonce, /^[a-f0-9]+$/);
  } finally {
    harness.cleanup();
  }
});

test("R25-06 createDeliveryMessage keeps finalStatus pending until an attempt finishes", () => {
  const harness = createDeliveryHarness();
  try {
    const receipt = harness.service.createDeliveryMessage("webhook", "target-1", { text: "hello" });
    assert.equal(receipt.status, "pending_retry");
    assert.equal(receipt.finalStatus, "pending");
    const persisted = harness.service.getDeliveryReceipt(receipt.messageId);
    assert.equal(persisted?.finalStatus, "pending");
  } finally {
    harness.cleanup();
  }
});

test("R25-07 rate limiting is isolated per tenant instead of sharing a channel-wide bucket", () => {
  const harness = createDeliveryHarness();
  try {
    for (let index = 0; index < 50; index += 1) {
      harness.service.recordRateLimitHit("default", "tenant-a");
    }
    const tenantA = harness.service.checkRateLimit("default", "tenant-a");
    const tenantB = harness.service.checkRateLimit("default", "tenant-b");
    assert.equal(tenantA.allowed, false);
    assert.equal(tenantB.allowed, true);
  } finally {
    harness.cleanup();
  }
});

test("R25-07 rate limiting still blocks recent tenant traffic across a fixed-window boundary", () => {
  const harness = createDeliveryHarness();
  const originalNow = Date.now;
  try {
    Date.now = () => 1500;
    for (let index = 0; index < 50; index += 1) {
      harness.service.recordRateLimitHit("default", "tenant-a");
    }

    Date.now = () => 2001;
    const tenantA = harness.service.checkRateLimit("default", "tenant-a");
    const tenantB = harness.service.checkRateLimit("default", "tenant-b");
    assert.equal(tenantA.allowed, false);
    assert.equal(tenantB.allowed, true);
  } finally {
    Date.now = originalNow;
    harness.cleanup();
  }
});

test("R25-09 StreamBridge replay buffer remains bounded and evicts old droppable frames", () => {
  const bridge = new StreamBridge({ maxReplayFrames: 2 });
  const streamId = bridge.createStreamId("task-1", "updates");
  bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "progress", payload: { step: 1 } });
  bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "progress", payload: { step: 2 } });
  bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "completed", payload: { ok: true } });

  const replayWindow = bridge.getReplayWindow(streamId);
  const bufferedFrames = bridge.replayAfterSequence(streamId, 1);
  assert.equal(replayWindow.bufferedFrameCount, 2);
  assert.equal(bufferedFrames.length, 2);
  assert.equal(bufferedFrames.some((frame) => frame.eventType === "completed"), true);
});

test("R25-08 and R25-11 WebSocketBridge heartbeat sweep drops dead clients and subscribe path enforces tenant scope", async () => {
  const server = createServer();
  const bridge = new WebSocketBridge(
    server,
    {
      authenticate() {
        return { actorId: "actor-1", tenantId: "tenant-a", roles: ["tasks:read"] };
      },
    } as never,
    (taskId) => ({ taskId, tenantId: "tenant-b", requiredScopes: ["tasks:read"] }),
    { heartbeatIntervalMs: 60_000 },
  );

  try {
    const denySocket = {
      OPEN: 1,
      readyState: 1,
      send() {},
      close() {},
      ping() {},
      removeAllListeners() {},
    };
    (bridge as unknown as {
      clients: Map<object, unknown>;
      subscribeToTask: (ws: object, taskId: string) => string;
    }).clients.set(denySocket, {
      webSocket: denySocket,
      principal: { actorId: "actor-1", tenantId: "tenant-a", scopes: ["tasks:read"] },
      subscribedTasks: new Set<string>(),
      lastEventId: null,
      nextExpectedSequenceNum: 0,
      lastAcknowledgedSequenceNum: -1,
      pendingAcks: new Map(),
      bufferedEventCount: 0,
      isAlive: true,
    });
    assert.equal((bridge as unknown as { subscribeToTask: (ws: object, taskId: string) => string }).subscribeToTask(denySocket, "task-1"), "scope_denied");

    let pinged = false;
    let terminated = false;
    const liveSocket = {
      OPEN: 1,
      readyState: 1,
      send() {},
      close() {},
      ping() {
        pinged = true;
      },
      removeAllListeners() {},
    };
    const deadSocket = {
      OPEN: 1,
      readyState: 1,
      send() {},
      close() {},
      terminate() {
        terminated = true;
      },
      removeAllListeners() {},
    };
    const internal = bridge as unknown as { clients: Map<object, unknown>; runHeartbeatSweep: () => void };
    internal.clients.set(liveSocket, {
      webSocket: liveSocket,
      principal: { actorId: "actor-live", tenantId: "tenant-a", scopes: [] },
      subscribedTasks: new Set<string>(),
      lastEventId: null,
      nextExpectedSequenceNum: 0,
      lastAcknowledgedSequenceNum: -1,
      pendingAcks: new Map(),
      bufferedEventCount: 0,
      isAlive: true,
    });
    internal.clients.set(deadSocket, {
      webSocket: deadSocket,
      principal: { actorId: "actor-dead", tenantId: "tenant-a", scopes: [] },
      subscribedTasks: new Set<string>(),
      lastEventId: null,
      nextExpectedSequenceNum: 0,
      lastAcknowledgedSequenceNum: -1,
      pendingAcks: new Map(),
      bufferedEventCount: 0,
      isAlive: false,
    });

    internal.runHeartbeatSweep();
    assert.equal(pinged, true);
    assert.equal(terminated, true);
  } finally {
    await bridge.close();
    server.close();
  }
});

test("R25-10 WebSocketBridge configures a bounded max payload for inbound messages", async () => {
  const server = createServer();
  const bridge = new WebSocketBridge(
    server,
    {
      authenticate() {
        return { actorId: "actor-1", tenantId: null, roles: [] };
      },
    } as never,
    null,
    { maxPayloadBytes: 2048, heartbeatIntervalMs: 60_000 },
  );
  try {
    assert.equal(((bridge as unknown as { wss: { options: { maxPayload?: number } } }).wss.options.maxPayload), 2048);
  } finally {
    await bridge.close();
    server.close();
  }
});

test("R25-12 HttpApiServer rate-limit endpoint keys normalize task identifiers", () => {
  const server = createHttpApiServer();
  const internal = server as unknown as { extractEndpointKey: (url: string) => string };
  assert.equal(internal.extractEndpointKey("/api/v1/tasks/task-1234567890"), "/api/v1/tasks/:id");
  assert.equal(internal.extractEndpointKey("/api/v1/tasks/task-1234567890/events"), "/api/v1/tasks/:id/events");
  assert.equal(internal.extractEndpointKey("/v1/workflows/wf-1234567890"), "/v1/workflows/:id");
});

test("R25-13 HttpApiServer applies the request timeout budget while reading the request body", async () => {
  const server = createHttpApiServer({
    apiDefaultTimeoutMs: 5,
    apiMaxTimeoutMs: 5,
  });
  const request = createDelayedIncomingMessage("slow body", 20);

  try {
    await assert.rejects(
      () => (server as unknown as {
        routeRequest: (
          requestId: string,
          request: IncomingMessage,
          headers: Record<string, string | undefined>,
        ) => Promise<unknown>;
      }).routeRequest("req-timeout", request, {
        "content-length": String("slow body".length),
      }),
      (error: unknown) => (error as AppError).code === "api.request_timeout",
    );
  } finally {
    await server.stop();
  }
});
