import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type {
  StableReleasePackageProfileSummary,
} from "../../../../src/platform/stability/stable-release-package.js";

describe("stable-release-package", () => {
  // NOTE: buildNextActions, buildRecommendedCommands, summarizeCriteria are internal
  // functions in stable-release-package.ts and are not exported. These tests are
  // skipped until the source file is updated to export them.
  //
  // Similarly, StableReleaseGateReport, StableGateCriterion, and StableGateTargetStatus
  // are imported from stable-release-gate.ts but not re-exported from stable-release-package.ts.

  describe.skip("summarizeCriteria", () => {
    test("returns pass when all criteria pass", () => {
      // Internal function - cannot test without src changes
    });

    test("returns partial when some criteria are partial", () => {
      // Internal function - cannot test without src changes
    });

    test("returns fail when any criterion fails", () => {
      // Internal function - cannot test without src changes
    });

    test("deduplicates evidence refs", () => {
      // Internal function - cannot test without src changes
    });

    test("formats detail with criterion statuses", () => {
      // Internal function - cannot test without src changes
    });
  });

  describe.skip("buildNextActions", () => {
    // buildNextActions is not exported from stable-release-package.ts
    // Tests would require src changes to export the function

    test("suggests smoke generation when smoke not present", () => {
      // Internal function - cannot test without src changes
    });

    test("suggests repair when smoke present but failing", () => {
      // Internal function - cannot test without src changes
    });

    test("returns no smoke-specific action when smoke passes", () => {
      // Internal function - cannot test without src changes
    });

    test("suggests promotion when gate is approved", () => {
      // Internal function - cannot test without src changes
    });

    test("suggests not promoting when blocked", () => {
      // Internal function - cannot test without src changes
    });

    test("includes criteria-specific actions for failing criteria", () => {
      // Internal function - cannot test without src changes
    });

    test("deduplicates actions", () => {
      // Internal function - cannot test without src changes
    });
  });

  describe.skip("buildRecommendedCommands", () => {
    // buildRecommendedCommands is not exported from stable-release-package.ts
    // Tests would require src changes to export the function

    test("returns array of command strings for canary", () => {
      // Internal function - cannot test without src changes
    });

    test("returns array of command strings for tenant_gray", () => {
      // Internal function - cannot test without src changes
    });

    test("returns array of command strings for production_ready", () => {
      // Internal function - cannot test without src changes
    });

    test("includes npm run commands", () => {
      // Internal function - cannot test without src changes
    });

    test("includes gate command with correct target status", () => {
      // Internal function - cannot test without src changes
    });
  });

  test.skip("createStableReleasePackage requires filesystem access", () => {
    // Requires reading evidence bundle JSON files and writing outputs
  });
});
