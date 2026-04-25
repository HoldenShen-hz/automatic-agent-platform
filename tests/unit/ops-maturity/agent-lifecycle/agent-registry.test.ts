import assert from "node:assert/strict";
import test from "node:test";

import {
  AgentLifecycleStateSchema,
  AgentDefinitionSchema,
  PackComponentSchema,
  PromptBundleComponentSchema,
  ModelBindingComponentSchema,
  TrustProfileComponentSchema,
  TriggerPolicySchema,
  AutonomyConfigSchema,
  OrgNodeRefSchema,
  AgentComponentsSchema,
  type AgentLifecycleState,
  type AgentDefinition,
} from "../../../../src/ops-maturity/agent-lifecycle/agent-registry/index.js";

// ---------------------------------------------------------------------------
// Schema validation - valid inputs
// ---------------------------------------------------------------------------

test("AgentLifecycleStateSchema accepts all eight states", () => {
  const states: AgentLifecycleState[] = [
    "draft",
    "testing",
    "staging",
    "canary",
    "active",
    "paused",
    "deprecated",
    "archived",
  ];
  for (const state of states) {
    assert.equal(AgentLifecycleStateSchema.parse(state), state);
  }
});

test("AgentLifecycleStateSchema rejects invalid state", () => {
  assert.throws(() => AgentLifecycleStateSchema.parse("invalid"));
  assert.throws(() => AgentLifecycleStateSchema.parse(""));
  assert.throws(() => AgentLifecycleStateSchema.parse("ACTIVE")); // case-sensitive
});

test("PackComponentSchema parses valid pack component", () => {
  const result = PackComponentSchema.parse({ packId: "pack-1", version: "1.0.0" });
  assert.equal(result.packId, "pack-1");
  assert.equal(result.version, "1.0.0");
});

test("PackComponentSchema rejects empty packId", () => {
  assert.throws(() => PackComponentSchema.parse({ packId: "", version: "1.0.0" }));
});

test("PromptBundleComponentSchema parses valid bundle component", () => {
  const result = PromptBundleComponentSchema.parse({ bundleId: "bundle-1", version: "2.0.0" });
  assert.equal(result.bundleId, "bundle-1");
  assert.equal(result.version, "2.0.0");
});

test("ModelBindingComponentSchema parses with defaults", () => {
  const result = ModelBindingComponentSchema.parse({ provider: "openai", model: "gpt-4" });
  assert.equal(result.provider, "openai");
  assert.equal(result.model, "gpt-4");
  assert.deepStrictEqual(result.fallbackChain, []);
});

test("ModelBindingComponentSchema parses fallback chain", () => {
  const result = ModelBindingComponentSchema.parse({
    provider: "openai",
    model: "gpt-4",
    fallbackChain: ["gpt-3.5", "claude-3"],
  });
  assert.deepStrictEqual(result.fallbackChain, ["gpt-3.5", "claude-3"]);
});

test("TrustProfileComponentSchema applies defaults", () => {
  const result = TrustProfileComponentSchema.parse({});
  assert.equal(result.initialLevel, "suggestion");
  assert.equal(result.scoringConfig.successWeight, 0.4);
  assert.equal(result.scoringConfig.latencyWeight, 0.3);
  assert.equal(result.scoringConfig.errorWeight, 0.3);
});

test("TrustProfileComponentSchema accepts all autonomy levels", () => {
  const levels = ["suggestion", "supervised", "semi_auto", "full_auto"] as const;
  for (const level of levels) {
    const result = TrustProfileComponentSchema.parse({ initialLevel: level });
    assert.equal(result.initialLevel, level);
  }
});

test("TrustProfileComponentSchema rejects invalid initialLevel", () => {
  assert.throws(() => TrustProfileComponentSchema.parse({ initialLevel: "invalid" }));
});

test("TriggerPolicySchema parses with defaults", () => {
  const result = TriggerPolicySchema.parse({ triggerId: "trigger-1" });
  assert.equal(result.triggerId, "trigger-1");
  assert.equal(result.type, "manual");
  assert.equal(result.enabled, true);
});

