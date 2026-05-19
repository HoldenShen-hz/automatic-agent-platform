/**
 * SDK/CLI Integration Tests - Client SDK
 *
 * Tests the client SDK: ApiClient with retry, pagination, and error handling
 */
import assert from "node:assert/strict";
import test from "node:test";
import { RetryableApiClient, buildApiUrl, buildAuthHeaders, createApiClient, parseCursor, encodeCursor, } from "../../../src/sdk/client-sdk/api-client.js";
test("client SDK: buildApiUrl constructs versioned API URL with query parameters", () => {
    const config = {
        baseUrl: "https://api.example.com",
        apiVersion: "v1",
        tenantId: "tenant-123",
    };
    const request = {
        path: "/tasks",
        method: "GET",
        query: { status: "pending", limit: 10 },
    };
    const url = buildApiUrl(config, request);
    assert.equal(url, "https://api.example.com/v1/tasks?status=pending&limit=10&tenantId=tenant-123");
});
test("client SDK: buildApiUrl strips trailing slashes from baseUrl and apiVersion", () => {
    const config = {
        baseUrl: "https://api.example.com///",
        apiVersion: "//v1//",
        tenantId: "tenant-abc",
    };
    const url = buildApiUrl(config, { path: "/tasks" });
    assert.equal(url, "https://api.example.com/v1/tasks?tenantId=tenant-abc");
});
test("client SDK: buildApiUrl omits tenantId when not provided", () => {
    const config = {
        baseUrl: "https://api.example.com",
        apiVersion: "v1",
    };
    const url = buildApiUrl(config, { path: "/tasks" });
    assert.equal(url, "https://api.example.com/v1/tasks");
    assert.ok(!url.includes("tenantId"));
});
test("client SDK: buildApiUrl omits null/undefined query values", () => {
    const config = {
        baseUrl: "https://api.example.com",
        apiVersion: "v1",
    };
    const url = buildApiUrl(config, {
        path: "/tasks",
        query: { active: true, filter: null, limit: undefined },
    });
    assert.ok(url.includes("active=true"));
    assert.ok(!url.includes("filter="));
    assert.ok(!url.includes("limit="));
});
test("client SDK: buildAuthHeaders throws on missing bearer token", () => {
    let thrown = false;
    let errorMessage = "";
    try {
        buildAuthHeaders({ baseUrl: "https://api.example.com", apiVersion: "v1", bearerToken: "" });
    }
    catch (error) {
        thrown = true;
        errorMessage = String(error);
    }
    assert.equal(thrown, true);
    assert.ok(errorMessage.includes("Client SDK requests require a bearer token"));
});
test("client SDK: buildAuthHeaders builds valid Bearer token header", () => {
    const headers = buildAuthHeaders({
        baseUrl: "https://api.example.com",
        apiVersion: "v1",
        bearerToken: "secret-token-abc",
    });
    assert.equal(headers.authorization, "Bearer secret-token-abc");
});
test("client SDK: buildAuthHeaders trims whitespace from bearer token", () => {
    const headers = buildAuthHeaders({
        baseUrl: "https://api.example.com",
        apiVersion: "v1",
        bearerToken: "  token-with-spaces  ",
    });
    assert.equal(headers.authorization, "Bearer token-with-spaces");
});
test("client SDK: createApiClient creates a client instance", () => {
    const client = createApiClient({
        baseUrl: "https://api.example.com",
        apiVersion: "v1",
        bearerToken: "test-token",
        timeoutMs: 5000,
        maxRetries: 3,
    });
    assert.ok(client instanceof RetryableApiClient);
});
test("client SDK: createApiClient throws on missing baseUrl", () => {
    let thrown = false;
    let errorMessage = "";
    try {
        createApiClient({ baseUrl: "", apiVersion: "v1", bearerToken: "token" });
    }
    catch (error) {
        thrown = true;
        errorMessage = String(error);
    }
    assert.equal(thrown, true);
    assert.ok(errorMessage.includes("API client requires baseUrl"));
});
test("client SDK: createApiClient throws on missing apiVersion", () => {
    let thrown = false;
    let errorMessage = "";
    try {
        createApiClient({ baseUrl: "https://api.example.com", apiVersion: "", bearerToken: "token" });
    }
    catch (error) {
        thrown = true;
        errorMessage = String(error);
    }
    assert.equal(thrown, true);
    assert.ok(errorMessage.includes("API client requires apiVersion"));
});
test("client SDK: parseCursor decodes base64-encoded cursor", () => {
    const pagination = { cursor: "abc123", limit: 25 };
    const encoded = encodeCursor(pagination);
    const decoded = parseCursor(encoded);
    assert.deepEqual(decoded, { cursor: "abc123", limit: 25 });
});
test("client SDK: parseCursor returns undefined for null/undefined", () => {
    assert.equal(parseCursor(null), undefined);
    assert.equal(parseCursor(undefined), undefined);
});
test("client SDK: parseCursor returns undefined for invalid base64", () => {
    assert.equal(parseCursor("not-valid-base64!!!"), undefined);
});
test("client SDK: encodeCursor creates base64-encoded cursor", () => {
    const pagination = { cursor: "page-42", limit: 50 };
    const encoded = encodeCursor(pagination);
    const decoded = Buffer.from(encoded, "base64").toString("utf-8");
    assert.equal(decoded, JSON.stringify(pagination));
});
test("client SDK: RetryableApiClient instance has correct config", () => {
    const config = {
        baseUrl: "https://api.example.com",
        apiVersion: "v2",
        tenantId: "tenant-xyz",
        bearerToken: "test-token",
        timeoutMs: 10000,
        maxRetries: 5,
    };
    const client = new RetryableApiClient(config);
    // Test that instance is created successfully
    assert.ok(client !== null);
});
test("client SDK: RetryableApiClient with custom retry config", () => {
    const config = {
        baseUrl: "https://api.example.com",
        apiVersion: "v1",
        bearerToken: "test-token",
    };
    const customRetry = {
        maxRetries: 10,
        backoffMs: 500,
        backoffMultiplier: 3,
        maxBackoffMs: 60000,
    };
    const client = new RetryableApiClient(config, customRetry);
    assert.ok(client !== null);
});
//# sourceMappingURL=client-sdk-integration.test.js.map