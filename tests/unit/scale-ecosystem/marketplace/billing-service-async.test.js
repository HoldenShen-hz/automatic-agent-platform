// @ts-nocheck
/**
 * Tests for marketplace billing-service-async re-export
 *
 * Verifies the re-export from billing/billing-service-async works correctly.
 */
import assert from "node:assert/strict";
import test from "node:test";
import * as BillingServiceAsync from "../../../../src/scale-ecosystem/marketplace/billing-service-async.js";
test("billing-service-async exports BillingServiceAsync", () => {
    assert.ok(BillingServiceAsync.BillingServiceAsync !== undefined);
});
//# sourceMappingURL=billing-service-async.test.js.map