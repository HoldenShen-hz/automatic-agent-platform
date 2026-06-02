import assert from "node:assert/strict";
import test from "node:test";

import { HitlRuntime, InMemoryHitlStore } from "../../../../../src/platform/five-plane-orchestration/harness/hitl-runtime.js";

test("HitlRuntime.open assigns an expiry to pending requests", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-r23-50-open",
    domainId: "legal",
    reason: "manual approval required",
    evidenceRefs: ["evidence-1"],
  });

  assert.ok(request.expiresAt != null);
  assert.ok(Date.parse(request.expiresAt!) > Date.parse(request.requestedAt));
});

test("HitlRuntime auto-expires stale pending requests on access", () => {
  const runtime = new HitlRuntime();
  const request = runtime.open({
    runId: "run-r23-50-expired",
    domainId: "legal",
    reason: "manual approval required",
    evidenceRefs: ["evidence-2"],
    expiresAt: new Date(Date.now() - 1_000).toISOString(),
  });

  const expired = runtime.get(request.requestId);

  assert.ok(expired != null);
  assert.equal(expired!.status, "rejected");
  assert.equal(expired!.resolvedBy, "system:hitl_timeout");
  assert.ok(expired!.resolvedAt != null);
  assert.ok(runtime.getResponsibilityRecord(request.requestId) != null);
});

test("HitlRuntime persists responsibility records across runtime instances", () => {
  const store = new InMemoryHitlStore();
  const firstRuntime = new HitlRuntime({ store });
  const request = firstRuntime.open({
    runId: "run-r23-50-records",
    domainId: "legal",
    reason: "manual review required",
    evidenceRefs: ["evidence-3"],
  });

  firstRuntime.inspect(request.requestId, "operator-a");
  firstRuntime.resolve(request.requestId, "approved", "operator-b");

  const reloadedRuntime = new HitlRuntime({ store });
  const records = reloadedRuntime.getResponsibilityRecords(request.requestId);

  assert.equal(records.length, 2);
  assert.equal(records[0]?.action, "inspect");
  assert.equal(records[1]?.action, "resume");
});
