import assert from "node:assert/strict";
import test from "node:test";
import { createWebhookRoutes } from "../../../../../../src/platform/interface/api/http-server/webhook-routes.js";
import { WebhookIngressService } from "../../../../../../src/platform/interface/webhook/index.js";
function createMockAuthService() {
    return {
        requireRole: () => ({ actorId: "actor-1", roles: ["viewer", "operator", "admin"], authMethod: "api_key", tenantId: null }),
    };
}
function createMockAuthServiceNoAuth() {
    return {
        requireRole: () => { throw new Error("Authentication not configured"); },
    };
}
function createMockContext(pathname = "/webhooks", segments = [], headers = {}, body = null) {
    const routePathname = pathname.split("?")[0] ?? pathname;
    return {
        requestId: "req-123",
        request: { method: "GET", url: pathname, headers, body },
        route: { pathname: routePathname, segments },
        principal: null,
    };
}
async function callRoute(routes, ctx) {
    const pathname = ctx.route.pathname;
    for (const route of routes) {
        if (route.method !== (ctx.request.method ?? "GET"))
            continue;
        if (route.pathname !== null) {
            if (route.pathname === pathname) {
                return route.handler(ctx);
            }
        }
        else if (route.segments) {
            const result = await route.handler(ctx);
            if (result !== null) {
                return result;
            }
        }
    }
    return null;
}
test("createWebhookRoutes returns 6 routes", () => {
    const webhookService = new WebhookIngressService();
    const deps = {
        authService: createMockAuthService(),
        webhookIngressService: webhookService,
    };
    const routes = createWebhookRoutes(deps);
    assert.equal(routes.length, 6);
});
test("GET /webhooks returns list of webhooks", async () => {
    const webhookService = new WebhookIngressService();
    webhookService.registerEndpoint({
        endpointId: "webhook-1",
        source: "slack",
        tenantId: null,
        workspaceId: null,
        enabled: true,
        allowedEventTypes: ["task.done"],
        algorithm: "none",
    });
    const deps = {
        authService: createMockAuthService(),
        webhookIngressService: webhookService,
    };
    const routes = createWebhookRoutes(deps);
    const ctx = createMockContext("/webhooks", ["webhooks"]);
    const response = await callRoute(routes, ctx);
    assert.ok(response != null);
    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body.data.webhooks));
    assert.equal(body.data.webhooks.length, 1);
    assert.equal(body.data.webhooks[0].endpointId, "webhook-1");
});
test("GET /v1/webhooks returns list of webhooks", async () => {
    const webhookService = new WebhookIngressService();
    webhookService.registerEndpoint({
        endpointId: "webhook-1",
        source: "slack",
        tenantId: null,
        workspaceId: null,
        enabled: true,
        allowedEventTypes: ["task.done"],
        algorithm: "none",
    });
    const deps = {
        authService: createMockAuthService(),
        webhookIngressService: webhookService,
    };
    const routes = createWebhookRoutes(deps);
    const ctx = createMockContext("/v1/webhooks", ["v1", "webhooks"]);
    const response = await callRoute(routes, ctx);
    assert.ok(response != null);
    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body.data.webhooks));
});
test("POST /webhooks creates a new webhook endpoint", async () => {
    const webhookService = new WebhookIngressService();
    const deps = {
        authService: createMockAuthService(),
        webhookIngressService: webhookService,
    };
    const routes = createWebhookRoutes(deps);
    const ctx = createMockContext("/webhooks", ["webhooks"], {}, '{"endpointId":"my-webhook","source":"custom","allowedEventTypes":["event.test"]}');
    ctx.request.method = "POST";
    const response = await callRoute(routes, ctx);
    assert.ok(response != null);
    assert.equal(response.statusCode, 201);
    const body = JSON.parse(response.body);
    assert.equal(body.data.webhook.endpointId, "my-webhook");
    assert.equal(body.data.webhook.source, "custom");
});
test("POST /v1/webhooks creates a new webhook endpoint", async () => {
    const webhookService = new WebhookIngressService();
    const deps = {
        authService: createMockAuthService(),
        webhookIngressService: webhookService,
    };
    const routes = createWebhookRoutes(deps);
    const ctx = createMockContext("/v1/webhooks", ["v1", "webhooks"], {}, '{"endpointId":"v1-webhook","source":"github"}');
    ctx.request.method = "POST";
    const response = await callRoute(routes, ctx);
    assert.ok(response != null);
    assert.equal(response.statusCode, 201);
    const body = JSON.parse(response.body);
    assert.equal(body.data.webhook.endpointId, "v1-webhook");
});
test("POST /webhooks with invalid payload returns 400", async () => {
    const webhookService = new WebhookIngressService();
    const deps = {
        authService: createMockAuthService(),
        webhookIngressService: webhookService,
    };
    const routes = createWebhookRoutes(deps);
    const ctx = createMockContext("/webhooks", ["webhooks"], {}, '{"endpointId":123}');
    ctx.request.method = "POST";
    try {
        await callRoute(routes, ctx);
        assert.fail("Expected handler to throw");
    }
    catch (err) {
        assert.ok(err instanceof Error);
        assert.match(err.message, /expected string, received number/i);
    }
});
test("POST /webhooks requires authentication", async () => {
    const webhookService = new WebhookIngressService();
    const deps = {
        authService: createMockAuthServiceNoAuth(),
        webhookIngressService: webhookService,
    };
    const routes = createWebhookRoutes(deps);
    const ctx = createMockContext("/webhooks", ["webhooks"], {}, '{"endpointId":"test","source":"test"}');
    ctx.request.method = "POST";
    try {
        await callRoute(routes, ctx);
        assert.fail("Expected handler to throw");
    }
    catch (err) {
        assert.ok(err instanceof Error);
        assert.match(err.message, /authentication/i);
    }
});
test("DELETE /webhooks/:id deletes a webhook endpoint", async () => {
    const webhookService = new WebhookIngressService();
    webhookService.registerEndpoint({
        endpointId: "to-delete",
        source: "test",
        tenantId: null,
        workspaceId: null,
        enabled: true,
        allowedEventTypes: [],
        algorithm: "none",
    });
    const deps = {
        authService: createMockAuthService(),
        webhookIngressService: webhookService,
    };
    const routes = createWebhookRoutes(deps);
    const ctx = createMockContext("/webhooks/to-delete", ["webhooks", "to-delete"]);
    ctx.request.method = "DELETE";
    const response = await callRoute(routes, ctx);
    assert.ok(response != null);
    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.data.deleted, true);
    assert.equal(body.data.endpointId, "to-delete");
    // Verify it's actually deleted
    assert.equal(webhookService.getEndpoint("to-delete"), null);
});
test("DELETE /v1/webhooks/:id deletes a webhook endpoint", async () => {
    const webhookService = new WebhookIngressService();
    webhookService.registerEndpoint({
        endpointId: "v1-to-delete",
        source: "test",
        tenantId: null,
        workspaceId: null,
        enabled: true,
        allowedEventTypes: [],
        algorithm: "none",
    });
    const deps = {
        authService: createMockAuthService(),
        webhookIngressService: webhookService,
    };
    const routes = createWebhookRoutes(deps);
    const ctx = createMockContext("/v1/webhooks/v1-to-delete", ["v1", "webhooks", "v1-to-delete"]);
    ctx.request.method = "DELETE";
    const response = await callRoute(routes, ctx);
    assert.ok(response != null);
    assert.equal(response.statusCode, 200);
});
test("DELETE /webhooks/:id returns 404 for non-existent endpoint", async () => {
    const webhookService = new WebhookIngressService();
    const deps = {
        authService: createMockAuthService(),
        webhookIngressService: webhookService,
    };
    const routes = createWebhookRoutes(deps);
    const ctx = createMockContext("/webhooks/non-existent", ["webhooks", "non-existent"]);
    ctx.request.method = "DELETE";
    try {
        await callRoute(routes, ctx);
        assert.fail("Expected handler to throw");
    }
    catch (err) {
        assert.ok(err instanceof Error);
        assert.match(err.message, /not found/i);
    }
});
test("DELETE /webhooks/:id requires admin role", async () => {
    const webhookService = new WebhookIngressService();
    const deps = {
        authService: {
            requireRole: (_request, role) => {
                if (role === "admin") {
                    throw new Error("Forbidden");
                }
                return { actorId: "actor-1", roles: ["viewer"], authMethod: "api_key", tenantId: null };
            },
        },
        webhookIngressService: webhookService,
    };
    const routes = createWebhookRoutes(deps);
    const ctx = createMockContext("/webhooks/test", ["webhooks", "test"]);
    ctx.request.method = "DELETE";
    try {
        await callRoute(routes, ctx);
        assert.fail("Expected handler to throw");
    }
    catch (err) {
        assert.ok(err instanceof Error);
        assert.match(err.message, /forbidden/i);
    }
});
test("GET /webhooks requires authentication", async () => {
    const webhookService = new WebhookIngressService();
    const deps = {
        authService: createMockAuthServiceNoAuth(),
        webhookIngressService: webhookService,
    };
    const routes = createWebhookRoutes(deps);
    const ctx = createMockContext("/webhooks", ["webhooks"]);
    try {
        await callRoute(routes, ctx);
        assert.fail("Expected handler to throw");
    }
    catch (err) {
        assert.ok(err instanceof Error);
        assert.match(err.message, /authentication/i);
    }
});
test("POST /webhooks with HMAC algorithm requires signingSecret", async () => {
    const webhookService = new WebhookIngressService();
    const deps = {
        authService: createMockAuthService(),
        webhookIngressService: webhookService,
    };
    const routes = createWebhookRoutes(deps);
    const ctx = createMockContext("/webhooks", ["webhooks"], {}, '{"endpointId":"hmac-webhook","source":"test","algorithm":"sha256_hmac"}');
    ctx.request.method = "POST";
    try {
        await callRoute(routes, ctx);
        assert.fail("Expected handler to throw");
    }
    catch (err) {
        assert.ok(err instanceof Error);
        assert.match(err.message, /signing secret/i);
    }
});
//# sourceMappingURL=webhook-routes.test.js.map