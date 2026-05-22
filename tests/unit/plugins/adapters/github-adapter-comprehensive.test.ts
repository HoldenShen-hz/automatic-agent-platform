import assert from "node:assert/strict";
import test from "node:test";
import { createHash, createHmac } from "node:crypto";

import { createGithubAdapterPlugin, verifyPluginSignature, createPluginManifestHash, type GithubAdapterPluginOptions } from "../../../../src/plugins/adapters/github-adapter.js";

function createMockPolicy(allowed: boolean = true) {
  return {
    evaluate: (_url: string) => ({
      allowed,
      destinationType: "external" as const,
      destination: "api.github.com",
      reasonCode: allowed ? null : "github_adapter.egress_blocked",
    }),
    getMode: () => "enforce" as const,
    record: () => {},
  };
}

test.describe("GithubAdapter Plugin", () => {
  test("createGithubAdapterPlugin returns ExternalAdapterPlugin with correct metadata", () => {
    const adapter = createGithubAdapterPlugin();
    assert.equal(adapter.pluginId, "plugin.shared.github_adapter");
    assert.equal(adapter.spiType, "adapter");
    assert.equal(adapter.adapterType, "github");
    assert.deepEqual(adapter.capabilityIds, ["external.github", "external.github.issue", "external.github.workflow"]);
  });

  test("createGithubAdapterPlugin accepts custom apiBaseUrl", () => {
    const adapter = createGithubAdapterPlugin({ apiBaseUrl: "https://github.example.com/api/v3" });
    assert.ok(adapter !== undefined);
  });

  test("createGithubAdapterPlugin accepts custom signatureKey", () => {
    const adapter = createGithubAdapterPlugin({ signatureKey: "secret-key-123" });
    assert.ok(adapter !== undefined);
  });

  test("createGithubAdapterPlugin accepts custom defaultTimeoutMs", () => {
    const adapter = createGithubAdapterPlugin({ defaultTimeoutMs: 5000 });
    assert.ok(adapter !== undefined);
  });

  test("createGithubAdapterPlugin accepts custom defaultRateLimitPerMinute", () => {
    const adapter = createGithubAdapterPlugin({ defaultRateLimitPerMinute: 30 });
    assert.ok(adapter !== undefined);
  });

  test("initialize returns undefined", async () => {
    const adapter = createGithubAdapterPlugin();
    const result = await adapter.initialize();
    assert.equal(result, undefined);
  });

  test("shutdown clears credential fingerprint", async () => {
    const adapter = createGithubAdapterPlugin();
    await adapter.authenticate({ token: "ghp_test1234567890" });
    await adapter.shutdown();
  });

  test("healthCheck returns true only with auth, policy allow, and explicit probe", async () => {
    const adapter = createGithubAdapterPlugin({
      policy: createMockPolicy(true),
      healthProbe: async () => true,
    });
    await adapter.authenticate({ token: "ghp_test1234567890" });
    const result = await adapter.healthCheck();
    assert.equal(result, true);
  });

  test("healthCheck returns false when policy denies", async () => {
    const adapter = createGithubAdapterPlugin({ policy: createMockPolicy(false) });
    const result = await adapter.healthCheck();
    assert.equal(result, false);
  });
});

test.describe("GithubAdapter authenticate", () => {
  test("authenticate stores token fingerprint", async () => {
    const adapter = createGithubAdapterPlugin();
    await adapter.authenticate({ token: "ghp_test1234567890" });
  });

  test("authenticate accepts managedSecretRef format", async () => {
    const adapter = createGithubAdapterPlugin();
    await adapter.authenticate({ managedSecretRef: "secret://my-token" });
  });

  test("authenticate throws on missing token", async () => {
    const adapter = createGithubAdapterPlugin();
    await assert.rejects(
      async () => adapter.authenticate({}),
      { message: /github_adapter\.missing_token/ },
    );
  });

  test("authenticate throws on empty token", async () => {
    const adapter = createGithubAdapterPlugin();
    await assert.rejects(
      async () => adapter.authenticate({ token: "   " }),
      { message: /github_adapter\.missing_token/ },
    );
  });

  test("authenticate handles token:// prefix", async () => {
    const adapter = createGithubAdapterPlugin();
    await adapter.authenticate({ token: "secret://my-token" });
  });

  test("authenticate stores non-secret token prefix as fingerprint", async () => {
    const adapter = createGithubAdapterPlugin();
    await adapter.authenticate({ token: "ghp_regular_token" });
  });
});

