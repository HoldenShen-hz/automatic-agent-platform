import assert from "node:assert/strict";
import test from "node:test";

import {
  isValidLifecycleTransition,
  listActiveAgents,
  canAutoPromote,
  isTerminalState,
  type AgentDefinition,
  type AgentLifecycleState,
} from "../../../../src/ops-maturity/agent-lifecycle/agent-registry/index.js";

/**
 * Issue #2103: deprecated→active transition bypasses all stage gates
 */
test("AgentRegistry: deprecated→active transition is blocked (issue #2103)", () => {
  const isValid = isValidLifecycleTransition("deprecated", "active");
  assert.equal(isValid, false);
});

test("AgentRegistry: valid transitions for all states", () => {
  // draft can only go to testing
  assert.equal(isValidLifecycleTransition("draft", "testing"), true);
  assert.equal(isValidLifecycleTransition("draft", "active"), false);

  // testing can go to staging or back to draft
  assert.equal(isValidLifecycleTransition("testing", "staging"), true);
  assert.equal(isValidLifecycleTransition("testing", "draft"), true);
  assert.equal(isValidLifecycleTransition("testing", "active"), false);

  // staging can go to canary or back to testing
  assert.equal(isValidLifecycleTransition("staging", "canary"), true);
  assert.equal(isValidLifecycleTransition("staging", "testing"), true);

  // canary can go to active, staging, or paused
  assert.equal(isValidLifecycleTransition("canary", "active"), true);
  assert.equal(isValidLifecycleTransition("canary", "staging"), true);
  assert.equal(isValidLifecycleTransition("canary", "paused"), true);

  // active can go to paused or deprecated
  assert.equal(isValidLifecycleTransition("active", "paused"), true);
  assert.equal(isValidLifecycleTransition("active", "deprecated"), true);

  // paused can go to active, deprecated, or canary
  assert.equal(isValidLifecycleTransition("paused", "active"), true);
  assert.equal(isValidLifecycleTransition("paused", "deprecated"), true);
  assert.equal(isValidLifecycleTransition("paused", "canary"), true);

  // deprecated can go to archived or paused
  assert.equal(isValidLifecycleTransition("deprecated", "archived"), true);
  assert.equal(isValidLifecycleTransition("deprecated", "paused"), true);
  assert.equal(isValidLifecycleTransition("deprecated", "active"), false);

  // archived can go to removed only
  assert.equal(isValidLifecycleTransition("archived", "removed"), true);
  assert.equal(isValidLifecycleTransition("archived", "active"), false);

  // removed is terminal
  assert.equal(isValidLifecycleTransition("removed", "active"), false);
});

test("AgentRegistry: listActiveAgents filters correctly", () => {
  const agents: AgentDefinition[] = [
    { agentId: "a1", name: "Agent 1", domainId: "d1", owner: { orgNodeId: "o1", path: "/o1" }, components: {} as any, lifecycleState: "active", createdAt: "", updatedAt: "" },
    { agentId: "a2", name: "Agent 2", domainId: "d1", owner: { orgNodeId: "o1", path: "/o1" }, components: {} as any, lifecycleState: "canary", createdAt: "", updatedAt: "" },
    { agentId: "a3", name: "Agent 3", domainId: "d1", owner: { orgNodeId: "o1", path: "/o1" }, components: {} as any, lifecycleState: "draft", createdAt: "", updatedAt: "" },
    { agentId: "a4", name: "Agent 4", domainId: "d1", owner: { orgNodeId: "o1", path: "/o1" }, components: {} as any, lifecycleState: "paused", createdAt: "", updatedAt: "" },
  ];

  const activeAgents = listActiveAgents(agents);
  assert.equal(activeAgents.length, 2);
  assert.ok(activeAgents.some((a) => a.agentId === "a1"));
  assert.ok(activeAgents.some((a) => a.agentId === "a2"));
});

test("AgentRegistry: canAutoPromote only true for canary", () => {
  const states: AgentLifecycleState[] = ["draft", "testing", "staging", "canary", "active", "paused", "deprecated", "archived", "removed"];

  for (const state of states) {
    const result = canAutoPromote(state);
    if (state === "canary") {
      assert.equal(result, true);
    } else {
      assert.equal(result, false);
    }
  }
});

test("AgentRegistry: isTerminalState only true for removed", () => {
  const states: AgentLifecycleState[] = ["draft", "testing", "staging", "canary", "active", "paused", "deprecated", "archived", "removed"];

  for (const state of states) {
    const result = isTerminalState(state);
    if (state === "removed") {
      assert.equal(result, true);
    } else {
      assert.equal(result, false);
    }
  }
});

test("AgentRegistry: deprecated->active transition bypass issue", () => {
  assert.equal(isValidLifecycleTransition("deprecated", "archived"), true);
  assert.equal(isValidLifecycleTransition("archived", "testing"), false, "archived cannot go directly to testing");
  assert.equal(isValidLifecycleTransition("archived", "active"), false);
  const deprecatedToActive = isValidLifecycleTransition("deprecated", "active");
  assert.equal(deprecatedToActive, false);
});

test("AgentRegistry: full lifecycle promotion path", () => {
  // Proper path: draft -> testing -> staging -> canary -> active
  assert.equal(isValidLifecycleTransition("draft", "testing"), true);
  assert.equal(isValidLifecycleTransition("testing", "staging"), true);
  assert.equal(isValidLifecycleTransition("staging", "canary"), true);
  assert.equal(isValidLifecycleTransition("canary", "active"), true);

  // All intermediate steps are required and valid
  assert.equal(isValidLifecycleTransition("draft", "staging"), false);
  assert.equal(isValidLifecycleTransition("testing", "canary"), false);
  assert.equal(isValidLifecycleTransition("draft", "canary"), false);
});
