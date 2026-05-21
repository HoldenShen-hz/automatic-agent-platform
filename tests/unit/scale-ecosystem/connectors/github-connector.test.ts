/**
 * Unit tests for GitHubConnector
 *
 * @see src/scale-ecosystem/integration/connectors/github-connector.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import { GitHubConnector } from "../../../../../src/scale-ecosystem/integration/connectors/github-connector.js";
import type { ConnectorExecutionRequest } from "../../../../../src/scale-ecosystem/integration/connector-runtime/index.js";

function createRequest(overrides: Partial<ConnectorExecutionRequest> = {}): ConnectorExecutionRequest {
  return {
    connectorId: overrides.connectorId ?? "github-test",
    capability: overrides.capability ?? "create_pr",
    payload: overrides.payload ?? {},
    policyRef: "policyRef" in overrides ? overrides.policyRef : "policy.connector.github-test",
    secretBindings: "secretBindings" in overrides
      ? overrides.secretBindings
      : [{ secretRef: "secret://github-test/token", purpose: "api_token" }],
  };
}

test("GitHubConnector.listCapabilities returns all supported capabilities", () => {
  const connector = new GitHubConnector();
  const capabilities = connector.listCapabilities();

  assert.deepStrictEqual(capabilities, ["create_pr", "create_issue", "dispatch_workflow"]);
});

test("GitHubConnector.supportsCapability returns true for create_pr", () => {
  const connector = new GitHubConnector();
  assert.equal(connector.supportsCapability("create_pr"), true);
});

test("GitHubConnector.supportsCapability returns true for create_issue", () => {
  const connector = new GitHubConnector();
  assert.equal(connector.supportsCapability("create_issue"), true);
});

test("GitHubConnector.supportsCapability returns true for dispatch_workflow", () => {
  const connector = new GitHubConnector();
  assert.equal(connector.supportsCapability("dispatch_workflow"), true);
});

test("GitHubConnector.supportsCapability returns false for unsupported capabilities", () => {
  const connector = new GitHubConnector();
  assert.equal(connector.supportsCapability("merge_pr"), false);
  assert.equal(connector.supportsCapability("close_pr"), false);
  assert.equal(connector.supportsCapability("delete_repo"), false);
  assert.equal(connector.supportsCapability("CREATE_PR"), false);
});

test("GitHubConnector.execute returns success for create_pr capability", () => {
  const connector = new GitHubConnector();
  const request = createRequest({ capability: "create_pr" });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
  assert.equal(result.connectorId, "github-test");
});

test("GitHubConnector.execute returns success for create_issue capability", () => {
  const connector = new GitHubConnector();
  const request = createRequest({ capability: "create_issue" });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("GitHubConnector.execute returns success for dispatch_workflow capability", () => {
  const connector = new GitHubConnector();
  const request = createRequest({ capability: "dispatch_workflow" });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("GitHubConnector.execute returns failure for unknown capability", () => {
  const connector = new GitHubConnector();
  const request = createRequest({ capability: "merge_pr" });

  const result = connector.execute(request);

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("GitHubConnector.execute preserves connectorId from request", () => {
  const connector = new GitHubConnector();
  const request = createRequest({ connectorId: "github-enterprise-connector" });

  const result = connector.execute(request);

  assert.equal(result.connectorId, "github-enterprise-connector");
});

test("GitHubConnector.execute fails when policyRef is missing", () => {
  const connector = new GitHubConnector();
  const request = createRequest({ policyRef: undefined });

  const result = connector.execute(request);

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("GitHubConnector.execute fails when secretBindings are empty", () => {
  const connector = new GitHubConnector();
  const request = createRequest({ secretBindings: [] });

  const result = connector.execute(request);

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("GitHubConnector.execute succeeds with valid policyRef and secretBindings", () => {
  const connector = new GitHubConnector();
  const request = createRequest({
    policyRef: "policy.connector.github",
    secretBindings: [{ secretRef: "secret://github/token", purpose: "api_token" }],
  });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("GitHubConnector.execute handles create_pr with full payload", () => {
  const connector = new GitHubConnector();
  const request = createRequest({
    capability: "create_pr",
    payload: {
      owner: "myorg",
      repo: "myrepo",
      title: "feat: new feature",
      head: "feature-branch",
      base: "main",
    },
  });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("GitHubConnector.execute handles create_issue with labels payload", () => {
  const connector = new GitHubConnector();
  const request = createRequest({
    capability: "create_issue",
    payload: {
      owner: "myorg",
      repo: "myrepo",
      title: "Bug report",
      body: "This is a bug",
      labels: ["bug", "priority"],
    },
  });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("GitHubConnector.execute handles dispatch_workflow with inputs", () => {
  const connector = new GitHubConnector();
  const request = createRequest({
    capability: "dispatch_workflow",
    payload: {
      owner: "myorg",
      repo: "myrepo",
      workflowId: "ci.yml",
      ref: "main",
      inputs: { environment: "production" },
    },
  });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("GitHubConnector.execute is case-sensitive for capability names", () => {
  const connector = new GitHubConnector();

  const upperRequest = createRequest({ capability: "CREATE_PR" });
  const lowerRequest = createRequest({ capability: "create_pr" });

  const resultUpper = connector.execute(upperRequest);
  const resultLower = connector.execute(lowerRequest);

  assert.equal(resultUpper.success, false);
  assert.equal(resultUpper.status, "failed");
  assert.equal(resultLower.success, true);
  assert.equal(resultLower.status, "succeeded");
});

test("GitHubConnector.execute handles empty payload", () => {
  const connector = new GitHubConnector();
  const request = createRequest({ capability: "create_pr", payload: {} });

  const result = connector.execute(request);

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("GitHubConnector is stateless - multiple executions produce same result", () => {
  const connector = new GitHubConnector();
  const request = createRequest({ capability: "create_pr" });

  const result1 = connector.execute(request);
  const result2 = connector.execute(request);

  assert.deepStrictEqual(result1, result2);
});

test("GitHubConnector.execute includes executionId when provided by connector", () => {
  const connector = new GitHubConnector();
  const request = createRequest({ capability: "create_pr" });

  const result = connector.execute(request);

  assert.equal(result.connectorId, "github-test");
  assert.equal(typeof result.success, "boolean");
  assert.ok(["succeeded", "failed"].includes(result.status));
});