test("TriggerPolicySchema accepts all trigger types", () => {
  for (const type of ["scheduled", "event", "manual"] as const) {
    const result = TriggerPolicySchema.parse({ triggerId: "t1", type });
    assert.equal(result.type, type);
  }
});

test("AutonomyConfigSchema applies defaults", () => {
  const result = AutonomyConfigSchema.parse({});
  assert.equal(result.maxAutomationLevel, "supervised");
  assert.equal(result.requireHumanApprovalForHighRisk, true);
  assert.equal(result.maxRetriesBeforeApproval, 3);
});

test("AutonomyConfigSchema rejects negative maxRetries", () => {
  assert.throws(() => AutonomyConfigSchema.parse({ maxRetriesBeforeApproval: -1 }));
});

test("OrgNodeRefSchema parses valid org node ref", () => {
  const result = OrgNodeRefSchema.parse({ orgNodeId: "org-1", path: "/org-1/team" });
  assert.equal(result.orgNodeId, "org-1");
  assert.equal(result.path, "/org-1/team");
});

test("OrgNodeRefSchema rejects empty fields", () => {
  assert.throws(() => OrgNodeRefSchema.parse({ orgNodeId: "", path: "/path" }));
  assert.throws(() => OrgNodeRefSchema.parse({ orgNodeId: "id", path: "" }));
});

// ---------------------------------------------------------------------------
// AgentComponentsSchema
// ---------------------------------------------------------------------------

test("AgentComponentsSchema parses complete components", () => {
  const components = {
    pack: { packId: "pack-1", version: "1.0.0" },
    promptBundle: { bundleId: "bundle-1", version: "1.0.0" },
    modelBinding: { provider: "openai", model: "gpt-4", fallbackChain: [] },
    trustProfile: { initialLevel: "supervised" },
    triggerSet: [{ triggerId: "t1", type: "manual", enabled: true }],
    autonomyConfig: { maxAutomationLevel: "semi_auto", requireHumanApprovalForHighRisk: false },
  };
  const result = AgentComponentsSchema.parse(components);
  assert.equal(result.pack.packId, "pack-1");
  assert.equal(result.promptBundle.bundleId, "bundle-1");
  assert.equal(result.modelBinding.model, "gpt-4");
  assert.equal(result.trustProfile.initialLevel, "supervised");
  assert.equal(result.triggerSet.length, 1);
  assert.equal(result.autonomyConfig.maxAutomationLevel, "semi_auto");
});

test("AgentComponentsSchema applies defaults for optional fields", () => {
  const components = {
    pack: { packId: "pack-1", version: "1.0.0" },
    promptBundle: { bundleId: "bundle-1", version: "1.0.0" },
    modelBinding: { provider: "openai", model: "gpt-4" },
    trustProfile: {},
  };
  const result = AgentComponentsSchema.parse(components);
  assert.deepStrictEqual(result.triggerSet, []);
  assert.equal(result.autonomyConfig.maxAutomationLevel, "supervised");
});

// ---------------------------------------------------------------------------
// AgentDefinitionSchema - complete agent
// ---------------------------------------------------------------------------

test("AgentDefinitionSchema parses minimal valid agent", () => {
  const agent = {
    agentId: "agent-1",
    name: "Test Agent",
    domainId: "domain-1",
    owner: { orgNodeId: "org-1", path: "/org-1" },
    components: {
      pack: { packId: "pack-1", version: "1.0.0" },
      promptBundle: { bundleId: "bundle-1", version: "1.0.0" },
      modelBinding: { provider: "openai", model: "gpt-4" },
      trustProfile: {},
    },
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  };
  const result = AgentDefinitionSchema.parse(agent);
  assert.equal(result.agentId, "agent-1");
  assert.equal(result.lifecycleState, "draft"); // default
  assert.equal(result.currentVersionId, ""); // default
});

