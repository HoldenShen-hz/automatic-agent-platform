import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { PassThrough } from "node:stream";
import { finished } from "node:stream/promises";
import test from "node:test";
import { brotliDecompressSync, gunzipSync } from "node:zlib";

import { ApiAuthService } from "../../../../../src/platform/five-plane-interface/api/api-auth-service.js";
import { HttpApiServer } from "../../../../../src/platform/five-plane-interface/api/http-api-server.js";
import { ConfigRolloutService } from "../../../../../src/platform/five-plane-control-plane/config-center/config-rollout-service.js";
import { TenantBoundaryRegistryService } from "../../../../../src/platform/five-plane-control-plane/tenant/index.js";
import { CostReportService } from "../../../../../src/platform/five-plane-interface/api/cost-report-service.js";
import { HierarchicalPromptRegistryService } from "../../../../../src/platform/prompt-engine/registry/hierarchical-registry-service.js";
import type { ApprovalService } from "../../../../../src/platform/five-plane-control-plane/approval-center/approval-service.js";
import type { ApprovalDecision } from "../../../../../src/platform/five-plane-control-plane/approval-center/approval-service.js";
import type { ChannelGatewayDeliveryService } from "../../../../../src/platform/five-plane-interface/channel-gateway/channel-gateway-delivery-service.js";
import type { ChannelGatewayService } from "../../../../../src/platform/five-plane-interface/channel-gateway/channel-gateway-service.js";
import type { CoordinatorLoadBalancingService } from "../../../../../src/platform/five-plane-execution/ha/coordinator-load-balancing-service.js";
import type { GatewayTargetDirectoryService } from "../../../../../src/platform/five-plane-interface/channel-gateway/gateway-target-directory-service.js";
import type { InspectService } from "../../../../../src/platform/shared/observability/inspect-service.js";
import type { MissionControlService } from "../../../../../src/platform/five-plane-interface/api/mission-control-service.js";
import type { BillingService } from "../../../../../src/scale-ecosystem/marketplace/billing-service.js";
import type { PrometheusMetricsExporter } from "../../../../../src/platform/shared/observability/prometheus-metrics-exporter.js";

// ─── Mock Implementations ────────────────────────────────────────────────────

function createMockApprovalService(): ApprovalService {
  return {
    applyDecision: (decision: ApprovalDecision) => {
      // No-op for testing
    },
  } as unknown as ApprovalService;
}

