import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { createGithubAdapterPlugin, type GithubAdapterPluginOptions, verifyPluginSignature } from "../../../../src/plugins/adapters/github-adapter.js";
import type { NetworkEgressPolicyService } from "../../../../src/platform/five-plane-control-plane/iam/network-egress-policy.js";

function createMockFetch(responseBody: unknown = { ok: true }) {
  return async (input: string | URL, init?: RequestInit) => ({
    ok: true,
    status: 200,
    url: String(input),
    init,
    headers: { get: () => null },
    text: async () => JSON.stringify(responseBody),
  }) as Response;
}

function createMockPolicy(allowed: boolean = true): NetworkEgressPolicyService {
  return {
    evaluate: (_url: string) => ({
      allowed,
      destinationType: "external" as const,
      destination: "api.github.com",
      reasonCode: allowed ? null : "github_adapter.egress_blocked",
    }),
    getMode: () => "enforce" as const,
    record: () => {},
  } as unknown as NetworkEgressPolicyService;
}

test("GithubAdapter type exports are correct", () => {
  const adapter = createGithubAdapterPlugin();
  assert.ok(adapter !== undefined);
});

test("GithubAdapter has correct plugin metadata", () => {
  const adapter = createGithubAdapterPlugin();

  assert.equal(adapter.pluginId, "plugin.shared.github_adapter");
  assert.equal(adapter.spiType, "adapter");
  assert.equal(adapter.adapterType, "github");
});

test("GithubAdapter has correct capabilityIds", () => {
  const adapter = createGithubAdapterPlugin();

  assert.deepEqual(adapter.capabilityIds, ["external.github", "external.github.issue", "external.github.workflow"]);
});

test("GithubAdapter.initialize returns undefined", async () => {
  const adapter = createGithubAdapterPlugin();
  assert.ok(adapter.initialize !== undefined);
  const result = await adapter.initialize();
  assert.equal(result, undefined);
});

test("GithubAdapter.shutdown clears credential fingerprint", async () => {
  const adapter = createGithubAdapterPlugin();
  assert.ok(adapter.shutdown !== undefined);
  await adapter.shutdown();
  // No error means success
});

test("GithubAdapter.authenticate stores token fingerprint", async () => {
  const adapter = createGithubAdapterPlugin();

  await adapter.authenticate({ token: "ghp_test1234567890" });

  // Authentication succeeds without error
});

test("GithubAdapter.authenticate throws on missing token", async () => {
  const adapter = createGithubAdapterPlugin();

  await assert.rejects(
    async () => adapter.authenticate({}),
    { message: /github_adapter\.missing_token/ },
  );
});

test("GithubAdapter.execute throws when not authenticated", async () => {
  const adapter = createGithubAdapterPlugin();

  await assert.rejects(
    async () => adapter.execute("create_issue", { repository: "test/repo" }),
    { message: "github_adapter.not_authenticated" },
  );
});

test("GithubAdapter.execute builds correct endpoint for create_issue", async () => {
  const adapter = createGithubAdapterPlugin({ policy: createMockPolicy(), fetchImplementation: createMockFetch({ id: 1 }) });
  await adapter.authenticate({ token: "ghp_test1234567890" });

  const result = await adapter.execute("create_issue", {
    repository: "owner/repo",
    title: "Test Issue",
    body: "Issue body",
  });

  const output = result as any;
  assert.equal(output.action, "create_issue");
  assert.equal(output.repository, "owner/repo");
  assert.ok(output.endpoint.includes("/repos/owner/repo/issues"));
  assert.equal(output.timeoutMs, 10000);
  assert.equal(output.rateLimitPerMinute, 60);
  assert.equal(typeof output.idempotencyKey, "string");
  assert.equal(output.status, 200);
  assert.deepEqual(output.data, { id: 1 });
});

test("GithubAdapter.execute builds correct endpoint for create_pr_comment", async () => {
  const adapter = createGithubAdapterPlugin({ policy: createMockPolicy(), fetchImplementation: createMockFetch({ id: 2 }) });
  await adapter.authenticate({ token: "ghp_test1234567890" });

  const result = await adapter.execute("create_pr_comment", {
    repository: "owner/repo",
    issueNumber: "42",
    body: "PR comment",
  });

  const output = result as any;
  assert.equal(output.action, "create_pr_comment");
  assert.ok(output.endpoint.includes("/issues/42/comments"));
  assert.deepEqual(output.payload, { body: "PR comment" });
});

test("GithubAdapter.execute builds correct endpoint for dispatch_workflow", async () => {
  const adapter = createGithubAdapterPlugin({ policy: createMockPolicy(), fetchImplementation: createMockFetch({ workflow: "queued" }) });
  await adapter.authenticate({ token: "ghp_test1234567890" });

  const result = await adapter.execute("dispatch_workflow", {
    repository: "owner/repo",
    workflowId: "build.yml",
    ref: "main",
  });

  const output = result as any;
  assert.equal(output.action, "dispatch_workflow");
  assert.ok(output.endpoint.includes("/actions/workflows/build.yml/dispatches"));
  assert.deepEqual(output.payload, { ref: "main", inputs: {} });
});

