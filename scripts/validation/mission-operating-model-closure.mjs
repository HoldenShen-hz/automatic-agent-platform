import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const registryPath = join(root, "config/validation/mission-operating-model-registry.json");
const metricAlertPolicyPath = join(root, "config/validation/mission-operating-model-metric-alert-policy.yaml");
const referenceDocPath = join(root, "docs_zh/reference/anthropic_founders_playbook_to_automatic_agent_platform_v1_6_2.md");
const artifactRoot = join(root, "artifacts/validation/mission-operating-model");
const mode = process.argv[2] ?? "registry";
const registry = JSON.parse(readFileSync(registryPath, "utf8"));
const metricAlertPolicy = JSON.parse(readFileSync(metricAlertPolicyPath, "utf8"));
const issues = [];

validateRegistry(registry, issues);
validateMetricAlertPolicy(registry, metricAlertPolicy, issues);
if (mode === "playbook") {
  validatePlaybooks(registry.playbooks, issues);
}
if (mode === "outcome") {
  requireGate("GATE-MISSION-OUTCOME-001", issues);
  requireEvent("platform.mission.outcome_measured", issues);
}
if (mode === "skill-candidate") {
  requireGate("GATE-SKILL-CANDIDATE-001", issues);
}
if (mode === "skillpack") {
  requireGate("GATE-SKILLPACK-001", issues);
}
if (mode === "workflow-recording-policy") {
  requireGate("GATE-WORKFLOW-RECORDING-001", issues);
}
if (mode === "workflow-recording-data-boundary") {
  requireGate("GATE-WORKFLOW-RECORDING-002", issues);
}
if (mode === "workflow-recording-retention") {
  requireGate("GATE-WORKFLOW-RECORDING-003", issues);
}
if (mode === "markdown-render") {
  validateMarkdownFences(referenceDocPath, issues);
}

const report = {
  mode,
  status: issues.length === 0 ? "passed" : "failed",
  registryVersion: registry.version,
  checkedAt: new Date().toISOString(),
  checkedCounts: {
    gates: registry.gates.length,
    metrics: registry.metrics.length,
    metricAlertPolicies: metricAlertPolicy.metrics.length,
    events: registry.events.length,
    runbooks: registry.runbooks.length,
    ciJobs: registry.ciJobs.length,
    playbooks: registry.playbooks.length
  },
  artifacts: {
    registryPath,
    metricAlertPolicyPath
  },
  issues
};
mkdirSync(artifactRoot, { recursive: true });
const artifact = join(artifactRoot, artifactName(mode));
writeFileSync(artifact, `${JSON.stringify(report, null, 2)}\n`, "utf8");
if (issues.length > 0) {
  console.error(`${mode} validation failed: ${issues.join("; ")}`);
  process.exitCode = 1;
} else {
  console.log(`${mode} validation passed: ${artifact}`);
}

function validateRegistry(input, target) {
  for (const field of ["version", "gates", "metrics", "events", "runbooks", "ciJobs", "playbooks"]) {
    if (!(field in input) || (Array.isArray(input[field]) && input[field].length === 0)) {
      target.push(`registry.${field}.missing`);
    }
  }
  const ciJobs = new Set(input.ciJobs.map((job) => job.jobId));
  const gates = new Set(input.gates.map((gate) => gate.gateId));
  const runbooks = new Set(input.runbooks.map((runbook) => runbook.runbookId));
  for (const gate of input.gates) {
    if (!ciJobs.has(gate.ciJob)) {
      target.push(`gate.${gate.gateId}.ci_job_missing`);
    }
    if (!runbooks.has(gate.runbookId)) {
      target.push(`gate.${gate.gateId}.runbook_missing`);
    }
  }
  for (const job of input.ciJobs) {
    for (const gateId of job.blocks) {
      if (!gates.has(gateId)) {
        target.push(`ci_job.${job.jobId}.gate_missing:${gateId}`);
      }
    }
  }
  validatePlaybooks(input.playbooks, target);
}

