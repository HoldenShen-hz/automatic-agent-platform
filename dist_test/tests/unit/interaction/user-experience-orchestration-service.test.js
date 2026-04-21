import assert from "node:assert/strict";
import test from "node:test";
import { UserExperienceOrchestrationService } from "../../../src/interaction/ux/user-experience-orchestration-service.js";
test("UserExperienceOrchestrationService creates guided onboarding session and workflow draft", async () => {
    const service = new UserExperienceOrchestrationService();
    const result = await service.bootstrap({
        session: {
            userId: "user_1",
            tenantId: "tenant_1",
            displayName: "Alice",
            preferredLocale: "zh-CN",
        },
        context: {
            memberCount: 25,
            departmentCount: 3,
            requiresSso: false,
        },
        userRole: "domain_admin",
        businessDescription: "我们需要一套运营自动化 onboarding 和审批流程",
        template: {
            templateId: "tmpl_ops",
            title: "Ops Flow",
            steps: ["collect requirement", "approval", "notify"],
        },
        wizardSession: {
            sessionId: "wizard_1",
            currentStepId: "business_type",
            steps: [
                { stepId: "business_type", title: "业务类型", completed: true },
                { stepId: "capability_setup", title: "能力配置", completed: false },
            ],
        },
        components: [
            {
                componentId: "trigger_requirement",
                name: "Requirement Trigger",
                icon: "bolt",
                domainId: "operations",
                riskLevel: "low",
                configSchema: {},
                previewDescription: "collect requirement",
            },
            {
                componentId: "approval_node",
                name: "Approval",
                icon: "shield",
                domainId: "operations",
                riskLevel: "medium",
                configSchema: {},
                previewDescription: "approval",
            },
        ],
    });
    assert.equal(result.guidedSession.userRole, "domain_admin");
    assert.deepEqual(result.guidedSession.completedSteps, ["business_type"]);
    assert.equal(result.draft.steps.length, 3);
    assert.equal(result.recommendedDomains.length > 0, true);
});
//# sourceMappingURL=user-experience-orchestration-service.test.js.map