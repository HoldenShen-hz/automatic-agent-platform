import assert from "node:assert/strict";
import test from "node:test";

import {
  canRetireAgent,
  createRetirementRecord,
  isGracePeriodExpired,
} from "../../../../../src/ops-maturity/agent-lifecycle/retirement/index.js";

test("canRetireAgent returns true when revokeAt <= nowIso", () => {
  const plan = {
    agentId: "agent-1",
    successorAgentId: null,
    transferItems: [],
    gracePeriodDays: 30,
    notificationTargets: [],
    revokeAt: "2026-04-20T00:00:00Z",
    reason: "decommission",
  };

  assert.equal(canRetireAgent(plan, "2026-04-25T00:00:00Z"), true);
});

test("canRetireAgent returns false when revokeAt > nowIso", () => {
  const plan = {
    agentId: "agent-1",
    successorAgentId: null,
    transferItems: [],
    gracePeriodDays: 30,
    notificationTargets: [],
    revokeAt: "2026-04-30T00:00:00Z",
    reason: "decommission",
  };

  assert.equal(canRetireAgent(plan, "2026-04-25T00:00:00Z"), false);
});

test("createRetirementRecord creates record with initiated status", () => {
  const plan: {
    agentId: string;
    successorAgentId: string | null;
    transferItems: ("triggers" | "subscriptions" | "scheduled_tasks" | "ownership")[];
    gracePeriodDays: number;
    notificationTargets: string[];
    revokeAt: string;
    reason: string;
  } = {
    agentId: "agent-1",
    successorAgentId: "agent-2",
    transferItems: ["triggers", "subscriptions"],
    gracePeriodDays: 30,
    notificationTargets: ["admin@example.com"],
    revokeAt: "2026-05-01T00:00:00Z",
    reason: "migration",
  };

  const result = createRetirementRecord(plan, "2026-04-01T00:00:00Z");

  assert.equal(result.retiringAgentId, "agent-1");
  assert.equal(result.successorAgentId, "agent-2");
  assert.equal(result.gracePeriodDays, 30);
  assert.equal(result.status, "initiated");
  assert.equal(result.completedAt, null);
});

test("isGracePeriodExpired returns false when within grace period", () => {
  const record = {
    retiringAgentId: "agent-1",
    successorAgentId: null,
    transferItems: [] as const,
    gracePeriodDays: 30,
    notificationTargets: [],
    initiatedAt: "2026-04-01T00:00:00Z",
    scheduledRevokeAt: "2026-05-01T00:00:00Z",
    completedAt: null,
    status: "initiated" as const,
  };

  assert.equal(isGracePeriodExpired(record, "2026-04-15T00:00:00Z"), false);
});

test("isGracePeriodExpired returns true when grace period elapsed", () => {
  const record = {
    retiringAgentId: "agent-1",
    successorAgentId: null,
    transferItems: [] as const,
    gracePeriodDays: 30,
    notificationTargets: [],
    initiatedAt: "2026-04-01T00:00:00Z",
    scheduledRevokeAt: "2026-05-01T00:00:00Z",
    completedAt: null,
    status: "initiated" as const,
  };

  assert.equal(isGracePeriodExpired(record, "2026-05-02T00:00:00Z"), true);
});
