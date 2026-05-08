import assert from "node:assert/strict";
import test from "node:test";

import {
  AgentLifecycleStateSchema,
  AgentLifecycleState,
  AgentDefinitionSchema,
  AgentComponentsSchema,
  VALID_LIFECYCLE_TRANSITIONS,
  isValidLifecycleTransition,
  canAutoPromote,
  isTerminalState,
  listActiveAgents,
} from "../../../src/ops-maturity/agent-lifecycle/agent-registry/index.js";

test("AgentLifecycleStateSchema accepts all 9 states per R3-35", () => {
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
    const result = AgentLifecycleStateSchema.parse(state);
    assert.equal(result, state, `${state} should be a valid AgentLifecycleState`);
  }
});

test("AgentLifecycleStateSchema rejects invalid states", () => {
  assert.throws(() => AgentLifecycleStateSchema.parse("invalid" as AgentLifecycleState));
  assert.throws(() => AgentLifecycleStateSchema.parse("pending"));
  assert.throws(() => AgentLifecycleStateSchema.parse(""));
});

test("VALID_LIFECYCLE_TRANSITIONS has entries for all 9 states per R3-35", () => {
  assert.equal(VALID_LIFECYCLE_TRANSITIONS.size, 9, "should have entries for all 9 states");

  // Verify all 9 states are present as keys
  const expectedStates: AgentLifecycleState[] = [
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

  for (const state of expectedStates) {
    assert.ok(VALID_LIFECYCLE_TRANSITIONS.has(state), `${state} should be a key in VALID_LIFECYCLE_TRANSITIONS`);
  }
});

test("VALID_LIFECYCLE_TRANSITIONS defines correct transitions per R3-35", () => {
  // draft -> testing
  assert.deepEqual(VALID_LIFECYCLE_TRANSITIONS.get("draft"), ["testing"]);

  // testing -> staging, draft
  assert.deepEqual(VALID_LIFECYCLE_TRANSITIONS.get("testing"), ["staging", "draft"]);

  // staging -> canary, testing
  assert.deepEqual(VALID_LIFECYCLE_TRANSITIONS.get("staging"), ["canary", "testing"]);

  // canary -> active, staging, paused
  assert.deepEqual(VALID_LIFECYCLE_TRANSITIONS.get("canary"), ["active", "staging", "paused"]);

  // active -> paused, deprecated
  assert.deepEqual(VALID_LIFECYCLE_TRANSITIONS.get("active"), ["paused", "deprecated"]);

  // paused -> active, deprecated, canary
  assert.deepEqual(VALID_LIFECYCLE_TRANSITIONS.get("paused"), ["active", "deprecated", "canary"]);

  // deprecated -> archived, active
  assert.deepEqual(VALID_LIFECYCLE_TRANSITIONS.get("deprecated"), ["archived", "active"]);

  // archived -> removed
  assert.deepEqual(VALID_LIFECYCLE_TRANSITIONS.get("archived"), ["removed"]);

  // removed -> (terminal, no transitions)
  assert.deepEqual(VALID_LIFECYCLE_TRANSITIONS.get("removed"), []);
});

test("isValidLifecycleTransition validates transitions correctly", () => {
  // Valid transitions
  assert.equal(isValidLifecycleTransition("draft", "testing"), true);
  assert.equal(isValidLifecycleTransition("testing", "staging"), true);
  assert.equal(isValidLifecycleTransition("staging", "canary"), true);
  assert.equal(isValidLifecycleTransition("canary", "active"), true);
  assert.equal(isValidLifecycleTransition("active", "paused"), true);
  assert.equal(isValidLifecycleTransition("paused", "deprecated"), true);
  assert.equal(isValidLifecycleTransition("deprecated", "archived"), true);
  assert.equal(isValidLifecycleTransition("archived", "removed"), true);

  // Invalid transitions
  assert.equal(isValidLifecycleTransition("draft", "active"), false);
  assert.equal(isValidLifecycleTransition("draft", "archived"), false);
  assert.equal(isValidLifecycleTransition("active", "draft"), false);
  assert.equal(isValidLifecycleTransition("canary", "active"), true);
  assert.equal(isValidLifecycleTransition("canary", "staging"), true);
  assert.equal(isValidLifecycleTransition("canary", "paused"), true);
});

test("canAutoPromote returns true only for canary state per R3-35", () => {
  assert.equal(canAutoPromote("canary"), true, "canary should allow auto promote");
  assert.equal(canAutoPromote("draft"), false);
  assert.equal(canAutoPromote("testing"), false);
  assert.equal(canAutoPromote("staging"), false);
  assert.equal(canAutoPromote("active"), false);
  assert.equal(canAutoPromote("paused"), false);
  assert.equal(canAutoPromote("deprecated"), false);
  assert.equal(canAutoPromote("archived"), false);
  assert.equal(canAutoPromote("removed"), false);
});

test("isTerminalState returns true only for removed state per R3-35", () => {
  assert.equal(isTerminalState("removed"), true);
  assert.equal(isTerminalState("archived"), true, "archived is terminal (only removed should allow further transitions)");
  assert.equal(isTerminalState("draft"), false);
  assert.equal(isTerminalState("testing"), false);
  assert.equal(isTerminalState("staging"), false);
  assert.equal(isTerminalState("canary"), false);
  assert.equal(isTerminalState("active"), false);
  assert.equal(isTerminalState("paused"), false);
  assert.equal(isTerminalState("deprecated"), false);
});

test("listActiveAgents filters active and canary agents", () => {
  const agents = [
    { agentId: "1", lifecycleState: "draft" },
    { agentId: "2", lifecycleState: "testing" },
    { agentId: "3", lifecycleState: "staging" },
    { agentId: "4", lifecycleState: "canary" },
    { agentId: "5", lifecycleState: "active" },
    { agentId: "6", lifecycleState: "paused" },
    { agentId: "7", lifecycleState: "deprecated" },
    { agentId: "8", lifecycleState: "archived" },
    { agentId: "9", lifecycleState: "removed" },
  ] as any[];

  const result = listActiveAgents(agents);
  assert.equal(result.length, 2, "should return only active and canary");
  assert.ok(result.some((a) => a.agentId === "4"), "should include canary agent");
  assert.ok(result.some((a) => a.agentId === "5"), "should include active agent");
});

test("AgentDefinitionSchema accepts valid agent definition with all 9 lifecycle states", () => {
  const states: AgentLifecycleState[] = [
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

  for (const state of states) {
    const agent = {
      agentId: `agent-${state}`,
      name: `Test Agent ${state}`,
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
      lifecycleState: state,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    };

    const result = AgentDefinitionSchema.parse(agent);
    assert.equal(result.lifecycleState, state, `${state} should be accepted`);
  }
});
