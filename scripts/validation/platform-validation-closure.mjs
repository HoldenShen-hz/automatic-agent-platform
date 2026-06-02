import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const registryPath = join(
  root,
  "config/validation/platform-validation-registry.json",
);
const metricMapPath = join(
  root,
  "config/validation/platform-monitoring-metric-map.json",
);
const artifactRoot = join(root, "artifacts/validation/platform");
const contractsRoot = join(artifactRoot, "contracts");
const schemasRoot = join(artifactRoot, "schemas");
const generatedRoot = join(artifactRoot, "generated");
const reportsRoot = join(artifactRoot, "reports");
const mode = process.argv[2] ?? "registry";
const packageJson = readJson(join(root, "package.json"));
const registry = readJson(registryPath);
const metricMap = readJson(metricMapPath);
const runbookMetadata = readJson(
  join(root, registry.sources.runbookMetadata),
);
const missionSloProfiles = readJson(
  join(root, registry.sources.missionSloProfiles),
);
const issues = [];

if (mode === "registry" || mode === "docs-registry" || mode === "bundle") {
  validateRegistry();
}
if (mode === "monitoring" || mode === "registry" || mode === "bundle") {
  validateMonitoring();
}
if (mode === "bundle" || mode === "artifacts") {
  validateGeneratedArtifacts();
}
if (mode === "bundle") {
  validateProductReports();
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
if (issues.length === 0) {
  writeClosureReports(report);
}

if (issues.length > 0) {
  console.error(`${mode} platform validation failed: ${issues.join("; ")}`);
  process.exitCode = 1;
} else {
  console.log(`${mode} platform validation passed: ${artifactPath}`);
}

function validateRegistry() {
  requireFile(
    registry.sources.eventRegistry,
    "registry.event_registry_missing",
  );
  requireFile(registry.sources.metricMap, "registry.metric_map_missing");
  requireFile(
    registry.sources.lifecycleMatrix,
    "registry.lifecycle_matrix_missing",
  );
  requireFile(registry.sources.runbook, "registry.runbook_missing");
  requireFile(
    registry.sources.runbookMetadata,
    "registry.runbook_metadata_missing",
  );
  requireFile(
    registry.sources.missionSloProfiles,
    "registry.mission_slo_profiles_missing",
  );

  const scripts = packageJson.scripts ?? {};
  const ciJobIds = new Set(registry.ciJobs.map((job) => job.jobId));
  const runbookIds = new Set(
    registry.runbooks.map((runbook) => runbook.runbookId),
  );
  const runbookMetadataById = new Map(
    runbookMetadata.runbooks.map((runbook) => [runbook.runbookId, runbook]),
  );
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
    const metadata = runbookMetadataById.get(runbook.runbookId);
    if (metadata == null) {
      issues.push(`runbook.${runbook.runbookId}.metadata_missing`);
      continue;
    }
    for (const field of [
      "title",
      "severity",
      "owner",
      "automationAllowed",
      "lastReviewedAt",
    ]) {
      if (
        typeof metadata[field] !== "string" ||
        metadata[field].length === 0
      ) {
        issues.push(`runbook.${runbook.runbookId}.${field}_missing`);
      }
    }
    if (!Array.isArray(metadata.linkedGates) || metadata.linkedGates.length === 0) {
      issues.push(`runbook.${runbook.runbookId}.linked_gates_missing`);
    }
    if (!Array.isArray(metadata.linkedMetrics)) {
      issues.push(`runbook.${runbook.runbookId}.linked_metrics_missing`);
    }
    if (runbook.runbookId.startsWith("D.")) {
      const runbookSource = readFile(runbook.path);
      if (!runbookSource.includes(`## ${runbook.runbookId} `)) {
        issues.push(`runbook.${runbook.runbookId}.section_missing`);
      }
    }
  }
  for (const gate of registry.gates) {
    if (!ciJobIds.has(gate.ciJob)) {
      issues.push(`gate.${gate.gateId}.ci_job_missing:${gate.ciJob}`);
    }
    if (!runbookIds.has(gate.runbookId)) {
      issues.push(`gate.${gate.gateId}.runbook_missing:${gate.runbookId}`);
    }
    const metadata = runbookMetadataById.get(gate.runbookId);
    if (metadata != null && !metadata.linkedGates.includes(gate.gateId)) {
      issues.push(`gate.${gate.gateId}.runbook_link_missing:${gate.runbookId}`);
    }
  }
  validateMissionSloProfiles();
  validateCanonicalEventNames();
}

