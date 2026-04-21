/**
 * Smoke Test: API Server Health
 *
 * Verifies the API server can start and respond to health checks.
 * Part of the smoke test suite in tests/integration/smoke/.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createSeededApiContext } from "../../../../helpers/api.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
test("smoke: API server starts and /healthz returns 200", async () => {
    const workspace = createTempWorkspace("smoke-api-");
    try {
        const context = createSeededApiContext(workspace);
        const server = context.createServer();
        const response = await server.inject({
            url: "/healthz",
        });
        assert.strictEqual(response.statusCode, 200, `Expected 200, got ${response.statusCode}`);
        // Parse the response - health endpoint returns JSON
        const body = JSON.parse(response.body);
        // Health response should be an object (can have various properties)
        assert.ok(typeof body === "object" && body !== null, "Response should be a JSON object");
        context.db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("smoke: API server accepts requests after startup", async () => {
    const workspace = createTempWorkspace("smoke-api-request-");
    try {
        const context = createSeededApiContext(workspace);
        const server = context.createServer();
        // Get admin token
        const tokenResponse = await server.inject({
            method: "POST",
            url: "/v1/auth/token",
            headers: {
                "x-api-key": "test-api-key",
            },
        });
        assert.strictEqual(tokenResponse.statusCode, 200, "Token endpoint should work");
        const token = JSON.parse(tokenResponse.body);
        assert.ok(token.data?.accessToken, "Should receive access token");
        // Verify token can be used for authenticated requests
        const taskResponse = await server.inject({
            url: "/v1/tasks?limit=10",
            headers: {
                authorization: `Bearer ${token.data.accessToken}`,
            },
        });
        assert.strictEqual(taskResponse.statusCode, 200, "Authenticated request should succeed");
        context.db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=api-smoke.test.js.map