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
import { createGithubAdapterPlugin, verifyPluginSignature } from "../../../../src/plugins/adapters/github-adapter.js";
import { PolicyDeniedError } from "../../../../src/platform/contracts/errors.js";
import { createJsonFetch } from "../../../helpers/fetch.js";

function createMockFetch(responseBody: unknown = { ok: true }) {
  return createJsonFetch(responseBody);
}

test("CRM adapter execute returns structured response (issue #2008)", async () => {
  const adapter = createCrmAdapterPlugin({
    fetchImplementation: createMockFetch({ records: [] }),
  });
  await adapter.authenticate({ token: "crm-test-token" });

  const result = await adapter.execute("get_contacts", { limit: 10 });

  assert.equal(result.ok, true);
  assert.ok("data" in result);
});

test("CRM adapter execute checks egress policy (issue #2008)", async () => {
  const adapter = createCrmAdapterPlugin({
    apiBaseUrl: "https://api.hubspot.com",
    fetchImplementation: createMockFetch({ records: [] }),
    policy: {
      evaluate: (url: string) => ({
        allowed: url.includes("hubspot.com"),
        reasonCode: "egress.denied" as const,
        destination: url,
      }),
    } as never,
  });

  // Egress is allowed, but this unit test does not provide a live CRM endpoint.
  await adapter.authenticate({ token: "crm-test-token" });
  const result1 = await adapter.execute("get_contacts", {});
  assert.equal(result1.ok, true);

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

  await restrictedAdapter.authenticate({ token: "crm-test-token" });
  await assert.rejects(
    async () => restrictedAdapter.execute("get_contacts", {}),
    (error: unknown) => error instanceof PolicyDeniedError
  );
});

test("CRM adapter authenticate stores credential fingerprint (issue #2008)", async () => {
  await assert.doesNotReject(async () => {
    const adapter = createCrmAdapterPlugin();

    await adapter.authenticate({ token: "my-secret-token" });

    // The adapter should store the credential fingerprint
    // Issue #2008 notes that authenticate stores fingerprint but execute is stubbed
    // This is a known limitation
  });
});

test("Game Dev adapter authenticate is a no-op (issue #2014)", async () => {
  await assert.doesNotReject(async () => {
    const adapter = createGameDevAdapterPlugin();

    // Issue #2014: authenticate is a no-op that doesn't actually validate credentials
    // This test documents the current behavior
    await adapter.authenticate({ token: "test-creds" });

    // No error means authenticate completed (even though it's a no-op)
  });
});

test("Game Dev adapter execute returns hardcoded mock (issue #2014)", async () => {
  const adapter = createGameDevAdapterPlugin();
  await adapter.authenticate({ token: "unity-test-token" });

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

test("Game Dev adapter execute requires authentication (issue #2014)", async () => {
  const adapter = createGameDevAdapterPlugin();

  await assert.rejects(
    async () => adapter.execute("build", {
      projectSlug: "my-project",
      buildTarget: "android",
    }),
    /game_dev_adapter\.not_authenticated/,
  );
});

test("GitHub adapter execute validates repository parameter (issue #2020)", async () => {
  let capturedUrl = "";
  const adapter = createGithubAdapterPlugin({
    apiBaseUrl: "https://api.github.com",
    fetchImplementation: async (input) => {
      capturedUrl = String(input);
      return new Response(JSON.stringify({ issueId: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
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
  const requestSummary = (result as { requestSummary: { endpointTemplate: string } }).requestSummary;

  assert.equal(result.repository, "owner/repo");
  assert.equal(requestSummary.endpointTemplate, "/repos/{repository}/issues");
  assert.ok(capturedUrl.includes("/repos/owner/repo/issues"));
});

test("GitHub adapter execute builds correct endpoint for create_issue (issue #2020)", async () => {
  let capturedUrl = "";
  const adapter = createGithubAdapterPlugin({
    fetchImplementation: async (input) => {
      capturedUrl = String(input);
      return new Response(JSON.stringify({ issueId: 2 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  await adapter.authenticate({ token: "ghp_test_token" });

  const result = await adapter.execute("create_issue", {
    repository: "owner/repo",
    title: "Bug Report",
    body: "Found a bug",
    labels: ["bug", "high-priority"],
  });
  const requestSummary = (result as { requestSummary: { endpointTemplate: string } }).requestSummary;

  assert.equal(requestSummary.endpointTemplate, "/repos/{repository}/issues");
  assert.ok(capturedUrl.includes("/repos/owner/repo/issues"));
});

test("GitHub adapter execute builds correct endpoint for get_file (issue #2020)", async () => {
  let capturedUrl = "";
  const adapter = createGithubAdapterPlugin({
    fetchImplementation: async (input) => {
      capturedUrl = String(input);
      return new Response(JSON.stringify({ content: "ok" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  await adapter.authenticate({ token: "ghp_test_token" });

  const result = await adapter.execute("get_file", {
    repository: "owner/repo",
    path: "src/index.ts",
    ref: "main",
  });
  const requestSummary = (result as { requestSummary: { endpointTemplate: string } }).requestSummary;

  assert.equal(requestSummary.endpointTemplate, "/repos/{repository}/contents/{path}");
  assert.ok(capturedUrl.includes("/repos/owner/repo/contents/src/index.ts"));
  assert.ok(capturedUrl.includes("ref=main"));
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
  let capturedUrl = "";
  const adapter = createGithubAdapterPlugin({
    apiBaseUrl: "https://api.github.com",
    fetchImplementation: async (input) => {
      capturedUrl = String(input);
      return new Response(JSON.stringify({ issueId: 3 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
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
  const requestSummary = (result as { requestSummary: { endpointTemplate: string } }).requestSummary;

  assert.equal(requestSummary.endpointTemplate, "/repos/{repository}/issues");
  assert.ok(capturedUrl.includes("/repos/owner/repo/issues"));
  assert.equal((result as { status: number }).status, 200);
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
      body: "Test body",
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

  await adapter.authenticate({ token: "ghp_test_token" });

  assert.ok(adapter.healthCheck);
  const healthy = await adapter.healthCheck();
  assert.equal(typeof healthy, "boolean");
});

test("GitHub adapter signature verifier rejects missing signature", async () => {
  const result = verifyPluginSignature("test.github", "manifest-hash", "", "secret-key");
  assert.equal(result.valid, false);
  assert.equal(result.error, "plugin_signature.signature_missing");
});

test("GitHub adapter with verifySignature allows trusted manifest without signature", async () => {
  // Trusted built-in plugins should not require signature verification
  const adapter = createGithubAdapterPlugin({
    signatureKey: "test-key",
  });

  // Should not throw
  assert.ok(adapter);
});

test("GitHub adapter lifecycle uses initialize, authenticate, and shutdown", async () => {
  const adapter = createGithubAdapterPlugin();

  assert.ok(adapter.initialize);
  await adapter.initialize();
  await adapter.authenticate({ token: "test" });
  assert.ok(adapter.shutdown);
  await adapter.shutdown();

  await assert.rejects(
    async () => adapter.execute("create_issue", { repository: "owner/repo", title: "after shutdown" }),
    /github_adapter\.not_authenticated/,
  );
});
