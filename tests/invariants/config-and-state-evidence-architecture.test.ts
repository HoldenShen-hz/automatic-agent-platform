import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DomainDefinitionSchema,
} from "../../src/domains/registry/domain-model.js";
import {
  DomainInteractionRuleSchema,
} from "../../src/domains/interaction-policy/index.js";
import {
  createResourceQuota,
  canAllocate,
} from "../../src/platform/shared/scaling/resource-quota.js";
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
    "ai",
    "compliance",
    "reputational",
    "safety",
    "strategic",
  ]);
});

test("runtime config keeps a concurrent default while workflow quotas live in dedicated quota models", () => {
  const config = JSON.parse(readFileSync("config/runtime/default.json", "utf8"));

  assert.equal("maxConcurrentRuns" in config, false);
  assert.equal(config.maxConcurrentTasks, 4);

  const rule = DomainInteractionRuleSchema.parse({
    sourceDomainId: "finance",
    targetDomainId: "ops",
    mode: "allow",
    maxConcurrentWorkflows: 2,
  });
  assert.equal(rule.maxConcurrentWorkflows, 2);

  const quota = createResourceQuota("org-finance", {
    guaranteed: { maxConcurrentWorkflows: 3 },
    burstable: { maxConcurrentWorkflows: 3 },
    maxLimit: { maxConcurrentWorkflows: 3 },
  });
  const admission = canAllocate(quota, {
    orgNodeId: "org-finance",
    activeWorkflows: 2,
    activeWorkers: 0,
    llmTokensUsedLastMinute: 0,
    llmRequestsUsedLastMinute: 0,
  }, {
    maxConcurrentWorkflows: 2,
  });

  assert.equal(admission.admitted, false);
  assert.equal(admission.rejectedDueTo, "maxConcurrentWorkflows");
});

test("state evidence plane exports reconciliation, side-effect ledger, outbox, and compaction modules", () => {
  assert.equal(typeof stateEvidence.reconciliation.createReconciliationEvidenceRecord, "function");
  assert.equal(typeof stateEvidence.sideEffectLedger.createSideEffectLedgerEntry, "function");
  assert.equal(typeof stateEvidence.outbox.createStateEvidenceOutboxMessage, "function");
  assert.equal(typeof stateEvidence.compaction.createCompactionEvidenceRecord, "function");
});
