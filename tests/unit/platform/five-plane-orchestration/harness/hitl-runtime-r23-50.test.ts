import assert from "node:assert/strict";
import test from "node:test";

import { HitlRuntime } from "../../../../../src/platform/five-plane-orchestration/harness/hitl-runtime.js";

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
