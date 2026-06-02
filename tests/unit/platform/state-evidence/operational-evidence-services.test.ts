import assert from "node:assert/strict";
import test from "node:test";

import { StateEvidenceOutboxService } from "../../../../src/platform/five-plane-state-evidence/outbox/index.js";
import { SideEffectLedgerService } from "../../../../src/platform/five-plane-state-evidence/side-effect-ledger/index.js";
import { ReconciliationEvidenceService } from "../../../../src/platform/five-plane-state-evidence/reconciliation/index.js";
import { CompactionEvidenceService } from "../../../../src/platform/five-plane-state-evidence/compaction/index.js";

test("StateEvidenceOutboxService enqueues and marks messages as published", () => {
  const service = new StateEvidenceOutboxService();

  service.enqueue({
    messageId: "msg-1",
    partitionKey: "tenant-a",
    eventType: "projection.updated",
    payload: { ok: true },
    status: "pending",
    attemptCount: 0,
  });
  const published = service.markPublished("msg-1");

  assert.equal(published?.status, "published");
  assert.equal(published?.attemptCount, 1);
  assert.equal(service.listByStatus("published").length, 1);
});

test("SideEffectLedgerService persists entries by node run", () => {
  const service = new SideEffectLedgerService();

  service.upsert({
    sideEffectId: "effect-1",
    nodeRunId: "node-1",
    idempotencyKey: "idem-1",
    status: "committed",
    externalRef: "ext-1",
    evidenceRefs: ["artifact://receipt/1"],
  });

  assert.equal(service.findById("effect-1")?.status, "committed");
  assert.equal(service.listByNodeRun("node-1").length, 1);
});

test("ReconciliationEvidenceService records and filters mismatches", () => {
  const service = new ReconciliationEvidenceService();

  service.record({
    reconciliationId: "rec-1",
    sourceRef: "truth://dispatch/1",
    observedState: { status: "pending" },
    expectedState: { status: "claimed" },
    result: "mismatched",
    evidenceRefs: ["artifact://reconciliation/1"],
  });
  service.record({
    reconciliationId: "rec-2",
    sourceRef: "truth://dispatch/2",
    observedState: { status: "claimed" },
    expectedState: { status: "claimed" },
    result: "matched",
    evidenceRefs: ["artifact://reconciliation/2"],
  });

  assert.deepEqual(service.listMismatches().map((record) => record.reconciliationId), ["rec-1"]);
});

test("CompactionEvidenceService appends records by retention policy", () => {
  const service = new CompactionEvidenceService();

  service.append({
    compactionId: "compact-1",
    sourceRefs: ["truth://events/1", "truth://events/2"],
    artifactRef: "artifact://compaction/1",
    retentionPolicyRef: "policy://retention/default",
    reversible: true,
  });

  assert.equal(service.listByRetentionPolicy("policy://retention/default").length, 1);
});
