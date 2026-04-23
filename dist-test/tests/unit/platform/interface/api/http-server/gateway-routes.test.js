import assert from "node:assert/strict";
import test from "node:test";
import { createGatewayRoutes } from "../../../../../../src/platform/interface/api/http-server/gateway-routes.js";
function createMockTargetDirectoryService() {
    return {
        listTargets: ({ limit = 50 } = {}) => [
            { targetId: "tgt-1", displayName: "Target One", source: "directory", lastSeenAt: null },
            { targetId: "tgt-2", displayName: "Target Two", source: "directory", lastSeenAt: null },
        ],
        resolveTarget: ({ query }) => ({ targetId: "resolved-tgt", displayName: "Resolved Target", source: "directory", lastSeenAt: null }),
    };
}
function createMockChannelGatewayService() {
    return {
        sendMessage: async () => ({
            deliveredAt: "2026-04-16T00:00:00.000Z",
            channel: "test",
            targetId: "tgt-1",
            externalTargetId: "ext-1",
            requestUrl: "https://example.com",
            providerMessageId: "prov-123",
        }),
    };
}
function createMockDeliveryService() {
    return {
        verifySignature: () => ({ valid: true }),
        verifyNonce: () => ({ valid: true }),
        createDeliveryMessage: () => ({
            messageId: "msg-123",
            channel: "webhook",
            targetId: "tgt-1",
            payload: {},
            status: "pending",
            createdAt: "2026-04-16T00:00:00.000Z",
            attempts: 0,
            maxRetries: 3,
        }),
        recordAttempt: () => ({ messageId: "msg-123", attemptNumber: 1, status: "success", responseStatus: 200 }),
    };
}
function createMockAuthService() {
    return {
        requireRole: () => ({ actorId: "actor-1", roles: ["viewer", "operator"], authMethod: "api_key", tenantId: null }),
    };
}
function createMockContext(pathname, method = "GET", headers = {}, body = null) {
    return {
        requestId: "req-123",
        request: { method, url: pathname, headers, body },
        route: { pathname, segments: [] },
        principal: null,
    };
}
test("createGatewayRoutes returns 4 routes", () => {
    const deps = {
        authService: createMockAuthService(),
        gatewayTargetDirectoryService: createMockTargetDirectoryService(),
        channelGatewayService: createMockChannelGatewayService(),
        channelGatewayDeliveryService: createMockDeliveryService(),
        webhookSecret: null,
    };
    const routes = createGatewayRoutes(deps);
    assert.equal(routes.length, 4);
});
test("GET /v1/gateway/targets returns target list", async () => {
    const deps = {
        authService: createMockAuthService(),
        gatewayTargetDirectoryService: createMockTargetDirectoryService(),
        channelGatewayService: createMockChannelGatewayService(),
        channelGatewayDeliveryService: createMockDeliveryService(),
        webhookSecret: null,
    };
    const routes = createGatewayRoutes(deps);
    const route = routes.find((r) => r.pathname === "/v1/gateway/targets");
    const ctx = createMockContext("/v1/gateway/targets");
    const response = await route.handler(ctx);
    if (!response)
        throw new Error("Handler returned null");
    assert.equal(response.statusCode, 200);
    assert.ok(response.body.includes("tgt-1"));
    assert.ok(response.body.includes("tgt-2"));
});
test("GET /v1/gateway/targets throws 503 when service unavailable", async () => {
    const deps = {
        authService: createMockAuthService(),
        gatewayTargetDirectoryService: null,
        channelGatewayService: createMockChannelGatewayService(),
        channelGatewayDeliveryService: createMockDeliveryService(),
        webhookSecret: null,
    };
    const routes = createGatewayRoutes(deps);
    const route = routes.find((r) => r.pathname === "/v1/gateway/targets");
    const ctx = createMockContext("/v1/gateway/targets");
    try {
        await route.handler(ctx);
        assert.fail("Expected handler to throw");
    }
    catch (err) {
        assert.ok(err instanceof Error);
        assert.match(err.message, /not configured/);
    }
});
test("GET /v1/gateway/targets/resolve resolves target", async () => {
    const deps = {
        authService: createMockAuthService(),
        gatewayTargetDirectoryService: createMockTargetDirectoryService(),
        channelGatewayService: createMockChannelGatewayService(),
        channelGatewayDeliveryService: createMockDeliveryService(),
        webhookSecret: null,
    };
    const routes = createGatewayRoutes(deps);
    const route = routes.find((r) => r.pathname === "/v1/gateway/targets/resolve");
    const ctx = createMockContext("/v1/gateway/targets/resolve?query=search");
    const response = await route.handler(ctx);
    if (!response)
        throw new Error("Handler returned null");
    assert.equal(response.statusCode, 200);
    assert.ok(response.body.includes("resolved-tgt"));
});
test("GET /v1/gateway/targets/resolve throws when query missing", async () => {
    const deps = {
        authService: createMockAuthService(),
        gatewayTargetDirectoryService: createMockTargetDirectoryService(),
        channelGatewayService: createMockChannelGatewayService(),
        channelGatewayDeliveryService: createMockDeliveryService(),
        webhookSecret: null,
    };
    const routes = createGatewayRoutes(deps);
    const route = routes.find((r) => r.pathname === "/v1/gateway/targets/resolve");
    const ctx = createMockContext("/v1/gateway/targets/resolve");
    try {
        await route.handler(ctx);
        assert.fail("Expected handler to throw");
    }
    catch (err) {
        assert.ok(err instanceof Error);
        assert.match(err.message, /query.*required/i);
    }
});
test("POST /v1/gateway/messages/send sends message", async () => {
    const deps = {
        authService: createMockAuthService(),
        gatewayTargetDirectoryService: createMockTargetDirectoryService(),
        channelGatewayService: createMockChannelGatewayService(),
        channelGatewayDeliveryService: createMockDeliveryService(),
        webhookSecret: null,
    };
    const routes = createGatewayRoutes(deps);
    const route = routes.find((r) => r.pathname === "/v1/gateway/messages/send");
    const ctx = createMockContext("/v1/gateway/messages/send", "POST", {}, JSON.stringify({ text: "Hello", targetId: "tgt-1" }));
    const response = await route.handler(ctx);
    if (!response)
        throw new Error("Handler returned null");
    assert.equal(response.statusCode, 200);
    assert.ok(response.body.includes("prov-123"));
});
test("POST /v1/gateway/messages/send throws 503 when service unavailable", async () => {
    const deps = {
        authService: createMockAuthService(),
        gatewayTargetDirectoryService: createMockTargetDirectoryService(),
        channelGatewayService: null,
        channelGatewayDeliveryService: createMockDeliveryService(),
        webhookSecret: null,
    };
    const routes = createGatewayRoutes(deps);
    const route = routes.find((r) => r.pathname === "/v1/gateway/messages/send");
    const ctx = createMockContext("/v1/gateway/messages/send", "POST", {}, JSON.stringify({ text: "Hello" }));
    try {
        await route.handler(ctx);
        assert.fail("Expected handler to throw");
    }
    catch (err) {
        assert.ok(err instanceof Error);
        assert.match(err.message, /not configured/);
    }
});
test("POST /v1/gateway/webhooks/receive processes webhook", async () => {
    const deps = {
        authService: createMockAuthService(),
        gatewayTargetDirectoryService: createMockTargetDirectoryService(),
        channelGatewayService: createMockChannelGatewayService(),
        channelGatewayDeliveryService: createMockDeliveryService(),
        webhookSecret: null,
    };
    const routes = createGatewayRoutes(deps);
    const route = routes.find((r) => r.pathname === "/v1/gateway/webhooks/receive");
    const ctx = createMockContext("/v1/gateway/webhooks/receive", "POST", {}, JSON.stringify({ targetId: "tgt-1", channel: "webhook" }));
    const response = await route.handler(ctx);
    if (!response)
        throw new Error("Handler returned null");
    assert.equal(response.statusCode, 200);
    assert.ok(response.body.includes("msg-123"));
});
test("POST /v1/gateway/webhooks/receive throws 503 when service unavailable", async () => {
    const deps = {
        authService: createMockAuthService(),
        gatewayTargetDirectoryService: createMockTargetDirectoryService(),
        channelGatewayService: createMockChannelGatewayService(),
        channelGatewayDeliveryService: null,
        webhookSecret: null,
    };
    const routes = createGatewayRoutes(deps);
    const route = routes.find((r) => r.pathname === "/v1/gateway/webhooks/receive");
    const ctx = createMockContext("/v1/gateway/webhooks/receive", "POST", {}, JSON.stringify({ targetId: "tgt-1" }));
    try {
        await route.handler(ctx);
        assert.fail("Expected handler to throw");
    }
    catch (err) {
        assert.ok(err instanceof Error);
        assert.match(err.message, /not configured/);
    }
});
test("POST /v1/gateway/webhooks/receive throws on invalid JSON", async () => {
    const deps = {
        authService: createMockAuthService(),
        gatewayTargetDirectoryService: createMockTargetDirectoryService(),
        channelGatewayService: createMockChannelGatewayService(),
        channelGatewayDeliveryService: createMockDeliveryService(),
        webhookSecret: null,
    };
    const routes = createGatewayRoutes(deps);
    const route = routes.find((r) => r.pathname === "/v1/gateway/webhooks/receive");
    const ctx = createMockContext("/v1/gateway/webhooks/receive", "POST", {}, "not json{");
    try {
        await route.handler(ctx);
        assert.fail("Expected handler to throw");
    }
    catch (err) {
        assert.ok(err instanceof Error);
        assert.match(err.message, /valid JSON/i);
    }
});
test("POST /v1/gateway/messages/send rejects dangerous JSON keys", async () => {
    const deps = {
        authService: createMockAuthService(),
        gatewayTargetDirectoryService: createMockTargetDirectoryService(),
        channelGatewayService: createMockChannelGatewayService(),
        channelGatewayDeliveryService: createMockDeliveryService(),
        webhookSecret: null,
    };
    const routes = createGatewayRoutes(deps);
    const route = routes.find((r) => r.pathname === "/v1/gateway/messages/send");
    const ctx = createMockContext("/v1/gateway/messages/send", "POST", {}, "{\"text\":\"Hello\",\"targetId\":\"tgt-1\",\"metadata\":{\"__proto__\":{\"polluted\":true}}}");
    await assert.rejects(async () => {
        await route.handler(ctx);
    }, /reserved key: __proto__/i);
});
test("POST /v1/gateway/webhooks/receive rejects dangerous JSON keys", async () => {
    const deps = {
        authService: createMockAuthService(),
        gatewayTargetDirectoryService: createMockTargetDirectoryService(),
        channelGatewayService: createMockChannelGatewayService(),
        channelGatewayDeliveryService: createMockDeliveryService(),
        webhookSecret: null,
    };
    const routes = createGatewayRoutes(deps);
    const route = routes.find((r) => r.pathname === "/v1/gateway/webhooks/receive");
    const ctx = createMockContext("/v1/gateway/webhooks/receive", "POST", {}, "{\"targetId\":\"tgt-1\",\"channel\":\"webhook\",\"__proto__\":{\"polluted\":true}}");
    await assert.rejects(async () => {
        await route.handler(ctx);
    }, /reserved key: __proto__/i);
});
test("GET /v1/gateway/targets filters by channel query param", async () => {
    const deps = {
        authService: createMockAuthService(),
        gatewayTargetDirectoryService: createMockTargetDirectoryService(),
        channelGatewayService: createMockChannelGatewayService(),
        channelGatewayDeliveryService: createMockDeliveryService(),
        webhookSecret: null,
    };
    const routes = createGatewayRoutes(deps);
    const route = routes.find((r) => r.pathname === "/v1/gateway/targets");
    const ctx = createMockContext("/v1/gateway/targets?channel=email");
    const response = await route.handler(ctx);
    if (!response)
        throw new Error("Handler returned null");
    assert.equal(response.statusCode, 200);
});
test("GET /v1/gateway/targets rejects invalid limit query values", async () => {
    const deps = {
        authService: createMockAuthService(),
        gatewayTargetDirectoryService: createMockTargetDirectoryService(),
        channelGatewayService: createMockChannelGatewayService(),
        channelGatewayDeliveryService: createMockDeliveryService(),
        webhookSecret: null,
    };
    const routes = createGatewayRoutes(deps);
    const route = routes.find((r) => r.pathname === "/v1/gateway/targets");
    const ctx = createMockContext("/v1/gateway/targets?limit=NaN");
    await assert.rejects(async () => {
        await route.handler(ctx);
    }, /positive integer|invalid_limit/i);
});
test("GET /v1/gateway/targets rejects invalid channel query values", async () => {
    const deps = {
        authService: createMockAuthService(),
        gatewayTargetDirectoryService: createMockTargetDirectoryService(),
        channelGatewayService: createMockChannelGatewayService(),
        channelGatewayDeliveryService: createMockDeliveryService(),
        webhookSecret: null,
    };
    const routes = createGatewayRoutes(deps);
    const route = routes.find((r) => r.pathname === "/v1/gateway/targets");
    const ctx = createMockContext("/v1/gateway/targets?channel=../../etc/passwd");
    await assert.rejects(async () => {
        await route.handler(ctx);
    }, /invalid_channel|invalid characters/i);
});
//# sourceMappingURL=gateway-routes.test.js.map