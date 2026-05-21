import test from "node:test";
import assert from "node:assert/strict";
import { AdminRuntimeDirectiveService } from "../../../../../src/platform/five-plane-interface/api/admin-runtime-directive-service.js";

// Mock PlatformPanicService for testing
const mockPanicService = {
  activate: (input: any) => ({
    scope: input.scope,
    activatedAt: new Date().toISOString(),
    directive: "panic",
    metadata: input.metadata,
  }),
  resume: (scope: string, plan: any) => ({
    scope,
    resumedAt: new Date().toISOString(),
    planId: plan.planId,
  }),
  getActive: (scope: string) => ({
    scope,
    activatedAt: new Date().toISOString(),
    directive: "panic",
    metadata: {},
  }),
};

test("AdminRuntimeDirectiveService issues panic directive", () => {
  const service = new AdminRuntimeDirectiveService();

  // Access private panicService via any to spy on it
  (service as any).panicService = mockPanicService;

  const request = {
    scope: "region-us-east-1",
    reason: "Critical failure detected",
    metadata: { incidentId: "INC-001" },
  };

  const result = service.issuePanicDirective(request);

  assert.equal(result.scope, "region-us-east-1");
  assert.equal(result.directive, "panic");
  assert.ok(result.activatedAt !== undefined);
});

test("AdminRuntimeDirectiveService.submitResumeDirective returns resume receipt", () => {
  const service = new AdminRuntimeDirectiveService();
  (service as any).panicService = mockPanicService;

  const plan = {
    planId: "resume-001",
    scope: "region-us-east-1",
    steps: [{ action: "restart", target: "service-1" }],
  };

  const result = service.submitResumeDirective(plan);

  assert.equal(result.scope, "region-us-east-1");
  assert.equal(result.planId, "resume-001");
  assert.ok(result.resumedAt !== undefined);
});

test("AdminRuntimeDirectiveService.getActivePanicDirective returns active directive", () => {
  const service = new AdminRuntimeDirectiveService();
  (service as any).panicService = mockPanicService;

  const result = service.getActivePanicDirective("region-us-east-1");

  assert.ok(result !== null);
  assert.equal(result!.scope, "region-us-east-1");
  assert.equal(result!.directive, "panic");
});

test("AdminRuntimeDirectiveService.getActivePanicDirective returns null for unknown scope", () => {
  const service = new AdminRuntimeDirectiveService();
  (service as any).panicService = {
    ...mockPanicService,
    getActive: () => null,
  };

  const result = service.getActivePanicDirective("unknown-scope");

  assert.equal(result, null);
});
