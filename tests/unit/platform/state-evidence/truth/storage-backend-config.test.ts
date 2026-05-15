import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveStorageDriver,
  buildStorageBackendConfigIssues,
  inspectStorageBackendConfig,
  type StorageBackendConfigValidationOptions,
} from "../../../../../src/platform/five-plane-state-evidence/truth/storage-backend-config.js";

test("resolveStorageDriver returns sqlite when not configured", () => {
  const result = resolveStorageDriver({});
  assert.equal(result, "sqlite");
});

test("resolveStorageDriver returns sqlite when explicitly set", () => {
  const result = resolveStorageDriver({ AA_STORAGE_DRIVER: "sqlite" });
  assert.equal(result, "sqlite");
});

test("resolveStorageDriver returns postgres when set", () => {
  const result = resolveStorageDriver({ AA_STORAGE_DRIVER: "postgres" });
  assert.equal(result, "postgres");
});

test("resolveStorageDriver throws for invalid driver", () => {
  assert.throws(
    () => resolveStorageDriver({ AA_STORAGE_DRIVER: "mongodb" }),
    (error: any) => error.code === "storage.driver_invalid:mongodb"
  );
});

test("resolveStorageDriver trims whitespace", () => {
  const result = resolveStorageDriver({ AA_STORAGE_DRIVER: "  postgres  " });
  assert.equal(result, "postgres");
});

test("inspectStorageBackendConfig returns valid for sqlite", () => {
  const result = inspectStorageBackendConfig({
    environment: "development",
    env: { AA_STORAGE_DRIVER: "sqlite" },
  });

  assert.equal(result.driver, "sqlite");
  assert.deepEqual(result.issues, []);
  assert.equal(result.postgres, null);
});

test("inspectStorageBackendConfig returns valid for postgres with DSN", () => {
  const result = inspectStorageBackendConfig({
    environment: "development",
    env: {
      AA_STORAGE_DRIVER: "postgres",
      AA_STORAGE_POSTGRES_DSN: "postgres://user:pass@localhost/db",
    },
  });

  assert.equal(result.driver, "postgres");
  assert.equal(result.issues.length, 0);
  assert.ok(result.postgres);
  assert.equal(result.postgres.dsnConfigured, true);
  assert.equal(result.postgres.host, "localhost");
});

test("inspectStorageBackendConfig detects missing DSN for postgres", () => {
  const result = inspectStorageBackendConfig({
    environment: "development",
    env: { AA_STORAGE_DRIVER: "postgres" },
  });

  assert.equal(result.driver, "postgres");
  assert.ok(result.issues.some(i => i.includes("dsn_missing")));
});

test("inspectStorageBackendConfig detects invalid protocol", () => {
  const result = inspectStorageBackendConfig({
    environment: "development",
    env: {
      AA_STORAGE_DRIVER: "postgres",
      AA_STORAGE_POSTGRES_DSN: "mysql://user:pass@localhost/db",
    },
  });

  assert.ok(result.issues.some(i => i.includes("protocol_invalid")));
});

test("inspectStorageBackendConfig detects missing database", () => {
  const result = inspectStorageBackendConfig({
    environment: "development",
    env: {
      AA_STORAGE_DRIVER: "postgres",
      AA_STORAGE_POSTGRES_DSN: "postgres://user:pass@localhost",
    },
  });

  assert.ok(result.issues.some(i => i.includes("database_missing")));
});

test("inspectStorageBackendConfig parses pool configuration", () => {
  const result = inspectStorageBackendConfig({
    environment: "development",
    env: {
      AA_STORAGE_DRIVER: "postgres",
      AA_STORAGE_POSTGRES_DSN: "postgres://user:pass@localhost/db",
      AA_STORAGE_POSTGRES_POOL_MIN: "5",
      AA_STORAGE_POSTGRES_POOL_MAX: "20",
    },
  });

  assert.equal(result.postgres?.poolMin, 5);
  assert.equal(result.postgres?.poolMax, 20);
});

