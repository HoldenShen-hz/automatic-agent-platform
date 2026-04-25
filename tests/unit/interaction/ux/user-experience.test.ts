import assert from "node:assert/strict";
import test from "node:test";

import type {
  GuidedOnboardingSession,
  WorkflowBuilderDraft,
  UserExperienceBootstrapRequest,
  UserExperienceBootstrapResult,
} from "../../../../src/interaction/ux/user-experience-orchestration-service.js";
import type { WizardSession } from "../../../../src/interaction/ux/wizard/index.js";
import type { InteractionTemplate } from "../../../../src/interaction/ux/template-engine/index.js";
import type {
  UserPortalSession,
  UserPortalContext,
  DomainOnboardingWizard,
  DraggableComponent,
} from "../../../../src/interaction/ux/onboarding/index.js";

test("GuidedOnboardingSession structure with all fields", () => {
  const session: GuidedOnboardingSession = {
    sessionId: "session_abc123",
    userRole: "operator",
    currentStep: "step_setup",
    completedSteps: ["step_welcome", "step_profile"],
    recommendedTemplates: ["tpl_coding", "tpl_deploy", "tpl_review"],
  };

  assert.equal(session.sessionId, "session_abc123");
  assert.equal(session.userRole, "operator");
  assert.equal(session.currentStep, "step_setup");
  assert.deepEqual(session.completedSteps, ["step_welcome", "step_profile"]);
  assert.deepEqual(session.recommendedTemplates, ["tpl_coding", "tpl_deploy", "tpl_review"]);
});

test("GuidedOnboardingSession accepts domain_admin role", () => {
  const session: GuidedOnboardingSession = {
    sessionId: "session_1",
    userRole: "domain_admin",
    currentStep: "step_1",
    completedSteps: [],
    recommendedTemplates: [],
  };

  assert.equal(session.userRole, "domain_admin");
});

test("GuidedOnboardingSession accepts platform_ops role", () => {
  const session: GuidedOnboardingSession = {
    sessionId: "session_2",
    userRole: "platform_ops",
    currentStep: "step_1",
    completedSteps: [],
    recommendedTemplates: [],
  };

  assert.equal(session.userRole, "platform_ops");
});

test("GuidedOnboardingSession accepts fleet_admin role", () => {
  const session: GuidedOnboardingSession = {
    sessionId: "session_3",
    userRole: "fleet_admin",
    currentStep: "step_1",
    completedSteps: [],
    recommendedTemplates: [],
  };

  assert.equal(session.userRole, "fleet_admin");
});

test("GuidedOnboardingSession with empty completed steps", () => {
  const session: GuidedOnboardingSession = {
    sessionId: "session_new",
    userRole: "operator",
    currentStep: "step_1",
    completedSteps: [],
    recommendedTemplates: ["tpl_default"],
  };

  assert.deepEqual(session.completedSteps, []);
  assert.equal(session.recommendedTemplates.length, 1);
});

test("WorkflowBuilderDraft structure with all fields", () => {
  const draft: WorkflowBuilderDraft = {
    draftId: "draft_full",
    workflowId: "wf_12345",
    steps: ["Initialize", "Process", "Finalize", "Deliver"],
    validationFindings: ["No issues found", "All components connected"],
    ownerUserId: "user_founder",
  };

  assert.equal(draft.draftId, "draft_full");
  assert.equal(draft.workflowId, "wf_12345");
  assert.deepEqual(draft.steps, ["Initialize", "Process", "Finalize", "Deliver"]);
  assert.deepEqual(draft.validationFindings, ["No issues found", "All components connected"]);
  assert.equal(draft.ownerUserId, "user_founder");
});

test("WorkflowBuilderDraft without workflowId is valid", () => {
  const draft: WorkflowBuilderDraft = {
    draftId: "draft_no_workflow",
    steps: [],
    validationFindings: [],
    ownerUserId: "user_guest",
  };

  assert.equal(draft.draftId, "draft_no_workflow");
  assert.strictEqual(draft.workflowId, undefined);
  assert.deepEqual(draft.steps, []);
});

test("WorkflowBuilderDraft with single validation finding", () => {
  const draft: WorkflowBuilderDraft = {
    draftId: "draft_warning",
    steps: ["Step A"],
    validationFindings: ["Warning: Risk level is high"],
    ownerUserId: "user_warner",
  };

  assert.equal(draft.validationFindings.length, 1);
  assert.ok(draft.validationFindings[0].includes("Risk level is high"));
});

test("UserExperienceBootstrapRequest requires all fields", () => {
  const wizardSession: WizardSession = {
    sessionId: "wizard_req",
    currentStepId: "step_1",
    steps: [{ stepId: "step_1", title: "First Step", completed: false }],
  };

  const template: InteractionTemplate = {
    templateId: "tpl_req",
    title: "Required Template",
    steps: ["Step 1", "Step 2"],
  };

  const portalSession: UserPortalSession = {
    userId: "user_req",
    tenantId: "tenant_req",
  };

  const context: UserPortalContext = {
    memberCount: 5,
    departmentCount: 2,
    requiresSso: false,
  };

  const wizard: DomainOnboardingWizard = {
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
      upgradePath: "Invite collaborators to unlock team mode.",
    },
  };

  const components: readonly DraggableComponent[] = [];

  const request: UserExperienceBootstrapRequest = {
    session: portalSession,
    context,
    userRole: "operator",
    businessDescription: "Testing workflow",
    template,
    wizardSession,
    components,
  };

  assert.equal(request.userRole, "operator");
  assert.equal(request.businessDescription, "Testing workflow");
  assert.deepEqual(request.components, []);
});

