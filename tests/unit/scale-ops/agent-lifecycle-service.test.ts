import assert from "node:assert/strict";
import test from "node:test";

import {
  AgentLifecycleService,
  type ManagedAgentDefinition,
  type ManagedAgentVersion,
  type CanaryProgress,
} from "../../../src/ops-maturity/agent-lifecycle/agent-lifecycle-service.js";

function makeTestAgent(overrides: Partial<ManagedAgentDefinition> = {}): ManagedAgentDefinition {
  return {
    agentId: "test-agent",
    agentType: "coding",
    lifecycleState: "staging",
    currentVersionId: "v1.0.0",
    registeredAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeTestVersion(overrides: Partial<ManagedAgentVersion> = {}): ManagedAgentVersion {
  return {
    agentId: "test-agent",
    versionId: "v1.0.0",
    semver: "1.0.0",
    changelog: "initial",
    registeredAt: new Date().toISOString(),
    ...overrides,
  };
}

test("AgentLifecycleService registerAgent stores and returns agent", async () => {
  const service = new AgentLifecycleService();
  const agent = makeTestAgent();

  const result = service.registerAgent(agent);

  assert.equal(result.agentId, "test-agent");
  assert.equal(service.getAgent("test-agent")?.agentId, "test-agent");
});

test("AgentLifecycleService addVersion appends version to agent", async () => {
  const service = new AgentLifecycleService();
  service.registerAgent(makeTestAgent());
  const version = makeTestVersion();

  service.addVersion(version);
  const versions = service.getAllVersions("test-agent");

  assert.equal(versions.length, 1);
  assert.equal(versions[0].versionId, "v1.0.0");
});

test("AgentLifecycleService addVersion throws if agent not found", async () => {
  const service = new AgentLifecycleService();
  const version = makeTestVersion({ agentId: "unknown" });

  assert.throws(
    () => service.addVersion(version),
    (err: Error) => err.message.includes("agent_not_found")
  );
});

test("AgentLifecycleService transition validates state machine", async () => {
  const service = new AgentLifecycleService();
  service.registerAgent(makeTestAgent({ lifecycleState: "staging" }));

  const result = service.transition("test-agent", "active");

  assert.equal(result.allowed, true);
  assert.equal(result.fromState, "staging");
  assert.equal(result.toState, "active");
});

test("AgentLifecycleService transition rejects invalid transitions", async () => {
  const service = new AgentLifecycleService();
  service.registerAgent(makeTestAgent({ lifecycleState: "archived" }));

  const result = service.transition("test-agent", "active");

  assert.equal(result.allowed, false);
});

test("AgentLifecycleService advanceCanary promotes when ready", async () => {
  const service = new AgentLifecycleService();
  service.registerAgent(makeTestAgent({ lifecycleState: "canary" }));
  service.addVersion(makeTestVersion());
  const progress: CanaryProgress = {
    rolloutPercent: 100,
    currentStage: "full",
    startedAt: new Date().toISOString(),
    promoteAfterAt: new Date().toISOString(),
  };

  const receipt = service.advanceCanary("test-agent", progress);

  assert.equal(receipt.toState, "active");
});

test("AgentLifecycleService getCanaryTrafficSplit returns split config", async () => {
  const service = new AgentLifecycleService();
  service.registerAgent(makeTestAgent({ lifecycleState: "canary" }));
  service.addVersion(makeTestVersion());
  const progress: CanaryProgress = {
    rolloutPercent: 10,
    currentStage: "initial",
    startedAt: new Date().toISOString(),
    promoteAfterAt: new Date(Date.now() + 86400000).toISOString(),
  };

  service.advanceCanary("test-agent", progress);
  const split = service.getCanaryTrafficSplit("test-agent");

  assert.ok(split != null);
  assert.ok(split.weight > 0);
});

test("AgentLifecycleService rollback switches to previous version", async () => {
  const service = new AgentLifecycleService();
  service.registerAgent(makeTestAgent({ lifecycleState: "active", currentVersionId: "v2.0.0" }));
  service.addVersion({ agentId: "test-agent", versionId: "v2.0.0", semver: "2.0.0", changelog: "new", registeredAt: new Date().toISOString() });
  service.addVersion({ agentId: "test-agent", versionId: "v1.0.0", semver: "1.0.0", changelog: "old", registeredAt: new Date().toISOString() });

  const receipt = service.rollback("test-agent");

  assert.equal(receipt.fromVersionId, "v2.0.0");
  assert.equal(receipt.toVersionId, "v1.0.0");
  assert.ok(service.getAgent("test-agent")?.lifecycleState, "staging");
});

test("AgentLifecycleService retire moves agent to deprecated", async () => {
  const service = new AgentLifecycleService();
  service.registerAgent(makeTestAgent({ lifecycleState: "active" }));
  service.addVersion(makeTestVersion());

  const receipt = service.retire({
    agentId: "test-agent",
    drainDeadline: new Date(Date.now() - 1000).toISOString(),
    gracefulDeadlineSeconds: 300,
    targetState: "deprecated",
    reasonCodes: ["superseded"],
    decidedAt: new Date().toISOString(),
  });

  assert.equal(receipt.toState, "deprecated");
});

test("AgentLifecycleService archive requires deprecated state", async () => {
  const service = new AgentLifecycleService();
  service.registerAgent(makeTestAgent({ lifecycleState: "active" }));

  assert.throws(
    () => service.archive("test-agent"),
    (err: Error) => err.message.includes("can_only_archive_from_deprecated")
  );
});

test("AgentLifecycleService bindTask creates binding", async () => {
  const service = new AgentLifecycleService();
  service.registerAgent(makeTestAgent({ lifecycleState: "active" }));
  service.addVersion(makeTestVersion());

  const binding = service.bindTask("test-agent", "task-001");

  assert.equal(binding.agentId, "test-agent");
  assert.equal(binding.taskId, "task-001");
  assert.ok(binding.bindingId.startsWith("agent_binding_"));
});

test("AgentLifecycleService bindTask rejects deprecated agent", async () => {
  const service = new AgentLifecycleService();
  service.registerAgent(makeTestAgent({ lifecycleState: "deprecated" }));
  service.addVersion(makeTestVersion());

  assert.throws(
    () => service.bindTask("test-agent", "task-001"),
    (err: Error) => err.message.includes("binding_forbidden_retired")
  );
});

test("AgentLifecycleService listActive returns only active agents", async () => {
  const service = new AgentLifecycleService();
  service.registerAgent(makeTestAgent({ agentId: "active-agent", lifecycleState: "active" }));
  service.registerAgent(makeTestAgent({ agentId: "staging-agent", lifecycleState: "staging" }));

  const active = service.listActive();

  assert.ok(active.some((a) => a.agentId === "active-agent"));
});

test("AgentLifecycleService getLatestVersion returns newest version", async () => {
  const service = new AgentLifecycleService();
  service.registerAgent(makeTestAgent());
  service.addVersion(makeTestVersion({ versionId: "v1.0.0", semver: "1.0.0" }));
  service.addVersion(makeTestVersion({ versionId: "v2.0.0", semver: "2.0.0" }));

  const latest = service.getLatestVersion("test-agent");

  assert.ok(latest != null);
  assert.equal(latest.versionId, "v2.0.0");
});
