import assert from "node:assert/strict";
import test from "node:test";

import {
  readRedisConnectionConfigFromEnv,
  buildRedisClientOptions,
  type RedisConnectionConfig,
} from "../../../../../src/platform/shared/utils/redis-client-options.js";

test("Utils integration: full standalone connection config flow", () => {
  const env = {
    REDIS_HOST: "redis-prod.example.com",
    REDIS_PORT: "6380",
    REDIS_PASSWORD: "prod-secret",
    REDIS_DB: "1",
    REDIS_TLS: "true",
    REDIS_LAZY_CONNECT: "true",
    REDIS_ENABLE_OFFLINE_QUEUE: "false",
    REDIS_CONNECT_TIMEOUT_MS: "10000",
    REDIS_MAX_RETRIES_PER_REQUEST: "5",
    REDIS_RETRY_BASE_DELAY_MS: "150",
    REDIS_RETRY_MAX_DELAY_MS: "8000",
  };

  const config = readRedisConnectionConfigFromEnv("REDIS", env);
  assert.ok(config !== null, "Config should not be null");

  const options = buildRedisClientOptions(config);

  assert.strictEqual(options.host, "redis-prod.example.com");
  assert.strictEqual(options.port, 6380);
  assert.strictEqual(options.password, "prod-secret");
  assert.strictEqual(options.db, 1);
  assert.deepStrictEqual(options.tls, {});
  assert.strictEqual(options.lazyConnect, true);
  assert.strictEqual(options.enableOfflineQueue, false);
  assert.strictEqual(options.connectTimeout, 10000);
  assert.strictEqual(options.maxRetriesPerRequest, 5);
});

test("Utils integration: full sentinel connection config flow", () => {
  const env = {
    CACHE_MODE: "sentinel",
    CACHE_SENTINEL_NAME: "mymaster",
    CACHE_SENTINELS: "sentinel-1:26379,sentinel-2:26379,sentinel-3:26379",
    CACHE_SENTINEL_PASSWORD: "sentinel-pass",
    CACHE_HOST: "localhost",
    CACHE_PORT: "6379",
    CACHE_TLS: "true",
  };

  const config = readRedisConnectionConfigFromEnv("CACHE", env);
  assert.ok(config !== null, "Config should not be null");
  assert.strictEqual(config.mode, "sentinel");
  assert.strictEqual(config.sentinelName, "mymaster");
  assert.strictEqual(config.sentinelPassword, "sentinel-pass");
  assert.strictEqual(config.sentinels?.length, 3);
  assert.ok(config.sentinels?.[0]);
  assert.strictEqual(config.sentinels[0].host, "sentinel-1");
  assert.strictEqual(config.sentinels[0].port, 26379);

  const options = buildRedisClientOptions(config);

  assert.deepStrictEqual(options.sentinels, [
    { host: "sentinel-1", port: 26379 },
    { host: "sentinel-2", port: 26379 },
    { host: "sentinel-3", port: 26379 },
  ]);
  assert.strictEqual(options.name, "mymaster");
  assert.strictEqual(options.sentinelPassword, "sentinel-pass");
  assert.deepStrictEqual(options.tls, {});
});

test("Utils integration: sentinel mode detected from sentinels presence", () => {
  const env = {
    CACHE_SENTINELS: "s1:26379,s2:26379",
    CACHE_SENTINEL_NAME: "mymaster",
  };

  const config = readRedisConnectionConfigFromEnv("CACHE", env);
  assert.ok(config !== null);
  assert.strictEqual(config.mode, "sentinel");

  const options = buildRedisClientOptions(config);
  assert.deepStrictEqual(options.sentinels, [{ host: "s1", port: 26379 }, { host: "s2", port: 26379 }]);
  assert.strictEqual(options.name, "mymaster");
});

test("Utils integration: minimal config uses defaults", () => {
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
  assert.strictEqual(options.tls, undefined);
});

test("Utils integration: override defaults via buildRedisClientOptions", () => {
  const config: RedisConnectionConfig = {
    host: "localhost",
    port: 6379,
    retryBaseDelayMs: 200,
    retryMaxDelayMs: 10000,
  };

  const options = buildRedisClientOptions(config, {
    connectTimeout: 20000,
    maxRetriesPerRequest: 10,
    lazyConnect: false,
  });

  assert.strictEqual(options.connectTimeout, 20000);
  assert.strictEqual(options.maxRetriesPerRequest, 10);
  assert.strictEqual(options.lazyConnect, false);
  const retryStrategy = options.retryStrategy as (times: number) => number | null;
  assert.strictEqual(retryStrategy(1), 200);
  // times=8: 200 * 2^7 = 25600, capped at maxDelayMs=10000
  assert.strictEqual(retryStrategy(8), 10000);
});

