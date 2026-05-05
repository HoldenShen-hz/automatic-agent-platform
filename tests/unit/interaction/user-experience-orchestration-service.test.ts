import assert from "node:assert/strict";
import test from "node:test";

import { UserExperienceOrchestrationService } from "../../../src/interaction/ux/user-experience-orchestration-service.js";
import { UserPortalService } from "../../../src/interaction/ux/onboarding/index.js";
import { applyInteractionTemplate } from "../../../src/interaction/ux/template-engine/index.js";
import { canAdvanceWizard } from "../../../src/interaction/ux/wizard/index.js";

test("UserExperienceOrchestrationService bootstrap creates guided session with operator role", async () => {
  const service = new UserExperienceOrchestrationService();
  const result = await service.bootstrap({
    session: { userId: "user_1", tenantId: "tenant_1" },
    context: { memberCount: 5, departmentCount: 2, requiresSso: false },
    userRole: "operator",
    businessDescription: "帮我自动化日常巡检任务",
    template: { templateId: "tmpl_check", title: "Check Template", steps: ["check_status", "report"] },
    wizardSession: {
      sessionId: "wizard_1",
      currentStepId: "capability_setup",
      steps: [
        { stepId: "business_type", title: "业务类型", completed: true },
        { stepId: "capability_setup", title: "能力配置", completed: true },
      ],
    },
    components: [],
  });

  assert.equal(result.guidedSession.userRole, "operator");
  assert.ok(result.guidedSession.sessionId !== undefined);
  assert.equal(result.wizard.steps.length > 0, true);
});

test("UserExperienceOrchestrationService bootstrap creates guided session with platform_ops role", async () => {
  const service = new UserExperienceOrchestrationService();
  const result = await service.bootstrap({
    session: { userId: "user_ops", tenantId: "tenant_2" },
    context: { memberCount: 50, departmentCount: 5, requiresSso: true },
    userRole: "platform_ops",
    businessDescription: "平台稳定性巡检",
    template: { templateId: "tmpl_stability", title: "Stability", steps: ["monitor", "alert"] },
    wizardSession: {
      sessionId: "wizard_2",
      currentStepId: "business_type",
      steps: [{ stepId: "business_type", title: "业务类型", completed: true }],
    },
    components: [],
  });

  assert.equal(result.guidedSession.userRole, "platform_ops");
});

test("UserExperienceOrchestrationService bootstrap creates guided session with fleet_admin role", async () => {
  const service = new UserExperienceOrchestrationService();
  const result = await service.bootstrap({
    session: { userId: "admin_1", tenantId: "tenant_1" },
    context: { memberCount: 200, departmentCount: 10, requiresSso: true },
    userRole: "fleet_admin",
    businessDescription: "多区域部署管理",
    template: { templateId: "tmpl_fleet", title: "Fleet", steps: ["deploy", "verify"] },
    wizardSession: {
      sessionId: "wizard_3",
      currentStepId: "activation",
      steps: [
        { stepId: "business_type", title: "类型", completed: true },
        { stepId: "capability_setup", title: "能力", completed: true },
        { stepId: "risk_setup", title: "风控", completed: true },
        { stepId: "activation", title: "激活", completed: true },
      ],
    },
    components: [],
  });

  assert.equal(result.guidedSession.userRole, "fleet_admin");
  assert.deepEqual(result.guidedSession.completedSteps, ["business_type", "capability_setup", "risk_setup", "activation"]);
});

test("UserExperienceOrchestrationService bootstrap returns wizard with mode-appropriate steps", async () => {
  const service = new UserExperienceOrchestrationService();
  const result = await service.bootstrap({
    session: { userId: "user_1", tenantId: "tenant_1" },
    context: { memberCount: 1, departmentCount: 1, requiresSso: false },
    userRole: "operator",
    businessDescription: "测试工作流",
    template: { templateId: "tmpl_test", title: "Test", steps: ["step1", "step2"] },
    wizardSession: {
      sessionId: "wizard_test",
      currentStepId: "step1",
      steps: [{ stepId: "step1", title: "Step 1", completed: false }],
    },
    components: [],
  });

  assert.equal(result.wizard.steps.length, 2);
  assert.ok(result.wizard.recommendedDomains !== undefined);
});

test("UserExperienceOrchestrationService bootstrap returns draft plan graph", async () => {
  const service = new UserExperienceOrchestrationService();
  const result = await service.bootstrap({
    session: { userId: "user_1", tenantId: "tenant_1" },
    context: { memberCount: 1, departmentCount: 1, requiresSso: false },
    userRole: "operator",
    businessDescription: "测试",
    template: { templateId: "tmpl_1", title: "Template 1", steps: ["a", "b", "c"] },
    wizardSession: {
      sessionId: "wizard_1",
      currentStepId: "step_1",
      steps: [{ stepId: "step_1", title: "Step 1", completed: true }],
    },
    components: [],
  });

  assert.equal(result.draft.planGraph.nodes.length, 3);
  assert.equal(result.draft.planGraph.edges.length, 2);
  assert.ok(result.draft.draftId !== undefined);
  assert.equal(result.draft.ownerUserId, "user_1");
});

test("UserExperienceOrchestrationService bootstrap returns recommended domains from plan", async () => {
  const service = new UserExperienceOrchestrationService();
  const result = await service.bootstrap({
    session: { userId: "user_1", tenantId: "tenant_1" },
    context: { memberCount: 1, departmentCount: 1, requiresSso: false },
    userRole: "operator",
    businessDescription: "代码发布到生产环境",
    template: { templateId: "tmpl_deploy", title: "Deploy", steps: ["build", "deploy"] },
    wizardSession: {
      sessionId: "wizard_deploy",
      currentStepId: "step_1",
      steps: [{ stepId: "step_1", title: "Step 1", completed: true }],
    },
    components: [],
  });

  assert.ok(result.recommendedDomains.includes("engineering_ops"));
});

