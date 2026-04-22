/**
 * Unit tests for DelegationAuditService
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  DelegationAuditService,
  type DelegationAuditEventType,
} from "../../../../../src/platform/orchestration/agent-delegation/delegation-audit-service.js";

test("DelegationAuditService records governance evaluation", () => {
  const service = new DelegationAuditService();
  const event = service.recordGovernanceEvaluation({
    delegationId: "dlg_1",
    parentAgentId: "agent_1",
    childAgentId: "agent_2",
    depth: 1,
    reasonCode: "delegation.allowed",
    decision: "allow",
    evaluatedRules: ["max_depth", "allow_default"],
    actorId: "system",
    actorType: "system",
  });

  assert.ok(event.id.startsWith("dlg_audit_"));
  assert.equal(event.eventType, "delegation.governance.approved");
  assert.equal(event.parentAgentId, "agent_1");
  assert.equal(event.childAgentId, "agent_2");
  assert.deepEqual(event.metadata, { evaluatedRules: ["max_depth", "allow_default"] });
});

test("DelegationAuditService records governance denial", () => {
  const service = new DelegationAuditService();
  const event = service.recordGovernanceEvaluation({
    delegationId: null,
    parentAgentId: "agent_1",
    childAgentId: null,
    depth: 5,
    reasonCode: "delegation.max_depth_exceeded",
    decision: "deny",
    evaluatedRules: ["max_depth"],
    actorId: "system",
    actorType: "system",
  });

  assert.equal(event.eventType, "delegation.governance.denied");
  assert.equal(event.reasonCode, "delegation.max_depth_exceeded");
});

test("DelegationAuditService records governance require_approval", () => {
  const service = new DelegationAuditService();
  const event = service.recordGovernanceEvaluation({
    delegationId: null,
    parentAgentId: "agent_1",
    childAgentId: null,
    depth: 1,
    reasonCode: "delegation.high_risk_requires_approval",
    decision: "require_approval",
    evaluatedRules: ["high_risk_requires_approval"],
    actorId: "admin",
    actorType: "user",
  });

  assert.equal(event.eventType, "delegation.governance.evaluated");
});

test("DelegationAuditService records delegation creation", () => {
  const service = new DelegationAuditService();
  const event = service.recordDelegationCreated({
    delegationId: "dlg_123",
    parentAgentId: "agent_1",
    childAgentId: "agent_2",
    depth: 1,
    reasonCode: "delegation.created",
    actorId: "agent_1",
    actorType: "agent",
  });

  assert.equal(event.eventType, "delegation.created");
  assert.equal(event.delegationId, "dlg_123");
  assert.equal(event.depth, 1);
});

test("DelegationAuditService records delegation completion", () => {
  const service = new DelegationAuditService();
  const event = service.recordDelegationCompleted({
    delegationId: "dlg_123",
    parentAgentId: "agent_1",
    childAgentId: "agent_2",
    durationMs: 5000,
    actorId: "agent_2",
    actorType: "agent",
  });

  assert.equal(event.eventType, "delegation.completed");
  assert.deepEqual(event.metadata, { durationMs: 5000 });
});

test("DelegationAuditService records delegation failure", () => {
  const service = new DelegationAuditService();
  const event = service.recordDelegationFailed({
    delegationId: "dlg_123",
    parentAgentId: "agent_1",
    childAgentId: "agent_2",
    error: "timeout",
    actorId: "agent_2",
    actorType: "agent",
  });

  assert.equal(event.eventType, "delegation.failed");
  assert.deepEqual(event.metadata, { error: "timeout" });
});

test("DelegationAuditService records permission narrowing", () => {
  const service = new DelegationAuditService();
  const event = service.recordPermissionNarrowed({
    delegationId: "dlg_123",
    parentAgentId: "agent_1",
    childAgentId: "agent_2",
    originalPermissions: { resources: ["r1", "r2"], actions: ["read", "write"], constraints: {} },
    narrowedPermissions: { resources: ["r1"], actions: ["read"], constraints: {} },
    actorId: "agent_1",
    actorType: "agent",
  });

  assert.equal(event.eventType, "delegation.permission_narrowed");
  assert.deepEqual(event.metadata.originalPermissions, { resources: ["r1", "r2"], actions: ["read", "write"], constraints: {} });
  assert.deepEqual(event.metadata.narrowedPermissions, { resources: ["r1"], actions: ["read"], constraints: {} });
});

test("DelegationAuditService.getByDelegation returns events for delegation", () => {
  const service = new DelegationAuditService();
  service.recordDelegationCreated({
    delegationId: "dlg_1",
    parentAgentId: "agent_1",
    childAgentId: "agent_2",
    depth: 1,
    actorId: "agent_1",
    actorType: "agent",
  });
  service.recordDelegationCompleted({
    delegationId: "dlg_1",
    parentAgentId: "agent_1",
    childAgentId: "agent_2",
    durationMs: 1000,
    actorId: "agent_2",
    actorType: "agent",
  });
  service.recordDelegationCreated({
    delegationId: "dlg_2",
    parentAgentId: "agent_2",
    childAgentId: "agent_3",
    depth: 2,
    actorId: "agent_2",
    actorType: "agent",
  });

  const events = service.getByDelegation("dlg_1");
  assert.equal(events.length, 2);
  assert.ok(events.every((e) => e.delegationId === "dlg_1"));
});

test("DelegationAuditService.getByAgent returns events for agent", () => {
  const service = new DelegationAuditService();
  service.recordDelegationCreated({
    delegationId: "dlg_1",
    parentAgentId: "agent_1",
    childAgentId: "agent_2",
    depth: 1,
    actorId: "agent_1",
    actorType: "agent",
  });
  service.recordDelegationCompleted({
    delegationId: "dlg_1",
    parentAgentId: "agent_1",
    childAgentId: "agent_2",
    durationMs: 1000,
    actorId: "agent_2",
    actorType: "agent",
  });

  const events = service.getByAgent("agent_2");
  assert.equal(events.length, 1);
  assert.equal(events[0]?.childAgentId, "agent_2");
});

test("DelegationAuditService.getRecentEvents returns sorted events", () => {
  const service = new DelegationAuditService();
  service.recordDelegationCreated({
    delegationId: "dlg_1",
    parentAgentId: "agent_1",
    childAgentId: "agent_2",
    depth: 1,
    actorId: "agent_1",
    actorType: "agent",
  });
  service.recordDelegationCreated({
    delegationId: "dlg_2",
    parentAgentId: "agent_2",
    childAgentId: "agent_3",
    depth: 2,
    actorId: "agent_2",
    actorType: "agent",
  });

  const recent = service.getRecentEvents(1);
  assert.equal(recent.length, 1);
  assert.equal(recent[0]?.delegationId, "dlg_2");
});

test("DelegationAuditService.getSummary returns correct counts", () => {
  const service = new DelegationAuditService();
  service.recordDelegationCreated({
    delegationId: "dlg_1",
    parentAgentId: "agent_1",
    childAgentId: "agent_2",
    depth: 1,
    actorId: "agent_1",
    actorType: "agent",
  });
  service.recordGovernanceEvaluation({
    delegationId: "dlg_1",
    parentAgentId: "agent_1",
    childAgentId: "agent_2",
    depth: 1,
    reasonCode: "delegation.allowed",
    decision: "allow",
    evaluatedRules: [],
    actorId: "system",
    actorType: "system",
  });

  const summary = service.getSummary();
  assert.equal(summary.totalEvents, 2);
  assert.equal(summary.byType["delegation.created"], 1);
  assert.equal(summary.byType["delegation.governance.approved"], 1);
  assert.equal(summary.byAgent["agent_1"], 2);
  assert.ok(summary.lastEventAt !== null);
});

test("DelegationAuditService.listEvents returns all events", () => {
  const service = new DelegationAuditService();
  service.recordDelegationCreated({
    delegationId: "dlg_1",
    parentAgentId: "agent_1",
    childAgentId: "agent_2",
    depth: 1,
    actorId: "agent_1",
    actorType: "agent",
  });

  const events = service.listEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0]?.delegationId, "dlg_1");
});
