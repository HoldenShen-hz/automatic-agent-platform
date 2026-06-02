/**
 * E2E Tests for User Experience Orchestration Service
 *
 * End-to-end tests covering:
 * 1. Session management and lifecycle
 * 2. Workflow builder operations
 * 3. Template application
 * 4. Wizard session handling
 */

import assert from "node:assert/strict";
import test from "node:test";

// @ts-ignore
import { UserExperienceOrchestrationService, type WizardSession } from "../../../src/interaction/ux/user-experience-orchestration-service.js";
// @ts-ignore
import type { UserPortalSession, UserPortalContext, InteractionTemplate, DraggableComponent, DomainOnboardingWizard } from "../../../src/interaction/ux/onboarding/index.js";

function createPortalSession(overrides: Partial<UserPortalSession> = {}): UserPortalSession {
  return {
    userId: overrides.userId ?? "user_ux_001",
    tenantId: overrides.tenantId ?? "tenant_ux_001",
    displayName: overrides.displayName ?? "UX User",
    preferredLocale: overrides.preferredLocale ?? "zh-CN",
    ...overrides,
  };
}

function createPortalContext(overrides: Partial<UserPortalContext> = {}): UserPortalContext {
  return {
    memberCount: overrides.memberCount ?? 8,
    departmentCount: overrides.departmentCount ?? 1,
    requiresSso: overrides.requiresSso ?? false,
    ...overrides,
  };
}

function createTemplate(overrides: Partial<InteractionTemplate> = {}): InteractionTemplate {
  return {
    templateId: overrides.templateId ?? "tmpl_001",
    title: overrides.title ?? "Standard Onboarding",
    description: overrides.description ?? "Default onboarding template",
    domainId: overrides.domainId ?? "general-ops",
    riskProfile: overrides.riskProfile ?? "low",
    version: overrides.version ?? "1.0.0",
    parameters: overrides.parameters ?? [],
    steps: overrides.steps ?? ["intake", "configure"],
    requiredCapabilities: overrides.requiredCapabilities ?? [],
    ...overrides,
  };
}

function createWizardSession(overrides: Partial<WizardSession> = {}): WizardSession {
  return {
    sessionId: overrides.sessionId ?? "wizard_001",
    currentStepId: overrides.currentStepId ?? "step_1",
    steps: overrides.steps ?? [
      { stepId: "step_1", title: "Welcome", completed: false },
      { stepId: "step_2", title: "Configure", completed: false },
    ],
    answers: overrides.answers ?? {},
    history: overrides.history ?? [],
    ...overrides,
  };
}

function createDraggableComponent(overrides: Partial<DraggableComponent> = {}): DraggableComponent {
  return {
    componentId: overrides.componentId ?? "comp_001",
    name: overrides.name ?? "Test Component",
    icon: overrides.icon ?? "bolt",
    domainId: overrides.domainId ?? "general-ops",
    riskLevel: overrides.riskLevel ?? "low",
    configSchema: overrides.configSchema ?? {},
    previewDescription: overrides.previewDescription ?? "Test component preview",
    ...overrides,
  };
}

test("E2E UserExperience: Bootstrap creates guided session", async () => {
  const service = new UserExperienceOrchestrationService();

  const result = await service.bootstrap({
    session: createPortalSession(),
    context: createPortalContext(),
    userRole: "operator",
    businessDescription: "Automate task execution",
    template: createTemplate(),
    wizardSession: createWizardSession(),
    components: [createDraggableComponent()],
  });

  assert.ok(result.guidedSession);
  assert.equal(result.guidedSession.userRole, "operator");
  assert.ok(result.draft);
  assert.ok(result.recommendedDomains);
});

test("E2E UserExperience: Workflow builder creates plan graph", async () => {
  const service = new UserExperienceOrchestrationService();

  const result = await service.bootstrap({
    session: createPortalSession(),
    context: createPortalContext(),
    userRole: "domain_admin",
    businessDescription: "Multi-step workflow",
    template: createTemplate(),
    wizardSession: createWizardSession(),
    components: [createDraggableComponent({ componentId: "node_1" })],
  });

  assert.ok(Array.isArray(result.draft.steps));
  assert.ok(result.draft.steps.length > 0);
  assert.ok(result.draft.workflowId);
});

test("E2E UserExperience: Wizard step progression is tracked", async () => {
  const service = new UserExperienceOrchestrationService();

  const wizardSession = createWizardSession({
    steps: [
      { stepId: "step_1", title: "Start", completed: true },
      { stepId: "step_2", title: "Configure", completed: false },
    ],
    currentStepId: "step_2",
  });

  const result = await service.bootstrap({
    session: createPortalSession(),
    context: createPortalContext(),
    userRole: "platform_ops",
    businessDescription: "Platform setup",
    template: createTemplate(),
    wizardSession,
    components: [],
  });

  assert.ok(result.guidedSession.completedSteps.includes("step_1"));
});