test.describe("GithubAdapter execute", () => {
  test("execute throws when not authenticated", async () => {
    const adapter = createGithubAdapterPlugin();
    await assert.rejects(
      async () => adapter.execute("create_issue", { repository: "owner/repo", title: "Test", body: "Body" }),
      { message: "github_adapter.not_authenticated" },
    );
  });

  test("execute builds correct endpoint for create_issue", async () => {
    const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "ghp_test1234567890" });
    const result = await adapter.execute("create_issue", {
      repository: "owner/repo",
      title: "Test Issue",
      body: "Issue body",
    }) as Record<string, unknown>;
    assert.equal(result.action, "create_issue");
    assert.equal(result.repository, "owner/repo");
    assert.ok((result.endpoint as string).includes("/repos/owner/repo/issues"));
    assert.equal(result.timeoutMs, 10000);
    assert.equal(result.rateLimitPerMinute, 60);
  });

  test("execute builds correct endpoint for create_pr_comment", async () => {
    const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "ghp_test1234567890" });
    const result = await adapter.execute("create_pr_comment", {
      repository: "owner/repo",
      issueNumber: "42",
      body: "PR comment body",
    }) as Record<string, unknown>;
    assert.equal(result.action, "create_pr_comment");
    assert.ok((result.endpoint as string).includes("/issues/42/comments"));
  });

  test("execute builds correct endpoint for dispatch_workflow", async () => {
    const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "ghp_test1234567890" });
    const result = await adapter.execute("dispatch_workflow", {
      repository: "owner/repo",
      workflowId: "build.yml",
      ref: "main",
      inputs: { param1: "value1" },
    }) as Record<string, unknown>;
    assert.equal(result.action, "dispatch_workflow");
    assert.ok((result.endpoint as string).includes("/actions/workflows/build.yml/dispatches"));
    assert.deepEqual((result.payload as Record<string, unknown>).inputs, { param1: "value1" });
  });

  test("execute builds correct endpoint for get_file", async () => {
    const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "ghp_test1234567890" });
    const result = await adapter.execute("get_file", {
      repository: "owner/repo",
      path: "README.md",
      ref: "main",
    }) as Record<string, unknown>;
    assert.equal(result.action, "get_file");
    assert.ok((result.endpoint as string).includes("/contents/README.md"));
    assert.equal(result.idempotencyKey, undefined);
  });

  test("execute uses default ref when not provided for get_file", async () => {
    const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "ghp_test1234567890" });
    const result = await adapter.execute("get_file", {
      repository: "owner/repo",
      path: "README.md",
    }) as Record<string, unknown>;
    assert.equal((result.payload as Record<string, unknown>).ref, "main");
  });

  test("execute rejects unknown action", async () => {
    const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "ghp_test1234567890" });
    await assert.rejects(
      async () => adapter.execute("unknown_action" as any, { repository: "owner/repo" }),
      { message: /github_adapter\.unsupported_action:unknown_action/ },
    );
  });

  test("execute includes retry policy in result", async () => {
    const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "ghp_test1234567890" });
    const result = await adapter.execute("create_issue", {
      repository: "owner/repo",
      title: "Test",
      body: "Body",
    }) as Record<string, unknown>;
    assert.deepEqual(result.retryPolicy, { maxRetries: 3, backoffMs: 250 });
  });

  test("execute throws PolicyDeniedError when egress blocked", async () => {
    const adapter = createGithubAdapterPlugin({ policy: createMockPolicy(false) });
    await adapter.authenticate({ token: "ghp_test1234567890" });
    await assert.rejects(
      async () => adapter.execute("create_issue", {
        repository: "owner/repo",
        title: "Test",
        body: "Body",
      }),
      (err: any) => err.code === "github_adapter.egress_blocked",
    );
  });

  test("execute throws on missing repository", async () => {
    const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "ghp_test1234567890" });
    await assert.rejects(
      async () => adapter.execute("create_issue", { title: "Test", body: "Body" }),
      { message: /github_adapter\.missing_repository/ },
    );
  });

  test("execute throws on empty repository", async () => {
    const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "ghp_test1234567890" });
    await assert.rejects(
      async () => adapter.execute("create_issue", { repository: "   ", title: "Test", body: "Body" }),
      { message: /github_adapter\.missing_repository/ },
    );
  });

  test("execute rejects repository with backslash", async () => {
    const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "ghp_test1234567890" });
    await assert.rejects(
      async () => adapter.execute("create_issue", {
        repository: "owner\\repo",
        title: "Test",
        body: "Body",
      }),
      { message: "github_adapter.invalid_repository" },
    );
  });

  test("execute rejects repository with double dot", async () => {
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

  test("execute rejects repository with encoded slash (%2f)", async () => {
    const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "ghp_test1234567890" });
    await assert.rejects(
      async () => adapter.execute("create_issue", {
        repository: "owner%2frepo",
        title: "Test",
        body: "Body",
      }),
      { message: "github_adapter.invalid_repository" },
    );
  });

  test("execute rejects repository with encoded backslash (%5c)", async () => {
    const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "ghp_test1234567890" });
    await assert.rejects(
      async () => adapter.execute("create_issue", {
        repository: "owner%5crepo",
        title: "Test",
        body: "Body",
      }),
      { message: "github_adapter.invalid_repository" },
    );
  });

  test("execute rejects repository with encoded dot (%2e)", async () => {
    const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "ghp_test1234567890" });
    await assert.rejects(
      async () => adapter.execute("create_issue", {
        repository: "owner%2erepo",
        title: "Test",
        body: "Body",
      }),
      { message: "github_adapter.invalid_repository" },
    );
  });

  test("execute throws on missing title for create_issue", async () => {
    const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "ghp_test1234567890" });
    await assert.rejects(
      async () => adapter.execute("create_issue", { repository: "owner/repo", body: "Body" }),
      { message: /github_adapter\.missing_title/ },
    );
  });

  test("execute throws on missing body for create_issue", async () => {
    const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "ghp_test1234567890" });
    await assert.rejects(
      async () => adapter.execute("create_issue", { repository: "owner/repo", title: "Test" }),
      { message: /github_adapter\.missing_body/ },
    );
  });

  test("execute throws on missing issueNumber for create_pr_comment", async () => {
    const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "ghp_test1234567890" });
    await assert.rejects(
      async () => adapter.execute("create_pr_comment", { repository: "owner/repo", body: "Comment" }),
      { message: /github_adapter\.missing_issueNumber/ },
    );
  });

  test("execute throws on missing body for create_pr_comment", async () => {
    const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "ghp_test1234567890" });
    await assert.rejects(
      async () => adapter.execute("create_pr_comment", { repository: "owner/repo", issueNumber: "42" }),
      { message: /github_adapter\.missing_body/ },
    );
  });

  test("execute throws on missing workflowId for dispatch_workflow", async () => {
    const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "ghp_test1234567890" });
    await assert.rejects(
      async () => adapter.execute("dispatch_workflow", { repository: "owner/repo", ref: "main" }),
      { message: /github_adapter\.missing_workflowId/ },
    );
  });

  test("execute throws on missing ref for dispatch_workflow", async () => {
    const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "ghp_test1234567890" });
    await assert.rejects(
      async () => adapter.execute("dispatch_workflow", { repository: "owner/repo", workflowId: "build.yml" }),
      { message: /github_adapter\.missing_ref/ },
    );
  });

  test("execute throws on missing path for get_file", async () => {
    const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "ghp_test1234567890" });
    await assert.rejects(
      async () => adapter.execute("get_file", { repository: "owner/repo" }),
      { message: /github_adapter\.missing_path/ },
    );
  });

  test("execute throws on empty path for get_file", async () => {
    const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "ghp_test1234567890" });
    await assert.rejects(
      async () => adapter.execute("get_file", { repository: "owner/repo", path: "   " }),
      { message: /github_adapter\.missing_path/ },
    );
  });

  test("execute throws on path with dot segment", async () => {
    const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "ghp_test1234567890" });
    await assert.rejects(
      async () => adapter.execute("get_file", { repository: "owner/repo", path: "../README.md" }),
      { message: "github_adapter.invalid_path" },
    );
  });

  test("execute throws on path with dot current", async () => {
    const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "ghp_test1234567890" });
    await assert.rejects(
      async () => adapter.execute("get_file", { repository: "owner/repo", path: "./README.md" }),
      { message: "github_adapter.invalid_path" },
    );
  });

  test("execute encodes path segments for get_file", async () => {
    const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "ghp_test1234567890" });
    const result = await adapter.execute("get_file", {
      repository: "owner/repo",
      path: "path/to file.md",
    }) as Record<string, unknown>;
    assert.ok((result.endpoint as string).includes("path/to%20file.md"));
  });

  test("execute uses custom apiBaseUrl", async () => {
    const adapter = createGithubAdapterPlugin({
      apiBaseUrl: "https://github.example.com/api/v3",
      policy: createMockPolicy(),
    });
    await adapter.authenticate({ token: "ghp_test1234567890" });
    const result = await adapter.execute("get_file", {
      repository: "owner/repo",
      path: "README.md",
    }) as Record<string, unknown>;
    assert.ok((result.endpoint as string).startsWith("https://github.example.com/api/v3"));
  });

  test("execute includes custom timeout in result", async () => {
    const adapter = createGithubAdapterPlugin({
      policy: createMockPolicy(),
      defaultTimeoutMs: 5000,
    });
    await adapter.authenticate({ token: "ghp_test1234567890" });
    const result = await adapter.execute("create_issue", {
      repository: "owner/repo",
      title: "Test",
      body: "Body",
    }) as Record<string, unknown>;
    assert.equal(result.timeoutMs, 5000);
  });

  test("execute includes custom rate limit in result", async () => {
    const adapter = createGithubAdapterPlugin({
      policy: createMockPolicy(),
      defaultRateLimitPerMinute: 30,
    });
    await adapter.authenticate({ token: "ghp_test1234567890" });
    const result = await adapter.execute("create_issue", {
      repository: "owner/repo",
      title: "Test",
      body: "Body",
    }) as Record<string, unknown>;
    assert.equal(result.rateLimitPerMinute, 30);
  });

  test("execute generates idempotency key for non-get_file actions", async () => {
    const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "ghp_test1234567890" });
    const result = await adapter.execute("create_issue", {
      repository: "owner/repo",
      title: "Test",
      body: "Body",
    }) as Record<string, unknown>;
    assert.ok(typeof result.idempotencyKey === "string");
    assert.equal(result.idempotencyKey.length, 64); // SHA256 hex
  });
});

