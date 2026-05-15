/**
 * Unit tests for state-evidence-plane-baseline
 *
 * Tests the state evidence plane baseline capabilities including:
 * - Capability IDs enumeration
 * - Baseline catalog structure and contents
 * - Baseline resolution functions
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  STATE_EVIDENCE_CAPABILITY_BASELINES,
  listStateEvidenceCapabilityBaselines,
  resolveStateEvidenceCapabilityBaseline,
  type StateEvidenceCapabilityId,
} from "../../../../src/platform/five-plane-state-evidence/state-evidence-plane-baseline.js";

test("STATE_EVIDENCE_CAPABILITY_BASELINES is a frozen array", () => {
  assert.ok(Array.isArray(STATE_EVIDENCE_CAPABILITY_BASELINES));
  assert.equal(Object.isFrozen(STATE_EVIDENCE_CAPABILITY_BASELINES), true);
});

test("listStateEvidenceCapabilityBaselines returns all 10 capability baselines", () => {
  const baselines = listStateEvidenceCapabilityBaselines();
  assert.equal(baselines.length, 10, "expected 10 capability baselines");
});

test("listStateEvidenceCapabilityBaselines returns frozen array", () => {
  const baselines = listStateEvidenceCapabilityBaselines();
  assert.equal(Object.isFrozen(baselines), true);
});

test("STATE_EVIDENCE_CAPABILITY_BASELINES contains artifacts capability", () => {
  const artifacts = STATE_EVIDENCE_CAPABILITY_BASELINES.find((b) => b.capabilityId === "artifacts");
  assert.ok(artifacts, "artifacts capability should exist");
  assert.equal(artifacts.entryModule, "src/platform/five-plane-state-evidence/artifacts/index.ts");
  assert.ok(artifacts.baselineServices.includes("ArtifactStoreService"));
});

test("STATE_EVIDENCE_CAPABILITY_BASELINES contains audit capability", () => {
  const audit = STATE_EVIDENCE_CAPABILITY_BASELINES.find((b) => b.capabilityId === "audit");
  assert.ok(audit, "audit capability should exist");
  assert.equal(audit.entryModule, "src/platform/five-plane-state-evidence/audit/index.ts");
  assert.ok(audit.baselineServices.includes("AuditTrailService"));
});

test("STATE_EVIDENCE_CAPABILITY_BASELINES contains checkpoints capability", () => {
  const checkpoints = STATE_EVIDENCE_CAPABILITY_BASELINES.find((b) => b.capabilityId === "checkpoints");
  assert.ok(checkpoints, "checkpoints capability should exist");
  assert.equal(checkpoints.entryModule, "src/platform/five-plane-state-evidence/checkpoints/index.ts");
  assert.ok(checkpoints.baselineServices.includes("CheckpointStoreService"));
});

test("STATE_EVIDENCE_CAPABILITY_BASELINES contains dlq capability", () => {
  const dlq = STATE_EVIDENCE_CAPABILITY_BASELINES.find((b) => b.capabilityId === "dlq");
  assert.ok(dlq, "dlq capability should exist");
  assert.equal(dlq.entryModule, "src/platform/five-plane-state-evidence/dlq/index.ts");
  assert.ok(dlq.baselineServices.includes("DlqService"));
});

test("STATE_EVIDENCE_CAPABILITY_BASELINES contains events capability", () => {
  const events = STATE_EVIDENCE_CAPABILITY_BASELINES.find((b) => b.capabilityId === "events");
  assert.ok(events, "events capability should exist");
  assert.equal(events.entryModule, "src/platform/five-plane-state-evidence/events/index.ts");
  assert.ok(events.baselineServices.includes("TypedEventPublisher"));
});

test("STATE_EVIDENCE_CAPABILITY_BASELINES contains incident capability", () => {
  const incident = STATE_EVIDENCE_CAPABILITY_BASELINES.find((b) => b.capabilityId === "incident");
  assert.ok(incident, "incident capability should exist");
  assert.equal(incident.entryModule, "src/platform/five-plane-state-evidence/incident/index.ts");
  assert.ok(incident.baselineServices.includes("IncidentRepository"));
});

test("STATE_EVIDENCE_CAPABILITY_BASELINES contains knowledge capability", () => {
  const knowledge = STATE_EVIDENCE_CAPABILITY_BASELINES.find((b) => b.capabilityId === "knowledge");
  assert.ok(knowledge, "knowledge capability should exist");
  assert.equal(knowledge.entryModule, "src/platform/five-plane-state-evidence/knowledge/index.ts");
  assert.ok(knowledge.baselineServices.includes("KnowledgePlaneService"));
});

test("STATE_EVIDENCE_CAPABILITY_BASELINES contains memory capability", () => {
  const memory = STATE_EVIDENCE_CAPABILITY_BASELINES.find((b) => b.capabilityId === "memory");
  assert.ok(memory, "memory capability should exist");
  assert.equal(memory.entryModule, "src/platform/five-plane-state-evidence/memory/index.ts");
  assert.ok(memory.baselineServices.includes("MemoryStoreService"));
});

test("STATE_EVIDENCE_CAPABILITY_BASELINES contains projections capability", () => {
  const projections = STATE_EVIDENCE_CAPABILITY_BASELINES.find((b) => b.capabilityId === "projections");
  assert.ok(projections, "projections capability should exist");
  assert.equal(projections.entryModule, "src/platform/five-plane-state-evidence/projections/index.ts");
  assert.ok(projections.baselineServices.includes("ProjectionRebuilder"));
});

test("STATE_EVIDENCE_CAPABILITY_BASELINES contains truth capability", () => {
  const truth = STATE_EVIDENCE_CAPABILITY_BASELINES.find((b) => b.capabilityId === "truth");
  assert.ok(truth, "truth capability should exist");
  assert.equal(truth.entryModule, "src/platform/five-plane-state-evidence/truth/index.ts");
  assert.ok(truth.baselineServices.includes("AuthoritativeTaskStore"));
});

test("resolveStateEvidenceCapabilityBaseline resolves valid capability", () => {
  const baseline = resolveStateEvidenceCapabilityBaseline("artifacts");
  assert.equal(baseline.capabilityId, "artifacts");
  assert.equal(baseline.entryModule, "src/platform/five-plane-state-evidence/artifacts/index.ts");
});

test("resolveStateEvidenceCapabilityBaseline resolves truth capability", () => {
  const baseline = resolveStateEvidenceCapabilityBaseline("truth");
  assert.equal(baseline.capabilityId, "truth");
  assert.ok(baseline.baselineServices.includes("AuthoritativeTaskStore"));
});

test("resolveStateEvidenceCapabilityBaseline throws for unknown capability", () => {
  assert.throws(
    () => resolveStateEvidenceCapabilityBaseline("unknown" as StateEvidenceCapabilityId),
    /state_evidence_capability.not_found:unknown/,
  );
});

test("resolveStateEvidenceCapabilityBaseline throws for invalid id", () => {
  assert.throws(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => resolveStateEvidenceCapabilityBaseline("nonexistent" as StateEvidenceCapabilityId),
    /state_evidence_capability.not_found:nonexistent/,
  );
});

test("capability baselines have required fields", () => {
  for (const baseline of STATE_EVIDENCE_CAPABILITY_BASELINES) {
    assert.ok(typeof baseline.capabilityId === "string", `${baseline.capabilityId} should have capabilityId`);
    assert.ok(typeof baseline.entryModule === "string", `${baseline.capabilityId} should have entryModule`);
    assert.ok(typeof baseline.description === "string", `${baseline.capabilityId} should have description`);
    assert.ok(Array.isArray(baseline.baselineServices), `${baseline.capabilityId} should have baselineServices array`);
    assert.ok(baseline.baselineServices.length > 0, `${baseline.capabilityId} should have at least one baseline service`);
  }
});

test("all StateEvidenceCapabilityId values are present in baselines", () => {
  const validIds: StateEvidenceCapabilityId[] = [
    "artifacts",
    "audit",
    "checkpoints",
    "dlq",
    "events",
    "incident",
    "knowledge",
    "memory",
    "projections",
    "truth",
  ];

  for (const id of validIds) {
    const baseline = STATE_EVIDENCE_CAPABILITY_BASELINES.find((b) => b.capabilityId === id);
    assert.ok(baseline, `${id} should be present in STATE_EVIDENCE_CAPABILITY_BASELINES`);
  }
});

test("StateEvidenceCapabilityId type is inferrable from baseline", () => {
  const baseline = resolveStateEvidenceCapabilityBaseline("memory");
  const capabilityId: StateEvidenceCapabilityId = baseline.capabilityId;
  assert.equal(capabilityId, "memory");
});

test("all baseline descriptions are non-empty", () => {
  for (const baseline of STATE_EVIDENCE_CAPABILITY_BASELINES) {
    assert.ok(baseline.description.length > 0, `${baseline.capabilityId} should have non-empty description`);
  }
});

test("all baseline entryModules start with src/platform", () => {
  for (const baseline of STATE_EVIDENCE_CAPABILITY_BASELINES) {
    assert.ok(
      baseline.entryModule.startsWith("src/platform/"),
      `${baseline.capabilityId} entryModule should start with src/platform/`,
    );
  }
});
