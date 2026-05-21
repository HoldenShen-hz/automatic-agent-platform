import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const registry = JSON.parse(readFileSync("config/validation/platform-validation-registry.json", "utf8")) as {
  ciJobs: Array<{ jobId: string; script: string }>;
};
const metricMap = JSON.parse(readFileSync("config/validation/platform-monitoring-metric-map.json", "utf8")) as {
  forbiddenAlertMetrics: string[];
  metrics: Array<{ exporterMetric: string; alertMetric: string; dashboardMetric: string }>;
};
const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };

test("platform validation CI registry maps each freeze job to a real package script", () => {
  const missing = registry.ciJobs.filter((job) => packageJson.scripts[job.script] == null);
  assert.deepEqual(missing, []);
});

test("platform monitoring map stays aligned with exporter, alert rules, and dashboard queries", () => {
  const exporter = readFileSync("src/platform/shared/observability/prometheus-metrics-exporter.ts", "utf8");
  const rules = readFileSync("deploy/prometheus/rules/automatic-agent.yml", "utf8");
  const dashboard = readFileSync("deploy/grafana/dashboards/automatic-agent.json", "utf8");

  for (const metric of metricMap.metrics) {
    assert.match(exporter, new RegExp(metric.exporterMetric), `exporter should expose ${metric.exporterMetric}`);
    assert.match(rules, new RegExp(metric.alertMetric), `alert rules should query ${metric.alertMetric}`);
    assert.match(dashboard, new RegExp(metric.dashboardMetric), `dashboard should query ${metric.dashboardMetric}`);
  }

  for (const metric of metricMap.forbiddenAlertMetrics) {
    assert.doesNotMatch(rules, new RegExp(metric), `alert rules should not reference stale metric ${metric}`);
  }
});

test("platform validation registry closure script passes for machine registry and monitoring mapping", () => {
  const result = spawnSync("node", ["scripts/validation/platform-validation-closure.mjs", "registry"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /registry platform validation passed/);
});
