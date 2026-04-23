import { describe, it } from "node:test";
import assert from "node:assert";
import {
  CasService,
  type CasResult,
  FencingTokenService,
  type FenceMode,
  type FenceInfo,
  type FencingTokenValidation,
} from "../../../../../../src/platform/state-evidence/events/cas/index.js";

describe("events/cas/index", () => {
  describe("module exports", () => {
    it("should export CasService", () => {
      assert.ok(CasService !== undefined);
      assert.strictEqual(typeof CasService, "function");
    });

    it("should export CasResult interface", () => {
      // Verify the type exists by creating a value that conforms to it
      const result: CasResult = {
        success: true,
        currentVersion: 1,
      };
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.currentVersion, 1);
    });

    it("should export FencingTokenService", () => {
      assert.ok(FencingTokenService !== undefined);
      assert.strictEqual(typeof FencingTokenService, "function");
    });

    it("should export FenceMode type", () => {
      const mode: FenceMode = "shared";
      assert.strictEqual(mode, "shared");

      const exclusiveMode: FenceMode = "exclusive";
      assert.strictEqual(exclusiveMode, "exclusive");
    });

    it("should export FenceInfo interface", () => {
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

    it("should export FencingTokenValidation interface", () => {
      const validation: FencingTokenValidation = {
        valid: true,
        executionId: "exec-456",
        owner: "node-2",
      };

      assert.strictEqual(validation.valid, true);
      assert.strictEqual(validation.executionId, "exec-456");
    });

    it("should export FencingTokenValidation with invalid result", () => {
      const validation: FencingTokenValidation = {
        valid: false,
        reason: "Token expired",
      };

      assert.strictEqual(validation.valid, false);
      assert.strictEqual(validation.reason, "Token expired");
    });
  });

  describe("CasService instantiation", () => {
    it("should create CasService instance", () => {
      const service = new CasService();
      assert.ok(service !== undefined);
    });
  });

  describe("FencingTokenService instantiation", () => {
    it("should create FencingTokenService instance", () => {
      const service = new FencingTokenService("test-node");
      assert.ok(service !== undefined);
      assert.strictEqual(service.getNodeId(), "test-node");
    });

    it("should create with default node ID", () => {
      const service = new FencingTokenService();
      assert.strictEqual(service.getNodeId(), "default-node");
    });
  });
});