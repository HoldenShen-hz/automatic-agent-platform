import assert from "node:assert/strict";
import test from "node:test";

import { DomainOnboardingService } from "../../../../src/domains/operations/domain-onboarding-service.js";

test("domain onboarding barrel exposes the service implementation", () => {
  assert.equal(typeof DomainOnboardingService, "function");
});
