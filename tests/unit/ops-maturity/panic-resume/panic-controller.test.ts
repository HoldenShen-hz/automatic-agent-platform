import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  shouldEnterPanicMode,
  type PanicDirectiveInput,
} from "../../../../src/ops-maturity/emergency/panic-controller/index.js";

describe("panic-controller", () => {
  describe("shouldEnterPanicMode", () => {
    it("should return true when activeIncidents is greater than 0", () => {
      const input: PanicDirectiveInput = {
        scope: "platform/us-east-1",
        reasonCode: "capacity.exceeded",
        activeIncidents: 1,
      };

      const result = shouldEnterPanicMode(input);

      assert.strictEqual(result, true);
    });

    it("should return true when activeIncidents is multiple", () => {
      const input: PanicDirectiveInput = {
        scope: "region/eu-west-1",
        reasonCode: "network.partition",
        activeIncidents: 5,
      };

      const result = shouldEnterPanicMode(input);

      assert.strictEqual(result, true);
    });

    it("should return true when reasonCode starts with security.", () => {
      const input: PanicDirectiveInput = {
        scope: "tenant/prod-tenant",
        reasonCode: "security.intrusion_detected",
        activeIncidents: 0,
      };

      const result = shouldEnterPanicMode(input);

      assert.strictEqual(result, true);
    });

    it("should return true when reasonCode is exactly security.", () => {
      const input: PanicDirectiveInput = {
        scope: "domain/payment",
        reasonCode: "security.",
      };

      const result = shouldEnterPanicMode(input);

      assert.strictEqual(result, true);
    });

    it("should return true when both conditions met", () => {
      const input: PanicDirectiveInput = {
        scope: "run/execution-123",
        reasonCode: "security.breach",
        activeIncidents: 3,
      };

      const result = shouldEnterPanicMode(input);

      assert.strictEqual(result, true);
    });

    it("should return false when no incidents and non-security reason code", () => {
      const input: PanicDirectiveInput = {
        scope: "node/worker-5",
        reasonCode: "maintenance.scheduled",
        activeIncidents: 0,
      };

      const result = shouldEnterPanicMode(input);

      assert.strictEqual(result, false);
    });

    it("should return false when activeIncidents is undefined", () => {
      const input: PanicDirectiveInput = {
        scope: "platform/global",
        reasonCode: "capacity.warning",
      };

      const result = shouldEnterPanicMode(input);

      assert.strictEqual(result, false);
    });

    it("should return false when activeIncidents is 0 explicitly", () => {
      const input: PanicDirectiveInput = {
        scope: "region/ap-south-1",
        reasonCode: "metric.spike",
        activeIncidents: 0,
      };

      const result = shouldEnterPanicMode(input);

      assert.strictEqual(result, false);
    });

    it("should handle negative activeIncidents as no incidents", () => {
      const input: PanicDirectiveInput = {
        scope: "tenant/test",
        reasonCode: "unknown.issue",
        activeIncidents: -1,
      };

      const result = shouldEnterPanicMode(input);

      assert.strictEqual(result, false);
    });

    it("should return true for various security reason codes", () => {
      const securityCodes = [
        "security.unauthorized_access",
        "security.data_breach",
        "security.dos_attack",
        "security.certificate_expiry",
        "security.key_compromise",
      ];

      for (const reasonCode of securityCodes) {
        const input: PanicDirectiveInput = {
          scope: "platform/global",
          reasonCode,
          activeIncidents: 0,
        };

        const result = shouldEnterPanicMode(input);
        assert.strictEqual(result, true, `Failed for reasonCode: ${reasonCode}`);
      }
    });

    it("should return false for non-security reason codes", () => {
      const nonSecurityCodes = [
        "capacity.exceeded",
        "network.latency",
        "database.connection_pool_exhausted",
        "deployment.failed",
        "metric.anomaly_detected",
      ];

      for (const reasonCode of nonSecurityCodes) {
        const input: PanicDirectiveInput = {
          scope: "platform/global",
          reasonCode,
          activeIncidents: 0,
        };

        const result = shouldEnterPanicMode(input);
        assert.strictEqual(result, false, `Failed for reasonCode: ${reasonCode}`);
      }
    });

    it("should handle empty scope string", () => {
      const input: PanicDirectiveInput = {
        scope: "",
        reasonCode: "security.alert",
        activeIncidents: 0,
      };

      const result = shouldEnterPanicMode(input);

      assert.strictEqual(result, true);
    });

    it("should handle scope with special characters", () => {
      const input: PanicDirectiveInput = {
        scope: "platform/us-east-1@cluster-3",
        reasonCode: "security.vulnerability",
        activeIncidents: 1,
      };

      const result = shouldEnterPanicMode(input);

      assert.strictEqual(result, true);
    });
  });
});