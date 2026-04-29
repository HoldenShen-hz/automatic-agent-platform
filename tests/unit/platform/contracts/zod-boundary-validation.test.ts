import test from "node:test";
import assert from "node:assert/strict";
import {
  validateStartupEnv,
  StartupEnvSchema,
  DbPathSchema,
  ConfigEnvSchema,
  ApiPortSchema,
  PositiveInteger,
  LogLevelSchema,
  BooleanString,
  StorageDriverSchema,
  PluginRuntimeIsolationSchema,
} from "../../../../src/platform/five-plane-control-plane/config-center/startup-env-schema.js";

test("validateStartupEnv accepts valid minimal configuration", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/var/lib/aa/data.db",
    AA_CONFIG_ENV: "prod",
  });

  assert.equal(result.success, true);
  assert.equal(result.errors.length, 0);
  assert.notEqual(result.parsed, undefined);
  assert.equal(result.parsed!.AA_DB_PATH, "/var/lib/aa/data.db");
  assert.equal(result.parsed!.AA_CONFIG_ENV, "prod");
});

test("validateStartupEnv accepts all valid environment names", () => {
  const validEnvs = ["dev", "test", "staging", "pre-prod", "prod", "development", "production"];

  for (const envName of validEnvs) {
    const result = validateStartupEnv({
      AA_DB_PATH: "/var/lib/aa/data.db",
      AA_CONFIG_ENV: envName,
    });
    assert.equal(result.success, true, `Expected ${envName} to be valid`);
  }
});

test("validateStartupEnv rejects invalid environment names", () => {
  const invalidEnvs = ["development2", "production2", "invalid", "DEBUG", ""];

  for (const envName of invalidEnvs) {
    const result = validateStartupEnv({
      AA_DB_PATH: "/var/lib/aa/data.db",
      AA_CONFIG_ENV: envName,
    });
    assert.equal(result.success, false, `Expected ${envName} to be invalid`);
    assert.ok(result.errors.length > 0, `Expected errors for ${envName}`);
  }
});

test("validateStartupEnv rejects empty string for required AA_DB_PATH", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "",
    AA_CONFIG_ENV: "prod",
  });

  assert.equal(result.success, false);
  assert.ok(result.errors.some((e) => e.key === "AA_DB_PATH"), "Expected error for AA_DB_PATH");
});

test("validateStartupEnv rejects missing AA_DB_PATH", () => {
  const result = validateStartupEnv({
    AA_CONFIG_ENV: "prod",
  });

  assert.equal(result.success, false);
  assert.ok(result.errors.some((e) => e.key === "AA_DB_PATH"), "Expected error for missing AA_DB_PATH");
});

test("validateStartupEnv rejects invalid port numbers", () => {
  const invalidPorts = ["0", "-1", "65536", "99999", "abc", ""];

  for (const port of invalidPorts) {
    const result = validateStartupEnv({
      AA_DB_PATH: "/var/lib/aa/data.db",
      AA_API_PORT: port,
    });
    assert.equal(result.success, false, `Expected port ${port} to be invalid`);
  }
});

test("validateStartupEnv accepts valid port numbers", () => {
  const validPorts = ["1", "80", "443", "8080", "3000", "65535"];

  for (const port of validPorts) {
    const result = validateStartupEnv({
      AA_DB_PATH: "/var/lib/aa/data.db",
      AA_API_PORT: port,
    });
    assert.equal(result.success, true, `Expected port ${port} to be valid`);
  }
});

test("validateStartupEnv rejects non-positive integers for resource limits", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/var/lib/aa/data.db",
    AA_MAX_AGENT_TOOL_CALLS: "0",
  });

  assert.equal(result.success, false);
  assert.ok(
    result.errors.some((e) => e.key === "AA_MAX_AGENT_TOOL_CALLS"),
    "Expected error for AA_MAX_AGENT_TOOL_CALLS=0",
  );
});

