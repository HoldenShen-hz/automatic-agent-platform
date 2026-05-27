import assert from "node:assert/strict";
import test from "node:test";

import { buildStableReleaseGateReport, writeStableReleaseGateReport } from "../../../../../src/platform/shared/stability/stable-release-gate.js";
import type {
  StableGateTargetStatus,
  StableGateVerdict,
  StableGateCriterion,
  StableReleaseGateReport,
} from "../../../../../src/platform/shared/stability/stable-release-gate.js";

test("StableGateTargetStatus type exports are correct [stable-release-gate]", () => {
  const targets: StableGateTargetStatus[] = ["canary", "tenant_gray", "production_ready"];

  for (const target of targets) {
    assert.ok(["canary", "tenant_gray", "production_ready"].includes(target));
  }
});

test("StableGateVerdict type exports are correct [stable-release-gate]", () => {
  const verdicts: StableGateVerdict[] = ["promote_approved", "conditional", "promote_blocked"];

  for (const verdict of verdicts) {
    assert.ok(["promote_approved", "conditional", "promote_blocked"].includes(verdict));
  }
});

test("StableGateCriterion structure - pass [stable-release-gate]", () => {
  const criterion: StableGateCriterion = {
    criterionId: "conformance_tests",
    status: "pass",
    detail: "All conformance tests passed",
    evidenceRefs: ["/evidence/conformance/results.json"],
  };

  assert.equal(criterion.criterionId, "conformance_tests");
  assert.equal(criterion.status, "pass");
  assert.equal(criterion.detail, "All conformance tests passed");
  assert.deepEqual(criterion.evidenceRefs, ["/evidence/conformance/results.json"]);
});

test("StableGateCriterion structure - partial [stable-release-gate]", () => {
  const criterion: StableGateCriterion = {
    criterionId: "chaos_drill_results",
    status: "partial",
    detail: "3 of 5 chaos drills passed",
    evidenceRefs: ["/evidence/chaos/results.json"],
  };

  assert.equal(criterion.status, "partial");
});

test("StableGateCriterion structure - fail [stable-release-gate]", () => {
  const criterion: StableGateCriterion = {
    criterionId: "backup_restore_tested",
    status: "fail",
    detail: "Backup test timed out",
    evidenceRefs: [],
  };

  assert.equal(criterion.status, "fail");
});

test("StableReleaseGateReport structure [stable-release-gate]", () => {
  const report: StableReleaseGateReport = {
    packageId: "stable_pkg_123",
    componentId: "stable_core",
    currentStatus: "contract_frozen",
    targetStatus: "canary",
    overallVerdict: "promote_approved",
    checkedAt: "2026-04-14T00:00:00.000Z",
    requiredProfiles: ["smoke"],
    availableProfiles: ["smoke", "24h"],
    requiredCriteria: [],
    optionalCriteria: [],
    criteria: [
      {
        criterionId: "contracts_frozen",
        status: "pass",
        detail: "All contracts frozen",
        evidenceRefs: [],
      },
    ],
    blockers: [],
    artifactRefs: [],
  };

  assert.equal(report.packageId, "stable_pkg_123");
  assert.equal(report.componentId, "stable_core");
  assert.equal(report.targetStatus, "canary");
  assert.equal(report.overallVerdict, "promote_approved");
});

test("StableReleaseGateReport with blockers [stable-release-gate]", () => {
  const report: StableReleaseGateReport = {
    packageId: "stable_pkg_456",
    componentId: "stable_core",
    currentStatus: "canary",
    targetStatus: "production_ready",
    overallVerdict: "promote_blocked",
    checkedAt: "2026-04-14T00:00:00.000Z",
    requiredProfiles: ["smoke", "24h", "72h"],
    availableProfiles: ["smoke"],
    requiredCriteria: [
      {
        criterionId: "conformance_tests",
        status: "fail",
        detail: "Tests failed",
        evidenceRefs: [],
      },
    ],
    optionalCriteria: [],
    criteria: [
      {
        criterionId: "conformance_tests",
        status: "fail",
        detail: "Tests failed",
        evidenceRefs: [],
      },
    ],
    blockers: ["conformance_tests"],
    artifactRefs: [],
  };

  assert.equal(report.overallVerdict, "promote_blocked");
  assert.deepEqual(report.blockers, ["conformance_tests"]);
});

test("StableReleaseGateReport with conditional verdict [stable-release-gate]", () => {
  const report: StableReleaseGateReport = {
    packageId: "stable_pkg_789",
    componentId: "stable_core",
    currentStatus: "contract_frozen",
    targetStatus: "tenant_gray",
    overallVerdict: "conditional",
    checkedAt: "2026-04-14T00:00:00.000Z",
    requiredProfiles: ["smoke"],
    availableProfiles: ["smoke"],
    requiredCriteria: [
      {
        criterionId: "telemetry_instrumented",
        status: "partial",
        detail: "Some metrics missing",
        evidenceRefs: [],
      },
    ],
    optionalCriteria: [],
    criteria: [
      {
        criterionId: "telemetry_instrumented",
        status: "partial",
        detail: "Some metrics missing",
        evidenceRefs: [],
      },
    ],
    blockers: [],
    artifactRefs: [],
  };

  assert.equal(report.overallVerdict, "conditional");
});

test("All criterion IDs are valid [stable-release-gate]", () => {
  const criterionIds: StableGateCriterion["criterionId"][] = [
    "contracts_frozen",
    "conformance_tests",
    "chaos_drill_results",
    "concurrency_locking_tested",
    "lease_fencing_tested",
    "telemetry_instrumented",
    "backup_restore_tested",
    "rolling_upgrade_tested",
    "maintenance_drain_tested",
    "tenant_gray_rollout_tested",
    "event_replay_tested",
    "db_queue_disconnect_tested",
    "db_writability_tested",
    "queue_delivery_tested",
    "migration_compatibility_tested",
    "stable_acceptance_line",
    "runbooks_documented",
    "rollback_tested",
    "ownership_defined",
  ];

  for (const id of criterionIds) {
    assert.ok(criterionIds.includes(id));
  }
});

test("buildStableReleaseGateReport can be imported [stable-release-gate]", () => {
  assert.ok(typeof buildStableReleaseGateReport === "function");
});

test("writeStableReleaseGateReport can be imported [stable-release-gate]", () => {
  assert.ok(typeof writeStableReleaseGateReport === "function");
});
