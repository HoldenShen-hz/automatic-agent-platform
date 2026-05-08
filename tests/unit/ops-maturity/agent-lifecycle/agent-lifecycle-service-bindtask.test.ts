import assert from "node:assert/strict";
import test from "node:test";

import { AgentLifecycleService } from "../../../../src/ops-maturity/agent-lifecycle/agent-lifecycle-service.js";
import type { AgentDefinition, AgentLifecycleState } from "../../../../src/ops-maturity/agent-lifecycle/agent-registry/index.js";
import type { AgentVersion } from "../../../../src/ops-maturity/agent-lifecycle/version-manager/index.js";

function createMinimalAgent(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
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
    lifecycleState: "staging",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createAgentVersion(overrides: Partial<AgentVersion> = {}): AgentVersion {
  return {
    versionId: "v1.0.0",
    agentId: "test-agent",
    semver: "1.0.0",
    createdAt: new Date().toISOString(),
    createdBy: "tester",
    releaseNote: "",
    componentSnapshot: {
      packVersion: "1.0.0",
      promptBundleVersion: "1.0.0",
      modelBindingHash: "hash1",
      trustProfileHash: "hash2",
      triggerSetHash: "hash3",
      autonomyConfigHash: "hash4",
    },
    ...overrides,
  };
}

test("AgentLifecycleService.bindTask: throws for non-existent agent", () => {
  const service = new AgentLifecycleService();

  assert.throws(
    () => service.bindTask("non-existent-agent", "task-123"),
    (err: unknown) => err instanceof Error && err.message.includes("agent_not_found")
  );
});

test("AgentLifecycleService.bindTask: throws for deprecated agent", () => {
  const service = new AgentLifecycleService();
  const agent = createMinimalAgent({ agentId: "agent-1", lifecycleState: "deprecated" });
  service.registerAgent(agent);

  assert.throws(
    () => service.bindTask("agent-1", "task-123"),
    (err: unknown) => err instanceof Error && err.message.includes("binding_forbidden_retired")
  );
});

test("AgentLifecycleService.bindTask: throws for archived agent", () => {
  const service = new AgentLifecycleService();
  const agent = createMinimalAgent({ agentId: "agent-1", lifecycleState: "archived" });
  service.registerAgent(agent);

  assert.throws(
    () => service.bindTask("agent-1", "task-123"),
    (err: unknown) => err instanceof Error && err.message.includes("binding_forbidden_archived")
  );
});

test("AgentLifecycleService.bindTask: succeeds for active agent with version", () => {
  const service = new AgentLifecycleService();
  const agent = createMinimalAgent({
    agentId: "agent-1",
    lifecycleState: "active",
    currentVersionId: "v1.0.0",
  });
  service.registerAgent(agent);
  service.addVersion(createAgentVersion({ agentId: "agent-1", versionId: "v1.0.0", semver: "1.0.0" }));

  const result = service.bindTask("agent-1", "task-123");

  assert.equal(result.agentId, "agent-1");
  assert.equal(result.taskId, "task-123");
  assert.equal(result.versionId, "v1.0.0");
  assert.ok(result.bindingId.startsWith("agent_binding_"));
  assert.ok(result.boundAt.length > 0);
});

test("AgentLifecycleService.bindTask: succeeds for canary agent with version", () => {
  const service = new AgentLifecycleService();
  const agent = createMinimalAgent({
    agentId: "agent-1",
    lifecycleState: "canary",
    currentVersionId: "v1.0.0",
  });
  service.registerAgent(agent);
  service.addVersion(createAgentVersion({ agentId: "agent-1", versionId: "v1.0.0", semver: "1.0.0" }));

  const result = service.bindTask("agent-1", "task-456");

  assert.equal(result.agentId, "agent-1");
  assert.equal(result.taskId, "task-456");
  assert.equal(result.versionId, "v1.0.0");
});

test("AgentLifecycleService.bindTask: succeeds for draft agent with version", () => {
  const service = new AgentLifecycleService();
  const agent = createMinimalAgent({
    agentId: "agent-1",
    lifecycleState: "draft",
    currentVersionId: "v1.0.0",
  });
  service.registerAgent(agent);
  service.addVersion(createAgentVersion({ agentId: "agent-1", versionId: "v1.0.0", semver: "1.0.0" }));

  // bindTask does not check for non-production states; only deprecated/archived and no version
  const result = service.bindTask("agent-1", "task-789");
  assert.equal(result.agentId, "agent-1");
  assert.equal(result.taskId, "task-789");
});

test("AgentLifecycleService.bindTask: succeeds for testing agent with version", () => {
  const service = new AgentLifecycleService();
  const agent = createMinimalAgent({
    agentId: "agent-1",
    lifecycleState: "testing",
    currentVersionId: "v1.0.0",
  });
  service.registerAgent(agent);
  service.addVersion(createAgentVersion({ agentId: "agent-1", versionId: "v1.0.0", semver: "1.0.0" }));

  const result = service.bindTask("agent-1", "task-testing");
  assert.equal(result.agentId, "agent-1");
  assert.equal(result.taskId, "task-testing");
});

test("AgentLifecycleService.bindTask: succeeds for staging agent with version", () => {
  const service = new AgentLifecycleService();
  const agent = createMinimalAgent({
    agentId: "agent-1",
    lifecycleState: "staging",
    currentVersionId: "v1.0.0",
  });
  service.registerAgent(agent);
  service.addVersion(createAgentVersion({ agentId: "agent-1", versionId: "v1.0.0", semver: "1.0.0" }));

  const result = service.bindTask("agent-1", "task-staging");
  assert.equal(result.agentId, "agent-1");
  assert.equal(result.taskId, "task-staging");
});

test("AgentLifecycleService.bindTask: succeeds for paused agent with version", () => {
  const service = new AgentLifecycleService();
  const agent = createMinimalAgent({
    agentId: "agent-1",
    lifecycleState: "paused",
    currentVersionId: "v1.0.0",
  });
  service.registerAgent(agent);
  service.addVersion(createAgentVersion({ agentId: "agent-1", versionId: "v1.0.0", semver: "1.0.0" }));

  const result = service.bindTask("agent-1", "task-paused");

  assert.equal(result.agentId, "agent-1");
  assert.equal(result.taskId, "task-paused");
});

test("AgentLifecycleService.bindTask: throws for agent without versions", () => {
  const service = new AgentLifecycleService();
  const agent = createMinimalAgent({
    agentId: "agent-1",
    lifecycleState: "active",
    currentVersionId: "",
  });
  service.registerAgent(agent);
  // No versions added

  assert.throws(
    () => service.bindTask("agent-1", "task-123"),
    (err: unknown) => err instanceof Error && err.message.includes("version_not_found")
  );
});

test("AgentLifecycleService.bindTask: uses latest version when currentVersionId is empty", () => {
  const service = new AgentLifecycleService();
  const agent = createMinimalAgent({
    agentId: "agent-1",
    lifecycleState: "active",
    currentVersionId: "",
  });
  service.registerAgent(agent);
  // Add multiple versions
  service.addVersion(createAgentVersion({ agentId: "agent-1", versionId: "v1.0.0", semver: "1.0.0", createdAt: new Date(Date.now() - 10000).toISOString() }));
  service.addVersion(createAgentVersion({ agentId: "agent-1", versionId: "v2.0.0", semver: "2.0.0", createdAt: new Date(Date.now()).toISOString() }));

  const result = service.bindTask("agent-1", "task-123");

  // Should use latest version by createdAt (v2.0.0)
  assert.equal(result.versionId, "v2.0.0");
});

test("AgentLifecycleService.bindTask: uses currentVersionId when set", () => {
  const service = new AgentLifecycleService();
  const agent = createMinimalAgent({
    agentId: "agent-1",
    lifecycleState: "active",
    currentVersionId: "v1.0.0",
  });
  service.registerAgent(agent);
  service.addVersion(createAgentVersion({ agentId: "agent-1", versionId: "v1.0.0", semver: "1.0.0" }));
  service.addVersion(createAgentVersion({ agentId: "agent-1", versionId: "v2.0.0", semver: "2.0.0" }));

  const result = service.bindTask("agent-1", "task-123");

  // Should use currentVersionId (v1.0.0), not latest (v2.0.0)
  assert.equal(result.versionId, "v1.0.0");
});

test("AgentLifecycleService.bindTask: custom boundAt timestamp", () => {
  const service = new AgentLifecycleService();
  const agent = createMinimalAgent({
    agentId: "agent-1",
    lifecycleState: "active",
    currentVersionId: "v1.0.0",
  });
  service.registerAgent(agent);
  service.addVersion(createAgentVersion({ agentId: "agent-1", versionId: "v1.0.0", semver: "1.0.0" }));

  const customTime = "2026-01-15T10:30:00.000Z";
  const result = service.bindTask("agent-1", "task-123", customTime);

  assert.equal(result.boundAt, customTime);
});

test("AgentLifecycleService.bindTask: generates unique binding IDs", () => {
  const service = new AgentLifecycleService();
  const agent = createMinimalAgent({
    agentId: "agent-1",
    lifecycleState: "active",
    currentVersionId: "v1.0.0",
  });
  service.registerAgent(agent);
  service.addVersion(createAgentVersion({ agentId: "agent-1", versionId: "v1.0.0", semver: "1.0.0" }));

  const binding1 = service.bindTask("agent-1", "task-1");
  const binding2 = service.bindTask("agent-1", "task-2");
  const binding3 = service.bindTask("agent-1", "task-3");

  assert.notEqual(binding1.bindingId, binding2.bindingId);
  assert.notEqual(binding2.bindingId, binding3.bindingId);
  assert.notEqual(binding1.bindingId, binding3.bindingId);
});

test("AgentLifecycleService.bindTask: does NOT throw for removed agent - binding forbidden before removed state", () => {
  // Note: removed is a terminal state. An agent in "removed" state cannot have tasks bound.
  // But since "removed" is terminal, an agent would need to go through deprecated -> archived -> removed
  // The binding should fail at deprecated or archived, not at removed (since you can't reach removed without going through those)
  const service = new AgentLifecycleService();
  const agent = createMinimalAgent({
    agentId: "agent-1",
    lifecycleState: "archived", // archived is before removed
    currentVersionId: "v1.0.0",
  });
  service.registerAgent(agent);
  service.addVersion(createAgentVersion({ agentId: "agent-1", versionId: "v1.0.0", semver: "1.0.0" }));

  assert.throws(
    () => service.bindTask("agent-1", "task-123"),
    (err: unknown) => err instanceof Error && err.message.includes("binding_forbidden_archived")
  );
});

test("AgentLifecycleService.bindTask: all lifecycle states that allow binding", () => {
  const service = new AgentLifecycleService();
  const bindingAllowedStates: AgentLifecycleState[] = [
    "draft",
    "testing",
    "staging",
    "canary",
    "active",
    "paused",
  ];

  for (const state of bindingAllowedStates) {
    const agentId = `agent-${state}`;
    const agent = createMinimalAgent({
      agentId,
      lifecycleState: state,
      currentVersionId: "v1.0.0",
    });
    service.registerAgent(agent);
    service.addVersion(createAgentVersion({ agentId, versionId: "v1.0.0", semver: "1.0.0" }));

    const result = service.bindTask(agentId, `task-${state}`);
    assert.equal(result.agentId, agentId, `Binding should succeed for state: ${state}`);
  }
});

test("AgentLifecycleService.bindTask: all lifecycle states that forbid binding", () => {
  const bindingForbiddenStates: AgentLifecycleState[] = [
    "deprecated",
    "archived",
  ];

  for (const state of bindingForbiddenStates) {
    const service = new AgentLifecycleService();
    const agentId = `agent-${state}`;
    const agent = createMinimalAgent({
      agentId,
      lifecycleState: state,
      currentVersionId: "v1.0.0",
    });
    service.registerAgent(agent);
    service.addVersion(createAgentVersion({ agentId, versionId: "v1.0.0", semver: "1.0.0" }));

    assert.throws(
      () => service.bindTask(agentId, `task-${state}`),
      (err: unknown) => {
        const hasError = err instanceof Error;
        const hasCorrectMessage =
          (state === "deprecated" && err instanceof Error && err.message.includes("binding_forbidden_retired")) ||
          (state === "archived" && err instanceof Error && err.message.includes("binding_forbidden_archived"));
        return hasError && hasCorrectMessage;
      },
      `Binding should throw for state: ${state}`
    );
  }
});