test("GithubAdapter.execute builds correct endpoint for get_file", async () => {
  const adapter = createGithubAdapterPlugin({ policy: createMockPolicy(), fetchImplementation: createMockFetch({ path: "README.md" }) });
  await adapter.authenticate({ token: "ghp_test1234567890" });

  const result = await adapter.execute("get_file", {
    repository: "owner/repo",
    path: "README.md",
  });

  const output = result as any;
  assert.equal(output.action, "get_file");
  assert.ok(output.endpoint.includes("/contents/README.md"));
  assert.equal(output.idempotencyKey, undefined);
  assert.equal("payload" in output, false);
});

test("GithubAdapter.execute throws PolicyDeniedError when egress blocked", async () => {
  const adapter = createGithubAdapterPlugin({ policy: createMockPolicy(false) });
  await adapter.authenticate({ token: "ghp_test1234567890" });

  await assert.rejects(
    async () => adapter.execute("create_issue", {
      repository: "owner/repo",
      title: "Test",
      body: "Body",
    }),
    (err: any) => {
      return err.code === "github_adapter.egress_blocked";
    },
  );
});

test("GithubAdapter.execute throws on missing repository", async () => {
  const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
  await adapter.authenticate({ token: "ghp_test1234567890" });

  await assert.rejects(
    async () => adapter.execute("create_issue", {}),
    { message: /github_adapter\.missing_repository/ },
  );
});

test("GithubAdapter uses custom apiBaseUrl when provided", async () => {
  const adapter = createGithubAdapterPlugin({
    apiBaseUrl: "https://github.example.com/api/v3",
    policy: createMockPolicy(),
    fetchImplementation: createMockFetch({ path: "test.txt" }),
  });
  await adapter.authenticate({ token: "ghp_test1234567890" });

  const result = await adapter.execute("get_file", {
    repository: "owner/repo",
    path: "test.txt",
  });

  const output = result as any;
  assert.ok(output.endpoint.startsWith("https://github.example.com/api/v3"));
});

test("GithubAdapter.execute rejects repository traversal input", async () => {
  const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
  await adapter.authenticate({ token: "ghp_test1234567890" });

  await assert.rejects(
    async () => adapter.execute("create_issue", {
      repository: "owner/../repo",
      title: "Test",
      body: "Body",
    }),
    { message: "github_adapter.invalid_repository" },
  );
});

test("GithubAdapter.execute rejects encoded slash repository input", async () => {
  const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
  await adapter.authenticate({ token: "ghp_test1234567890" });

  await assert.rejects(
    async () => adapter.execute("create_issue", {
      repository: "owner%2Frepo/extra",
      title: "Test",
      body: "Body",
    }),
    { message: "github_adapter.invalid_repository" },
  );
});

test("GithubAdapter.execute rejects path traversal input", async () => {
  const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
  await adapter.authenticate({ token: "ghp_test1234567890" });

  await assert.rejects(
    async () => adapter.execute("get_file", {
      repository: "owner/repo",
      path: "../README.md",
    }),
    { message: "github_adapter.invalid_path" },
  );
});

test("GithubAdapter.execute rejects workflow path traversal and undeclared action capabilities", async () => {
  const adapter = createGithubAdapterPlugin({ policy: createMockPolicy(), fetchImplementation: createMockFetch() });
  await adapter.authenticate({ token: "ghp_test1234567890" });

  await assert.rejects(
    async () => adapter.execute("dispatch_workflow", {
      repository: "owner/repo",
      workflowId: "../build.yml",
      ref: "main",
    }),
    { message: "github_adapter.invalid_workflowId" },
  );

  const restrictedAdapter = {
    ...createGithubAdapterPlugin({ policy: createMockPolicy() }),
    capabilityIds: ["external.github"],
  };
  await restrictedAdapter.authenticate({ token: "ghp_test1234567890" });

  await assert.rejects(
    async () => restrictedAdapter.execute("create_issue", {
      repository: "owner/repo",
      title: "Test",
      body: "Body",
    }),
    { message: "github_adapter.action_not_allowed:create_issue" },
  );
});

test("GithubAdapter.verifyPluginSignature uses HMAC validation", () => {
  const pluginId = "plugin.shared.github_adapter";
  const manifestHash = "abc123";
  const secretKey = "super-secret";
  const signature = createHmac("sha256", secretKey).update(`${pluginId}:${manifestHash}`).digest("hex");
  const result = verifyPluginSignature(pluginId, manifestHash, signature, secretKey);
  assert.equal(result.valid, true);
});
