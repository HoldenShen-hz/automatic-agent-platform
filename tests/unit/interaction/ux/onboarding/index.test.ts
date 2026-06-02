import assert from "node:assert/strict";
import test from "node:test";

import { UserPortalService } from "../../../../../src/interaction/ux/onboarding/index.js";

function createTestPortalService(): UserPortalService {
  return new UserPortalService();
}

test("UserPortalService.createSession creates session with solo mode for single user", async () => {
  const service = createTestPortalService();

  const sessionId = await service.createSession({
    userId: "user_1",
    tenantId: "tenant_1",
    displayName: "Test User",
  });

  const stored = service.getSession(sessionId);
  assert.ok(stored);
  assert.equal(stored!.session.userId, "user_1");
  assert.equal(stored!.mode.mode, "solo");
});

test("UserPortalService.createSession creates team mode for small group", async () => {
  const service = createTestPortalService();

  const sessionId = await service.createSession(
    {
      userId: "user_1",
      tenantId: "tenant_1",
    },
    {
      memberCount: 5,
      departmentCount: 1,
      requiresSso: false,
    },
  );

  const stored = service.getSession(sessionId);
  assert.ok(stored);
  assert.equal(stored!.mode.mode, "team");
});

test("UserPortalService.createSession creates department mode for multiple departments", async () => {
  const service = createTestPortalService();

  const sessionId = await service.createSession(
    {
      userId: "user_1",
      tenantId: "tenant_1",
    },
    {
      memberCount: 50,
      departmentCount: 3,
      requiresSso: false,
    },
  );

  const stored = service.getSession(sessionId);
  assert.ok(stored);
  assert.equal(stored!.mode.mode, "department");
});

test("UserPortalService.createSession creates enterprise mode for large orgs", async () => {
  const service = createTestPortalService();

  const sessionId = await service.createSession(
    {
      userId: "user_1",
      tenantId: "tenant_1",
    },
    {
      memberCount: 500,
      departmentCount: 10,
      requiresSso: true,
    },
  );

  const stored = service.getSession(sessionId);
  assert.ok(stored);
  assert.equal(stored!.mode.mode, "enterprise");
});

test("UserPortalService.createSession uses SSO as enterprise trigger", async () => {
  const service = createTestPortalService();

  const sessionId = await service.createSession(
    {
      userId: "user_1",
      tenantId: "tenant_1",
    },
    {
      memberCount: 10,
      departmentCount: 1,
      requiresSso: true,
    },
  );

  const stored = service.getSession(sessionId);
  assert.ok(stored);
  assert.equal(stored!.mode.mode, "enterprise");
});

test("UserPortalService.createSession uses member count >= 100 as enterprise trigger", async () => {
  const service = createTestPortalService();

  const sessionId = await service.createSession(
    {
      userId: "user_1",
      tenantId: "tenant_1",
    },
    {
      memberCount: 100,
      departmentCount: 1,
      requiresSso: false,
    },
  );

  const stored = service.getSession(sessionId);
  assert.ok(stored);
  assert.equal(stored!.mode.mode, "enterprise");
});

test("UserPortalService.createSession uses department count >= 5 as enterprise trigger", async () => {
  const service = createTestPortalService();

  const sessionId = await service.createSession(
    {
      userId: "user_1",
      tenantId: "tenant_1",
    },
    {
      memberCount: 50,
      departmentCount: 5,
      requiresSso: false,
    },
  );

  const stored = service.getSession(sessionId);
  assert.ok(stored);
  assert.equal(stored!.mode.mode, "enterprise");
});

test("UserPortalService.createSession defaults context when not provided", async () => {
  const service = createTestPortalService();

  const sessionId = await service.createSession({
    userId: "user_1",
    tenantId: "tenant_1",
  });

  const stored = service.getSession(sessionId);
  assert.ok(stored);
  assert.equal(stored!.context.memberCount, 1);
  assert.equal(stored!.context.departmentCount, 1);
  assert.equal(stored!.context.requiresSso, false);
});

test("UserPortalService.getSession returns null for unknown session", () => {
  const service = createTestPortalService();

  const stored = service.getSession("unknown_session_id");
  assert.equal(stored, null);
});

test("UserPortalService.resolveMode returns solo for minimal context", () => {
  const service = createTestPortalService();

  const mode = service.resolveMode({
    memberCount: 1,
    departmentCount: 1,
    requiresSso: false,
  });

  assert.equal(mode.mode, "solo");
  assert.equal(mode.features.multiTenancy, false);
  assert.equal(mode.features.approvalEngine, "self_approve");
});

test("UserPortalService.resolveMode returns team for small group", () => {
  const service = createTestPortalService();

  const mode = service.resolveMode({
    memberCount: 5,
    departmentCount: 1,
    requiresSso: false,
  });

  assert.equal(mode.mode, "team");
  assert.equal(mode.features.multiTenancy, false);
  assert.equal(mode.features.approvalEngine, "simple");
});

test("UserPortalService.resolveMode returns department for growing org", () => {
  const service = createTestPortalService();

  const mode = service.resolveMode({
    memberCount: 25,
    departmentCount: 2,
    requiresSso: false,
  });

  assert.equal(mode.mode, "department");
  assert.equal(mode.features.multiTenancy, true);
  assert.equal(mode.features.approvalEngine, "full");
});

