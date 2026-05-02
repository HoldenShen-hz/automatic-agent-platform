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

import { UserExperienceOrchestrationService, type WizardSession } from "../../../src/interaction/ux/user-experience-orchestration-service.js";
import type { UserPortalSession, UserPortalContext, InteractionTemplate, DraggableComponent, DomainOnboardingWizard } from "../../../src/interaction/ux/onboarding/index.js";

function createPortalSession(overrides: Partial<UserPortalSession> = {}): UserPortalSession {
  return {
    sessionId: overrides.sessionId ?? "session_ux_001",
    userId: overrides.userId ?? "user_ux_001",
    tenantId: overrides.tenantId ?? null,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    lastActiveAt: overrides.lastActiveAt ?? new Date().toISOString(),
    ...overrides,
  };
}

function createPortalContext(overrides: Partial<UserPortalContext> = {}): UserPortalContext {
  return {
    divisionId: overrides.divisionId ?? "general_ops",
    workflowClass: overrides.workflowClass ?? "deterministic",
    ...overrides,
  };
}

function createTemplate(overrides: Partial<InteractionTemplate> = {}): InteractionTemplate {
  return {
    templateId: overrides.templateId ?? "tmpl_001",
    name: overrides.name ?? "Standard Onboarding",
    description: overrides.description ?? "Default onboarding template",
    steps: overrides.steps ?? [],
    ...overrides,
  };
}

function createWizardSession(overrides: Partial<WizardSession> = {}): WizardSession {
  return {
    sessionId: overrides.sessionId ?? "wizard_001",
    currentStepId: overrides.currentStepId ?? "step_1",
    steps: overrides.steps ?? [
      { stepId: "step_1", label: "Welcome", completed: false },
      { stepId: "step_2", label: "Configure", completed: false },
    ],
    data: overrides.data ?? {},
    ...overrides,
  };
}

function createDraggableComponent(overrides: Partial<DraggableComponent> = {}): DraggableComponent {
  return {
    componentId: overrides.componentId ?? "comp_001",
    type: overrides.type ?? "tool",
    label: overrides.label ?? "Test Component",
    defaultConfig: overrides.defaultConfig ?? {},
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

  assert.ok(result.draft.planGraph);
  assert.ok(Array.isArray(result.draft.planGraph.nodes));
  assert.ok(Array.isArray(result.draft.planGraph.edges));
});

test("E2E UserExperience: Wizard step progression is tracked", async () => {
  const service = new UserExperienceOrchestrationService();

  const wizardSession = createWizardSession({
    steps: [
      { stepId: "step_1", label: "Start", completed: true },
      { stepId: "step_2", label: "Configure", completed: false },
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