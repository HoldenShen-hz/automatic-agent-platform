import assert from "node:assert/strict";
import test from "node:test";

import { HarnessSdk, HarnessSdkError, buildPlanGraphBundle, validatePlanGraphBundle } from "../../../../src/sdk/harness-sdk/index.js";
import type { HarnessSdkAppendStepInput, HarnessSdkCreateRunInput, PlanGraphBuildInput } from "../../../../src/sdk/harness-sdk/index.js";
import type { PlanEdge, PlanNode } from "../../../../src/platform/contracts/executable-contracts/index.js";

function createDeferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  return {
    promise: new Promise<void>((res) => {
      resolve = res;
    }),
    resolve,
  };
}

test("HarnessSdk.appendStepWithReceipt uses provided nodeAttemptId", () => {
  const sdk = new HarnessSdk();

  const runInput: HarnessSdkCreateRunInput = {
    taskId: "task-123",
    domainId: "domain-1",
    constraintPack: { phase: "execution" } as any,
    tenantId: "tenant-1",
  };
  const run = sdk.createRun(runInput);

  const stepInput: HarnessSdkAppendStepInput = {
    role: "executor",
    nodeRunId: "node-1",
    planGraphId: "graph-1",
    inputs: {},
    outputs: {},
    nodeAttemptId: "custom-nattempt-id",
  };

  const result = sdk.appendStepWithReceipt(run, stepInput);

  assert.equal(result.receipt.nodeAttemptId, "custom-nattempt-id");
});

test("HarnessSdk.appendStepWithReceipt uses provided graphVersion", () => {
  const sdk = new HarnessSdk();

  const runInput: HarnessSdkCreateRunInput = {
    taskId: "task-123",
    domainId: "domain-1",
    constraintPack: { phase: "execution" } as any,
    tenantId: "tenant-1",
  };
  const run = sdk.createRun(runInput);

  const stepInput: HarnessSdkAppendStepInput = {
    role: "executor",
    nodeRunId: "node-1",
    planGraphId: "graph-1",
    inputs: {},
    outputs: {},
    graphVersion: 42,
  };

  const result = sdk.appendStepWithReceipt(run, stepInput);

  assert.equal(result.receipt.graphVersion, 42);
});

test("HarnessSdk.appendStepWithReceipt uses provided receiptKind", () => {
  const sdk = new HarnessSdk();

  const runInput: HarnessSdkCreateRunInput = {
    taskId: "task-123",
    domainId: "domain-1",
    constraintPack: { phase: "execution" } as any,
    tenantId: "tenant-1",
  };
  const run = sdk.createRun(runInput);

  const stepInput: HarnessSdkAppendStepInput = {
    role: "executor",
    nodeRunId: "node-1",
    planGraphId: "graph-1",
    inputs: {},
    outputs: {},
    receiptKind: "retriever",
  };

  const result = sdk.appendStepWithReceipt(run, stepInput);

  assert.equal(result.receipt.receiptKind, "retriever");
});

test("HarnessSdk works with empty constraintPack", () => {
  const sdk = new HarnessSdk();

  const runInput: HarnessSdkCreateRunInput = {
    taskId: "task-123",
    domainId: "domain-1",
    constraintPack: {} as any,
    tenantId: "tenant-1",
  };

  const run = sdk.createRun(runInput);
  assert.ok(run !== undefined);
});

test("buildPlanGraphBundle with empty edges array is valid", () => {
  const nodes: PlanNode[] = [
    {
      nodeId: "node-1",
      nodeIndex: 0,
      capability: "solo",
      description: "Solo node",
      inputSchema: {},
      outputSchema: {},
    },
  ];

  const input: PlanGraphBuildInput = {
    harnessRunId: "run-123",
    nodes,
    edges: [],
    entryNodeIds: ["node-1"],
    terminalNodeIds: ["node-1"],
  };

  const result = buildPlanGraphBundle(input);

  assert.equal(result.validationReport.valid, true);
  assert.equal(result.bundle.graph.edges.length, 0);
});

test("buildPlanGraphBundle uses default scheduler policy when not provided", () => {
  const nodes: PlanNode[] = [
    {
      nodeId: "node-1",
      nodeIndex: 0,
      capability: "execute",
      description: "Execute",
      inputSchema: {},
      outputSchema: {},
    },
  ];

  const input: PlanGraphBuildInput = {
    harnessRunId: "run-123",
    nodes,
    edges: [],
    entryNodeIds: ["node-1"],
    terminalNodeIds: ["node-1"],
  };

  const result = buildPlanGraphBundle(input);

  assert.equal(result.bundle.schedulerPolicy.policyId, "scheduler:default");
  assert.equal(result.bundle.schedulerPolicy.strategy, "deterministic_fifo");
});

