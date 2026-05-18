import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { ChaosExperimentScheduler } from "../../../src/ops-maturity/chaos/chaos-experiment-scheduler.js";
import { validateStartupEnv } from "../../../src/platform/five-plane-control-plane/config-center/startup-env-schema.js";
import { PrometheusMetricsExporter } from "../../../src/platform/shared/observability/prometheus-metrics-exporter.js";
import { runtimeMetricsRegistry } from "../../../src/platform/shared/observability/runtime-metrics-registry.js";
import { FixtureRedactor } from "../../../src/sdk/fixture-redact.js";

const ROOT = process.cwd();

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function createFakeAuthoritativeDb() {
  return {
    connection: {
      prepare(sql: string) {
        return {
          get() {
            if (/workflow_step_outputs/i.test(sql)) {
              return { count: 3 };
            }
            return { count: 0 };
          },
        };
      },
    },
  };
}

function createFakeMetricsService() {
  return {
    buildSummary(generatedAt: string) {
      return {
        generatedAt,
        runtimeMetrics: {
          activeExecutions: 2,
          queuedTasks: 5,
          providerSuccessRate: 0.99,
          memoryRssMb: 64,
          eventLoopLagMs: 12,
          workerHealth: {
            healthyWorkers: 4,
            totalWorkers: 5,
          },
        },
        recoveryMetrics: {
          deadLetterCount: 1,
        },
        executionMetrics: {
          total: 10,
          activeCount: 2,
          supersededCount: 1,
        },
        taskMetrics: {
          successCount: 7,
          failedCount: 2,
          cancelledCount: 1,
        },
      };
    },
  };
}

test("real startup env schema fail-closes invalid production-critical combinations", () => {
  const valid = validateStartupEnv({
    AA_DB_PATH: "/tmp/aa.sqlite",
    AA_CONFIG_ENV: "prod",
    AA_API_PORT: "8080",
    AA_STORAGE_DRIVER: "sqlite",
    AA_LOG_FILE_MAX_BYTES: null as unknown as string,
    AA_MAX_AGENT_TOOL_CALLS: null as unknown as string,
    AA_MAX_AGENT_MEMORY_MB: null as unknown as string,
    AA_MAX_AGENT_ELAPSED_MS: null as unknown as string,
    AA_EXPECTED_PROTECTED_GOVERNANCE_VERSION: null as unknown as string,
    AA_SANDBOX_MAX_MEMORY_MB: null as unknown as string,
    AA_SANDBOX_TIMEOUT_MS: null as unknown as string,
    AA_API_JWT_SECRET: null as unknown as string,
  });
  assert.equal(valid.success, true);
  assert.equal(valid.parsed?.AA_CONFIG_ENV, "prod");

  const invalidPort = validateStartupEnv({
    AA_DB_PATH: "/tmp/aa.sqlite",
    AA_API_PORT: "70000",
  });
  assert.equal(invalidPort.success, false);
  assert.ok(invalidPort.errors.some((error) => error.key === "AA_API_PORT"));

  const missingPostgresDsn = validateStartupEnv({
    AA_DB_PATH: "/tmp/aa.sqlite",
    AA_STORAGE_DRIVER: "postgres",
  });
  assert.equal(missingPostgresDsn.success, false);
  assert.ok(missingPostgresDsn.errors.some((error) => error.key === "AA_STORAGE_POSTGRES_DSN"));

  const unsafePluginEgress = validateStartupEnv({
    AA_DB_PATH: "/tmp/aa.sqlite",
    AA_PLUGIN_ALLOW_NETWORK_EGRESS: "true",
  });
  assert.equal(unsafePluginEgress.success, false);
  assert.ok(unsafePluginEgress.errors.some((error) => error.key === "AA_PLUGIN_SANDBOX_ROOT"));
});

test("real Prometheus exporter exposes operational metrics without high-cardinality mission labels", () => {
  runtimeMetricsRegistry.reset();
  runtimeMetricsRegistry.incrementCounter("redis_connection_errors", { component: "queue" }, 2);
  runtimeMetricsRegistry.incrementCounter("queue_enqueue_failures_total", { backend: "redis", mode: "durable" }, 1);
  runtimeMetricsRegistry.recordKnowledgeQuery("search", 25, "hit");
  runtimeMetricsRegistry.recordLlmLatency(0.12, 0.9, "gpt-test", "provider-test");

  const exporter = new PrometheusMetricsExporter(
    createFakeAuthoritativeDb() as never,
    createFakeMetricsService() as never,
    { metricPrefix: "aa_" },
  );
  exporter.recordHttpRequest("GET", "/api/v1/tasks", 200, 42);
  const output = exporter.export();

  assert.match(output, /aa_redis_connection_errors\{component="queue"\} 2/);
  assert.match(output, /aa_queue_enqueue_failures_total\{backend="redis",mode="durable"\} 1/);
  assert.match(output, /aa_healthy_workers 4/);
  assert.match(output, /aa_total_workers 5/);
  assert.match(output, /aa_disk_used_ratio /);
  assert.match(output, /aa_llm_total_seconds_count\{model="gpt-test",provider="provider-test"\} 1/);
  assert.doesNotMatch(output, /missionId|mission_id|mission:test/);
});

