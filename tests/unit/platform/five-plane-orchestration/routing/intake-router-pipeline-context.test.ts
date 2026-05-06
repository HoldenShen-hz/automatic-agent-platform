import assert from "node:assert/strict";
import test from "node:test";

import { IntakeRouter } from "../../../../../src/platform/five-plane-orchestration/routing/intake-router.js";

test("IntakeRouter.route carries §5.3 pipeline context into task draft, confirmed spec, and request envelope", async () => {
  const router = new IntakeRouter({
    divisionRegistry: {
      divisions: new Map(),
      workflows: new Map(),
    },
  });

  const result = await router.route({
    title: "Implement export pipeline",
    request: "implement an export pipeline for customer reports",
    tenantId: "tenant-alpha",
    traceId: "trace-alpha",
    idempotencyKey: "idem-alpha",
    principal: {
      principalId: "user-alpha",
      tenantId: "tenant-alpha",
      roles: ["operator"],
    },
    confirmedTaskSpecId: "ctspec-upstream",
  });

  assert.equal(result.taskDraft.tenantId, "tenant-alpha");
  assert.equal(result.taskDraft.principal.principalId, "user-alpha");
  assert.equal(result.confirmedTaskSpec.tenantId, "tenant-alpha");
  assert.equal(result.confirmedTaskSpec.traceId, "trace-alpha");
  assert.equal(result.confirmedTaskSpec.idempotencyKey, "idem-alpha");
  assert.equal(result.requestEnvelope.tenantId, "tenant-alpha");
  assert.equal(result.requestEnvelope.traceId, "trace-alpha");
  assert.equal(result.requestEnvelope.idempotencyKey, "idem-alpha");
  assert.equal(
    result.requestEnvelope.confirmedTaskSpecId,
    result.confirmedTaskSpec.confirmedTaskSpecId,
  );
  assert.equal(
    result.routeDecision.confirmedTaskSpecId,
    result.confirmedTaskSpec.confirmedTaskSpecId,
  );
  assert.ok(
    result.routeDecision.routeTrace.includes("pipeline_context:tenantId=tenant-alpha"),
  );
  assert.ok(
    result.routeDecision.routeTrace.includes("pipeline_context:traceId=trace-alpha"),
  );
});

test("IntakeRouter.route materializes clarification before confirmed task spec for ambiguous input", async () => {
  const router = new IntakeRouter({
    divisionRegistry: {
      divisions: new Map(),
      workflows: new Map(),
    },
  });

  const result = await router.route({
    title: "Maybe update the workflow",
    request: "maybe perhaps update the workflow with some rough improvements",
    tenantId: "tenant-beta",
    traceId: "trace-beta",
    idempotencyKey: "idem-beta",
    principal: {
      principalId: "user-beta",
      tenantId: "tenant-beta",
      roles: ["operator"],
    },
  });

  assert.ok(result.clarificationSession, "ambiguous request should create a clarification session");
  assert.equal(
    result.clarificationSession?.taskDraftId,
    result.taskDraft.taskDraftId,
  );
  assert.equal(
    result.confirmedTaskSpec.taskDraftId,
    result.taskDraft.taskDraftId,
  );
  assert.equal(
    result.requestEnvelope.confirmedTaskSpecId,
    result.confirmedTaskSpec.confirmedTaskSpecId,
  );
});
