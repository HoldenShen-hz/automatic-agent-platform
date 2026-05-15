import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { createMiniMaxChatServiceFromEnvironment } from "../../../../src/platform/model-gateway/provider-registry/minimax/minimax-chat-service.js";
import {
  buildDefaultStartupConfigValidator,
  buildEnvironmentProviderReadinessProbe,
} from "../../../../src/platform/five-plane-execution/startup/startup-preflight.js";
import { SecretManagementService } from "../../../../src/platform/five-plane-control-plane/iam/secret-management-service.js";
import { createWorkspaceWritePolicy } from "../../../../src/platform/five-plane-control-plane/iam/sandbox-policy.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";
import { cleanupPath, createFile, createTempWorkspace } from "../../../helpers/fs.js";

function seedConfigTree(root: string): void {
  const files: Record<string, string> = {
    "bootstrap/default.json": JSON.stringify({
      appName: "aa",
      phase: "phase_3",
      stableCoreEnabled: true,
      dependencyOrder: ["bootstrap", "gateways", "providers", "runtime", "security", "workflows"],
      readinessGates: ["config_bundle_loaded", "provider_registry_loaded"],
      degradationPolicy: {
        onReadinessFailure: "block_startup",
        allowSummaryMode: true,
      },
      healthCheckTimeoutMs: 10000,
      readinessProbe: {
        initialDelayMs: 1000,
        intervalMs: 5000,
        timeoutMs: 2000,
        failureThreshold: 3,
      },
    }, null, 2),
    "gateways/default.json": JSON.stringify({ defaultGateway: "cli", sseEnabled: true }, null, 2),
    "providers/default.json": JSON.stringify({ defaultProvider: "minimax", defaultModelProfile: "reasoning-medium" }, null, 2),
    "providers/models.json": JSON.stringify({
      version: "test-registry",
      providers: { minimax: { status: "active", authMethods: ["api_key"] } },
      profiles: {
        "reasoning-medium": {
          provider: "minimax",
          modelId: "MiniMax-M2",
          tier: "reasoning",
          capabilities: ["reasoning"],
          contextWindowTokens: 1_000_000,
          maxOutputTokens: 64_000,
          pricing: { inputPer1kUsd: 0.001, outputPer1kUsd: 0.002 },
          metadataSource: "local_override",
        },
      },
    }, null, 2),
    "runtime/default.json": JSON.stringify({
      configVersion: "test-runtime-v1",
      configSchemaVersion: "1.0.0",
      maxConcurrentTasks: 2,
      defaultTaskTimeoutMs: 300000,
      defaultStepTimeoutMs: 120000,
      apiDefaultTimeoutMs: 30000,
      apiMaxTimeoutMs: 120000,
      retryMax: 3,
      circuitBreaker: {
        enabled: true,
        threshold: 5,
      },
      rateLimit: {
        enabled: true,
        requestsPerMinute: 120,
      },
      configDriftReconciler: {
        interval: 60000,
      },
    }, null, 2),
    "security/default.json": JSON.stringify({
      approvalMode: "supervised",
      sandboxMode: "workspace_write",
      allowDestructiveActions: false,
      remoteWorkerRegistration: {
        challengeTtlMs: 300000,
        allowedCapabilities: ["bash", "edit", "mcp"],
      },
    }, null, 2),
    "workflows/default.json": JSON.stringify({ defaultWorkflowId: "single_agent_minimal", allowCrossDivisionDag: false }, null, 2),
  };

  for (const [relativePath, content] of Object.entries(files)) {
    createFile(join(root, relativePath), content);
  }
}

test("startup provider readiness probe fail-closes on malformed credential pool json", () => {
  const workspace = createTempWorkspace("aa-provider-pool-boundary-");
  const configRoot = join(workspace, "config");

  try {
    seedConfigTree(configRoot);
    const validate = buildDefaultStartupConfigValidator({
      configRoot,
      sandboxPolicy: createWorkspaceWritePolicy(configRoot),
    });
    const result = validate();
    const probe = buildEnvironmentProviderReadinessProbe({
      providerEnv: {
        MINIMAX_API_KEYS_JSON: "{\"invalid\":true}",
      },
    });

    const findings = probe(result);

    assert.equal(result.ok, true);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]?.provider, "minimax");
    assert.equal(findings[0]?.reasonCode, "provider.credentials_invalid");
  } finally {
    cleanupPath(workspace);
  }
});

