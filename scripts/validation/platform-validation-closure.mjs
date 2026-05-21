import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const registryPath = join(root, "config/validation/platform-validation-registry.json");
const metricMapPath = join(root, "config/validation/platform-monitoring-metric-map.json");
const artifactRoot = join(root, "artifacts/validation/platform");
const mode = process.argv[2] ?? "registry";
const packageJson = readJson(join(root, "package.json"));
const registry = readJson(registryPath);
const metricMap = readJson(metricMapPath);
const issues = [];

if (mode === "registry" || mode === "docs-registry" || mode === "bundle") {
  validateRegistry();
}
if (mode === "monitoring" || mode === "registry" || mode === "bundle") {
  validateMonitoring();
}
if (mode === "gpu-capacity") {
  validateGpuCapacitySeam();
}

const report = {
  mode,
  status: issues.length === 0 ? "passed" : "failed",
  registryVersion: registry.version,
  metricMapVersion: metricMap.version,
  checkedAt: new Date().toISOString(),
  checkedCounts: {
    ciJobs: registry.ciJobs.length,
    gates: registry.gates.length,
    runbooks: registry.runbooks.length,
    monitoringMetrics: metricMap.metrics.length,
  },
  issues,
};

mkdirSync(artifactRoot, { recursive: true });
const artifactPath = join(artifactRoot, artifactName(mode));
writeFileSync(artifactPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

if (issues.length > 0) {
  console.error(`${mode} platform validation failed: ${issues.join("; ")}`);
  process.exitCode = 1;
} else {
  console.log(`${mode} platform validation passed: ${artifactPath}`);
}

function validateRegistry() {
  requireFile(registry.sources.eventRegistry, "registry.event_registry_missing");
  requireFile(registry.sources.metricMap, "registry.metric_map_missing");
  requireFile(registry.sources.runbook, "registry.runbook_missing");

  const scripts = packageJson.scripts ?? {};
  const ciJobIds = new Set(registry.ciJobs.map((job) => job.jobId));
  const runbookIds = new Set(registry.runbooks.map((runbook) => runbook.runbookId));
  for (const job of registry.ciJobs) {
    if (typeof scripts[job.script] !== "string") {
      issues.push(`ci_job.${job.jobId}.script_missing:${job.script}`);
    }
    if (typeof job.artifact !== "string" || job.artifact.length === 0) {
      issues.push(`ci_job.${job.jobId}.artifact_missing`);
    }
  }
  for (const runbook of registry.runbooks) {
    requireFile(runbook.path, `runbook.${runbook.runbookId}.path_missing`);
  }
  for (const gate of registry.gates) {
    if (!ciJobIds.has(gate.ciJob)) {
      issues.push(`gate.${gate.gateId}.ci_job_missing:${gate.ciJob}`);
    }
    if (!runbookIds.has(gate.runbookId)) {
      issues.push(`gate.${gate.gateId}.runbook_missing:${gate.runbookId}`);
    }
  }
}

function validateMonitoring() {
  const exporter = readFile("src/platform/shared/observability/prometheus-metrics-exporter.ts");
  const rules = readFile("deploy/prometheus/rules/automatic-agent.yml");
  const dashboard = readFile("deploy/grafana/dashboards/automatic-agent.json");

  for (const metric of metricMap.metrics) {
    if (!exporter.includes(metric.exporterMetric)) {
      issues.push(`monitoring.${metric.purpose}.exporter_metric_missing:${metric.exporterMetric}`);
    }
    if (!rules.includes(metric.alertMetric)) {
      issues.push(`monitoring.${metric.purpose}.alert_metric_missing:${metric.alertMetric}`);
    }
    if (!dashboard.includes(metric.dashboardMetric)) {
      issues.push(`monitoring.${metric.purpose}.dashboard_metric_missing:${metric.dashboardMetric}`);
    }
  }
  for (const metricName of metricMap.forbiddenAlertMetrics) {
    if (rules.includes(metricName)) {
      issues.push(`monitoring.forbidden_alert_metric:${metricName}`);
    }
  }
}

function validateGpuCapacitySeam() {
  requireFile("docs_zh/reference/automatic_agent_platform_validation_monitoring_full_v1_7_1.md", "gpu_capacity.reference_doc_missing");
  const doc = readFile("docs_zh/reference/automatic_agent_platform_validation_monitoring_full_v1_7_1.md");
  if (!doc.includes("Local Model / L40S GPU Capacity Validation")) {
    issues.push("gpu_capacity.reference_section_missing");
  }
}

function requireFile(relativePath, code) {
  if (!existsSync(join(root, relativePath))) {
    issues.push(code);
  }
}

function readFile(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function artifactName(value) {
  return {
    registry: "registry-closure-report.json",
    "docs-registry": "docs-registry-report.json",
    monitoring: "observability-report.json",
    bundle: "validation-bundle.json",
    "gpu-capacity": "gpu-capacity-report.json",
  }[value] ?? `${value}-report.json`;
}
