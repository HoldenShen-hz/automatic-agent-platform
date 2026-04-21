import assert from "node:assert/strict";
import test from "node:test";
import { WorkflowBuilderService } from "../../../src/interaction/ux/workflow-builder-service.js";
test("WorkflowBuilderService builds workflow canvas and blocks wizard advance when current step incomplete", () => {
    const service = new WorkflowBuilderService();
    const result = service.build({
        session: {
            sessionId: "wizard_1",
            currentStepId: "capability_setup",
            steps: [
                { stepId: "business_type", title: "Business", completed: true },
                { stepId: "capability_setup", title: "Capability", completed: false },
            ],
        },
        template: {
            templateId: "tpl_release",
            title: "Release Template",
            steps: ["select trigger", "deploy", "notify output"],
        },
        onboardingWizard: {
            steps: [
                { stepId: "business_type", title: "Business", description: "desc" },
                { stepId: "capability_setup", title: "Capability", description: "desc" },
                { stepId: "risk_setup", title: "Risk", description: "desc" },
                { stepId: "activation", title: "Activation", description: "desc" },
            ],
            recommendedDomains: ["coding"],
            defaultMode: {
                mode: "team",
                autoDetected: true,
                features: {
                    multiTenancy: false,
                    approvalEngine: "simple",
                    securityReview: "auto_plus_manual",
                    onboarding: "guided_1week",
                    dashboardLevels: ["L1", "L2"],
                    governance: "delegated",
                },
                upgradePath: "grow",
            },
        },
        components: [
            {
                componentId: "trigger_release",
                name: "Release Trigger",
                icon: "rocket",
                domainId: "coding",
                riskLevel: "medium",
                configSchema: {},
                previewDescription: "select trigger",
            },
            {
                componentId: "action_deploy",
                name: "Deploy",
                icon: "ship",
                domainId: "coding",
                riskLevel: "high",
                configSchema: {},
                previewDescription: "deploy",
            },
        ],
    });
    assert.equal(result.builder.canvas.nodes.length, 3);
    assert.equal(result.nextStepAllowed, false);
    assert.equal(result.builder.validation.valid, false);
});
//# sourceMappingURL=workflow-builder-service.test.js.map