test("Utils integration: retryStrategy exponential backoff", () => {
  const config: RedisConnectionConfig = {
    host: "localhost",
    port: 6379,
    retryBaseDelayMs: 100,
    retryMaxDelayMs: 2000,
  };

  const options = buildRedisClientOptions(config);
  const retryStrategy = options.retryStrategy as (times: number) => number | null;

  assert.strictEqual(retryStrategy(0), 100);
  assert.strictEqual(retryStrategy(1), 100);
  assert.strictEqual(retryStrategy(2), 200);
  assert.strictEqual(retryStrategy(3), 400);
  assert.strictEqual(retryStrategy(4), 800);
  assert.strictEqual(retryStrategy(5), 1600);
  assert.strictEqual(retryStrategy(6), 2000);
  assert.strictEqual(retryStrategy(7), 2000);
  assert.strictEqual(retryStrategy(8), 2000);
  // null is only returned when times > 8
  assert.strictEqual(retryStrategy(9), null);
});

test("Utils integration: sentinel with tls enabled", () => {
  const env = {
    CACHE_MODE: "sentinel",
    CACHE_SENTINEL_NAME: "mymaster",
    CACHE_SENTINELS: "s1:26379",
    CACHE_TLS: "true",
  };

  const config = readRedisConnectionConfigFromEnv("CACHE", env);
  assert.ok(config !== null);
  const options = buildRedisClientOptions(config);

  assert.deepStrictEqual(options.tls, {});
  assert.deepStrictEqual(options.sentinels, [{ host: "s1", port: 26379 }]);
});

test("Utils integration: standalone with all boolean variations", () => {
  const booleanFields = [
    { envKey: "R_TLS", configKey: "tls" },
    { envKey: "R_LAZY_CONNECT", configKey: "lazyConnect" },
    { envKey: "R_ENABLE_OFFLINE_QUEUE", configKey: "enableOfflineQueue" },
  ];

  const truthyValues = ["1", "true", "yes", "on"];
  const falsyValues = ["0", "false", "no", "off"];

  for (const { envKey, configKey } of booleanFields) {
    for (const val of truthyValues) {
      const result = readRedisConnectionConfigFromEnv("R", { [`R_HOST`]: "localhost", [envKey]: val });
      assert.strictEqual(result?.[configKey as keyof typeof result], true, `Expected true for ${envKey}=${val}`);
    }
    for (const val of falsyValues) {
      const result = readRedisConnectionConfigFromEnv("R", { [`R_HOST`]: "localhost", [envKey]: val });
      assert.strictEqual(result?.[configKey as keyof typeof result], false, `Expected false for ${envKey}=${val}`);
    }
  }
});

test("Utils integration: MAX_RETRIES_PER_REQUEST null defaults to 3", () => {
  const config: RedisConnectionConfig = {
    host: "localhost",
    port: 6379,
    maxRetriesPerRequest: null,
  };

  const options = buildRedisClientOptions(config);
  // null is treated as undefined by ??, so defaults to 3
  assert.strictEqual(options.maxRetriesPerRequest, 3);
});

test("Utils integration: empty prefix returns null", () => {
  const result = readRedisConnectionConfigFromEnv("", {});
  assert.strictEqual(result, null);
});

test("Utils integration: whitespace-only values treated as absent", () => {
  const result = readRedisConnectionConfigFromEnv("R", {
    R_HOST: "   ",
    R_PORT: "",
  });
  assert.strictEqual(result, null);
});

test("Utils integration: real-world multi-region sentinel config", () => {
  const env = {
    CACHE_MODE: "sentinel",
    CACHE_SENTINEL_NAME: "primary",
    CACHE_SENTINELS: "us-east-1:26379,us-west-2:26379,eu-west-1:26379",
    CACHE_SENTINEL_PASSWORD: "cross-region-secret",
    CACHE_RETRY_BASE_DELAY_MS: "250",
    CACHE_RETRY_MAX_DELAY_MS: "15000",
  };

  const config = readRedisConnectionConfigFromEnv("CACHE", env);
  assert.ok(config !== null);
  assert.strictEqual(config.sentinels?.length, 3);

  const options = buildRedisClientOptions(config);
  const retryStrategy = options.retryStrategy as (times: number) => number | null;

  assert.strictEqual(retryStrategy(1), 250);
  // times=6: 250 * 2^5 = 8000 (not capped by 15000)
  assert.strictEqual(retryStrategy(6), 8000);
  assert.strictEqual(options.sentinelPassword, "cross-region-secret");
});
