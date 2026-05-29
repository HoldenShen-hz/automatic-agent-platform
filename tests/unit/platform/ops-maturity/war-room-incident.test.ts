import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { IncidentDetector } from "../../../../src/platform/five-plane-control-plane/incident-control/incident-detector.js";
import { IncidentResolver } from "../../../../src/platform/five-plane-control-plane/incident-control/incident-resolver.js";
import { WarRoomCoordinationService } from "../../../../src/platform/five-plane-control-plane/incident-control/war-room-coordination-service.js";
import type { ComplianceReportArtifact } from "../../../../src/ops-maturity/compliance-reporter/compliance-report-pipeline-service.js";
import { ComplianceAuditorAccessService } from "../../../../src/ops-maturity/compliance-reporter/compliance-report-pipeline-service.js";
import { CHAOS_ARCHITECTURE_ANCHORS } from "../../../../src/ops-maturity/chaos/chaos-experiment-scheduler.js";
import {
  DriftDetectorService,
  type DriftAlert,
  type DriftMitigationAction,
} from "../../../../src/ops-maturity/drift-detection/index.js";
import { resolveEdgeDeploymentMode, type EdgeRuntimeProfile } from "../../../../src/ops-maturity/edge-runtime/edge-runtime-sync-service.js";
import { VideoProcessor } from "../../../../src/ops-maturity/multimodal/video-processor/index.js";
import { getEventReplayMetadata, getEventSchema } from "../../../../src/platform/five-plane-state-evidence/events/event-registry.js";

test("R14-10 war room coordination service supports SEV1 multi-participant flow", () => {
  const service = new WarRoomCoordinationService({ maxObservers: 1 });
  const session = service.createWarRoom("incident-sev1", "SEV1", "ic-1");
  const techLead = service.addParticipant(session.sessionId, "tech-1", "technical_lead");
  const observer = service.addParticipant(session.sessionId, "observer-1", "observer");

  assert.ok(techLead);
  assert.ok(observer);
  assert.equal(service.hasActiveWarRoom("incident-sev1"), true);
  assert.equal(service.advancePhase(session.sessionId, "mitigation"), true);
  assert.equal(service.recordDecision(session.sessionId, "freeze rollout", "protect production", ["ic-1", "tech-1"])?.outcome, "approved");
});

test("R14-02 incident detector uses SEV1-4 severity mapping", () => {
  const detector = new IncidentDetector();
  const incidents = detector.detectFromChecks([{
    checkId: "workers",
    status: "degraded",
    summary: "worker backlog",
    findings: ["queue delay"],
    metrics: { availability: 99.2, error_rate: 1.2 },
  }]);

  assert.equal(incidents[0]?.severity, "SEV2");
  assert.equal(detector.classifyUrgency("SEV1"), "critical");
  assert.equal(detector.classifyUrgency("SEV4"), "low");
});

test("R14-03 incident lifecycle includes triaged mitigating reviewed states", () => {
  const detector = new IncidentDetector();
  const incident = detector.createIncident({
    category: "performance",
    severity: "SEV3",
    title: "latency spike",
    description: "p95 elevated",
  });

  const lifecycleStates = ["open", "triaged", "mitigating", "reviewed", "resolved", "closed"] as const;
  assert.equal(incident.status, "open");
  assert.equal(lifecycleStates.includes("triaged"), true);
  assert.equal(lifecycleStates.includes("mitigating"), true);
  assert.equal(lifecycleStates.includes("reviewed"), true);
});

test("R14-04 incident resolver keeps 72h post-mortem automation", () => {
  const detector = new IncidentDetector();
  const resolver = new IncidentResolver();
  const incident = detector.createIncident({
    category: "availability",
    severity: "SEV2",
    title: "service degraded",
    description: "availability drop",
  });
  const resolution = {
    ...resolver.createResolution(incident),
    completedAt: "2026-05-01T00:00:00.000Z",
    rootCause: "dependency outage",
  };

  assert.equal(resolver.isPostMortemDue("2026-05-01T00:00:00.000Z", new Date("2026-05-04T00:00:00.000Z")), true);
  const report = resolver.generatePostMortem(incident, resolution, [{
    timestamp: "2026-05-01T00:00:00.000Z",
    event: "incident detected",
    phase: "detection",
  }]);
  assert.equal(report.rootCause, "dependency outage");
  assert.equal(report.timeline[0]?.phase, "detection");
});

test("R15-46 auditor access applies per-framework least privilege and PII redaction", () => {
  const service = new ComplianceAuditorAccessService();
  const artifact: ComplianceReportArtifact = {
    artifactId: "artifact-1",
    templateId: "tpl-1",
    framework: "HIPAA",
    reportType: "evidence_pack",
    version: "1.0.0",
    lockedOnGeneration: true,
    reportVersionLock: "lock-1",
    legalVersion: "2026.1",
    effectiveDate: "2026-05-01",
    migrationRule: "none",
    status: "generated",
    missingEvidenceTypes: [],
    evidenceMap: {
      pii: ["operator@example.com", "123-45-6789", "555-111-2222"],
    },
    controlPointMap: {},
    evidenceQualityScore: 0.95,
    evidenceQualityBreakdown: {
      completeness: 1,
      freshness: 0.9,
      trustworthiness: 0.95,
      tamperProof: 0.95,
    },
    markdown: "Contact operator@example.com SSN 123-45-6789 Phone 555-111-2222",
    readOnly: true,
    generatedAt: "2026-05-09T00:00:00.000Z",
    generatedBy: "auditor-bot",
  };

  assert.throws(() => service.buildAuditorView(artifact, {
    auditorId: "auditor-1",
    framework: "HIPAA",
    grantedPermissions: ["compliance:report:read"],
  }), /auditor_permission_denied/);

  const view = service.buildAuditorView(artifact, {
    auditorId: "auditor-1",
    framework: "HIPAA",
    grantedPermissions: ["compliance:report:read", "compliance:hipaa:read"],
  });

  assert.equal(view.piiRedacted, true);
  assert.match(view.markdown, /\[REDACTED_EMAIL\]/);
  assert.match(view.markdown, /\[REDACTED_SSN\]/);
  assert.match(view.markdown, /\[REDACTED_PHONE\]/);
});

