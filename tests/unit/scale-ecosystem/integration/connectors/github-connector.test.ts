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

test("GitHubConnector.execute handles dispatch_workflow with workflow payload", () => {
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
  const requestUpper = createRequest({ capability: "CREATE_PR" });
  const requestLower = createRequest({ capability: "create_pr" });

  const resultUpper = connector.execute(requestUpper);
  const resultLower = connector.execute(requestLower);

  // Uppercase should fail
  assert.equal(resultUpper.success, false);
  assert.equal(resultUpper.status, "failed");
  // Lowercase should succeed
  assert.equal(resultLower.success, true);
  assert.equal(resultLower.status, "succeeded");
});

test("GitHubConnector.execute rejects close_pr capability", () => {
  const connector = new GitHubConnector();
  const request = createRequest({ capability: "close_pr" });

  const result = connector.execute(request);

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("GitHubConnector.execute fails closed when policyRef is missing", () => {
  const connector = new GitHubConnector();
  const request = createRequest({ policyRef: undefined });

  const result = connector.execute(request);

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("GitHubConnector.execute fails closed when secretBindings are missing", () => {
  const connector = new GitHubConnector();
  const request = createRequest({ secretBindings: [] });

  const result = connector.execute(request);

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("GitHubConnector.execute handles create_issue with issue payload", () => {
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
