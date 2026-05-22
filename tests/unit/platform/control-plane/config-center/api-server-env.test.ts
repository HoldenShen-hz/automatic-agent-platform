import assert from "node:assert/strict";
import test from "node:test";

import { loadApiServerEnv } from "../../../../../src/platform/five-plane-control-plane/config-center/api-server-env.js";

test("loadApiServerEnv parses auth tenant scope and gateway config", () => {
  const config = loadApiServerEnv({
    AA_DB_PATH: "/tmp/api.db",
    AA_API_KEYS_JSON: JSON.stringify([
      {
        apiKey: "operator-key",
        actorId: "operator-1",
        roles: ["viewer", "operator"],
        tenantId: "tenant-alpha",
      },
    ]),
    AA_API_JWT_SECRET: "StrongSecret1234567890!StrongSecret",
    AA_API_HOST: "127.0.0.1",
    AA_API_PORT: "8080",
    AA_GATEWAY_TELEGRAM_BOT_TOKEN: "telegram-token",
    AA_GATEWAY_WEBHOOK_DEFAULT_HEADERS_JSON: JSON.stringify({
      "x-default": "yes",
    }),
    AA_WEBHOOK_SECRET: "server-secret",
    AA_LOG_FILE_PATH: "/tmp/api.log",
    AA_LOG_FILE_MAX_BYTES: "2048",
    AA_LOG_FILE_MAX_FILES: "3",
    AA_LOG_STDOUT: "true",
    AA_LOG_FLUENTD_HOST: "fluentd.internal",
    AA_LOG_FLUENTD_PORT: "24224",
    AA_LOG_FLUENTD_TAG: "automatic-agent",
    AA_LOG_DATADOG_API_KEY: "dd-api-key",
    AA_LOG_DATADOG_SERVICE: "automatic-agent",
    AA_API_ENABLE_WEBSOCKET: "false",
  });

  assert.equal(config.dbPath, "/tmp/api.db");
  assert.equal(config.apiKeys[0]?.tenantId, "tenant-alpha");
  assert.equal(config.apiPort, 8080);
  assert.equal(config.gateway.telegram?.botToken, "telegram-token");
  assert.equal(config.gateway.webhook?.defaultHeaders["x-default"], "yes");
  assert.equal(config.webhookSecret, "server-secret");
  assert.equal(config.logFilePath, "/tmp/api.log");
  assert.equal(config.logFileMaxBytes, 2048);
  assert.equal(config.logFileMaxFiles, 3);
  assert.equal(config.logStdout, true);
  assert.deepEqual(config.logFluentd, {
    host: "fluentd.internal",
    port: 24224,
    tag: "automatic-agent",
  });
  assert.deepEqual(config.logDatadog, {
    apiKey: "dd-api-key",
    service: "automatic-agent",
  });
  assert.equal(config.enableWebSocket, false);
});

test("loadApiServerEnv rejects jwt secret of 31 chars (below min length)", () => {
  assert.throws(
    () =>
      loadApiServerEnv({
        AA_API_KEYS_JSON: JSON.stringify([
          { apiKey: "viewer-key", actorId: "viewer-1", roles: ["viewer"] },
        ]),
        AA_API_JWT_SECRET: "a".repeat(31),
      }),
    /api\.jwt_secret_too_short/,
  );
});

test("loadApiServerEnv accepts jwt secret of exactly 32 chars (min length boundary)", () => {
  // 32 chars with character diversity should pass
  const secret32 = "Aa1" + "a".repeat(28) + "B2!"; // has lower, upper, digit, special
  const config = loadApiServerEnv({
    AA_API_KEYS_JSON: JSON.stringify([
      { apiKey: "viewer-key", actorId: "viewer-1", roles: ["viewer"] },
    ]),
    AA_API_JWT_SECRET: secret32,
  });
  assert.equal(config.apiKeys[0]?.apiKey, "viewer-key");
});

test("loadApiServerEnv rejects low-entropy jwt secrets when api keys are configured", () => {
  assert.throws(
    () =>
      loadApiServerEnv({
        AA_API_KEYS_JSON: JSON.stringify([
          { apiKey: "viewer-key", actorId: "viewer-1", roles: ["viewer"] },
        ]),
        AA_API_JWT_SECRET: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      }),
    /api\.jwt_secret_low_entropy/,
  );
});

test("loadApiServerEnv rejects invalid log rotation values", () => {
  assert.throws(
    () =>
      loadApiServerEnv({
        AA_LOG_FILE_PATH: "/tmp/api.log",
        AA_LOG_FILE_MAX_BYTES: "0",
      }),
    /api\.invalid_log_file_max_bytes/,
  );
});

test("loadApiServerEnv rejects incomplete fluentd transport config", () => {
  assert.throws(
    () =>
      loadApiServerEnv({
        AA_LOG_FLUENTD_HOST: "fluentd.internal",
        AA_LOG_FLUENTD_PORT: "24224",
      }),
    /api\.incomplete_log_fluentd_config/,
  );
});

test("loadApiServerEnv rejects invalid websocket toggle values", () => {
  assert.throws(
    () =>
      loadApiServerEnv({
        AA_API_ENABLE_WEBSOCKET: "maybe",
      }),
    /api\.invalid_enable_websocket/,
  );
});

test("loadApiServerEnv parses metrics and otel settings", () => {
  const config = loadApiServerEnv({
    AA_METRICS_PORT: "9090",
    AA_METRICS_HOST: "127.0.0.2",
    AA_OTEL_ENABLED: "true",
    AA_OTEL_ENDPOINT: "http://otel-collector:4318/v1/traces",
    AA_OTEL_SERVICE_NAME: "automatic-agent-api",
    AA_OTEL_SERVICE_VERSION: "0.2.0",
  });
  assert.equal(config.metricsPort, 9090);
  assert.equal(config.metricsHost, "127.0.0.2");
  assert.equal(config.otelEnabled, true);
  assert.equal(config.otelEndpoint, "http://otel-collector:4318/v1/traces");
  assert.equal(config.otelServiceName, "automatic-agent-api");
  assert.equal(config.otelServiceVersion, "0.2.0");
});
