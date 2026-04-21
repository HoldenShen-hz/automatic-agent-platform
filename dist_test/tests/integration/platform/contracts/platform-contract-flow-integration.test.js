import assert from "node:assert/strict";
import test from "node:test";
import { createControlDirective } from "../../../../src/platform/contracts/control-directive/index.js";
import { createDelegationRequest } from "../../../../src/platform/contracts/delegation-request/index.js";
import { createExecutionPlan } from "../../../../src/platform/contracts/execution-plan/index.js";
import { createExecutionReceipt } from "../../../../src/platform/contracts/execution-receipt/index.js";
import { createModelRequest } from "../../../../src/platform/contracts/model-request/index.js";
import { createRequestEnvelope } from "../../../../src/platform/contracts/request-envelope/index.js";
import { createStateCommand } from "../../../../src/platform/contracts/state-command/index.js";
test("integration: platform contract objects compose into a consistent request-plan-receipt flow", () => {
    const envelope = createRequestEnvelope({
        requestId: "request-1",
        taskId: "task-1",
        tenantId: "tenant-1",
        sessionId: "session-1",
        traceId: "trace-1",
        mode: "async",
        body: { prompt: "deploy the approved change" },
    });
    const modelRequest = createModelRequest({
        model: "gpt-5.4-mini",
        messages: [{ role: "user", content: String(envelope.body.prompt) }],
        temperature: 0.1,
        maxTokens: 512,
        tenantId: envelope.tenantId,
        taskId: envelope.taskId,
    });
    const plan = createExecutionPlan({
        taskId: envelope.taskId ?? "task-1",
        tenantId: envelope.tenantId,
        version: 1,
        steps: [
            { stepId: "step-1", title: "Assess request", actionRef: "model.assess", dependsOn: [], requiresApproval: false },
            { stepId: "step-2", title: "Deploy rollout", actionRef: "rollout.advance", dependsOn: ["step-1"], requiresApproval: true },
        ],
    });
    const delegation = createDelegationRequest({
        taskId: plan.taskId,
        fromAgentId: "planner",
        toAgentId: "executor",
        capabilityRef: null,
        priority: "critical",
        reason: "execute approved rollout",
        contextRef: modelRequest.requestId,
        tenantId: plan.tenantId,
    });
    const directive = createControlDirective({
        kind: "escalate",
        targetRef: plan.steps[1].stepId,
        reasonCode: "approval.required",
        issuedBy: "policy-center",
        tenantId: plan.tenantId,
        executionId: null,
        metadata: { delegationRequestId: delegation.requestId },
    });
    const command = createStateCommand({
        entityKind: "execution_plan",
        entityId: plan.planId,
        action: "transition",
        expectedVersion: 1,
        payload: { nextStatus: "awaiting_approval", directiveId: directive.directiveId },
        emittedBy: "planner",
    });
    const receipt = createExecutionReceipt({
        planId: plan.planId,
        stepId: plan.steps[0].stepId,
        status: "completed",
        workerId: "worker-1",
        taskId: plan.taskId,
        tenantId: plan.tenantId,
        resultRef: "artifact:assessment-1",
        errorCode: null,
    });
    assert.equal(modelRequest.taskId, envelope.taskId);
    assert.equal(plan.steps[1]?.requiresApproval, true);
    assert.equal(delegation.contextRef, modelRequest.requestId);
    assert.equal(directive.metadata.delegationRequestId, delegation.requestId);
    assert.equal(command.payload.directiveId, directive.directiveId);
    assert.equal(receipt.resultRef, "artifact:assessment-1");
});
//# sourceMappingURL=platform-contract-flow-integration.test.js.map