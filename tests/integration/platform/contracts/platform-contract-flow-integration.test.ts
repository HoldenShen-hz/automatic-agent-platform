import assert from "node:assert/strict";
import test from "node:test";

import { createControlDirective } from "../../../../src/platform/contracts/control-directive/index.js";
import { createDelegationRequest } from "../../../../src/platform/contracts/delegation-request/index.js";
import { createExecutionPlan } from "../../../../src/platform/contracts/execution-plan/index.js";
import { createExecutionReceipt } from "../../../../src/platform/contracts/execution-receipt/index.js";
import { createModelRequest } from "../../../../src/platform/contracts/model-request/index.js";
import { createStateCommand } from "../../../../src/platform/contracts/state-command/index.js";
import { ValidationError, UnimplementedError } from "../../../../src/platform/contracts/errors.js";
import { createPlatformPrincipal, createRequestEnvelope } from "../../../../src/platform/contracts/types/platform-contracts.js";

test("integration: supported platform contract objects compose while legacy plan/directive/receipt factories fail fast", () => {
  const principal = createPlatformPrincipal({
    actorId: "user_1",
    tenantId: "tenant-1",
  });
  const envelope = createRequestEnvelope({
    principal,
    tenantId: "tenant-1",
    payload: { prompt: "deploy the approved change" },
  });
  const modelRequest = createModelRequest({
    model: "gpt-5.4-mini",
    messages: [{ role: "user", content: String(envelope.body.prompt) }],
    temperature: 0.1,
    maxTokens: 512,
    tenantId: envelope.tenantId,
    taskId: envelope.taskId,
  });
  const delegation = createDelegationRequest({
    taskId: envelope.taskId ?? "task-1",
    fromAgentId: "planner",
    toAgentId: "executor",
    capabilityRef: null,
    priority: "critical",
    reason: "execute approved rollout",
    contextRef: modelRequest.requestId,
    tenantId: envelope.tenantId,
  });

  assert.equal(modelRequest.taskId, envelope.taskId);
  assert.equal(delegation.contextRef, modelRequest.requestId);

  // createStateCommand is deprecated and always throws
  assert.throws(
    () =>
      createStateCommand({
        entityKind: "delegation_request",
        entityId: delegation.requestId,
        action: "transition",
        expectedVersion: null,
        payload: { nextStatus: "queued", delegationRequestId: delegation.requestId },
        emittedBy: "planner",
      }),
    (error: unknown) =>
      error instanceof UnimplementedError && error.code === "DEPRECATED_STATE_COMMAND",
  );
  assert.throws(
    () =>
      createExecutionPlan({
        taskId: envelope.taskId ?? "task-1",
        tenantId: envelope.tenantId,
        version: 1,
        steps: [
          { stepId: "step-1", title: "Assess request", actionRef: "model.assess", dependsOn: [], requiresApproval: false },
        ],
      }),
    (error: unknown) => error instanceof ValidationError && error.code === "execution_plan.legacy_contract_forbidden",
  );
  assert.throws(
    () =>
      createControlDirective({
        kind: "escalate",
        targetRef: "step-2",
        reasonCode: "approval.required",
        issuedBy: "policy-center",
        tenantId: envelope.tenantId,
        executionId: null,
        metadata: { delegationRequestId: delegation.requestId },
      }),
    (error: unknown) => error instanceof ValidationError && error.code === "platform_contracts.legacy_control_directive_forbidden",
  );
  assert.throws(
    () =>
      createExecutionReceipt({
        planId: "plan-1",
        stepId: "step-1",
        status: "completed",
        workerId: "worker-1",
        taskId: envelope.taskId ?? "task-1",
        tenantId: envelope.tenantId,
        resultRef: "artifact:assessment-1",
        errorCode: null,
      }),
    (error: unknown) => error instanceof ValidationError && error.code === "execution_receipt.legacy_contract_forbidden",
  );
});