function createMockInspectService(): InspectService {
  return {
    getApprovalInspectView: (approvalId: string) => ({
      task: {
        id: approvalId,
        title: "Test Task",
        status: "in_progress",
        tenantId: null,
      },
      workflowState: null,
      execution: null,
      session: null,
      approval: {
        id: approvalId,
        taskId: "task_123",
        status: "requested",
        type: "human_review",
        requestedBy: "agent_1",
        requestedAt: new Date().toISOString(),
        summary: "Test approval",
        options: ["approve", "reject"],
        riskLevel: "medium",
        context: {},
        timeoutMs: 300000,
        deadline: null,
        resolvedBy: null,
        resolvedAt: null,
        decision: null,
        tenantId: null,
        traceId: "trace_123",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      approvals: [],
      operatorActions: [],
      agentExecution: null,
      dispatchDecisions: [],
      remoteRoutingSummary: null,
      leaseHandoverSummary: null,
      recentEvents: [],
      stepResults: [],
      taskResult: null,
      artifacts: [],
      runtimeRecovery: {
        candidates: [],
        resumable: false,
      },
    }),
    queryDecisionInspectSummaries: () => [],
    queryTaskInspectSummaries: () => [],
    getTaskInspectView: () => ({
      task: {
        id: "task_123",
        title: "Test Task",
        status: "in_progress",
        tenantId: null,
      },
      workflow: null,
      execution: null,
      session: null,
      events: [],
      approvals: [],
      operatorActions: [],
      agentExecution: null,
      dispatchDecisions: [],
      remoteRoutingSummary: null,
      leaseHandoverSummary: null,
      stepResults: [],
      taskResult: null,
      artifacts: [],
      runtimeRecovery: {
        candidates: [],
        resumable: false,
      },
    }),
  } as unknown as InspectService;
}

function createMockMissionControlService(): MissionControlService {
  const snapshot = {
    generatedAt: new Date().toISOString(),
    health: {
      status: "ok",
      uptimeSeconds: 100,
      dbWritable: true,
      providerHealth: "healthy",
      providerSuccessRate: 1.0,
      providerRecentCalls: 0,
      activeExecutions: 0,
      queuedTasks: 0,
      eventLoopLagMs: null,
      memoryRssMb: 64,
      tier1AckBacklog: 0,
      degradationMode: "none",
      queueGovernance: {
        tier1Pending: 0,
        tier2Pending: 0,
        tier3Pending: 0,
        throughput: { p50Ms: 0, p99Ms: 0 },
      },
      workerHealth: {
        totalWorkers: 0,
        activeWorkers: 0,
        idleWorkers: 0,
      },
      findings: [],
    },
    metrics: {
      tasks: { total: 0, queued: 0, inProgress: 0, done: 0, failed: 0 },
      executions: { active: 0, queued: 0, completed: 0, failed: 0 },
    },
    taskBoard: [],
    pendingApprovals: [],
    divisions: [],
    productSignals: {
      latestPmfReport: null,
      billingAccounts: [],
      perceptionBriefs: [],
    },
    gatewayTargets: [],
  };

  return {
    getSnapshot: () => ({
      ...snapshot,
    }),
    getHealthReportAsync: async () => snapshot.health,
    getTaskCockpit: () => ({
      snapshot: {
        task: {
          id: "task_123",
          title: "Test Task",
          status: "in_progress",
          tenantId: null,
        },
        events: [],
        artifacts: [],
      },
      inspect: {
        task: {
          id: "task_123",
          title: "Test Task",
          status: "in_progress",
          tenantId: null,
        },
        workflow: null,
        execution: null,
        session: null,
        events: [],
        approvals: [],
        operatorActions: [],
        agentExecution: null,
        dispatchDecisions: [],
        remoteRoutingSummary: null,
        leaseHandoverSummary: null,
        stepResults: [],
        taskResult: null,
        artifacts: [],
        runtimeRecovery: {
          candidates: [],
          resumable: false,
        },
      },
      timeline: { entries: [] },
    }),
    getWorkflowCockpit: () => ({
      summary: {
        workflowId: "wf_123",
        taskId: "task_123",
        workflowStatus: "in_progress",
        currentStepIndex: 0,
        retryCount: 0,
        pendingApprovalCount: 0,
        resumableFromStep: null,
      },
      inspect: {
        task: {
          id: "task_123",
          title: "Test Task",
          status: "in_progress",
          tenantId: null,
        },
        workflow: null,
        execution: null,
        session: null,
        events: [],
        approvals: [],
        operatorActions: [],
        agentExecution: null,
        dispatchDecisions: [],
        remoteRoutingSummary: null,
        leaseHandoverSummary: null,
        stepResults: [],
        taskResult: null,
        artifacts: [],
        runtimeRecovery: {
          candidates: [],
          resumable: false,
        },
      },
      timeline: { entries: [] },
    }),
    listWorkflowCockpits: () => [],
    getStabilityPanel: () => ({
      generatedAt: new Date().toISOString(),
      health: {
        status: "ok",
        uptimeSeconds: 100,
        dbWritable: true,
        providerHealth: "healthy",
        providerSuccessRate: 1.0,
        providerRecentCalls: 0,
        activeExecutions: 0,
        queuedTasks: 0,
        eventLoopLagMs: null,
        memoryRssMb: 64,
        tier1AckBacklog: 0,
        degradationMode: "none",
        queueGovernance: {
          tier1Pending: 0,
          tier2Pending: 0,
          tier3Pending: 0,
          throughput: { p50Ms: 0, p99Ms: 0 },
        },
        workerHealth: {
          totalWorkers: 0,
          activeWorkers: 0,
          idleWorkers: 0,
        },
        findings: [],
      },
      activeTasks: [],
      queuedTasks: [],
      blockedTasks: [],
      workflows: [],
      pendingApprovals: [],
      workers: [],
      findings: [],
    }),
    getAdminTakeoverConsole: () => ({
      generatedAt: new Date().toISOString(),
      scope: {
        taskId: "task_123",
        divisionId: null,
        workspaceId: null,
        tenantId: null,
      },
      executionOwner: {
        executionId: null,
        workerId: null,
        leaseId: null,
        leaseStatus: null,
      },
      activeWorker: null,
      latestPmfVerdict: null,
      inspect: {
        takeoverSessions: [],
        operatorActions: [],
      },
      timeline: { entries: [] },
    }),
    listApprovalQueue: () => [],
  } as unknown as MissionControlService;
}

function createMockGatewayTargetDirectoryService(): GatewayTargetDirectoryService {
  return {
    listTargets: () => [
      {
        targetId: "target_1",
        channel: "telegram",
        displayName: "Test Target",
        source: "directory" as const,
        lastSeenAt: null,
      },
    ],
    resolveTarget: () => ({
      targetId: "target_1",
      channel: "telegram",
      displayName: "Test Target",
      source: "directory" as const,
      lastSeenAt: null,
    }),
  } as unknown as GatewayTargetDirectoryService;
}

function createMockChannelGatewayService(): ChannelGatewayService {
  return {
    sendMessage: async (input: { text: string; channel?: string; query?: string; targetId?: string; metadata?: Record<string, unknown> }) => ({
      deliveredAt: new Date().toISOString(),
      channel: input.channel ?? "telegram",
      targetId: input.targetId ?? "target_1",
      externalTargetId: "external_1",
      requestUrl: "https://example.com/webhook",
      providerMessageId: "msg_123",
    }),
  } as unknown as ChannelGatewayService;
}

function createMockChannelGatewayDeliveryService(): ChannelGatewayDeliveryService {
  return {
    verifySignature: (payload: string, signature: string, timestamp: string | null, config: { secret: string; toleranceSeconds?: number }) => ({
      valid: true,
      error: null,
    }),
    verifyNonce: (nonce: string, toleranceSeconds: number) => ({
      valid: true,
      error: null,
    }),
    createDeliveryMessage: (channel: string, targetId: string, payload: Record<string, unknown>) => ({
      messageId: "msg_delivery_123",
      channel,
      targetId,
      status: "delivered" as const,
      attempts: 1,
      finalStatus: "success" as const,
      firstAttemptAt: new Date().toISOString(),
      lastAttemptAt: new Date().toISOString(),
      providerMessageId: "provider_msg_123",
    }),
    recordAttempt: () => ({
      attemptId: "attempt_1",
      messageId: "msg_delivery_123",
      channel: "webhook",
      targetId: "target_1",
      attemptNumber: 1,
      status: "success" as const,
      responseStatus: 200,
      errorMessage: null,
      nextRetryAt: null,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    }),
  } as unknown as ChannelGatewayDeliveryService;
}

function createMockCoordinatorLoadBalancingService(): CoordinatorLoadBalancingService {
  return {
    buildSummary: () => ({
      coordinators: [],
      totalActive: 0,
      totalBacklog: 0,
    }),
    selectCoordinator: (input: { queueName?: string; preferredRegion?: string; tenantId?: string; requestKey?: string }) => ({
      outcome: "selected" as const,
      selectedCoordinatorId: "coord_test_1",
      evaluations: [],
      reasonCode: "test",
      requestKey: input.requestKey,
    }),
  } as unknown as CoordinatorLoadBalancingService;
}

function createMockBillingService(): BillingService {
  return {
    reconcilePaymentSession: (input: {
      gatewayKind: "manual" | "stripe" | "paddle";
      gatewaySessionRef: string;
      status: "pending" | "paid" | "failed" | "cancelled";
      occurredAt?: string;
      failureCode?: string;
    }) => ({
      sessionRef: input.gatewaySessionRef,
      status: input.status,
      reconciledAt: new Date().toISOString(),
    }),
  } as unknown as BillingService;
}

function createMockPrometheusMetricsExporter(): PrometheusMetricsExporter {
  return {
    export: () => "# HELP test_metric Test metric\ntest_metric 1",
    recordHttpRequest: (_method: string, _route: string, _statusCode: number, _durationMs?: number | null) => {},
  } as unknown as PrometheusMetricsExporter;
}

// ─── Test Server Factory ─────────────────────────────────────────────────────

function createTestServer(overrides: Partial<ConstructorParameters<typeof HttpApiServer>[0]> = {}) {
  const authService = new ApiAuthService({
    apiKeys: [
      { apiKey: "test-operator-key", actorId: "operator_1", roles: ["viewer", "operator"] },
      { apiKey: "test-admin-key", actorId: "admin_1", roles: ["viewer", "operator", "admin"] },
      { apiKey: "test-viewer-key", actorId: "viewer_1", roles: ["viewer"] },
    ],
    jwtSecret: "test-jwt-secret",
    tokenTtlMs: 60 * 60 * 1000,
  });

  const server = new HttpApiServer({
    approvalService: createMockApprovalService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
    gatewayTargetDirectoryService: createMockGatewayTargetDirectoryService(),
    authService,
    channelGatewayService: createMockChannelGatewayService(),
    channelGatewayDeliveryService: createMockChannelGatewayDeliveryService(),
    webhookSecret: "test-webhook-secret",
    coordinatorLoadBalancingService: createMockCoordinatorLoadBalancingService(),
    prometheusMetricsExporter: createMockPrometheusMetricsExporter(),
    billingService: createMockBillingService(),
    cors: {
      allowedOrigins: ["https://console.example.test"],
      credentials: true,
    },
    ...(overrides as Record<string, unknown>),
  });

  return { server, authService };
}

function buildBillingWebhookHeaders(body: string, secret = "test-webhook-secret"): Record<string, string> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", secret)
    .update(timestamp)
    .update(".")
    .update(body)
    .digest("hex");
  return {
    "x-webhook-signature": signature,
    "x-webhook-timestamp": timestamp,
  };
}

test("HttpApiServer.stop clears stale worker incident cache even when server never started", async () => {
  const { server } = createTestServer();
  (server as unknown as { staleWorkerIncidentIds: Set<string> }).staleWorkerIncidentIds.add("worker-1");

  await server.stop();

  assert.equal((server as unknown as { staleWorkerIncidentIds: Set<string> }).staleWorkerIncidentIds.size, 0);
});

function createMockServerResponse(): {
  response: PassThrough & {
    statusCode: number;
    setHeader: (name: string, value: string | number | readonly string[]) => void;
    removeHeader: (name: string) => void;
  };
  headers: Record<string, string>;
  bodyPromise: Promise<Buffer>;
} {
  const headers: Record<string, string> = {};
  const chunks: Buffer[] = [];
  const response = new PassThrough() as PassThrough & {
    statusCode: number;
    setHeader: (name: string, value: string | number | readonly string[]) => void;
    removeHeader: (name: string) => void;
  };
  response.statusCode = 200;
  response.setHeader = (name, value) => {
    headers[name.toLowerCase()] = Array.isArray(value)
      ? value.join(", ")
      : String(value);
  };
  response.removeHeader = (name) => {
    delete headers[name.toLowerCase()];
  };
  response.on("data", (chunk) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });
  return {
    response,
    headers,
    bodyPromise: finished(response).then(() => Buffer.concat(chunks)),
  };
}

