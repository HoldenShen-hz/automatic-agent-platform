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

test("readRedisConnectionConfigFromEnv parses DB, LAZY_CONNECT, ENABLE_OFFLINE_QUEUE", () => {
  const result = readRedisConnectionConfigFromEnv("R", {
    R_HOST: "localhost",
    R_PORT: "6379",
    R_DB: "2",
    R_LAZY_CONNECT: "true",
    R_ENABLE_OFFLINE_QUEUE: "false",
  });
  assert.strictEqual(result?.db, 2);
  assert.strictEqual(result?.lazyConnect, true);
  assert.strictEqual(result?.enableOfflineQueue, false);
});

test("readRedisConnectionConfigFromEnv parses RETRY_BASE_DELAY_MS and RETRY_MAX_DELAY_MS", () => {
  const result = readRedisConnectionConfigFromEnv("R", {
    R_HOST: "localhost",
    R_RETRY_BASE_DELAY_MS: "200",
    R_RETRY_MAX_DELAY_MS: "5000",
  });
  assert.strictEqual(result?.retryBaseDelayMs, 200);
  assert.strictEqual(result?.retryMaxDelayMs, 5000);
});

test("readRedisConnectionConfigFromEnv parses MAX_RETRIES_PER_REQUEST null string", () => {
  const result = readRedisConnectionConfigFromEnv("R", {
    R_HOST: "localhost",
    R_MAX_RETRIES_PER_REQUEST: "null",
  });
  assert.strictEqual(result?.maxRetriesPerRequest, null);
});

test("readRedisConnectionConfigFromEnv handles empty string values as absent", () => {
  const result = readRedisConnectionConfigFromEnv("R", {
    R_HOST: "   ",
    R_PORT: "",
  });
  assert.strictEqual(result, null);
});

test("readRedisConnectionConfigFromEnv sentinelPassword is parsed", () => {
  const result = readRedisConnectionConfigFromEnv("R", {
    R_SENTINELS: "s1:26379",
    R_SENTINEL_NAME: "mymaster",
    R_SENTINEL_PASSWORD: "sentinel-secret",
  });
  assert.strictEqual(result?.sentinelPassword, "sentinel-secret");
});

test("readRedisConnectionConfigFromEnv parseSentinelEndpoints throws on invalid endpoint format", () => {
  assert.throws(
    () => readRedisConnectionConfigFromEnv("R", { R_SENTINELS: "invalid-endpoint" }),
    /redis.sentinel_endpoint_invalid/,
  );
});

test("readRedisConnectionConfigFromEnv parseSentinelEndpoints throws on missing port", () => {
  assert.throws(
    () => readRedisConnectionConfigFromEnv("R", { R_SENTINELS: "host-without-port" }),
    /redis.sentinel_endpoint_invalid/,
  );
});

test("readRedisConnectionConfigFromEnv mode falls back to sentinel when sentinels present", () => {
  const result = readRedisConnectionConfigFromEnv("R", {
    R_SENTINELS: "s1:26379",
    R_SENTINEL_NAME: "mymaster",
  });
  assert.strictEqual(result?.mode, "sentinel");
});

test("readRedisConnectionConfigFromEnv mode falls back to standalone when no mode or sentinels", () => {
  const result = readRedisConnectionConfigFromEnv("R", {
    R_HOST: "localhost",
    R_PORT: "6379",
  });
  assert.strictEqual(result?.mode, undefined);
});

test("buildRedisClientOptions applies retry base and max delay via config", () => {
  const config: RedisConnectionConfig = {
    host: "localhost",
    port: 6379,
    retryBaseDelayMs: 50,
    retryMaxDelayMs: 10_000,
  };
  const options = buildRedisClientOptions(config);
  const retryStrategy = options.retryStrategy as (times: number) => number | null;
  // With base 50ms, exponential backoff: 50, 100, 200, 400, 800, 1600, 3200, 6400
  assert.strictEqual(retryStrategy(1), 50);
  assert.strictEqual(retryStrategy(4), 400);
  assert.strictEqual(retryStrategy(5), 800);
});

test("buildRedisClientOptions sentinelPassword is included in options", () => {
  const config: RedisConnectionConfig = {
    mode: "sentinel",
    sentinelName: "mymaster",
    sentinels: [{ host: "s1", port: 26379 }],
    sentinelPassword: "secret",
  };
  const options = buildRedisClientOptions(config);
  assert.strictEqual(options.sentinelPassword, "secret");
});

test("buildRedisClientOptions tls enabled produces empty object", () => {
  const config: RedisConnectionConfig = { host: "localhost", port: 6379, tls: true };
  const options = buildRedisClientOptions(config);
  assert.deepStrictEqual(options.tls, {});
});

test("buildRedisClientOptions tls disabled produces undefined", () => {
  const config: RedisConnectionConfig = { host: "localhost", port: 6379, tls: false };
  const options = buildRedisClientOptions(config);
  assert.strictEqual(options.tls, undefined);
});