test("UserPortalService.resolveMode returns enterprise for large org", () => {
  const service = createTestPortalService();

  const mode = service.resolveMode({
    memberCount: 200,
    departmentCount: 8,
    requiresSso: true,
  });

  assert.equal(mode.mode, "enterprise");
  assert.equal(mode.features.multiTenancy, true);
  assert.equal(mode.features.approvalEngine, "full");
  assert.equal(mode.features.governance, "hierarchical");
});

test("UserPortalService.buildOnboardingPlan generates plan with recommended domains", () => {
  const service = createTestPortalService();

  const plan = service.buildOnboardingPlan("帮我做一个营销活动", {
    memberCount: 5,
    departmentCount: 1,
    requiresSso: false,
  });

  assert.ok(plan.recommendedDomains.includes("advertising") || plan.recommendedDomains.length > 0);
  assert.ok(plan.recommendedNextActions.length > 0);
  assert.ok(plan.welcomePrompt.length > 0);
});

test("UserPortalService.buildOnboardingPlan recommends finance for finance keywords", () => {
  const service = createTestPortalService();

  const plan = service.buildOnboardingPlan("处理财务预算和发票", {
    memberCount: 10,
    departmentCount: 2,
    requiresSso: false,
  });

  assert.ok(plan.recommendedDomains.includes("finance"));
});

test("UserPortalService.buildOnboardingPlan recommends engineering-ops for code keywords", () => {
  const service = createTestPortalService();

  const plan = service.buildOnboardingPlan("帮我deploy到production环境", {
    memberCount: 10,
    departmentCount: 1,
    requiresSso: false,
  });

  assert.ok(plan.recommendedDomains.includes("engineering-ops"));
});

test("UserPortalService.buildOnboardingPlan defaults to general-ops for unknown domain", () => {
  const service = createTestPortalService();

  const plan = service.buildOnboardingPlan("do something generic", {
    memberCount: 1,
    departmentCount: 1,
    requiresSso: false,
  });

  assert.ok(plan.recommendedDomains.includes("general-ops"));
});

test("UserPortalService.buildDomainOnboardingWizard returns wizard with 4 steps", () => {
  const service = createTestPortalService();

  const wizard = service.buildDomainOnboardingWizard("创建一个营销活动", {
    memberCount: 5,
    departmentCount: 1,
    requiresSso: false,
  });

  assert.equal(wizard.steps.length, 4);
  assert.equal(wizard.steps[0]!.stepId, "business_type");
  assert.equal(wizard.steps[1]!.stepId, "capability_setup");
  assert.equal(wizard.steps[2]!.stepId, "risk_setup");
  assert.equal(wizard.steps[3]!.stepId, "activation");
});

test("UserPortalService.buildVisualWorkflowBuilder returns builder with canvas", () => {
  const service = createTestPortalService();

  const builder = service.buildVisualWorkflowBuilder("创建任务");

  assert.ok(builder.canvas.nodes.length >= 2);
  assert.ok(builder.canvas.edges.length >= 1);
  assert.ok(builder.livePreview.estimatedDuration.length > 0);
});

test("UserPortalService.buildVisualWorkflowBuilder includes component palette", () => {
  const service = createTestPortalService();

  const builder = service.buildVisualWorkflowBuilder("创建任务");

  assert.ok(builder.componentPalette.length > 0);
  assert.ok(builder.componentPalette[0]!.components.length > 0);
});

test("UserPortalService.buildVisualWorkflowBuilder identifies high risk for finance domain", () => {
  const service = createTestPortalService();

  const builder = service.buildVisualWorkflowBuilder("处理付款和工资单", ["finance"]);

  const actionComponent = builder.componentPalette.find((p) => p.category === "action");
  const financeComponent = actionComponent?.components.find((c) => c.domainId === "finance");
  assert.ok(financeComponent);
  assert.equal(financeComponent!.riskLevel, "critical");
});

test("UserPortalService.buildVisualWorkflowBuilder validates workflow structure", () => {
  const service = createTestPortalService();

  const builder = service.buildVisualWorkflowBuilder("创建任务");

  assert.equal(builder.validation.valid, true);
  assert.ok(builder.validation.messages.length > 0);
});

test("UserPortalService handles multiple sessions independently", async () => {
  const service = createTestPortalService();

  const sessionId1 = await service.createSession({
    userId: "user_1",
    tenantId: "tenant_1",
  });

  const sessionId2 = await service.createSession({
    userId: "user_2",
    tenantId: "tenant_1",
  });

  const stored1 = service.getSession(sessionId1);
  const stored2 = service.getSession(sessionId2);

  assert.notEqual(stored1, stored2);
  assert.equal(stored1!.session.userId, "user_1");
  assert.equal(stored2!.session.userId, "user_2");
});

test("UserPortalService recommends hr domain for recruit keywords", () => {
  const service = createTestPortalService();

  const plan = service.buildOnboardingPlan("招聘新员工和入职培训", {
    memberCount: 50,
    departmentCount: 2,
    requiresSso: false,
  });

  assert.ok(plan.recommendedDomains.includes("hr"));
});

test("UserPortalService recommends customer_support domain for support keywords", () => {
  const service = createTestPortalService();

  const plan = service.buildOnboardingPlan("处理客服工单和客户问题", {
    memberCount: 20,
    departmentCount: 1,
    requiresSso: false,
  });

  assert.ok(plan.recommendedDomains.includes("customer_support"));
});
