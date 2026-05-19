import assert from "node:assert/strict";
import test from "node:test";
import { ApprovalService } from "../../src/platform/control-plane/approval-center/approval-service.js";
import { evaluateAuthorizationContext, resolvePrincipalAccessProfile, } from "../../src/platform/control-plane/iam/access-model.js";
import { createSeededE2EHarness } from "../helpers/e2e-harness.js";
test("E2E: access governance bridges principal context decisions into approval flow", () => {
    const harness = createSeededE2EHarness("aa-e2e-access-governance-", {
        taskId: "task-access-governance",
        executionId: "exec-access-governance",
    });
    try {
        const pluginProfile = resolvePrincipalAccessProfile({
            principalType: "plugin",
        });
        const deniedPluginDecision = evaluateAuthorizationContext({
            principalType: pluginProfile.principalType,
            roles: pluginProfile.roles,
            action: "network_access",
            context: {
                pluginTrusted: false,
            },
        });
        assert.equal(deniedPluginDecision.allowed, false);
        assert.equal(deniedPluginDecision.reasonCode, "policy.context_plugin_trust_required");
        const trustedPluginDecision = evaluateAuthorizationContext({
            principalType: pluginProfile.principalType,
            roles: pluginProfile.roles,
            action: "network_access",
            context: {
                pluginTrusted: true,
            },
        });
        assert.equal(trustedPluginDecision.allowed, true);
        assert.equal(trustedPluginDecision.requiresApproval, false);
        const viewerDecision = evaluateAuthorizationContext({
            principalType: "user",
            roles: ["viewer"],
            action: "exec_command",
            context: {
                environment: "production",
            },
        });
        assert.equal(viewerDecision.allowed, false);
        assert.equal(viewerDecision.reasonCode, "policy.context_production_operator_required");
        const operatorDecision = evaluateAuthorizationContext({
            principalType: "user",
            roles: ["human_operator"],
            action: "exec_command",
            context: {
                environment: "production",
                manualTakeoverActive: true,
            },
        });
        assert.equal(operatorDecision.allowed, true);
        assert.deepEqual(operatorDecision.matchedRuleRefs, ["context.manual_takeover_active"]);
        const agentProfile = resolvePrincipalAccessProfile({
            principalType: "agent",
        });
        const regulatedDecision = evaluateAuthorizationContext({
            principalType: agentProfile.principalType,
            roles: agentProfile.roles,
            action: "write_file",
            mode: "full-auto",
            riskCategory: "sensitive_data",
            context: {
                tenantId: "tenant-risk",
                requiresTenantScope: true,
                dataClassification: "regulated",
            },
        });
        assert.equal(regulatedDecision.allowed, true);
        assert.equal(regulatedDecision.requiresApproval, true);
        assert.equal(regulatedDecision.reasonCode, "policy.context_regulated_data_requires_approval");
        const approvals = new ApprovalService(harness.db, harness.store);
        const approval = approvals.createRequest({
            taskId: "task-access-governance",
            executionId: "exec-access-governance",
            sourceAgentId: "agent-runtime",
            reason: regulatedDecision.explainSummary,
            riskLevel: "high",
            options: ["approve", "reject"],
            context: {
                action: "write_file",
                constraints: regulatedDecision.constraints,
                matchedRuleRefs: regulatedDecision.matchedRuleRefs,
            },
            timeoutPolicy: "reject",
        });
        approvals.applyDecision({
            approvalId: approval.approvalId,
            decisionType: "option_selected",
            selectedOptionId: "approve",
            respondedBy: "operator-1",
            respondedAt: "2026-04-24T11:00:00.000Z",
        });
        const approvalRecord = harness.store.getApproval(approval.approvalId);
        const approvalResponse = JSON.parse(approvalRecord?.responseJson ?? "{}");
        assert.equal(approvalRecord?.status, "approved");
        assert.equal(approvalResponse.selectedOptionId, "approve");
        const eventTypes = harness.store.listEventsForTask("task-access-governance").map((event) => event.eventType);
        assert.ok(eventTypes.includes("decision:requested"));
        assert.ok(eventTypes.includes("decision:responded"));
    }
    finally {
        harness.cleanup();
    }
});
//# sourceMappingURL=access-governance-flow.test.js.map