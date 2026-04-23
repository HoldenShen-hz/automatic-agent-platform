import assert from "node:assert/strict";
import test from "node:test";
import { WorkflowBuilderService } from "../../../../src/interaction/ux/workflow-builder-service.js";
test("WorkflowBuilderService.build creates builder with canvas nodes", () => {
    const service = new WorkflowBuilderService();
    const session = {
        sessionId: "session_1",
        currentStepId: "step_1",
        steps: [
            { stepId: "step_1", title: "Step 1", completed: true },
            { stepId: "step_2", title: "Step 2", completed: false },
        ],
    };
    const template = {
        templateId: "tpl_1",
        title: "Test Template",
        steps: ["Create Task", "Approve Task"],
    };
    const wizard = {
        steps: [],
        recommendedDomains: ["general_ops"],
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
            upgradePath: "path",
        },
    };
    const components = [];
    const result = service.build({ session, template, onboardingWizard: wizard, components });
    assert.equal(result.session, session);
    assert.equal(result.template.templateId, "tpl_1");
    assert.ok(Array.isArray(result.builder.canvas.nodes));
    assert.ok(Array.isArray(result.builder.canvas.edges));
    assert.ok(Array.isArray(result.builder.componentPalette));
    assert.ok(result.builder.livePreview != null);
    assert.ok(result.builder.validation != null);
});
test("WorkflowBuilderService.build creates correct number of nodes from template steps", () => {
    const service = new WorkflowBuilderService();
    const session = {
        sessionId: "session_1",
        currentStepId: "step_1",
        steps: [
            { stepId: "step_1", title: "Step 1", completed: true },
        ],
    };
    const template = {
        templateId: "tpl_1",
        title: "Test",
        steps: ["Step A", "Step B", "Step C"],
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
    const result = service.build({ session, template, onboardingWizard: wizard, components: [] });
    assert.equal(result.builder.canvas.nodes.length, 3);
    assert.equal(result.builder.canvas.edges.length, 2);
});
test("WorkflowBuilderService.build creates edges between consecutive nodes", () => {
    const service = new WorkflowBuilderService();
    const session = {
        sessionId: "session_1",
        currentStepId: "step_1",
        steps: [
            { stepId: "step_1", title: "Step 1", completed: true },
        ],
    };
    const template = {
        templateId: "tpl_1",
        title: "Test",
        steps: ["A", "B", "C"],
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
    const result = service.build({ session, template, onboardingWizard: wizard, components: [] });
    assert.equal(result.builder.canvas.edges[0].fromNodeId, "node_1");
    assert.equal(result.builder.canvas.edges[0].toNodeId, "node_2");
    assert.equal(result.builder.canvas.edges[1].fromNodeId, "node_2");
    assert.equal(result.builder.canvas.edges[1].toNodeId, "node_3");
});
test("WorkflowBuilderService.build sets nextStepAllowed based on wizard state", () => {
    const service = new WorkflowBuilderService();
    const sessionCompleted = {
        sessionId: "session_1",
        currentStepId: "step_1",
        steps: [
            { stepId: "step_1", title: "Step 1", completed: true },
        ],
    };
    const sessionNotCompleted = {
        sessionId: "session_2",
        currentStepId: "step_1",
        steps: [
            { stepId: "step_1", title: "Step 1", completed: false },
        ],
    };
    const template = {
        templateId: "tpl_1",
        title: "Test",
        steps: ["Step 1"],
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
    const resultCompleted = service.build({ session: sessionCompleted, template, onboardingWizard: wizard, components: [] });
    const resultNotCompleted = service.build({ session: sessionNotCompleted, template, onboardingWizard: wizard, components: [] });
    assert.equal(resultCompleted.nextStepAllowed, true);
    assert.equal(resultNotCompleted.nextStepAllowed, false);
});
test("WorkflowBuilderService.build validates builder correctly when step allowed", () => {
    const service = new WorkflowBuilderService();
    const session = {
        sessionId: "session_1",
        currentStepId: "step_1",
        steps: [
            { stepId: "step_1", title: "Step 1", completed: true },
        ],
    };
    const template = {
        templateId: "tpl_1",
        title: "Test",
        steps: ["Step 1"],
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
    const result = service.build({ session, template, onboardingWizard: wizard, components: [] });
    assert.equal(result.builder.validation.valid, true);
    assert.deepEqual(result.builder.validation.messages, []);
});
test("WorkflowBuilderService.build provides validation message when step not allowed", () => {
    const service = new WorkflowBuilderService();
    const session = {
        sessionId: "session_1",
        currentStepId: "step_1",
        steps: [
            { stepId: "step_1", title: "Step 1", completed: false },
        ],
    };
    const template = {
        templateId: "tpl_1",
        title: "Test",
        steps: ["Step 1"],
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
    const result = service.build({ session, template, onboardingWizard: wizard, components: [] });
    assert.equal(result.builder.validation.valid, false);
    assert.ok(result.builder.validation.messages.length > 0);
    assert.ok(result.builder.validation.messages[0].includes("step_1"));
});
test("WorkflowBuilderService.build builds live preview with estimated duration and cost", () => {
    const service = new WorkflowBuilderService();
    const session = {
        sessionId: "session_1",
        currentStepId: "step_1",
        steps: [
            { stepId: "step_1", title: "Step 1", completed: true },
        ],
    };
    const template = {
        templateId: "tpl_1",
        title: "Test",
        steps: ["Step 1", "Step 2", "Step 3"],
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
    const result = service.build({ session, template, onboardingWizard: wizard, components: [] });
    assert.ok(result.builder.livePreview.estimatedDuration.includes("min"));
    assert.ok(result.builder.livePreview.estimatedCost.includes("$"));
    assert.ok(Array.isArray(result.builder.livePreview.stepByStepDescription));
});
test("WorkflowBuilderService.build risk assessment is needs review when steps incomplete", () => {
    const service = new WorkflowBuilderService();
    const session = {
        sessionId: "session_1",
        currentStepId: "step_1",
        steps: [
            { stepId: "step_1", title: "Step 1", completed: false },
        ],
    };
    const template = {
        templateId: "tpl_1",
        title: "Test",
        steps: ["Step 1"],
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
    const result = service.build({ session, template, onboardingWizard: wizard, components: [] });
    assert.equal(result.builder.livePreview.riskAssessment, "needs review");
});
test("WorkflowBuilderService.build risk assessment is ready when all steps complete", () => {
    const service = new WorkflowBuilderService();
    const session = {
        sessionId: "session_1",
        currentStepId: "step_1",
        steps: [
            { stepId: "step_1", title: "Step 1", completed: true },
        ],
    };
    const template = {
        templateId: "tpl_1",
        title: "Test",
        steps: ["Step 1"],
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
    const result = service.build({ session, template, onboardingWizard: wizard, components: [] });
    assert.equal(result.builder.livePreview.riskAssessment, "ready");
});
test("WorkflowBuilderService.build categorizes components by componentId patterns", () => {
    const service = new WorkflowBuilderService();
    const session = {
        sessionId: "session_1",
        currentStepId: "step_1",
        steps: [
            { stepId: "step_1", title: "Step 1", completed: true },
        ],
    };
    const template = {
        templateId: "tpl_1",
        title: "Test",
        steps: ["Step 1"],
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
    const components = [
        {
            componentId: "my_trigger",
            name: "Trigger",
            icon: "play",
            domainId: "platform",
            riskLevel: "low",
            configSchema: {},
            previewDescription: "trigger",
        },
        {
            componentId: "my_approval",
            name: "Approval",
            icon: "check",
            domainId: "platform",
            riskLevel: "medium",
            configSchema: {},
            previewDescription: "approval",
        },
    ];
    const result = service.build({ session, template, onboardingWizard: wizard, components });
    assert.ok(result.builder.componentPalette.length > 0);
    const categories = result.builder.componentPalette.map(p => p.category);
    assert.ok(categories.includes("trigger"));
    assert.ok(categories.includes("approval"));
});
test("WorkflowBuilderService.build matches components to template steps by preview description", () => {
    const service = new WorkflowBuilderService();
    const session = {
        sessionId: "session_1",
        currentStepId: "step_1",
        steps: [
            { stepId: "step_1", title: "Step 1", completed: true },
        ],
    };
    const template = {
        templateId: "tpl_1",
        title: "Test",
        steps: ["Create Task"],
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
    const components = [
        {
            componentId: "task_create_action",
            name: "Create Task",
            icon: "plus",
            domainId: "platform",
            riskLevel: "low",
            configSchema: {},
            previewDescription: "Creates a new task",
        },
    ];
    const result = service.build({ session, template, onboardingWizard: wizard, components });
    assert.equal(result.builder.canvas.nodes[0].componentId, "task_create_action");
});
test("WorkflowBuilderService.build falls back to template_step when no component matches", () => {
    const service = new WorkflowBuilderService();
    const session = {
        sessionId: "session_1",
        currentStepId: "step_1",
        steps: [
            { stepId: "step_1", title: "Step 1", completed: true },
        ],
    };
    const template = {
        templateId: "tpl_1",
        title: "Test",
        steps: ["Unknown Step"],
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
    const result = service.build({ session, template, onboardingWizard: wizard, components });
    assert.equal(result.builder.canvas.nodes[0].componentId, "template_step_1");
});
//# sourceMappingURL=workflow-builder-service.test.js.map