test("startup provider readiness probe fail-closes managed provider secret refs without a resolver", () => {
  const workspace = createTempWorkspace("aa-provider-secret-ref-boundary-");
  const configRoot = join(workspace, "config");

  try {
    seedConfigTree(configRoot);
    const validate = buildDefaultStartupConfigValidator({
      configRoot,
      sandboxPolicy: createWorkspaceWritePolicy(configRoot),
    });
    const result = validate();
    const probe = buildEnvironmentProviderReadinessProbe({
      providerEnv: {
        MINIMAX_API_KEY_SECRET_REF: "secret://providers/minimax/default",
      },
    });

    const findings = probe(result);

    assert.equal(result.ok, true);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]?.provider, "minimax");
    assert.equal(findings[0]?.reasonCode, "provider.credentials_invalid");
    assert.match(findings[0]?.message ?? "", /secret_resolver_missing/);
  } finally {
    cleanupPath(workspace);
  }
});

test("provider runtime uses managed secret lease issuance and revokes the lease after request completion", async () => {
  const workspace = createTempWorkspace("aa-provider-lease-runtime-");
  const dbPath = join(workspace, "provider-lease-runtime.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  try {
    const createdAt = nowIso();
    store.upsertSecretRegistryRecord({
      secretRef: "secret://providers/minimax/default",
      displayName: "MiniMax default",
      category: "provider_api_key",
      providerKind: "vault",
      scopeType: "system",
      scopeRef: "providers.minimax.default",
      status: "active",
      rotationPolicyJson: JSON.stringify({ cadenceDays: 30, ttlMinutes: 15, breakGlass: false }),
      metadataJson: null,
      currentVersion: "v1",
      lastRotatedAt: createdAt,
      nextRotationDueAt: null,
      createdAt,
      updatedAt: createdAt,
    });

    const secretManagement = new SecretManagementService(db, store, {
      providerEnv: {
        AA_VAULT_SECRETS_JSON: JSON.stringify({
          "secret://providers/minimax/default": {
            value: "vault-backed-long-lived-key",
            locator: "vault://kv/providers/minimax/default",
            issued_lease: {
              value: "vault-issued-runtime-key",
              locator: "vault://lease/providers/minimax/default",
              lease_id: "vault-provider-runtime-lease-1",
              expires_at: "2099-01-01T00:00:00.000Z",
              renewable: true,
              issued_by: "vault.dynamic.providers.minimax",
            },
          },
        }),
      },
    });

    const requests: string[] = [];
    const service = createMiniMaxChatServiceFromEnvironment({
      providerEnv: {
        MINIMAX_API_KEY_SECRET_REF: "secret://providers/minimax/default",
      },
      secretLeaseIssuer: async (secretRef) => {
        const lease = await secretManagement.issueSecretLease({
          secretRef,
          requestedBy: "provider-runtime",
          grantedTo: "provider:minimax",
          usagePurpose: "chat_completion",
        });
        return {
          apiKey: lease.value,
          leaseId: lease.metadata.leaseId,
          expiresAt: lease.metadata.expiresAt,
          leaseSource: lease.metadata.leaseSource,
        };
      },
      secretLeaseRevoker: (leaseId, context) => {
        secretManagement.revokeSecretLease({
          leaseId,
          revokedBy: "provider-runtime",
          reasonCode: context.reasonCode,
        });
      },
      fetchImpl: async (_input, init) => {
        requests.push(
          String(
            init?.headers instanceof Headers
              ? init.headers.get("Authorization")
              : (init?.headers as Record<string, string>)?.Authorization,
          ),
        );
        return new Response(
          JSON.stringify({
            id: "resp-provider-runtime-1",
            choices: [
              {
                message: {
                  role: "assistant",
                  content: "ok",
                },
                finish_reason: "stop",
              },
            ],
            usage: {
              prompt_tokens: 5,
              completion_tokens: 3,
              total_tokens: 8,
            },
            model: "MiniMax-M2",
          }),
          {
            status: 200,
            headers: new Headers({ "content-type": "application/json" }),
          },
        );
      },
    });

    const result = await service.createChatCompletion({
      model: "MiniMax-M2",
      messages: [{ role: "user", content: "hi" }],
    });

    assert.equal(result.content, "ok");
    assert.deepEqual(requests, ["Bearer vault-issued-runtime-key"]);
    const leases = secretManagement.listSecretLeases("secret://providers/minimax/default");
    assert.equal(leases.length, 1);
    assert.equal(leases[0]?.status, "revoked");
    assert.match(leases[0]?.metadataJson ?? "", /provider_issued/);
    assert.equal(leases[0]?.revocationReasonCode, "provider.request_completed");
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});
