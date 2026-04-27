import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DomainDefinitionSchema,
} from "../../src/domains/registry/domain-model.js";
import * as stateEvidence from "../../src/platform/state-evidence/index.js";

test("quant trading domain config conforms to DomainDefinitionSchema", () => {
  const config = JSON.parse(readFileSync("config/domains/quant-trading.json", "utf8"));
  const parsed = DomainDefinitionSchema.parse(config);

  assert.equal(parsed.domainId, "quant-trading");
  assert.equal(parsed.status, "active");
  assert.ok(parsed.capabilities.requiredTools.includes("risk_calculator"));
});

test("risk config defines the architecture risk categories", () => {
  const config = JSON.parse(readFileSync("config/risk/default.json", "utf8"));

  assert.deepEqual(config.riskCategories, [
    "operational",
    "financial",
    "compliance",
    "reputational",
    "safety",
    "strategic",
  ]);
});

test("state evidence plane exports reconciliation, side-effect ledger, outbox, and compaction modules", () => {
  assert.equal(typeof stateEvidence.reconciliation.createReconciliationEvidenceRecord, "function");
  assert.equal(typeof stateEvidence.sideEffectLedger.createSideEffectLedgerEntry, "function");
  assert.equal(typeof stateEvidence.outbox.createStateEvidenceOutboxMessage, "function");
  assert.equal(typeof stateEvidence.compaction.createCompactionEvidenceRecord, "function");
});
