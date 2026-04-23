import assert from "node:assert/strict";
import test from "node:test";
import { UserExperienceOrchestrationService } from "../../../src/interaction/ux/user-experience-orchestration-service.js";
test("integration: user experience orchestration bridges onboarding plan and workflow builder draft", async () => {
    const service = new UserExperienceOrchestrationService();
    const result = await service.bootstrap({
        session: {
            userId: "user_ops",
            tenantId: "tenant_ops",
        },
        context: {
            memberCount: 8,
            departmentCount: 1,
            requiresSso: false,
        },
        userRole: "operator",
        businessDescription: "构建一个审批后发 Slack 通知的入门自动化",
        template: {
            templateId: "approval_notify",
            title: "Approval then Notify",
            steps: ["approval", "notify"],
        },
        wizardSession: {
            sessionId: "wizard_ops",
            currentStepId: "capability_setup",
            steps: [
                { stepId: "business_type", title: "业务类型", completed: true },
                { stepId: "capability_setup", title: "能力配置", completed: true },
            ],
        },
        components: [
            {
                componentId: "approval_gate",
                name: "Approval",
                icon: "shield",
                domainId: "operations",
                riskLevel: "medium",
                configSchema: {},
                previewDescription: "approval",
            },
            {
                componentId: "output_slack",
                name: "Slack Notify",
                icon: "message",
                domainId: "operations",
                riskLevel: "low",
                configSchema: {},
                previewDescription: "notify",
            },
        ],
    });
    assert.equal(result.guidedSession.currentStep, "capability_setup");
    assert.equal(result.draft.validationFindings.length, 0);
    assert.equal(result.wizard.steps.length >= 4, true);
});
//# sourceMappingURL=user-experience-orchestration-integration.test.js.map