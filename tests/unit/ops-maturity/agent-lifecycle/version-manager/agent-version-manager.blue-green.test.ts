/**
 * Unit tests for Blue-Green dual-slot behavior in AgentVersionManager
 *
 * @see src/ops-maturity/agent-lifecycle/version-manager/agent-version-manager.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  AgentVersionManager,
  type AgentVersionDetail,
} from "../../../../../src/ops-maturity/agent-lifecycle/version-manager/agent-version-manager.js";

function makeVersion(overrides: Partial<Omit<AgentVersionDetail, "versionId" | "createdAt">> = {}): Omit<AgentVersionDetail, "versionId" | "createdAt"> {
  return {
    agentId: "agent_bg",
    version: "1.0.0",
    stage: "stable",
    deprecatedAt: null,
    stable: false,
    deploymentSlot: null,
    changelog: "",
    metrics: { totalExecutions: 0, successRate: 0, avgDurationMs: 0 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Zero-downtime: both slots can be active simultaneously during transition
// ---------------------------------------------------------------------------

test("assignDeploymentSlot does NOT evict existing version in target slot - dual slots allowed", () => {
  const manager = new AgentVersionManager();
  const v1 = manager.registerVersion(makeVersion({ version: "1.0.0" }));
  const v2 = manager.registerVersion(makeVersion({ version: "2.0.0" }));

  // Assign v1 to blue
  manager.assignDeploymentSlot("agent_bg", v1.versionId, "blue");
  // Assign v2 to green - v1 should NOT be evicted from blue
  manager.assignDeploymentSlot("agent_bg", v2.versionId, "green");

  // Both slots should be active
  const blue = manager.getActiveSlot("agent_bg", "blue");
  const green = manager.getActiveSlot("agent_bg", "green");
  assert.equal(blue?.versionId, v1.versionId);
  assert.equal(green?.versionId, v2.versionId);
});

test("assignDeploymentSlot is idempotent when version already in slot", () => {
  const manager = new AgentVersionManager();
  const v1 = manager.registerVersion(makeVersion({ version: "1.0.0" }));

  manager.assignDeploymentSlot("agent_bg", v1.versionId, "blue");
  manager.assignDeploymentSlot("agent_bg", v1.versionId, "blue"); // second call - no-op

  const blue = manager.getActiveSlot("agent_bg", "blue");
  assert.equal(blue?.versionId, v1.versionId);
});

// ---------------------------------------------------------------------------
// revokeSlot - explicit slot release for completing blue-green transition
// ---------------------------------------------------------------------------

test("revokeSlot removes version from its slot", () => {
  const manager = new AgentVersionManager();
  const v1 = manager.registerVersion(makeVersion({ version: "1.0.0" }));
  manager.assignDeploymentSlot("agent_bg", v1.versionId, "blue");

  manager.revokeSlot("agent_bg", v1.versionId);

  const blue = manager.getActiveSlot("agent_bg", "blue");
  assert.equal(blue, null);
});

test("revokeSlot only affects the specific version's slot", () => {
  const manager = new AgentVersionManager();
  const v1 = manager.registerVersion(makeVersion({ version: "1.0.0" }));
  const v2 = manager.registerVersion(makeVersion({ version: "2.0.0" }));

  manager.assignDeploymentSlot("agent_bg", v1.versionId, "blue");
  manager.assignDeploymentSlot("agent_bg", v2.versionId, "green");

  // Revoke only v1 from blue - green should remain
  manager.revokeSlot("agent_bg", v1.versionId);

  const blue = manager.getActiveSlot("agent_bg", "blue");
  const green = manager.getActiveSlot("agent_bg", "green");
  assert.equal(blue, null);
  assert.equal(green?.versionId, v2.versionId);
});

test("revokeSlot handles unknown agent gracefully (no throw)", () => {
  assert.doesNotThrow(() => {
    const manager = new AgentVersionManager();
    manager.revokeSlot("nonexistent", "any_version_id");
  });
});

test("revokeSlot handles unknown version gracefully (no throw)", () => {
  assert.doesNotThrow(() => {
    const manager = new AgentVersionManager();
    const v1 = manager.registerVersion(makeVersion({ version: "1.0.0" }));
    manager.assignDeploymentSlot("agent_bg", v1.versionId, "blue");

    manager.revokeSlot("agent_bg", "unknown_version_id");
  });
});

test("revokeSlot on unslotted version is no-op", () => {
  const manager = new AgentVersionManager();
  const v1 = manager.registerVersion(makeVersion({ version: "1.0.0" })); // no slot assigned

  manager.revokeSlot("agent_bg", v1.versionId); // no throw

  const versions = manager.listVersions("agent_bg");
  assert.equal(versions[0]?.deploymentSlot, null);
});

// ---------------------------------------------------------------------------
// blueGreenSwitch - promotes latest eligible version to target slot
// ---------------------------------------------------------------------------

test("blueGreenSwitch assigns eligible version to target slot", () => {
  const manager = new AgentVersionManager();
  const v1 = manager.registerVersion(makeVersion({ version: "1.0.0", deploymentSlot: "blue" }));
  const v2 = manager.registerVersion(makeVersion({ version: "2.0.0", stage: "canary" }));

  const result = manager.blueGreenSwitch("agent_bg", "green");

  assert.equal(result?.versionId, v2.versionId);
  assert.equal(result?.deploymentSlot, "green");
});

test("blueGreenSwitch preserves existing slot during transition", () => {
  const manager = new AgentVersionManager();
  const v1 = manager.registerVersion(makeVersion({ version: "1.0.0", deploymentSlot: "blue" }));
  const v2 = manager.registerVersion(makeVersion({ version: "2.0.0", stage: "canary" }));

  manager.blueGreenSwitch("agent_bg", "green");

  // Blue should still have v1 - both slots active during transition
  const blue = manager.getActiveSlot("agent_bg", "blue");
  const green = manager.getActiveSlot("agent_bg", "green");
  assert.equal(blue?.versionId, v1.versionId);
  assert.equal(green?.versionId, v2.versionId);
});

test("blueGreenSwitch returns current version when no eligible unslotted version", () => {
  const manager = new AgentVersionManager();
  const v1 = manager.registerVersion(makeVersion({ version: "1.0.0", deploymentSlot: "blue", stage: "alpha" }));

  const result = manager.blueGreenSwitch("agent_bg", "green");

  // Falls back to currentVersion since no eligible candidate exists
  // v1 is in blue (opposite slot) but is alpha, so no candidate from either slot
  assert.equal(result?.versionId, v1.versionId);
  assert.equal(result?.deploymentSlot, "blue");
});

// ---------------------------------------------------------------------------
// Full blue-green zero-downtime workflow
// ---------------------------------------------------------------------------

test("Zero-downtime blue-green: both slots active during transition, then old revoked", () => {
  const manager = new AgentVersionManager();

  // Register stable v1 and assign to blue
  const v1 = manager.registerVersion(makeVersion({ version: "1.0.0", stable: true }));
  manager.assignDeploymentSlot("agent_bg", v1.versionId, "blue");

  // Register new canary v2 for green slot - both slots active
  const v2 = manager.registerVersion(makeVersion({ version: "2.0.0", stage: "canary" }));
  manager.blueGreenSwitch("agent_bg", "green");

  // Verify both slots are active
  const blue = manager.getActiveSlot("agent_bg", "blue");
  const green = manager.getActiveSlot("agent_bg", "green");
  assert.equal(blue?.versionId, v1.versionId);
  assert.equal(green?.versionId, v2.versionId);

  // Complete transition: revoke old v1 from blue
  manager.revokeSlot("agent_bg", v1.versionId);

  const blueAfterRevoke = manager.getActiveSlot("agent_bg", "blue");
  assert.equal(blueAfterRevoke, null); // blue now empty
  assert.equal(green?.versionId, v2.versionId); // green still active
});

test("Zero-downtime: switch back to blue migrates the promoted version off green", () => {
  const manager = new AgentVersionManager();

  const v1 = manager.registerVersion(makeVersion({ version: "1.0.0" }));
  manager.assignDeploymentSlot("agent_bg", v1.versionId, "blue");

  const v2 = manager.registerVersion(makeVersion({ version: "2.0.0", stage: "canary" }));
  manager.blueGreenSwitch("agent_bg", "green");

  // Now switch back: promote v2 to blue; moving the same version clears its prior green slot.
  manager.blueGreenSwitch("agent_bg", "blue");
  manager.revokeSlot("agent_bg", v1.versionId); // revoke v1 from blue

  const blue = manager.getActiveSlot("agent_bg", "blue");
  const green = manager.getActiveSlot("agent_bg", "green");
  assert.equal(blue?.versionId, v2.versionId);
  assert.equal(green, null);
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test("assignDeploymentSlot to empty slot works correctly", () => {
  const manager = new AgentVersionManager();
  const v1 = manager.registerVersion(makeVersion({ version: "1.0.0" }));

  manager.assignDeploymentSlot("agent_bg", v1.versionId, "blue");

  const blue = manager.getActiveSlot("agent_bg", "blue");
  assert.equal(blue?.versionId, v1.versionId);
});

// ---------------------------------------------------------------------------
// Mutual exclusion: a single version cannot occupy both slots simultaneously
// ---------------------------------------------------------------------------

test("assignDeploymentSlot to opposite slot evicts version from previous slot (mutual exclusion)", () => {
  const manager = new AgentVersionManager();
  const v1 = manager.registerVersion(makeVersion({ version: "1.0.0" }));

  // First assign to blue
  manager.assignDeploymentSlot("agent_bg", v1.versionId, "blue");
  assert.equal(manager.getActiveSlot("agent_bg", "blue")?.versionId, v1.versionId);
  assert.equal(manager.getActiveSlot("agent_bg", "green"), null);

  // Now move v1 to green - should evict from blue (mutual exclusion)
  manager.assignDeploymentSlot("agent_bg", v1.versionId, "green");

  assert.equal(manager.getActiveSlot("agent_bg", "blue"), null);
  assert.equal(manager.getActiveSlot("agent_bg", "green")?.versionId, v1.versionId);
});

test("revokeSlot clears slotAssignments correctly", () => {
  const manager = new AgentVersionManager();
  const v1 = manager.registerVersion(makeVersion({ version: "1.0.0" }));
  manager.assignDeploymentSlot("agent_bg", v1.versionId, "green");

  manager.revokeSlot("agent_bg", v1.versionId);

  const green = manager.getActiveSlot("agent_bg", "green");
  assert.equal(green, null);
});

test("blueGreenSwitch returns null when no versions exist", () => {
  const manager = new AgentVersionManager();
  const result = manager.blueGreenSwitch("nonexistent", "blue");
  assert.equal(result, null);
});