test("inspectStorageBackendConfig detects pool min exceeds max", () => {
  const result = inspectStorageBackendConfig({
    environment: "development",
    env: {
      AA_STORAGE_DRIVER: "postgres",
      AA_STORAGE_POSTGRES_DSN: "postgres://user:pass@localhost/db",
      AA_STORAGE_POSTGRES_POOL_MIN: "30",
      AA_STORAGE_POSTGRES_POOL_MAX: "10",
    },
  });

  assert.ok(result.issues.some(i => i.includes("pool_min_exceeds_max")));
});

test("inspectStorageBackendConfig detects invalid pool values", () => {
  const result = inspectStorageBackendConfig({
    environment: "development",
    env: {
      AA_STORAGE_DRIVER: "postgres",
      AA_STORAGE_POSTGRES_DSN: "postgres://user:pass@localhost/db",
      AA_STORAGE_POSTGRES_POOL_MIN: "abc",
    },
  });

  assert.ok(result.issues.some(i => i.includes("pool_min_invalid")));
});

test("inspectStorageBackendConfig production requires ssl", () => {
  const result = inspectStorageBackendConfig({
    environment: "prod",
    env: {
      AA_STORAGE_DRIVER: "postgres",
      AA_STORAGE_POSTGRES_DSN: "postgres://user:pass@localhost/db",
    },
  });

  assert.ok(result.issues.some(i => i.includes("sslmode_required")));
});

test("inspectStorageBackendConfig production allows valid ssl", () => {
  const result = inspectStorageBackendConfig({
    environment: "prod",
    env: {
      AA_STORAGE_DRIVER: "postgres",
      AA_STORAGE_POSTGRES_DSN: "postgres://user:pass@localhost/db?sslmode=require",
    },
  });

  assert.ok(!result.issues.some(i => i.includes("sslmode")));
});

test("inspectStorageBackendConfig production rejects localhost", () => {
  const result = inspectStorageBackendConfig({
    environment: "prod",
    env: {
      AA_STORAGE_DRIVER: "postgres",
      AA_STORAGE_POSTGRES_DSN: "postgres://user:pass@127.0.0.1/db",
    },
  });

  assert.ok(result.issues.some(i => i.includes("host_not_production_ready")));
});

test("inspectStorageBackendConfig production requires dual run", () => {
  const result = inspectStorageBackendConfig({
    environment: "prod",
    env: {
      AA_STORAGE_DRIVER: "postgres",
      AA_STORAGE_POSTGRES_DSN: "postgres://user:pass@prodhost/db?sslmode=require",
    },
  });

  assert.ok(result.issues.some(i => i.includes("dual_run_required")));
});

test("inspectStorageBackendConfig validates schema format", () => {
  const result = inspectStorageBackendConfig({
    environment: "development",
    env: {
      AA_STORAGE_DRIVER: "postgres",
      AA_STORAGE_POSTGRES_DSN: "postgres://user:pass@localhost/db",
      AA_STORAGE_POSTGRES_SCHEMA: "valid_schema",
    },
  });

  assert.ok(!result.issues.some(i => i.includes("schema_invalid")));
});

test("inspectStorageBackendConfig rejects invalid schema format", () => {
  const result = inspectStorageBackendConfig({
    environment: "development",
    env: {
      AA_STORAGE_DRIVER: "postgres",
      AA_STORAGE_POSTGRES_DSN: "postgres://user:pass@localhost/db",
      AA_STORAGE_POSTGRES_SCHEMA: "123invalid",
    },
  });

  assert.ok(result.issues.some(i => i.includes("schema_invalid")));
});

test("buildStorageBackendConfigIssues returns empty array for valid config", () => {
  const issues = buildStorageBackendConfigIssues({
    environment: "development",
    env: { AA_STORAGE_DRIVER: "sqlite" },
  });

  assert.deepEqual(issues, []);
});

test("buildStorageBackendConfigIssues returns issues for invalid config", () => {
  const issues = buildStorageBackendConfigIssues({
    environment: "development",
    env: { AA_STORAGE_DRIVER: "postgres" },
  });

  assert.ok(issues.length > 0);
});
