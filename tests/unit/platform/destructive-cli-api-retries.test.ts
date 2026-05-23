import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { ValidationError } from "../../../src/platform/contracts/errors.js";
import { loadOrphanCleanupCliEnv } from "../../../src/platform/five-plane-control-plane/config-center/ops-cli-env.js";
import { ModelCallProviderService } from "../../../src/platform/five-plane-execution/execution-engine/model-call-provider.js";
import { AdminSdk } from "../../../src/sdk/admin-sdk/index.js";
import { HarnessSdk, HarnessSdkError } from "../../../src/sdk/harness-sdk/index.js";
import { RetryableApiClient } from "../../../src/sdk/client-sdk/api-client.js";

test("R31-34/R31-40/R31-41/R31-43: destructive CLIs now require explicit confirmation or defer side effects", () => {
  const dlqSource = readFileSync("src/sdk/cli/dlq-manager.ts", "utf8");
  const storageAdminSource = readFileSync("src/sdk/cli/authoritative-storage-admin.ts", "utf8");
  const shadowSnapshotSource = readFileSync("src/sdk/cli/shadow-snapshot.ts", "utf8");

  assert.match(dlqSource, /AA_DLQ_PURGE_CONFIRM/);
  assert.match(dlqSource, /LIMIT 100/);
  assert.match(storageAdminSource, /AA_STORAGE_DOWN_CONFIRM/);
  assert.match(shadowSnapshotSource, /Defer environment loading and service creation to main/);
});

