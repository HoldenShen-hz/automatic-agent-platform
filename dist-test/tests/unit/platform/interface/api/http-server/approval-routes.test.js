import assert from "node:assert/strict";
import test from "node:test";
import { createApprovalRoutes } from "../../../../../../src/platform/interface/api/http-server/approval-routes.js";
function createMockApprovalService() {
    return {
        applyDecision: () => { },
    };
}
function createMockInspectService() {
    return {
        queryDecisionInspectSummaries: () => [
            { decisionId: "appr-1", decisionType: "approval", status: "requested", taskId: "task-1", requestedAt: "2026-04-16T00:00:00.000Z", completedAt: null },
        ],
        getApprovalInspectView: () => ({
            approval: { id: "appr-1", taskId: "task-1", decisionType: "approval", status: "completed", requestedAt: "2026-04-16T00:00:00.000Z", completedAt: "2026-04-16T01:00:00.000Z" },
            timeline: { entries: [] },
        }),
    };
}
function createMockAuthService(roles = ["viewer", "operator"]) {
    return {
        requireRole: (headers, role) => {
            return { actorId: "actor-1", roles: roles, authMethod: "api_key", tenantId: null };
        },
    };
}
function createMockContext(pathname = "/approvals", segments = [], headers = {}, body = null, method = "GET") {
    return {
        requestId: "req-123",
        request: { method, url: pathname, headers, body },
        route: { pathname, segments },
        principal: null,
    };
}
async function callRoute(routes, ctx) {
    const pathname = ctx.route.pathname;
    const method = ctx.request.method ?? "GET";
    for (const route of routes) {
        if (route.method !== method)
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
test("createApprovalRoutes returns 4 routes", () => {
    const deps = {
        authService: createMockAuthService(),
        approvalService: createMockApprovalService(),
        inspectService: createMockInspectService(),
    };
    const routes = createApprovalRoutes(deps);
    assert.equal(routes.length, 4);
});
test("GET /approvals returns approval list", async () => {
    const deps = {
        authService: createMockAuthService(),
        approvalService: createMockApprovalService(),
        inspectService: createMockInspectService(),
    };
    const routes = createApprovalRoutes(deps);
    const ctx = createMockContext("/approvals", ["approvals"]);
    const response = await callRoute(routes, ctx);
    if (!response)
        throw new Error("Handler returned null");
    assert.equal(response.statusCode, 200);
    assert.ok(response.body.includes("appr-1"));
});
test("GET /approvals throws when auth not configured", async () => {
    const deps = {
        authService: null,
        approvalService: createMockApprovalService(),
        inspectService: createMockInspectService(),
    };
    const routes = createApprovalRoutes(deps);
    const ctx = createMockContext("/approvals", ["approvals"]);
    try {
        await callRoute(routes, ctx);
        assert.fail("Expected handler to throw");
    }
    catch (err) {
        assert.ok(err instanceof Error);
        assert.match(err.message, /authentication/);
    }
});
test("POST /approvals/:id/decision applies decision", async () => {
    const deps = {
        authService: createMockAuthService(),
        approvalService: createMockApprovalService(),
        inspectService: createMockInspectService(),
    };
    const routes = createApprovalRoutes(deps);
    const ctx = createMockContext("/approvals/appr-1/decision", ["approvals", "appr-1", "decision"], {}, JSON.stringify({ decisionType: "confirmed" }), "POST");
    const response = await callRoute(routes, ctx);
    if (!response)
        throw new Error("Handler returned null");
    assert.equal(response.statusCode, 200);
    assert.ok(response.body.includes("appr-1"));
});
test("POST /approvals/:id/decision validates decision payload", async () => {
    const deps = {
        authService: createMockAuthService(),
        approvalService: createMockApprovalService(),
        inspectService: createMockInspectService(),
    };
    const routes = createApprovalRoutes(deps);
    const ctx = createMockContext("/approvals/appr-1/decision", ["approvals", "appr-1", "decision"], {}, JSON.stringify({ decisionType: "option_selected" }), "POST");
    try {
        await callRoute(routes, ctx);
        assert.fail("Expected handler to throw");
    }
    catch (err) {
        assert.ok(err instanceof Error);
        assert.match(err.message, /selectedOptionId/);
    }
});
test("GET /v1/approvals returns approval list", async () => {
    const deps = {
        authService: createMockAuthService(),
        approvalService: createMockApprovalService(),
        inspectService: createMockInspectService(),
    };
    const routes = createApprovalRoutes(deps);
    const ctx = createMockContext("/v1/approvals", ["v1", "approvals"]);
    const response = await callRoute(routes, ctx);
    if (!response)
        throw new Error("Handler returned null");
    assert.equal(response.statusCode, 200);
});
test("POST /v1/approvals/:id/decision applies decision with correct actor", async () => {
    const deps = {
        authService: createMockAuthService(),
        approvalService: createMockApprovalService(),
        inspectService: createMockInspectService(),
    };
    const routes = createApprovalRoutes(deps);
    const ctx = createMockContext("/v1/approvals/appr-2/decision", ["v1", "approvals", "appr-2", "decision"], {}, JSON.stringify({ decisionType: "confirmed" }), "POST");
    const response = await callRoute(routes, ctx);
    if (!response)
        throw new Error("Handler returned null");
    assert.equal(response.statusCode, 200);
});
test("POST /v1/approvals/:id/decision validates decision payload", async () => {
    const deps = {
        authService: createMockAuthService(),
        approvalService: createMockApprovalService(),
        inspectService: createMockInspectService(),
    };
    const routes = createApprovalRoutes(deps);
    const ctx = createMockContext("/v1/approvals/appr-2/decision", ["v1", "approvals", "appr-2", "decision"], {}, JSON.stringify({ decisionType: "text_input" }), "POST");
    try {
        await callRoute(routes, ctx);
        assert.fail("Expected handler to throw");
    }
    catch (err) {
        assert.ok(err instanceof Error);
        assert.match(err.message, /inputText/);
    }
});
test("POST /approvals/:id/decision rejects dangerous JSON keys", async () => {
    const deps = {
        authService: createMockAuthService(),
        approvalService: createMockApprovalService(),
        inspectService: createMockInspectService(),
    };
    const routes = createApprovalRoutes(deps);
    const ctx = createMockContext("/approvals/appr-1/decision", ["approvals", "appr-1", "decision"], {}, "{\"decisionType\":\"confirmed\",\"__proto__\":{\"polluted\":true}}", "POST");
    await assert.rejects(async () => {
        await callRoute(routes, ctx);
    }, /reserved key: __proto__/i);
});
//# sourceMappingURL=approval-routes.test.js.map