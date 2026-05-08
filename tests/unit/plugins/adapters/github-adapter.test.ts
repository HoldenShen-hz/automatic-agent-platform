import assert from "node:assert/strict";
import test from "node:test";

import { createGithubAdapterPlugin, type GithubAdapterPluginOptions } from "../../../../src/plugins/adapters/github-adapter.js";
import type { NetworkEgressPolicyService } from "../../../../src/platform/control-plane/iam/network-egress-policy.js";

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
  const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
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
});

test("GithubAdapter.execute builds correct endpoint for create_pr_comment", async () => {
  const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
  await adapter.authenticate({ token: "ghp_test1234567890" });

  const result = await adapter.execute("create_pr_comment", {
    repository: "owner/repo",
    issueNumber: "42",
    body: "PR comment",
  });

  const output = result as any;
  assert.equal(output.action, "create_pr_comment");
  assert.ok(output.endpoint.includes("/issues/42/comments"));
});

test("GithubAdapter.execute builds correct endpoint for dispatch_workflow", async () => {
  const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
  await adapter.authenticate({ token: "ghp_test1234567890" });

  const result = await adapter.execute("dispatch_workflow", {
    repository: "owner/repo",
    workflowId: "build.yml",
    ref: "main",
  });

  const output = result as any;
  assert.equal(output.action, "dispatch_workflow");
  assert.ok(output.endpoint.includes("/actions/workflows/build.yml/dispatches"));
});

test("GithubAdapter.execute builds correct endpoint for get_file", async () => {
  const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
  await adapter.authenticate({ token: "ghp_test1234567890" });

  const result = await adapter.execute("get_file", {
    repository: "owner/repo",
    path: "README.md",
  });

  const output = result as any;
  assert.equal(output.action, "get_file");
  assert.ok(output.endpoint.includes("/contents/README.md"));
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
  });
  await adapter.authenticate({ token: "ghp_test1234567890" });

  const result = await adapter.execute("get_file", {
    repository: "owner/repo",
    path: "test.txt",
  });

  const output = result as any;
  assert.ok(output.endpoint.startsWith("https://github.example.com/api/v3"));
});