function validateMetricAlertPolicy(registryInput, policy, target) {
  if (typeof policy !== "object" || policy == null) {
    target.push("metric_alert_policy.invalid");
    return;
  }
  if (typeof policy.metricAlertPolicy !== "object" || policy.metricAlertPolicy == null) {
    target.push("metric_alert_policy.root_missing");
  }
  if (!Array.isArray(policy.metrics) || policy.metrics.length === 0) {
    target.push("metric_alert_policy.metrics_missing");
    return;
  }
  const registryMetrics = new Set(registryInput.metrics.map((entry) => entry.metric));
  for (const requiredMetric of [
    "aa.mission.playbook.use_last_active.count",
    "aa.mission.playbook.unsafe_fallback_blocked.count",
    "aa.workflow.recording.retention_expired_not_deleted.count"
  ]) {
    if (!policy.metrics.some((entry) => entry.metric === requiredMetric)) {
      target.push(`metric_alert_policy.required_metric_missing:${requiredMetric}`);
    }
  }
  for (const entry of policy.metrics) {
    if (typeof entry.metric !== "string" || entry.metric.length === 0) {
      target.push("metric_alert_policy.metric_name_missing");
      continue;
    }
    if (!registryMetrics.has(entry.metric)) {
      target.push(`metric_alert_policy.metric_not_in_registry:${entry.metric}`);
    }
    if (typeof entry.defaultSeverity !== "string" || entry.defaultSeverity.length === 0) {
      target.push(`metric_alert_policy.default_severity_missing:${entry.metric}`);
    }
    if (!Array.isArray(entry.escalationRules)) {
      target.push(`metric_alert_policy.escalation_rules_missing:${entry.metric}`);
    }
  }
}

function validatePlaybooks(playbooks, target) {
  for (const playbook of playbooks) {
    const stageIds = new Set(playbook.stages.map((stage) => stage.stageId));
    if (!stageIds.has(playbook.entryStageId)) {
      target.push(`playbook.${playbook.playbookId}.entry_stage_missing`);
    }
    for (const stage of playbook.stages) {
      if (stage.exitCriteria.length === 0 || stage.failureModeRefs.length === 0) {
        target.push(`playbook.${playbook.playbookId}.stage_incomplete:${stage.stageId}`);
      }
    }
    for (const edge of playbook.edges) {
      if (!stageIds.has(edge.fromStageId) || !stageIds.has(edge.toStageId)) {
        target.push(`playbook.${playbook.playbookId}.edge_stage_missing:${edge.edgeId}`);
      }
    }
  }
}

function validateMarkdownFences(path, target) {
  const fenceCount = readFileSync(path, "utf8").split(/\r?\n/u).filter((line) => line.trimStart().startsWith("```")).length;
  if (fenceCount % 2 !== 0) {
    target.push("docs.markdown_fence_unbalanced");
  }
}

function requireGate(gateId, target) {
  if (!registry.gates.some((gate) => gate.gateId === gateId)) {
    target.push(`gate.${gateId}.missing`);
  }
}

function requireEvent(eventName, target) {
  if (!registry.events.includes(eventName)) {
    target.push(`event.${eventName}.missing`);
  }
}

function artifactName(value) {
  return {
    registry: "registry-closure-report.json",
    playbook: "playbook-validation-report.json",
    outcome: "mission-outcome-validation-report.json",
    "skill-candidate": "skill-candidate-validation-report.json",
    skillpack: "skillpack-validation-report.json",
    "workflow-recording-policy": "workflow-recording-policy-report.json",
    "workflow-recording-data-boundary": "workflow-recording-data-boundary-report.json",
    "workflow-recording-retention": "workflow-recording-retention-report.json",
    "markdown-render": "markdown-render-report.json"
  }[value] ?? `${value}-report.json`;
}
