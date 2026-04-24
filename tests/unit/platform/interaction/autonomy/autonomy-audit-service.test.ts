import test from "node:test";
import { strict as assert } from "node:assert/strict";
import { AutonomyAuditService } from "../../../../../src/interaction/autonomy/autonomy-audit-service.js";
import type { AutonomyChangeEvent } from "../../../../../src/interaction/autonomy/index.js";

function mockEvent(overrides: Partial<AutonomyChangeEvent> = {}): AutonomyChangeEvent {
  return {
    eventType: "agent.autonomy.promoted",
    agentId: "agent-1",
    capabilityId: "cap-1",
    fromLevel: "suggestion",
    toLevel: "supervised",
    trigger: "rule_engine",
    approvedBy: "auto",
    evidence: {
      successRate: 0.95,
      totalExecutions: 100,
      incidentCount: 0,
      evaluationWindow: "30d",
    },
    ...overrides,
  };
}

test("AutonomyAuditService records changes and returns audit record", () => {
  const service = new AutonomyAuditService();
  const event = mockEvent();

  const record = service.recordChange(event);

  assert.strictEqual(record.agentId, "agent-1");
  assert.strictEqual(record.capabilityId, "cap-1");
  assert.strictEqual(record.fromLevel, "suggestion");
  assert.strictEqual(record.toLevel, "supervised");
  assert.ok(record.id.startsWith("autonomy_audit_"));
});

test("AutonomyAuditService getByAgent returns matching records", () => {
  const service = new AutonomyAuditService();
  service.recordChange(mockEvent({ agentId: "agent-1" }));
  service.recordChange(mockEvent({ agentId: "agent-2" }));
  service.recordChange(mockEvent({ agentId: "agent-1" }));

  const records = service.getByAgent("agent-1");
  assert.strictEqual(records.length, 2);
  assert.ok(records.every((r) => r.agentId === "agent-1"));
});

test("AutonomyAuditService getByCapability filters by capability", () => {
  const service = new AutonomyAuditService();
  service.recordChange(mockEvent({ agentId: "agent-1", capabilityId: "cap-1" }));
  service.recordChange(mockEvent({ agentId: "agent-1", capabilityId: "cap-2" }));

  const records = service.getByCapability("agent-1", "cap-1");
  assert.strictEqual(records.length, 1);
  assert.strictEqual(records[0]!.capabilityId, "cap-1");
});

test("AutonomyAuditService getRecentChanges returns sorted records", () => {
  const service = new AutonomyAuditService();
  service.recordChange(mockEvent({ agentId: "agent-1", capabilityId: "cap-1" }));
  service.recordChange(mockEvent({ agentId: "agent-1", capabilityId: "cap-2" }));
  service.recordChange(mockEvent({ agentId: "agent-1", capabilityId: "cap-3" }));

  const recent = service.getRecentChanges(2);
  assert.strictEqual(recent.length, 2);
});

test("AutonomyAuditService getSummary returns correct counts", () => {
  const service = new AutonomyAuditService();
  service.recordChange(mockEvent({ eventType: "agent.autonomy.promoted" }));
  service.recordChange(mockEvent({ eventType: "agent.autonomy.promoted" }));
  service.recordChange(mockEvent({ eventType: "agent.autonomy.demoted" }));
  service.recordChange(mockEvent({ eventType: "agent.autonomy.frozen" }));

  const summary = service.getSummary("agent-1");
  assert.strictEqual(summary.totalChanges, 4);
  assert.strictEqual(summary.promotions, 2);
  assert.strictEqual(summary.demotions, 1);
  assert.strictEqual(summary.freezes, 1);
});

test("AutonomyAuditService getSummary returns zeros for unknown agent", () => {
  const service = new AutonomyAuditService();
  const summary = service.getSummary("unknown-agent");
  assert.strictEqual(summary.totalChanges, 0);
  assert.strictEqual(summary.promotions, 0);
  assert.strictEqual(summary.demotions, 0);
  assert.strictEqual(summary.freezes, 0);
});

test("AutonomyAuditService listRecords returns all records", () => {
  const service = new AutonomyAuditService();
  service.recordChange(mockEvent());
  service.recordChange(mockEvent({ agentId: "agent-2" }));

  const records = service.listRecords();
  assert.strictEqual(records.length, 2);
});

test("AutonomyAuditService records demotion events", () => {
  const service = new AutonomyAuditService();
  service.recordChange(mockEvent({ eventType: "agent.autonomy.demoted", fromLevel: "supervised", toLevel: "suggestion" }));

  const summary = service.getSummary("agent-1");
  assert.strictEqual(summary.demotions, 1);
});

test("AutonomyAuditService records freeze events", () => {
  const service = new AutonomyAuditService();
  service.recordChange(mockEvent({ eventType: "agent.autonomy.frozen", toLevel: "frozen" }));

  const summary = service.getSummary("agent-1");
  assert.strictEqual(summary.freezes, 1);
});

test("AutonomyAuditService lastChangeAt is set correctly", () => {
  const service = new AutonomyAuditService();
  service.recordChange(mockEvent());

  const summary = service.getSummary("agent-1");
  assert.ok(summary.lastChangeAt !== null);
});

test("AutonomyAuditService records include evidence data", () => {
  const service = new AutonomyAuditService();
  service.recordChange(mockEvent({
    evidence: { successRate: 0.98, totalExecutions: 200, incidentCount: 1, evaluationWindow: "30d" },
  }));

  const records = service.getByAgent("agent-1");
  assert.strictEqual(records[0]!.successRate, 0.98);
  assert.strictEqual(records[0]!.totalExecutions, 200);
  assert.strictEqual(records[0]!.incidentCount, 1);
});

test("AutonomyAuditService handles multiple agents", () => {
  const service = new AutonomyAuditService();
  service.recordChange(mockEvent({ agentId: "agent-1" }));
  service.recordChange(mockEvent({ agentId: "agent-2" }));
  service.recordChange(mockEvent({ agentId: "agent-3" }));

  assert.strictEqual(service.getByAgent("agent-1").length, 1);
  assert.strictEqual(service.getByAgent("agent-2").length, 1);
  assert.strictEqual(service.getByAgent("agent-3").length, 1);
});

test("AutonomyAuditService listRecords returns copy not original", () => {
  const service = new AutonomyAuditService();
  service.recordChange(mockEvent());

  const records = service.listRecords();
  records.push({} as never);

  assert.strictEqual(service.listRecords().length, 1);
});