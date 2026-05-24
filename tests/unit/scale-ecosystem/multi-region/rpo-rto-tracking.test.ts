/**
 * Unit tests for RPO/RTO Tracking and SLA Compliance in multi-region
 *
 * R13-23: Verifies RPO/RTO guarantees per §52 requirements:
 * - Data-replicator lag measurement and SLA assertion
 * - Failover bounded completion time guarantees
 * - RPO/RTO tracking service with assertSlaCompliance
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  RpoRtoTrackingService,
  type RpoRtoTarget,
  type RpoRtoMeasurement,
  type RpoRtoStatus,
  type FailoverEvent,
  type ReplicationLagEvent,
  getRpoRtoTrackingService,
  resetRpoRtoTrackingService,
} from "../../../../src/scale-ecosystem/multi-region/rpo-rto-tracking.js";
import {
  DataReplicatorService,
  ReplicationEventBuffer,
  createDataReplicator,
  type ReplicationPolicy,
  type ReplicationEvent,
  type ReplicationLagMeasurement,
} from "../../../../src/scale-ecosystem/multi-region/data-replicator/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// RpoRtoTrackingService Tests
// ─────────────────────────────────────────────────────────────────────────────

test("RpoRtoTrackingService.registerTarget stores target", () => {
  const service = new RpoRtoTrackingService();
  const target: RpoRtoTarget = {
    targetId: "target-1",
    regionPairId: "us-east->eu-west",
    rpoMs: 30000,
    rtoMs: 60000,
    priority: "high",
  };

  service.registerTarget(target);
  const retrieved = service.getTarget("us-east->eu-west");
  assert.ok(retrieved !== undefined);
  assert.equal(retrieved?.rpoMs, 30000);
  assert.equal(retrieved?.rtoMs, 60000);
});

test("RpoRtoTrackingService.recordReplicationSequence updates sequence", () => {
  const service = new RpoRtoTrackingService();
  service.recordReplicationSequence("us-east", "eu-west", 100);
  const seq = service.getLastReplicationSequence("us-east", "eu-west");
  assert.equal(seq, 100);
});

test("RpoRtoTrackingService.recordReplicationLag detects RPO breach", () => {
  const service = new RpoRtoTrackingService();
  service.registerTarget({
    targetId: "target-1",
    regionPairId: "us-east->eu-west",
    rpoMs: 10000, // 10 second RPO
    rtoMs: 60000,
    priority: "high",
  });

  // Record 15 second lag - exceeds 10 second RPO
  const lag = service.recordReplicationLag("us-east", "eu-west", 15000);
  assert.equal(lag.exceedsRpo, true);
  assert.equal(lag.lagMs, 15000);
});

test("RpoRtoTrackingService.clearReplicationLag clears lag event", () => {
  const service = new RpoRtoTrackingService();
  service.recordReplicationLag("us-east", "eu-west", 5000);
  service.clearReplicationLag("us-east", "eu-west");

  const currentLag = service.getCurrentReplicationLag("us-east", "eu-west");
  assert.equal(currentLag, 0);
});

test("RpoRtoTrackingService.startFailover begins failover tracking", () => {
  const service = new RpoRtoTrackingService();
  const event = service.startFailover("us-east", "eu-west");

  assert.ok(event !== undefined);
  assert.equal(event.sourceRegionId, "us-east");
  assert.equal(event.targetRegionId, "eu-west");
  assert.equal(event.completedAt, null);
  assert.equal(event.success, false);
});

test("RpoRtoTrackingService.completeFailover calculates actual RTO", async () => {
  const service = new RpoRtoTrackingService();
  service.startFailover("us-east", "eu-west");

  // Small delay to ensure RTO is measurable
  await new Promise((resolve) => setTimeout(resolve, 10));

  const event = service.completeFailover("us-east", "eu-west", true, null);
  assert.equal(event.success, true);
  assert.ok(event.completedAt !== null);
  assert.ok(event.actualRtoMs !== null);
  assert.ok(event.actualRtoMs >= 0);
});

test("RpoRtoTrackingService.recordMeasurement detects breaches", () => {
  const service = new RpoRtoTrackingService();
  service.registerTarget({
    targetId: "target-1",
    regionPairId: "us-east->eu-west",
    rpoMs: 10000,
    rtoMs: 60000,
    priority: "high",
  });

  // Record 15 second RPO - exceeds 10 second target
  const measurement = service.recordMeasurement("us-east->eu-west", 15000, 30000);

  assert.equal(measurement.actualRpoMs, 15000);
  assert.equal(measurement.meetsTarget, false);
  assert.equal(measurement.breachSeverity, "warning"); // 15s is not > 2x 10s
});

test("RpoRtoTrackingService.recordMeasurement detects critical breach", () => {
  const service = new RpoRtoTrackingService();
  service.registerTarget({
    targetId: "target-1",
    regionPairId: "us-east->eu-west",
    rpoMs: 10000,
    rtoMs: 60000,
    priority: "high",
  });

  // Record 25 second RPO - exceeds 2x 10 second target = critical
  const measurement = service.recordMeasurement("us-east->eu-west", 25000, 30000);

  assert.equal(measurement.breachSeverity, "critical");
});

test("RpoRtoTrackingService.getStatus returns correct status", () => {
  const service = new RpoRtoTrackingService();
  service.registerTarget({
    targetId: "target-1",
    regionPairId: "us-east->eu-west",
    rpoMs: 10000,
    rtoMs: 60000,
    priority: "high",
  });
  service.recordReplicationLag("us-east", "eu-west", 5000);

  const status = service.getStatus("us-east->eu-west");
  assert.ok(status !== null);
  assert.equal(status?.targetRpoMs, 10000);
  assert.equal(status?.rpoBreached, false);
});

test("RpoRtoTrackingService.isMeetingSla returns false when breached", () => {
  const service = new RpoRtoTrackingService();
  service.registerTarget({
    targetId: "target-1",
    regionPairId: "us-east->eu-west",
    rpoMs: 10000,
    rtoMs: 60000,
    priority: "high",
  });
  service.recordMeasurement("us-east->eu-west", 15000, 30000);

  assert.equal(service.isMeetingSla("us-east->eu-west"), false);
});

test("RpoRtoTrackingService.isMeetingSla returns true when no breach", () => {
  const service = new RpoRtoTrackingService();
  service.registerTarget({
    targetId: "target-1",
    regionPairId: "us-east->eu-west",
    rpoMs: 10000,
    rtoMs: 60000,
    priority: "high",
  });
  service.recordMeasurement("us-east->eu-west", 5000, 30000);

  assert.equal(service.isMeetingSla("us-east->eu-west"), true);
});

test("RpoRtoTrackingService.getMeasurements returns measurement history", () => {
  const service = new RpoRtoTrackingService();
  service.registerTarget({
    targetId: "target-1",
    regionPairId: "us-east->eu-west",
    rpoMs: 10000,
    rtoMs: 60000,
    priority: "high",
  });

  service.recordMeasurement("us-east->eu-west", 5000, 30000);
  service.recordMeasurement("us-east->eu-west", 6000, 30000);

  const measurements = service.getMeasurements("us-east->eu-west", 10);
  assert.equal(measurements.length, 2);
});

test("RpoRtoTrackingService.getFailoverHistory returns failover events", () => {
  const service = new RpoRtoTrackingService();
  service.startFailover("us-east", "eu-west");

  const history = service.getFailoverHistory("us-east", "eu-west");
  assert.equal(history.length, 1);
});

test("RpoRtoTrackingService.getAverageRto returns average RTO", async () => {
  const service = new RpoRtoTrackingService();
  service.startFailover("us-east", "eu-west");
  await new Promise((resolve) => setTimeout(resolve, 5));
  service.completeFailover("us-east", "eu-west", true, null);

  const avg = service.getAverageRto("us-east", "eu-west");
  assert.ok(avg !== null);
  assert.ok(avg >= 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// R13-23: SLA Compliance Assertion Tests
// ─────────────────────────────────────────────────────────────────────────────

test("RpoRtoTrackingService.assertSlaCompliance does not throw when SLA met", () => {
  const service = new RpoRtoTrackingService();
  service.registerTarget({
    targetId: "target-1",
    regionPairId: "us-east->eu-west",
    rpoMs: 10000,
    rtoMs: 60000,
    priority: "high",
  });
  service.recordMeasurement("us-east->eu-west", 5000, 30000);

  // Should not throw
  service.assertSlaCompliance("us-east->eu-west");
});

test("RpoRtoTrackingService.assertSlaCompliance throws when RPO breached", () => {
  const service = new RpoRtoTrackingService();
  service.registerTarget({
    targetId: "target-1",
    regionPairId: "us-east->eu-west",
    rpoMs: 10000,
    rtoMs: 60000,
    priority: "high",
  });
  service.recordMeasurement("us-east->eu-west", 15000, 30000);

  assert.throws(
    () => service.assertSlaCompliance("us-east->eu-west"),
    /SLA_COMPLIANCE_FAILED.*RPO breach/,
  );
});

test("RpoRtoTrackingService.assertSlaCompliance throws when RTO breached", () => {
  const service = new RpoRtoTrackingService();
  service.registerTarget({
    targetId: "target-1",
    regionPairId: "us-east->eu-west",
    rpoMs: 10000,
    rtoMs: 60000,
    priority: "high",
  });
  service.recordMeasurement("us-east->eu-west", 5000, 90000);

  assert.throws(
    () => service.assertSlaCompliance("us-east->eu-west"),
    /SLA_COMPLIANCE_FAILED.*RTO breach/,
  );
});

test("RpoRtoTrackingService.getSlaCompliance returns compliant=false on breach", () => {
  const service = new RpoRtoTrackingService();
  service.registerTarget({
    targetId: "target-1",
    regionPairId: "us-east->eu-west",
    rpoMs: 10000,
    rtoMs: 60000,
    priority: "high",
  });
  service.recordMeasurement("us-east->eu-west", 15000, 30000);

  const result = service.getSlaCompliance("us-east->eu-west");
  assert.equal(result.compliant, false);
  assert.ok(result.breaches.length > 0);
});

test("RpoRtoTrackingService.getSlaCompliance returns compliant=true when SLA met", () => {
  const service = new RpoRtoTrackingService();
  service.registerTarget({
    targetId: "target-1",
    regionPairId: "us-east->eu-west",
    rpoMs: 10000,
    rtoMs: 60000,
    priority: "high",
  });
  service.recordMeasurement("us-east->eu-west", 5000, 30000);

  const result = service.getSlaCompliance("us-east->eu-west");
  assert.equal(result.compliant, true);
  assert.equal(result.breaches.length, 0);
});

test("RpoRtoTrackingService.getGuaranteeSummary returns detailed summary", () => {
  const service = new RpoRtoTrackingService();
  service.registerTarget({
    targetId: "target-1",
    regionPairId: "us-east->eu-west",
    rpoMs: 10000,
    rtoMs: 60000,
    priority: "high",
  });
  service.recordMeasurement("us-east->eu-west", 5000, 30000);

  const summary = service.getGuaranteeSummary("us-east->eu-west");
  assert.ok(summary !== null);
  assert.equal(summary.hasTarget, true);
  assert.equal(summary.rpoTargetMs, 10000);
  assert.equal(summary.rtoTargetMs, 60000);
  assert.equal(summary.rpoMet, true);
  assert.equal(summary.rtoMet, true);
  assert.equal(summary.consecutiveBreaches, 0);
});

test("RpoRtoTrackingService.getGuaranteeSummary returns null for unknown pair", () => {
  const service = new RpoRtoTrackingService();
  const summary = service.getGuaranteeSummary("unknown->unknown");
  assert.equal(summary, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// DataReplicatorService Lag Measurement Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DataReplicatorService.measureReplicationLag returns measurement", () => {
  const replicator = createDataReplicator("us-east", ["eu-west"], {
    sourceRegionId: "us-east",
    targetRegionIds: ["eu-west"],
    residencyMode: "same_jurisdiction",
  }, { rpoMs: 10000 });

  // Record some source sequences
  replicator.recordSourceSequence("eu-west", 50);

  const measurement = replicator.measureReplicationLag("eu-west");
  assert.ok(measurement !== null);
  assert.equal(measurement.sourceRegionId, "us-east");
  assert.equal(measurement.targetRegionId, "eu-west");
  assert.equal(measurement.exceedsRpo, false); // 0 lag should not exceed 10s RPO
});

test("DataReplicatorService.measureReplicationLag detects RPO breach", () => {
  const replicator = createDataReplicator("us-east", ["eu-west"], {
    sourceRegionId: "us-east",
    targetRegionIds: ["eu-west"],
    residencyMode: "same_jurisdiction",
  }, { rpoMs: 10000, batchSize: 10, flushIntervalMs: 1000 });

  // Record source sequence way ahead of checkpoint
  replicator.recordSourceSequence("eu-west", 1000);

  const measurement = replicator.measureReplicationLag("eu-west");
  assert.ok(measurement !== null);
  assert.equal(measurement.exceedsRpo, true);
});

test("DataReplicatorService.isRpoMet returns false when RPO breached", () => {
  const replicator = createDataReplicator("us-east", ["eu-west"], {
    sourceRegionId: "us-east",
    targetRegionIds: ["eu-west"],
    residencyMode: "same_jurisdiction",
  }, { rpoMs: 10000, batchSize: 10, flushIntervalMs: 1000 });

  replicator.recordSourceSequence("eu-west", 1000);

  assert.equal(replicator.isRpoMet("eu-west"), false);
});

test("DataReplicatorService.isRpoMet returns true when RPO met", () => {
  const replicator = createDataReplicator("us-east", ["eu-west"], {
    sourceRegionId: "us-east",
    targetRegionIds: ["eu-west"],
    residencyMode: "same_jurisdiction",
  }, { rpoMs: 10000 });

  replicator.recordSourceSequence("eu-west", 10);

  assert.equal(replicator.isRpoMet("eu-west"), true);
});

test("DataReplicatorService.getCurrentLag returns lag in ms", () => {
  const replicator = createDataReplicator("us-east", ["eu-west"], {
    sourceRegionId: "us-east",
    targetRegionIds: ["eu-west"],
    residencyMode: "same_jurisdiction",
  }, { rpoMs: 10000 });

  replicator.recordSourceSequence("eu-west", 100);

  const lag = replicator.getCurrentLag("eu-west");
  assert.ok(lag >= 0);
});

test("DataReplicatorService.getLagMeasurements returns all measurements", () => {
  const replicator = createDataReplicator("us-east", ["eu-west"], {
    sourceRegionId: "us-east",
    targetRegionIds: ["eu-west"],
    residencyMode: "same_jurisdiction",
  }, { rpoMs: 10000 });

  replicator.measureReplicationLag("eu-west");

  const measurements = replicator.getLagMeasurements();
  assert.ok(measurements.size >= 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Tests
// ─────────────────────────────────────────────────────────────────────────────

test("getRpoRtoTrackingService returns singleton instance", () => {
  resetRpoRtoTrackingService();
  const instance1 = getRpoRtoTrackingService();
  const instance2 = getRpoRtoTrackingService();
  assert.ok(instance1 === instance2);
});

test("resetRpoRtoTrackingService clears singleton", () => {
  const instance1 = getRpoRtoTrackingService();
  resetRpoRtoTrackingService();
  const instance2 = getRpoRtoTrackingService();
  assert.ok(instance1 !== instance2);
});
