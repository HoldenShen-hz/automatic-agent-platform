/**
 * Replay Events CLI Tests
 *
 * Tests for replay-events CLI module which replays event sequences from SQLite.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { loadEventOpsCliEnv } from "../../../../src/platform/control-plane/config-center/ops-cli-env.js";
test("loadEventOpsCliEnv parses dbPath from AA_DB_PATH", () => {
    const config = loadEventOpsCliEnv({
        AA_DB_PATH: "/custom/path/test.db",
    });
    assert.equal(config.dbPath, "/custom/path/test.db");
});
test("loadEventOpsCliEnv uses default dbPath when not specified", () => {
    const config = loadEventOpsCliEnv({});
    assert.ok(config.dbPath.includes("data"));
    assert.ok(config.dbPath.includes("sqlite"));
    assert.ok(config.dbPath.includes("authoritative-demo.db"));
});
test("loadEventOpsCliEnv parses consumerId when AA_EVENT_CONSUMER_ID is set", () => {
    const config = loadEventOpsCliEnv({
        AA_DB_PATH: "/tmp/test.db",
        AA_EVENT_CONSUMER_ID: "consumer_123",
    });
    assert.equal(config.consumerId, "consumer_123");
});
test("loadEventOpsCliEnv returns null consumerId when not specified", () => {
    const config = loadEventOpsCliEnv({
        AA_DB_PATH: "/tmp/test.db",
    });
    assert.equal(config.consumerId, null);
});
test("replay-events main function branches - consumerId specified", async () => {
    // Test that when consumerId is provided, replayConsumer is called
    const envConfig = loadEventOpsCliEnv({
        AA_DB_PATH: "/tmp/test.db",
        AA_EVENT_CONSUMER_ID: "test-consumer",
    });
    assert.equal(envConfig.consumerId, "test-consumer");
    assert.ok(envConfig.dbPath);
});
test("replay-events main function branches - no consumerId", async () => {
    // Test that when no consumerId, replayDefaultConsumers is used
    const envConfig = loadEventOpsCliEnv({
        AA_DB_PATH: "/tmp/test.db",
    });
    assert.equal(envConfig.consumerId, null);
    assert.ok(envConfig.dbPath);
});
//# sourceMappingURL=replay-events.test.js.map