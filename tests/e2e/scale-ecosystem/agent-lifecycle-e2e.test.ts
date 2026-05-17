import assert from "node:assert/strict";
import test from "node:test";

import { nowIso } from "../../../src/platform/contracts/types/ids.js";
import { AgentLifecycleService, type ManagedAgentDefinition } from "../../../src/ops-maturity/agent-lifecycle/agent-lifecycle-service.js";

function createAgent(overrides: Partial<ManagedAgentDefinition> = {}): ManagedAgentDefinition {
  const timestamp = nowIso();
  return {
    agentId: overrides.agentId ?? "agent-e2e-001",
    name: overrides.name ?? "E2E Agent",
    domainId: overrides.domainId ?? "general_ops",
    owner: overrides.owner ?? {
      orgNodeId: "org.platform.sre",
      path: "/platform/sre",
    },
    components: overrides.components ?? {
      pack: { packId: "pack.platform", version: "1.0.0" },
      promptBundle: { bundleId: "prompt.platform", version: "1.0.0" },
      modelBinding: { provider: "openai", model: "gpt-4.1", fallbackChain: [] },
      trustProfile: { initialLevel: "no_write", scoringConfig: {} },
      triggerSet: [],
      connectorBindings: [],
      autonomyConfig: {
        maxAutomationLevel: "manual_only",
        requireHumanApprovalForHighRisk: true,
        maxRetriesBeforeApproval: 3,
      },
    },
    currentVersionId: overrides.currentVersionId ?? "ver-001",
    lifecycleState: overrides.lifecycleState ?? "draft",
    createdAt: overrides.createdAt ?? timestamp,
    updatedAt: overrides.updatedAt ?? timestamp,
  };
}

test("E2E AgentLifecycle: valid transitions promote an agent to active", () => {
  const service = new AgentLifecycleService();
  const agent = service.registerAgent(createAgent());

  assert.equal(agent.lifecycleState, "draft");
  assert.equal(service.transition(agent.agentId, "testing").allowed, true);
  assert.equal(service.transition(agent.agentId, "staging").allowed, true);
  assert.equal(service.transition(agent.agentId, "active").allowed, true);
  assert.equal(service.listActive().map((item) => item.agentId).includes(agent.agentId), true);
});

test("E2E AgentLifecycle: invalid transitions are rejected without mutating state", () => {
  const service = new AgentLifecycleService();
  const agent = service.registerAgent(createAgent({ agentId: "agent-e2e-invalid" }));

  const rejected = service.transition(agent.agentId, "active");
  assert.equal(rejected.allowed, false);
  assert.match(rejected.reason ?? "", /Invalid transition/);
  assert.equal(service.listActive().length, 0);
});

test("E2E AgentLifecycle: documented production state is normalized to active", () => {
  const service = new AgentLifecycleService();
  const agent = service.registerAgent(createAgent({
    agentId: "agent-e2e-production",
    lifecycleState: "canary",
  }));

  const transitioned = service.transition(agent.agentId, "production");
  assert.equal(transitioned.allowed, true);
  assert.equal(service.listActive().some((item) => item.agentId === agent.agentId), true);
});
