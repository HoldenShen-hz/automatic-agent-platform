import assert from "node:assert/strict";
import test from "node:test";

import { UserExperienceOrchestrationService } from "../../../../src/interaction/ux/user-experience-orchestration-service.js";
import type {
  GuidedOnboardingSession,
  WorkflowBuilderDraft,
  UserExperienceBootstrapRequest,
} from "../../../../src/interaction/ux/user-experience-orchestration-service.js";
import type { WizardSession } from "../../../../src/interaction/ux/wizard/index.js";
import type { InteractionTemplate } from "../../../../src/interaction/ux/template-engine/index.js";
import type {
  UserPortalSession,
  UserPortalContext,
  DomainOnboardingWizard,
  DraggableComponent,
} from "../../../../src/interaction/ux/onboarding/index.js";

test("UserExperienceOrchestrationService.bootstrap builds guided session, wizard, and draft", async () => {
  const service = new UserExperienceOrchestrationService();
  const result = await service.bootstrap({
    session: {
      userId: "user_1",
      tenantId: "tenant_1",
    },
    context: {
      memberCount: 3,
      departmentCount: 1,
      requiresSso: false,
    },
    userRole: "operator",
    businessDescription: "为研发团队搭建代码交付自动化",
    template: {
      templateId: "tpl_coding",
      title: "Coding Workflow",
      steps: ["Plan", "Execute", "Review"],
    },
    wizardSession: {
      sessionId: "wizard_1",
      currentStepId: "step_2",
      steps: [
        { stepId: "step_1", title: "Step 1", completed: true },
        { stepId: "step_2", title: "Step 2", completed: true },
        { stepId: "step_3", title: "Step 3", completed: false },
      ],
    },
    components: [
      {
        componentId: "planner_action",
        name: "Plan",
        icon: "plan",
        domainId: "coding",
        riskLevel: "low",
        configSchema: {},
        previewDescription: "Plan workflow steps",
      },
      {
        componentId: "executor_action",
        name: "Execute",
        icon: "play",
        domainId: "coding",
        riskLevel: "medium",
        configSchema: {},
        previewDescription: "Execute the generated plan",
      },
    ],
  });

  assert.match(result.guidedSession.sessionId, /^portal_session_/);
  assert.equal(result.guidedSession.userRole, "operator");
  assert.equal(result.guidedSession.currentStep, "step_2");
  assert.deepEqual(result.guidedSession.completedSteps, ["step_1", "step_2"]);
  assert.ok(result.guidedSession.recommendedTemplates.includes("tpl_coding"));
  assert.ok(result.guidedSession.recommendedTemplates.length <= 4);
  assert.equal(result.draft.ownerUserId, "user_1");
  assert.ok(result.draft.workflowId);
  assert.equal(result.draft.planGraph.nodes.length, 3);
  assert.equal(result.draft.planGraph.edges.length, 2);
  assert.ok(result.recommendedDomains.includes("engineering_ops"));
  assert.ok(result.wizard.recommendedDomains.includes("engineering_ops"));
  assert.match(result.welcomePrompt, /team 模式/);
});

test("GuidedOnboardingSession interface structure", () => {
  const session: GuidedOnboardingSession = {
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
  const roles: GuidedOnboardingSession["userRole"][] = ["operator", "domain_admin", "platform_ops", "fleet_admin"];

  for (const role of roles) {
    const session: GuidedOnboardingSession = {
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
  const draft: WorkflowBuilderDraft = {
    draftId: "draft_1",
    workflowId: "wf_1",
    planGraph: {
      nodes: [
        { nodeId: "step_1", label: "Step 1", inputBindings: [], outputKey: "output_1" },
        { nodeId: "step_2", label: "Step 2", inputBindings: [], outputKey: "output_2" },
      ],
      edges: [{ fromNodeId: "step_1", toNodeId: "step_2", dependencyType: "hard" }],
    },
    validationFindings: ["finding_1"],
    ownerUserId: "user_1",
  };

  assert.equal(draft.draftId, "draft_1");
  assert.equal(draft.workflowId, "wf_1");
  assert.equal(draft.planGraph.nodes.length, 2);
  assert.equal(draft.planGraph.edges.length, 1);
  assert.deepEqual(draft.validationFindings, ["finding_1"]);
  assert.equal(draft.ownerUserId, "user_1");
});

test("WorkflowBuilderDraft allows optional workflowId", () => {
  const draft: WorkflowBuilderDraft = {
    draftId: "draft_1",
    planGraph: {
      nodes: [],
      edges: [],
    },
    validationFindings: [],
    ownerUserId: "user_1",
  };

  assert.equal(draft.workflowId, undefined);
});

test("UserExperienceBootstrapRequest interface structure", () => {
  const wizardSession: WizardSession = {
    sessionId: "wizard_session",
    currentStepId: "step_1",
    steps: [
      { stepId: "step_1", title: "Step 1", completed: true },
    ],
  };
  const template: InteractionTemplate = {
    templateId: "tpl_1",
    title: "Template",
    steps: ["Step 1"],
  };
  const portalSession: UserPortalSession = {
    userId: "user_1",
    tenantId: "tenant_1",
  };
  const context: UserPortalContext = {
    memberCount: 1,
    departmentCount: 1,
    requiresSso: false,
  };
  const wizard: DomainOnboardingWizard = {
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
  const components: readonly DraggableComponent[] = [];

  const request: UserExperienceBootstrapRequest = {
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
