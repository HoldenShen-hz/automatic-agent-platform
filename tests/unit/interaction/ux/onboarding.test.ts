import assert from "node:assert/strict";
import test from "node:test";

import { UserPortalService } from "../../../../src/interaction/ux/onboarding/index.js";
import type {
  UserPortalSession,
  UserPortalContext,
  PlatformMode,
  PortalOnboardingPlan,
  DomainOnboardingWizard,
} from "../../../../src/interaction/ux/onboarding/index.js";

test("UserPortalService creates a session", async () => {
  const service = new UserPortalService();
  const session: UserPortalSession = {
    userId: "user_1",
    tenantId: "tenant_1",
    displayName: "Test User",
  };

  const sessionId = await service.createSession(session);

  assert.ok(sessionId.startsWith("portal_session_"));
});

test("UserPortalService creates session with context", async () => {
  const service = new UserPortalService();
  const session: UserPortalSession = {
    userId: "user_1",
    tenantId: "tenant_1",
  };
  const context: UserPortalContext = {
    memberCount: 50,
    departmentCount: 3,
    requiresSso: true,
  };

  const sessionId = await service.createSession(session, context);
  const stored = service.getSession(sessionId);

  assert.ok(stored != null);
  assert.equal(stored!.context.memberCount, 50);
  assert.equal(stored!.context.departmentCount, 3);
  assert.equal(stored!.context.requiresSso, true);
});

test("UserPortalService uses default context when not provided", async () => {
  const service = new UserPortalService();
  const session: UserPortalSession = {
    userId: "user_1",
    tenantId: "tenant_1",
  };

  const sessionId = await service.createSession(session);
  const stored = service.getSession(sessionId);

  assert.ok(stored != null);
  assert.equal(stored!.context.memberCount, 1);
  assert.equal(stored!.context.departmentCount, 1);
  assert.equal(stored!.context.requiresSso, false);
});

test("UserPortalService getSession returns null for unknown session", () => {
  const service = new UserPortalService();

  const result = service.getSession("nonexistent_session");

  assert.equal(result, null);
});

test("UserPortalService resolveMode returns solo for single user", () => {
  const service = new UserPortalService();
  const context: UserPortalContext = {
    memberCount: 1,
    departmentCount: 1,
    requiresSso: false,
  };

  const mode = service.resolveMode(context);

  assert.equal(mode.mode, "solo");
  assert.equal(mode.autoDetected, true);
  assert.equal(mode.features.multiTenancy, false);
  assert.equal(mode.features.approvalEngine, "self_approve");
});

test("UserPortalService resolveMode returns team for small group", () => {
  const service = new UserPortalService();
  const context: UserPortalContext = {
    memberCount: 5,
    departmentCount: 1,
    requiresSso: false,
  };

  const mode = service.resolveMode(context);

  assert.equal(mode.mode, "team");
  assert.equal(mode.features.multiTenancy, false);
  assert.equal(mode.features.approvalEngine, "simple");
});

test("UserPortalService resolveMode returns department for larger group", () => {
  const service = new UserPortalService();
  const context: UserPortalContext = {
    memberCount: 25,
    departmentCount: 2,
    requiresSso: false,
  };

  const mode = service.resolveMode(context);

  assert.equal(mode.mode, "department");
  assert.equal(mode.features.multiTenancy, true);
  assert.equal(mode.features.approvalEngine, "full");
});

test("UserPortalService resolveMode returns enterprise for large orgs", () => {
  const service = new UserPortalService();
  const context: UserPortalContext = {
    memberCount: 150,
    departmentCount: 10,
    requiresSso: true,
  };

  const mode = service.resolveMode(context);

  assert.equal(mode.mode, "enterprise");
  assert.equal(mode.features.multiTenancy, true);
  assert.equal(mode.features.approvalEngine, "full");
  assert.deepEqual(mode.features.dashboardLevels, ["L1", "L2", "L3", "L4"]);
});

test("UserPortalService resolveMode enterprise via member count", () => {
  const service = new UserPortalService();
  const context: UserPortalContext = {
    memberCount: 100,
    departmentCount: 1,
    requiresSso: false,
  };

  const mode = service.resolveMode(context);

  assert.equal(mode.mode, "enterprise");
});

test("UserPortalService resolveMode enterprise via department count", () => {
  const service = new UserPortalService();
  const context: UserPortalContext = {
    memberCount: 50,
    departmentCount: 5,
    requiresSso: false,
  };

  const mode = service.resolveMode(context);

  assert.equal(mode.mode, "enterprise");
});

test("UserPortalService buildOnboardingPlan returns plan with recommended domains", async () => {
  const service = new UserPortalService();
  const context: UserPortalContext = {
    memberCount: 1,
    departmentCount: 1,
    requiresSso: false,
  };

  const plan = await service.buildOnboardingPlan("部署代码到生产环境", context);

  assert.ok(plan.mode != null);
  assert.ok(Array.isArray(plan.recommendedDomains));
  assert.ok(Array.isArray(plan.recommendedNextActions));
  assert.ok(plan.welcomePrompt.includes("solo"));
});

test("UserPortalService buildOnboardingPlan recommends advertising domain", async () => {
  const service = new UserPortalService();
  const context: UserPortalContext = {
    memberCount: 1,
    departmentCount: 1,
    requiresSso: false,
  };

  const plan = await service.buildOnboardingPlan("市场推广和广告投放", context);

  assert.ok(plan.recommendedDomains.includes("advertising"));
});