function validateMonitoring() {
  const exporter = readFile(
    "src/platform/shared/observability/prometheus-metrics-exporter.ts",
  );
  const rules = readFile("deploy/prometheus/rules/automatic-agent.yml");
  const dashboard = readFile("deploy/grafana/dashboards/automatic-agent.json");

  for (const metric of metricMap.metrics) {
    if (!exporter.includes(metric.exporterMetric)) {
      issues.push(
        `monitoring.${metric.purpose}.exporter_metric_missing:${metric.exporterMetric}`,
      );
    }
    if (!rules.includes(metric.alertMetric)) {
      issues.push(
        `monitoring.${metric.purpose}.alert_metric_missing:${metric.alertMetric}`,
      );
    }
    if (!dashboard.includes(metric.dashboardMetric)) {
      issues.push(
        `monitoring.${metric.purpose}.dashboard_metric_missing:${metric.dashboardMetric}`,
      );
    }
  }
  for (const metricName of metricMap.forbiddenAlertMetrics) {
    if (rules.includes(metricName)) {
      issues.push(`monitoring.forbidden_alert_metric:${metricName}`);
    }
  }
  const targetMetrics = extractCoreMetricRegistry(
    readFile(
      "docs_zh/reference/automatic_agent_platform_validation_monitoring_full_v1_7_1.md",
    ),
  ).map((metric) => metric.metric);
  for (const spanName of extractValidationSpanNames()) {
    if (targetMetrics.includes(spanName)) {
      issues.push(`monitoring.validation_span_name_promoted_to_metric:${spanName}`);
    }
  }
}

function validateGpuCapacitySeam() {
  requireFile(
    "docs_zh/reference/automatic_agent_platform_validation_monitoring_full_v1_7_1.md",
    "gpu_capacity.reference_doc_missing",
  );
  const doc = readFile(
    "docs_zh/reference/automatic_agent_platform_validation_monitoring_full_v1_7_1.md",
  );
  if (!doc.includes("Local Model / L40S GPU Capacity Validation")) {
    issues.push("gpu_capacity.reference_section_missing");
  }
}

function validateGeneratedArtifacts() {
  for (const path of [
    "contracts/event-registry.canonical.json",
    "contracts/gate-registry.canonical.json",
    "contracts/metric-registry.canonical.json",
    "contracts/runbook-registry.canonical.yaml",
    "contracts/ci-job-registry.canonical.json",
    "contracts/lifecycle-matrix.canonical.json",
    "contracts/mission-slo-profiles.canonical.json",
    "schemas/validation-evidence-bundle.schema.json",
    "schemas/mission-slo-profile.schema.json",
    "schemas/plugin-manifest.schema.json",
    "schemas/tool-definition.schema.json",
    "schemas/data-governance.schema.json",
    "generated/typed-event-payloads.generated.ts",
    "generated/gate-registry.generated.ts",
    "generated/metric-registry.generated.ts",
    "generated/mission-slo-profiles.generated.ts",
    "generated/runbook-registry.generated.ts",
  ]) {
    requireFile(
      `artifacts/validation/platform/${path}`,
      `artifact.${path}.missing`,
    );
  }

  const eventRegistryArtifact = readJson(
    join(contractsRoot, "event-registry.canonical.json"),
  );
  for (const event of eventRegistryArtifact.events ?? []) {
    const eventSchemaPath = join(
      schemasRoot,
      "event-payload-schemas",
      `${schemaFileName(event.type)}.schema.json`,
    );
    if (!existsSync(eventSchemaPath)) {
      issues.push(`artifact.event_payload_schema_missing:${event.type}`);
      continue;
    }
    const eventSchema = readJson(eventSchemaPath);
    if (eventSchema.$id !== event.payloadSchemaRef) {
      issues.push(`artifact.event_payload_schema_ref_mismatch:${event.type}`);
    }
  }

  const metricRegistryArtifact = readJson(
    join(contractsRoot, "metric-registry.canonical.json"),
  );
  if (
    !Array.isArray(metricRegistryArtifact.targetMetrics) ||
    metricRegistryArtifact.targetMetrics.length === 0
  ) {
    issues.push("artifact.metric_registry_target_metrics_missing");
  }
  if (
    Array.isArray(metricRegistryArtifact.targetMetrics) &&
    Array.isArray(metricRegistryArtifact.forbiddenValidationSpanNames)
  ) {
    const collisions = metricRegistryArtifact.targetMetrics
      .map((metric) => metric.metric)
      .filter((metric) =>
        metricRegistryArtifact.forbiddenValidationSpanNames.includes(metric),
      );
    for (const collision of collisions) {
      issues.push(`artifact.metric_registry_span_collision:${collision}`);
    }
  }
}

