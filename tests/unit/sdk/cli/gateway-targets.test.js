/**
 * @fileoverview Tests for Gateway Targets CLI
 */
import assert from "node:assert/strict";
import test from "node:test";
import { loadGatewayTargetsCliEnv } from "../../../../src/platform/control-plane/config-center/remaining-cli-env.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";
// ---------------------------------------------------------------------------
// Tests for loadGatewayTargetsCliEnv
// ---------------------------------------------------------------------------
test("loadGatewayTargetsCliEnv accepts upsert action", () => {
    const result = loadGatewayTargetsCliEnv({
        AA_GATEWAY_TARGET_ACTION: "upsert",
        AA_GATEWAY_CHANNEL: "worker",
        AA_GATEWAY_TARGET_KIND: "queue",
        AA_GATEWAY_EXTERNAL_TARGET_ID: "queue-1",
        AA_GATEWAY_DISPLAY_NAME: "Primary Queue",
    });
    assert.equal(result.action, "upsert");
});
test("loadGatewayTargetsCliEnv accepts list action", () => {
    const result = loadGatewayTargetsCliEnv({
        AA_GATEWAY_TARGET_ACTION: "list",
    });
    assert.equal(result.action, "list");
});
test("loadGatewayTargetsCliEnv accepts resolve action", () => {
    const result = loadGatewayTargetsCliEnv({
        AA_GATEWAY_TARGET_ACTION: "resolve",
        AA_GATEWAY_QUERY: "primary",
    });
    assert.equal(result.action, "resolve");
});
test("loadGatewayTargetsCliEnv parses upsert with all fields", () => {
    const result = loadGatewayTargetsCliEnv({
        AA_GATEWAY_TARGET_ACTION: "upsert",
        AA_GATEWAY_CHANNEL: "events",
        AA_GATEWAY_TARGET_KIND: "webhook",
        AA_GATEWAY_EXTERNAL_TARGET_ID: "wh-123",
        AA_GATEWAY_DISPLAY_NAME: "Event Webhook",
        AA_GATEWAY_ALIASES_JSON: '["event-wh","primary-wh"]',
        AA_GATEWAY_METADATA_JSON: '{"region":"us-east"}',
    });
    assert.equal(result.action, "upsert");
    assert.equal(result.channel, "events");
    assert.equal(result.targetKind, "webhook");
    assert.equal(result.externalTargetId, "wh-123");
    assert.equal(result.displayName, "Event Webhook");
    assert.deepEqual(result.aliases, ["event-wh", "primary-wh"]);
    assert.deepEqual(result.metadata, { region: "us-east" });
});
test("loadGatewayTargetsCliEnv parses resolve with channel filter", () => {
    const result = loadGatewayTargetsCliEnv({
        AA_GATEWAY_TARGET_ACTION: "resolve",
        AA_GATEWAY_QUERY: "worker",
        AA_GATEWAY_CHANNEL: "dispatch",
    });
    assert.equal(result.action, "resolve");
    assert.equal(result.query, "worker");
    assert.equal(result.channel, "dispatch");
});
test("loadGatewayTargetsCliEnv parses list with limit", () => {
    const result = loadGatewayTargetsCliEnv({
        AA_GATEWAY_TARGET_ACTION: "list",
        AA_GATEWAY_LIMIT: "50",
    });
    assert.equal(result.action, "list");
    assert.equal(result.limit, 50);
});
test("loadGatewayTargetsCliEnv parses list with channel filter", () => {
    const result = loadGatewayTargetsCliEnv({
        AA_GATEWAY_TARGET_ACTION: "list",
        AA_GATEWAY_CHANNEL: "tasks",
        AA_GATEWAY_QUERY: "default",
        AA_GATEWAY_LIMIT: "25",
    });
    assert.equal(result.action, "list");
    assert.equal(result.channel, "tasks");
    assert.equal(result.query, "default");
    assert.equal(result.limit, 25);
});
test("loadGatewayTargetsCliEnv uses AA_DB_PATH when set", () => {
    const result = loadGatewayTargetsCliEnv({
        AA_DB_PATH: "/custom/path/gateway.db",
        AA_GATEWAY_TARGET_ACTION: "list",
    });
    assert.equal(result.dbPath, "/custom/path/gateway.db");
});
test("loadGatewayTargetsCliEnv parses upsert without optional fields", () => {
    const result = loadGatewayTargetsCliEnv({
        AA_GATEWAY_TARGET_ACTION: "upsert",
        AA_GATEWAY_CHANNEL: "default",
        AA_GATEWAY_TARGET_KIND: "queue",
        AA_GATEWAY_EXTERNAL_TARGET_ID: "default-queue",
        AA_GATEWAY_DISPLAY_NAME: "Default Queue",
    });
    assert.equal(result.action, "upsert");
    assert.equal(result.channel, "default");
    assert.equal(result.aliases, undefined);
    assert.equal(result.metadata, undefined);
});
test("loadGatewayTargetsCliEnv parseStringArrayJson handles empty aliases", () => {
    const result = loadGatewayTargetsCliEnv({
        AA_GATEWAY_TARGET_ACTION: "upsert",
        AA_GATEWAY_CHANNEL: "events",
        AA_GATEWAY_TARGET_KIND: "webhook",
        AA_GATEWAY_EXTERNAL_TARGET_ID: "wh-empty",
        AA_GATEWAY_DISPLAY_NAME: "Empty Aliases",
        AA_GATEWAY_ALIASES_JSON: "[]",
    });
    assert.deepEqual(result.aliases, []);
});
test("loadGatewayTargetsCliEnv parseObjectJson handles empty metadata", () => {
    const result = loadGatewayTargetsCliEnv({
        AA_GATEWAY_TARGET_ACTION: "upsert",
        AA_GATEWAY_CHANNEL: "events",
        AA_GATEWAY_TARGET_KIND: "webhook",
        AA_GATEWAY_EXTERNAL_TARGET_ID: "wh-meta",
        AA_GATEWAY_DISPLAY_NAME: "Empty Metadata",
        AA_GATEWAY_METADATA_JSON: "{}",
    });
    assert.deepEqual(result.metadata, {});
});
test("loadGatewayTargetsCliEnv throws ValidationError for unknown action", () => {
    assert.throws(() => loadGatewayTargetsCliEnv({
        AA_GATEWAY_TARGET_ACTION: "invalid_action",
    }), (e) => e instanceof ValidationError &&
        e.code === "invalid_env:AA_GATEWAY_TARGET_ACTION");
});
test("loadGatewayTargetsCliEnv throws for missing required action", () => {
    assert.throws(() => loadGatewayTargetsCliEnv({}), (e) => e instanceof ValidationError);
});
// ---------------------------------------------------------------------------
// Tests for action validation
// ---------------------------------------------------------------------------
test("upsert action channel can be null when not provided", () => {
    const envConfig = loadGatewayTargetsCliEnv({
        AA_GATEWAY_TARGET_ACTION: "upsert",
        // channel not provided
        AA_GATEWAY_TARGET_KIND: "queue",
        AA_GATEWAY_EXTERNAL_TARGET_ID: "q-1",
        AA_GATEWAY_DISPLAY_NAME: "Queue",
    });
    // channel will be undefined since not provided (not null)
    assert.equal(envConfig.channel, undefined);
});
test("resolve action query can be undefined when not provided", () => {
    const envConfig = loadGatewayTargetsCliEnv({
        AA_GATEWAY_TARGET_ACTION: "resolve",
        // query not provided
    });
    // query will be undefined since not provided
    assert.equal(envConfig.query, undefined);
});
test("list action works without filters", () => {
    const envConfig = loadGatewayTargetsCliEnv({
        AA_GATEWAY_TARGET_ACTION: "list",
    });
    assert.equal(envConfig.action, "list");
});
test("all valid actions are distinct", () => {
    const actions = ["upsert", "list", "resolve"];
    const unique = new Set(actions);
    assert.equal(unique.size, actions.length);
});
// ---------------------------------------------------------------------------
// Test limit field parsing
// ---------------------------------------------------------------------------
test("loadGatewayTargetsCliEnv parses limit as integer", () => {
    const result = loadGatewayTargetsCliEnv({
        AA_GATEWAY_TARGET_ACTION: "list",
        AA_GATEWAY_LIMIT: "100",
    });
    assert.equal(result.limit, 100);
});
test("loadGatewayTargetsCliEnv limit is undefined when not provided", () => {
    const result = loadGatewayTargetsCliEnv({
        AA_GATEWAY_TARGET_ACTION: "list",
    });
    assert.equal(result.limit, undefined);
});
// ---------------------------------------------------------------------------
// Test that invalid JSON for arrays and objects throw
// ---------------------------------------------------------------------------
test("loadGatewayTargetsCliEnv throws on invalid aliases JSON", () => {
    assert.throws(() => loadGatewayTargetsCliEnv({
        AA_GATEWAY_TARGET_ACTION: "upsert",
        AA_GATEWAY_CHANNEL: "events",
        AA_GATEWAY_TARGET_KIND: "webhook",
        AA_GATEWAY_EXTERNAL_TARGET_ID: "wh-123",
        AA_GATEWAY_DISPLAY_NAME: "Test",
        AA_GATEWAY_ALIASES_JSON: "not-valid-json",
    }), (e) => e instanceof Error);
});
test("loadGatewayTargetsCliEnv throws on invalid metadata JSON", () => {
    assert.throws(() => loadGatewayTargetsCliEnv({
        AA_GATEWAY_TARGET_ACTION: "upsert",
        AA_GATEWAY_CHANNEL: "events",
        AA_GATEWAY_TARGET_KIND: "webhook",
        AA_GATEWAY_EXTERNAL_TARGET_ID: "wh-123",
        AA_GATEWAY_DISPLAY_NAME: "Test",
        AA_GATEWAY_METADATA_JSON: "not-valid-json",
    }), (e) => e instanceof Error);
});
//# sourceMappingURL=gateway-targets.test.js.map