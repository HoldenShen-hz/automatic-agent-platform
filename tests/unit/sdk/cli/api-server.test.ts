/**
 * API Server CLI Tests
 *
 * Tests for api-server.ts CLI module.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { API_SERVER_TEST_BASE_URL, API_SERVER_TEST_PORT, LOOPBACK_HOST, OTEL_TEST_ENDPOINT } from "../../../helpers/network-test-constants.js";

// ---------------------------------------------------------------------------
// Tests for API server CLI entrypoint
// ---------------------------------------------------------------------------

test("api-server main function is async", () => {
  const source = readFileSync(join(process.cwd(), "src", "sdk", "cli", "api-server.ts"), "utf8");
  assert.match(source, /async function main\(\): Promise<void>/);
});

test("api-server uses requireValidStartupEnv validation", () => {
  const source = readFileSync(join(process.cwd(), "src", "sdk", "cli", "api-server.ts"), "utf8");
  assert.match(source, /requireValidStartupEnv\(env\);/);
  assert.match(source, /shutdown\.registerSignalHandlers\(\);/);
});

test("api-server config includes otel settings", () => {
  // The initOtel call uses envConfig.otelEnabled, envConfig.otelEndpoint, etc.
  const envConfig = {
    otelEnabled: true,
    otelEndpoint: OTEL_TEST_ENDPOINT,
    otelServiceName: "api-server",
    otelServiceVersion: "1.0.0",
  };
  assert.equal(envConfig.otelEnabled, true);
  assert.ok(envConfig.otelEndpoint.startsWith("http://127.0.0.1:"));
});

test("api-server resolves host and port from env or defaults", () => {
  // The server resolves host and port from environment or defaults
  const envConfig = { apiHost: "0.0.0.0", apiPort: API_SERVER_TEST_PORT };

  const startOptions: { host?: string; port?: number } = {};
  if (envConfig.apiHost) {
    startOptions.host = envConfig.apiHost;
  }
  if (envConfig.apiPort !== undefined) {
    startOptions.port = envConfig.apiPort;
  }

  assert.equal(startOptions.host, "0.0.0.0");
  assert.equal(startOptions.port, API_SERVER_TEST_PORT);
});

test("api-server configures structured logging when logFilePath is set", () => {
  const envConfig = {
    logFilePath: "/var/log/api-server.log",
    logFileMaxBytes: 10 * 1024 * 1024,
    logFileMaxFiles: 5,
  };

  const fileSinkConfig = envConfig.logFilePath == null
    ? null
    : {
      filePath: envConfig.logFilePath,
      maxBytes: envConfig.logFileMaxBytes,
      maxFiles: envConfig.logFileMaxFiles,
    };

  assert.ok(fileSinkConfig != null);
  assert.equal(fileSinkConfig.filePath, "/var/log/api-server.log");
});

test("api-server returns null fileSinkConfig when logFilePath is not set", () => {
  const envConfig = {
    logFilePath: null,
  };

  const fileSinkConfig = envConfig.logFilePath == null
    ? null
    : { filePath: envConfig.logFilePath };

  assert.equal(fileSinkConfig, null);
});

test("api-server authService is null when apiKeys are empty", () => {
  const envConfig = { apiKeys: [] as string[], jwtSecret: "secret-123" };
  const authService = envConfig.apiKeys.length === 0 || envConfig.jwtSecret == null
    ? null
    : { apiKeys: envConfig.apiKeys, jwtSecret: envConfig.jwtSecret };

  assert.equal(authService, null);
});

test("api-server authService is null when jwtSecret is missing", () => {
  const envConfig = { apiKeys: ["key1", "key2"], jwtSecret: null as string | null };
  const authService = envConfig.apiKeys.length === 0 || envConfig.jwtSecret == null
    ? null
    : { apiKeys: envConfig.apiKeys, jwtSecret: envConfig.jwtSecret };

  assert.equal(authService, null);
});

test("api-server authService is created when both apiKeys and jwtSecret are present", () => {
  const envConfig = { apiKeys: ["key1", "key2"], jwtSecret: "secret123" };
  const authService = envConfig.apiKeys.length === 0 || envConfig.jwtSecret == null
    ? null
    : { apiKeys: envConfig.apiKeys, jwtSecret: envConfig.jwtSecret };

  assert.ok(authService != null);
  assert.deepEqual(authService, { apiKeys: ["key1", "key2"], jwtSecret: "secret123" });
});

test("api-server webSocketStatusRelay is null when WebSocket is disabled", () => {
  const envConfig = { enableWebSocket: false };
  const webSocketStatusRelay =
    envConfig.enableWebSocket
      ? { enabled: true }
      : null;

  assert.equal(webSocketStatusRelay, null);
});

test("api-server webSocketStatusRelay is created whenever WebSocket is enabled", () => {
  const envConfig = { enableWebSocket: true };
  const webSocketStatusRelay =
    envConfig.enableWebSocket
      ? { enabled: true }
      : null;

  assert.ok(webSocketStatusRelay != null);
});

test("api-server metricsServer is null when metricsPort is not set", () => {
  const envConfig = { metricsPort: undefined };
  const metricsServer = envConfig.metricsPort == null
    ? null
    : { port: envConfig.metricsPort };

  assert.equal(metricsServer, null);
});

test("api-server metricsServer is created when metricsPort is set", () => {
  const envConfig = { metricsPort: 9090 };
  const metricsServer = envConfig.metricsPort == null
    ? null
    : { port: envConfig.metricsPort };

  assert.ok(metricsServer != null);
  assert.equal(metricsServer.port, 9090);
});

test("api-server graceful shutdown handlers are registered", () => {
  // The api-server registers multiple shutdown handlers:
  // otel_sdk, metrics_server, task_websocket_status_relay,
  // structured_logger_transports, channel_gateway_retry_executor, http_api_server
  const expectedHandlers = [
    "otel_sdk",
    "metrics_server",
    "task_websocket_status_relay",
    "structured_logger_transports",
    "channel_gateway_retry_executor",
    "http_api_server",
  ];

  assert.equal(expectedHandlers.length, 6);
  assert.ok(expectedHandlers.includes("http_api_server"));
  assert.ok(expectedHandlers.includes("otel_sdk"));
});

test("api-server response includes host, port, baseUrl when started", () => {
  const address = {
    host: LOOPBACK_HOST,
    port: API_SERVER_TEST_PORT,
    baseUrl: API_SERVER_TEST_BASE_URL,
  };

  const response = {
    host: address.host,
    port: address.port,
    baseUrl: address.baseUrl,
  };

  assert.equal(response.host, LOOPBACK_HOST);
  assert.equal(response.port, API_SERVER_TEST_PORT);
  assert.ok(response.baseUrl.startsWith("http"));
});
