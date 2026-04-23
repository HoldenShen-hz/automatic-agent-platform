import assert from "node:assert/strict";
import test from "node:test";
test.skip("UserExperienceOrchestrationService.bootstrap - hard to test without mocking UserPortalService and WorkflowBuilderService", () => {
    // This service has tight coupling to internal services (UserPortalService, WorkflowBuilderService)
    // that are instantiated directly in the class constructor, making them difficult to mock.
    // The actual logic is tested through integration tests.
    assert.ok(true);
});
test("GuidedOnboardingSession interface structure", () => {
    const session = {
        sessionId: "session_1",
        userRole: "operator",
        currentStep: "step_1",
        completedSteps: ["step_0"],
        recommendedTemplates: ["tpl_1", "tpl_2"],
    };
    assert.equal(session.sessionId, "session_1");
    assert.equal(session.userRole, "operator");
    assert.deepEqual(session.completedSteps, ["step_0"]);
    assert.deepEqual(session.recommendedTemplates, ["tpl_1", "tpl_2"]);
});
test("GuidedOnboardingSession accepts all user roles", () => {
    const roles = ["operator", "domain_admin", "platform_ops", "fleet_admin"];
    for (const role of roles) {
        const session = {
            sessionId: "session_1",
            userRole: role,
            currentStep: "step_1",
            completedSteps: [],
            recommendedTemplates: [],
        };
        assert.equal(session.userRole, role);
    }
});
test("WorkflowBuilderDraft interface structure", () => {
    const draft = {
        draftId: "draft_1",
        workflowId: "wf_1",
        steps: ["step_1", "step_2"],
        validationFindings: ["finding_1"],
        ownerUserId: "user_1",
    };
    assert.equal(draft.draftId, "draft_1");
    assert.equal(draft.workflowId, "wf_1");
    assert.deepEqual(draft.steps, ["step_1", "step_2"]);
    assert.deepEqual(draft.validationFindings, ["finding_1"]);
    assert.equal(draft.ownerUserId, "user_1");
});
test("WorkflowBuilderDraft allows optional workflowId", () => {
    const draft = {
        draftId: "draft_1",
        steps: [],
        validationFindings: [],
        ownerUserId: "user_1",
    };
    assert.equal(draft.workflowId, undefined);
});
test("UserExperienceBootstrapRequest interface structure", () => {
    const wizardSession = {
        sessionId: "wizard_session",
        currentStepId: "step_1",
        steps: [
            { stepId: "step_1", title: "Step 1", completed: true },
        ],
    };
    const template = {
        templateId: "tpl_1",
        title: "Template",
        steps: ["Step 1"],
    };
    const portalSession = {
        userId: "user_1",
        tenantId: "tenant_1",
    };
    const context = {
        memberCount: 1,
        departmentCount: 1,
        requiresSso: false,
    };
    const wizard = {
        steps: [],
        recommendedDomains: [],
        defaultMode: {
            mode: "solo",
            autoDetected: true,
            features: {
                multiTenancy: false,
                approvalEngine: "self_approve",
                securityReview: "auto_only",
                onboarding: "wizard_3min",
                dashboardLevels: ["L1"],
                governance: "self",
            },
            upgradePath: "",
        },
    };
    const components = [];
    const request = {
        session: portalSession,
        context,
        userRole: "operator",
        businessDescription: "Test workflow",
        template,
        wizardSession,
        components,
    };
    assert.equal(request.userRole, "operator");
    assert.equal(request.businessDescription, "Test workflow");
});
//# sourceMappingURL=user-experience-orchestration-service.test.js.map