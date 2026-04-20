import assert from "node:assert/strict";
import test from "node:test";

import { AgentLifecycleService } from "../../../src/ops-maturity/agent-lifecycle/agent-lifecycle-service.js";

test("integration: agent rollout, rollback, retirement, and binding gate follow lifecycle rules", () => {
  const service = new AgentLifecycleService();
  service.registerAgent({
    agentId: "agent_release_1",
    displayName: "Release Agent",
    domainId: "engineering_ops",
    capabilities: ["release", "rollback"],
    owner: "eng_lead",
    lifecycleState: "canary",
    currentVersionId: "v2",
  });
  service.addVersion({
    versionId: "v1",
    agentId: "agent_release_1",
    promptRefs: ["prompt:v1"],
    toolBundleRefs: ["tools:v1"],
    policyRefs: ["policy:v1"],
    modelProfileRefs: ["model:v1"],
    createdAt: "2026-04-19T00:00:00.000Z",
    stable: true,
  });
  service.addVersion({
    versionId: "v2",
    agentId: "agent_release_1",
    promptRefs: ["prompt:v2"],
    toolBundleRefs: ["tools:v2"],
    policyRefs: ["policy:v2"],
    modelProfileRefs: ["model:v2"],
    createdAt: "2026-04-20T00:00:00.000Z",
    stable: false,
  });

  service.promoteCanary("agent_release_1", {
    rolloutPercent: 35,
    successRate: 0.996,
  }, "2026-04-20T01:00:00.000Z");
  const binding = service.bindTask("agent_release_1", "task_release_1", "2026-04-20T01:05:00.000Z");
  assert.equal(binding.versionId, "v2");

  const rollback = service.rollback("agent_release_1", "2026-04-20T01:10:00.000Z");
  assert.equal(rollback.toVersionId, "v1");

  service.retire({
    agentId: "agent_release_1",
    successorAgentId: null,
    revokeAt: "2026-04-20T02:00:00.000Z",
  }, "2026-04-20T02:00:00.000Z");
  assert.throws(() => service.bindTask("agent_release_1", "task_release_2"), /binding_forbidden_retired/);
});
