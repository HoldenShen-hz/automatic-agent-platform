import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import {
  FencingTokenService,
  type FenceMode,
  type FenceInfo,
  type FencingTokenValidation,
} from "../../../../../../src/platform/state-evidence/events/cas/fencing-token-service.js";

describe("FencingTokenService", () => {
  let service: FencingTokenService;

  beforeEach(() => {
    service = new FencingTokenService("test-node");
  });

  afterEach(() => {
    service.clearAllFences();
  });

  describe("constructor", () => {
    it("should use default node ID when not provided", () => {
      const defaultService = new FencingTokenService();
      assert.strictEqual(defaultService.getNodeId(), "default-node");
    });

    it("should use provided node ID", () => {
      const customService = new FencingTokenService("custom-node-id");
      assert.strictEqual(customService.getNodeId(), "custom-node-id");
    });
  });

  describe("generateFencingToken", () => {
    it("should generate unique tokens for different executions", () => {
      const token1 = service.generateFencingToken("exec-1", "node-1");
      const token2 = service.generateFencingToken("exec-2", "node-1");

      assert.notStrictEqual(token1, token2);
    });

    it("should include execution ID in token", () => {
      const token = service.generateFencingToken("exec-123", "node-1");

      assert.ok(token.startsWith("exec-123-"), "Token should start with execution ID");
    });

    it("should include node ID in token", () => {
      const token = service.generateFencingToken("exec-1", "node-specific");

      assert.ok(token.includes("-node-specific-"), "Token should include node ID");
    });

    it("should generate monotonically increasing tokens", () => {
      const token1 = service.generateFencingToken("exec-1", "node-1");
      const token2 = service.generateFencingToken("exec-1", "node-1");

      // Extract counter from tokens (format: executionId-nodeId-counter-timestamp)
      const parts1 = token1.split("-");
      const parts2 = token2.split("-");
      assert.ok(parts1.length >= 3, "Token should have at least 3 parts");
      assert.ok(parts2.length >= 3, "Token should have at least 3 parts");
      const counter1 = parseInt(parts1[2]!, 10);
      const counter2 = parseInt(parts2[2]!, 10);

      assert.ok(counter2 > counter1, "Counter should increase");
    });

    it("should include timestamp in token", () => {
      const token = service.generateFencingToken("exec-1", "node-1");
      const parts = token.split("-");

      assert.ok(parts.length >= 4, "Token should have at least 4 parts");
      const timestamp = parseInt(parts[3]!, 10);
      assert.ok(timestamp > 0, "Timestamp should be a positive number");
    });
  });

  describe("validateFencingToken", () => {
    it("should return valid for a properly formatted token", () => {
      const token = service.generateFencingToken("exec-123", "test-node");
      const result = service.validateFencingToken(token, "test-node");

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.executionId, "exec-123");
      assert.strictEqual(result.owner, "test-node");
    });

    it("should return invalid for empty token", () => {
      const result = service.validateFencingToken("", "test-node");

      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.reason, "Empty or invalid token");
    });

    it("should return invalid for null token", () => {
      const result = service.validateFencingToken(null as any, "test-node");

      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.reason, "Empty or invalid token");
    });

    it("should return invalid for token with too few parts", () => {
      const result = service.validateFencingToken("invalid-token", "test-node");

      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.reason, "Token format invalid");
    });

    it("should return invalid when owner does not match", () => {
      const token = service.generateFencingToken("exec-123", "node-1");
      const result = service.validateFencingToken(token, "different-node");

      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.owner, "node-1");
      assert.strictEqual(result.reason, "Token not owned by expected owner");
    });

    it("should return invalid when execution ID part is empty", () => {
      // Manually create a malformed token
      const malformedToken = "-node-1-1-12345";
      const result = service.validateFencingToken(malformedToken, "node-1");

      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.reason, "Token format invalid");
    });
  });

  describe("acquireFence", () => {
    it("should acquire a shared fence successfully", () => {
      const result = service.acquireFence("exec-123", "shared");

      assert.ok(result !== null);
      assert.strictEqual(result.executionId, "exec-123");
      assert.strictEqual(result.mode, "shared");
      assert.strictEqual(result.ownerNodeId, "test-node");
      assert.ok(result.fenceToken.length > 0);
      assert.ok(result.acquiredAt instanceof Date);
      assert.strictEqual(result.expiresAt, null);
    });

    it("should acquire an exclusive fence successfully", () => {
      const result = service.acquireFence("exec-456", "exclusive");

      assert.ok(result !== null);
      assert.strictEqual(result.executionId, "exec-456");
      assert.strictEqual(result.mode, "exclusive");
    });

    it("should allow multiple shared fences for same execution", () => {
      const service1 = new FencingTokenService("node-1");
      const service2 = new FencingTokenService("node-2");

      const fence1 = service1.acquireFence("exec-shared", "shared");
      const fence2 = service2.acquireFence("exec-shared", "shared");

      assert.ok(fence1 !== null);
      assert.ok(fence2 !== null);
    });

    it("should reject exclusive fence when another node holds exclusive", () => {
      const service1 = new FencingTokenService("node-1");
      const service2 = new FencingTokenService("node-2");

      // Node 1 acquires exclusive
      const fence1 = service1.acquireFence("exec-exclusive", "exclusive");
      assert.ok(fence1 !== null);

      // Node 2 tries to acquire exclusive - should fail
      const fence2 = service2.acquireFence("exec-exclusive", "exclusive");
      assert.strictEqual(fence2, null);
    });

    it("should reject exclusive fence when another node holds any fence", () => {
      const service1 = new FencingTokenService("node-1");
      const service2 = new FencingTokenService("node-2");

      // Node 1 acquires shared
      const fence1 = service1.acquireFence("exec-any", "shared");
      assert.ok(fence1 !== null);

      // Node 2 tries to acquire exclusive - should fail
      const fence2 = service2.acquireFence("exec-any", "exclusive");
      assert.strictEqual(fence2, null);
    });

    it("should allow same node to acquire multiple fences", () => {
      const fence1 = service.acquireFence("exec-1", "shared");
      const fence2 = service.acquireFence("exec-2", "shared");

      assert.ok(fence1 !== null);
      assert.ok(fence2 !== null);
      assert.strictEqual(service.getActiveFenceCount(), 2);
    });
  });

  describe("releaseFence", () => {
    it("should release a held fence", () => {
      service.acquireFence("exec-release", "shared");
      assert.strictEqual(service.isFenceHeld("exec-release"), true);

      const released = service.releaseFence("exec-release");
      assert.strictEqual(released, true);
      assert.strictEqual(service.isFenceHeld("exec-release"), false);
    });

    it("should return false when releasing non-existent fence", () => {
      const result = service.releaseFence("non-existent-exec");
      assert.strictEqual(result, false);
    });

    it("should allow re-acquiring after release", () => {
      service.acquireFence("exec-reacquire", "shared");
      service.releaseFence("exec-reacquire");

      const fence = service.acquireFence("exec-reacquire", "shared");
      assert.ok(fence !== null);
    });
  });

  describe("isFenceHeld", () => {
    it("should return true when fence is held", () => {
      service.acquireFence("exec-held", "shared");
      assert.strictEqual(service.isFenceHeld("exec-held"), true);
    });

    it("should return false when fence is not held", () => {
      assert.strictEqual(service.isFenceHeld("exec-not-held"), false);
    });

    it("should return false after fence is released", () => {
      service.acquireFence("exec-released", "shared");
      service.releaseFence("exec-released");
      assert.strictEqual(service.isFenceHeld("exec-released"), false);
    });
  });

  describe("getFenceInfo", () => {
    it("should return fence info when fence is held", () => {
      const fence = service.acquireFence("exec-info", "exclusive");
      const info = service.getFenceInfo("exec-info");

      assert.ok(info !== undefined);
      assert.strictEqual(info?.executionId, "exec-info");
      assert.strictEqual(info?.mode, "exclusive");
      assert.strictEqual(info?.ownerNodeId, "test-node");
    });

    it("should return undefined when fence is not held", () => {
      const info = service.getFenceInfo("non-existent");
      assert.strictEqual(info, undefined);
    });
  });

  describe("clearAllFences", () => {
    it("should clear all active fences", () => {
      service.acquireFence("exec-1", "shared");
      service.acquireFence("exec-2", "shared");
      assert.strictEqual(service.getActiveFenceCount(), 2);

      service.clearAllFences();
      assert.strictEqual(service.getActiveFenceCount(), 0);
    });
  });

  describe("getActiveFenceCount", () => {
    it("should return 0 initially", () => {
      assert.strictEqual(service.getActiveFenceCount(), 0);
    });

    it("should return correct count after acquiring fences", () => {
      service.acquireFence("exec-1", "shared");
      service.acquireFence("exec-2", "shared");
      service.acquireFence("exec-3", "shared");

      assert.strictEqual(service.getActiveFenceCount(), 3);
    });

    it("should decrement after releasing fences", () => {
      service.acquireFence("exec-1", "shared");
      service.acquireFence("exec-2", "shared");

      service.releaseFence("exec-1");
      assert.strictEqual(service.getActiveFenceCount(), 1);
    });
  });

  describe("type exports", () => {
    it("should export FenceMode type correctly", () => {
      // FenceMode should be "shared" | "exclusive"
      const mode: FenceMode = "shared";
      assert.strictEqual(mode, "shared");
    });

    it("should export FenceInfo interface structure", () => {
      const fenceInfo: FenceInfo = {
        executionId: "exec-123",
        mode: "exclusive",
        fenceToken: "token-abc",
        ownerNodeId: "node-1",
        acquiredAt: new Date(),
        expiresAt: null,
      };

      assert.strictEqual(fenceInfo.executionId, "exec-123");
      assert.strictEqual(fenceInfo.mode, "exclusive");
      assert.strictEqual(fenceInfo.ownerNodeId, "node-1");
    });

    it("should export FencingTokenValidation interface structure", () => {
      const validation: FencingTokenValidation = {
        valid: true,
        executionId: "exec-123",
        owner: "node-1",
      };

      assert.strictEqual(validation.valid, true);
      assert.strictEqual(validation.executionId, "exec-123");
    });

    it("should export FencingTokenValidation with error structure", () => {
      const validation: FencingTokenValidation = {
        valid: false,
        reason: "Token not owned by expected owner",
      };

      assert.strictEqual(validation.valid, false);
      assert.strictEqual(validation.reason, "Token not owned by expected owner");
    });
  });
});