test("UserExperienceBootstrapRequest with SSO context", () => {
  const wizardSession: WizardSession = {
    sessionId: "wizard_sso",
    currentStepId: "step_1",
    steps: [],
  };

  const template: InteractionTemplate = {
    templateId: "tpl_sso",
    title: "Enterprise Template",
    steps: [],
  };

  const portalSession: UserPortalSession = {
    userId: "user_ent",
    tenantId: "tenant_ent",
    displayName: "Enterprise User",
    preferredLocale: "en-US",
  };

  const context: UserPortalContext = {
    memberCount: 500,
    departmentCount: 10,
    requiresSso: true,
  };

  const wizard: DomainOnboardingWizard = {
    steps: [
      {
        stepId: "business_type",
        title: "Select Business Type",
        description: "Choose your organization type.",
      },
    ],
    recommendedDomains: ["finance", "hr", "engineering_ops"],
    defaultMode: {
      mode: "enterprise",
      autoDetected: true,
      features: {
        multiTenancy: true,
        approvalEngine: "full",
        securityReview: "full_team",
        onboarding: "runbook_full",
        dashboardLevels: ["L1", "L2", "L3", "L4"],
        governance: "hierarchical",
      },
      upgradePath: "Enterprise features activated.",
    },
  };

  const components: readonly DraggableComponent[] = [
    {
      componentId: "finance_action",
      name: "Finance Action",
      icon: "dollar",
      domainId: "finance",
      riskLevel: "critical",
      configSchema: { type: "object" },
      previewDescription: "Financial transaction handler",
    },
  ];

  const request: UserExperienceBootstrapRequest = {
    session: portalSession,
    context,
    userRole: "fleet_admin",
    businessDescription: "Large enterprise with finance and HR",
    template,
    wizardSession,
    components,
  };

  assert.equal(request.context.requiresSso, true);
  assert.equal(request.context.memberCount, 500);
  assert.equal(request.userRole, "fleet_admin");
  assert.equal(request.components.length, 1);
  assert.equal(request.components[0].riskLevel, "critical");
});

test("UserExperienceBootstrapResult structure", () => {
  const result: UserExperienceBootstrapResult = {
    guidedSession: {
      sessionId: "result_session",
      userRole: "operator",
      currentStep: "step_final",
      completedSteps: ["step_1", "step_2", "step_3"],
      recommendedTemplates: ["tpl_1", "tpl_2"],
    },
    wizard: {
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
        upgradePath: "",
      },
    },
    draft: {
      draftId: "result_draft",
      workflowId: "wf_result",
      steps: ["A", "B", "C"],
      validationFindings: [],
      ownerUserId: "user_result",
    },
    recommendedDomains: ["engineering_ops", "general_ops"],
    welcomePrompt: "Welcome to the platform!",
  };

  assert.equal(result.guidedSession.sessionId, "result_session");
  assert.equal(result.draft.draftId, "result_draft");
  assert.ok(result.recommendedDomains.includes("engineering_ops"));
  assert.ok(result.welcomePrompt.startsWith("Welcome"));
});

test("UserExperienceBootstrapResult with department mode", () => {
  const result: UserExperienceBootstrapResult = {
    guidedSession: {
      sessionId: "dept_session",
      userRole: "domain_admin",
      currentStep: "step_1",
      completedSteps: [],
      recommendedTemplates: [],
    },
    wizard: {
      steps: [],
      recommendedDomains: ["marketing", "sales"],
      defaultMode: {
        mode: "department",
        autoDetected: true,
        features: {
          multiTenancy: true,
          approvalEngine: "full",
          securityReview: "auto_plus_manual",
          onboarding: "guided_1week",
          dashboardLevels: ["L1", "L2", "L3"],
          governance: "delegated",
        },
        upgradePath: "Department governance enabled.",
      },
    },
    draft: {
      draftId: "dept_draft",
      steps: [],
      validationFindings: ["Configure cross-team approval flows."],
      ownerUserId: "user_dept",
    },
    recommendedDomains: ["marketing", "sales", "support"],
    welcomePrompt: "Department mode configured.",
  };

  assert.equal(result.guidedSession.userRole, "domain_admin");
  assert.equal(result.wizard.defaultMode.mode, "department");
  assert.ok(result.wizard.defaultMode.features.multiTenancy);
  assert.deepEqual(result.wizard.defaultMode.features.dashboardLevels, ["L1", "L2", "L3"]);
});

