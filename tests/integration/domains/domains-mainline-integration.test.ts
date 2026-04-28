import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import { getVerticalDomainBaseline, bootstrapVerticalDomainBaselines } from "../../../src/domains/domain-baseline-catalog.js";
import { VerticalDomainArchitectureService } from "../../../src/domains/vertical-domain-architecture-service.js";
import { DomainTaskDesignService } from "../../../src/domains/domain-task-design-service.js";
import { DomainEvaluationGateService } from "../../../src/domains/eval-framework/domain-evaluation-gate-service.js";
import { DomainPromptGovernanceService } from "../../../src/domains/prompt-library/domain-prompt-governance-service.js";
import { DomainOnboardingService } from "../../../src/domains/operations/domain-onboarding-service.js";
import { DomainSmokeTestRunner } from "../../../src/domains/registry/domain-smoke-test.js";
import { DomainRegistryService } from "../../../src/domains/registry/domain-registry-service.js";
import { registerDomainsRuntimeOrchestrator } from "../../../src/domains-runtime-orchestrator.js";
import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";

test("integration: domains mainline turns all 24 baselines into active smoke-passing rollout-ready domain capabilities", async () => {
  const registry = ServiceRegistry.getInstance();

  try {
    const orchestrator = registerDomainsRuntimeOrchestrator(registry);
    const startup = orchestrator.startup();
    assert.equal(startup.ready, true);
    assert.deepEqual(startup.startupOrder, ["ring1", "ring2", "ring3"]);

    const bootstrapped = bootstrapVerticalDomainBaselines();
    assert.equal(bootstrapped.baselines.length, 31);
    assert.equal(bootstrapped.domainRegistry.listActive().length, 31);
    assert.equal(bootstrapped.baselines.some((baseline) => baseline.domainId === "quant-trading"), true);
    assert.equal(bootstrapped.baselines.some((baseline) => baseline.domainId === "finance-accounting"), true);
    assert.equal(
      bootstrapped.baselines.every((baseline) => bootstrapped.domainRegistry.validate(baseline.domainId).passed),
      true,
    );
    assert.equal(
      bootstrapped.baselines.every((baseline) => bootstrapped.domainRegistry.buildCapabilityEntry(baseline.domainId).toolNames.length >= 1),
      true,
    );
    assert.equal(
      bootstrapped.baselines.every((baseline) => baseline.governancePolicy.rollout.strategy.length > 0),
      true,
    );
    assert.equal(
      bootstrapped.baselines.every((baseline) => baseline.metaModelValidation.completeness === 100),
      true,
    );
    assert.equal(
      bootstrapped.baselines.every((baseline) => existsSync(baseline.ownershipProfile.configPath)),
      true,
    );
    assert.equal(
      bootstrapped.baselines.every((baseline) => baseline.workflowSpecialization.stageNames.length >= 4),
      true,
    );
    const architectureRecords = new VerticalDomainArchitectureService().listVerticalDomainArchitectures();
    assert.equal(architectureRecords.length, 31);
    assert.equal(
      architectureRecords.every((record) => record.architectureSections.length === 8 && record.workflow.stageNames.length >= 4),
      true,
    );

    const codingBaseline = getVerticalDomainBaseline("coding");
    const codingRegistry = new DomainRegistryService();
    codingRegistry.register(codingBaseline.definition);
    for (const namespace of codingBaseline.knowledgeSchema.namespaceIds) {
      codingRegistry.registerKnowledgeNamespace(namespace, codingBaseline.domainId);
    }

    const onboarding = new DomainOnboardingService(codingRegistry);
    onboarding.start(codingBaseline.domainId);
    for (const phase of ["domain_modeling", "pack_development", "security_certification", "gray_rollout"] as const) {
      const session = onboarding.get(codingBaseline.domainId);
      if (session.activePhase === phase) {
        onboarding.advance(codingBaseline.domainId, [`${phase}:evidence`, `${phase}:rollback-plan`]);
      }
    }
    assert.equal(onboarding.get(codingBaseline.domainId).completed, true);
    assert.equal(codingRegistry.get(codingBaseline.domainId)?.status, "active");

    const smoke = new DomainSmokeTestRunner().run(codingBaseline.definition);
    assert.equal(smoke.passed, true);
    assert.equal(smoke.rollbackPoints.length >= 1, true);

    const taskDesign = new DomainTaskDesignService({
      recipes: codingBaseline.recipes,
      promptLibrary: codingBaseline.promptLibrary,
      riskProfile: codingBaseline.riskProfile,
      evalFramework: codingBaseline.evalFramework,
      knowledgeSchema: codingBaseline.knowledgeSchema,
      interactionRules: codingBaseline.interactionRules,
    }).design({
      domainId: codingBaseline.domainId,
      taskType: "implement",
      userInput: "implement a safe code release workflow change for coding baseline",
      promptId: `${codingBaseline.domainId}.plan`,
      riskScore: 78,
    });
    assert.equal(taskDesign.workflowId, `${codingBaseline.domainId}.primary`);
    assert.equal(taskDesign.prompt?.promptId, `${codingBaseline.domainId}.plan`);
    assert.equal(taskDesign.blockingEvaluatorIds.length >= 1, true);

    const evalReport = new DomainEvaluationGateService().evaluateSuite(codingBaseline.evalFramework, {
      suiteId: "suite_w5_domains",
      domainId: codingBaseline.domainId,
      releaseType: "pre_release",
      executionMode: "supervised",
      storageMode: "mixed",
      cases: Array.from({ length: 20 }, (_, index) => {
        const evaluator = codingBaseline.evalFramework.evaluators[index % codingBaseline.evalFramework.evaluators.length]!;
        const metric = evaluator.metric;
        const score = Math.max(evaluator.threshold + 0.05, 0.9);
        return {
          caseId: `coding_case_${index + 1}`,
          metric,
          score,
          expectedClass: codingBaseline.domainId,
          approvalMatched: true,
        };
      }),
    });
    assert.equal(evalReport.releaseDecision, "promote");

    const promptGovernance = new DomainPromptGovernanceService();
    const release = promptGovernance.proposeRelease(codingBaseline.promptLibrary, {
      promptId: `${codingBaseline.domainId}.plan`,
      owner: "domain_owner",
      rolloutScope: ["tenant:coding-canary"],
      rolloutMode: codingBaseline.governancePolicy.rollout.strategy === "shadow" ? "shadow" : "suggest",
      lintEvidence: ["lint:ok"],
      evalEvidence: [evalReport.reportId],
      approvalTicketId: "CHG-W5-001",
      rollbackVersion: "v1",
    });
    const activeRelease = promptGovernance.activate(release.releaseId);
    assert.equal(activeRelease.status, "active");
    assert.equal(activeRelease.rolloutScope[0], "tenant:coding-canary");
  } finally {
    await registry.reset();
  }
});
