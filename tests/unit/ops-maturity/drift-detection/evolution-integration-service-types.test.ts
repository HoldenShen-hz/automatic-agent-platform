import assert from "node:assert/strict";
import test from "node:test";

import type { EvolutionIntegrationConfig } from "../../../../src/ops-maturity/drift-detection/evolution-integration-service.js";
import { DEFAULT_CONFIG } from "../../../../src/ops-maturity/drift-detection/evolution-integration-service.js";

test("EvolutionIntegrationConfig structure is correct", () => {
  const config: EvolutionIntegrationConfig = {
    reflectionThreshold: 5,
    proposalConfidenceThreshold: 0.7,
    enableAutomaticProposal: true,
  };

  assert.equal(config.reflectionThreshold, 5);
  assert.equal(config.proposalConfidenceThreshold, 0.7);
  assert.equal(config.enableAutomaticProposal, true);
});

test("DEFAULT_CONFIG has correct values", () => {
  assert.equal(DEFAULT_CONFIG.reflectionThreshold, 3);
  assert.equal(DEFAULT_CONFIG.proposalConfidenceThreshold, 0.6);
  assert.equal(DEFAULT_CONFIG.enableAutomaticProposal, true);
});

test("EvolutionIntegrationConfig allows minimal definition", () => {
  const config: EvolutionIntegrationConfig = {
    reflectionThreshold: 1,
    proposalConfidenceThreshold: 0.5,
    enableAutomaticProposal: false,
  };

  assert.equal(config.reflectionThreshold, 1);
  assert.equal(config.proposalConfidenceThreshold, 0.5);
  assert.equal(config.enableAutomaticProposal, false);
});

test("EvolutionIntegrationConfig threshold values are numbers", () => {
  const config: EvolutionIntegrationConfig = {
    reflectionThreshold: 10,
    proposalConfidenceThreshold: 0.9,
    enableAutomaticProposal: true,
  };

  assert.equal(typeof config.reflectionThreshold, "number");
  assert.equal(typeof config.proposalConfidenceThreshold, "number");
});

test("DEFAULT_CONFIG threshold values are within expected ranges", () => {
  assert.ok(DEFAULT_CONFIG.reflectionThreshold >= 1);
  assert.ok(DEFAULT_CONFIG.proposalConfidenceThreshold >= 0);
  assert.ok(DEFAULT_CONFIG.proposalConfidenceThreshold <= 1);
});