async function renderNetworkStyleResponse(server: HttpApiServer, input: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;
}): Promise<{ statusCode: number; headers: Record<string, string>; body: Buffer }> {
  const injected = await server.inject({
    method: input.method,
    url: input.url,
    headers: input.headers,
    body: input.body,
  });
  const { response, headers, bodyPromise } = createMockServerResponse();
  (
    server as unknown as {
      sendPayload: (
        responseLike: PassThrough,
        payload: { statusCode: number; headers: Record<string, string>; body: string },
        acceptEncoding: string | undefined,
      ) => void;
    }
  ).sendPayload(
    response,
    {
      statusCode: injected.statusCode,
      headers: { ...injected.headers },
      body: injected.body,
    },
    input.headers?.["accept-encoding"],
  );
  return {
    statusCode: response.statusCode,
    headers,
    body: await bodyPromise,
  };
}

// ─── Route Tests ─────────────────────────────────────────────────────────────

test("inject attaches unlimited rate limit header when limiter is disabled", async () => {
  const { server } = createTestServer({ rateLimiter: null as never });

  try {
    const response = await server.inject({
      method: "GET",
      url: "/healthz",
    });

    assert.equal(response.headers["x-ratelimit-remaining"], "unlimited");
  } finally {
    await server.stop();
  }
});

