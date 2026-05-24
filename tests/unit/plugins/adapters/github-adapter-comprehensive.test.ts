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
  endpoint: string;
  payload: Record<string, unknown>;
};

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
  assert.ok(issue.endpoint.includes("/repos/owner/repo/issues"));
  assert.deepEqual(issue.payload, {
    title: "Test Issue",
    body: "Issue body",
    labels: ["bug"],
  });
  assert.equal(issue.timeoutMs, 5000);
  assert.equal(issue.rateLimitPerMinute, 30);
  assert.equal(typeof issue.idempotencyKey, "string");
  assert.equal(file.action, "get_file");
  assert.ok(file.endpoint.includes("/contents/README.md"));
  assert.equal("idempotencyKey" in file, false);
  assert.deepEqual(file.payload, { path: "README.md", ref: "main" });
});

test("github adapter execute sanitizes workflow inputs and enforces repository validation", async () => {
  const adapter = createGithubAdapterPlugin({
    policy: createPolicy(),
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

  assert.ok(workflow.endpoint.includes("/actions/workflows/build.yml/dispatches"));
  assert.deepEqual(workflow.payload, {
    workflowId: "build.yml",
    ref: "main",
    inputs: {
      environment: "prod",
      retries: "3",
      dryRun: "false",
      nullable: "",
    },
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
});

test("github adapter plugin signature helpers use current hashing contract", () => {
  const pluginId = "plugin.shared.github_adapter";
  const manifest = { version: "1.0.0", capabilities: ["external.github"] };
  const manifestHash = createPluginManifestHash(pluginId, manifest);
  const secretKey = "super-secret";
  const signature = createHmac("sha256", secretKey)
    .update(`${pluginId}:${manifestHash}`)
    .digest("hex");

  const verified = verifyPluginSignature(pluginId, manifestHash, signature, secretKey);
  const rejected = verifyPluginSignature(pluginId, manifestHash, "00", secretKey);

  assert.equal(manifestHash.length, 64);
  assert.equal(verified.valid, true);
  assert.equal(rejected.valid, false);
  assert.equal(rejected.error, "plugin_signature.invalid");
});
