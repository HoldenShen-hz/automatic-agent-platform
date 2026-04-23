import assert from "node:assert/strict";
import test from "node:test";

import {
  readRedisConnectionConfigFromEnv,
  buildRedisClientOptions,
  type RedisConnectionConfig,
} from "../../../../../src/platform/shared/utils/redis-client-options.js";

test("readRedisConnectionConfigFromEnv returns null when no env vars present", () => {
  const result = readRedisConnectionConfigFromEnv("REDIS", {});
  assert.strictEqual(result, null);
});

test("readRedisConnectionConfigFromEnv parses standalone config from env", () => {
  const result = readRedisConnectionConfigFromEnv("REDIS", {
    REDIS_HOST: "  redis.example.com  ",
    REDIS_PORT: "6379",
    REDIS_PASSWORD: "secret",
    REDIS_TLS: "true",
    REDIS_CONNECT_TIMEOUT_MS: "3000",
  });
  assert.deepStrictEqual(result, {
    host: "redis.example.com",
    port: 6379,
    password: "secret",
    tls: true,
    connectTimeout: 3000,
  });
});

test("readRedisConnectionConfigFromEnv parses sentinel config from env", () => {
  const result = readRedisConnectionConfigFromEnv("CACHE", {
    CACHE_MODE: "sentinel",
    CACHE_SENTINEL_NAME: "mymaster",
    CACHE_SENTINELS: "sentinel1:26379,sentinel2:26379,sentinel3:26379",
    CACHE_SENTINEL_PASSWORD: "sentinel-secret",
    CACHE_HOST: "localhost",
    CACHE_PORT: "6379",
  });
  assert.deepStrictEqual(result, {
    mode: "sentinel",
    sentinelName: "mymaster",
    sentinels: [
      { host: "sentinel1", port: 26379 },
      { host: "sentinel2", port: 26379 },
      { host: "sentinel3", port: 26379 },
    ],
    sentinelPassword: "sentinel-secret",
    host: "localhost",
    port: 6379,
  });
});

test("readRedisConnectionConfigFromEnv handles boolean parsing", () => {
  const truthyValues = ["1", "true", "yes", "on"];
  const falsyValues = ["0", "false", "no", "off"];

  for (const val of truthyValues) {
    const result = readRedisConnectionConfigFromEnv("R", { R_TLS: val, R_HOST: "localhost" });
    assert.strictEqual(result?.tls, true, `Expected true for ${val}`);
  }
  for (const val of falsyValues) {
    const result = readRedisConnectionConfigFromEnv("R", { R_TLS: val, R_HOST: "localhost" });
    assert.strictEqual(result?.tls, false, `Expected false for ${val}`);
  }
});

test("readRedisConnectionConfigFromEnv handles sentinel detection from sentinels presence", () => {
  const result = readRedisConnectionConfigFromEnv("R", {
    R_SENTINELS: "s1:26379",
    R_SENTINEL_NAME: "mymaster",
  });
  assert.strictEqual(result?.mode, "sentinel");
});

test("buildRedisClientOptions returns standalone options for default config", () => {
  const config: RedisConnectionConfig = {
    host: "localhost",
    port: 6379,
  };
  const options = buildRedisClientOptions(config);
  assert.strictEqual(options.host, "localhost");
  assert.strictEqual(options.port, 6379);
  assert.strictEqual(options.db, 0);
  assert.strictEqual(options.lazyConnect, true);
  assert.strictEqual(options.enableOfflineQueue, false);
  assert.strictEqual(options.maxRetriesPerRequest, 3);
  assert.strictEqual(options.connectTimeout, 5000);
  assert.ok(typeof options.retryStrategy === "function");
});

test("buildRedisClientOptions returns sentinel options for sentinel config", () => {
  const config: RedisConnectionConfig = {
    mode: "sentinel",
    sentinelName: "mymaster",
    sentinels: [
      { host: "sentinel1", port: 26379 },
      { host: "sentinel2", port: 26379 },
    ],
    sentinelPassword: "secret",
  };
  const options = buildRedisClientOptions(config);
  assert.deepStrictEqual(options.sentinels, [
    { host: "sentinel1", port: 26379 },
    { host: "sentinel2", port: 26379 },
  ]);
  assert.strictEqual(options.name, "mymaster");
  assert.strictEqual(options.sentinelPassword, "secret");
});

test("buildRedisClientOptions throws ValidationError for sentinel without endpoints", () => {
  const config: RedisConnectionConfig = {
    mode: "sentinel",
    sentinelName: "mymaster",
    sentinels: [],
  };
  assert.throws(
    () => buildRedisClientOptions(config),
    /redis.sentinel_endpoints_required/,
  );
});

test("buildRedisClientOptions throws ValidationError for sentinel without name", () => {
  const config: RedisConnectionConfig = {
    mode: "sentinel",
    sentinelName: "",
    sentinels: [{ host: "s1", port: 26379 }],
  };
  assert.throws(
    () => buildRedisClientOptions(config),
    /redis.sentinel_name_required/,
  );
});

test("buildRedisClientOptions applies overrides", () => {
  const config: RedisConnectionConfig = {
    host: "localhost",
    port: 6379,
  };
  const options = buildRedisClientOptions(config, {
    connectTimeout: 10000,
    maxRetriesPerRequest: 5,
  });
  assert.strictEqual(options.connectTimeout, 10000);
  assert.strictEqual(options.maxRetriesPerRequest, 5);
});

test("buildRedisClientOptions retryStrategy returns null after 8 attempts", () => {
  const config: RedisConnectionConfig = { host: "localhost", port: 6379 };
  const options = buildRedisClientOptions(config);
  const retryStrategy = options.retryStrategy as (times: number) => number | null;
  assert.strictEqual(retryStrategy(9), null);
  assert.strictEqual(retryStrategy(1), 100);
  assert.strictEqual(retryStrategy(2), 200);
  assert.strictEqual(retryStrategy(3), 400);
});