test("POST /v1/auth/token exchanges API key for bearer token", async () => {
  const { server } = createTestServer();

  try {
    const response = await server.inject({
      method: "POST",
      url: "/v1/auth/token",
      headers: { "x-api-key": "test-operator-key" },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json<{ requestId: string; data: { tokenType: string; accessToken: string; principal: unknown } }>();
    assert.equal(body.data.tokenType, "Bearer");
    assert.ok(typeof body.data.accessToken === "string");
    assert.ok(body.data.accessToken.length > 0);
  } finally {
    await server.stop();
  }
});

test("POST /v1/auth/token rejects empty API key", async () => {
  const { server } = createTestServer();

  try {
    const response = await server.inject({
      method: "POST",
      url: "/v1/auth/token",
      headers: { "x-api-key": "" },
    });

    assert.equal(response.statusCode, 401);
    const body = response.json<{ requestId: string; error: { code: string; message: string } }>();
    assert.equal(body.error.code, "api.invalid_api_key");
  } finally {
    await server.stop();
  }
});

test("POST /v1/auth/token rejects missing API key", async () => {
  const { server } = createTestServer();

  try {
    const response = await server.inject({
      method: "POST",
      url: "/v1/auth/token",
      body: JSON.stringify({}),
    });

    assert.equal(response.statusCode, 401);
    const body = response.json<{ requestId: string; error: { code: string; message: string } }>();
    assert.equal(body.error.code, "api.invalid_api_key");
  } finally {
    await server.stop();
  }
});

test("POST /v1/auth/token rejects non-object payloads", async () => {
  const { server } = createTestServer();

  try {
    const response = await server.inject({
      method: "POST",
      url: "/v1/auth/token",
      body: JSON.stringify(["not-an-object"]),
    });

    assert.equal(response.statusCode, 400);
    const body = response.json<{ requestId: string; error: { code: string } }>();
    assert.equal(body.error.code, "api.invalid_auth_payload:payload");
  } finally {
    await server.stop();
  }
});

test("POST /v1/billing/webhooks/reconcile requires valid billing payload", async () => {
  const { server } = createTestServer();
  const body = JSON.stringify({
    gatewayKind: "stripe",
    gatewaySessionRef: "session_123",
    status: "paid",
  });

  try {
    const response = await server.inject({
      method: "POST",
      url: "/v1/billing/webhooks/reconcile",
      headers: buildBillingWebhookHeaders(body),
      body,
    });

    assert.equal(response.statusCode, 200);
    const payload = response.json<{ requestId: string; data: { sessionRef: string; status: string } }>();
    assert.equal(payload.data.status, "paid");
  } finally {
    await server.stop();
  }
});

test("POST /v1/billing/webhooks/reconcile rejects payload without required fields", async () => {
  const { server } = createTestServer();
  const body = JSON.stringify({
    gatewayKind: "stripe",
    // missing gatewaySessionRef and status
  });

  try {
    const response = await server.inject({
      method: "POST",
      url: "/v1/billing/webhooks/reconcile",
      headers: buildBillingWebhookHeaders(body),
      body,
    });

    assert.equal(response.statusCode, 400);
    const payload = response.json<{ requestId: string; error: { code: string; message: string } }>();
    assert.equal(payload.error.code, "api.invalid_billing_reconcile_payload:gatewaySessionRef");
  } finally {
    await server.stop();
  }
});

test("POST /v1/billing/webhooks/reconcile requires webhook signature without auth", async () => {
  const { server } = createTestServer();

  try {
    const response = await server.inject({
      method: "POST",
      url: "/v1/billing/webhooks/reconcile",
      headers: {},
      body: JSON.stringify({
        gatewayKind: "stripe",
        gatewaySessionRef: "session_123",
        status: "paid",
      }),
    });

    assert.equal(response.statusCode, 401);
  } finally {
    await server.stop();
  }
});

test("POST /v1/billing/webhooks/reconcile rejects invalid occurredAt timestamp", async () => {
  const { server } = createTestServer();
  const body = JSON.stringify({
    gatewayKind: "stripe",
    gatewaySessionRef: "session_123",
    status: "paid",
    occurredAt: "not-a-timestamp",
  });

  try {
    const response = await server.inject({
      method: "POST",
      url: "/v1/billing/webhooks/reconcile",
      headers: buildBillingWebhookHeaders(body),
      body,
    });

    assert.equal(response.statusCode, 400);
    const payload = response.json<{ requestId: string; error: { code: string } }>();
    assert.equal(payload.error.code, "api.invalid_billing_reconcile_payload:occurredAt");
  } finally {
    await server.stop();
  }
});

test("POST /v1/gateway/messages/send requires operator role", async () => {
  const { server, authService } = createTestServer();
  const viewerToken = authService.exchangeApiKey("test-viewer-key").accessToken;

  try {
    const response = await server.inject({
      method: "POST",
      url: "/v1/gateway/messages/send",
      headers: {
        authorization: `Bearer ${viewerToken}`,
        "idempotency-key": "gateway-send-viewer-role-check",
      },
      body: JSON.stringify({
        text: "Hello, World!",
        channel: "telegram",
      }),
    });

    assert.equal(response.statusCode, 403);
    const body = response.json<{ requestId: string; error: { code: string } }>();
    assert.equal(body.error.code, "api.forbidden");
  } finally {
    await server.stop();
  }
});

test("POST /v1/gateway/messages/send succeeds with operator role", async () => {
  const { server, authService } = createTestServer();
  const operatorToken = authService.exchangeApiKey("test-operator-key").accessToken;

  try {
    const response = await server.inject({
      method: "POST",
      url: "/v1/gateway/messages/send",
      headers: {
        authorization: `Bearer ${operatorToken}`,
        "idempotency-key": "gateway-send-operator-success",
      },
      body: JSON.stringify({
        text: "Hello, World!",
        channel: "telegram",
      }),
    });

    assert.equal(response.statusCode, 200);
    const body = response.json<{ requestId: string; data: { deliveredAt: string; channel: string; targetId: string } }>();
    assert.equal(body.data.channel, "telegram");
  } finally {
    await server.stop();
  }
});

test("POST /v1/gateway/messages/send requires text field", async () => {
  const { server, authService } = createTestServer();
  const operatorToken = authService.exchangeApiKey("test-operator-key").accessToken;

  try {
    const response = await server.inject({
      method: "POST",
      url: "/v1/gateway/messages/send",
      headers: {
        authorization: `Bearer ${operatorToken}`,
        "idempotency-key": "gateway-send-missing-text",
      },
      body: JSON.stringify({
        channel: "telegram",
        // missing text
      }),
    });

    assert.equal(response.statusCode, 400);
    const body = response.json<{ requestId: string; error: { code: string } }>();
    assert.equal(body.error.code, "api.invalid_gateway_payload:text");
  } finally {
    await server.stop();
  }
});

test("POST /v1/gateway/webhooks/receive processes webhook with signature verification", async () => {
  const { server, authService } = createTestServer();
  const operatorToken = authService.exchangeApiKey("test-operator-key").accessToken;

  try {
    const response = await server.inject({
      method: "POST",
      url: "/v1/gateway/webhooks/receive",
      headers: {
        authorization: `Bearer ${operatorToken}`,
        "x-webhook-signature": "test-webhook-secret",
        "x-webhook-timestamp": new Date().toISOString(),
      },
      body: JSON.stringify({
        targetId: "target_webhook_1",
        channel: "webhook",
        data: { key: "value" },
      }),
    });

    assert.equal(response.statusCode, 200);
    const body = response.json<{ requestId: string; data: { received: boolean; messageId: string } }>();
    assert.equal(body.data.received, true);
    assert.ok(typeof body.data.messageId === "string");
  } finally {
    await server.stop();
  }
});

test("POST /v1/gateway/webhooks/receive rejects webhook without signature when secret configured", async () => {
  const { server, authService } = createTestServer();
  const operatorToken = authService.exchangeApiKey("test-operator-key").accessToken;

  try {
    const response = await server.inject({
      method: "POST",
      url: "/v1/gateway/webhooks/receive",
      headers: {
        authorization: `Bearer ${operatorToken}`,
        // missing x-webhook-signature
      },
      body: JSON.stringify({
        targetId: "target_webhook_1",
        channel: "webhook",
      }),
    });

    assert.equal(response.statusCode, 401);
    const body = response.json<{ requestId: string; error: { code: string } }>();
    assert.equal(body.error.code, "gateway.signature_required");
  } finally {
    await server.stop();
  }
});

test("POST /v1/approvals/:id/decision requires operator role", async () => {
  const { server, authService } = createTestServer();
  const viewerToken = authService.exchangeApiKey("test-viewer-key").accessToken;

  try {
    const response = await server.inject({
      method: "POST",
      url: "/v1/approvals/approval_123/decision",
      headers: {
        authorization: `Bearer ${viewerToken}`,
        "idempotency-key": "approval-decision-viewer-role-check",
      },
      body: JSON.stringify({
        decisionType: "confirmed",
      }),
    });

    assert.equal(response.statusCode, 403);
  } finally {
    await server.stop();
  }
});

test("POST /v1/approvals/:id/decision accepts valid decision payload", async () => {
  const { server, authService } = createTestServer();
  const operatorToken = authService.exchangeApiKey("test-operator-key").accessToken;

  try {
    const response = await server.inject({
      method: "POST",
      url: "/v1/approvals/approval_test_123/decision",
      headers: {
        authorization: `Bearer ${operatorToken}`,
        "idempotency-key": "approval-decision-confirmed",
      },
      body: JSON.stringify({
        decisionType: "confirmed",
      }),
    });

    assert.equal(response.statusCode, 200);
    const body = response.json<{ requestId: string; data: { approval: { id: string } } }>();
    assert.equal(body.data.approval.id, "approval_test_123");
  } finally {
    await server.stop();
  }
});

test("POST /v1/approvals/:id/decision rejects invalid decision type", async () => {
  const { server, authService } = createTestServer();
  const operatorToken = authService.exchangeApiKey("test-operator-key").accessToken;

  try {
    const response = await server.inject({
      method: "POST",
      url: "/v1/approvals/approval_123/decision",
      headers: {
        authorization: `Bearer ${operatorToken}`,
        "idempotency-key": "approval-decision-invalid-type",
      },
      body: JSON.stringify({
        decisionType: "invalid_type",
      }),
    });

    assert.equal(response.statusCode, 400);
    const body = response.json<{ requestId: string; error: { code: string } }>();
    assert.equal(body.error.code, "api.invalid_decision_payload:decisionType");
  } finally {
    await server.stop();
  }
});

test("POST /v1/approvals/:id/decision requires selectedOptionId for option_selected", async () => {
  const { server, authService } = createTestServer();
  const operatorToken = authService.exchangeApiKey("test-operator-key").accessToken;

  try {
    const response = await server.inject({
      method: "POST",
      url: "/v1/approvals/approval_123/decision",
      headers: {
        authorization: `Bearer ${operatorToken}`,
        "idempotency-key": "approval-decision-missing-option",
      },
      body: JSON.stringify({
        decisionType: "option_selected",
        // missing selectedOptionId
      }),
    });

    assert.equal(response.statusCode, 400);
    const body = response.json<{ requestId: string; error: { code: string } }>();
    assert.equal(body.error.code, "api.invalid_decision_payload:selectedOptionId");
  } finally {
    await server.stop();
  }
});

test("POST /v1/approvals/:id/decision rejects invalid respondedAt timestamp", async () => {
  const { server, authService } = createTestServer();
  const operatorToken = authService.exchangeApiKey("test-operator-key").accessToken;

  try {
    const response = await server.inject({
      method: "POST",
      url: "/v1/approvals/approval_123/decision",
      headers: {
        authorization: `Bearer ${operatorToken}`,
        "idempotency-key": "approval-decision-invalid-responded-at",
      },
      body: JSON.stringify({
        decisionType: "confirmed",
        respondedAt: "later-maybe",
      }),
    });

    assert.equal(response.statusCode, 400);
    const body = response.json<{ requestId: string; error: { code: string } }>();
    assert.equal(body.error.code, "api.invalid_decision_payload:respondedAt");
  } finally {
    await server.stop();
  }
});

test("POST /v1/admin/control-plane/load-balancing/select requires admin role", async () => {
  const { server, authService } = createTestServer();
  const operatorToken = authService.exchangeApiKey("test-operator-key").accessToken;

  try {
    const response = await server.inject({
      method: "POST",
      url: "/v1/admin/control-plane/load-balancing/select",
      headers: {
        authorization: `Bearer ${operatorToken}`,
        "idempotency-key": "load-balancing-select-operator-role-check",
      },
      body: JSON.stringify({
        queueName: "default",
      }),
    });

    assert.equal(response.statusCode, 403);
    const body = response.json<{ requestId: string; error: { code: string } }>();
    assert.equal(body.error.code, "api.forbidden");
  } finally {
    await server.stop();
  }
});

test("POST /v1/admin/control-plane/load-balancing/select succeeds with admin role", async () => {
  const { server, authService } = createTestServer();
  const adminToken = authService.exchangeApiKey("test-admin-key").accessToken;

  try {
    const response = await server.inject({
      method: "POST",
      url: "/v1/admin/control-plane/load-balancing/select",
      headers: {
        authorization: `Bearer ${adminToken}`,
        "idempotency-key": "load-balancing-select-admin-success",
      },
      body: JSON.stringify({
        queueName: "default",
        preferredRegion: "us-west",
      }),
    });

    assert.equal(response.statusCode, 200);
    const body = response.json<{ requestId: string; data: { outcome: string; selectedCoordinatorId: string } }>();
    assert.equal(body.data.outcome, "selected");
    assert.equal(body.data.selectedCoordinatorId, "coord_test_1");
  } finally {
    await server.stop();
  }
});

test("POST /v1/incidents is reachable through HttpApiServer", async () => {
  const { server, authService } = createTestServer({
    incidentService: {
      listIncidents: () => [],
      getIncident: () => null,
      openIncident: ({ severity, title }) => ({
        incidentId: "incident_test_1",
        severity,
        title,
        status: "open",
        owner: null,
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
        resolvedAt: null,
        linkedEvidenceRefs: [],
      }),
      acknowledge: () => {
        throw new Error("not implemented");
      },
      startMitigation: () => {
        throw new Error("not implemented");
      },
      resolve: () => {
        throw new Error("not implemented");
      },
    },
  });
  const operatorToken = authService.exchangeApiKey("test-operator-key").accessToken;

  try {
    const response = await server.inject({
      method: "POST",
      url: "/v1/incidents",
      headers: {
        authorization: `Bearer ${operatorToken}`,
        "idempotency-key": "incident-open-api-outage",
      },
      body: JSON.stringify({
        severity: "high",
        title: "API outage",
      }),
    });

    assert.equal(response.statusCode, 201);
    const body = response.json<{ requestId: string; data: { title: string; severity: string } }>();
    assert.equal(body.data.title, "API outage");
    assert.equal(body.data.severity, "high");
  } finally {
    await server.stop();
  }
});

test("POST /v1/packs creates pack and GET /v1/packs returns catalog entry", async () => {
  const { server, authService } = createTestServer();
  const operatorToken = authService.exchangeApiKey("test-operator-key").accessToken;
  const viewerToken = authService.exchangeApiKey("test-viewer-key").accessToken;

  try {
    const createResponse = await server.inject({
      method: "POST",
      url: "/v1/packs",
      headers: {
        authorization: `Bearer ${operatorToken}`,
        "idempotency-key": "pack-create-ops-pack",
      },
      body: JSON.stringify({
        packId: "pack.ops",
        name: "Ops Pack",
        version: "1.0.0",
        domainId: "ops",
      }),
    });

    assert.equal(createResponse.statusCode, 201);

    const listResponse = await server.inject({
      method: "GET",
      url: "/v1/packs",
      headers: {
        authorization: `Bearer ${viewerToken}`,
      },
    });

    assert.equal(listResponse.statusCode, 200);
    const body = listResponse.json<{ requestId: string; data: { packs: Array<{ packId: string }> } }>();
    assert.equal(body.data.packs[0]?.packId, "pack.ops");
  } finally {
    await server.stop();
  }
});

test("POST /v1/cost-reports creates report and GET /v1/cost-reports lists it", async () => {
  const { server, authService } = createTestServer();
  const operatorToken = authService.exchangeApiKey("test-operator-key").accessToken;
  const viewerToken = authService.exchangeApiKey("test-viewer-key").accessToken;

  try {
    const createResponse = await server.inject({
      method: "POST",
      url: "/v1/cost-reports",
      headers: {
        authorization: `Bearer ${operatorToken}`,
        "idempotency-key": "cost-report-create-april",
      },
      body: JSON.stringify({
        periodStart: "2026-04-01T00:00:00.000Z",
        periodEnd: "2026-04-30T23:59:59.000Z",
        totalCostUsd: 42,
        resourceCosts: [
          { resourceId: "openai", resourceType: "api", costUsd: 42 },
        ],
      }),
    });

    assert.equal(createResponse.statusCode, 201);

    const listResponse = await server.inject({
      method: "GET",
      url: "/v1/cost-reports",
      headers: {
        authorization: `Bearer ${viewerToken}`,
      },
    });

    assert.equal(listResponse.statusCode, 200);
    const body = listResponse.json<{ requestId: string; data: { costReports: Array<{ totalCostUsd: number }> } }>();
    assert.equal(body.data.costReports[0]?.totalCostUsd, 42);
  } finally {
    await server.stop();
  }
});

test("GET /v1/admin/rollouts returns rollout data through HttpApiServer", async () => {
  const configRolloutService = new ConfigRolloutService();
  configRolloutService.startRollout("runtime.maxConcurrency", "platform", null, 25, { changedBy: "admin_1" });
  const { server, authService } = createTestServer({ configRolloutService });
  const viewerToken = authService.exchangeApiKey("test-viewer-key").accessToken;

  try {
    const response = await server.inject({
      method: "GET",
      url: "/v1/admin/rollouts",
      headers: {
        authorization: `Bearer ${viewerToken}`,
      },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json<{ requestId: string; data: { rollouts: Array<{ configPath: string }> } }>();
    assert.equal(body.data.rollouts[0]?.configPath, "runtime.maxConcurrency");
  } finally {
    await server.stop();
  }
});

test("GET /v1/admin/tenants returns tenant registry data through HttpApiServer", async () => {
  const tenantRegistryService = new TenantBoundaryRegistryService({
    organizations: [
      {
        organizationId: "org-1",
        displayName: "Example Org",
        billingAccountId: null,
        defaultTenantId: "tenant-1",
        createdAt: "2026-04-16T00:00:00.000Z",
        updatedAt: "2026-04-16T00:00:00.000Z",
      },
    ],
    tenants: [
      {
        tenantId: "tenant-1",
        organizationId: "org-1",
        displayName: "Tenant One",
        storageScope: "storage/tenant-1",
        identityScope: "identity/tenant-1",
        policyScope: "policy/tenant-1",
        artifactScope: "artifacts/tenant-1",
        isolationMode: "shared_logical",
        deploymentMode: "cloud_shared",
        status: "active",
        createdAt: "2026-04-16T00:00:00.000Z",
        updatedAt: "2026-04-16T00:00:00.000Z",
      },
    ],
  });
  const { server, authService } = createTestServer({ tenantRegistryService });
  const adminToken = authService.exchangeApiKey("test-admin-key").accessToken;

  try {
    const response = await server.inject({
      method: "GET",
      url: "/v1/admin/tenants",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json<{ requestId: string; data: { tenants: Array<{ tenantId: string }> } }>();
    assert.equal(body.data.tenants[0]?.tenantId, "tenant-1");
  } finally {
    await server.stop();
  }
});

test("GET /v1/admin/budgets returns budget summaries through HttpApiServer", async () => {
  const costReportService = new CostReportService();
  costReportService.createReport({
    tenantId: "tenant-1",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.000Z",
    totalCostUsd: 15,
    resourceCosts: [{ resourceId: "openai", resourceType: "api", costUsd: 15, currency: "USD" }],
    submittedBy: "operator_1",
  });
  const { server, authService } = createTestServer({ costReportService });
  const adminToken = authService.exchangeApiKey("test-admin-key").accessToken;

  try {
    const response = await server.inject({
      method: "GET",
      url: "/v1/admin/budgets",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json<{ requestId: string; data: { budgets: Array<{ totalCostUsd: number }> } }>();
    assert.equal(body.data.budgets[0]?.totalCostUsd, 15);
  } finally {
    await server.stop();
  }
});

test("GET /v1/admin/chargeback/reports returns chargeback through HttpApiServer", async () => {
  const costReportService = new CostReportService();
  costReportService.createReport({
    tenantId: "tenant-1",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.000Z",
    totalCostUsd: 15,
    resourceCosts: [{ resourceId: "openai:gpt-5", resourceType: "api", costUsd: 15, currency: "USD" }],
    submittedBy: "operator_1",
  });
  const { server, authService } = createTestServer({ costReportService });
  const adminToken = authService.exchangeApiKey("test-admin-key").accessToken;

  try {
    const response = await server.inject({
      method: "GET",
      url: "/v1/admin/chargeback/reports",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json<{ requestId: string; data: { totalCostUsd: number; allocations: Array<{ resourceId: string }> } }>();
    assert.equal(body.data.totalCostUsd, 15);
    assert.equal(body.data.allocations[0]?.resourceId, "openai:gpt-5");
  } finally {
    await server.stop();
  }
});

test("GET /v1/prompts returns registered prompt bundles through HttpApiServer", async () => {
  const promptRegistryService = new HierarchicalPromptRegistryService();
  promptRegistryService.registerBundle({
    name: "system.default",
    version: "1.0.0",
    displayVersion: "1.0.0",
    domain: "global",
    taskType: "general",
    packId: undefined,
    systemPrompt: { content: "You are helpful.", templateVariables: [], channel: "system" },
    userPrompt: undefined,
    fewShotExamples: undefined,
    constraints: undefined,
    compatibilityMatrix: {
      toolSchemaVersions: [],
      evaluatorSchemaVersions: [],
      domainDescriptorVersions: [],
      modelRoutingProfiles: [],
    },
    metadata: undefined,
  }, "global");
  const { server, authService } = createTestServer({ promptRegistryService });
  const viewerToken = authService.exchangeApiKey("test-viewer-key").accessToken;

  try {
    const response = await server.inject({
      method: "GET",
      url: "/v1/prompts",
      headers: {
        authorization: `Bearer ${viewerToken}`,
      },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json<{ requestId: string; data: { prompts: Array<{ bundle: { name: string } }> } }>();
    assert.equal(body.data.prompts[0]?.bundle.name, "system.default");
  } finally {
    await server.stop();
  }
});

// ─── Authentication Middleware Tests ────────────────────────────────────────

test("unauthenticated request returns 401 for protected routes", async () => {
  const { server } = createTestServer();

  try {
    const response = await server.inject({
      method: "GET",
      url: "/v1/tasks",
    });

    assert.equal(response.statusCode, 401);
  } finally {
    await server.stop();
  }
});

test("unauthenticated request to /healthz returns 200", async () => {
  const { server } = createTestServer();

  try {
    const response = await server.inject({
      method: "GET",
      url: "/healthz",
    });

    assert.equal(response.statusCode, 200);
  } finally {
    await server.stop();
  }
});

test("bearer token authentication works", async () => {
  const { server, authService } = createTestServer();
  const token = authService.exchangeApiKey("test-operator-key").accessToken;

  try {
    const response = await server.inject({
      method: "GET",
      url: "/v1/tasks",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(response.statusCode, 200);
  } finally {
    await server.stop();
  }
});

test("x-api-key header authentication works", async () => {
  const { server } = createTestServer();

  try {
    const response = await server.inject({
      method: "GET",
      url: "/v1/tasks",
      headers: {
        "x-api-key": "test-operator-key",
      },
    });

    assert.equal(response.statusCode, 200);
  } finally {
    await server.stop();
  }
});

test("rejects expired tokens", async () => {
  const authService = new ApiAuthService({
    apiKeys: [{ apiKey: "test-key", actorId: "test-user", roles: ["viewer"] }],
    jwtSecret: "test-secret",
    tokenTtlMs: -1000, // Already expired
  });
  const expiredToken = authService.exchangeApiKey("test-key").accessToken;

  const server = new HttpApiServer({
    approvalService: createMockApprovalService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
    authService,
  });

  try {
    await assert.rejects(
      async () => server.inject({
        method: "GET",
        url: "/v1/tasks",
        headers: {
          authorization: `Bearer ${expiredToken}`,
        },
      }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        return "code" in error && error.code === "api.token_expired";
      },
    );
  } finally {
    await server.stop();
  }
});

// ─── Body Parsing Tests ──────────────────────────────────────────────────────

test("rejects request body exceeding 1MB limit", async () => {
  const { server } = createTestServer();

  // Create a body larger than 1MB
  const largeBody = JSON.stringify({
    data: "x".repeat(1_048_577), // 1MB + 1 byte
  });

  try {
    const response = await server.inject({
      method: "POST",
      url: "/v1/gateway/messages/send",
      headers: {
        "x-api-key": "test-operator-key",
        "content-type": "application/json",
      },
      body: largeBody,
    });

    assert.equal(response.statusCode, 413);
    const body = response.json<{ requestId: string; error: { code: string } }>();
    assert.equal(body.error.code, "api.payload_too_large");
  } finally {
    await server.stop();
  }
});

test("accepts request body at exactly 1MB limit", async () => {
  const { server, authService } = createTestServer();
  const token = authService.exchangeApiKey("test-operator-key").accessToken;

  // Create a body at exactly 1MB
  const bodyContent = JSON.stringify({
    text: "x".repeat(1_000_000 - 100), // Adjust for JSON overhead
  });

  try {
    const response = await server.inject({
      method: "POST",
      url: "/v1/gateway/messages/send",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "idempotency-key": "gateway-send-invalid-json",
      },
      body: bodyContent,
    });

    // Should not be 413 (payload too large)
    assert.notEqual(response.statusCode, 413);
  } finally {
    await server.stop();
  }
});

test("rejects invalid JSON body", async () => {
  const { server, authService } = createTestServer();
  const token = authService.exchangeApiKey("test-operator-key").accessToken;

  try {
    const response = await server.inject({
      method: "POST",
      url: "/v1/gateway/messages/send",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "idempotency-key": "gateway-send-invalid-json",
      },
      body: "{ invalid json }",
    });

    assert.equal(response.statusCode, 400);
    const body = response.json<{ requestId: string; error: { code: string } }>();
    assert.equal(body.error.code, "api.invalid_json");
  } finally {
    await server.stop();
  }
});

// ─── Route Not Found Tests ───────────────────────────────────────────────────

test("returns 404 for unknown routes", async () => {
  const { server } = createTestServer();

  try {
    const response = await server.inject({
      method: "GET",
      url: "/v1/unknown/route",
    });

    assert.equal(response.statusCode, 404);
    const body = response.json<{ requestId: string; error: { code: string } }>();
    assert.equal(body.error.code, "api.not_found");
  } finally {
    await server.stop();
  }
});

test("returns 404 for unsupported HTTP methods", async () => {
  const { server } = createTestServer();

  try {
    const response = await server.inject({
      method: "DELETE",
      url: "/v1/tasks",
      headers: {
        "idempotency-key": "unsupported-delete-v1-tasks",
      },
    });

    assert.equal(response.statusCode, 404);
  } finally {
    await server.stop();
  }
});

// ─── Server Lifecycle Tests ─────────────────────────────────────────────────

test("server starts and stops correctly", async () => {
  const { server } = createTestServer();
  const rawServer = (
    server as unknown as {
      server: {
        listen: (port: number, host: string, callback: () => void) => void;
        address: () => { address: string; port: number } | null;
        close: (callback: (error?: Error | null) => void) => void;
      };
    }
  ).server;
  let listening = false;
  rawServer.listen = (_port, _host, callback) => {
    listening = true;
    callback();
  };
  rawServer.address = () => ({ address: "127.0.0.1", port: 43123 });
  rawServer.close = (callback) => {
    listening = false;
    callback();
  };
  Object.defineProperty(rawServer, "listening", {
    configurable: true,
    get: () => listening,
  });

  try {
    const address = await server.start({ host: "127.0.0.1", port: 0 });
    assert.equal(address.port, 43123);
    assert.equal(address.baseUrl, "http://127.0.0.1:43123");
    assert.equal(listening, true);
  } finally {
    await server.stop();
  }
  assert.equal(listening, false);
});

test("server inject uses correct HTTP method default", async () => {
  const { server } = createTestServer();

  try {
    // GET is the default method
    const response = await server.inject({
      url: "/healthz",
    });

    assert.equal(response.statusCode, 200);
  } finally {
    await server.stop();
  }
});

test("inject responses include API version headers", async () => {
  const { server } = createTestServer();

  try {
    const response = await server.inject({
      method: "GET",
      url: "/healthz",
    });

    assert.equal(response.headers["x-api-version"], "2026-04-01");
    assert.equal(response.headers["x-app-version"], "0.1.0");
    assert.ok(typeof response.headers["content-length"] === "string");
  } finally {
    await server.stop();
  }
});

test("inject rejects incompatible SDK version headers with compatibility response headers", async () => {
  const { server } = createTestServer();

  try {
    const response = await server.inject({
      method: "GET",
      url: "/healthz",
      headers: {
        "x-sdk-version": "0.0.1",
        "x-contract-version": "2026-04-01",
      },
    });

    assert.equal(response.statusCode, 426);
    assert.equal(response.headers["x-sdk-compatibility"], "upgrade_required");
    assert.equal(response.headers["x-platform-version"], "0.1.0");
    assert.equal(response.headers["x-contract-version"], "2026-04-01");
  } finally {
    await server.stop();
  }
});

test("inject accepts compatible SDK version headers and surfaces compatibility warnings", async () => {
  const { server } = createTestServer();

  try {
    const response = await server.inject({
      method: "GET",
      url: "/healthz",
      headers: {
        "x-sdk-version": "0.1.0",
        "x-contract-version": "0.0.1",
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["x-sdk-compatibility"], "compatibility_warning");
    assert.match(response.headers["warning"] ?? "", /compatibility_warning:contract=0.0.1;expected=2026-04-01/);
  } finally {
    await server.stop();
  }
});

test("network responses compress large JSON payloads with gzip and preserve headers", async () => {
  const { server } = createTestServer();

  try {
    const response = await renderNetworkStyleResponse(server, {
      method: "GET",
      url: "/v1/openapi.json",
      headers: {
        "accept-encoding": "gzip",
        "x-api-key": "test-operator-key",
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["content-encoding"], "gzip");
    assert.equal(response.headers["x-api-version"], "2026-04-01");
    assert.ok(String(response.headers["content-type"]).startsWith("application/json"));
    const decompressed = gunzipSync(response.body).toString("utf8");
    assert.match(decompressed, /"openapi"/);
  } finally {
    await server.stop();
  }
});

test("network responses reject oversized content-length before body read", async () => {
  const { server } = createTestServer();

  try {
    const payload = await (
      server as unknown as {
        routeRequest: (
          requestId: string,
          request: { method: string; url: string },
          headers: Record<string, string>,
        ) => Promise<{ statusCode: number; body: string }>;
      }
    ).routeRequest(
      "req_oversized_payload",
      {
        method: "POST",
        url: "/v1/gateway/messages/send",
      },
      {
        "content-type": "application/json",
        "content-length": "1048577",
      },
    );

    assert.equal(payload.statusCode, 413);
    const body = JSON.parse(payload.body) as { requestId: string; error: { code: string } };
    assert.equal(body.error.code, "api.payload_too_large");
  } finally {
    await server.stop();
  }
});

test("network responses compress large JSON payloads with brotli when preferred", async () => {
  const { server } = createTestServer();

  try {
    const response = await renderNetworkStyleResponse(server, {
      method: "GET",
      url: "/v1/openapi.json",
      headers: {
        "accept-encoding": "br, gzip",
        "x-api-key": "test-operator-key",
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["content-encoding"], "br");
    const decompressed = brotliDecompressSync(response.body).toString("utf8");
    assert.match(decompressed, /"openapi"/);
  } finally {
    await server.stop();
  }
});

// ─── Response Format Tests ──────────────────────────────────────────────────

test("JSON responses have correct envelope structure", async () => {
  const { server } = createTestServer();

  try {
    const response = await server.inject({
      method: "GET",
      url: "/healthz",
    });

    const body = response.json<{ requestId: string; data: unknown }>();
    assert.ok(typeof body.requestId === "string");
    assert.ok(body.requestId.length > 0);
    assert.ok("data" in body);
  } finally {
    await server.stop();
  }
});

test("error responses have correct structure", async () => {
  const { server } = createTestServer();

  try {
    const response = await server.inject({
      method: "GET",
      url: "/v1/unknown",
    });

    assert.equal(response.statusCode, 404);
    const body = response.json<{ requestId: string; error: { code: string; message: string } }>();
    assert.ok(typeof body.requestId === "string");
    assert.ok(typeof body.error.code === "string");
    assert.ok(typeof body.error.message === "string");
  } finally {
    await server.stop();
  }
});

test("responses include x-request-id header", async () => {
  const { server } = createTestServer();

  try {
    const response = await server.inject({
      method: "GET",
      url: "/healthz",
      headers: {
        "x-request-id": "custom-request-id",
      },
    });

    assert.equal(response.headers["x-request-id"], "custom-request-id");
  } finally {
    await server.stop();
  }
});

test("generates request-id when not provided", async () => {
  const { server } = createTestServer();

  try {
    const response = await server.inject({
      method: "GET",
      url: "/healthz",
    });

    assert.ok(typeof response.headers["x-request-id"] === "string");
    assert.ok((response.headers["x-request-id"] as string).startsWith("req_"));
  } finally {
    await server.stop();
  }
});

// ─── OpenAPI Document Tests ─────────────────────────────────────────────────

test("GET /v1/openapi.json returns OpenAPI document", async () => {
  const { server } = createTestServer();

  try {
    const response = await server.inject({
      method: "GET",
      url: "/v1/openapi.json",
      headers: {
        "x-api-key": "test-operator-key",
      },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json<{ openapi: string; info: { title: string } }>();
    assert.ok(typeof body.openapi === "string");
    assert.ok(typeof body.info.title === "string");
  } finally {
    await server.stop();
  }
});

// ─── Tenant Scope Tests ─────────────────────────────────────────────────────

test("tenant-scoped admin cannot access global endpoints", async () => {
  const tenantScopedAuthService = new ApiAuthService({
    apiKeys: [
      { apiKey: "tenant-admin-key", actorId: "tenant_admin_1", roles: ["viewer", "operator", "admin"], tenantId: "tenant_1" },
    ],
    jwtSecret: "test-jwt-secret",
    tokenTtlMs: 60 * 60 * 1000,
  });

  const server = new HttpApiServer({
    approvalService: createMockApprovalService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
    authService: tenantScopedAuthService,
  });

  try {
    const response = await server.inject({
      method: "POST",
      url: "/v1/admin/control-plane/load-balancing/select",
      headers: {
        authorization: `Bearer ${tenantScopedAuthService.exchangeApiKey("tenant-admin-key").accessToken}`,
        "idempotency-key": "tenant-admin-load-balancing-select",
      },
      body: JSON.stringify({}),
    });

    assert.equal(response.statusCode, 403);
    const body = response.json<{ requestId: string; error: { code: string } }>();
    assert.equal(body.error.code, "api.tenant_scope_unsupported");
  } finally {
    await server.stop();
  }
});

// ─── Gateway Target Directory Service Unavailable ────────────────────────────

test("returns 503 when gateway target directory is not configured", async () => {
  const server = new HttpApiServer({
    approvalService: createMockApprovalService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
    authService: new ApiAuthService({
      apiKeys: [{ apiKey: "test-key", actorId: "test-user", roles: ["viewer", "operator"] }],
      jwtSecret: "test-secret",
    }),
    // gatewayTargetDirectoryService intentionally omitted
  });

  try {
    const response = await server.inject({
      method: "GET",
      url: "/v1/gateway/targets",
      headers: { "x-api-key": "test-key" },
    });

    assert.equal(response.statusCode, 503);
    const body = response.json<{ requestId: string; error: { code: string } }>();
    assert.equal(body.error.code, "api.gateway_targets_unavailable");
  } finally {
    await server.stop();
  }
});

// ─── Metrics Endpoint Tests ────────────────────────────────────────────────

test("GET /v1/metrics returns prometheus metrics when exporter configured", async () => {
  const { server } = createTestServer();

  try {
    const response = await server.inject({
      method: "GET",
      url: "/v1/metrics",
    });

    assert.equal(response.statusCode, 200);
    assert.ok(response.headers["content-type"]?.startsWith("text/plain"));
    assert.ok(response.body.includes("test_metric"));
  } finally {
    await server.stop();
  }
});

test("HTTP prometheus metrics use templated paths instead of raw resource IDs", async () => {
  const recorded: Array<{ method: string; route: string; statusCode: number }> = [];
  const { server } = createTestServer({
    prometheusMetricsExporter: {
      export: () => "",
      recordHttpRequest: (method: string, route: string, statusCode: number) => {
        recorded.push({ method, route, statusCode });
      },
    } as unknown as PrometheusMetricsExporter,
  });

  try {
    await server.inject({
      method: "GET",
      url: "/v1/tasks/task_123456789abcdef/events",
    });

    assert.ok(recorded.some((entry) => entry.route === "/v1/tasks/:id/events"));
    assert.ok(!recorded.some((entry) => entry.route.includes("task_123456789abcdef")));
  } finally {
    await server.stop();
  }
});

test("GET /metrics remains available as an unversioned compatibility alias", async () => {
  const { server } = createTestServer();

  try {
    const response = await server.inject({
      method: "GET",
      url: "/metrics",
    });

    assert.equal(response.statusCode, 200);
  } finally {
    await server.stop();
  }
});

test("GET /v1/metrics returns 503 when exporter not configured", async () => {
  const server = new HttpApiServer({
    approvalService: createMockApprovalService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
    authService: new ApiAuthService({
      apiKeys: [{ apiKey: "test-key", actorId: "test-user", roles: ["viewer"] }],
      jwtSecret: "test-secret",
    }),
    prometheusMetricsExporter: null, // Not configured
  });

  try {
    const response = await server.inject({
      method: "GET",
      url: "/v1/metrics",
    });

    assert.equal(response.statusCode, 503);
    const body = response.json<{ requestId: string; error: { code: string } }>();
    assert.equal(body.error.code, "api.metrics_unavailable");
  } finally {
    await server.stop();
  }
});

test("rate-limited mutating requests do not populate idempotency storage", async () => {
  const server = new HttpApiServer({
    approvalService: createMockApprovalService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
    authService: new ApiAuthService({
      apiKeys: [{ apiKey: "test-key", actorId: "test-user", roles: ["viewer"] }],
      jwtSecret: "test-secret",
    }),
    rateLimiter: {
      checkAndConsume: async () => ({ allowed: false, remaining: 0, retryAfterMs: 1_000 }),
    } as never,
  });

  try {
    const response = await server.inject({
      method: "POST",
      url: "/v1/non-existent-write-endpoint",
      headers: {
        "idempotency-key": "idem-rate-limit-1",
        "content-type": "application/json",
      },
      body: JSON.stringify({ ok: true }),
    });

    assert.equal(response.statusCode, 429);
    const idempotencyMiddleware = (server as unknown as {
      idempotencyMiddleware: { size(): number };
    }).idempotencyMiddleware;
    assert.equal(idempotencyMiddleware.size(), 0);
  } finally {
    await server.stop();
  }
});

test("API responses include production security headers and CORS metadata", async () => {
  const { server } = createTestServer();

  try {
    const response = await server.inject({
      method: "GET",
      url: "/healthz",
      headers: { origin: "https://console.example.test" },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["x-frame-options"], "DENY");
    assert.equal(response.headers["x-content-type-options"], "nosniff");
    assert.equal(response.headers["referrer-policy"], "no-referrer");
    assert.match(String(response.headers["content-security-policy"]), /default-src 'none'/);
    assert.equal(response.headers["access-control-allow-origin"], "https://console.example.test");
    assert.equal(response.headers["access-control-allow-credentials"], "true");
  } finally {
    await server.stop();
  }
});

test("OPTIONS preflight returns 204 with access-control headers", async () => {
  const { server } = createTestServer();

  try {
    const response = await server.inject({
      method: "OPTIONS",
      url: "/v1/tasks",
      headers: {
        origin: "https://console.example.test",
        "access-control-request-method": "GET",
      },
    });

    assert.equal(response.statusCode, 204);
    assert.equal(response.headers["access-control-allow-origin"], "https://console.example.test");
    assert.match(String(response.headers["access-control-allow-methods"]), /GET/);
  } finally {
    await server.stop();
  }
});

test("OPTIONS preflight rejects disallowed origins with 403", async () => {
  const { server } = createTestServer();

  try {
    const response = await server.inject({
      method: "OPTIONS",
      url: "/v1/tasks",
      headers: {
        origin: "https://malicious.example.test",
        "access-control-request-method": "POST",
      },
    });

    assert.equal(response.statusCode, 403);
    assert.equal(response.json<{ error: { code: string } }>().error.code, "api.origin_forbidden");
  } finally {
    await server.stop();
  }
});

test("state changing requests reject disallowed origins", async () => {
  const { server } = createTestServer();

  try {
    const response = await server.inject({
      method: "POST",
      url: "/v1/auth/token",
      headers: {
        origin: "https://malicious.example.test",
        "content-type": "application/json",
      },
      body: JSON.stringify({ apiKey: "test-operator-key" }),
    });

    assert.equal(response.statusCode, 403);
    assert.equal(response.json<{ error: { code: string } }>().error.code, "api.origin_forbidden");
  } finally {
    await server.stop();
  }
});

test("HttpApiServer configures hardened HTTP server timeouts", async () => {
  const { server } = createTestServer();
  const nodeServer = (server as unknown as {
    server: {
      headersTimeout: number;
      keepAliveTimeout: number;
      requestTimeout: number;
      maxHeadersCount: number;
      maxRequestsPerSocket: number;
    };
  }).server;

  assert.equal(nodeServer.headersTimeout, 60_000);
  assert.equal(nodeServer.keepAliveTimeout, 5_000);
  assert.equal(nodeServer.requestTimeout, 30_000);
  assert.equal(nodeServer.maxHeadersCount, 2_000);
  assert.equal(nodeServer.maxRequestsPerSocket, 1_000);

  await server.stop();
});

test("GET /prometheus returns prometheus metrics when exporter configured", async () => {
  const { server } = createTestServer();

  try {
    const response = await server.inject({
      method: "GET",
      url: "/prometheus",
    });

    assert.equal(response.statusCode, 200);
    assert.ok(response.headers["content-type"]?.startsWith("text/plain"));
    assert.ok(response.body.includes("test_metric"));
  } finally {
    await server.stop();
  }
});

test("HttpApiServer enforces request timeout budget", async () => {
  const { server } = createTestServer({
    apiDefaultTimeoutMs: 5,
    apiMaxTimeoutMs: 30,
  });
  (server as unknown as { routeTable: Array<{ method: string; pathname: string; handler: () => Promise<{ statusCode: number; headers: Record<string, string>; body: string }> }> }).routeTable.unshift({
    method: "GET",
    pathname: "/timeout-test",
    handler: async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
      return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ok: true }),
      };
    },
  });

  try {
    const response = await server.inject({
      method: "GET",
      url: "/timeout-test",
    });

    assert.equal(response.statusCode, 504);
    assert.equal(response.json<{ error: { code: string } }>().error.code, "api.request_timeout");
  } finally {
    await server.stop();
  }
});
