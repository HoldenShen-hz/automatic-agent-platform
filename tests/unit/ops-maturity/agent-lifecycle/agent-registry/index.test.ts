import assert from "node:assert/strict";
import test from "node:test";

import {
  AgentLifecycleStateSchema,
  AgentComponentsSchema,
  AgentDefinitionSchema,
  listActiveAgents,
  isValidLifecycleTransition,
  canAutoPromote,
  isTerminalState,
  VALID_LIFECYCLE_TRANSITIONS,
} from "../../../../../src/ops-maturity/agent-lifecycle/agent-registry/index.js";

test("AgentLifecycleStateSchema accepts valid states", () => {
  const states = ["draft", "testing", "staging", "canary", "active", "paused", "deprecated", "archived", "removed"] as const;
  for (const state of states) {
    const result = AgentLifecycleStateSchema.parse(state);
    assert.equal(result, state);
  }
});

test("AgentLifecycleStateSchema rejects invalid states", () => {
  assert.throws(() => AgentLifecycleStateSchema.parse("invalid"));
});

test("AgentDefinitionSchema parses valid agent definition", () => {
  const validAgent = {
    agentId: "agent-1",
    name: "Test Agent",
    domainId: "domain-1",
    owner: { orgNodeId: "node-1", path: "/org/team" },
    components: {
      pack: { packId: "pack-1", version: "1.0.0" },
      promptBundle: { bundleId: "bundle-1", version: "1.0.0" },
      modelBinding: { provider: "anthropic", model: "claude-3", fallbackChain: [] },
      trustProfile: { initialLevel: "suggestion" },
      triggerSet: [],
      autonomyConfig: { maxAutomationLevel: "suggestion" },
    },
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  };
  const result = AgentDefinitionSchema.parse(validAgent);
  assert.equal(result.agentId, "agent-1");
  assert.equal(result.lifecycleState, "draft");
});

test("listActiveAgents filters active and canary agents", () => {
  const agents = [
    { agentId: "1", lifecycleState: "draft" },
    { agentId: "2", lifecycleState: "active" },
    { agentId: "3", lifecycleState: "canary" },
    { agentId: "4", lifecycleState: "paused" },
    { agentId: "5", lifecycleState: "archived" },
  ] as any[];
  const result = listActiveAgents(agents);
  assert.equal(result.length, 2);
  assert.equal(result[0].agentId, "2");
  assert.equal(result[1].agentId, "3");
});

test("listActiveAgents returns empty array for no active agents", () => {
  const agents = [
    { agentId: "1", lifecycleState: "draft" },
    { agentId: "2", lifecycleState: "paused" },
  ] as any[];
  const result = listActiveAgents(agents);
  assert.equal(result.length, 0);
});

test("isValidLifecycleTransition allows draft to testing", () => {
  assert.equal(isValidLifecycleTransition("draft", "testing"), true);
});

test("isValidLifecycleTransition allows testing to staging or draft", () => {
  assert.equal(isValidLifecycleTransition("testing", "staging"), true);
  assert.equal(isValidLifecycleTransition("testing", "draft"), true);
});

test("isValidLifecycleTransition allows staging to canary or testing", () => {
  assert.equal(isValidLifecycleTransition("staging", "canary"), true);
  assert.equal(isValidLifecycleTransition("staging", "testing"), true);
});

test("isValidLifecycleTransition allows canary to active, staging, or paused", () => {
  assert.equal(isValidLifecycleTransition("canary", "active"), true);
  assert.equal(isValidLifecycleTransition("canary", "staging"), true);
  assert.equal(isValidLifecycleTransition("canary", "paused"), true);
});

test("isValidLifecycleTransition allows active to paused or deprecated", () => {
  assert.equal(isValidLifecycleTransition("active", "paused"), true);
  assert.equal(isValidLifecycleTransition("active", "deprecated"), true);
});

test("isValidLifecycleTransition allows paused to active or deprecated", () => {
  assert.equal(isValidLifecycleTransition("paused", "active"), true);
  assert.equal(isValidLifecycleTransition("paused", "deprecated"), true);
});

test("isValidLifecycleTransition allows deprecated to archived or paused", () => {
  assert.equal(isValidLifecycleTransition("deprecated", "archived"), true);
  assert.equal(isValidLifecycleTransition("deprecated", "paused"), true);
  assert.equal(isValidLifecycleTransition("deprecated", "active"), false);
});

test("isValidLifecycleTransition allows archived to removed only", () => {
  assert.equal(isValidLifecycleTransition("archived", "active"), false);
  assert.equal(isValidLifecycleTransition("archived", "removed"), true);
  assert.equal(isValidLifecycleTransition("archived", "draft"), false);
});

test("isValidLifecycleTransition disallows invalid transitions", () => {
  assert.equal(isValidLifecycleTransition("draft", "active"), false);
  assert.equal(isValidLifecycleTransition("draft", "archived"), false);
  assert.equal(isValidLifecycleTransition("active", "draft"), false);
  assert.equal(isValidLifecycleTransition("paused", "staging"), false);
});

test("canAutoPromote returns true only for canary state", () => {
  assert.equal(canAutoPromote("canary"), true);
  assert.equal(canAutoPromote("draft"), false);
  assert.equal(canAutoPromote("active"), false);
  assert.equal(canAutoPromote("paused"), false);
  assert.equal(canAutoPromote("archived"), false);
});

test("isTerminalState returns true only for removed state", () => {
  assert.equal(isTerminalState("removed"), true);
  assert.equal(isTerminalState("archived"), false);
  assert.equal(isTerminalState("active"), false);
  assert.equal(isTerminalState("paused"), false);
  assert.equal(isTerminalState("deprecated"), false);
});

test("VALID_LIFECYCLE_TRANSITIONS has correct structure", () => {
  assert.equal(VALID_LIFECYCLE_TRANSITIONS.size, 9);
  assert.deepEqual(VALID_LIFECYCLE_TRANSITIONS.get("draft"), ["testing"]);
  assert.deepEqual(VALID_LIFECYCLE_TRANSITIONS.get("deprecated"), ["archived", "paused"]);
  assert.deepEqual(VALID_LIFECYCLE_TRANSITIONS.get("archived"), ["removed"]);
  assert.deepEqual(VALID_LIFECYCLE_TRANSITIONS.get("removed"), []);
});

test("AgentComponentsSchema accepts valid components", () => {
  const components = {
    pack: { packId: "p1", version: "1.0" },
    promptBundle: { bundleId: "b1", version: "1.0" },
    modelBinding: { provider: "anthropic", model: "claude-3", fallbackChain: ["claude-2"] },
    trustProfile: { initialLevel: "semi_auto", scoringConfig: { successWeight: 0.5, latencyWeight: 0.3, errorWeight: 0.2 } },
    triggerSet: [{ triggerId: "t1", type: "scheduled", enabled: true }],
    autonomyConfig: { maxAutomationLevel: "full_auto", requireHumanApprovalForHighRisk: false },
  };
  const result = AgentComponentsSchema.parse(components);
  assert.equal(result.pack.packId, "p1");
});

test("AgentComponentsSchema applies defaults", () => {
  const minimal = {
    pack: { packId: "p1", version: "1.0" },
    promptBundle: { bundleId: "b1", version: "1.0" },
    modelBinding: { provider: "anthropic", model: "claude-3" },
    trustProfile: {},
    triggerSet: [],
    autonomyConfig: {},
  };
  const result = AgentComponentsSchema.parse(minimal);
  assert.equal(result.trustProfile.initialLevel, "suggestion");
  assert.deepEqual(result.autonomyConfig.maxAutomationLevel, "supervised");
});
