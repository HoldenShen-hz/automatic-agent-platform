import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import {
  bootstrapVerticalDomainBaselines,
  getVerticalDomainBaseline,
  listVerticalDomainBaselines,
  listVerticalDomainBaselinesByPhase,
  listVerticalDomainConfigPaths,
  resolveCanonicalVerticalDomainId,
  validateVerticalDomainConfigs,
  type VerticalDomainPhase,
} from "../../../src/domains/domain-baseline-catalog.js";

test("vertical domain baseline catalog exposes 31 canonical domains across 6 phases", () => {
  const baselines = listVerticalDomainBaselines();
  assert.equal(baselines.length, 31);
  assert.deepEqual(
    (["9a", "9b", "9c", "9d", "9e", "9f"] as const satisfies readonly VerticalDomainPhase[])
      .map((phase) => listVerticalDomainBaselinesByPhase(phase).length),
    [4, 4, 6, 5, 6, 6],
  );
  assert.equal(baselines.some((baseline) => baseline.domainId === "quant-trading"), true);
  assert.equal(baselines.some((baseline) => baseline.domainId === "finance-accounting"), true);
  assert.equal(baselines.some((baseline) => baseline.domainId === "marketing"), true);
});

test("vertical domain baseline catalog resolves legacy domain ids to canonical ids", () => {
  assert.equal(resolveCanonicalVerticalDomainId("quantitative-trading"), "quant-trading");
  assert.equal(resolveCanonicalVerticalDomainId("data-processing"), "data-engineering");
  assert.equal(resolveCanonicalVerticalDomainId("data-analytics"), "data-engineering");
  assert.equal(resolveCanonicalVerticalDomainId("finance"), "finance-accounting");
  assert.equal(resolveCanonicalVerticalDomainId("sales"), "ecommerce");
  assert.equal(resolveCanonicalVerticalDomainId("security"), "content-moderation");
  assert.equal(resolveCanonicalVerticalDomainId("marketing-brand"), "marketing");

  const quantTrading = getVerticalDomainBaseline("quantitative-trading");
  assert.equal(quantTrading.domainId, "quant-trading");
  assert.deepEqual(quantTrading.legacyDomainIds, ["quantitative-trading"]);
});

test("vertical domain baseline catalog emits canonical DAG workflow metadata for regulated domains", () => {
  const quantTrading = getVerticalDomainBaseline("quant-trading");
  const legal = getVerticalDomainBaseline("legal");

  assert.equal(quantTrading.definition.workflows[0]?.planGraph?.graphId, "graph:quant-trading:primary");
  assert.equal(quantTrading.definition.workflows[0]?.planGraph?.nodes.length, quantTrading.definition.workflows[0]?.steps.length);
  assert.equal(quantTrading.definition.workflows[0]?.planGraph?.edges.length, quantTrading.definition.workflows[0]!.steps.length - 1);
  assert.equal(legal.definition.workflows[0]?.planGraph?.graphId, "graph:legal:primary");
  assert.equal(legal.definition.workflows[0]?.planGraph?.nodes.length, legal.definition.workflows[0]?.steps.length);
  assert.equal(legal.definition.workflows[0]?.planGraph?.entryNodeIds[0], "node:legal:collect_authorities");
});

test("vertical domain baseline catalog wires meta-model completeness and domain specialization metadata", () => {
  const baseline = getVerticalDomainBaseline("healthcare");
  assert.equal(baseline.metaModelValidation.valid, true);
  assert.equal(baseline.metaModelValidation.completeness, 100);
  assert.deepEqual(baseline.metaModelValidation.missingQuestionIds, []);
  assert.equal(baseline.workflowSpecialization.stageNames.includes("route_for_clinician_review"), true);
  assert.equal(baseline.toolingSpecialization.requiredToolNames.includes("ehr_reader"), true);
  assert.equal(baseline.evalSpecialization.blockingMetricIds.includes("clinical_safety"), true);
  assert.equal(baseline.latencyProfile.dataSensitivity, "regulated");
  assert.equal(baseline.ownershipProfile.divisionId, "security");
});

test("vertical domain baseline catalog points every domain to a real config file", () => {
  const configPaths = listVerticalDomainConfigPaths();
  assert.equal(configPaths.length, 31);
  assert.equal(configPaths.every((configPath) => existsSync(configPath)), true);
  assert.deepEqual(validateVerticalDomainConfigs(), []);
});

test("vertical domain bootstrap activates all canonical domain definitions with specialized workflows", () => {
  const bootstrapped = bootstrapVerticalDomainBaselines();
  assert.equal(bootstrapped.baselines.length, 31);
  assert.equal(bootstrapped.activatedDomainIds.length, 31);
  assert.equal(
    bootstrapped.baselines.every((baseline) => baseline.definition.workflows[0]!.steps.length >= 4),
    true,
  );
  assert.equal(
    bootstrapped.baselines.every((baseline) => baseline.definition.toolBundles[0]!.tools.length >= 3),
    true,
  );
  assert.equal(
    bootstrapped.reviews.every((review) => review.metaModelCompleteness === 100 && review.onboardingReadiness === "ready"),
    true,
  );
});
