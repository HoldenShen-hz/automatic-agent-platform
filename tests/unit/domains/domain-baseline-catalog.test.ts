import assert from "node:assert/strict";
import test from "node:test";

import {
  bootstrapVerticalDomainBaselines,
  getVerticalDomainBaseline,
  listVerticalDomainBaselines,
  listVerticalDomainBaselinesByPhase,
  listVerticalDomainIds,
} from "../../../src/domains/domain-baseline-catalog.js";
import { DomainSmokeTestRunner } from "../../../src/domains/registry/domain-smoke-test.js";

test("vertical domain baseline catalog covers all 24 phase-9 domains", () => {
  const baselines = listVerticalDomainBaselines();
  assert.equal(baselines.length, 24);
  assert.equal(new Set(listVerticalDomainIds()).size, 24);
  assert.deepEqual(
    ["9a", "9b", "9c", "9d", "9e", "9f"].map((phase) => listVerticalDomainBaselinesByPhase(phase as never).length),
    [4, 4, 4, 4, 4, 4],
  );
});

test("each vertical domain baseline contains required governance and descriptor metadata", () => {
  const baseline = getVerticalDomainBaseline("quantitative-trading");
  assert.equal(baseline.governancePolicy.rollout.strategy, "shadow");
  assert.equal(baseline.riskProfile.defaultRiskLevel, "critical");
  assert.equal(baseline.definition.workflows.length, 1);
  assert.equal(baseline.definition.toolBundles.length, 1);
  assert.ok(baseline.promptLibrary.prompts.length >= 5);
  assert.ok(baseline.evalFramework.evaluators.some((item) => item.blocking));
  assert.ok(baseline.knowledgeSchema.namespaceIds.length > 0);
  assert.ok(baseline.recipes.length > 0);
});

test("each vertical domain baseline contains executable tool workflow eval governance smoke and rollout baselines", () => {
  const smokeRunner = new DomainSmokeTestRunner();
  for (const baseline of listVerticalDomainBaselines()) {
    assert.equal(baseline.definition.workflows.length >= 1, true, `${baseline.domainId} missing workflow baseline`);
    assert.equal(baseline.definition.toolBundles.length >= 1, true, `${baseline.domainId} missing tool bundle baseline`);
    assert.equal(
      baseline.definition.toolBundles.every((bundle) => bundle.tools.length >= 1),
      true,
      `${baseline.domainId} missing tool entries`,
    );
    assert.equal(
      baseline.definition.outputContracts.length >= 1,
      true,
      `${baseline.domainId} missing output contract baseline`,
    );
    assert.equal(baseline.promptLibrary.prompts.length >= 5, true, `${baseline.domainId} missing prompt baseline`);
    assert.equal(baseline.evalFramework.evaluators.length >= 3, true, `${baseline.domainId} missing eval baseline`);
    assert.equal(baseline.recipes.length >= 1, true, `${baseline.domainId} missing recipe baseline`);
    assert.equal(baseline.interactionRules.length >= 1, true, `${baseline.domainId} missing interaction baseline`);
    assert.equal(
      baseline.governancePolicy.rollout.rollbackWindowMinutes > 0,
      true,
      `${baseline.domainId} missing rollout baseline`,
    );
    assert.equal(smokeRunner.run(baseline.definition).passed, true, `${baseline.domainId} smoke baseline failed`);
  }
});

test("bootstrapVerticalDomainBaselines registers and activates all domain baselines", () => {
  const bootstrapped = bootstrapVerticalDomainBaselines();
  assert.equal(bootstrapped.baselines.length, 24);
  assert.equal(bootstrapped.activatedDomainIds.length, 24);
  assert.equal(bootstrapped.domainRegistry.listActive().length, 24);
  assert.ok(bootstrapped.reviews.every((review) => review.onboardingReadiness === "ready"));
  assert.ok(bootstrapped.reviews.every((review) => review.findings.length === 0));
  assert.ok(bootstrapped.governancePolicies.every((policy) => policy.mandatoryEvidence.includes("risk_profile")));
  assert.ok(
    bootstrapped.baselines.every((baseline) =>
      bootstrapped.domainRegistry.buildCapabilityEntry(baseline.domainId).knowledgeNamespaces.includes(baseline.knowledgeSchema.namespaceIds[0]!),
    ),
  );
});
