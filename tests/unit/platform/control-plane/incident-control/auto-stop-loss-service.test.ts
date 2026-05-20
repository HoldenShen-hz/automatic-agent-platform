import assert from "node:assert/strict";
import test from "node:test";

import {
  AutoStopLossService,
  type EscalationLevel,
  type StopLossAction,
  type StopLossPlaybook,
} from "../../../../../src/platform/five-plane-control-plane/incident-control/auto-stop-loss-service.js";

test("EscalationLevel type accepts valid values", () => {
  const levels: EscalationLevel[] = ["observe", "warn", "act", "critical"];
  assert.equal(levels.length, 4);
});

test("StopLossAction type accepts valid values", () => {
  const actions: StopLossAction[] = [
    "circuit_break",
    "isolate_provider",
    "scale_down",
    "pause_non_critical",
    "queue_only",
    "reject_low_priority",
    "enable_circuit_breaker",
    "disable_new_tasks",
    "force_garbage_collection",
    "escalate_to_human",
  ];
  assert.equal(actions.length, 10);
});

test("AutoStopLossService registers and retrieves playbooks", () => {
  const service = new AutoStopLossService();
  const playbook: StopLossPlaybook = {
    id: "test-playbook",
    name: "Test Playbook",
    description: "A test playbook",
    enabled: true,
    triggerCondition: { type: "anomaly_severity", severityThreshold: "critical" },
    actions: ["circuit_break"],
    cooldownMs: 1000,
    maxExecutionsPerHour: 10,
    requireHumanApproval: false,
  };

  service.registerPlaybook(playbook);
  const retrieved = service.getPlaybook("test-playbook");
  assert.equal(retrieved?.id, "test-playbook");
  assert.equal(retrieved?.name, "Test Playbook");
  assert.equal(retrieved?.enabled, true);
});

test("AutoStopLossService unregisters playbook", () => {
  const service = new AutoStopLossService();
  const playbook: StopLossPlaybook = {
    id: "remove-me",
    name: "Remove Me",
    description: "Will be removed",
    enabled: true,
    triggerCondition: { type: "health_status", healthStatusThreshold: "degraded" },
    actions: ["reject_low_priority"],
    cooldownMs: 500,
    maxExecutionsPerHour: 5,
    requireHumanApproval: false,
  };

  service.registerPlaybook(playbook);
  const removed = service.unregisterPlaybook("remove-me");
  assert.equal(removed, true);
  assert.equal(service.getPlaybook("remove-me"), null);
});

test("AutoStopLossService enables and disables playbooks", () => {
  const service = new AutoStopLossService();
  const playbook: StopLossPlaybook = {
    id: "toggle-test",
    name: "Toggle Test",
    description: "Toggle test",
    enabled: true,
    triggerCondition: { type: "metric_threshold", metricName: "error_rate", metricValue: 0.5, operator: "gt" },
    actions: ["pause_non_critical"],
    cooldownMs: 1000,
    maxExecutionsPerHour: 5,
    requireHumanApproval: false,
  };

  service.registerPlaybook(playbook);
  assert.equal(service.enablePlaybook("toggle-test"), true);
  assert.equal(service.disablePlaybook("toggle-test"), true);
  assert.equal(service.disablePlaybook("nonexistent"), false);
});

test("AutoStopLossService lists all registered playbooks", () => {
  const service = new AutoStopLossService();
  const playbook1: StopLossPlaybook = {
    id: "playbook-1",
    name: "Playbook 1",
    description: "First",
    enabled: true,
    triggerCondition: { type: "anomaly_severity", severityThreshold: "critical" },
    actions: ["circuit_break"],
    cooldownMs: 1000,
    maxExecutionsPerHour: 10,
    requireHumanApproval: false,
  };
  const playbook2: StopLossPlaybook = {
    id: "playbook-2",
    name: "Playbook 2",
    description: "Second",
    enabled: false,
    triggerCondition: { type: "health_status", healthStatusThreshold: "overloaded" },
    actions: ["reject_low_priority"],
    cooldownMs: 2000,
    maxExecutionsPerHour: 5,
    requireHumanApproval: true,
  };

  service.registerPlaybook(playbook1);
  service.registerPlaybook(playbook2);
  const listed = service.listPlaybooks();
  assert.equal(listed.length >= 2, true);
  assert.ok(listed.some((p) => p.id === "playbook-1"));
  assert.ok(listed.some((p) => p.id === "playbook-2"));
});

test("AutoStopLossService rate-limit hour key uses UTC boundaries", async () => {
  const times = [
    new Date("2026-03-31T23:30:00.000Z"),
    new Date("2026-03-31T23:45:00.000Z"),
    new Date("2026-04-01T00:05:00.000Z"),
  ];
  let index = 0;
  const service = new AutoStopLossService({
    playbooks: [],
    now: () => times[Math.min(index, times.length - 1)]!,
  });

  const playbook: StopLossPlaybook = {
    id: "utc-hour",
    name: "UTC Hour",
    description: "UTC hour bucket",
    enabled: true,
    triggerCondition: { type: "anomaly_severity", severityThreshold: "critical" },
    actions: ["circuit_break"],
    cooldownMs: 0,
    maxExecutionsPerHour: 1,
    requireHumanApproval: false,
  };

  service.registerPlaybook(playbook);
  const allowedFirst = service.evaluateAnomaly("critical", "error_rate");
  await service.executePlaybook(playbook, "first UTC hour");
  index = 1;
  const blockedSameUtcHour = service.evaluateAnomaly("critical", "error_rate");
  index = 2;
  const allowedNextUtcHour = service.evaluateAnomaly("critical", "error_rate");

  assert.equal(allowedFirst.matchingPlaybooks.length, 1);
  assert.equal(blockedSameUtcHour.matchingPlaybooks.length, 0);
  assert.equal(allowedNextUtcHour.matchingPlaybooks.length, 1);
});
