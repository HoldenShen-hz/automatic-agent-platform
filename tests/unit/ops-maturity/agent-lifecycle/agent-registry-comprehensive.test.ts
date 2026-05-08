import assert from "node:assert/strict";
import test from "node:test";

import {
  isValidLifecycleTransition,
  canAutoPromote,
  isTerminalState,
  listActiveAgents,
  VALID_LIFECYCLE_TRANSITIONS,
  type AgentLifecycleState,
  type AgentDefinition,
} from "../../../../src/ops-maturity/agent-lifecycle/agent-registry/index.js";

// ---------------------------------------------------------------------------
// Helper - create a minimal agent definition for testing
// ---------------------------------------------------------------------------

function makeAgent(id: string, state: AgentLifecycleState): AgentDefinition {
  return {
    agentId: id,
    name: `Agent ${id}`,
    domainId: "domain-1",
    owner: { orgNodeId: "org-1", path: "/org-1" },
    components: {
      pack: { packId: "pack-1", version: "1.0.0" },
      promptBundle: { bundleId: "bundle-1", version: "1.0.0" },
      modelBinding: { provider: "openai", model: "gpt-4", fallbackChain: [] },
      trustProfile: { initialLevel: "suggestion", scoringConfig: { successWeight: 0.4, latencyWeight: 0.3, errorWeight: 0.3 } },
      triggerSet: [],
      autonomyConfig: { maxAutomationLevel: "supervised", requireHumanApprovalForHighRisk: true, maxRetriesBeforeApproval: 3 },
    },
    currentVersionId: "v1",
    lifecycleState: state,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// isValidLifecycleTransition - all valid transitions
// ---------------------------------------------------------------------------

test("isValidLifecycleTransition - all valid transitions", () => {
  // From VALID_LIFECYCLE_TRANSITIONS map:
  // draft -> testing
  assert.equal(isValidLifecycleTransition("draft", "testing"), true);

  // testing -> staging, testing -> draft
  assert.equal(isValidLifecycleTransition("testing", "staging"), true);
  assert.equal(isValidLifecycleTransition("testing", "draft"), true);

  // staging -> canary, staging -> testing
  assert.equal(isValidLifecycleTransition("staging", "canary"), true);
  assert.equal(isValidLifecycleTransition("staging", "testing"), true);

  // canary -> active, canary -> staging
  assert.equal(isValidLifecycleTransition("canary", "active"), true);
  assert.equal(isValidLifecycleTransition("canary", "staging"), true);

  // active -> paused, active -> deprecated
  assert.equal(isValidLifecycleTransition("active", "paused"), true);
  assert.equal(isValidLifecycleTransition("active", "deprecated"), true);

  // paused -> active, paused -> deprecated
  assert.equal(isValidLifecycleTransition("paused", "active"), true);
  assert.equal(isValidLifecycleTransition("paused", "deprecated"), true);

  // deprecated -> archived, deprecated -> active
  assert.equal(isValidLifecycleTransition("deprecated", "archived"), true);
  assert.equal(isValidLifecycleTransition("deprecated", "active"), true);
});

test("isValidLifecycleTransition - invalid transitions return false", () => {
  // Cannot go backwards in most cases
  assert.equal(isValidLifecycleTransition("staging", "draft"), false);
  assert.equal(isValidLifecycleTransition("canary", "draft"), false);

  // Cannot skip stages
  assert.equal(isValidLifecycleTransition("draft", "active"), false);
  assert.equal(isValidLifecycleTransition("draft", "canary"), false);
  assert.equal(isValidLifecycleTransition("testing", "canary"), false);

  // Cannot transition from archived (terminal)
  assert.equal(isValidLifecycleTransition("archived", "draft"), false);
  assert.equal(isValidLifecycleTransition("archived", "active"), false);

  // Cannot transition to archived except from deprecated
  assert.equal(isValidLifecycleTransition("active", "archived"), false);
  assert.equal(isValidLifecycleTransition("paused", "archived"), false);
  assert.equal(isValidLifecycleTransition("draft", "archived"), false);

  // Cannot go from active back to canary
  assert.equal(isValidLifecycleTransition("active", "canary"), false);

  // paused -> canary is allowed (bidirectional)
  assert.equal(isValidLifecycleTransition("paused", "canary"), true);
});

test("isValidLifecycleTransition - same state returns false (not a valid transition)", () => {
  // Same state is not considered a valid transition per the VALID_LIFECYCLE_TRANSITIONS map
  assert.equal(isValidLifecycleTransition("draft", "draft"), false);
  assert.equal(isValidLifecycleTransition("active", "active"), false);
  assert.equal(isValidLifecycleTransition("canary", "canary"), false);
  assert.equal(isValidLifecycleTransition("archived", "archived"), false);
});

// ---------------------------------------------------------------------------
// listActiveAgents - filters correctly (only canary and active)
// ---------------------------------------------------------------------------

test("listActiveAgents - filters correctly (only canary and active)", () => {
  const agents: AgentDefinition[] = [
    makeAgent("draft-agent", "draft"),
    makeAgent("testing-agent", "testing"),
    makeAgent("staging-agent", "staging"),
    makeAgent("canary-agent", "canary"),
    makeAgent("active-agent", "active"),
    makeAgent("paused-agent", "paused"),
    makeAgent("deprecated-agent", "deprecated"),
    makeAgent("archived-agent", "archived"),
  ];

  const active = listActiveAgents(agents);

  assert.equal(active.length, 2);
  assert.ok(active.some((a) => a.agentId === "canary-agent"));
  assert.ok(active.some((a) => a.agentId === "active-agent"));
  assert.ok(!active.some((a) => a.agentId === "draft-agent"));
  assert.ok(!active.some((a) => a.agentId === "archived-agent"));
});

test("listActiveAgents - empty array returns empty", () => {
  const active = listActiveAgents([]);
  assert.equal(active.length, 0);
});

test("listActiveAgents - only non-active states returns empty", () => {
  const agents: AgentDefinition[] = [
    makeAgent("draft-agent", "draft"),
    makeAgent("archived-agent", "archived"),
  ];

  const active = listActiveAgents(agents);
  assert.equal(active.length, 0);
});

test("listActiveAgents - only canary agents", () => {
  const agents: AgentDefinition[] = [
    makeAgent("canary-1", "canary"),
    makeAgent("canary-2", "canary"),
  ];

  const active = listActiveAgents(agents);
  assert.equal(active.length, 2);
});

test("listActiveAgents - only active agents", () => {
  const agents: AgentDefinition[] = [
    makeAgent("active-1", "active"),
    makeAgent("active-2", "active"),
  ];

  const active = listActiveAgents(agents);
  assert.equal(active.length, 2);
});

test("listActiveAgents - does not modify original array", () => {
  const agents: AgentDefinition[] = [
    makeAgent("canary-agent", "canary"),
    makeAgent("active-agent", "active"),
  ];

  const active = listActiveAgents(agents);

  // Original should be unchanged
  assert.equal(agents.length, 2);
  assert.equal(active.length, 2);
  assert.notStrictEqual(agents, active);
});

// ---------------------------------------------------------------------------
// canAutoPromote - only canary returns true
// ---------------------------------------------------------------------------

test("canAutoPromote - only canary returns true", () => {
  const canaryStates: AgentLifecycleState[] = ["canary"];
  const nonCanaryStates: AgentLifecycleState[] = [
    "draft",
    "testing",
    "staging",
    "active",
    "paused",
    "deprecated",
    "archived",
  ];

  for (const state of canaryStates) {
    assert.equal(canAutoPromote(state), true, `canary state ${state} should return true`);
  }

  for (const state of nonCanaryStates) {
    assert.equal(canAutoPromote(state), false, `non-canary state ${state} should return false`);
  }
});

// ---------------------------------------------------------------------------
// isTerminalState - only archived is terminal
// ---------------------------------------------------------------------------

test("isTerminalState - only archived is terminal", () => {
  const terminalStates: AgentLifecycleState[] = ["archived"];
  const nonTerminalStates: AgentLifecycleState[] = [
    "draft",
    "testing",
    "staging",
    "canary",
    "active",
    "paused",
    "deprecated",
  ];

  for (const state of terminalStates) {
    assert.equal(isTerminalState(state), true, `terminal state ${state} should return true`);
  }

  for (const state of nonTerminalStates) {
    assert.equal(isTerminalState(state), false, `non-terminal state ${state} should return false`);
  }
});

// ---------------------------------------------------------------------------
// VALID_LIFECYCLE_TRANSITIONS map completeness
// ---------------------------------------------------------------------------

test("VALID_LIFECYCLE_TRANSITIONS contains all states", () => {
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
      `State ${state} should be in VALID_LIFECYCLE_TRANSITIONS`,
    );
  }

  assert.equal(VALID_LIFECYCLE_TRANSITIONS.size, allStates.length);
});