test("validateStartupEnv accepts valid resource limit values", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/var/lib/aa/data.db",
    AA_MAX_AGENT_TOOL_CALLS: "100",
    AA_MAX_AGENT_MEMORY_MB: "512",
    AA_MAX_AGENT_ELAPSED_MS: "3600000",
  });

  assert.equal(result.success, true);
});

test("validateStartupEnv accepts null for nullable resource limits", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/var/lib/aa/data.db",
    AA_MAX_AGENT_TOOL_CALLS: null,
    AA_MAX_AGENT_MEMORY_MB: null,
    AA_MAX_AGENT_ELAPSED_MS: null,
  });

  assert.equal(result.success, true);
  assert.equal(result.parsed!.AA_MAX_AGENT_TOOL_CALLS, null);
});

test("validateStartupEnv rejects invalid log levels", () => {
  const invalidLevels = ["trace2", "debug2", "info2", "warning", "err", ""];

  for (const level of invalidLevels) {
    const result = validateStartupEnv({
      AA_DB_PATH: "/var/lib/aa/data.db",
      AA_LOG_LEVEL: level,
    });
    assert.equal(result.success, false, `Expected log level ${level} to be invalid`);
  }
});

test("validateStartupEnv accepts valid log levels", () => {
  const validLevels = ["trace", "debug", "info", "warn", "error", "fatal"];

  for (const level of validLevels) {
    const result = validateStartupEnv({
      AA_DB_PATH: "/var/lib/aa/data.db",
      AA_LOG_LEVEL: level,
    });
    assert.equal(result.success, true, `Expected log level ${level} to be valid`);
  }
});

test("validateStartupEnv rejects invalid boolean strings", () => {
  const invalidBools = ["truee", "falsee", "yesy", "non", "onon", "offoff", "2", ""];

  for (const bool of invalidBools) {
    const result = validateStartupEnv({
      AA_DB_PATH: "/var/lib/aa/data.db",
      AA_LOG_STDOUT: bool,
    });
    assert.equal(result.success, false, `Expected boolean ${bool} to be invalid`);
  }
});

test("validateStartupEnv accepts valid boolean strings", () => {
  const validBools = ["1", "true", "yes", "on", "0", "false", "no", "off"];

  for (const bool of validBools) {
    const result = validateStartupEnv({
      AA_DB_PATH: "/var/lib/aa/data.db",
      AA_LOG_STDOUT: bool,
    });
    assert.equal(result.success, true, `Expected boolean ${bool} to be valid`);
  }
});

test("validateStartupEnv rejects invalid storage driver", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/var/lib/aa/data.db",
    AA_STORAGE_DRIVER: "mysql",
  });

  assert.equal(result.success, false);
  assert.ok(result.errors.some((e) => e.key === "AA_STORAGE_DRIVER"), "Expected error for AA_STORAGE_DRIVER");
});

test("validateStartupEnv accepts valid storage drivers", () => {
  const sqliteResult = validateStartupEnv({
    AA_DB_PATH: "/var/lib/aa/data.db",
    AA_STORAGE_DRIVER: "sqlite",
  });
  assert.equal(sqliteResult.success, true, "Expected storage driver sqlite to be valid");

  const postgresResult = validateStartupEnv({
    AA_DB_PATH: "/var/lib/aa/data.db",
    AA_STORAGE_DRIVER: "postgres",
    AA_STORAGE_POSTGRES_DSN: "postgresql://localhost:5432/aa",
  });
  assert.equal(postgresResult.success, true, "Expected storage driver postgres to be valid");
});

test("validateStartupEnv requires AA_STORAGE_POSTGRES_DSN when AA_STORAGE_DRIVER is postgres", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/var/lib/aa/data.db",
    AA_STORAGE_DRIVER: "postgres",
  });

  assert.equal(result.success, false);
  assert.ok(
    result.errors.some((e) => e.key === "AA_STORAGE_POSTGRES_DSN"),
    "Expected error for missing AA_STORAGE_POSTGRES_DSN",
  );
});

