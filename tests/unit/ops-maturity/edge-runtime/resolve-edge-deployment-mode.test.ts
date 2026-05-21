/**
 * Unit tests for resolveEdgeDeploymentMode function
 *
 * @see src/ops-maturity/edge-runtime/edge-runtime-sync-service.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  resolveEdgeDeploymentMode,
  type EdgeRuntimeProfile,
} from "../../../../src/ops-maturity/edge-runtime/edge-runtime-sync-service.js";

describe("resolveEdgeDeploymentMode", () => {
  function createProfile(overrides: Partial<EdgeRuntimeProfile> = {}): EdgeRuntimeProfile {
    return {
      edgeNodeId: "node-001",
      capabilities: [],
      connectivityMode: "online",
      maxLocalRetentionHours: 24,
      allowedModels: ["model-a"],
      syncPolicy: { allowRestrictedDataUpload: false, requireOrdering: false },
      ...overrides,
    };
  }

  test("returns explicit deploymentMode when set", () => {
    const profile = createProfile({ deploymentMode: "edge_mobile" });

    const result = resolveEdgeDeploymentMode(profile);

    assert.equal(result, "edge_mobile");
  });

  test("returns edge_mobile when capabilities include mobile", () => {
    const profile = createProfile({ capabilities: ["mobile"] });

    const result = resolveEdgeDeploymentMode(profile);

    assert.equal(result, "edge_mobile");
  });

  test("returns edge_mobile when capabilities include battery_powered", () => {
    const profile = createProfile({ capabilities: ["battery_powered"] });

    const result = resolveEdgeDeploymentMode(profile);

    assert.equal(result, "edge_mobile");
  });

  test("returns edge_hybrid when connectivityMode is intermittent", () => {
    const profile = createProfile({ connectivityMode: "intermittent" });

    const result = resolveEdgeDeploymentMode(profile);

    assert.equal(result, "edge_hybrid");
  });

  test("returns edge_hybrid when capabilities include cloud_sync", () => {
    const profile = createProfile({ capabilities: ["cloud_sync"] });

    const result = resolveEdgeDeploymentMode(profile);

    assert.equal(result, "edge_hybrid");
  });

  test("returns edge_micro when offline with single allowed model", () => {
    const profile = createProfile({
      connectivityMode: "offline",
      allowedModels: ["model-only"],
    });

    const result = resolveEdgeDeploymentMode(profile);

    assert.equal(result, "edge_micro");
  });

  test("returns edge_standard for offline with multiple models", () => {
    const profile = createProfile({
      connectivityMode: "offline",
      allowedModels: ["model-a", "model-b"],
    });

    const result = resolveEdgeDeploymentMode(profile);

    assert.equal(result, "edge_standard");
  });

  test("returns edge_standard when online with multiple models", () => {
    const profile = createProfile({
      connectivityMode: "online",
      allowedModels: ["model-a", "model-b", "model-c"],
    });

    const result = resolveEdgeDeploymentMode(profile);

    assert.equal(result, "edge_standard");
  });

  test("edge_mobile takes precedence over edge_hybrid", () => {
    const profile = createProfile({
      capabilities: ["mobile", "cloud_sync"],
      connectivityMode: "intermittent",
    });

    const result = resolveEdgeDeploymentMode(profile);

    assert.equal(result, "edge_mobile");
  });

  test("edge_hybrid takes precedence over edge_micro", () => {
    const profile = createProfile({
      capabilities: ["cloud_sync"],
      connectivityMode: "offline",
      allowedModels: ["only-one"],
    });

    const result = resolveEdgeDeploymentMode(profile);

    // cloud_sync triggers edge_hybrid before checking offline + single model
    assert.equal(result, "edge_hybrid");
  });

  test("returns edge_standard as default fallback", () => {
    const profile = createProfile({
      connectivityMode: "online",
      allowedModels: ["model-a"],
    });

    const result = resolveEdgeDeploymentMode(profile);

    assert.equal(result, "edge_standard");
  });

  test("handles empty capabilities array", () => {
    const profile = createProfile({ capabilities: [] });

    const result = resolveEdgeDeploymentMode(profile);

    assert.equal(result, "edge_standard");
  });

  test("handles offline with empty allowedModels", () => {
    const profile = createProfile({
      connectivityMode: "offline",
      allowedModels: [],
    });

    const result = resolveEdgeDeploymentMode(profile);

    // empty models = 0 models, which satisfies <= 1 condition for edge_micro
    assert.equal(result, "edge_micro");
  });

  test("explicit deploymentMode overrides all capability checks", () => {
    const profile = createProfile({
      deploymentMode: "edge_hybrid",
      capabilities: ["mobile", "cloud_sync"],
      connectivityMode: "intermittent",
      allowedModels: ["only-one"],
    });

    const result = resolveEdgeDeploymentMode(profile);

    assert.equal(result, "edge_hybrid");
  });
});