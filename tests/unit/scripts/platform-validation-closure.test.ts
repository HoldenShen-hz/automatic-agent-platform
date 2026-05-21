import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const registry = JSON.parse(
  readFileSync("config/validation/platform-validation-registry.json", "utf8"),
) as {
  ciJobs: Array<{ jobId: string; script: string }>;
};
const metricMap = JSON.parse(
  readFileSync("config/validation/platform-monitoring-metric-map.json", "utf8"),
) as {
  forbiddenAlertMetrics: string[];
  metrics: Array<{
    exporterMetric: string;
    alertMetric: string;
    dashboardMetric: string;
  }>;
};
const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>;
};

test("platform validation CI registry maps each freeze job to a real package script", () => {
  const missing = registry.ciJobs.filter(
    (job) => packageJson.scripts[job.script] == null,
  );
  assert.deepEqual(missing, []);
});

test("platform validation machine gate registry covers every core gate in the reference document", () => {
  const document = readFileSync(
    "docs_zh/reference/automatic_agent_platform_validation_monitoring_full_v1_7_1.md",
    "utf8",
  );
  const gateSection = document.slice(
    document.indexOf("# 47. Gate Registry"),
    document.indexOf("# 48. Metric Registry"),
  );
  const documented = new Set(gateSection.match(/GATE-[A-Z-]+-\d+/g) ?? []);
  const registered = new Set(
    (registry as { gates: Array<{ gateId: string }> }).gates.map(
      (gate) => gate.gateId,
    ),
  );

  assert.deepEqual(
    [...documented].filter((gateId) => !registered.has(gateId)),
    [],
  );
});

test("platform monitoring map stays aligned with exporter, alert rules, and dashboard queries", () => {
  const exporter = readFileSync(
    "src/platform/shared/observability/prometheus-metrics-exporter.ts",
    "utf8",
  );
  const rules = readFileSync(
    "deploy/prometheus/rules/automatic-agent.yml",
    "utf8",
  );
  const dashboard = readFileSync(
    "deploy/grafana/dashboards/automatic-agent.json",
    "utf8",
  );

  for (const metric of metricMap.metrics) {
    assert.match(
      exporter,
      new RegExp(metric.exporterMetric),
      `exporter should expose ${metric.exporterMetric}`,
    );
    assert.match(
      rules,
      new RegExp(metric.alertMetric),
      `alert rules should query ${metric.alertMetric}`,
    );
    assert.match(
      dashboard,
      new RegExp(metric.dashboardMetric),
      `dashboard should query ${metric.dashboardMetric}`,
    );
  }

  for (const metric of metricMap.forbiddenAlertMetrics) {
    assert.doesNotMatch(
      rules,
      new RegExp(metric),
      `alert rules should not reference stale metric ${metric}`,
    );
  }
});

test("platform validation registry closure script passes for machine registry and monitoring mapping", () => {
  const result = spawnSync(
    "node",
    ["scripts/validation/platform-validation-closure.mjs", "registry"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /registry platform validation passed/);
});

test("platform validation artifact exporter materializes schemas generated types and closure reports", () => {
  const exportResult = spawnSync(
    "node",
    [
      "--import",
      "tsx",
      "scripts/validation/export-platform-validation-artifacts.ts",
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );
  assert.equal(
    exportResult.status,
    0,
    `${exportResult.stdout}\n${exportResult.stderr}`,
  );

  const closureResult = spawnSync(
    "node",
    ["scripts/validation/platform-validation-closure.mjs", "artifacts"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );
  assert.equal(
    closureResult.status,
    0,
    `${closureResult.stdout}\n${closureResult.stderr}`,
  );

  for (const artifact of [
    "artifacts/validation/platform/schemas/validation-evidence-bundle.schema.json",
    "artifacts/validation/platform/schemas/plugin-manifest.schema.json",
    "artifacts/validation/platform/schemas/tool-definition.schema.json",
    "artifacts/validation/platform/schemas/data-governance.schema.json",
    "artifacts/validation/platform/generated/typed-event-payloads.generated.ts",
    "artifacts/validation/platform/generated/gate-registry.generated.ts",
    "artifacts/validation/platform/generated/metric-registry.generated.ts",
    "artifacts/validation/platform/reports/metric-registry-closure-report.json",
    "artifacts/validation/platform/reports/event-schema-coverage-report.json",
  ]) {
    assert.equal(existsSync(artifact), true, `${artifact} should exist`);
  }

  const metricRegistry = JSON.parse(
    readFileSync(
      "artifacts/validation/platform/contracts/metric-registry.canonical.json",
      "utf8",
    ),
  ) as { targetMetrics: Array<{ metric: string }> };
  assert.ok(
    metricRegistry.targetMetrics.some(
      (metric) => metric.metric === "aa.truth.atomicity.violation.count",
    ),
  );
});
