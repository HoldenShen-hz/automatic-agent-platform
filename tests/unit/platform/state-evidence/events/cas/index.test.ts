import test from "node:test";
import assert from "node:assert";
import {
  CasService,
  type CasResult,
  FencingTokenService,
  type FenceMode,
  type FenceInfo,
  type FencingTokenValidation,
  createInMemoryCasService,
} from "../../../../../../src/platform/state-evidence/events/cas/index.js";

test("events/cas/index exports CasService", () => {
  assert.ok(CasService !== undefined);
  assert.strictEqual(typeof CasService, "function");
});

test("events/cas/index exports CasResult interface", () => {
  // Verify the type exists by creating a value that conforms to it
  const result: CasResult = {
    success: true,
    currentVersion: 1,
  };
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.currentVersion, 1);
});

test("events/cas/index exports FencingTokenService", () => {
  assert.ok(FencingTokenService !== undefined);
  assert.strictEqual(typeof FencingTokenService, "function");
});

test("events/cas/index exports FenceMode type", () => {
  const mode: FenceMode = "shared";
  assert.strictEqual(mode, "shared");

  const exclusiveMode: FenceMode = "exclusive";
  assert.strictEqual(exclusiveMode, "exclusive");
});

test("events/cas/index exports FenceInfo interface", () => {
  const info: FenceInfo = {
    executionId: "exec-123",
    mode: "exclusive",
    fenceToken: "token-xyz",
    ownerNodeId: "node-1",
    acquiredAt: new Date(),
    expiresAt: null,
  };

  assert.strictEqual(info.executionId, "exec-123");
  assert.strictEqual(info.mode, "exclusive");
  assert.strictEqual(info.ownerNodeId, "node-1");
});

test("events/cas/index exports FencingTokenValidation interface", () => {
  const validation: FencingTokenValidation = {
    valid: true,
    executionId: "exec-456",
    owner: "node-2",
  };

  assert.strictEqual(validation.valid, true);
  assert.strictEqual(validation.executionId, "exec-456");
});

test("events/cas/index exports FencingTokenValidation with invalid result", () => {
  const validation: FencingTokenValidation = {
    valid: false,
    reason: "Token expired",
  };

  assert.strictEqual(validation.valid, false);
  assert.strictEqual(validation.reason, "Token expired");
});

test("CasService creates instance", () => {
  const service = createInMemoryCasService();
  assert.ok(service !== undefined);
  assert.ok(service instanceof CasService);
});

test("FencingTokenService creates instance with custom node ID", () => {
  const service = new FencingTokenService("test-node");
  assert.ok(service !== undefined);
  assert.strictEqual(service.getNodeId(), "test-node");
});

test("FencingTokenService creates with default node ID", () => {
  const service = new FencingTokenService();
  assert.strictEqual(service.getNodeId(), "default-node");
});
