import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  SdkVersionHandshakeService,
  type SdkVersionHandshakePolicy,
  type SdkVersionHandshakeRequest,
} from "../../../../../../src/platform/five-plane-interface/api/middleware/sdk-version-handshake.js";

const makePolicy = (overrides: Partial<SdkVersionHandshakePolicy> = {}): SdkVersionHandshakePolicy => ({
  platformVersion: "2026.04.01",
  contractVersion: "1.0.0",
  minimumSdkVersion: "1.0.0",
  recommendedSdkVersion: "2.0.0",
  ...overrides,
});

const makeRequest = (headers: Record<string, string | string[] | undefined> = {}): SdkVersionHandshakeRequest => ({
  headers: Object.freeze(headers),
});

test("SdkVersionHandshakeService.evaluate returns accepted for valid SDK version", () => {
  const service = new SdkVersionHandshakeService(makePolicy());
  const request = makeRequest({
    "x-sdk-version": "1.5.0",
  });

  const decision = service.evaluate(request);
  assert.equal(decision.accepted, true);
  assert.equal(decision.statusCode, 200);
  assert.equal(decision.reasonCode, "sdk.accepted");
});

test("SdkVersionHandshakeService.evaluate returns upgrade required for missing SDK version", () => {
  const service = new SdkVersionHandshakeService(makePolicy());
  const request = makeRequest({});

  const decision = service.evaluate(request);
  assert.equal(decision.accepted, false);
  assert.equal(decision.statusCode, 426);
  assert.equal(decision.reasonCode, "sdk.upgrade_required");
});

test("SdkVersionHandshakeService.evaluate returns upgrade required for outdated SDK version", () => {
  const service = new SdkVersionHandshakeService(makePolicy());
  const request = makeRequest({
    "x-sdk-version": "0.5.0",
  });

  const decision = service.evaluate(request);
  assert.equal(decision.accepted, false);
  assert.equal(decision.statusCode, 426);
  assert.equal(decision.reasonCode, "sdk.upgrade_required");
});

test("SdkVersionHandshakeService.evaluate checks platform min version compatibility", () => {
  const service = new SdkVersionHandshakeService(makePolicy());
  const request = makeRequest({
    "x-sdk-version": "1.5.0",
    "x-platform-min-version": "2026.05.01", // Higher than platform version
  });

  const decision = service.evaluate(request);
  assert.equal(decision.accepted, false);
  assert.equal(decision.reasonCode, "sdk.platform_incompatible");
});

test("SdkVersionHandshakeService.evaluate adds warning for contract version mismatch", () => {
  const service = new SdkVersionHandshakeService(makePolicy());
  const request = makeRequest({
    "x-sdk-version": "2.0.0",
    "x-contract-version": "0.9.0",
  });

  const decision = service.evaluate(request);
  assert.equal(decision.accepted, true);
  assert.ok(decision.warnings.some((w) => w.includes("contract")));
});

test("SdkVersionHandshakeService.evaluate adds warning for SDK below recommended", () => {
  const service = new SdkVersionHandshakeService(makePolicy());
  const request = makeRequest({
    "x-sdk-version": "1.5.0",
  });

  const decision = service.evaluate(request);
  assert.equal(decision.accepted, true);
  assert.ok(decision.warnings.some((w) => w.includes("recommended")));
});

test("SdkVersionHandshakeService.evaluate returns no warnings when SDK matches recommended", () => {
  const service = new SdkVersionHandshakeService(makePolicy({
    recommendedSdkVersion: "1.5.0",
  }));
  const request = makeRequest({
    "x-sdk-version": "1.5.0",
  });

  const decision = service.evaluate(request);
  assert.equal(decision.accepted, true);
  assert.equal(decision.warnings.length, 0);
});

test("SdkVersionHandshakeService.evaluate handles array header values", () => {
  const service = new SdkVersionHandshakeService(makePolicy());
  const request = makeRequest({
    "x-sdk-version": ["1.5.0", "2.0.0"],
  });

  const decision = service.evaluate(request);
  assert.equal(decision.accepted, true);
});

test("SdkVersionHandshakeService.evaluate uses first value from array", () => {
  const service = new SdkVersionHandshakeService(makePolicy());
  const request = makeRequest({
    "x-sdk-version": ["0.5.0", "2.0.0"],
  });

  const decision = service.evaluate(request);
  assert.equal(decision.accepted, false); // Uses first value 0.5.0 which is below minimum
});

test("SdkVersionHandshakeService.evaluate builds correct response headers", () => {
  const service = new SdkVersionHandshakeService(makePolicy());
  const request = makeRequest({
    "x-sdk-version": "1.5.0",
  });

  const decision = service.evaluate(request);
  assert.ok(decision.responseHeaders["X-Platform-Version"]);
  assert.ok(decision.responseHeaders["X-Contract-Version"]);
  assert.ok(decision.responseHeaders["X-SDK-Compatibility"]);
});

test("SdkVersionHandshakeService.evaluate case insensitive header lookup", () => {
  const service = new SdkVersionHandshakeService(makePolicy());
  const request = makeRequest({
    "X-SDK-VERSION": "1.5.0",
  });

  const decision = service.evaluate(request);
  assert.equal(decision.accepted, true);
});

test("SdkVersionHandshakeService.compareSemver compares versions correctly", () => {
  const service = new SdkVersionHandshakeService(makePolicy());
  // Access private method via public evaluate
  const request = makeRequest({ "x-sdk-version": "1.0.0" });
  service.evaluate(request); // Just to create instance

  // Test that 1.0.0 < 2.0.0
  const request2 = makeRequest({ "x-sdk-version": "0.9.0" });
  const decision = service.evaluate(request2);
  assert.equal(decision.accepted, false); // 0.9.0 < minimum 1.0.0
});