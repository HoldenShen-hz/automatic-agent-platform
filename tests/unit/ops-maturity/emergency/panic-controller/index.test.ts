/**
 * Unit tests for PanicController
 *
 * @see src/ops-maturity/emergency/panic-controller/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  shouldEnterPanicMode,
  type PanicDirectiveInput,
} from "../../../../../src/ops-maturity/emergency/panic-controller/index.js";

test.describe("PanicController", () => {
  test.describe("shouldEnterPanicMode", () => {
    test("returns true when activeIncidents is greater than zero", () => {
      const input: PanicDirectiveInput = {
        scope: "platform",
        reasonCode: "capacity.issue",
        activeIncidents: 1,
      };

      const result = shouldEnterPanicMode(input);

      assert.equal(result, true);
    });

    test("returns true when activeIncidents is greater than zero (multiple incidents)", () => {
      const input: PanicDirectiveInput = {
        scope: "platform",
        reasonCode: "capacity.issue",
        activeIncidents: 5,
      };

      const result = shouldEnterPanicMode(input);

      assert.equal(result, true);
    });

    test("returns true when reasonCode starts with security.", () => {
      const input: PanicDirectiveInput = {
        scope: "platform",
        reasonCode: "security.incident",
        activeIncidents: 0,
      };

      const result = shouldEnterPanicMode(input);

      assert.equal(result, true);
    });

    test("returns true for nested security reason codes", () => {
      const input: PanicDirectiveInput = {
        scope: "platform",
        reasonCode: "security.auth.bypass",
        activeIncidents: 0,
      };

      const result = shouldEnterPanicMode(input);

      assert.equal(result, true);
    });

    test("returns false when no incidents and non-security reason code", () => {
      const input: PanicDirectiveInput = {
        scope: "platform",
        reasonCode: "capacity.issue",
        activeIncidents: 0,
      };

      const result = shouldEnterPanicMode(input);

      assert.equal(result, false);
    });

    test("returns false when reasonCode does not start with security.", () => {
      const input: PanicDirectiveInput = {
        scope: "platform",
        reasonCode: "deploy.failed",
        activeIncidents: 0,
      };

      const result = shouldEnterPanicMode(input);

      assert.equal(result, false);
    });

    test("handles empty reason code with zero incidents", () => {
      const input: PanicDirectiveInput = {
        scope: "platform",
        reasonCode: "",
        activeIncidents: 0,
      };

      const result = shouldEnterPanicMode(input);

      assert.equal(result, false);
    });

    test("handles reason code with special characters", () => {
      const input: PanicDirectiveInput = {
        scope: "platform",
        reasonCode: "security.audit.2026",
        activeIncidents: 0,
      };

      const result = shouldEnterPanicMode(input);

      assert.equal(result, true);
    });
  });
});