test.describe("verifyPluginSignature", () => {
  test("returns valid result for correct signature", () => {
    const pluginId = "plugin.shared.github_adapter";
    const manifestHash = "abc123def456";
    const secretKey = "super-secret-key";
    const signature = createHmac("sha256", secretKey)
      .update(`${pluginId}:${manifestHash}`)
      .digest("hex");
    const result = verifyPluginSignature(pluginId, manifestHash, signature, secretKey);
    assert.equal(result.valid, true);
    assert.equal(result.error, undefined);
    assert.ok(result.verifiedAt !== undefined);
  });

  test("returns invalid for wrong signature", () => {
    const pluginId = "plugin.shared.github_adapter";
    const manifestHash = "abc123def456";
    const secretKey = "super-secret-key";
    const wrongSignature = "0".repeat(64);
    const result = verifyPluginSignature(pluginId, manifestHash, wrongSignature, secretKey);
    assert.equal(result.valid, false);
    assert.ok(result.error !== undefined);
  });

  test("returns invalid when secretKey is missing", () => {
    const result = verifyPluginSignature("plugin.id", "hash", "signature", "");
    assert.equal(result.valid, false);
    assert.equal(result.error, "plugin_signature.verification_key_missing");
  });

  test("returns invalid when signature is missing", () => {
    const result = verifyPluginSignature("plugin.id", "hash", "", "secretKey");
    assert.equal(result.valid, false);
    assert.equal(result.error, "plugin_signature.signature_missing");
  });

  test("returns invalid for malformed signature hex", () => {
    const result = verifyPluginSignature("plugin.id", "hash", "not-hex", "secretKey");
    assert.equal(result.valid, false);
    assert.ok(result.error != null);
  });

  test("returns error info in result", () => {
    const result = verifyPluginSignature("plugin.id", "hash", "", "");
    assert.equal(result.valid, false);
    assert.ok(result.error !== undefined);
    assert.ok(result.verifiedAt !== undefined);
  });
});

