import assert from "node:assert/strict";
import test from "node:test";

import { AgentLifecycleService } from "../../../src/ops-maturity/agent-lifecycle/agent-lifecycle-service.js";

function seedService(): AgentLifecycleService {
  const service = new AgentLifecycleService();
  service.registerAgent({
    agentId: "agent_ops_1",
    displayName: "Ops Agent",
    domainId: "ops",
    capabilities: ["triage", "rollback"],
    owner: "ops_lead",
    lifecycleState: "canary",
    currentVersionId: "v2",
  });
  service.addVersion({
    versionId: "v1",
    agentId: "agent_ops_1",
    promptRefs: ["prompt:v1"],
    toolBundleRefs: ["tools:v1"],
    policyRefs: ["policy:v1"],
    modelProfileRefs: ["model:v1"],
    createdAt: "2026-04-19T00:00:00.000Z",
    stable: true,
  });
  service.addVersion({
    versionId: "v2",
    agentId: "agent_ops_1",
    promptRefs: ["prompt:v2"],
    toolBundleRefs: ["tools:v2"],
    policyRefs: ["policy:v2"],
    modelProfileRefs: ["model:v2"],
    createdAt: "2026-04-20T00:00:00.000Z",
    stable: false,
  });
  return service;
}

test("AgentLifecycleService promotes canary and can roll back to prior stable version", () => {
  const service = seedService();
  const promoted = service.promoteCanary("agent_ops_1", {
    rolloutPercent: 30,
    successRate: 0.995,
  }, "2026-04-20T01:00:00.000Z");

  assert.equal(promoted.toState, "active");
  assert.equal(service.listActive().length, 1);

  const rollback = service.rollback("agent_ops_1", "2026-04-20T02:00:00.000Z");
  assert.equal(rollback.toVersionId, "v1");
  assert.equal(service.getAgent("agent_ops_1")?.currentVersionId, "v1");
});

test("AgentLifecycleService forbids binding new tasks to retired agents", () => {
  const service = seedService();
  service.retire({
    agentId: "agent_ops_1",
    successorAgentId: null,
    revokeAt: "2026-04-20T03:00:00.000Z",
  }, "2026-04-20T03:00:00.000Z");

  assert.throws(() => {
    service.bindTask("agent_ops_1", "task_new_1");
  }, /agent_lifecycle\.binding_forbidden_retired/);
});
