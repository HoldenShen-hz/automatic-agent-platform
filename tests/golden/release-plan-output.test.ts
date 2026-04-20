/**
 * Golden Test: Release Plan Output
 *
 * Verifies release plan markdown generation produces expected structure
 * and content patterns.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMarkdown,
  type ReleasePipelineBundle,
} from "../../src/platform/control-plane/incident-control/release-pipeline-support.js";

test("golden: buildMarkdown produces correct structure", () => {
  const bundle: ReleasePipelineBundle = {
    bundleId: "bundle_test_123",
    generatedAt: "2026-04-15T10:00:00.000Z",
    environment: "staging",
    version: "1.2.3",
    commitSha: "abc123def456",
    imageTag: "v1.2.3",
    imageRef: "registry.example.com/app:v1.2.3",
    imageRepository: "registry.example.com/app",
    rolloutStrategy: "canary",
    deploymentNamespace: "prod",
    clusterName: "prod-cluster-1",
    configPath: "config/staging.json",
    configBundleRef: "config-bundle://releases/v1.2.3",
    registryCredentialRef: "secret://registry/credentials",
    deploymentCredentialRef: "secret://deploy/credentials",
    publishWorkflowPath: ".github/workflows/publish.yaml",
    deployWorkflowPath: ".github/workflows/deploy.yaml",
    requiredReadinessChecks: ["tests_pass", "security_scan", "code_review"],
    recommendedCommands: ["npm run doctor", "npm run validate"],
  };

  const markdown = buildMarkdown(bundle);

  // Verify structure
  assert.ok(markdown.startsWith("# Release Pipeline Bundle"), "Should start with title");
  assert.ok(markdown.includes("Bundle ID: `bundle_test_123`"), "Should include bundle ID");
  assert.ok(markdown.includes("Environment: `staging`"), "Should include environment");
  assert.ok(markdown.includes("Version: `1.2.3`"), "Should include version");
  assert.ok(markdown.includes("Commit SHA: `abc123def456`"), "Should include commit SHA");
  assert.ok(markdown.includes("Image Ref: `registry.example.com/app:v1.2.3`"), "Should include image ref");
  assert.ok(markdown.includes("Rollout Strategy: `canary`"), "Should include rollout strategy");
  assert.ok(markdown.includes("Cluster: `prod-cluster-1`"), "Should include cluster");
  assert.ok(markdown.includes("Namespace: `prod`"), "Should include namespace");
  assert.ok(markdown.includes("Config Path: `config/staging.json`"), "Should include config path");
  assert.ok(markdown.includes("## Required Readiness Checks"), "Should have readiness checks section");
  assert.ok(markdown.includes("## Recommended Commands"), "Should have commands section");
});

test("golden: buildMarkdown includes all readiness checks", () => {
  const bundle: ReleasePipelineBundle = {
    bundleId: "bundle_456",
    generatedAt: "2026-04-15T10:00:00.000Z",
    environment: "prod",
    version: "2.0.0",
    commitSha: "xyz789",
    imageTag: "v2.0.0",
    imageRef: "registry.example.com/app:v2.0.0",
    imageRepository: "registry.example.com/app",
    rolloutStrategy: "rolling",
    deploymentNamespace: "prod",
    clusterName: "cluster-1",
    configPath: "config/prod.json",
    configBundleRef: "config-bundle://releases/v2.0.0",
    registryCredentialRef: "secret://registry/prod",
    deploymentCredentialRef: "secret://deploy/prod",
    publishWorkflowPath: ".github/workflows/publish.yaml",
    deployWorkflowPath: ".github/workflows/deploy.yaml",
    requiredReadinessChecks: ["check1", "check2", "check3"],
    recommendedCommands: [],
  };

  const markdown = buildMarkdown(bundle);

  assert.ok(markdown.includes("- `check1`"), "Should include check1");
  assert.ok(markdown.includes("- `check2`"), "Should include check2");
  assert.ok(markdown.includes("- `check3`"), "Should include check3");
});

test("golden: buildMarkdown handles empty readiness checks", () => {
  const bundle: ReleasePipelineBundle = {
    bundleId: "bundle_empty",
    generatedAt: "2026-04-15T10:00:00.000Z",
    environment: "dev",
    version: "0.0.1",
    commitSha: "dev123",
    imageTag: "dev-0.0.1",
    imageRef: "registry.example.com/app:dev-0.0.1",
    imageRepository: "registry.example.com/app",
    rolloutStrategy: "rolling",
    deploymentNamespace: "dev",
    clusterName: "dev-cluster",
    configPath: "config/dev.json",
    configBundleRef: "config-bundle://dev",
    registryCredentialRef: "secret://registry/dev",
    deploymentCredentialRef: "secret://deploy/dev",
    publishWorkflowPath: ".github/workflows/publish.yaml",
    deployWorkflowPath: ".github/workflows/deploy.yaml",
    requiredReadinessChecks: [],
    recommendedCommands: [],
  };

  const markdown = buildMarkdown(bundle);

  assert.ok(markdown.includes("## Required Readiness Checks"), "Should still have section header");
  assert.ok(markdown.includes("## Recommended Commands"), "Should still have commands section");
});

test("golden: buildMarkdown includes recommended commands", () => {
  const bundle: ReleasePipelineBundle = {
    bundleId: "bundle_cmds",
    generatedAt: "2026-04-15T10:00:00.000Z",
    environment: "test",
    version: "1.0.0",
    commitSha: "cmd123",
    imageTag: "v1.0.0",
    imageRef: "registry.example.com/app:v1.0.0",
    imageRepository: "registry.example.com/app",
    rolloutStrategy: "canary",
    deploymentNamespace: "test",
    clusterName: "test-cluster",
    configPath: "config/test.json",
    configBundleRef: "config-bundle://test",
    registryCredentialRef: "secret://registry/test",
    deploymentCredentialRef: "secret://deploy/test",
    publishWorkflowPath: ".github/workflows/publish.yaml",
    deployWorkflowPath: ".github/workflows/deploy.yaml",
    requiredReadinessChecks: ["test"],
    recommendedCommands: ["npm run validate", "npm run test:integration"],
  };

  const markdown = buildMarkdown(bundle);

  assert.ok(markdown.includes("- `npm run validate`"), "Should include first recommended command");
  assert.ok(markdown.includes("- `npm run test:integration`"), "Should include second recommended command");
});

test("golden: buildMarkdown formats all rollout strategies", () => {
  const strategies: Array<"rolling" | "canary" | "blue_green"> = ["rolling", "canary", "blue_green"];

  for (const strategy of strategies) {
    const bundle: ReleasePipelineBundle = {
      bundleId: `bundle_${strategy}`,
      generatedAt: "2026-04-15T10:00:00.000Z",
      environment: "staging",
      version: "1.0.0",
      commitSha: "test_sha",
      imageTag: "v1.0.0",
      imageRef: "registry.example.com/app:v1.0.0",
      imageRepository: "registry.example.com/app",
      rolloutStrategy: strategy,
      deploymentNamespace: "staging",
      clusterName: "staging-cluster",
      configPath: "config/staging.json",
      configBundleRef: "config-bundle://staging",
      registryCredentialRef: "secret://registry/staging",
      deploymentCredentialRef: "secret://deploy/staging",
      publishWorkflowPath: ".github/workflows/publish.yaml",
      deployWorkflowPath: ".github/workflows/deploy.yaml",
      requiredReadinessChecks: [],
      recommendedCommands: [],
    };

    const markdown = buildMarkdown(bundle);
    assert.ok(markdown.includes(`Rollout Strategy: \`${strategy}\``), `Should include ${strategy} strategy`);
  }
});

test("golden: buildMarkdown preserves bundle ID in output", () => {
  const bundle: ReleasePipelineBundle = {
    bundleId: "bundle_special-id_123",
    generatedAt: "2026-04-15T10:00:00.000Z",
    environment: "pre-prod",
    version: "3.2.1",
    commitSha: "special_sha",
    imageTag: "v3.2.1",
    imageRef: "registry.example.com/app:v3.2.1",
    imageRepository: "registry.example.com/app",
    rolloutStrategy: "blue_green",
    deploymentNamespace: "pre-prod",
    clusterName: "preprod-cluster",
    configPath: "config/pre-prod.json",
    configBundleRef: "config-bundle://preprod",
    registryCredentialRef: "secret://registry/preprod",
    deploymentCredentialRef: "secret://deploy/preprod",
    publishWorkflowPath: ".github/workflows/publish.yaml",
    deployWorkflowPath: ".github/workflows/deploy.yaml",
    requiredReadinessChecks: ["security_scan", "performance_test"],
    recommendedCommands: ["npm run chaos:stable"],
  };

  const markdown = buildMarkdown(bundle);

  assert.ok(markdown.includes("bundle_special-id_123"), "Should preserve bundle ID with special characters");
  assert.ok(markdown.includes("pre-prod"), "Should handle pre-prod environment");
});