test("validateStartupEnv accepts AA_STORAGE_POSTGRES_DSN when AA_STORAGE_DRIVER is postgres", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/var/lib/aa/data.db",
    AA_STORAGE_DRIVER: "postgres",
    AA_STORAGE_POSTGRES_DSN: "postgresql://localhost:5432/aa",
  });

  assert.equal(result.success, true);
});

test("validateStartupEnv accepts AA_PG_DSN as alternative to AA_STORAGE_POSTGRES_DSN", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/var/lib/aa/data.db",
    AA_STORAGE_DRIVER: "postgres",
    AA_PG_DSN: "postgresql://localhost:5432/aa",
  });

  assert.equal(result.success, true);
});

test("validateStartupEnv rejects invalid plugin runtime isolation", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/var/lib/aa/data.db",
    AA_PLUGIN_RUNTIME_ISOLATION: "invalid_isolation",
  });

  assert.equal(result.success, false);
  assert.ok(
    result.errors.some((e) => e.key === "AA_PLUGIN_RUNTIME_ISOLATION"),
    "Expected error for AA_PLUGIN_RUNTIME_ISOLATION",
  );
});

test("validateStartupEnv accepts valid plugin runtime isolation modes", () => {
  const validModes = [
    "shared_process",
    "serialized_in_process",
    "forked_process",
    "sandboxed_process",
    "containerized_process",
  ];

  for (const mode of validModes) {
    const result = validateStartupEnv({
      AA_DB_PATH: "/var/lib/aa/data.db",
      AA_PLUGIN_RUNTIME_ISOLATION: mode,
    });
    assert.equal(result.success, true, `Expected isolation mode ${mode} to be valid`);
  }
});

test("validateStartupEnv requires AA_PLUGIN_SANDBOX_ROOT when AA_PLUGIN_ALLOW_NETWORK_EGRESS is set", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/var/lib/aa/data.db",
    AA_PLUGIN_ALLOW_NETWORK_EGRESS: "true",
  });

  assert.equal(result.success, false);
  assert.ok(
    result.errors.some((e) => e.key === "AA_PLUGIN_SANDBOX_ROOT"),
    "Expected error for missing AA_PLUGIN_SANDBOX_ROOT",
  );
});

test("validateStartupEnv accepts AA_PLUGIN_SANDBOX_ROOT when AA_PLUGIN_ALLOW_NETWORK_EGRESS is set", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/var/lib/aa/data.db",
    AA_PLUGIN_ALLOW_NETWORK_EGRESS: "true",
    AA_PLUGIN_SANDBOX_ROOT: "/opt/aa/plugins",
  });

  assert.equal(result.success, true);
});

test("validateStartupEnv requires AA_LOG_FILE_PATH when AA_LOG_FILE_MAX_BYTES is set", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/var/lib/aa/data.db",
    AA_LOG_FILE_MAX_BYTES: "10485760",
  });

  assert.equal(result.success, false);
  assert.ok(
    result.errors.some((e) => e.key === "AA_LOG_FILE_PATH"),
    "Expected error for missing AA_LOG_FILE_PATH",
  );
});

test("validateStartupEnv accepts AA_LOG_FILE_PATH when AA_LOG_FILE_MAX_BYTES is set", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/var/lib/aa/data.db",
    AA_LOG_FILE_MAX_BYTES: "10485760",
    AA_LOG_FILE_PATH: "/var/log/aa/app.log",
  });

  assert.equal(result.success, true);
});

test("validateStartupEnv rejects invalid JSON for AA_API_KEYS_JSON", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/var/lib/aa/data.db",
    AA_API_KEYS_JSON: "not valid json",
  });

  assert.equal(result.success, false);
  assert.ok(result.errors.some((e) => e.key === "AA_API_KEYS_JSON"), "Expected error for invalid JSON");
});

test("validateStartupEnv accepts valid JSON array for AA_API_KEYS_JSON", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/var/lib/aa/data.db",
    AA_API_KEYS_JSON: '[{"key":"test-key","name":"test"}]',
  });

  assert.equal(result.success, true);
});

