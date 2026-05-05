import assert from "node:assert/strict";
import test from "node:test";

import { UserPortalService } from "../../../../../src/interaction/ux/onboarding/index.js";

test("UserPortalService creates session and stores resolved mode", async () => {
  const service = new UserPortalService();
  const sessionId = await service.createSession(
    {
      userId: "user_1",
      tenantId: "tenant_1",
      displayName: "Alice",
    },
    {
      memberCount: 25,
      departmentCount: 2,
      requiresSso: false,
    },
  );

  const stored = service.getSession(sessionId);
  assert.ok(stored);
  assert.equal(stored?.mode.mode, "department");
  assert.equal(stored?.session.displayName, "Alice");
});

test("UserPortalService resolves enterprise mode for SSO-heavy tenants", () => {
  const service = new UserPortalService();

  const mode = service.resolveMode({
    memberCount: 80,
    departmentCount: 4,
    requiresSso: true,
  });

  assert.equal(mode.mode, "enterprise");
  assert.deepEqual(mode.features.dashboardLevels, ["L1", "L2", "L3", "L4"]);
});

test("UserPortalService builds onboarding wizard and workflow builder", async () => {
  const service = new UserPortalService();

  const wizard = await service.buildDomainOnboardingWizard("我要做广告投放自动化", {
    memberCount: 1,
    departmentCount: 1,
    requiresSso: false,
  });
  const builder = await service.buildVisualWorkflowBuilder("我要做广告投放自动化");

  assert.equal(wizard.steps.length, 2);
  assert.ok(wizard.recommendedDomains.includes("advertising"));
  assert.equal(builder.validation.valid, true);
  assert.ok(builder.componentPalette.some((category) => category.category === "action"));
});

test("UserPortalService marks finance payment workflows as critical risk", async () => {
  const service = new UserPortalService();

  const builder = await service.buildVisualWorkflowBuilder("我要做财务付款审批和工资发放自动化", ["finance"]);
  const financeAction = builder.componentPalette
    .flatMap((category) => category.components)
    .find((component) => component.domainId === "finance");

  assert.ok(financeAction);
  assert.equal(financeAction?.riskLevel, "critical");
});
