import assert from "node:assert/strict";
import test from "node:test";

import { ApiAuthService } from "../../../../../src/platform/five-plane-interface/api/api-auth-service.js";
import { HttpApiServer, type InjectResponse } from "../../../../../src/platform/five-plane-interface/api/http-api-server.js";
import { CoordinatorLoadBalancingService } from "../../../../../src/platform/five-plane-execution/ha/coordinator-load-balancing-service.js";
import { ChannelGatewayService } from "../../../../../src/platform/five-plane-interface/channel-gateway/channel-gateway-service.js";
import { ChannelGatewayDeliveryService, CHANNEL_DELIVERY_DDL } from "../../../../../src/platform/five-plane-interface/channel-gateway/channel-gateway-delivery-service.js";
import { createSeededApiContext } from "../../../../helpers/api.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

interface DataEnvelope<T> {
  requestId: string;
  data: T;
}

interface ErrorEnvelope {
  requestId: string;
  error: {
    code: string;
    message?: string;
  };
}

interface ReceivedWebhookRequest {
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

function readJson<T>(response: InjectResponse): DataEnvelope<T> {
  return response.json<DataEnvelope<T>>();
}

function readError(response: InjectResponse): ErrorEnvelope {
  return response.json<ErrorEnvelope>();
}

test("http api server supports api-key token exchange, gateway delivery, and control-plane selection", async () => {
  const workspace = createTempWorkspace("aa-http-api-auth-");
  const context = createSeededApiContext(workspace);
  const received: ReceivedWebhookRequest[] = [];
  const sinkUrl = "https://gateway.example.test/deliver";
  context.db.connection.exec(CHANNEL_DELIVERY_DDL);
  const deliveryService = new ChannelGatewayDeliveryService(context.db, {
    rateLimit: {
      webhook: {
        limit: 1,
        windowMs: 60000,
      },
    },
  });
  const authService = new ApiAuthService({
    apiKeys: [
      {
        apiKey: "operator-key",
        actorId: "operator-1",
        roles: ["viewer", "operator"],
      },
      {
        apiKey: "global-admin-key",
        actorId: "admin-global-1",
        roles: ["viewer", "operator", "admin"],
      },
      {
        apiKey: "tenant-admin-key",
        actorId: "admin-tenant-1",
        roles: ["viewer", "operator", "admin"],
        tenantId: "tenant-api",
      },
    ],
    jwtSecret: "phase3-http-secret",
  });
  const gatewayTarget = context.gatewayTargetDirectoryService.registerTarget({
    channel: "webhook",
    targetKind: "room",
    externalTargetId: sinkUrl,
    displayName: "Ops Delivery Hook",
    aliases: ["ops-hook"],
    metadata: {
      severity: "high",
    },
  });
  const loadBalancing = new CoordinatorLoadBalancingService(context.db, context.store);
  loadBalancing.registerHeartbeat({
    coordinatorId: "coord-west-1",
    region: "us-west",
    queueAffinity: "default",
    status: "active",
    maxConcurrentDispatches: 8,
    activeDispatchCount: 1,
    backlogCount: 0,
    cpuPct: 12,
    shards: ["tenant-api"],
    heartbeatAt: "2026-04-09T02:00:00.000Z",
  });
  loadBalancing.registerHeartbeat({
    coordinatorId: "coord-east-1",
    region: "us-east",
    queueAffinity: "default",
    status: "active",
    maxConcurrentDispatches: 8,
    activeDispatchCount: 7,
    backlogCount: 6,
    cpuPct: 86,
    shards: ["tenant-api"],
    heartbeatAt: "2026-04-09T02:00:30.000Z",
  });
  const server = new HttpApiServer({
    approvalService: context.approvalService,
    inspectService: context.inspectService,
    missionControlService: context.missionControlService,
    gatewayTargetDirectoryService: context.gatewayTargetDirectoryService,
    authService,
    channelGatewayService: new ChannelGatewayService(context.store, context.gatewayTargetDirectoryService, {
      fetchImpl: async (input, init) => {
        received.push({
          url: typeof input === "string" ? input : input.toString(),
          headers: Object.fromEntries(
            Object.entries((init?.headers ?? {}) as Record<string, string>).map(([name, value]) => [
              name.toLowerCase(),
              value,
            ]),
          ),
          body: init?.body ? JSON.parse(String(init.body)) : null,
        });
        return {
          ok: true,
          status: 202,
          json: async () => ({ ok: true }),
        } as Response;
      },
      webhook: {
        defaultHeaders: {
          "x-gateway-source": "automatic-agent",
        },
      },
      deliveryService,
    }),
    channelGatewayDeliveryService: deliveryService,
    coordinatorLoadBalancingService: loadBalancing,
  });

  try {
    const operatorToken = await server.inject({
      method: "POST",
      url: "/v1/auth/token",
      headers: {
        "x-api-key": "operator-key",
        "idempotency-key": "auth-token-operator-1",
      },
    });
    assert.equal(operatorToken.statusCode, 200);
    const operatorTokenPayload = readJson<{ accessToken: string }>(operatorToken);
    const operatorBearer = operatorTokenPayload.data.accessToken;

    const targets = await server.inject({
      url: "/v1/gateway/targets?channel=webhook",
      headers: {
        authorization: `Bearer ${operatorBearer}`,
      },
    });
    assert.equal(targets.statusCode, 200);
    const targetsPayload = readJson<{ targets: Array<{ targetId: string }> }>(targets);
    assert.ok(targetsPayload.data.targets.some((entry) => entry.targetId === gatewayTarget.targetId));

    const delivery = await server.inject({
      method: "POST",
      url: "/v1/gateway/messages/send",
      headers: {
        authorization: `Bearer ${operatorBearer}`,
        "content-type": "application/json",
        "idempotency-key": "gateway-delivery-1",
      },
      body: JSON.stringify({
        targetId: gatewayTarget.targetId,
        text: "Roll out the authenticated gateway lane.",
        metadata: {
          traceId: "trace-http-1",
        },
      }),
    });
    assert.equal(delivery.statusCode, 200);
    const deliveryPayload = readJson<Record<string, unknown>>(delivery);
    assert.equal(deliveryPayload.data.channel, "webhook");
    assert.equal(deliveryPayload.data.requestUrl, sinkUrl);
    assert.equal("responseStatus" in deliveryPayload.data, false);
    assert.equal(received.length, 1);
    assert.equal(received[0]?.url, sinkUrl);
    assert.equal(received[0]?.headers["x-gateway-source"], "automatic-agent");
    assert.deepEqual(received[0]?.body, {
      targetId: gatewayTarget.targetId,
      text: "Roll out the authenticated gateway lane.",
      metadata: {
        severity: "high",
        traceId: "trace-http-1",
      },
    });

    const throttledDelivery = await server.inject({
      method: "POST",
      url: "/v1/gateway/messages/send",
      headers: {
        authorization: `Bearer ${operatorBearer}`,
        "content-type": "application/json",
        "idempotency-key": "gateway-delivery-2",
      },
      body: JSON.stringify({
        targetId: gatewayTarget.targetId,
        text: "Second gateway message should be throttled.",
      }),
    });
    assert.equal(throttledDelivery.statusCode, 429);
    const throttledPayload = readError(throttledDelivery);
    assert.equal(throttledPayload.error.code, "gateway.rate_limited");
    assert.equal(received.length, 1);

    const globalAdminToken = await server.inject({
      method: "POST",
      url: "/v1/auth/token",
      headers: {
        "x-api-key": "global-admin-key",
        "idempotency-key": "auth-token-global-admin-1",
      },
    });
    assert.equal(globalAdminToken.statusCode, 200);
    const globalAdminTokenPayload = readJson<{ accessToken: string }>(globalAdminToken);
    const globalAdminBearer = globalAdminTokenPayload.data.accessToken;

    const summary = await server.inject({
      url: "/v1/admin/control-plane/load-balancing",
      headers: {
        authorization: `Bearer ${globalAdminBearer}`,
      },
    });
    assert.equal(summary.statusCode, 200);
    const summaryPayload = readJson<{ coordinatorCount: number; activeCount: number }>(summary);
    assert.equal(summaryPayload.data.coordinatorCount, 2);
    assert.equal(summaryPayload.data.activeCount, 2);

    const tenantAdminToken = await server.inject({
      method: "POST",
      url: "/v1/auth/token",
      headers: {
        "x-api-key": "tenant-admin-key",
        "idempotency-key": "auth-token-tenant-admin-1",
      },
    });
    assert.equal(tenantAdminToken.statusCode, 200);
    const tenantAdminTokenPayload = readJson<{ accessToken: string }>(tenantAdminToken);
    const tenantAdminBearer = tenantAdminTokenPayload.data.accessToken;

    const selection = await server.inject({
      method: "POST",
      url: "/v1/admin/control-plane/load-balancing/select",
      headers: {
        authorization: `Bearer ${tenantAdminBearer}`,
        "content-type": "application/json",
        "idempotency-key": "lb-select-1",
      },
      body: JSON.stringify({
        queueName: "default",
        preferredRegion: "us-west",
        tenantId: "tenant-api",
        requestKey: "http-api-1",
      }),
    });
    assert.equal(selection.statusCode, 403);
    const selectionPayload = readError(selection);
    assert.equal(selectionPayload.error.code, "api.tenant_scope_unsupported");

    const mismatchedSelection = await server.inject({
      method: "POST",
      url: "/v1/admin/control-plane/load-balancing/select",
      headers: {
        authorization: `Bearer ${tenantAdminBearer}`,
        "content-type": "application/json",
        "idempotency-key": "lb-select-2",
      },
      body: JSON.stringify({
        queueName: "default",
        preferredRegion: "us-west",
        tenantId: "tenant-other",
        requestKey: "http-api-2",
      }),
    });
    assert.equal(mismatchedSelection.statusCode, 403);
    const mismatchedSelectionPayload = readError(mismatchedSelection);
    assert.equal(mismatchedSelectionPayload.error.code, "api.tenant_scope_unsupported");
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});