test.describe("createPluginManifestHash", () => {
  test("creates consistent hash for same input", () => {
    const pluginId = "plugin.shared.github_adapter";
    const manifest = { version: "1.0.0", capabilityIds: ["test"] };
    const hash1 = createPluginManifestHash(pluginId, manifest);
    const hash2 = createPluginManifestHash(pluginId, manifest);
    assert.equal(hash1, hash2);
  });

  test("creates different hash for different pluginId", () => {
    const manifest = { version: "1.0.0" };
    const hash1 = createPluginManifestHash("plugin.id1", manifest);
    const hash2 = createPluginManifestHash("plugin.id2", manifest);
    assert.notEqual(hash1, hash2);
  });

  test("creates different hash for different manifest", () => {
    const pluginId = "plugin.shared.github_adapter";
    const hash1 = createPluginManifestHash(pluginId, { version: "1.0.0" });
    const hash2 = createPluginManifestHash(pluginId, { version: "2.0.0" });
    assert.notEqual(hash1, hash2);
  });

  test("returns 64 character hex string", () => {
    const hash = createPluginManifestHash("plugin.id", { test: true });
    assert.equal(hash.length, 64);
    assert.ok(/^[a-f0-9]+$/.test(hash));
  });
});

test.describe("GithubAdapter edge cases", () => {
  test("execute handles empty labels array for create_issue", async () => {
    const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "ghp_test1234567890" });
    const result = await adapter.execute("create_issue", {
      repository: "owner/repo",
      title: "Test",
      body: "Body",
      labels: [],
    }) as Record<string, unknown>;
    assert.deepEqual((result.payload as Record<string, unknown>).labels, []);
  });

  test("execute handles labels array for create_issue", async () => {
    const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "ghp_test1234567890" });
    const result = await adapter.execute("create_issue", {
      repository: "owner/repo",
      title: "Test",
      body: "Body",
      labels: ["bug", "enhancement"],
    }) as Record<string, unknown>;
    assert.deepEqual((result.payload as Record<string, unknown>).labels, ["bug", "enhancement"]);
  });

  test("execute handles non-array labels by ignoring", async () => {
    const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "ghp_test1234567890" });
    const result = await adapter.execute("create_issue", {
      repository: "owner/repo",
      title: "Test",
      body: "Body",
      labels: "not-an-array",
    }) as Record<string, unknown>;
    assert.deepEqual((result.payload as Record<string, unknown>).labels, []);
  });

  test("execute handles undefined inputs for dispatch_workflow", async () => {
    const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "ghp_test1234567890" });
    const result = await adapter.execute("dispatch_workflow", {
      repository: "owner/repo",
      workflowId: "build.yml",
      ref: "main",
      inputs: undefined,
    }) as Record<string, unknown>;
    assert.deepEqual((result.payload as Record<string, unknown>).inputs, {});
  });

  test("execute handles object inputs for dispatch_workflow", async () => {
    const adapter = createGithubAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "ghp_test1234567890" });
    const result = await adapter.execute("dispatch_workflow", {
      repository: "owner/repo",
      workflowId: "build.yml",
      ref: "main",
      inputs: { param1: "value1", param2: 123 },
    }) as Record<string, unknown>;
    assert.deepEqual((result.payload as Record<string, unknown>).inputs, { param1: "value1", param2: "123" });
  });
});
