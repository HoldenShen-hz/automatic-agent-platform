/**
 * Unit Tests: GitHub Adapter (Extended)
 *
 * Tests for issue #2020: GitHub adapter repository param not sanitized, URL path traversal
 *
 * These tests verify the GitHub adapter's input validation and path handling.
 */

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

// =============================================================================
// Issue #2020: repository param not sanitized, path traversal
// The buildEndpoint function does not sanitize repository parameter
// =============================================================================

test("GithubAdapter.buildEndpoint does not sanitize repository parameter (issue #2020)", async () => {
  const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
  await adapter.authenticate({ token: "ghp_test1234567890" });

  // This tests the current behavior - repository is NOT sanitized
  // A malicious user could potentially use ".." or other path traversal
  // The endpoint directly concatenates repository without validation
  const result = await adapter.execute("get_file", {
    repository: "owner/repo",
    path: "../../../etc/passwd",
  });

  const output = result as Record<string, unknown>;
  // The endpoint will contain the raw path without sanitization
  assert.ok(output.endpoint.includes("../../../etc/passwd") || output.endpoint.includes("/contents/../../../etc/passwd"));
});

test("GithubAdapter.execute accepts repository with special characters", async () => {
  const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
  await adapter.authenticate({ token: "ghp_test1234567890" });

  // Repository with dots - this should work but is not sanitized
  const result = await adapter.execute("get_file", {
    repository: "owner/my.repo",
    path: "config.json",
  });

  const output = result as Record<string, unknown>;
  assert.equal(output.repository, "owner/my.repo");
  assert.ok(output.endpoint.includes("/repos/owner/my.repo/contents/config.json"));
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

// =============================================================================
// Additional security and validation tests
// =============================================================================

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

test("GithubAdapter.execute throws on empty repository", async () => {
  const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
  await adapter.authenticate({ token: "ghp_test1234567890" });

  await assert.rejects(
    async () => adapter.execute("create_issue", { repository: "   " }),
    { message: /github_adapter\.missing_repository/ },
  );
});

test("GithubAdapter.uses custom apiBaseUrl when provided", async () => {
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

test("GithubAdapter.execute throws when not authenticated", async () => {
  const adapter = createGithubAdapterPlugin();

  await assert.rejects(
    async () => adapter.execute("create_issue", { repository: "test/repo" }),
    { message: "github_adapter.not_authenticated" },
  );
});

test("GithubAdapter.execute handles path parameter validation", async () => {
  const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
  await adapter.authenticate({ token: "ghp_test1234567890" });

  // path parameter is required for get_file action
  await assert.rejects(
    async () => adapter.execute("get_file", {
      repository: "owner/repo",
      // path is missing
    }),
    { message: /github_adapter\.missing_path/ },
  );
});

test("GithubAdapter.execute handles empty path", async () => {
  const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
  await adapter.authenticate({ token: "ghp_test1234567890" });

  await assert.rejects(
    async () => adapter.execute("get_file", {
      repository: "owner/repo",
      path: "   ",
    }),
    { message: /github_adapter\.missing_path/ },
  );
});

test("GithubAdapter.execute builds payload for create_issue", async () => {
  const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
  await adapter.authenticate({ token: "ghp_test1234567890" });

  const result = await adapter.execute("create_issue", {
    repository: "owner/repo",
    title: "Bug Report",
    body: "This is a bug",
    labels: ["bug", "high-priority"],
  });

  const output = result as Record<string, unknown>;
  assert.ok("payload" in output);
  const payload = output.payload as Record<string, unknown>;
  assert.equal(payload.title, "Bug Report");
  assert.equal(payload.body, "This is a bug");
  assert.deepEqual(payload.labels, ["bug", "high-priority"]);
});

test("GithubAdapter.execute handles default action", async () => {
  const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
  await adapter.authenticate({ token: "ghp_test1234567890" });

  const result = await adapter.execute("unknown_action", {
    repository: "owner/repo",
  });

  const output = result as Record<string, unknown>;
  assert.equal(output.action, "unknown_action");
  assert.equal(output.repository, "owner/repo");
});

test("GithubAdapter.authenticate handles secret:// token format", async () => {
  const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });

  await adapter.authenticate({ managedSecretRef: "secret://github/token" });
  // Should not throw
});

test("GithubAdapter.authenticate handles regular token format", async () => {
  const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });

  await adapter.authenticate({ token: "ghp_regular_token" });
  // Should not throw
});

test("GithubAdapter.lifecycle hooks exist", async () => {
  const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });

  assert.ok(typeof adapter.onLoad === "function");
  assert.ok(typeof adapter.onActivate === "function");
  assert.ok(typeof adapter.onDeactivate === "function");
  assert.ok(typeof adapter.onUnload === "function");
});

test("GithubAdapter.onActivate throws if not authenticated", async () => {
  const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });

  await assert.rejects(
    async () => adapter.onActivate!({ pluginId: "test", domainId: null, capabilityIds: [], bindingId: null, config: {} }),
    { message: /github_adapter\.not_authenticated/ },
  );
});