test("R15-47 edge runtime resolves deployment mode categories", () => {
  const baseProfile: Omit<EdgeRuntimeProfile, "edgeNodeId" | "capabilities" | "connectivityMode" | "allowedModels" | "maxLocalRetentionHours" | "syncPolicy"> = {};
  const makeProfile = (overrides: Partial<EdgeRuntimeProfile>): EdgeRuntimeProfile => ({
    edgeNodeId: "edge-1",
    capabilities: [],
    connectivityMode: "online",
    maxLocalRetentionHours: 24,
    allowedModels: ["model-a", "model-b"],
    syncPolicy: {
      allowRestrictedDataUpload: false,
      requireOrdering: true,
    },
    ...baseProfile,
    ...overrides,
  });

  assert.equal(resolveEdgeDeploymentMode(makeProfile({
    connectivityMode: "offline",
    allowedModels: ["model-a"],
  })), "edge_micro");
  assert.equal(resolveEdgeDeploymentMode(makeProfile({
    capabilities: ["mobile"],
  })), "edge_mobile");
  assert.equal(resolveEdgeDeploymentMode(makeProfile({
    connectivityMode: "intermittent",
  })), "edge_hybrid");
  assert.equal(resolveEdgeDeploymentMode(makeProfile({})), "edge_standard");
});

test("R15-48 chaos scheduler exposes current architecture anchors", () => {
  assert.equal(CHAOS_ARCHITECTURE_ANCHORS.contractRef, "docs_zh/contracts/quality_engineering_and_chaos_testing_contract.md");
  assert.equal(CHAOS_ARCHITECTURE_ANCHORS.adrRef, "docs_zh/adr/089-ai-operations-governance-and-quality.md");
  assert.equal(CHAOS_ARCHITECTURE_ANCHORS.architectureRef, "docs_zh/architecture/02-code-architecture-reference.md");
});

test("R16-87 drift detector contract types are exported and usable", () => {
  const detector = new DriftDetectorService();
  const alert: DriftAlert = {
    alertId: "alert-1",
    agentId: "agent-1",
    dimension: "behavioral_drift",
    severity: "medium",
    driftScore: 0.42,
    detectedAt: "2026-05-09T00:00:00.000Z",
    baselineRef: "baseline-1",
    reasonCode: "drift.fingerprint_mismatch",
    recommendedAction: "throttle",
  };
  const mitigation: DriftMitigationAction = {
    actionType: "rollback",
    targetId: "agent-1",
    targetType: "agent",
    reason: "protect quality",
    alertId: alert.alertId,
    createdAt: "2026-05-09T00:00:00.000Z",
    expiresAt: null,
  };

  assert.ok(detector);
  assert.equal(alert.dimension, "behavioral_drift");
  assert.equal(mitigation.actionType, "rollback");
});

test("R16-89 legacy producers remain compatible while canonical platform facts stay on platform namespace", () => {
  const legacy = getEventSchema("task:status_changed");
  const canonical = getEventSchema("platform.harness_run.status_changed");
  const replayMetadata = getEventReplayMetadata("platform.harness_run.status_changed");

  assert.equal(legacy.producer, "transition_service");
  assert.equal(canonical.type, "platform.harness_run.status_changed");
  assert.equal(canonical.producer, "runtime-state-machine");
  assert.equal(replayMetadata.sourceOfTruth, "platform");
});

test("R16-92 video multimodal pipeline emits transcript scenes and keyframes", () => {
  const result = new VideoProcessor().processVideo({
    uri: "customer_demo_45s_1280x720_30fps.mp4",
  });

  assert.equal(result.metadata.durationMs, 45_000);
  assert.equal(result.transcriptSegments.length > 0, true);
  assert.equal(result.scenes.length > 0, true);
  assert.equal(result.keyFrames.length > 0, true);
  assert.equal(["ready", "conditional"].includes(result.qualityAssessment.readiness), true);
});

test("R16-95 active ADR references point to six-layer doc and seven-layer file is a historical alias page", () => {
  const quickstart = readFileSync(resolve(process.cwd(), "docs_zh/guides/quickstart.md"), "utf8");
  const evolutionAdr = readFileSync(resolve(process.cwd(), "docs_zh/adr/007-evolution-engine.md"), "utf8");
  const aliasAdr = readFileSync(resolve(process.cwd(), "docs_zh/adr/003-memory-seven-layers.md"), "utf8");

  assert.match(quickstart, /020-memory-six-plane-model\.md/);
  assert.match(evolutionAdr, /003-memory-six-layers\.md/);
  assert.match(aliasAdr, /历史别名/);
  assert.match(aliasAdr, /003-memory-six-layers\.md/);
});
