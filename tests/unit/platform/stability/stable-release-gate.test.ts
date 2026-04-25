import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveRequiredProfiles,
  resolveRequiredCriterionIds,
  deriveCurrentStatus,
  type StableGateTargetStatus,
  type StableGateVerdict,
  type StableGateCriterion,
  type StableEvidenceBundleReport,
} from "../../../../src/platform/stability/stable-release-gate.js";

describe("stable-release-gate", () => {
  describe("resolveRequiredProfiles", () => {
    test("returns smoke for canary target", () => {
      const profiles = resolveRequiredProfiles("canary");
      assert.deepEqual(profiles, ["smoke"]);
    });

    test("returns smoke for tenant_gray target", () => {
      const profiles = resolveRequiredProfiles("tenant_gray");
      assert.deepEqual(profiles, ["smoke"]);
    });

    test("returns smoke, 24h, 72h for production_ready target", () => {
      const profiles = resolveRequiredProfiles("production_ready");
      assert.deepEqual(profiles, ["smoke", "24h", "72h"]);
    });
  });

  describe("resolveRequiredCriterionIds", () => {
    test("canary has base criteria only", () => {
      const ids = resolveRequiredCriterionIds("canary");
      assert.ok(ids.has("contracts_frozen"));
      assert.ok(ids.has("conformance_tests"));
      assert.ok(ids.has("telemetry_instrumented"));
      assert.ok(ids.has("migration_compatibility_tested"));
      assert.ok(ids.has("runbooks_documented"));
      assert.ok(ids.has("rollback_tested"));
      assert.ok(ids.has("ownership_defined"));
      assert.ok(!ids.has("tenant_gray_rollout_tested"));
      assert.ok(!ids.has("stable_acceptance_line"));
      assert.ok(!ids.has("db_queue_disconnect_tested"));
    });

    test("tenant_gray adds tenant_gray_rollout_tested", () => {
      const ids = resolveRequiredCriterionIds("tenant_gray");
      assert.ok(ids.has("tenant_gray_rollout_tested"));
      assert.ok(!ids.has("stable_acceptance_line"));
    });

    test("production_ready adds acceptance line and db tests", () => {
      const ids = resolveRequiredCriterionIds("production_ready");
      assert.ok(ids.has("stable_acceptance_line"));
      assert.ok(ids.has("db_queue_disconnect_tested"));
      assert.ok(ids.has("db_writability_tested"));
      assert.ok(ids.has("queue_delivery_tested"));
      assert.ok(ids.has("tenant_gray_rollout_tested"));
    });
  });

  describe("deriveCurrentStatus", () => {
    test("returns contract_frozen when blocked", () => {
      const status = deriveCurrentStatus({
        overallVerdict: "promote_blocked",
        targetStatus: "production_ready",
        smokeReport: {} as StableEvidenceBundleReport,
        grayCriterion: undefined,
      });
      assert.equal(status, "contract_frozen");
    });

    test("returns contract_frozen when no smoke report", () => {
      const status = deriveCurrentStatus({
        overallVerdict: "promote_approved",
        targetStatus: "canary",
        smokeReport: null,
        grayCriterion: undefined,
      });
      assert.equal(status, "contract_frozen");
    });

    test("returns target status when approved", () => {
      const status = deriveCurrentStatus({
        overallVerdict: "promote_approved",
        targetStatus: "tenant_gray",
        smokeReport: {} as StableEvidenceBundleReport,
        grayCriterion: undefined,
      });
      assert.equal(status, "tenant_gray");
    });

    test("returns tenant_gray when production_ready but gray criterion passes", () => {
      const grayCriterion = { status: "pass" } as StableGateCriterion;
      const status = deriveCurrentStatus({
        overallVerdict: "conditional",
        targetStatus: "production_ready",
        smokeReport: {} as StableEvidenceBundleReport,
        grayCriterion,
      });
      assert.equal(status, "tenant_gray");
    });

    test("returns canary for conditional with no gray pass", () => {
      const grayCriterion = { status: "partial" } as StableGateCriterion;
      const status = deriveCurrentStatus({
        overallVerdict: "conditional",
        targetStatus: "production_ready",
        smokeReport: {} as StableEvidenceBundleReport,
        grayCriterion,
      });
      assert.equal(status, "canary");
    });

    test("returns canary for conditional canary target", () => {
      const status = deriveCurrentStatus({
        overallVerdict: "conditional",
        targetStatus: "canary",
        smokeReport: {} as StableEvidenceBundleReport,
        grayCriterion: undefined,
      });
      assert.equal(status, "canary");
    });
  });

  test.skip("buildStableReleaseGateReport requires filesystem access", () => {
    // Requires reading stable-evidence-report.json files from evidence root directory
    // Cannot be unit tested without mocking fs operations
  });

  test.skip("writeStableReleaseGateReport requires filesystem access", () => {
    // Writes JSON report to filesystem
  });
});
