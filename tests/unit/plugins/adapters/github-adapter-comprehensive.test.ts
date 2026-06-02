import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import {
  createGithubAdapterPlugin,
  createPluginManifestHash,
  verifyPluginSignature,
} from "../../../../src/plugins/adapters/github-adapter.js";
import { NetworkEgressPolicyService } from "../../../../src/platform/five-plane-control-plane/iam/network-egress-policy.js";

type GithubExecutionEnvelope = Awaited<ReturnType<ReturnType<typeof createGithubAdapterPlugin>["execute"]>> & {
  requestSummary: {
    endpointHost: string;
    endpointTemplate: string;
    payloadKeys: string[];
  };
};

function createMockFetch(responseBody: unknown = { ok: true }) {
  return async (_input: string | URL, _init?: RequestInit) => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    text: async () => JSON.stringify(responseBody),
  }) as Response;
}

function createPolicy(allowedDomains: readonly string[] = ["api.github.com", "github.com"]) {
  return new NetworkEgressPolicyService({
    mode: "enforce",
    allowedDomains,
  });
}

test("github adapter exposes current metadata and lifecycle behavior", async () => {
  const adapter = createGithubAdapterPlugin({
    policy: createPolicy(),
    healthProbe: async () => true,
  });

  assert.equal(adapter.pluginId, "plugin.shared.github_adapter");
  assert.equal(adapter.adapterType, "github");
  assert.deepEqual(adapter.capabilityIds, [
    "external.github",
    "external.github.issue",
    "external.github.workflow",
  ]);
  assert.equal(await adapter.initialize?.(), undefined);
  assert.equal(await adapter.healthCheck?.(), false);

  await adapter.authenticate({ token: "ghp_test1234567890" });
  assert.equal(await adapter.healthCheck?.(), true);
  await adapter.shutdown?.();
});

test("github adapter execute returns current endpoint, payload, and idempotency contract", async () => {
  const adapter = createGithubAdapterPlugin({
    policy: createPolicy(),
    defaultTimeoutMs: 5000,
    defaultRateLimitPerMinute: 30,
    fetchImplementation: createMockFetch({ issueId: 1 }),
  });
  await adapter.authenticate({ token: "ghp_test1234567890" });

  const issue = await adapter.execute("create_issue", {
    repository: "owner/repo",
    title: "Test Issue",
    body: "Issue body",
    labels: ["bug"],
  }) as GithubExecutionEnvelope;
  const file = await adapter.execute("get_file", {
    repository: "owner/repo",
    path: "README.md",
  }) as GithubExecutionEnvelope;

  assert.equal(issue.action, "create_issue");
  assert.deepEqual(issue.requestSummary, {
    endpointHost: "api.github.com",
    endpointTemplate: "/repos/{repository}/issues",
    payloadKeys: ["body", "labels", "title"],
  });
  assert.equal(issue.status, 200);
  assert.deepEqual(issue.data, { issueId: 1 });
  assert.equal(issue.timeoutMs, 5000);
  assert.equal(issue.rateLimitPerMinute, 30);
  assert.equal(typeof issue.idempotencyKey, "string");
  assert.equal(file.action, "get_file");
  assert.deepEqual(file.requestSummary, {
    endpointHost: "api.github.com",
    endpointTemplate: "/repos/{repository}/contents/{path}",
    payloadKeys: [],
  });
  assert.equal("idempotencyKey" in file, false);
});

test("github adapter execute sanitizes workflow inputs and enforces repository validation", async () => {
  const adapter = createGithubAdapterPlugin({
    policy: createPolicy(),
    fetchImplementation: createMockFetch({ workflow: "queued" }),
  });
  await adapter.authenticate({ token: "ghp_test1234567890" });

  const workflow = await adapter.execute("dispatch_workflow", {
    repository: "owner/repo",
    workflowId: "build.yml",
    ref: "main",
    inputs: {
      environment: "prod",
      retries: 3,
      dryRun: false,
      nullable: null,
    },
  }) as GithubExecutionEnvelope;

  assert.deepEqual(workflow.requestSummary, {
    endpointHost: "api.github.com",
    endpointTemplate: "/repos/{repository}/actions/workflows/{workflowId}/dispatches",
    payloadKeys: ["inputs", "ref"],
  });

  await assert.rejects(
    () => adapter.execute("create_issue", {
      repository: "owner/../repo",
      title: "Test",
      body: "Body",
    }),
    /github_adapter\.invalid_repository/,
  );
  await assert.rejects(
    () => adapter.execute("dispatch_workflow", {
      repository: "owner/repo",
      workflowId: "build.yml",
      ref: "main",
      inputs: { bad: { nested: true } },
    }),
    /github_adapter\.invalid_workflow_inputs/,
  );
});

test("github adapter rejects unauthenticated, policy-denied, and unsupported actions", async () => {
  const unauthenticated = createGithubAdapterPlugin({ policy: createPolicy() });
  await assert.rejects(
    () => unauthenticated.execute("create_issue", { repository: "owner/repo", title: "A", body: "B" }),
    /github_adapter\.not_authenticated/,
  );

  const denied = createGithubAdapterPlugin({
    policy: createPolicy(["example.com"]),
    fetchImplementation: createMockFetch(),
  });
  await denied.authenticate({ token: "ghp_test1234567890" });
  await assert.rejects(
    () => denied.execute("create_issue", {
      repository: "owner/repo",
      title: "A",
      body: "B",
    }),
    /Network egress denied/,
  );

  const unsupported = createGithubAdapterPlugin({ policy: createPolicy() });
  await unsupported.authenticate({ token: "ghp_test1234567890" });
  await assert.rejects(
    () => unsupported.execute("unknown_action", { repository: "owner/repo" }),
    /github_adapter\.unsupported_action:unknown_action/,
  );

  const restricted = {
    ...createGithubAdapterPlugin({ policy: createPolicy(), fetchImplementation: createMockFetch() }),
    capabilityIds: ["external.github"],
  };
  await restricted.authenticate({ token: "ghp_test1234567890" });
  await assert.rejects(
    () => restricted.execute("create_issue", {
      repository: "owner/repo",
      title: "A",
      body: "B",
    }),
    /github_adapter\.action_not_allowed:create_issue/,
  );
});

test("github adapter plugin signature helpers use current hashing contract", () => {
  const pluginId = "plugin.shared.github_adapter";
  const manifest = { version: "1.0.0", capabilities: ["external.github"], nested: { b: 2, a: 1 } };
  const manifestHash = createPluginManifestHash(pluginId, manifest);
  const reorderedHash = createPluginManifestHash(pluginId, {
    nested: { a: 1, b: 2 },
    capabilities: ["external.github"],
    version: "1.0.0",
  });
  const secretKey = "super-secret";
  const signature = createHmac("sha256", secretKey)
    .update(`${pluginId}:${manifestHash}`)
    .digest("hex");

  const verified = verifyPluginSignature(pluginId, manifestHash, signature, secretKey);
  const rejected = verifyPluginSignature(pluginId, manifestHash, "00", secretKey);

  assert.equal(manifestHash.length, 64);
  assert.equal(reorderedHash, manifestHash);
  assert.equal(verified.valid, true);
  assert.equal(rejected.valid, false);
  assert.equal(rejected.error, "plugin_signature.invalid");
});