test("validateStartupEnv rejects non-array JSON for AA_API_KEYS_JSON", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/var/lib/aa/data.db",
    AA_API_KEYS_JSON: '{"key":"test-key"}',
  });

  assert.equal(result.success, false);
  assert.ok(result.errors.some((e) => e.key === "AA_API_KEYS_JSON"), "Expected error for non-array JSON");
});

test("validateStartupEnv accepts all optional fields omitted", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/var/lib/aa/data.db",
    AA_CONFIG_ENV: "prod",
  });

  assert.equal(result.success, true);
  assert.equal(result.parsed!.AA_CONFIG_ROOT, undefined);
  assert.equal(result.parsed!.AA_API_PORT, undefined);
  assert.equal(result.parsed!.AA_API_HOST, undefined);
  assert.equal(result.parsed!.AA_LOG_STDOUT, undefined);
});

test("validateStartupEnv applies default for AA_CONFIG_ENV", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/var/lib/aa/data.db",
  });

  assert.equal(result.success, true);
  assert.equal(result.parsed!.AA_CONFIG_ENV, "prod");
});

test("validateStartupEnv accepts valid fluentd configuration", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/var/lib/aa/data.db",
    AA_LOG_FLUENTD_HOST: "fluentd.example.com",
    AA_LOG_FLUENTD_PORT: "24224",
    AA_LOG_FLUENTD_TAG: "aa.logs",
  });

  assert.equal(result.success, true);
});

test("validateStartupEnv accepts valid datadog configuration", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/var/lib/aa/data.db",
    AA_LOG_DATADOG_API_KEY: "test-api-key",
    AA_LOG_DATADOG_SITE: "datadoghq.com",
    AA_LOG_DATADOG_SERVICE: "automatic-agent",
  });

  assert.equal(result.success, true);
});

test("validateStartupEnv accepts valid redis configuration", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/var/lib/aa/data.db",
    AA_REDIS_HOST: "localhost",
    AA_REDIS_PORT: "6379",
  });

  assert.equal(result.success, true);
});

test("validateStartupEnv accepts valid otel configuration", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/var/lib/aa/data.db",
    AA_OTEL_ENABLED: "true",
    AA_OTEL_ENDPOINT: "https://otel.example.com:4318",
    AA_OTEL_SERVICE_NAME: "automatic-agent",
    AA_OTEL_SERVICE_VERSION: "1.0.0",
  });

  assert.equal(result.success, true);
});

test("validateStartupEnv accepts valid plugin configuration", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/var/lib/aa/data.db",
    AA_PLUGIN_REGISTRY_URL: "https://plugins.example.com",
    AA_PLUGIN_ALLOW_UNVERIFIED: "false",
    AA_PLUGIN_SANDBOX_ROOT: "/opt/aa/plugins",
    AA_PLUGIN_ALLOW_NETWORK_EGRESS: "false",
    AA_PLUGIN_RUNTIME_ISOLATION: "sandboxed_process",
    AA_SANDBOX_MAX_MEMORY_MB: "512",
    AA_SANDBOX_TIMEOUT_MS: "30000",
  });

  assert.equal(result.success, true);
});

test("validateStartupEnv accepts valid security configuration", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/var/lib/aa/data.db",
    AA_API_JWT_SECRET: "super-secret-jwt-key",
    AA_SECURITY_ENFORCE_SANDBOX: "true",
    AA_SECURITY_ALLOWED_HOSTS: "example.com,api.example.com",
  });

  assert.equal(result.success, true);
});

test("validateStartupEnv accepts valid build information", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/var/lib/aa/data.db",
    AA_BUILD_COMMIT: "abc123def456",
    AA_BUILD_TIMESTAMP: "2026-04-29T00:00:00Z",
    AA_BUILD_PROFILE: "production",
    AA_BUILD_VERSION: "1.0.0",
  });

  assert.equal(result.success, true);
});

