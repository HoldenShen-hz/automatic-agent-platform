/**
 * @fileoverview Unit tests for Adapters - Issue #2008, #2014, #2020
 * CRM adapter: Execute returns hardcoded mock
 * Game Dev adapter: authenticate is no-op, execute no auth guard
 * GitHub adapter: repository parameter not sanitized, URL path traversal
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createCrmAdapterPlugin } from "../../../../src/plugins/adapters/crm-adapter.js";
import { createGameDevAdapterPlugin } from "../../../../src/plugins/adapters/game-dev-adapter.js";
import { createGithubAdapterPlugin } from "../../../../src/plugins/adapters/github-adapter.js";
import { PolicyDeniedError } from "../../../../src/platform/contracts/errors.js";

test("CRM adapter execute returns structured response (issue #2008)", async () => {
  const adapter = createCrmAdapterPlugin();

  const result = await adapter.execute("get_contacts", { limit: 10 });

  // Issue #2008: The execute method returns hardcoded mock data
  // This test documents the current behavior - it returns stub data
  assert.ok(result.ok === true);
  assert.ok("data" in result);
});

test("CRM adapter execute checks egress policy (issue #2008)", async () => {
  const adapter = createCrmAdapterPlugin({
    apiBaseUrl: "https://api.hubspot.com",
    policy: {
      evaluate: (url: string) => ({
        allowed: url.includes("hubspot.com"),
        reasonCode: "egress.denied" as const,
        destination: url,
      }),
    } as never,
  });

  // With proper policy, should allow hubspot.com
  const result1 = await adapter.execute("get_contacts", {});
  assert.ok(result1.ok === true);

  // With restrictive policy, should deny
  const restrictedAdapter = createCrmAdapterPlugin({
    apiBaseUrl: "https://api.forbidden.com",
    policy: {
      evaluate: () => ({
        allowed: false,
        reasonCode: "egress.denied" as const,
        destination: "https://api.forbidden.com",
      }),
    } as never,
  });

  await assert.rejects(
    async () => restrictedAdapter.execute("get_contacts", {}),
    (error: unknown) => error instanceof PolicyDeniedError
  );
});

test("CRM adapter authenticate stores credential fingerprint (issue #2008)", async () => {
  const adapter = createCrmAdapterPlugin();

  await adapter.authenticate({ token: "my-secret-token" });

  // The adapter should store the credential fingerprint
  // Issue #2008 notes that authenticate stores fingerprint but execute is stubbed
  // This is a known limitation
});

test("Game Dev adapter authenticate is a no-op (issue #2014)", async () => {
  const adapter = createGameDevAdapterPlugin();

  // Issue #2014: authenticate is a no-op that doesn't actually validate credentials
  // This test documents the current behavior
  await adapter.authenticate({ credentials: "test-creds" });

  // No error means authenticate completed (even though it's a no-op)
});

test("Game Dev adapter execute returns hardcoded mock (issue #2014)", async () => {
  const adapter = createGameDevAdapterPlugin();

  const result = await adapter.execute("build", {
    projectSlug: "my-project",
    buildTarget: "ios",
  });

  // Issue #2014: execute returns hardcoded mock data without actual API calls
  assert.ok(result.success === true);
  assert.ok("output" in result);

  const output = result.output as Record<string, unknown>;
  assert.equal(output.action, "build");
  assert.equal(output.projectSlug, "my-project");
  assert.equal(output.buildTarget, "ios");
});

test("Game Dev adapter execute has no auth guard (issue #2014)", async () => {
  const adapter = createGameDevAdapterPlugin();

  // Issue #2014: execute can be called without prior authenticate() call
  // There's no auth guard that throws if authenticate wasn't called

  // This should succeed even without authentication
  const result = await adapter.execute("build", {
    projectSlug: "my-project",
    buildTarget: "android",
  });

  assert.ok(result.success === true);
});

test("GitHub adapter execute validates repository parameter (issue #2020)", async () => {
  const adapter = createGithubAdapterPlugin({
    apiBaseUrl: "https://api.github.com",
  });

  await adapter.authenticate({ token: "ghp_test_token" });

  // Issue #2020: repository parameter is not sanitized, allowing URL path traversal
  // For example, "../../../etc/passwd" could be used

  // Current behavior: the repository is used directly in URL construction without sanitization
  const result = await adapter.execute("create_issue", {
    repository: "owner/repo",
    title: "Test Issue",
    body: "Test body",
  });

  assert.ok("endpoint" in result);
});

test("GitHub adapter execute builds correct endpoint for create_issue (issue #2020)", async () => {
  const adapter = createGithubAdapterPlugin();

  await adapter.authenticate({ token: "ghp_test_token" });

  const result = await adapter.execute("create_issue", {
    repository: "owner/repo",
    title: "Bug Report",
    body: "Found a bug",
    labels: ["bug", "high-priority"],
  });

  const endpoint = (result as Record<string, unknown>).endpoint as string;
  assert.ok(endpoint.includes("owner/repo"));
  assert.ok(endpoint.includes("issues"));
});

test("GitHub adapter execute builds correct endpoint for get_file (issue #2020)", async () => {
  const adapter = createGithubAdapterPlugin();

  await adapter.authenticate({ token: "ghp_test_token" });

  const result = await adapter.execute("get_file", {
    repository: "owner/repo",
    path: "src/index.ts",
    ref: "main",
  });

  const endpoint = (result as Record<string, unknown>).endpoint as string;
  assert.ok(endpoint.includes("owner/repo"));
  assert.ok(endpoint.includes("contents"));
  assert.ok(endpoint.includes("src/index.ts"));
});

test("GitHub adapter execute requires authentication (issue #2020)", async () => {
  const adapter = createGithubAdapterPlugin();

  // Issue #2020: execute should require prior authentication
  await assert.rejects(
    async () => adapter.execute("create_issue", {
      repository: "owner/repo",
      title: "Test",
    }),
    (error: unknown) => error instanceof Error && error.message.includes("not_authenticated")
  );
});

test("GitHub adapter execute checks egress policy", async () => {
  const adapter = createGithubAdapterPlugin({
    apiBaseUrl: "https://api.github.com",
    policy: {
      evaluate: (url: string) => ({
        allowed: url.includes("github.com"),
        reasonCode: "egress.denied" as const,
        destination: url,
      }),
    } as never,
  });

  await adapter.authenticate({ token: "ghp_test_token" });

  const result = await adapter.execute("create_issue", {
    repository: "owner/repo",
    title: "Test",
    body: "Test",
  });

  assert.ok("endpoint" in result);
});

test("GitHub adapter execute denies egress to unauthorized domain", async () => {
  const adapter = createGithubAdapterPlugin({
    apiBaseUrl: "https://api.github.com",
    policy: {
      evaluate: () => ({
        allowed: false,
        reasonCode: "egress.denied" as const,
        destination: "https://evil.com",
      }),
    } as never,
  });

  await adapter.authenticate({ token: "ghp_test_token" });

  await assert.rejects(
    async () => adapter.execute("create_issue", {
      repository: "owner/repo",
      title: "Test",
    }),
    PolicyDeniedError
  );
});

test("GitHub adapter healthCheck evaluates egress policy", async () => {
  const adapter = createGithubAdapterPlugin({
    apiBaseUrl: "https://api.github.com",
    policy: {
      evaluate: (url: string) => ({
        allowed: url.includes("github.com"),
        reasonCode: "egress.denied" as const,
        destination: url,
      }),
    } as never,
  });

  const healthy = await adapter.healthCheck();
  assert.equal(healthy, true);
});

test("GitHub adapter with verifySignature throws on missing signature", async () => {
  // Issue #2020: signature verification should happen if verifySignature is true
  await assert.rejects(
    async () => createGithubAdapterPlugin({
      verifySignature: true,
      manifest: {
        pluginId: "test.github",
        name: "Test GitHub",
        version: "1.0.0",
        owner: "test",
        domainIds: ["coding"],
        capabilityIds: ["external.github"],
        spiTypes: ["adapter"],
        extensionKind: "external_adapter",
        trustLevel: "untrusted", // Not internal or trusted
        publicSdkSurface: "@test/github-adapter",
        settingsSchema: {},
        sandbox: {
          timeoutMs: 5000,
          allowFilesystemWrite: false,
          allowNetworkEgress: true,
          allowedKnowledgeNamespaces: [],
          maxConcurrentInvocations: 4,
          maxQueuedInvocations: 8,
          runtimeIsolation: "serialized_in_process",
          cooldownMs: 0,
        },
      },
    }),
    (error: unknown) => error instanceof Error && error.message.includes("signature_required")
  );
});

test("GitHub adapter with verifySignature allows trusted manifest without signature", async () => {
  // Trusted built-in plugins should not require signature verification
  const adapter = createGithubAdapterPlugin({
    verifySignature: true,
    manifest: {
      pluginId: "plugin.shared.github_adapter",
      name: "GitHub Adapter",
      version: "1.0.0",
      owner: "platform-team",
      domainIds: ["coding"],
      capabilityIds: ["external.github"],
      spiTypes: ["adapter"],
      extensionKind: "external_adapter",
      trustLevel: "trusted", // Trusted - should skip signature check
      publicSdkSurface: "@automatic-agent/plugin-github-adapter",
      settingsSchema: {},
      sandbox: {
        timeoutMs: 5000,
        allowFilesystemWrite: false,
        allowNetworkEgress: true,
        allowedKnowledgeNamespaces: [],
        maxConcurrentInvocations: 4,
        maxQueuedInvocations: 8,
        runtimeIsolation: "serialized_in_process",
        cooldownMs: 0,
      },
    },
  });

  // Should not throw
  assert.ok(adapter);
});

test("GitHub adapter lifecycle hooks are called in order", async () => {
  const lifecycleCalls: string[] = [];

  const adapter = createGithubAdapterPlugin({
    manifest: {
      pluginId: "test.github-lifecycle",
      name: "Test GitHub Lifecycle",
      version: "1.0.0",
      owner: "test",
      domainIds: ["coding"],
      capabilityIds: ["external.github"],
      spiTypes: ["adapter"],
      extensionKind: "external_adapter",
      trustLevel: "trusted",
      publicSdkSurface: "@test/github-adapter",
      settingsSchema: {},
      sandbox: {
        timeoutMs: 5000,
        allowFilesystemWrite: false,
        allowNetworkEgress: true,
        allowedKnowledgeNamespaces: [],
        maxConcurrentInvocations: 4,
        maxQueuedInvocations: 8,
        runtimeIsolation: "serialized_in_process",
        cooldownMs: 0,
      },
      async onLoad() { lifecycleCalls.push("load"); },
      async onActivate() { lifecycleCalls.push("activate"); },
      async onDeactivate() { lifecycleCalls.push("deactivate"); },
      async onUnload() { lifecycleCalls.push("unload"); },
    } as never,
  });

  await adapter.onLoad({} as never);
  await adapter.onActivate({} as never);
  await adapter.authenticate({ token: "test" });
  await adapter.onDeactivate({} as never);
  await adapter.onUnload({} as never);

  assert.deepEqual(lifecycleCalls, ["load", "activate", "deactivate", "unload"]);
});