test("real fixture redactor removes secrets and PII while preserving correlation hashes", () => {
  const result = FixtureRedactor.createStandard().redact({
    email: "operator@example.com",
    password: "correct-horse-battery-staple",
    nested: {
      token: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature",
      ip: "192.168.1.20",
      harmless: "release evidence",
    },
  });

  assert.deepEqual(result.value, {
    email: "[REDACTED]",
    password: "[REDACTED]",
    nested: {
      token: "[REDACTED]",
      ip: "[REDACTED]",
      harmless: "release evidence",
    },
  });
  assert.ok(result.redactedFields.has("email"));
  assert.ok(result.redactedFields.has("password"));
  assert.ok(result.redactedFields.has("nested.token"));
  assert.ok(result.redactedFields.has("nested.ip"));
  assert.ok(result.correlationHashes.has("email"));
  assert.ok(result.correlationHashes.has("password"));
});

test("real chaos scheduler blocks production targets and rolls back violated experiments", async () => {
  const scheduler = new ChaosExperimentScheduler();
  const blocked = scheduler.scheduleExperiment({
    name: "blocked production target",
    description: "Should never start on primary production.",
    target: {
      targetKind: "service",
      targetId: "production-primary-api",
      labels: { affected_instances: "1" },
    },
    fault: {
      faultType: "latency",
      intensity: 0.2,
      durationMs: 100,
      parameters: {},
    },
    steadyStateHypotheses: [{ name: "error rate", metricName: "error_rate", operator: "lt", tolerance: 0.01 }],
    scheduledAt: "2026-05-18T00:00:00.000Z",
    maxDurationMs: 1000,
  });
  assert.equal(scheduler.startExperiment(blocked.experimentId), false);
  assert.equal(scheduler.listExperiments()[0]?.status, "cancelled");

  const experiment = scheduler.scheduleExperiment({
    name: "safe staging target",
    description: "Rollback should be queued on steady-state violation.",
    target: {
      targetKind: "service",
      targetId: "staging-api",
      labels: { affected_instances: "1", affected_percent: "1" },
    },
    fault: {
      faultType: "error",
      intensity: 0.1,
      durationMs: 100,
      parameters: {},
    },
    steadyStateHypotheses: [{ name: "success rate", metricName: "success_rate", operator: "gte", tolerance: 0.99 }],
    scheduledAt: "2026-05-18T00:01:00.000Z",
    maxDurationMs: 1000,
    boundaryControl: { allowedTargets: ["staging-api"], rollbackTimeoutMs: 500 },
  });
  assert.equal(scheduler.startExperiment(experiment.experimentId), true);
  scheduler.recordSteadyStateResult(experiment.experimentId, "success rate", 0.8, false, "SLO violated");
  assert.equal(scheduler.listExperiments().find((item) => item.experimentId === experiment.experimentId)?.status, "rollback");

  await new Promise((resolve) => setTimeout(resolve, 350));
  const rolledBack = scheduler.listExperiments().find((item) => item.experimentId === experiment.experimentId);
  assert.equal(rolledBack?.status, "rollback");
  assert.ok(rolledBack?.rollbackActions.every((action) => action.status === "completed"));
});

test("real supply-chain audit script passes against current repository controls", () => {
  const output = execFileSync(process.execPath, ["scripts/ci/audit-ci-supply-chain.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.match(output, /ci supply-chain audit passed/);
  assert.match(output, /ok ci npm audit/);
  assert.match(output, /ok package lock present/);
});

test("real deployment, DR, and alerting assets keep executable guardrails", () => {
  for (const script of [
    "deploy/scripts/deploy.sh",
    "deploy/scripts/rollback.sh",
    "deploy/scripts/verify-hot-upgrade.sh",
    "deploy/scripts/dr-drill.sh",
    "scripts/backup-sqlite.sh",
    "scripts/restore-sqlite.sh",
  ]) {
    assert.ok(existsSync(join(ROOT, script)), `missing operational script: ${script}`);
    assert.match(read(script), /set -euo pipefail|set -eu|set -e/, `${script} must fail fast`);
  }

  const prodValues = read("deploy/helm/automatic-agent/values-prod.yaml");
  assert.match(prodValues, /otel|OTEL|opentelemetry/i);
  assert.match(prodValues, /ingress:/);
  assert.match(prodValues, /resources:/);

  const rules = read("deploy/prometheus/rules/automatic-agent.yml");
  assert.match(rules, /DLQ|DeadLetter/i);
  assert.match(rules, /Outbox/i);
  assert.match(rules, /severity:\s*critical/);

  const drWorkflow = read(".github/workflows/dr-validation.yml");
  assert.match(drWorkflow, /dr-drill\.sh/);
  assert.match(drWorkflow, /workflow_dispatch/);
});