test("validateStartupEnv accepts full valid configuration", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/var/lib/aa/data.db",
    AA_CONFIG_ENV: "prod",
    AA_CONFIG_ROOT: "/etc/aa",
    AA_API_PORT: "8080",
    AA_API_HOST: "0.0.0.0",
    AA_LOG_STDOUT: "true",
    AA_LOG_LEVEL: "info",
    AA_LOG_FILE_PATH: "/var/log/aa/app.log",
    AA_LOG_FILE_MAX_BYTES: "10485760",
    AA_LOG_FILE_MAX_FILES: "5",
    AA_STORAGE_DRIVER: "sqlite",
    AA_MAX_AGENT_TOOL_CALLS: "100",
    AA_MAX_AGENT_MEMORY_MB: "1024",
    AA_MAX_AGENT_ELAPSED_MS: "3600000",
    AA_OTEL_ENABLED: "true",
    AA_OTEL_ENDPOINT: "https://otel.example.com:4318",
    AA_OTEL_SERVICE_NAME: "automatic-agent",
    AA_OTEL_SERVICE_VERSION: "1.0.0",
    AA_PLUGIN_REGISTRY_URL: "https://plugins.example.com",
    AA_PLUGIN_ALLOW_UNVERIFIED: "false",
    AA_PLUGIN_SANDBOX_ROOT: "/opt/aa/plugins",
    AA_PLUGIN_ALLOW_NETWORK_EGRESS: "false",
    AA_PLUGIN_RUNTIME_ISOLATION: "sandboxed_process",
    AA_SANDBOX_MAX_MEMORY_MB: "512",
    AA_SANDBOX_TIMEOUT_MS: "30000",
    AA_API_JWT_SECRET: "super-secret-jwt-key",
    AA_SECURITY_ENFORCE_SANDBOX: "true",
    AA_SECURITY_ALLOWED_HOSTS: "example.com",
    AA_REDIS_HOST: "localhost",
    AA_REDIS_PORT: "6379",
    AA_BUILD_COMMIT: "abc123",
    AA_BUILD_TIMESTAMP: "2026-04-29T00:00:00Z",
    AA_BUILD_PROFILE: "production",
    AA_BUILD_VERSION: "1.0.0",
    AA_FEATURE_FLAGS: "feature1,feature2",
    AA_ENABLED_EXTENSIONS: "extension1,extension2",
  });

  assert.equal(result.success, true);
});

test("validateStartupEnv returns all errors for multiple invalid fields", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "",
    AA_CONFIG_ENV: "invalid_env",
    AA_API_PORT: "not-a-port",
    AA_LOG_LEVEL: "invalid_level",
    AA_MAX_AGENT_TOOL_CALLS: "-1",
  });

  assert.equal(result.success, false);
  assert.ok(result.errors.length >= 5, "Expected multiple errors");
  assert.ok(result.errors.some((e) => e.key === "AA_DB_PATH"));
  assert.ok(result.errors.some((e) => e.key === "AA_CONFIG_ENV"));
  assert.ok(result.errors.some((e) => e.key === "AA_API_PORT"));
  assert.ok(result.errors.some((e) => e.key === "AA_LOG_LEVEL"));
  assert.ok(result.errors.some((e) => e.key === "AA_MAX_AGENT_TOOL_CALLS"));
});

test("validateStartupEnv handles empty env object", () => {
  const result = validateStartupEnv({});

  assert.equal(result.success, false);
  assert.ok(result.errors.length > 0, "Expected errors for missing required fields");
});

test("validateStartupEnv uses process.env when no argument provided", () => {
  const originalEnv = process.env.AA_DB_PATH;
  process.env.AA_DB_PATH = "/test/path.db";

  try {
    const result = validateStartupEnv();
    assert.equal(result.success, true);
  } finally {
    if (originalEnv !== undefined) {
      process.env.AA_DB_PATH = originalEnv;
    } else {
      delete process.env.AA_DB_PATH;
    }
  }
});

test("validateStartupEnv returns structured error with key and message", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "",
  });

  assert.equal(result.success, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].key, "AA_DB_PATH");
  assert.ok(result.errors[0].message.length > 0, "Error message should not be empty");
});
