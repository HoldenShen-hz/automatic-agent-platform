import assert from "node:assert/strict";
import test from "node:test";

import { DomainOnboardingService } from "../../../src/domains/operations/domain-onboarding-service.js";
import { DomainRegistryService } from "../../../src/domains/registry/domain-registry-service.js";

function registerTestDomain(service: DomainRegistryService): void {
  service.register({
    domainId: "coding",
    name: "Coding",
    description: "Coding workflows",
    version: 1,
    workflows: [
      {
        workflowId: "wf_build",
        name: "Build",
        triggerConditions: {},
        steps: [
          {
            stepName: "read",
            toolHints: ["repo_map"],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 1000,
            dependsOn: [],
          },
        ],
      },
    ],
    toolBundles: [
      {
        bundleId: "coding-default",
        tools: [{ toolName: "repo_map", enabled: true, configOverrides: {} }],
      },
    ],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {
      supportedTaskTypes: ["bugfix"],
      requiredTools: ["repo_map"],
      optionalTools: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 1000, maxCostPerTask: 1 },
      securityLevel: "standard",
    },
    status: "validated",
    externalAdapters: [],
    pluginBindings: [],
  });
}

test("DomainOnboardingService progresses phases and activates domain on final completion", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry);

  const service = new DomainOnboardingService(registry);
  let session = service.start("coding");
  assert.equal(session.activePhase, "domain_modeling");

  session = service.advance("coding", ["artifact:modeling"]);
  assert.equal(session.activePhase, "pack_development");

  session = service.advance("coding", ["artifact:validation"]);
  assert.equal(session.activePhase, "security_certification");

  session = service.advance("coding", ["artifact:security"]);
  assert.equal(session.activePhase, "gray_rollout");

  session = service.advance("coding", ["artifact:canary"]);
  assert.equal(session.completed, true);
  assert.equal(session.activatedDomainStatus, "active");
});

test("DomainOnboardingService blocks evidence-free advancement", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry);
  const service = new DomainOnboardingService(registry);
  service.start("coding");

  assert.throws(() => {
    service.advance("coding", []);
  }, (error) => {
    assert.equal((error as { code?: string }).code, "domain_onboarding.evidence_required");
    return true;
  });
});
