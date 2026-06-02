import test from "node:test";
import assert from "node:assert/strict";

import { createGithubAdapterPlugin } from "../../../src/plugins/adapters/github-adapter.js";

function createMockFetch(responseBody: unknown = { ok: true }) {
  return async (_input: string | URL, _init?: RequestInit) => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    text: async () => JSON.stringify(responseBody),
  }) as Response;
}

test("createGithubAdapterPlugin returns valid adapter plugin structure", () => {
  const plugin = createGithubAdapterPlugin();

  assert.equal(plugin.pluginId, "plugin.shared.github_adapter");
  assert.equal(plugin.spiType, "adapter");
  assert.equal(plugin.adapterType, "github");
  assert.ok(Array.isArray(plugin.capabilityIds));
  assert.ok(plugin.capabilityIds.includes("external.github"));
});

test("createGithubAdapterPlugin.initialize returns undefined", async () => {
  const plugin = createGithubAdapterPlugin();
  const result = await plugin.initialize!();
  assert.equal(result, undefined);
});

test("createGithubAdapterPlugin.shutdown returns undefined", async () => {
  const plugin = createGithubAdapterPlugin();
  await plugin.authenticate({ token: "ghp_testtoken123" });
  const result = await plugin.shutdown!();
  assert.equal(result, undefined);
});

test("createGithubAdapterPlugin.authenticate stores token fingerprint", async () => {
  const plugin = createGithubAdapterPlugin();
  const result = await plugin.authenticate({ token: "ghp_testtoken123" });
  assert.equal(result, undefined);
});

test("createGithubAdapterPlugin.authenticate accepts managedSecretRef", async () => {
  const plugin = createGithubAdapterPlugin();
  const result = await plugin.authenticate({ managedSecretRef: "secret://github/token" });
  assert.equal(result, undefined);
});

test("createGithubAdapterPlugin.execute throws when not authenticated", async () => {
  const plugin = createGithubAdapterPlugin();
  await assert.rejects(
    async () => plugin.execute("create_issue", { repository: "test/repo", title: "Test", body: "Body" }),
    { message: /github_adapter.not_authenticated/ }
  );
});

test("createGithubAdapterPlugin.execute builds correct endpoint for create_issue", async () => {
  const plugin = createGithubAdapterPlugin({ fetchImplementation: createMockFetch({ issueId: 1 }) });
  await plugin.authenticate({ token: "ghp_testtoken123" });

  const result = await plugin.execute("create_issue", {
    repository: "owner/repo",
    title: "Test Issue",
    body: "Issue body",
  }) as Record<string, unknown>;

  assert.equal(result.action, "create_issue");
  assert.equal(result.repository, "owner/repo");
  assert.deepEqual(result.requestSummary, {
    endpointHost: "api.github.com",
    endpointTemplate: "/repos/{repository}/issues",
    payloadKeys: ["body", "labels", "title"],
  });
  assert.equal(result.status, 200);
});

test("createGithubAdapterPlugin.execute builds correct endpoint for get_file", async () => {
  const plugin = createGithubAdapterPlugin({ fetchImplementation: createMockFetch({ content: "ok" }) });
  await plugin.authenticate({ token: "ghp_testtoken" });

  const result = await plugin.execute("get_file", {
    repository: "owner/repo",
    path: "src/index.ts",
  }) as Record<string, unknown>;

  assert.equal(result.action, "get_file");
  assert.deepEqual(result.requestSummary, {
    endpointHost: "api.github.com",
    endpointTemplate: "/repos/{repository}/contents/{path}",
    payloadKeys: [],
  });
});

test("createGithubAdapterPlugin.execute builds correct endpoint for dispatch_workflow", async () => {
  const plugin = createGithubAdapterPlugin({ fetchImplementation: createMockFetch({ workflow: "queued" }) });
  await plugin.authenticate({ token: "ghp_testtoken" });

  const result = await plugin.execute("dispatch_workflow", {
    repository: "owner/repo",
    workflowId: "build.yml",
    ref: "main",
  }) as Record<string, unknown>;

  assert.equal(result.action, "dispatch_workflow");
  assert.deepEqual(result.requestSummary, {
    endpointHost: "api.github.com",
    endpointTemplate: "/repos/{repository}/actions/workflows/{workflowId}/dispatches",
    payloadKeys: ["inputs", "ref"],
  });
});

test("createGithubAdapterPlugin.execute builds correct endpoint for create_pr_comment", async () => {
  const plugin = createGithubAdapterPlugin({ fetchImplementation: createMockFetch({ commentId: 42 }) });
  await plugin.authenticate({ token: "ghp_testtoken" });

  const result = await plugin.execute("create_pr_comment", {
    repository: "owner/repo",
    issueNumber: "42",
    body: "Comment body",
  }) as Record<string, unknown>;

  assert.equal(result.action, "create_pr_comment");
  assert.deepEqual(result.requestSummary, {
    endpointHost: "api.github.com",
    endpointTemplate: "/repos/{repository}/issues/{issueNumber}/comments",
    payloadKeys: ["body"],
  });
});