test("buildPlanGraphBundle uses default budget plan ref when not provided", () => {
  const nodes: PlanNode[] = [
    {
      nodeId: "node-1",
      nodeIndex: 0,
      capability: "execute",
      description: "Execute",
      inputSchema: {},
      outputSchema: {},
    },
  ];

  const input: PlanGraphBuildInput = {
    harnessRunId: "run-123",
    nodes,
    edges: [],
    entryNodeIds: ["node-1"],
    terminalNodeIds: ["node-1"],
  };

  const result = buildPlanGraphBundle(input);

  assert.equal(result.bundle.budgetPlanRef, "budget:default");
});

test("HarnessSdk.sendInterPlaneMessage signs envelopes when inter-plane security is configured", async () => {
  let capturedEnvelope: any;
  const sdk = new HarnessSdk(
    undefined,
    undefined,
    {
      async send<TResponse>({ envelope }: { targetPlane: string; envelope: any }): Promise<TResponse> {
        capturedEnvelope = envelope;
        return { ok: true } as TResponse;
      },
    },
    {
      sharedSecretKey: "test-shared-secret",
    },
  );

  const result = await sdk.sendInterPlaneMessage("execution-plane", "cmd.execute", { taskId: "task-1" });
  assert.deepEqual(result, { ok: true });
  assert.equal(typeof capturedEnvelope.signature, "string");
  assert.ok((capturedEnvelope.signature as string).length > 0);
  assert.equal(sdk.verifyReceivedInterPlaneEnvelope(capturedEnvelope).valid, true);
});

test("HarnessSdk.verifyReceivedInterPlaneEnvelope rejects tampered payloads", async () => {
  let capturedEnvelope: any;
  const sdk = new HarnessSdk(
    undefined,
    undefined,
    {
      async send<TResponse>({ envelope }: { targetPlane: string; envelope: any }): Promise<TResponse> {
        capturedEnvelope = envelope;
        return { ok: true } as TResponse;
      },
    },
    {
      sharedSecretKey: "test-shared-secret",
    },
  );

  await sdk.sendInterPlaneMessage("execution-plane", "cmd.execute", { taskId: "task-1" });
  const tamperedEnvelope = {
    ...capturedEnvelope,
    payload: { taskId: "task-2" },
  };

  const verification = sdk.verifyReceivedInterPlaneEnvelope(tamperedEnvelope);
  assert.equal(verification.valid, false);
  assert.equal(verification.error, "contract_envelope.signature_invalid");
});

test("HarnessSdk.sendInterPlaneMessage applies bulkhead isolation when configured", async () => {
  const sendStarted = createDeferred();
  const releaseSend = createDeferred();
  let inFlight = 0;
  const sdk = new HarnessSdk(
    undefined,
    undefined,
    {
      async send<TResponse>(): Promise<TResponse> {
        inFlight += 1;
        sendStarted.resolve();
        await releaseSend.promise;
        inFlight -= 1;
        return { ok: true } as TResponse;
      },
    },
    {
      sharedSecretKey: "test-shared-secret",
      bulkheadConfig: {
        maxConcurrentCalls: 1,
        queueSize: 0,
        timeoutMs: 50,
      },
    },
  );

  const first = sdk.sendInterPlaneMessage("execution-plane", "cmd.execute", { taskId: "task-1" });
  await sendStarted.promise;
  await assert.rejects(
    sdk.sendInterPlaneMessage("execution-plane", "cmd.execute", { taskId: "task-2" }),
    (error: unknown) => error instanceof HarnessSdkError && error.code === "harness_sdk.inter_plane_bulkhead_rejected",
  );
  releaseSend.resolve();
  await first;
  assert.equal(inFlight, 0);
});

test("buildPlanGraphBundle rejects invalid entryNodeIds", () => {
  const nodes: PlanNode[] = [
    {
      nodeId: "node-1",
      nodeIndex: 0,
      capability: "single",
      description: "Single node",
      inputSchema: {},
      outputSchema: {},
    },
  ];
  const edges: PlanEdge[] = [];

  const input: PlanGraphBuildInput = {
    harnessRunId: "run-123",
    nodes,
    edges,
    entryNodeIds: ["non-existent-node"],
    terminalNodeIds: ["node-1"],
  };

  const result = buildPlanGraphBundle(input);
  const bundleValidation = validatePlanGraphBundle(result.bundle);

  assert.equal(bundleValidation.valid, false);
  assert.ok(bundleValidation.findings.length > 0);
});