test("UserExperienceOrchestrationService bootstrap returns welcome prompt", async () => {
  const service = new UserExperienceOrchestrationService();
  const result = await service.bootstrap({
    session: { userId: "user_1", tenantId: "tenant_1" },
    context: { memberCount: 1, departmentCount: 1, requiresSso: false },
    userRole: "operator",
    businessDescription: "测试",
    template: { templateId: "tmpl_test", title: "Test", steps: ["step1"] },
    wizardSession: {
      sessionId: "wizard_test",
      currentStepId: "step_1",
      steps: [{ stepId: "step_1", title: "Step 1", completed: false }],
    },
    components: [],
  });

  assert.ok(result.welcomePrompt !== undefined);
  assert.ok(result.welcomePrompt.length > 0);
});

test("UserExperienceOrchestrationService bootstrap with marketing description recommends advertising", async () => {
  const service = new UserExperienceOrchestrationService();
  const result = await service.bootstrap({
    session: { userId: "user_1", tenantId: "tenant_1" },
    context: { memberCount: 1, departmentCount: 1, requiresSso: false },
    userRole: "domain_admin",
    businessDescription: "市场推广和广告投放",
    template: { templateId: "tmpl_mkt", title: "Marketing", steps: ["plan", "execute"] },
    wizardSession: {
      sessionId: "wizard_mkt",
      currentStepId: "step_1",
      steps: [{ stepId: "step_1", title: "Step 1", completed: true }],
    },
    components: [],
  });

  assert.ok(result.recommendedDomains.includes("advertising"));
});

test("UserExperienceOrchestrationService bootstrap with finance description recommends finance", async () => {
  const service = new UserExperienceOrchestrationService();
  const result = await service.bootstrap({
    session: { userId: "user_1", tenantId: "tenant_1" },
    context: { memberCount: 1, departmentCount: 1, requiresSso: false },
    userRole: "domain_admin",
    businessDescription: "财务预算和发票审批",
    template: { templateId: "tmpl_fin", title: "Finance", steps: ["budget", "approve"] },
    wizardSession: {
      sessionId: "wizard_fin",
      currentStepId: "step_1",
      steps: [{ stepId: "step_1", title: "Step 1", completed: true }],
    },
    components: [],
  });

  assert.ok(result.recommendedDomains.includes("finance"));
});

test("UserExperienceOrchestrationService bootstrap records completed steps from wizard session", async () => {
  const service = new UserExperienceOrchestrationService();
  const result = await service.bootstrap({
    session: { userId: "user_1", tenantId: "tenant_1" },
    context: { memberCount: 1, departmentCount: 1, requiresSso: false },
    userRole: "operator",
    businessDescription: "测试",
    template: { templateId: "tmpl_test", title: "Test", steps: ["step1", "step2"] },
    wizardSession: {
      sessionId: "wizard_completed",
      currentStepId: "step_2",
      steps: [
        { stepId: "step_1", title: "Step 1", completed: true },
        { stepId: "step_2", title: "Step 2", completed: true },
      ],
    },
    components: [],
  });

  assert.deepEqual(result.guidedSession.completedSteps, ["step_1", "step_2"]);
});

test("UserExperienceOrchestrationService bootstrap records current step from wizard session", async () => {
  const service = new UserExperienceOrchestrationService();
  const result = await service.bootstrap({
    session: { userId: "user_1", tenantId: "tenant_1" },
    context: { memberCount: 1, departmentCount: 1, requiresSso: false },
    userRole: "operator",
    businessDescription: "测试",
    template: { templateId: "tmpl_test", title: "Test", steps: ["step1", "step2"] },
    wizardSession: {
      sessionId: "wizard_current",
      currentStepId: "step_2",
      steps: [{ stepId: "step_1", title: "Step 1", completed: true }],
    },
    components: [],
  });

  assert.equal(result.guidedSession.currentStep, "step_2");
});

test("UserExperienceOrchestrationService bootstrap handles empty components gracefully", async () => {
  const service = new UserExperienceOrchestrationService();
  const result = await service.bootstrap({
    session: { userId: "user_1", tenantId: "tenant_1" },
    context: { memberCount: 1, departmentCount: 1, requiresSso: false },
    userRole: "operator",
    businessDescription: "测试",
    template: { templateId: "tmpl_empty", title: "Empty", steps: ["step1"] },
    wizardSession: {
      sessionId: "wizard_empty",
      currentStepId: "step_1",
      steps: [{ stepId: "step_1", title: "Step 1", completed: true }],
    },
    components: [],
  });

  assert.ok(result.draft !== undefined);
  assert.equal(result.draft.draftId.includes("draft"), true);
});

test("UserExperienceOrchestrationService bootstrap includes templateId in recommended templates", async () => {
  const service = new UserExperienceOrchestrationService();
  const result = await service.bootstrap({
    session: { userId: "user_1", tenantId: "tenant_1" },
    context: { memberCount: 1, departmentCount: 1, requiresSso: false },
    userRole: "operator",
    businessDescription: "测试",
    template: { templateId: "tmpl_unique_123", title: "Unique Template", steps: ["step1"] },
    wizardSession: {
      sessionId: "wizard_template",
      currentStepId: "step_1",
      steps: [{ stepId: "step_1", title: "Step 1", completed: true }],
    },
    components: [],
  });

  assert.ok(result.guidedSession.recommendedTemplates.includes("tmpl_unique_123"));
});
