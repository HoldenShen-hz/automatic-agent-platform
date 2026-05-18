import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  CANONICAL_CONTRACT_NAMES,
} from "../../../src/platform/contracts/executable-contracts/index.js";
import { createDelegationRequest } from "../../../src/platform/contracts/delegation-request/index.js";
import { createModelRequest } from "../../../src/platform/contracts/model-request/index.js";
import {
  createProjectionUpdate,
  validateProjectionUpdate,
} from "../../../src/platform/contracts/projection-update/index.js";
import {
  createPromptBundle,
  validatePromptBundle,
} from "../../../src/platform/contracts/prompt-bundle/index.js";

function readRepoFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

test("R25-14 state-command contract now carries expectedStatus alongside canonical dispatch fields", () => {
  const source = readRepoFile("src/platform/contracts/state-command/index.ts");
  assert.match(source, /expectedStatus\?: string \| null/);
  assert.match(source, /principal\?: PlatformPrincipalLike/);
  assert.match(source, /leaseId\?: string/);
  assert.match(source, /fencingToken\?: string/);
  assert.match(source, /traceId\?: string/);
});

test("R25-15 transition command now exposes canonical dispatch compatibility fields", () => {
  const source = readRepoFile("src/platform/contracts/types/domain/core-types.ts");
  assert.match(source, /principal\?: TransitionPrincipalLike/);
  assert.match(source, /leaseId\?: string/);
  assert.match(source, /fencingToken\?: string/);
  assert.match(source, /event\?: string/);
  assert.match(source, /payload\?: unknown/);
  assert.match(source, /expectedVersion\?: number \| null/);
});

test("R25-16 canonical executable contracts include the five core runtime objects", () => {
  for (const contractName of [
    "HarnessRun",
    "NodeRun",
    "NodeAttempt",
    "BudgetReservation",
    "SideEffectRecord",
  ] as const) {
    assert.ok(CANONICAL_CONTRACT_NAMES.includes(contractName));
  }
});

test("R25-17 and R25-18 legacy execution-plan and execution-receipt paths now hard-point to canonical contracts", () => {
  const executionPlanSource = readRepoFile("src/platform/contracts/execution-plan/index.ts");
  const executionReceiptSource = readRepoFile("src/platform/contracts/execution-receipt/index.ts");

  assert.match(executionPlanSource, /type PlanGraphBundle/);
  assert.match(executionPlanSource, /ExecutionPlan is deprecated/);
  assert.match(executionReceiptSource, /type NodeAttemptReceipt/);
  assert.match(executionReceiptSource, /ExecutionReceipt is deprecated/);
});

test("R25-19 model requests carry budgetReservationId", () => {
  const request = createModelRequest({
    model: "gpt-5.4",
    messages: [{ role: "user", content: "hello" }],
    temperature: null,
    maxTokens: null,
    tenantId: null,
    taskId: null,
    budgetReservationId: "bresv_123",
  });

  assert.equal(request.budgetReservationId, "bresv_123");
});

test("R25-20 delegation requests carry budget envelope and reservation identity", () => {
  const request = createDelegationRequest({
    taskId: "task-1",
    fromAgentId: "agent-1",
    toAgentId: "agent-2",
    capabilityRef: null,
    priority: "high",
    reason: "parallelize",
    contextRef: null,
    tenantId: "tenant-1",
    budgetReservationId: "bresv_456",
    budgetEnvelope: {
      amount: 10,
      currency: "USD",
      resourceKinds: ["llm", "tool"],
    },
  });

  assert.equal(request.budgetReservationId, "bresv_456");
  assert.deepEqual(request.budgetEnvelope?.resourceKinds, ["llm", "tool"]);
});

test("R25-21 run kind includes node_run", () => {
  const source = readRepoFile("src/platform/contracts/types/domain/primitives.ts");
  assert.match(source, /"node_run"/);
});

test("R25-22 execution records include canonical node and plan graph identities", () => {
  const source = readRepoFile("src/platform/contracts/types/domain/execution-types.ts");
  assert.match(source, /nodeRunId\?: string \| null/);
  assert.match(source, /planGraphId\?: string \| null/);
  assert.match(source, /planGraphBundleId\?: string \| null/);
});

test("R25-23 tenant quotas are required and normalized at repository boundaries", () => {
  const workspaceTypesSource = readRepoFile("src/platform/contracts/types/domain/workspace-types.ts");
  const tenantRepositorySource = readRepoFile("src/platform/five-plane-state-evidence/truth/sqlite/repositories/tenant-repository.ts");
  const organizationRepositorySource = readRepoFile("src/platform/five-plane-state-evidence/truth/sqlite/repositories/organization-repository.ts");

  assert.match(workspaceTypesSource, /quotas: TenantQuotas;/);
  assert.match(tenantRepositorySource, /quotas: normalizeTenantQuotas/);
  assert.match(organizationRepositorySource, /quotas: record\.quotas \?\? \{\}/);
});

test("R25-24 projection-update is now a standalone contract module with validation", () => {
  const source = readRepoFile("src/platform/contracts/projection-update/index.ts");
  assert.doesNotMatch(source, /platform-contracts/);

  const update = createProjectionUpdate({
    projectionId: "proj-1",
    projectionType: "tenant_summary",
    version: 2,
    sourceEvents: ["evt-1"],
    patch: { status: "active" },
    triggeredBy: "reaudit-test",
  });

  assert.equal(validateProjectionUpdate(update), update);
  assert.equal(update.metadata.triggeredBy, "reaudit-test");
});

test("R25-25 prompt bundles now expose factory and validation helpers", () => {
  const bundle = createPromptBundle({
    name: "assistant-core",
    version: 2,
    displayVersion: "2.0.0",
    domain: "assistant",
    taskType: "chat",
    packId: undefined,
    systemPrompt: {
      content: "You are precise.",
      templateVariables: [],
      channel: "system",
    },
    userPrompt: undefined,
    fewShotExamples: undefined,
    constraints: undefined,
    compatibilityMatrix: {
      toolSchemaVersions: [],
      evaluatorSchemaVersions: [],
      domainDescriptorVersions: [],
      modelRoutingProfiles: [],
    },
    metadata: undefined,
  });

  assert.equal(validatePromptBundle(bundle), bundle);
  assert.equal(bundle.version, 2);
  assert.equal(bundle.displayVersion, "2.0.0");
});