test("archived state has valid transition to removed (terminal via removed)", () => {
  const archivedTransitions = VALID_LIFECYCLE_TRANSITIONS.get("archived");
  assert.ok(archivedTransitions !== undefined);
  assert.equal(archivedTransitions.length, 1);
  assert.equal(archivedTransitions[0], "removed");
});

test("draft state only allows transition to testing", () => {
  const draftTransitions = VALID_LIFECYCLE_TRANSITIONS.get("draft");
  assert.ok(draftTransitions !== undefined);
  assert.deepEqual(draftTransitions, ["testing"]);
});

// ---------------------------------------------------------------------------
// isValidLifecycleTransition edge cases
// ---------------------------------------------------------------------------

test("isValidLifecycleTransition handles unknown states gracefully", () => {
  // Using a string that is not a valid AgentLifecycleState
  // The function should return false (or not crash)
  assert.equal(isValidLifecycleTransition("unknown-state" as AgentLifecycleState, "active"), false);
  assert.equal(isValidLifecycleTransition("canary", "unknown-state" as AgentLifecycleState), false);
});

// ---------------------------------------------------------------------------
// Integration: full lifecycle path from draft to archived
// ---------------------------------------------------------------------------

test("Full lifecycle path: draft -> testing -> staging -> canary -> active -> deprecated -> archived", () => {
  const path: AgentLifecycleState[] = [
    "draft",
    "testing",
    "staging",
    "canary",
    "active",
    "deprecated",
    "archived",
  ];

  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i]!;
    const to = path[i + 1]!;
    assert.equal(
      isValidLifecycleTransition(from, to),
      true,
      `Transition from ${from} to ${to} should be valid`,
    );
  }
});

test("Canary promotion path: canary -> active", () => {
  assert.equal(isValidLifecycleTransition("canary", "active"), true);
  assert.equal(canAutoPromote("canary"), true);
});
