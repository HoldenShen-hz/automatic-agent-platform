import assert from "node:assert/strict";
import test from "node:test";

import { WorkflowBuilderService } from "../../../src/interaction/ux/workflow-builder-service.js";

test("integration: onboarding template and wizard state build a workflow preview", () => {
  const service = new WorkflowBuilderService();
  const result = service.build({
    session: {
      sessionId: "wizard_ok",
      currentStepId: "business_type",
      steps: [
        { stepId: "business_type", title: "Business", completed: true },
      ],
    },
    template: {
      templateId: "tpl_campaign",
      title: "Campaign",
      steps: ["trigger campaign", "approve launch", "output summary"],
    },
    onboardingWizard: {
      steps: [
        { stepId: "business_type", title: "Business", description: "desc" },
        { stepId: "capability_setup", title: "Capability", description: "desc" },
        { stepId: "risk_setup", title: "Risk", description: "desc" },
        { stepId: "activation", title: "Activation", description: "desc" },
      ],
      recommendedDomains: ["marketing"],
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
        upgradePath: "invite teammate",
      },
    },
    components: [
      {
        componentId: "trigger_campaign",
        name: "Campaign Trigger",
        icon: "spark",
        domainId: "marketing",
        riskLevel: "low",
        configSchema: {},
        previewDescription: "trigger campaign",
      },
      {
        componentId: "approval_launch",
        name: "Approval Launch",
        icon: "check",
        domainId: "marketing",
        riskLevel: "medium",
        configSchema: {},
        previewDescription: "approve launch",
      },
      {
        componentId: "output_summary",
        name: "Summary Output",
        icon: "file",
        domainId: "marketing",
        riskLevel: "low",
        configSchema: {},
        previewDescription: "output summary",
      },
    ],
  });

  assert.equal(result.nextStepAllowed, true);
  assert.equal(result.builder.validation.valid, true);
  assert.equal(result.builder.livePreview.stepByStepDescription.length, 3);
});