test("AgentDefinitionSchema parses full agent with all fields", () => {
  const agent = {
    agentId: "agent-full",
    name: "Full Agent",
    domainId: "domain-2",
    owner: { orgNodeId: "org-2", path: "/org-2/team" },
    components: {
      pack: { packId: "pack-2", version: "2.0.0" },
      promptBundle: { bundleId: "bundle-2", version: "2.0.0" },
      modelBinding: { provider: "anthropic", model: "claude-3-opus", fallbackChain: ["claude-3-sonnet"] },
      trustProfile: {
        initialLevel: "full_auto",
        scoringConfig: { successWeight: 0.5, latencyWeight: 0.2, errorWeight: 0.3 },
      },
      triggerSet: [
        { triggerId: "scheduled-trigger", type: "scheduled", enabled: true },
        { triggerId: "event-trigger", type: "event", enabled: false },
      ],
      autonomyConfig: {
        maxAutomationLevel: "full_auto",
        requireHumanApprovalForHighRisk: false,
        maxRetriesBeforeApproval: 5,
      },
    },
    currentVersionId: "ver-123",
    lifecycleState: "active",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-06-01T00:00:00Z",
  };
  const result = AgentDefinitionSchema.parse(agent);
  assert.equal(result.lifecycleState, "active");
  assert.equal(result.currentVersionId, "ver-123");
  assert.equal(result.components.modelBinding.fallbackChain.length, 1);
  assert.equal(result.components.triggerSet.length, 2);
  assert.equal(result.components.autonomyConfig.maxRetriesBeforeApproval, 5);
});

test("AgentDefinitionSchema rejects agent with empty agentId", () => {
  const agent = {
    agentId: "",
    name: "Test",
    domainId: "d1",
    owner: { orgNodeId: "o1", path: "/o1" },
    components: {
      pack: { packId: "p1", version: "1.0.0" },
      promptBundle: { bundleId: "b1", version: "1.0.0" },
      modelBinding: { provider: "p", model: "m" },
      trustProfile: {},
    },
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  };
  assert.throws(() => AgentDefinitionSchema.parse(agent));
});

test("AgentDefinitionSchema rejects invalid lifecycleState", () => {
  const agent = {
    agentId: "a1",
    name: "Test",
    domainId: "d1",
    owner: { orgNodeId: "o1", path: "/o1" },
    components: {
      pack: { packId: "p1", version: "1.0.0" },
      promptBundle: { bundleId: "b1", version: "1.0.0" },
      modelBinding: { provider: "p", model: "m" },
      trustProfile: {},
    },
    lifecycleState: "invalid-state",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  };
  assert.throws(() => AgentDefinitionSchema.parse(agent));
});

test("AgentDefinitionSchema rejects missing required fields", () => {
  assert.throws(() => AgentDefinitionSchema.parse({ agentId: "a1" }));
  assert.throws(() => AgentDefinitionSchema.parse({ name: "Test" }));
  assert.throws(() => AgentDefinitionSchema.parse({}));
});

// ---------------------------------------------------------------------------
// Scoring config weight validation
// ---------------------------------------------------------------------------

test("TrustProfileComponentSchema scoringConfig weights must be 0-1", () => {
  // Valid weights
  assert.doesNotThrow(() =>
    TrustProfileComponentSchema.parse({
      scoringConfig: { successWeight: 0, latencyWeight: 0, errorWeight: 1 },
    }),
  );
  assert.doesNotThrow(() =>
    TrustProfileComponentSchema.parse({
      scoringConfig: { successWeight: 0.33, latencyWeight: 0.33, errorWeight: 0.34 },
    }),
  );

  // Invalid weights
  assert.throws(() =>
    TrustProfileComponentSchema.parse({
      scoringConfig: { successWeight: 1.5, latencyWeight: 0, errorWeight: 0 },
    }),
  );
  assert.throws(() =>
    TrustProfileComponentSchema.parse({
      scoringConfig: { successWeight: -0.1, latencyWeight: 0.5, errorWeight: 0.6 },
    }),
  );
});