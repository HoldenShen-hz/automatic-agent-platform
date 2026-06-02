import assert from "node:assert/strict";
import test from "node:test";

import { AgentLifecycleService } from "../../../src/ops-maturity/agent-lifecycle/agent-lifecycle-service.js";

test("integration: agent rollout, rollback, retirement, and binding gate follow lifecycle rules", () => {
  const service = new AgentLifecycleService();
  service.registerAgent({
    agentId: "agent_release_1",
    name: "Release Agent",
    domainId: "engineering-ops",
    owner: { path: "eng_lead", orgNodeId: "engineering-ops" },
    components: {
      pack: { packId: "pack_ops", version: "1.0.0" },
      connectorBindings: [],
      promptBundle: { bundleId: "prompt_ops", version: "1.0.0" },
      modelBinding: { provider: "anthropic", model: "claude-4", fallbackChain: [] },
      trustProfile: { initialLevel: "manual_only", scoringConfig: { successWeight: 0.4, latencyWeight: 0.3, errorWeight: 0.3 } },
      triggerSet: [],
      autonomyConfig: { maxAutomationLevel: "manual_only", requireHumanApprovalForHighRisk: true, maxRetriesBeforeApproval: 3 },
    },
    lifecycleState: "canary",
    currentVersionId: "v2",
    createdAt: "2026-04-19T00:00:00.000Z",
    updatedAt: "2026-04-19T00:00:00.000Z",
  });
  service.addVersion({
    versionId: "v1",
    agentId: "agent_release_1",
    createdAt: "2026-04-19T00:00:00.000Z",
    semver: "1.0.0",
    componentSnapshot: {
      packVersion: "1.0.0",
      promptBundleVersion: "1.0.0",
      modelBindingHash: "hash1",
      trustProfileHash: "hash1",
      triggerSetHash: "hash1",
      autonomyConfigHash: "hash1",
    },
    createdBy: "eng_lead",
    releaseNote: "v1 release",
  });
  service.addVersion({
    versionId: "v2",
    agentId: "agent_release_1",
    createdAt: "2026-04-20T00:00:00.000Z",
    semver: "2.0.0",
    componentSnapshot: {
      packVersion: "2.0.0",
      promptBundleVersion: "2.0.0",
      modelBindingHash: "hash2",
      trustProfileHash: "hash2",
      triggerSetHash: "hash2",
      autonomyConfigHash: "hash2",
    },
    createdBy: "eng_lead",
    releaseNote: "v2 release",
  });

  service.promoteCanary("agent_release_1", {
    rolloutPercent: 35,
    successRate: 0.996,
    latencyP50Ms: 150,
    errorRate: 0.01,
    currentStage: 20,
  }, "2026-04-20T01:00:00.000Z");
  const binding = service.bindTask("agent_release_1", "task_release_1", "2026-04-20T01:05:00.000Z");
  assert.equal(binding.versionId, "v2");

  const rollback = service.rollback("agent_release_1", "2026-04-20T01:10:00.000Z");
  assert.equal(rollback.toVersionId, "v1");

  service.retire({
    agentId: "agent_release_1",
    reason: "superseded",
    successorAgentId: null,
    transferItems: ["triggers", "subscriptions", "scheduled_tasks", "ownership"],
    gracePeriodDays: 30,
    notificationTargets: ["eng_lead"],
    revokeAt: "2026-04-20T02:00:00.000Z",
  }, "2026-04-20T02:00:00.000Z");
  assert.throws(() => service.bindTask("agent_release_1", "task_release_2"), /binding_forbidden_retired/);
});
