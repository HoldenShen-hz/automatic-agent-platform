import assert from "node:assert/strict";
import test from "node:test";
import { buildRedisClientOptions, readRedisConnectionConfigFromEnv } from "../../../src/platform/shared/utils/redis-client-options.js";
test("buildRedisClientOptions builds standalone redis options with bounded retry backoff", () => {
    const options = buildRedisClientOptions({
        host: "redis.internal",
        port: 6380,
        password: "secret",
        db: 2,
        retryBaseDelayMs: 50,
        retryMaxDelayMs: 500,
    });
    assert.equal(options.host, "redis.internal");
    assert.equal(options.port, 6380);
    assert.equal(options.password, "secret");
    assert.equal(options.db, 2);
    assert.equal(typeof options.retryStrategy, "function");
    const retryStrategy = options.retryStrategy;
    assert.equal(retryStrategy(1), 50);
    assert.equal(retryStrategy(4), 400);
    assert.equal(retryStrategy(8), 500);
    assert.equal(retryStrategy(9), null);
});
test("buildRedisClientOptions builds sentinel options when sentinel endpoints are configured", () => {
    const options = buildRedisClientOptions({
        mode: "sentinel",
        sentinelName: "aa-master",
        sentinels: [
            { host: "sentinel-1", port: 26379 },
            { host: "sentinel-2", port: 26379 },
        ],
        password: "redis-password",
        sentinelPassword: "sentinel-password",
    });
    assert.equal(options.name, "aa-master");
    assert.deepEqual(options.sentinels, [
        { host: "sentinel-1", port: 26379 },
        { host: "sentinel-2", port: 26379 },
    ]);
    assert.equal(options.password, "redis-password");
    assert.equal(options.sentinelPassword, "sentinel-password");
    assert.equal("host" in options, false);
});
test("buildRedisClientOptions rejects sentinel mode without a master name", () => {
    assert.throws(() => buildRedisClientOptions({
        mode: "sentinel",
        sentinels: [{ host: "sentinel-1", port: 26379 }],
    }), /redis\.sentinel_name_required/);
});
test("readRedisConnectionConfigFromEnv parses sentinel deployment settings", () => {
    const config = readRedisConnectionConfigFromEnv("AA_REDIS", {
        AA_REDIS_MODE: "sentinel",
        AA_REDIS_SENTINEL_NAME: "aa-master",
        AA_REDIS_SENTINELS: "sentinel-1:26379,sentinel-2:26379",
        AA_REDIS_PASSWORD: "redis-password",
        AA_REDIS_SENTINEL_PASSWORD: "sentinel-password",
        AA_REDIS_DB: "4",
        AA_REDIS_TLS: "true",
    });
    assert.deepEqual(config, {
        mode: "sentinel",
        sentinelName: "aa-master",
        sentinels: [
            { host: "sentinel-1", port: 26379 },
            { host: "sentinel-2", port: 26379 },
        ],
        password: "redis-password",
        sentinelPassword: "sentinel-password",
        db: 4,
        tls: true,
    });
});
test("readRedisConnectionConfigFromEnv returns null when no redis env is configured", () => {
    assert.equal(readRedisConnectionConfigFromEnv("AA_REDIS", {}), null);
});
test("readRedisConnectionConfigFromEnv rejects malformed sentinel endpoints", () => {
    assert.throws(() => readRedisConnectionConfigFromEnv("AA_REDIS", {
        AA_REDIS_MODE: "sentinel",
        AA_REDIS_SENTINELS: "sentinel-1:notaport",
    }), /redis\.sentinel_endpoint_invalid/);
});
//# sourceMappingURL=redis-client-options.test.js.map