test("UserExperienceBootstrapResult with team mode", () => {
  const result: UserExperienceBootstrapResult = {
    guidedSession: {
      sessionId: "team_session",
      userRole: "operator",
      currentStep: "step_1",
      completedSteps: [],
      recommendedTemplates: ["tpl_team"],
    },
    wizard: {
      steps: [],
      recommendedDomains: ["engineering_ops"],
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
        upgradePath: "Scale to department when ready.",
      },
    },
    draft: {
      draftId: "team_draft",
      steps: ["Plan", "Build", "Test", "Deploy"],
      validationFindings: [],
      ownerUserId: "user_team",
    },
    recommendedDomains: ["engineering_ops"],
    welcomePrompt: "Team mode ready.",
  };

  assert.equal(result.wizard.defaultMode.mode, "team");
  assert.strictEqual(result.wizard.defaultMode.features.multiTenancy, false);
  assert.ok(result.draft.steps.length === 4);
});

test("UserPortalSession with optional fields", () => {
  const sessionFull: UserPortalSession = {
    userId: "user_1",
    tenantId: "tenant_1",
    displayName: "Test User",
    preferredLocale: "zh-CN",
  };

  assert.equal(sessionFull.displayName, "Test User");
  assert.equal(sessionFull.preferredLocale, "zh-CN");

  const sessionMinimal: UserPortalSession = {
    userId: "user_2",
    tenantId: "tenant_2",
  };

  assert.strictEqual(sessionMinimal.displayName, undefined);
  assert.strictEqual(sessionMinimal.preferredLocale, undefined);
});

test("UserPortalContext structure variations", () => {
  const soloContext: UserPortalContext = {
    memberCount: 1,
    departmentCount: 1,
    requiresSso: false,
  };

  assert.equal(soloContext.memberCount, 1);
  assert.equal(soloContext.departmentCount, 1);

  const largeContext: UserPortalContext = {
    memberCount: 10000,
    departmentCount: 50,
    requiresSso: true,
  };

  assert.ok(largeContext.memberCount >= 100);
  assert.ok(largeContext.requiresSso);
});

test("DomainOnboardingWizard step types", () => {
  const wizard: DomainOnboardingWizard = {
    steps: [
      {
        stepId: "business_type",
        title: "Business Type",
        description: "Select your business type.",
      },
      {
        stepId: "capability_setup",
        title: "Capabilities",
        description: "Configure core capabilities.",
      },
      {
        stepId: "risk_setup",
        title: "Risk Settings",
        description: "Set up risk management.",
      },
      {
        stepId: "activation",
        title: "Activation",
        description: "Activate your workspace.",
      },
    ],
    recommendedDomains: ["engineering_ops"],
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

  assert.equal(wizard.steps.length, 4);
  assert.equal(wizard.steps[0].stepId, "business_type");
  assert.equal(wizard.steps[3].stepId, "activation");
});

test("DraggableComponent risk levels", () => {
  const lowRisk: DraggableComponent = {
    componentId: "trigger_manual",
    name: "Manual Trigger",
    icon: "play",
    domainId: "platform",
    riskLevel: "low",
    configSchema: {},
    previewDescription: "Manually trigger workflow",
  };

  const mediumRisk: DraggableComponent = {
    componentId: "action_generic",
    name: "Generic Action",
    icon: "bolt",
    domainId: "general_ops",
    riskLevel: "medium",
    configSchema: { target: { type: "string" } },
    previewDescription: "Generic action component",
  };

  const highRisk: DraggableComponent = {
    componentId: "action_deploy",
    name: "Deploy Action",
    icon: "rocket",
    domainId: "engineering_ops",
    riskLevel: "high",
    configSchema: { environment: { type: "string" } },
    previewDescription: "Deploy to environment",
  };

  const criticalRisk: DraggableComponent = {
    componentId: "action_payment",
    name: "Payment",
    icon: "credit-card",
    domainId: "finance",
    riskLevel: "critical",
    configSchema: { amount: { type: "number" } },
    previewDescription: "Process payment",
  };

  assert.equal(lowRisk.riskLevel, "low");
  assert.equal(mediumRisk.riskLevel, "medium");
  assert.equal(highRisk.riskLevel, "high");
  assert.equal(criticalRisk.riskLevel, "critical");
});

test("GuidedOnboardingSession readonly properties", () => {
  const session: GuidedOnboardingSession = {
    sessionId: "readonly_test",
    userRole: "operator",
    currentStep: "step_1",
    completedSteps: Object.freeze(["a", "b"]),
    recommendedTemplates: Object.freeze(["tpl_1"]),
  };

  assert.ok(Object.isFrozen(session.completedSteps));
  assert.ok(Object.isFrozen(session.recommendedTemplates));
});

test("WorkflowBuilderDraft readonly arrays", () => {
  const draft: WorkflowBuilderDraft = {
    draftId: "readonly_draft",
    steps: Object.freeze(["step_1", "step_2"]),
    validationFindings: Object.freeze([]),
    ownerUserId: "user_readonly",
  };

  assert.ok(Object.isFrozen(draft.steps));
  assert.ok(Object.isFrozen(draft.validationFindings));
});
