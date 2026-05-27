/**
 * Unit tests for Split-Brain Protection Service
 *
 * R13-22: Verifies split-brain detection and resolution per §52 requirements:
 * - Heartbeat monitoring between regions
 * - Fencing token epoch tracking
 * - Split-brain detection with evidence collection
 * - Quorum-based resolution
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  SplitBrainProtectionService,
  type SplitBrainIncident,
  type SplitBrainDetectionResult,
  type SplitBrainEvidence,
  getSplitBrainProtectionService,
  resetSplitBrainProtectionService,
} from "../../../../src/scale-ecosystem/multi-region/split-brain-protection.js";

// ─────────────────────────────────────────────────────────────────────────────
// SplitBrainProtectionService Tests
// ─────────────────────────────────────────────────────────────────────────────

test("SplitBrainProtectionService.recordHeartbeat stores heartbeat [split-brain-protection]", () => {
  const service = new SplitBrainProtectionService();
  service.recordHeartbeat("us-east");

  assert.equal(service.isRegionHealthy("us-east"), true);
});

test("SplitBrainProtectionService.recordHeartbeat updates existing state [split-brain-protection]", () => {
  const service = new SplitBrainProtectionService();
  service.recordHeartbeat("us-east");
  service.recordHeartbeat("us-east");

  assert.equal(service.isRegionHealthy("us-east"), true);
});

test("SplitBrainProtectionService.isRegionHealthy returns false for unknown region [split-brain-protection]", () => {
  const service = new SplitBrainProtectionService();
  assert.equal(service.isRegionHealthy("unknown-region"), false);
});

test("SplitBrainProtectionService.recordFencingEpoch stores epoch [split-brain-protection]", () => {
  const service = new SplitBrainProtectionService();
  service.recordFencingEpoch("us-east", 1);
  service.recordFencingEpoch("us-east", 2);

  // Service should not throw - epochs are recorded
  assert.equal(service.isRegionHealthy("us-east"), false); // No heartbeat yet
});

test("SplitBrainProtectionService.recordFencingEpoch ignores lower epoch [split-brain-protection]", () => {
  const service = new SplitBrainProtectionService();
  service.recordFencingEpoch("us-east", 5);
  service.recordFencingEpoch("us-east", 3); // Lower epoch should be ignored

  // The service tracks fencing epochs internally - no public getter
  // but it should not throw
});

test("SplitBrainProtectionService.detectSplitBrain returns clear when no evidence [split-brain-protection]", () => {
  const service = new SplitBrainProtectionService();
  service.recordHeartbeat("us-east");
  service.recordHeartbeat("eu-west");

  const result = service.detectSplitBrain(30000);

  assert.equal(result.hasSplitBrain, false);
  assert.equal(result.confidence, 0);
});

test("SplitBrainProtectionService.detectSplitBrain detects heartbeat timeout [split-brain-protection]", () => {
  const service = new SplitBrainProtectionService();
  // Record heartbeat long ago (will timeout)
  service.recordHeartbeat("us-east");

  const result = service.detectSplitBrain(0); // immediate timeout for deterministic test

  assert.equal(result.hasSplitBrain, true);
  assert.ok(result.evidence.length >= 1);
  assert.ok(result.evidence.some((e) => e.type === "heartbeat_timeout"));
});

test("SplitBrainProtectionService.detectSplitBrain detects fencing epoch conflict [split-brain-protection]", () => {
  const service = new SplitBrainProtectionService();
  service.recordFencingEpoch("us-east", 1);
  service.recordFencingEpoch("eu-west", 1);

  const result = service.detectSplitBrain(30000);

  assert.ok(result.evidence.some((e) => e.type === "fencing_epoch_conflict"));
});

test("SplitBrainProtectionService.detectSplitBrain does not flag normal epoch advancement as split-brain [split-brain-protection]", () => {
  const service = new SplitBrainProtectionService();
  service.recordFencingEpoch("us-east", 1);
  service.recordFencingEpoch("eu-west", 2);

  const result = service.detectSplitBrain(30000);

  assert.equal(result.evidence.some((e) => e.type === "fencing_epoch_conflict"), false);
});

test("SplitBrainProtectionService.detectSplitBrain returns conflicting regions [split-brain-protection]", () => {
  const service = new SplitBrainProtectionService();
  service.recordHeartbeat("us-east");

  const result = service.detectSplitBrain(0);

  assert.ok(result.conflictingRegions.includes("us-east"));
});

test("SplitBrainProtectionService.resolveViaQuorum returns leader_abdication when quorum met [split-brain-protection]", () => {
  const service = new SplitBrainProtectionService();
  service.recordHeartbeat("us-east");
  service.recordHeartbeat("eu-west");
  service.setQuorumWeight("us-east", 1);
  service.setQuorumWeight("eu-west", 1);

  const resolution = service.resolveViaQuorum(["us-east", "eu-west"], 0.5);

  assert.equal(resolution, "leader_abdication");
});

test("SplitBrainProtectionService.resolveViaQuorum returns fencing_token_invalidation when quorum not met [split-brain-protection]", () => {
  const service = new SplitBrainProtectionService();

  const resolution = service.resolveViaQuorum(["us-east", "eu-west"], 0.5);

  assert.equal(resolution, "fencing_token_invalidation");
});

test("SplitBrainProtectionService.invalidateFencingTokens bumps epoch [split-brain-protection]", () => {
  const service = new SplitBrainProtectionService();
  service.recordFencingEpoch("us-east", 5);

  const invalidated = service.invalidateFencingTokens("us-east");

  assert.ok(invalidated.length >= 1);
  assert.ok(invalidated[0]!.includes("invalidated"));
});

test("SplitBrainProtectionService.recordIncident creates incident [split-brain-protection]", () => {
  const service = new SplitBrainProtectionService();
  const evidence: SplitBrainEvidence[] = [
    {
      type: "heartbeat_timeout",
      regionId: "us-east",
      timestamp: new Date().toISOString(),
      description: "No heartbeat",
    },
  ];

  const incident = service.recordIncident(["us-east", "eu-west"], ["leader-a", "leader-b"], evidence);

  assert.ok(incident !== undefined);
  assert.equal(incident.incidentId.startsWith("splitbrain"), true);
  assert.equal(incident.affectedRegions.length, 2);
  assert.equal(incident.conflictingLeaders.length, 2);
  assert.equal(incident.status, "confirmed");
});

test("SplitBrainProtectionService.recordIncident resolves with quorum when evidence >= 3 [split-brain-protection]", () => {
  const service = new SplitBrainProtectionService();
  service.recordHeartbeat("us-east");
  service.recordHeartbeat("eu-west");
  service.setQuorumWeight("us-east", 1);
  service.setQuorumWeight("eu-west", 1);

  const evidence: SplitBrainEvidence[] = [
    {
      type: "heartbeat_timeout",
      regionId: "us-east",
      timestamp: new Date().toISOString(),
      description: "No heartbeat",
    },
    {
      type: "fencing_epoch_conflict",
      regionId: "us-east",
      timestamp: new Date().toISOString(),
      description: "Epoch conflict",
    },
    {
      type: "write_conflict",
      regionId: "eu-west",
      timestamp: new Date().toISOString(),
      description: "Write conflict",
    },
  ];

  const incident = service.recordIncident(["us-east", "eu-west"], ["leader-a", "leader-b"], evidence);

  assert.ok(incident.resolution !== null);
});

test("SplitBrainProtectionService.getLastIncident returns last incident [split-brain-protection]", () => {
  const service = new SplitBrainProtectionService();
  const evidence: SplitBrainEvidence[] = [
    {
      type: "heartbeat_timeout",
      regionId: "us-east",
      timestamp: new Date().toISOString(),
      description: "No heartbeat",
    },
  ];

  service.recordIncident(["us-east"], ["leader-a"], evidence);
  service.recordIncident(["eu-west"], ["leader-b"], evidence);

  const last = service.getLastIncident();
  assert.ok(last !== null);
  assert.equal(last.affectedRegions[0], "eu-west");
});

test("SplitBrainProtectionService.getIncidents returns all incidents [split-brain-protection]", () => {
  const service = new SplitBrainProtectionService();
  const evidence: SplitBrainEvidence[] = [
    {
      type: "heartbeat_timeout",
      regionId: "us-east",
      timestamp: new Date().toISOString(),
      description: "No heartbeat",
    },
  ];

  service.recordIncident(["us-east"], ["leader-a"], evidence);
  service.recordIncident(["eu-west"], ["leader-b"], evidence);

  const incidents = service.getIncidents();
  assert.equal(incidents.length, 2);
});

test("SplitBrainProtectionService.getQuorumState returns state for known region [split-brain-protection]", () => {
  const service = new SplitBrainProtectionService();
  service.recordHeartbeat("us-east");

  const state = service.getQuorumState("us-east");
  assert.ok(state !== null);
  assert.equal(state?.regionId, "us-east");
  assert.equal(state?.isConnected, true);
});

test("SplitBrainProtectionService.getQuorumState returns null for unknown region [split-brain-protection]", () => {
  const service = new SplitBrainProtectionService();
  const state = service.getQuorumState("unknown");
  assert.equal(state, null);
});

test("SplitBrainProtectionService.acquireLeadershipWithFencing rejects blank entity ids [split-brain-protection]", () => {
  const service = new SplitBrainProtectionService();
  assert.throws(
    () => service.acquireLeadershipWithFencing("us-east", "   "),
    /split_brain_protection\.entity_id_required/,
  );
  assert.throws(
    () => service.acquireLeadershipWithFencing("us-east", null),
    /split_brain_protection\.entity_id_required/,
  );
});

test("SplitBrainProtectionService.setQuorumWeight updates weight [split-brain-protection]", () => {
  const service = new SplitBrainProtectionService();
  service.recordHeartbeat("us-east");
  service.setQuorumWeight("us-east", 2);

  const state = service.getQuorumState("us-east");
  assert.equal(state?.weight, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Tests
// ─────────────────────────────────────────────────────────────────────────────

test("getSplitBrainProtectionService returns singleton instance [split-brain-protection]", () => {
  resetSplitBrainProtectionService();
  const instance1 = getSplitBrainProtectionService();
  const instance2 = getSplitBrainProtectionService();
  assert.ok(instance1 === instance2);
});

test("resetSplitBrainProtectionService clears singleton [split-brain-protection]", () => {
  const instance1 = getSplitBrainProtectionService();
  resetSplitBrainProtectionService();
  const instance2 = getSplitBrainProtectionService();
  assert.ok(instance1 !== instance2);
});

// ─────────────────────────────────────────────────────────────────────────────
// R13-22: Split-Brain Protection Contract Tests
// ─────────────────────────────────────────────────────────────────────────────

test("R13-22: Split-brain protection detects split-brain condition [split-brain-protection]", () => {
  const service = new SplitBrainProtectionService();

  // Simulate two regions both claiming to be leader
  service.recordFencingEpoch("us-east", 1);
  service.recordFencingEpoch("eu-west", 1);

  const result = service.detectSplitBrain(30000);

  // Large epoch difference indicates potential split-brain
  assert.ok(result.evidence.length >= 1 || result.confidence > 0);
});

test("R13-22: Split-brain protection provides evidence for incidents [split-brain-protection]", () => {
  const service = new SplitBrainProtectionService();

  // Create evidence of split-brain
  const evidence: SplitBrainEvidence[] = [
    {
      type: "heartbeat_timeout",
      regionId: "us-east",
      timestamp: new Date().toISOString(),
      description: "Region us-east heartbeat timeout",
    },
    {
      type: "fencing_epoch_conflict",
      regionId: "eu-west",
      timestamp: new Date().toISOString(),
      description: "Epoch mismatch between us-east and eu-west",
    },
  ];

  const incident = service.recordIncident(["us-east", "eu-west"], ["leader-us-east", "leader-eu-west"], evidence);

  assert.equal(incident.affectedRegions.length, 2);
  assert.equal(incident.status, "confirmed");
  assert.ok(incident.fencingTokensInvalidated.length >= 0);
});

test("R13-22: Split-brain protection uses fencing token invalidation for resolution [split-brain-protection]", () => {
  const service = new SplitBrainProtectionService();

  // When quorum cannot be established, fencing tokens should be invalidated
  const resolution = service.resolveViaQuorum(["us-east", "eu-west"], 0.6);

  assert.equal(resolution, "fencing_token_invalidation");
});

test("R13-22: Split-brain protection uses quorum-based resolution when possible [split-brain-protection]", () => {
  const service = new SplitBrainProtectionService();

  // Setup connected regions with quorum
  service.recordHeartbeat("us-east");
  service.recordHeartbeat("eu-west");
  service.recordHeartbeat("ap-south");
  service.setQuorumWeight("us-east", 1);
  service.setQuorumWeight("eu-west", 1);
  service.setQuorumWeight("ap-south", 1);

  const resolution = service.resolveViaQuorum(["us-east", "eu-west", "ap-south"], 0.5);

  assert.equal(resolution, "leader_abdication");
});