test("UserPortalService buildOnboardingPlan recommends finance domain", async () => {
  const service = new UserPortalService();
  const context: UserPortalContext = {
    memberCount: 1,
    departmentCount: 1,
    requiresSso: false,
  };

  const plan = await service.buildOnboardingPlan("财务预算和发票审批", context);

  assert.ok(plan.recommendedDomains.includes("finance"));
});

test("UserPortalService buildOnboardingPlan recommends hr domain", async () => {
  const service = new UserPortalService();
  const context: UserPortalContext = {
    memberCount: 1,
    departmentCount: 1,
    requiresSso: false,
  };

  const plan = await service.buildOnboardingPlan("招聘新员工入职", context);

  assert.ok(plan.recommendedDomains.includes("hr"));
});

test("UserPortalService buildOnboardingPlan recommends customer_support domain", async () => {
  const service = new UserPortalService();
  const context: UserPortalContext = {
    memberCount: 1,
    departmentCount: 1,
    requiresSso: false,
  };

  const plan = await service.buildOnboardingPlan("客服工单处理", context);

  assert.ok(plan.recommendedDomains.includes("customer_support"));
});

test("UserPortalService buildOnboardingPlan recommends engineering_ops domain", async () => {
  const service = new UserPortalService();
  const context: UserPortalContext = {
    memberCount: 1,
    departmentCount: 1,
    requiresSso: false,
  };

  const plan = await service.buildOnboardingPlan("代码发布到生产环境", context);

  assert.ok(plan.recommendedDomains.includes("engineering_ops"));
});

test("UserPortalService buildOnboardingPlan defaults to general_ops", async () => {
  const service = new UserPortalService();
  const context: UserPortalContext = {
    memberCount: 1,
    departmentCount: 1,
    requiresSso: false,
  };

  const plan = await service.buildOnboardingPlan("做一些任务", context);

  assert.ok(plan.recommendedDomains.includes("general_ops"));
});

test("UserPortalService buildDomainOnboardingWizard returns wizard with solo-mode steps", async () => {
  const service = new UserPortalService();
  const context: UserPortalContext = {
    memberCount: 1,
    departmentCount: 1,
    requiresSso: false,
  };

  const wizard = await service.buildDomainOnboardingWizard("测试描述", context);

  assert.equal(wizard.steps.length, 2);
  assert.equal(wizard.steps[0]!.stepId, "business_type");
  assert.equal(wizard.steps[1]!.stepId, "activation");
});

test("UserPortalService buildDomainOnboardingWizard recommends domains", async () => {
  const service = new UserPortalService();
  const context: UserPortalContext = {
    memberCount: 1,
    departmentCount: 1,
    requiresSso: false,
  };

  const wizard = await service.buildDomainOnboardingWizard("财务和代码发布", context);

  assert.ok(wizard.recommendedDomains.includes("finance"));
  assert.ok(wizard.recommendedDomains.includes("engineering_ops"));
});

test("UserPortalService buildVisualWorkflowBuilder returns builder structure", async () => {
  const service = new UserPortalService();

  const builder = await service.buildVisualWorkflowBuilder("测试工作流");

  assert.ok(Array.isArray(builder.canvas.nodes));
  assert.ok(Array.isArray(builder.canvas.edges));
  assert.ok(Array.isArray(builder.componentPalette));
  assert.ok(builder.livePreview != null);
  assert.ok(builder.validation != null);
});

test("UserPortalService buildVisualWorkflowBuilder creates nodes and edges", async () => {
  const service = new UserPortalService();

  const builder = await service.buildVisualWorkflowBuilder("测试工作流");

  assert.equal(builder.canvas.nodes.length, 3);
  assert.equal(builder.canvas.edges.length, 2);
});

test("UserPortalService buildVisualWorkflowBuilder uses selected domains when provided", async () => {
  const service = new UserPortalService();

  const builder = await service.buildVisualWorkflowBuilder("测试", ["custom_domain"]);

  // The label uses primaryDomain, not componentId
  assert.ok(builder.canvas.nodes[1]!.label.includes("custom_domain"));
});

test("UserPortalService buildVisualWorkflowBuilder sets finance risk to high by default", async () => {
  const service = new UserPortalService();

  const builder = await service.buildVisualWorkflowBuilder("财务工作流");

  const financeComponents = builder.componentPalette
    .flatMap(cat => cat.components)
    .filter(comp => comp.domainId === "finance");

  assert.ok(financeComponents.length > 0);
  assert.equal(financeComponents[0]!.riskLevel, "high");
});

test("UserPortalService buildVisualWorkflowBuilder sets finance payment risk to critical", async () => {
  const service = new UserPortalService();

  // Must include "finance" or "payment" to get finance domain and critical risk
  const builder = await service.buildVisualWorkflowBuilder("财务付款和转账");

  const financeComponents = builder.componentPalette
    .flatMap(cat => cat.components)
    .filter(comp => comp.domainId === "finance");

  assert.ok(financeComponents.length > 0);
  assert.equal(financeComponents[0]!.riskLevel, "critical");
});

test("UserPortalService buildVisualWorkflowBuilder sets production deploy risk to high", async () => {
  const service = new UserPortalService();

  const builder = await service.buildVisualWorkflowBuilder("发布到生产环境");

  const engComponents = builder.componentPalette
    .flatMap(cat => cat.components)
    .filter(comp => comp.domainId === "engineering_ops");

  assert.ok(engComponents.length > 0);
  assert.equal(engComponents[0]!.riskLevel, "high");
});
