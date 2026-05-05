import assert from "node:assert/strict";
import test from "node:test";

import {
  AgentLifecycleStateSchema,
  VALID_LIFECYCLE_TRANSITIONS,
  isValidLifecycleTransition,
  listActiveAgents,
  canAutoPromote,
  isTerminalState,
  AgentComponentsSchema,
  AgentDefinitionSchema,
  type AgentLifecycleState,
  type AgentDefinition,
} from "../../../../src/ops-maturity/agent-lifecycle/agent-registry/index.js";

function createAgentDefinition(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    agentId: "test-agent-" + Math.random().toString(36).slice(2, 8),
    name: "Test Agent",
    domainId: "test-domain",
    owner: { orgNodeId: "org1", path: "/org1" },
    components: {
      pack: { packId: "pack1", version: "1.0.0" },
      promptBundle: { bundleId: "bundle1", version: "1.0.0" },
      modelBinding: { provider: "openai", model: "gpt-4", fallbackChain: [] },
      trustProfile: { initialLevel: "suggestion", scoringConfig: {} },
      triggerSet: [],
      connectorBindings: [],
      autonomyConfig: {},
    },
    lifecycleState: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

test("AgentLifecycleStateSchema: validates all valid states", () => {
  const validStates: AgentLifecycleState[] = [
    "draft",
    "testing",
    "staging",
    "canary",
    "active",
    "paused",
    "deprecated",
    "archived",
    "removed",
  ];

  for (const state of validStates) {
    const result = AgentLifecycleStateSchema.safeParse(state);
    assert.equal(result.success, true, `State ${state} should be valid`);
  }
});

test("AgentLifecycleStateSchema: rejects invalid states", () => {
  const result = AgentLifecycleStateSchema.safeParse("invalid_state");
  assert.equal(result.success, false);
});

test("VALID_LIFECYCLE_TRANSITIONS: has entries for all states", () => {
  const allStates: AgentLifecycleState[] = [
    "draft",
    "testing",
    "staging",
    "canary",
    "active",
    "paused",
    "deprecated",
    "archived",
    "removed",
  ];

  for (const state of allStates) {
    assert.ok(
      VALID_LIFECYCLE_TRANSITIONS.has(state),
      `State ${state} should have transitions defined`
    );
  }
});

test("VALID_LIFECYCLE_TRANSITIONS: draft transitions", () => {
  const transitions = VALID_LIFECYCLE_TRANSITIONS.get("draft");
  assert.deepEqual(transitions, ["testing"]);
});

test("VALID_LIFECYCLE_TRANSITIONS: testing transitions", () => {
  const transitions = VALID_LIFECYCLE_TRANSITIONS.get("testing");
  assert.deepEqual(transitions, ["staging", "draft"]);
});

test("VALID_LIFECYCLE_TRANSITIONS: staging transitions", () => {
  const transitions = VALID_LIFECYCLE_TRANSITIONS.get("staging");
  assert.deepEqual(transitions, ["canary", "testing"]);
});

test("VALID_LIFECYCLE_TRANSITIONS: canary transitions", () => {
  const transitions = VALID_LIFECYCLE_TRANSITIONS.get("canary");
  assert.deepEqual(transitions, ["active", "staging", "paused"]);
});

test("VALID_LIFECYCLE_TRANSITIONS: active transitions", () => {
  const transitions = VALID_LIFECYCLE_TRANSITIONS.get("active");
  assert.deepEqual(transitions, ["paused", "deprecated"]);
});

test("VALID_LIFECYCLE_TRANSITIONS: paused transitions", () => {
  const transitions = VALID_LIFECYCLE_TRANSITIONS.get("paused");
  assert.deepEqual(transitions, ["active", "deprecated", "canary"]);
});

test("VALID_LIFECYCLE_TRANSITIONS: deprecated transitions", () => {
  const transitions = VALID_LIFECYCLE_TRANSITIONS.get("deprecated");
  assert.deepEqual(transitions, ["archived", "paused"]);
});

test("VALID_LIFECYCLE_TRANSITIONS: archived transitions", () => {
  const transitions = VALID_LIFECYCLE_TRANSITIONS.get("archived");
  assert.deepEqual(transitions, ["removed"]);
});

test("VALID_LIFECYCLE_TRANSITIONS: removed has no transitions", () => {
  const transitions = VALID_LIFECYCLE_TRANSITIONS.get("removed");
  assert.deepEqual(transitions, []);
});

test("isValidLifecycleTransition: returns true for valid transitions", () => {
  assert.equal(isValidLifecycleTransition("draft", "testing"), true);
  assert.equal(isValidLifecycleTransition("testing", "staging"), true);
  assert.equal(isValidLifecycleTransition("staging", "canary"), true);
  assert.equal(isValidLifecycleTransition("canary", "active"), true);
});

test("isValidLifecycleTransition: returns false for invalid transitions", () => {
  assert.equal(isValidLifecycleTransition("draft", "active"), false);
  assert.equal(isValidLifecycleTransition("draft", "staging"), false);
  assert.equal(isValidLifecycleTransition("removed", "active"), false);
  assert.equal(isValidLifecycleTransition("archived", "canary"), false);
});

test("isValidLifecycleTransition: returns false for unknown source state", () => {
  // @ts-ignore - testing invalid input
  assert.equal(isValidLifecycleTransition("unknown_state", "active"), false);
});

test("canAutoPromote: returns true only for canary state", () => {
  assert.equal(canAutoPromote("canary"), true);
  assert.equal(canAutoPromote("staging"), false);
  assert.equal(canAutoPromote("active"), false);
  assert.equal(canAutoPromote("testing"), false);
  assert.equal(canAutoPromote("draft"), false);
});

test("isTerminalState: returns true only for removed state", () => {
  assert.equal(isTerminalState("removed"), true);
  assert.equal(isTerminalState("archived"), false);
  assert.equal(isTerminalState("deprecated"), false);
  assert.equal(isTerminalState("active"), false);
});

test("listActiveAgents: filters active and canary agents", () => {
  const agents = [
    createAgentDefinition({ agentId: "a1", lifecycleState: "active" }),
    createAgentDefinition({ agentId: "a2", lifecycleState: "canary" }),
    createAgentDefinition({ agentId: "a3", lifecycleState: "draft" }),
    createAgentDefinition({ agentId: "a4", lifecycleState: "staging" }),
    createAgentDefinition({ agentId: "a5", lifecycleState: "paused" }),
    createAgentDefinition({ agentId: "a6", lifecycleState: "deprecated" }),
  ];

  const active = listActiveAgents(agents);

  assert.equal(active.length, 2);
  assert.ok(active.some((a) => a.agentId === "a1"));
  assert.ok(active.some((a) => a.agentId === "a2"));
});

test("listActiveAgents: handles empty array", () => {
  const result = listActiveAgents([]);
  assert.equal(result.length, 0);
});

test("listActiveAgents: handles all active states", () => {
  const agents = [
    createAgentDefinition({ agentId: "active1", lifecycleState: "active" }),
    createAgentDefinition({ agentId: "canary1", lifecycleState: "canary" }),
  ];

  const result = listActiveAgents(agents);
  assert.equal(result.length, 2);
});

test("AgentComponentsSchema: validates valid components", () => {
  const validComponents = {
    pack: { packId: "pack1", version: "1.0.0" },
    promptBundle: { bundleId: "bundle1", version: "1.0.0" },
    modelBinding: { provider: "openai", model: "gpt-4", fallbackChain: [] },
    trustProfile: { initialLevel: "suggestion", scoringConfig: {} },
    triggerSet: [],
    connectorBindings: [],
    autonomyConfig: {},
  };

  const result = AgentComponentsSchema.safeParse(validComponents);
  assert.equal(result.success, true);
});

test("AgentComponentsSchema: rejects invalid pack", () => {
  const invalidComponents = {
    pack: { packId: "", version: "1.0.0" }, // packId too short
    promptBundle: { bundleId: "bundle1", version: "1.0.0" },
    modelBinding: { provider: "openai", model: "gpt-4", fallbackChain: [] },
    trustProfile: { initialLevel: "suggestion", scoringConfig: {} },
    triggerSet: [],
    connectorBindings: [],
    autonomyConfig: {},
  };

  const result = AgentComponentsSchema.safeParse(invalidComponents);
  assert.equal(result.success, false);
});

test("AgentDefinitionSchema: validates complete agent definition", () => {
  const validAgent = createAgentDefinition({
    agentId: "agent-1",
    name: "Test Agent",
    domainId: "domain-1",
  });

  const result = AgentDefinitionSchema.safeParse(validAgent);
  assert.equal(result.success, true);
});

test("AgentDefinitionSchema: rejects agent with missing required fields", () => {
  // @ts-ignore - testing invalid input
  const invalidAgent = {
    name: "Test Agent",
    domainId: "domain-1",
  };

  const result = AgentDefinitionSchema.safeParse(invalidAgent);
  assert.equal(result.success, false);
});

test("AgentDefinitionSchema: rejects agent with empty agentId", () => {
  const invalidAgent = createAgentDefinition({ agentId: "" });

  const result = AgentDefinitionSchema.safeParse(invalidAgent);
  assert.equal(result.success, false);
});

test("AgentDefinitionSchema: default lifecycleState is draft", () => {
  const partialAgent = {
    agentId: "agent-1",
    name: "Test Agent",
    domainId: "domain-1",
    owner: { orgNodeId: "org1", path: "/org1" },
    components: {
      pack: { packId: "pack1", version: "1.0.0" },
      promptBundle: { bundleId: "bundle1", version: "1.0.0" },
      modelBinding: { provider: "openai", model: "gpt-4", fallbackChain: [] },
      trustProfile: { initialLevel: "suggestion", scoringConfig: {} },
      triggerSet: [],
      connectorBindings: [],
      autonomyConfig: {},
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const result = AgentDefinitionSchema.safeParse(partialAgent);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.lifecycleState, "draft");
  }
});

test("isValidLifecycleTransition: backward transitions are valid", () => {
  // Testing rollback paths
  assert.equal(isValidLifecycleTransition("testing", "draft"), true);
  assert.equal(isValidLifecycleTransition("staging", "testing"), true);
  assert.equal(isValidLifecycleTransition("canary", "staging"), true);
});

test("isValidLifecycleTransition: paused can go back to canary", () => {
  assert.equal(isValidLifecycleTransition("paused", "canary"), true);
});

test("isValidLifecycleTransition: archived cannot reactivate directly", () => {
  assert.equal(isValidLifecycleTransition("archived", "active"), false);
});
