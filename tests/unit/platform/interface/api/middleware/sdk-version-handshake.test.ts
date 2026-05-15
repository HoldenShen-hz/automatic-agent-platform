import { describe, it } from "node:test";
import assert, { strictEqual, deepStrictEqual, ok, fail } from "node:assert";
import {
  SdkVersionHandshakeService,
  type SdkVersionHandshakePolicy,
  type SdkVersionHandshakeRequest,
  type SdkVersionHandshakeDecision,
} from "../../../../../../src/platform/five-plane-interface/api/middleware/sdk-version-handshake.js";

describe("SdkVersionHandshakeService", () => {
  describe("evaluate", () => {
    const createPolicy = (overrides: Partial<SdkVersionHandshakePolicy> = {}): SdkVersionHandshakePolicy => ({
      platformVersion: "2026-04-01",
      contractVersion: "1.0.0",
      minimumSdkVersion: "1.0.0",
      ...overrides,
    });

    it("should accept request with matching SDK version", () => {
      const service = new SdkVersionHandshakeService(createPolicy());
      const request: SdkVersionHandshakeRequest = {
        headers: {
          "x-sdk-version": "1.5.0",
        },
      };

      const decision = service.evaluate(request);
      strictEqual(decision.accepted, true);
      strictEqual(decision.statusCode, 200);
      strictEqual(decision.reasonCode, "sdk.accepted");
    });

    it("should accept request with minimum SDK version", () => {
      const service = new SdkVersionHandshakeService(createPolicy());
      const request: SdkVersionHandshakeRequest = {
        headers: {
          "x-sdk-version": "1.0.0",
        },
      };

      const decision = service.evaluate(request);
      strictEqual(decision.accepted, true);
    });

    it("should require upgrade when SDK version below minimum", () => {
      const service = new SdkVersionHandshakeService(createPolicy());
      const request: SdkVersionHandshakeRequest = {
        headers: {
          "x-sdk-version": "0.5.0",
        },
      };

      const decision = service.evaluate(request);
      strictEqual(decision.accepted, false);
      strictEqual(decision.statusCode, 426);
      strictEqual(decision.reasonCode, "sdk.upgrade_required");
    });

    it("should require upgrade when SDK version missing", () => {
      const service = new SdkVersionHandshakeService(createPolicy());
      const request: SdkVersionHandshakeRequest = {
        headers: {},
      };

      const decision = service.evaluate(request);
      strictEqual(decision.accepted, false);
      strictEqual(decision.reasonCode, "sdk.upgrade_required");
    });

    it("should reject when platform min version exceeds platform version", () => {
      const service = new SdkVersionHandshakeService(
        createPolicy({ platformVersion: "2026-04-01" }),
      );
      const request: SdkVersionHandshakeRequest = {
        headers: {
          "x-sdk-version": "1.5.0",
          "x-platform-min-version": "2027-01-01",
        },
      };

      const decision = service.evaluate(request);
      strictEqual(decision.accepted, false);
      strictEqual(decision.reasonCode, "sdk.platform_incompatible");
    });

    it("should include warnings when contract version mismatched", () => {
      const service = new SdkVersionHandshakeService(
        createPolicy({ contractVersion: "1.0.0" }),
      );
      const request: SdkVersionHandshakeRequest = {
        headers: {
          "x-sdk-version": "1.5.0",
          "x-contract-version": "0.9.0",
        },
      };

      const decision = service.evaluate(request);
      strictEqual(decision.accepted, true);
      ok(decision.warnings.length > 0);
      ok(decision.warnings.some((w) => w.includes("contract=")));
    });

    it("should include warning when SDK below recommended version", () => {
      const service = new SdkVersionHandshakeService(
        createPolicy({ minimumSdkVersion: "1.0.0", recommendedSdkVersion: "2.0.0" }),
      );
      const request: SdkVersionHandshakeRequest = {
        headers: {
          "x-sdk-version": "1.5.0",
        },
      };

      const decision = service.evaluate(request);
      strictEqual(decision.accepted, true);
      ok(decision.warnings.some((w) => w.includes("recommended=")));
    });

    it("should include response headers with version info", () => {
      const service = new SdkVersionHandshakeService(createPolicy());
      const request: SdkVersionHandshakeRequest = {
        headers: {
          "x-sdk-version": "1.5.0",
        },
      };

      const decision = service.evaluate(request);
      strictEqual(decision.responseHeaders["X-Platform-Version"], "2026-04-01");
      strictEqual(decision.responseHeaders["X-Contract-Version"], "1.0.0");
    });

    it("should return upgrade_required headers when upgrade needed", () => {
      const service = new SdkVersionHandshakeService(createPolicy());
      const request: SdkVersionHandshakeRequest = {
        headers: {
          "x-sdk-version": "0.5.0",
        },
      };

      const decision = service.evaluate(request);
      strictEqual(decision.responseHeaders["X-SDK-Compatibility"], "upgrade_required");
    });

    it("should return compatibility_warning headers when warnings present", () => {
      const service = new SdkVersionHandshakeService(
        createPolicy({ contractVersion: "1.0.0", recommendedSdkVersion: "2.0.0" }),
      );
      const request: SdkVersionHandshakeRequest = {
        headers: {
          "x-sdk-version": "1.5.0",
          "x-contract-version": "0.9.0",
        },
      };

      const decision = service.evaluate(request);
      strictEqual(decision.responseHeaders["X-SDK-Compatibility"], "compatibility_warning");
    });
  });

  describe("semver comparison", () => {
    const createPolicy = (): SdkVersionHandshakePolicy => ({
      platformVersion: "2026-04-01",
      contractVersion: "1.0.0",
      minimumSdkVersion: "1.0.0",
    });

    it("should handle major version comparison", () => {
      const service = new SdkVersionHandshakeService(createPolicy());
      const request: SdkVersionHandshakeRequest = {
        headers: {
          "x-sdk-version": "2.0.0",
        },
      };

      const decision = service.evaluate(request);
      strictEqual(decision.accepted, true);
    });

    it("should handle minor version comparison", () => {
      const service = new SdkVersionHandshakeService(
        createPolicy({ minimumSdkVersion: "1.2.0" }),
      );
      const request: SdkVersionHandshakeRequest = {
        headers: {
          "x-sdk-version": "1.3.0",
        },
      };

      const decision = service.evaluate(request);
      strictEqual(decision.accepted, true);
    });

    it("should handle patch version comparison", () => {
      const service = new SdkVersionHandshakeService(
        createPolicy({ minimumSdkVersion: "1.0.0" }),
      );
      const request: SdkVersionHandshakeRequest = {
        headers: {
          "x-sdk-version": "1.0.1",
        },
      };

      const decision = service.evaluate(request);
      strictEqual(decision.accepted, true);
    });

    it("should handle missing version parts", () => {
      const service = new SdkVersionHandshakeService(createPolicy());
      const request: SdkVersionHandshakeRequest = {
        headers: {
          "x-sdk-version": "1",
        },
      };

      const decision = service.evaluate(request);
      strictEqual(decision.accepted, true);
    });
  });

  describe("header extraction", () => {
    it("should handle case-insensitive header names", () => {
      const service = new SdkVersionHandshakeService({
        platformVersion: "2026-04-01",
        contractVersion: "1.0.0",
        minimumSdkVersion: "1.0.0",
      });
      const request: SdkVersionHandshakeRequest = {
        headers: {
          "X-Sdk-Version": "1.5.0",
        },
      };

      const decision = service.evaluate(request);
      strictEqual(decision.accepted, true);
    });

    it("should handle array header values", () => {
      const service = new SdkVersionHandshakeService({
        platformVersion: "2026-04-01",
        contractVersion: "1.0.0",
        minimumSdkVersion: "1.0.0",
      });
      const request: SdkVersionHandshakeRequest = {
        headers: {
          "x-sdk-version": ["1.5.0", "1.4.0"],
        },
      };

      const decision = service.evaluate(request);
      strictEqual(decision.accepted, true);
    });
  });
});
