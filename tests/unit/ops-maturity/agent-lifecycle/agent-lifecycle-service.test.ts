import assert from "node:assert/strict";
import test from "node:test";

import { AgentLifecycleService } from "../../../../src/ops-maturity/agent-lifecycle/agent-lifecycle-service.js";
import type { AgentDefinition, AgentLifecycleState } from "../../../../src/ops-maturity/agent-lifecycle/agent-registry/index.js";
import type { CanaryProgress, TrafficSplitConfig } from "../../../../src/ops-maturity/agent-lifecycle/canary-controller/index.js";
import type { AgentRetirementPlan } from "../../../../src/ops-maturity/agent-lifecycle/retirement/index.js";
import type { AgentVersion } from "../../../../src/ops-maturity/agent-lifecycle/version-manager/index.js";

function makeAgent(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    agentId: "test-agent-" + Math.random().toString(36).slice(2),
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
    currentVersionId: "v1.0.0",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeVersion(overrides: Partial<AgentVersion> = {}): AgentVersion {
  return {
    versionId: "v1.0.0",
    agentId: "test-agent",
    semver: "1.0.0",
    componentSnapshot: {
      packVersion: "1.0.0",
      promptBundleVersion: "1.0.0",
      modelBindingHash: "hash1",
      trustProfileHash: "hash2",
      triggerSetHash: "hash3",
      autonomyConfigHash: "hash4",
    },
    createdAt: new Date().toISOString(),
    createdBy: "tester",
    releaseNote: "Initial version",
    ...overrides,
  };
}

test("AgentLifecycleService.registerAgent stores and returns the agent", () => {
  const service = new AgentLifecycleService();
  const agent = makeAgent({ agentId: "agent-1", lifecycleState: "staging" });

  const result = service.registerAgent(agent);

  assert.equal(result.agentId, "agent-1");
  assert.equal(service.getAgent("agent-1")?.agentId, "agent-1");
});

test("AgentLifecycleService.registerAgent rejects invalid agent definition shapes", () => {
  const service = new AgentLifecycleService();
  const invalidAgent = {
    agentId: "agent-invalid",
    name: "Broken Agent",
    // missing domainId/owner/components/currentVersionId timestamps etc.
    lifecycleState: "active",
  } as unknown as AgentDefinition;

  assert.throws(
    () => service.registerAgent(invalidAgent),
  );
});

test("AgentLifecycleService.addVersion stores version for registered agent", () => {
  const service = new AgentLifecycleService();
  const agent = makeAgent({ agentId: "agent-1" });
  service.registerAgent(agent);

  const version = makeVersion({ agentId: "agent-1", versionId: "v1.0.0", semver: "1.0.0" });
  const result = service.addVersion(version);

  assert.equal(result.agentId, "agent-1");
  assert.equal(result.versionId, "v1.0.0");
});

test("AgentLifecycleService.addVersion throws for unregistered agent", () => {
  const service = new AgentLifecycleService();
  const version = makeVersion({ agentId: "unregistered-agent", versionId: "v1.0.0", semver: "1.0.0" });

  assert.throws(
    () => service.addVersion(version),
    (err: unknown) => err instanceof Error && err.message.includes("agent_not_found")
  );
});

test("AgentLifecycleService.getAgent returns null for non-existent agent", () => {
  const service = new AgentLifecycleService();
  const result = service.getAgent("non-existent");
  assert.equal(result, null);
});

test("AgentLifecycleService.getLatestVersion returns null when no versions", () => {
  const service = new AgentLifecycleService();
  const agent = makeAgent({ agentId: "agent-1" });
  service.registerAgent(agent);

  const result = service.getLatestVersion("agent-1");
  assert.equal(result, null);
});

test("AgentLifecycleService.getLatestVersion returns most recently created version", () => {
  const service = new AgentLifecycleService();
  const agent = makeAgent({ agentId: "agent-1", currentVersionId: "v2.0.0" });
  service.registerAgent(agent);

  // Note: resolveLatestAgentVersion sorts by createdAt descending, not semver
  const v1CreatedAt = new Date(Date.now() - 10000).toISOString();
  const v2CreatedAt = new Date(Date.now()).toISOString();

  service.addVersion(makeVersion({ agentId: "agent-1", versionId: "v1.0.0", semver: "1.0.0", createdAt: v1CreatedAt }));
  service.addVersion(makeVersion({ agentId: "agent-1", versionId: "v2.0.0", semver: "2.0.0", createdAt: v2CreatedAt }));

  const result = service.getLatestVersion("agent-1");
  assert.equal(result?.versionId, "v2.0.0");
});

test("AgentLifecycleService.getAllVersions returns all versions for agent", () => {
  const service = new AgentLifecycleService();
  const agent = makeAgent({ agentId: "agent-1" });
  service.registerAgent(agent);

  service.addVersion(makeVersion({ agentId: "agent-1", versionId: "v1.0.0", semver: "1.0.0" }));
  service.addVersion(makeVersion({ agentId: "agent-1", versionId: "v1.1.0", semver: "1.1.0" }));

  const result = service.getAllVersions("agent-1");
  assert.equal(result.length, 2);
});

test("AgentLifecycleService.getAllVersions returns empty array for non-existent agent", () => {
  const service = new AgentLifecycleService();
  const result = service.getAllVersions("non-existent");
  assert.deepEqual(result, []);
});

test("AgentLifecycleService.listActive returns empty when no agents", () => {
  const service = new AgentLifecycleService();
  const result = service.listActive();
  assert.deepEqual(result, []);
});

test("AgentLifecycleService.listActive returns only active agents", () => {
  const service = new AgentLifecycleService();
  service.registerAgent(makeAgent({ agentId: "agent-staging", lifecycleState: "staging" }));
  service.registerAgent(makeAgent({ agentId: "agent-active", lifecycleState: "active" }));
  service.registerAgent(makeAgent({ agentId: "agent-canary", lifecycleState: "canary" }));

  const result = service.listActive();

  // Only active and canary should be in the active list (not staging)
  assert.ok(result.some(a => a.agentId === "agent-active"));
  assert.ok(result.some(a => a.agentId === "agent-canary"));
});

test("AgentLifecycleService.getCanaryProgress returns null when no progress", () => {
  const service = new AgentLifecycleService();
  const agent = makeAgent({ agentId: "agent-1" });
  service.registerAgent(agent);

  const result = service.getCanaryProgress("agent-1");
  assert.equal(result, null);
});

test("AgentLifecycleService.bindTask creates binding for active agent", () => {
  const service = new AgentLifecycleService();
  const agent = makeAgent({ agentId: "agent-1", lifecycleState: "active", currentVersionId: "v1.0.0" });
  service.registerAgent(agent);
  service.addVersion(makeVersion({ agentId: "agent-1", versionId: "v1.0.0", semver: "1.0.0" }));

  const result = service.bindTask("agent-1", "task-123");

  assert.equal(result.agentId, "agent-1");
  assert.equal(result.taskId, "task-123");
  assert.equal(result.versionId, "v1.0.0");
  assert.ok(result.bindingId.length > 0);
});

test("AgentLifecycleService.bindTask throws for deprecated agent", () => {
  const service = new AgentLifecycleService();
  const agent = makeAgent({ agentId: "agent-1", lifecycleState: "deprecated" });
  service.registerAgent(agent);

  assert.throws(
    () => service.bindTask("agent-1", "task-123"),
    (err: unknown) => err instanceof Error && err.message.includes("binding_forbidden_retired")
  );
});

test("AgentLifecycleService.bindTask throws for archived agent", () => {
  const service = new AgentLifecycleService();
  const agent = makeAgent({ agentId: "agent-1", lifecycleState: "archived" });
  service.registerAgent(agent);

  assert.throws(
    () => service.bindTask("agent-1", "task-123"),
    (err: unknown) => err instanceof Error && err.message.includes("binding_forbidden_archived")
  );
});

test("AgentLifecycleService.archive throws for non-deprecated agent", () => {
  const service = new AgentLifecycleService();
  const agent = makeAgent({ agentId: "agent-1", lifecycleState: "active" });
  service.registerAgent(agent);

  assert.throws(
    () => service.archive("agent-1"),
    (err: unknown) => err instanceof Error && err.message.includes("can_only_archive_from_deprecated")
  );
});

test("AgentLifecycleService.archive transitions deprecated to archived", () => {
  const service = new AgentLifecycleService();
  const agent = makeAgent({ agentId: "agent-1", lifecycleState: "deprecated" });
  service.registerAgent(agent);

  const result = service.archive("agent-1");

  assert.equal(result.agentId, "agent-1");
  assert.equal(result.fromState, "deprecated");
  assert.equal(result.toState, "archived");
  assert.ok(result.reasonCodes.includes("agent_lifecycle.archived"));
});

test("AgentLifecycleService.getCanaryTrafficSplit returns null when no progress", () => {
  const service = new AgentLifecycleService();
  const agent = makeAgent({ agentId: "agent-1", lifecycleState: "canary" });
  service.registerAgent(agent);

  const result = service.getCanaryTrafficSplit("agent-1");
  assert.equal(result, null);
});
