/**
 * Tests for marketplace tenant-platform-service-async re-export
 *
 * Verifies the re-export from tenant-platform/tenant-platform-service-async works correctly.
 */

import assert from "node:assert/strict";
import test from "node:test";

import * as TenantPlatformServiceAsync from "../../../../src/scale-ecosystem/marketplace/tenant-platform-service-async.js";

test("tenant-platform-service-async exports TenantPlatformServiceAsync [tenant-platform-service-async]", () => {
  assert.ok(TenantPlatformServiceAsync.TenantPlatformServiceAsync !== undefined);
});