test("R31-35/R31-36/R31-44: API client retries only idempotent 5xx requests and throws on non-OK responses", async () => {
  const client = new RetryableApiClient({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  }, {
    maxRetries: 2,
    backoffMs: 1,
    backoffMultiplier: 1,
    maxBackoffMs: 1,
  });

  const originalFetch = globalThis.fetch;

  let getAttempts = 0;
  globalThis.fetch = async () => {
    getAttempts += 1;
    if (getAttempts < 3) {
      return new Response(JSON.stringify({ error: "temporary" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    const response = await client.get<{ ok: boolean }>("/retryable");
    assert.equal(response.data.ok, true);
    assert.equal(getAttempts, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }

  let postAttempts = 0;
  globalThis.fetch = async () => {
    postAttempts += 1;
    return new Response(JSON.stringify({ error: "duplicate risk" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    await assert.rejects(() => client.post("/write", { ok: true }), /status 500/);
    assert.equal(postAttempts, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }

  let badRequestAttempts = 0;
  globalThis.fetch = async () => {
    badRequestAttempts += 1;
    return new Response(JSON.stringify({ error: "bad request" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    await assert.rejects(() => client.get("/bad-request"), /status 400/);
    assert.equal(badRequestAttempts, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("R31-37: getPaginated drops NaN x-total-count headers instead of propagating NaN", async () => {
  const client = new RetryableApiClient({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify([{ id: 1 }]), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "x-total-count": "not-a-number",
    },
  });

  try {
    const result = await client.getPaginated<{ id: number }>("/items");
    assert.equal(result.totalCount, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("R31-38/R31-39: AdminSdk validates registerDomain payloads and enforces admin authorization", async () => {
  const unauthorized = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  });

  assert.throws(
    () => unauthorized.listDomains(),
    (error: unknown) => error instanceof ValidationError && error.code === "admin_sdk.permission_denied",
  );

  const authorized = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      roles: ["admin"],
    },
  });

  assert.throws(
    () => authorized.registerDomain({ domainId: "", displayName: "" }),
    (error: unknown) => error instanceof ValidationError && error.code === "admin_sdk.invalid_input",
  );

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ domainId: "domain.alpha" }), {
    status: 201,
    headers: { "content-type": "application/json" },
  });
  try {
    const result = await authorized.registerDomain<{ domainId: string }>({
      domainId: "domain.alpha",
      displayName: "Domain Alpha",
    });
    assert.equal(result.data.domainId, "domain.alpha");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("R31-42/R31-46: HarnessSdk no longer defaults stage from nodeRunId and validates ISO-8601 sleep timestamps", () => {
  const harnessSource = readFileSync("src/sdk/harness-sdk/index.ts", "utf8");
  assert.ok(!harnessSource.includes("stage: input.stage ?? input.nodeRunId"));

  const sdk = new HarnessSdk();
  const run = sdk.createRun({
    taskId: "task-1",
    domainId: "ops",
    tenantId: "tenant-1",
    authContext: {
      actorId: "operator-1",
    },
    constraintPack: {
      policyIds: ["policy.audit"],
      approvalMode: "supervised",
      autonomyMode: "supervised",
      tool_policy: { allowedTools: ["search"] },
      risk_policy: { maxRiskScore: 0.4, escalationThreshold: 0.3 },
      output_policy: { requiredEvidence: ["audit"], redactSensitiveData: true },
      budget: { maxSteps: 3, maxCost: 2, maxDurationMs: 60_000 },
      sandboxRequirement: { sandboxMode: "none", timeoutMs: 60_000 },
      approvalRequirement: { requiredForRiskClass: [], approverRoles: [], escalationTimeoutMs: 60_000 },
    },
  });

  assert.throws(
    () => sdk.sleep(run, "wait", "tomorrow noon"),
    (error: unknown) => error instanceof HarnessSdkError && error.code === "harness_sdk.invalid_resume_at",
  );
});

test("R31-45: orphan cleanup repair mode now requires a separate confirmation flag", () => {
  const scanConfig = loadOrphanCleanupCliEnv({});
  const repairConfig = loadOrphanCleanupCliEnv({
    AA_ORPHAN_CLEANUP_ACTION: "repair",
  });
  const confirmedRepairConfig = loadOrphanCleanupCliEnv({
    AA_ORPHAN_CLEANUP_ACTION: "repair",
    AA_ORPHAN_CLEANUP_CONFIRM: "yes",
  });
  const orphanSource = readFileSync("src/sdk/cli/orphan-cleanup.ts", "utf8");

  assert.equal(scanConfig.confirmRepair, false);
  assert.equal(repairConfig.confirmRepair, false);
  assert.equal(confirmedRepairConfig.confirmRepair, true);
  assert.match(orphanSource, /orphan_cleanup\.repair_requires_confirmation/);
});

test("R31-47: billing account creation no longer falls back ownerId to an empty string", () => {
  const billingSource = readFileSync("src/sdk/cli/billing.ts", "utf8");
  assert.match(billingSource, /billing\.missing_owner_id/);
  assert.ok(!billingSource.includes("ownerId: envConfig.ownerId ?? \"\""));
});

test("R31-48/R31-49/R31-51/R31-52: delegation manager now wires call-depth, governance, audit, and ContextIsolator together", () => {
  const source = readFileSync("src/platform/five-plane-orchestration/agent-delegation/delegation-manager.service.ts", "utf8");
  assert.match(source, /this\.callDepthBudget\.evaluate/);
  assert.match(source, /this\.governanceService\.evaluate/);
  assert.match(source, /recordGovernanceEvaluation/);
  assert.match(source, /recordDelegationCreated/);
  assert.match(source, /this\.contextIsolator\.isolate/);
});

test("R31-50: model routing risk level now reuses the canonical RiskLevel contract", () => {
  const source = readFileSync("src/platform/model-gateway/provider-registry/model-routing-service.ts", "utf8");
  assert.match(source, /import type \{ RiskLevel \} from "\.\.\/\.\.\/five-plane-control-plane\/risk-control\/types\.js"/);
  assert.match(source, /export type ModelRouteRiskLevel = RiskLevel;/);
});

test("R31-53: model-call provider feeds unified-chat usage back into budget settlement", async () => {
  const service = new ModelCallProviderService({});
  const budgetGuard = (service as unknown as {
    budgetGuard: {
      atomicReserve?: (...args: unknown[]) => unknown;
      atomicExecute?: (...args: unknown[]) => unknown;
      atomicSettle?: (...args: unknown[]) => unknown;
    };
  }).budgetGuard;

  const calls: string[] = [];
  assert.ok(budgetGuard.atomicReserve);
  assert.ok(budgetGuard.atomicExecute);
  const originalReserve = budgetGuard.atomicReserve.bind(budgetGuard);
  const originalExecute = budgetGuard.atomicExecute.bind(budgetGuard);

  budgetGuard.atomicReserve = (...args: unknown[]) => {
    calls.push("reserve");
    return originalReserve(...args);
  };
  budgetGuard.atomicExecute = (...args: unknown[]) => {
    calls.push("execute");
    return originalExecute(...args);
  };
  budgetGuard.atomicSettle = async () => {
    calls.push("settle");
    return {
      session: { sessionId: "budget-session-1" },
      success: true,
      reasonCode: "budget.settled",
    };
  };

  const providerStub = {
    hasProvider: () => true,
    createChatCompletion: async () => ({
      id: "chatcmpl_1",
      content: "ok",
      refusal: null,
      reasoningContent: null,
      finishReason: "stop",
      toolCalls: [],
      usage: {
        promptTokens: 120,
        completionTokens: 30,
        totalTokens: 150,
      },
      model: "gpt-4o",
      provider: "openai",
    }),
    dispose: () => undefined,
  };

  (service as unknown as { unifiedProvider: unknown }).unifiedProvider = providerStub;

  const result = await service.createCompletion({
    model: "gpt-4o",
    messages: [],
    maxTokens: 256,
    harnessRunId: "harness_run_test_1",
    traceId: "trace-1",
  });

  assert.equal(result.usage.totalTokens, 150);
  assert.deepEqual(calls, ["reserve", "execute", "settle"]);
});