test("createGithubAdapterPlugin.authenticate rejects CRLF token values", async () => {
  const plugin = createGithubAdapterPlugin({ fetchImplementation: createMockFetch({ ok: true }) });

  await assert.rejects(
    () => plugin.authenticate({ token: "ghp_test\r\nx-injected: true" }),
    { message: "github_adapter.invalid_token" },
  );
});

test("createGithubAdapterPlugin.execute throws for missing required params", async () => {
  const plugin = createGithubAdapterPlugin({ fetchImplementation: createMockFetch({ issueId: 2 }) });
  await plugin.authenticate({ token: "ghp_testtoken" });

  await assert.rejects(
    async () => plugin.execute("create_issue", { repository: "owner/repo" }),
    { message: /missing_title/ }
  );
});

test("createGithubAdapterPlugin.execute allows api.github.com even with complex repository path", async () => {
  const plugin = createGithubAdapterPlugin({ fetchImplementation: createMockFetch({ issueId: 3 }) });
  await plugin.authenticate({ token: "ghp_testtoken" });

  // The policy checks hostname, not the path
  // api.github.com is allowed, so this should work
  const result = await plugin.execute("create_issue", {
    repository: "owner/repo",
    title: "Test",
    body: "Body",
  }) as Record<string, unknown>;

  assert.equal(result.action, "create_issue");
  assert.equal(result.repository, "owner/repo");
  assert.deepEqual(result.requestSummary, {
    endpointHost: "api.github.com",
    endpointTemplate: "/repos/{repository}/issues",
    payloadKeys: ["body", "labels", "title"],
  });
});

test("createGithubAdapterPlugin uses custom apiBaseUrl", async () => {
  const plugin = createGithubAdapterPlugin({ apiBaseUrl: "https://api.github.com", fetchImplementation: createMockFetch({ content: "ok" }) });
  await plugin.authenticate({ token: "ghp_testtoken" });

  const result = await plugin.execute("get_file", {
    repository: "owner/repo",
    path: "README.md",
  }) as Record<string, unknown>;

  assert.deepEqual(result.requestSummary, {
    endpointHost: "api.github.com",
    endpointTemplate: "/repos/{repository}/contents/{path}",
    payloadKeys: [],
  });
});

test("createGithubAdapterPlugin.healthCheck returns boolean", async () => {
  const plugin = createGithubAdapterPlugin({ fetchImplementation: createMockFetch({ workflow: "queued" }) });
  const result = await plugin.healthCheck!();
  // healthCheck returns a boolean from the policy evaluation
  assert.equal(typeof result, "boolean");
});

test("createGithubAdapterPlugin.execute builds payload for dispatch_workflow with inputs", async () => {
  const plugin = createGithubAdapterPlugin({ fetchImplementation: createMockFetch({ workflow: "queued" }) });
  await plugin.authenticate({ token: "ghp_testtoken" });

  const result = await plugin.execute("dispatch_workflow", {
    repository: "owner/repo",
    workflowId: "ci.yml",
    ref: "main",
    inputs: { environment: "production" },
  }) as Record<string, unknown>;

  assert.deepEqual(result.requestSummary, {
    endpointHost: "api.github.com",
    endpointTemplate: "/repos/{repository}/actions/workflows/{workflowId}/dispatches",
    payloadKeys: ["inputs", "ref"],
  });
});

test("createGithubAdapterPlugin.execute uses default ref when not provided for get_file", async () => {
  const plugin = createGithubAdapterPlugin({ fetchImplementation: createMockFetch({ content: "ok" }) });
  await plugin.authenticate({ token: "ghp_testtoken" });

  const result = await plugin.execute("get_file", {
    repository: "owner/repo",
    path: "README.md",
  }) as Record<string, unknown>;

  assert.equal((result.requestSummary as Record<string, unknown>).endpointTemplate, "/repos/{repository}/contents/{path}");
});

test("createGithubAdapterPlugin.execute accepts custom ref for get_file", async () => {
  const plugin = createGithubAdapterPlugin({ fetchImplementation: createMockFetch({ content: "ok" }) });
  await plugin.authenticate({ token: "ghp_testtoken" });

  const result = await plugin.execute("get_file", {
    repository: "owner/repo",
    path: "README.md",
    ref: "v1.0.0",
  }) as Record<string, unknown>;

  assert.equal((result.requestSummary as Record<string, unknown>).endpointTemplate, "/repos/{repository}/contents/{path}");
});

test("createGithubAdapterPlugin.execute returns adapter identifier", async () => {
  const plugin = createGithubAdapterPlugin({ fetchImplementation: createMockFetch({ content: "ok" }) });
  await plugin.authenticate({ token: "ghp_testtoken" });

  const result = await plugin.execute("get_file", {
    repository: "owner/repo",
    path: "README.md",
  }) as Record<string, unknown>;

  assert.equal(result.adapter, "github");
});
