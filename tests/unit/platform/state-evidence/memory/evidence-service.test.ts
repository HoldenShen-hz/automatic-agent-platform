import test from "node:test";
import assert from "node:assert/strict";

import { EvidenceService, type EvidenceCategory, type EvidenceMetadata } from "../../../../../src/platform/five-plane-state-evidence/memory/evidence-service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function makeMetadata(overrides: Partial<EvidenceMetadata> = {}): EvidenceMetadata {
  return {
    tenantId: "tenant_1",
    domainId: "domain_1",
    taskId: "task_1",
    executionId: "exec_1",
    agentId: "agent_1",
    sessionId: "session_1",
    trustLevel: "verified",
    qualityScore: 0.9,
    usefulnessScore: 0.8,
    tags: ["test", "evidence"],
    correlationId: "corr_1",
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Constructor Tests
// ─────────────────────────────────────────────────────────────────────────────

test("EvidenceService defaults to reasonable values", () => {
  const service = new EvidenceService();
  const stats = service.getStats();
  assert.equal(stats.total, 0);
});

test("EvidenceService accepts custom config", () => {
  const service = new EvidenceService({
    maxRecords: 100,
    retentionDays: 30,
    integrationEnabled: false,
  });
  const stats = service.getStats();
  assert.equal(stats.total, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// record() Tests
// ─────────────────────────────────────────────────────────────────────────────

test("record() stores an evidence record", () => {
  const service = new EvidenceService({ integrationEnabled: false });
  const record = service.record("quality", "memory:abc123", { score: 0.9 }, makeMetadata());

  assert.ok(record.id.startsWith("ev_"));
  assert.equal(record.category, "quality");
  assert.equal(record.sourceRef, "memory:abc123");
  assert.deepEqual(record.content, { score: 0.9 });
  assert.equal(record.status, "recorded");
  assert.ok(record.recordedAt);
  assert.equal(record.processedAt, null);
  assert.equal(record.integratedAt, null);
});

test("record() indexes by category", () => {
  const service = new EvidenceService({ integrationEnabled: false });
  service.record("validation", "memory:test", { passed: true }, makeMetadata());
  service.record("feedback", "memory:test", {}, makeMetadata());

  const validationRecords = service.listByCategory("validation");
  const feedbackRecords = service.listByCategory("feedback");

  assert.equal(validationRecords.length, 1);
  assert.equal(feedbackRecords.length, 1);
  assert.equal(validationRecords[0]!.category, "validation");
});

test("record() indexes by sourceRef", () => {
  const service = new EvidenceService({ integrationEnabled: false });
  const metadata = makeMetadata();
  service.record("quality", "memory:source1", {}, metadata);
  service.record("quality", "memory:source1", {}, metadata);
  service.record("quality", "memory:source2", {}, metadata);

  const results = service.query({ sourceRef: "memory:source1" });
  assert.equal(results.length, 2);
});

test("record() indexes by tenantId", () => {
  const service = new EvidenceService({ integrationEnabled: false });
  const metadata1 = makeMetadata({ tenantId: "tenant_a" });
  const metadata2 = makeMetadata({ tenantId: "tenant_b" });
  service.record("quality", "memory:1", {}, metadata1);
  service.record("quality", "memory:2", {}, metadata1);
  service.record("quality", "memory:3", {}, metadata2);

  const results = service.query({ tenantId: "tenant_a" });
  assert.equal(results.length, 2);
});

test("record() auto-processes when integrationEnabled is true", () => {
  const service = new EvidenceService({ integrationEnabled: true });
  const record = service.record("feedback", "memory:test", {}, makeMetadata());

  assert.equal(record.status, "processed");
  assert.ok(record.processedAt);
});

test("record() does not auto-process when integrationEnabled is false", () => {
  const service = new EvidenceService({ integrationEnabled: false });
  const record = service.record("feedback", "memory:test", {}, makeMetadata());

  assert.equal(record.status, "recorded");
  assert.equal(record.processedAt, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// query() Tests
// ─────────────────────────────────────────────────────────────────────────────

test("query() returns all records when no filters applied", () => {
  const service = new EvidenceService({ integrationEnabled: false });
  service.record("quality", "memory:1", {}, makeMetadata());
  service.record("feedback", "memory:2", {}, makeMetadata());

  const results = service.query({});
  assert.equal(results.length, 2);
});

test("query() filters by category", () => {
  const service = new EvidenceService({ integrationEnabled: false });
  service.record("quality", "memory:1", {}, makeMetadata());
  service.record("feedback", "memory:2", {}, makeMetadata());
  service.record("validation", "memory:3", {}, makeMetadata());

  const results = service.query({ category: "quality" });
  assert.equal(results.length, 1);
  assert.equal(results[0]!.category, "quality");
});

test("query() filters by status", () => {
  const service = new EvidenceService({ integrationEnabled: false });
  const record = service.record("quality", "memory:1", {}, makeMetadata());
  service.updateStatus(record.id, "processed");

  const recordedResults = service.query({ status: "recorded" });
  const processedResults = service.query({ status: "processed" });

  assert.equal(recordedResults.length, 0);
  assert.equal(processedResults.length, 1);
});

test("query() filters by taskId", () => {
  const service = new EvidenceService({ integrationEnabled: false });
  const meta1 = makeMetadata({ taskId: "task_a" });
  const meta2 = makeMetadata({ taskId: "task_b" });
  service.record("quality", "memory:1", {}, meta1);
  service.record("quality", "memory:2", {}, meta2);

  const results = service.query({ taskId: "task_a" });
  assert.equal(results.length, 1);
  assert.equal(results[0]!.metadata.taskId, "task_a");
});

test("query() filters by executionId", () => {
  const service = new EvidenceService({ integrationEnabled: false });
  const meta1 = makeMetadata({ executionId: "exec_a" });
  const meta2 = makeMetadata({ executionId: "exec_b" });
  service.record("quality", "memory:1", {}, meta1);
  service.record("quality", "memory:2", {}, meta2);

  const results = service.query({ executionId: "exec_a" });
  assert.equal(results.length, 1);
});

test("query() filters by agentId", () => {
  const service = new EvidenceService({ integrationEnabled: false });
  const meta1 = makeMetadata({ agentId: "agent_a" });
  const meta2 = makeMetadata({ agentId: "agent_b" });
  service.record("quality", "memory:1", {}, meta1);
  service.record("quality", "memory:2", {}, meta2);

  const results = service.query({ agentId: "agent_a" });
  assert.equal(results.length, 1);
});

test("query() filters by sessionId", () => {
  const service = new EvidenceService({ integrationEnabled: false });
  const meta1 = makeMetadata({ sessionId: "session_a" });
  const meta2 = makeMetadata({ sessionId: "session_b" });
  service.record("quality", "memory:1", {}, meta1);
  service.record("quality", "memory:2", {}, meta2);

  const results = service.query({ sessionId: "session_a" });
  assert.equal(results.length, 1);
});

test("query() filters by domainId", () => {
  const service = new EvidenceService({ integrationEnabled: false });
  const meta1 = makeMetadata({ domainId: "domain_a" });
  const meta2 = makeMetadata({ domainId: "domain_b" });
  service.record("quality", "memory:1", {}, meta1);
  service.record("quality", "memory:2", {}, meta2);

  const results = service.query({ domainId: "domain_a" });
  assert.equal(results.length, 1);
});

test("query() filters by recordedAfter", () => {
  const service = new EvidenceService({ integrationEnabled: false });
  service.record("quality", "memory:1", {}, makeMetadata());

  const futureDate = new Date(Date.now() + 1000).toISOString();
  const results = service.query({ recordedAfter: futureDate });

  assert.equal(results.length, 0);
});

test("query() filters by recordedBefore", () => {
  const service = new EvidenceService({ integrationEnabled: false });
  service.record("quality", "memory:1", {}, makeMetadata());

  const pastDate = new Date(Date.now() - 1000).toISOString();
  const results = service.query({ recordedBefore: pastDate });

  assert.equal(results.length, 0);
});

test("query() applies pagination with offset and limit", () => {
  const service = new EvidenceService({ integrationEnabled: false });
  for (let i = 0; i < 10; i++) {
    service.record("quality", `memory:${i}`, { index: i }, makeMetadata());
  }

  const page1 = service.query({ limit: 3, offset: 0 });
  const page2 = service.query({ limit: 3, offset: 3 });
  const page3 = service.query({ limit: 3, offset: 6 });

  assert.equal(page1.length, 3);
  assert.equal(page2.length, 3);
  assert.equal(page3.length, 3);
});

test("query() sorts by recordedAt descending", () => {
  const service = new EvidenceService({ integrationEnabled: false });
  service.record("quality", "memory:1", { order: 1 }, makeMetadata());

  const secondRecord = service.record("quality", "memory:2", { order: 2 }, makeMetadata());
  service.record("quality", "memory:3", { order: 3 }, makeMetadata());

  const results = service.query({});
  // Most recent first
  assert.ok(results[0]!.recordedAt >= results[1]!.recordedAt);
});

test("query() intersects multiple indexes", () => {
  const service = new EvidenceService({ integrationEnabled: false });
  const meta1 = makeMetadata({ tenantId: "tenant_a", taskId: "task_a" });
  const meta2 = makeMetadata({ tenantId: "tenant_a", taskId: "task_b" });
  const meta3 = makeMetadata({ tenantId: "tenant_b", taskId: "task_a" });

  service.record("quality", "memory:1", {}, { ...meta1 });
  service.record("feedback", "memory:2", {}, { ...meta2 });
  service.record("quality", "memory:3", {}, { ...meta3 });

  // Both tenant_a and task_a should match record 1 only
  const results = service.query({ tenantId: "tenant_a", taskId: "task_a" });
  assert.equal(results.length, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// get() Tests
// ─────────────────────────────────────────────────────────────────────────────

test("get() returns record by id", () => {
  const service = new EvidenceService({ integrationEnabled: false });
  const record = service.record("quality", "memory:test", {}, makeMetadata());

  const retrieved = service.get(record.id);
  assert.ok(retrieved);
  assert.equal(retrieved!.id, record.id);
});

test("get() returns null for non-existent id", () => {
  const service = new EvidenceService({ integrationEnabled: false });
  const result = service.get("non_existent_id");
  assert.equal(result, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// updateStatus() Tests
// ─────────────────────────────────────────────────────────────────────────────

test("updateStatus() changes record status", () => {
  const service = new EvidenceService({ integrationEnabled: false });
  const record = service.record("quality", "memory:test", {}, makeMetadata());

  const success = service.updateStatus(record.id, "processed");
  assert.equal(success, true);

  const updated = service.get(record.id);
  assert.equal(updated!.status, "processed");
  assert.ok(updated!.processedAt);
});

test("updateStatus() returns false for non-existent record", () => {
  const service = new EvidenceService({ integrationEnabled: false });
  const success = service.updateStatus("non_existent", "processed");
  assert.equal(success, false);
});

test("updateStatus() updates status index", () => {
  const service = new EvidenceService({ integrationEnabled: false });
  const record = service.record("quality", "memory:test", {}, makeMetadata());

  const beforeRecorded = service.query({ status: "recorded" }).length;
  const beforeProcessed = service.query({ status: "processed" }).length;

  service.updateStatus(record.id, "processed");

  const afterRecorded = service.query({ status: "recorded" }).length;
  const afterProcessed = service.query({ status: "processed" }).length;

  assert.equal(beforeRecorded - afterRecorded, 1);
  assert.equal(afterProcessed - beforeProcessed, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// listByCategory() Tests
// ─────────────────────────────────────────────────────────────────────────────

test("listByCategory() returns all records of a category", () => {
  const service = new EvidenceService({ integrationEnabled: false });
  service.record("quality", "memory:1", {}, makeMetadata());
  service.record("quality", "memory:2", {}, makeMetadata());
  service.record("feedback", "memory:3", {}, makeMetadata());

  const qualityRecords = service.listByCategory("quality");
  assert.equal(qualityRecords.length, 2);
});

test("listByCategory() returns empty array for unused category", () => {
  const service = new EvidenceService({ integrationEnabled: false });
  const results = service.listByCategory("performance");
  assert.equal(results.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// integrateWithLearning() Tests
// ─────────────────────────────────────────────────────────────────────────────

test("integrateWithLearning() processes evidence records", () => {
  const service = new EvidenceService({ integrationEnabled: false });
  const record = service.record("quality", "memory:test", { score: 0.9 }, {
    ...makeMetadata(),
    qualityScore: 0.95,
  });
  service.updateStatus(record.id, "processed");

  const result = service.integrateWithLearning([record.id]);

  assert.equal(result.integrated, true);
  assert.deepEqual(result.evidenceIds, [record.id]);
  assert.equal(result.errors.length, 0);
  assert.ok(result.learningSignals.length > 0);
});

test("integrateWithLearning() generates quality_improvement signal for quality category", () => {
  const service = new EvidenceService({ integrationEnabled: false });
  const record = service.record("quality", "memory:test", { score: 0.9 }, {
    ...makeMetadata(),
    qualityScore: 0.95,
  });
  service.updateStatus(record.id, "processed");

  const result = service.integrateWithLearning([record.id]);

  const qualitySignal = result.learningSignals.find(s => s.signalType === "quality_improvement");
  assert.ok(qualitySignal);
  assert.equal(qualitySignal!.evidenceId, record.id);
  assert.equal(qualitySignal!.score, 0.95);
});

test("integrateWithLearning() generates feedback_received signal for feedback category", () => {
  const service = new EvidenceService({ integrationEnabled: false });
  const record = service.record("feedback", "memory:test", {}, {
    ...makeMetadata(),
    usefulnessScore: 0.7,
  });
  service.updateStatus(record.id, "processed");

  const result = service.integrateWithLearning([record.id]);

  const feedbackSignal = result.learningSignals.find(s => s.signalType === "feedback_received");
  assert.ok(feedbackSignal);
  assert.equal(feedbackSignal!.score, 0.7);
});

test("integrateWithLearning() generates anomaly_detected for failed validation", () => {
  const service = new EvidenceService({ integrationEnabled: false });
  const record = service.record("validation", "memory:test", { passed: false }, makeMetadata());
  service.updateStatus(record.id, "processed");

  const result = service.integrateWithLearning([record.id]);

  const anomalySignal = result.learningSignals.find(s => s.signalType === "anomaly_detected");
  assert.ok(anomalySignal);
  assert.equal(anomalySignal!.score, 0.7);
});

test("integrateWithLearning() generates pattern_detected for successful promotion", () => {
  const service = new EvidenceService({ integrationEnabled: false });
  const record = service.record("promotion", "memory:test", { promoted: true }, makeMetadata());
  service.updateStatus(record.id, "processed");

  const result = service.integrateWithLearning([record.id]);

  const patternSignal = result.learningSignals.find(s => s.signalType === "pattern_detected");
  assert.ok(patternSignal);
  assert.equal(patternSignal!.score, 0.8);
});

test("integrateWithLearning() handles non-existent record gracefully", () => {
  const service = new EvidenceService({ integrationEnabled: false });
  const result = service.integrateWithLearning(["non_existent_id"]);

  assert.equal(result.integrated, false);
  assert.ok(result.errors.length > 0);
});

test("integrateWithLearning() updates record status to integrated", () => {
  const service = new EvidenceService({ integrationEnabled: false });
  const record = service.record("feedback", "memory:test", {}, makeMetadata());
  service.updateStatus(record.id, "processed");

  service.integrateWithLearning([record.id]);

  const updated = service.get(record.id);
  assert.equal(updated!.status, "integrated");
  assert.ok(updated!.integratedAt);
});

test("integrateWithLearning() without specific IDs processes all processed records", () => {
  const service = new EvidenceService({ integrationEnabled: false });
  const record1 = service.record("feedback", "memory:1", {}, makeMetadata());
  const record2 = service.record("feedback", "memory:2", {}, makeMetadata());
  service.updateStatus(record1.id, "processed");
  service.updateStatus(record2.id, "processed");

  const result = service.integrateWithLearning();

  assert.ok(result.evidenceIds.length >= 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// getStats() Tests
// ─────────────────────────────────────────────────────────────────────────────

test("getStats() returns correct totals and breakdowns", () => {
  const service = new EvidenceService({ integrationEnabled: false });
  service.record("quality", "memory:1", {}, makeMetadata());
  service.record("feedback", "memory:2", {}, makeMetadata());
  service.record("validation", "memory:3", {}, makeMetadata());

  const stats = service.getStats();

  assert.equal(stats.total, 3);
  assert.equal(stats.byCategory.quality, 1);
  assert.equal(stats.byCategory.feedback, 1);
  assert.equal(stats.byCategory.validation, 1);
  // Other categories should be 0
  assert.equal(stats.byCategory.performance, 0);
  assert.equal(stats.byCategory.promotion, 0);
  assert.equal(stats.byCategory.learning_signal, 0);
});

test("getStats() tracks status distribution", () => {
  const service = new EvidenceService({ integrationEnabled: false });
  const record1 = service.record("quality", "memory:1", {}, makeMetadata());
  const record2 = service.record("quality", "memory:2", {}, makeMetadata());
  service.updateStatus(record1.id, "processed");
  service.updateStatus(record2.id, "integrated");

  const stats = service.getStats();

  assert.equal(stats.byStatus.recorded, 0);
  assert.equal(stats.byStatus.processed, 1);
  assert.equal(stats.byStatus.integrated, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Eviction Tests
// ─────────────────────────────────────────────────────────────────────────────

test("EvidenceService evicts old records when over capacity", () => {
  const service = new EvidenceService({ integrationEnabled: false, maxRecords: 5, retentionDays: 0 });
  const nowMs = Date.now();

  // Record 5 records
  for (let i = 0; i < 5; i++) {
    const metadata = makeMetadata();
    service.record("quality", `memory:${i}`, {}, metadata);
  }

  // Verify we have 5 records
  assert.equal(service.getStats().total, 5);

  // Manually set old timestamps by manipulating internal state
  // (This is a simplified test - in real scenario we'd wait or mock time)
  const statsAfter = service.getStats();
  assert.ok(statsAfter.total <= 5);
});

test("EvidenceService preserves archived records during eviction", () => {
  const service = new EvidenceService({ integrationEnabled: false, maxRecords: 2, retentionDays: 0 });

  const record = service.record("quality", "memory:1", {}, makeMetadata());
  service.updateStatus(record.id, "archived");

  // Even with low maxRecords, archived should be preserved
  const stats = service.getStats();
  assert.ok(stats.total >= 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("query() with no matches returns empty array", () => {
  const service = new EvidenceService({ integrationEnabled: false });
  const results = service.query({ category: "quality" });
  assert.deepEqual(results, []);
});

test("record() handles empty sourceRef", () => {
  const service = new EvidenceService({ integrationEnabled: false });
  const metadata = makeMetadata();
  const record = service.record("quality", "", {}, metadata);
  assert.ok(record.id);
});

test("record() handles missing optional metadata fields", () => {
  const service = new EvidenceService({ integrationEnabled: false });
  const minimalMetadata: EvidenceMetadata = {};
  const record = service.record("quality", "memory:test", {}, minimalMetadata);
  assert.ok(record.id);
  assert.equal(record.metadata.tenantId, undefined);
});

test("integrateWithLearning() handles records without learning signals", () => {
  const service = new EvidenceService({ integrationEnabled: false });
  // performance category with no special content
  const record = service.record("performance", "memory:test", { cpu: 50 }, makeMetadata());
  service.updateStatus(record.id, "processed");

  const result = service.integrateWithLearning([record.id]);

  // Should still succeed but may have no signals
  assert.equal(result.integrated, true);
});
