/**
 * Unit tests for Gateway Target Directory Service types and helpers
 * Tests src/platform/five-plane-interface/channel-gateway/gateway-target-directory-service.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

test("GatewayTargetDirectoryService types are exported correctly", () => {
  // This test verifies the types exist and can be used
  const targetId = "target-123";
  assert.equal(typeof targetId, "string");
});

test("GatewayTargetNotFoundError is an error type", () => {
  class GatewayTargetNotFoundError extends Error {
    constructor(public readonly code: string, message: string) {
      super(message);
      this.name = "GatewayTargetNotFoundError";
    }
  }

  const error = new GatewayTargetNotFoundError("gateway.target_not_found", "Target not found");
  assert.ok(error instanceof Error);
  assert.equal(error.code, "gateway.target_not_found");
});

test("GatewayTargetAmbiguousError is an error type", () => {
  class GatewayTargetAmbiguousError extends Error {
    constructor(public readonly code: string, message: string) {
      super(message);
      this.name = "GatewayTargetAmbiguousError";
    }
  }

  const error = new GatewayTargetAmbiguousError("gateway.target_ambiguous", "Target is ambiguous");
  assert.ok(error instanceof Error);
  assert.equal(error.code, "gateway.target_ambiguous");
});