test("GithubAdapter.onActivate succeeds after authentication", async () => {
  const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });

  await adapter.authenticate({ token: "ghp_test_token" });
  await adapter.onActivate!({ pluginId: "test", domainId: null, capabilityIds: [], bindingId: null, config: {} });
  // Should not throw
});

test("GithubAdapter.onDeactivate clears credential fingerprint", async () => {
  const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });

  await adapter.authenticate({ token: "ghp_test_token" });
  await adapter.onDeactivate!({ pluginId: "test", domainId: null, capabilityIds: [], bindingId: null, config: {} });

  // After deactivation, execute should fail
  await assert.rejects(
    async () => adapter.execute("create_issue", { repository: "owner/repo", title: "Test", body: "Test" }),
    { message: "github_adapter.not_authenticated" },
  );
});

test("GithubAdapter has correct manifest when provided", () => {
  const customManifest = {
    pluginId: "plugin.custom.github",
    name: "Custom GitHub Adapter",
    version: "2.0.0",
    owner: "custom-team",
    domainIds: ["custom"],
    capabilityIds: ["external.github.custom"],
    spiTypes: ["adapter"] as const,
    extensionKind: "external_adapter" as const,
    trustLevel: "trusted" as const,
    publicSdkSurface: "@custom/github-adapter",
    settingsSchema: {},
    signing: {
      keyId: "key-123",
      signature: "sig-abc",
      algorithm: "sha256",
    },
    sandbox: {
      timeoutMs: 10000,
      allowFilesystemWrite: false,
      allowNetworkEgress: true,
      allowedKnowledgeNamespaces: [],
      maxConcurrentInvocations: 4,
      maxQueuedInvocations: 8,
      runtimeIsolation: "serialized_in_process" as const,
      cooldownMs: 0,
      allowedExternalDomains: [],
      maxResponseSizeBytes: 5 * 1024 * 1024,
      rateLimitPerMinute: 60,
    },
  };

  const adapter = createGithubAdapterPlugin({
    manifest: customManifest,
    verifySignature: true,
  });

  assert.equal(adapter.pluginId, "plugin.custom.github");
  assert.ok(adapter.manifest);
  assert.equal((adapter.manifest as any).version, "2.0.0");
});

test("GithubAdapter.verifySignature throws on missing signature for untrusted plugin", () => {
  const untrustedManifest = {
    pluginId: "plugin.external.untrusted",
    name: "Untrusted Plugin",
    version: "1.0.0",
    owner: "external",
    domainIds: [],
    capabilityIds: ["external.test"],
    spiTypes: ["adapter"] as const,
    extensionKind: "external_adapter" as const,
    trustLevel: "community" as const, // Not trusted
    publicSdkSurface: "@external/test",
    settingsSchema: {},
    // No signing configuration
    sandbox: {
      timeoutMs: 5000,
      allowFilesystemWrite: false,
      allowNetworkEgress: false,
      allowedKnowledgeNamespaces: [],
      maxConcurrentInvocations: 1,
      maxQueuedInvocations: 8,
      runtimeIsolation: "serialized_in_process" as const,
      cooldownMs: 0,
      allowedExternalDomains: [],
      maxResponseSizeBytes: 5 * 1024 * 1024,
      rateLimitPerMinute: 60,
    },
  };

  assert.throws(
    () => createGithubAdapterPlugin({
      manifest: untrustedManifest as any,
      verifySignature: true,
    }),
    { message: /github_adapter\.signature_required/ },
  );
});

test("GithubAdapter.execute dispatches workflow with ref parameter", async () => {
  const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
  await adapter.authenticate({ token: "ghp_test1234567890" });

  const result = await adapter.execute("dispatch_workflow", {
    repository: "owner/repo",
    workflowId: "ci.yml",
    ref: "release-v2.0",
    inputs: { environment: "production" },
  });

  const output = result as Record<string, unknown>;
  const payload = output.payload as Record<string, unknown>;
  assert.equal(payload.workflowId, "ci.yml");
  assert.equal(payload.ref, "release-v2.0");
});

test("GithubAdapter.execute handles get_file with custom ref", async () => {
  const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
  await adapter.authenticate({ token: "ghp_test1234567890" });

  const result = await adapter.execute("get_file", {
    repository: "owner/repo",
    path: "src/index.ts",
    ref: "develop",
  });

  const output = result as Record<string, unknown>;
  const payload = output.payload as Record<string, unknown>;
  assert.equal(payload.path, "src/index.ts");
  assert.equal(payload.ref, "develop");
});

test("GithubAdapter.execute defaults ref to main for get_file", async () => {
  const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
  await adapter.authenticate({ token: "ghp_test1234567890" });

  const result = await adapter.execute("get_file", {
    repository: "owner/repo",
    path: "README.md",
  });

  const output = result as Record<string, unknown>;
  const payload = output.payload as Record<string, unknown>;
  assert.equal(payload.ref, "main");
});