function validateProductReports() {
  for (const path of [
    "reports/ui-validation-report.json",
    "reports/research-validation-report.json",
    "reports/observability-validation-report.json",
    "reports/capacity-validation-report.json",
    "reports/gpu-validation-report.json",
    "reports/scorecard-validation-report.json",
    "reports/freeze-validation-report.json",
  ]) {
    requireFile(
      `artifacts/validation/platform/${path}`,
      `artifact.product.${path}.missing`,
    );
  }
  const research = readJson(
    join(reportsRoot, "research-validation-report.json"),
  );
  if (research.missionSloEvaluation?.passed !== true) {
    issues.push("product.research_mission_slo_failed");
  }
  const freeze = readJson(join(reportsRoot, "freeze-validation-report.json"));
  if (freeze.runbookSummary?.missingMetadataCount !== 0) {
    issues.push("product.freeze_runbook_metadata_incomplete");
  }
  if (freeze.gateSummary?.p0GateCount == null) {
    issues.push("product.freeze_gate_summary_missing");
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
  return (
    {
      registry: "registry-closure-report.json",
      "docs-registry": "docs-registry-report.json",
      monitoring: "observability-report.json",
      bundle: "validation-bundle.json",
      artifacts: "artifact-export-report.json",
      "gpu-capacity": "gpu-capacity-report.json",
    }[value] ?? `${value}-report.json`
  );
}

function validateMissionSloProfiles() {
  const profileIds = new Set(
    missionSloProfiles.profiles.map((profile) => profile.missionType),
  );
  for (const missionType of ["research", "code_agent", "ops"]) {
    if (!profileIds.has(missionType)) {
      issues.push(`mission_slo.profile_missing:${missionType}`);
    }
  }
  if (!Array.isArray(missionSloProfiles.burnRateAlerts) || missionSloProfiles.burnRateAlerts.length < 3) {
    issues.push("mission_slo.burn_rate_alerts_missing");
  }
}

function validateCanonicalEventNames() {
  const eventRegistrySource = readFile(registry.sources.eventRegistry);
  const eventNames = new Set(
    [...eventRegistrySource.matchAll(/"([a-zA-Z0-9_.:]+)":\s*\{/g)].map(
      (match) => match[1],
    ),
  );
  for (const eventName of eventNames) {
    if (!eventName.includes(".")) {
      continue;
    }
    const segments = eventName.split(".");
    if (
      eventName.startsWith(".") ||
      eventName.endsWith(".") ||
      eventName.includes("..") ||
      segments.some((segment) => !/^[a-z][a-z0-9_]*$/u.test(segment))
    ) {
      issues.push(`event_registry.invalid_canonical_event_name:${eventName}`);
    }
  }
}

function extractCoreMetricRegistry(markdown) {
  const start = markdown.indexOf("## 48.1 Core Metrics");
  const end = markdown.indexOf("\n---\n\n# 49. Runbook Registry", start);
  const section = markdown.slice(start, end);
  return section
    .split("\n")
    .filter((line) => line.startsWith("| `aa."))
    .map((line) => {
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim().replace(/^`|`$/g, ""));
      return { metric: cells[0] };
    });
}

function extractValidationSpanNames() {
  const source = readFile(
    "src/platform/shared/observability/validation-semantic-conventions.ts",
  );
  return [
    ...source.matchAll(/"aa\.[a-z0-9_.]+"/g),
  ].map((match) => match[0].slice(1, -1));
}

function writeClosureReports(reportValue) {
  const stagingRoot = join(artifactRoot, "reports.staging");
  rmSync(stagingRoot, { recursive: true, force: true });
  mkdirSync(stagingRoot, { recursive: true });
  const issueCount = (prefix) =>
    reportValue.issues.filter((issue) => issue.startsWith(prefix)).length;
  writeReport(stagingRoot, "validation-bundle.json", reportValue);
  writeReport(stagingRoot, "contract-report.json", {
    status: reportValue.status,
    registryVersion: reportValue.registryVersion,
    eventRegistrySnapshot: "contracts/event-registry.canonical.json",
    generatedPayloadTypes: "generated/typed-event-payloads.generated.ts",
  });
  writeReport(stagingRoot, "metric-registry-closure-report.json", {
    status: issueCount("monitoring.") === 0 ? "passed" : "failed",
    registryVersion: reportValue.registryVersion,
    runtimeMetricMappingCount: reportValue.checkedCounts.monitoringMetrics,
    targetMetricRegistry: "contracts/metric-registry.canonical.json",
  });
  writeReport(stagingRoot, "gate-registry-closure-report.json", {
    status: issueCount("gate.") === 0 ? "passed" : "failed",
    registryVersion: reportValue.registryVersion,
    gateCount: reportValue.checkedCounts.gates,
    gateRegistrySnapshot: "contracts/gate-registry.canonical.json",
  });
  writeReport(stagingRoot, "event-schema-coverage-report.json", {
    status:
      issueCount("artifact.event_payload_schema") === 0 ? "passed" : "failed",
    registryVersion: reportValue.registryVersion,
    eventRegistrySnapshot: "contracts/event-registry.canonical.json",
    payloadSchemaDirectory: "schemas/event-payload-schemas",
  });
  writeReport(stagingRoot, "runbook-registry-closure-report.json", {
    status: issueCount("runbook.") === 0 ? "passed" : "failed",
    registryVersion: reportValue.registryVersion,
    runbookCount: reportValue.checkedCounts.runbooks,
    runbookRegistrySnapshot: "contracts/runbook-registry.canonical.yaml",
  });
  rmSync(reportsRoot, { recursive: true, force: true });
  renameSync(stagingRoot, reportsRoot);
}

function writeReport(targetRoot, name, value) {
  writeFileSync(join(targetRoot, name), `${JSON.stringify(value, null, 2)}\n`);
}

function schemaFileName(eventType) {
  return eventType.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
}
