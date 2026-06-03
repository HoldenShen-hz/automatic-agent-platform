/**
 * Unit tests for Stable Release Package Module - additional coverage.
 *
 * Tests the release package assembly:
 * - Next action building
 * - Recommended commands generation
 * - Checklist item summarization
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  buildNextActions,
  buildRecommendedCommands,
  summarizeCriteria,
} from "../../../../../src/platform/shared/stability/stable-release-package.js";
import type { StableGateCriterion, StableReleaseGateReport } from "../../../../../src/platform/stability/stable-release-gate.js";

function createCriterion(
  criterionId: StableGateCriterion["criterionId"],
  status: StableGateCriterion["status"],
  evidenceRefs: string[] = [],
): StableGateCriterion {
  return {
    criterionId,
    status,
    detail: `${criterionId}:${status}`,
    evidenceRefs,
  };
}

function createMinimalGateReport(): StableReleaseGateReport {
  return {
    packageId: "test-gate",
    componentId: "stable_core",
    currentStatus: "contract_frozen",
    targetStatus: "canary",
    overallVerdict: "promote_blocked",
    checkedAt: new Date().toISOString(),
    requiredProfiles: ["smoke"],
    availableProfiles: [],
    requiredCriteria: [],
    optionalCriteria: [],
    criteria: [],
    blockers: ["missing evidence profiles: smoke"],
    artifactRefs: [],
  };
}

test("buildNextActions returns action for missing smoke profile [stable-release-package-additional]", () => {
  const gate = createMinimalGateReport();
  const profiles: Parameters<typeof buildNextActions>[1] = [];

  const actions = buildNextActions(gate, profiles);

  assert.ok(actions.some((a) => a.includes("Generate smoke evidence")));
});

test("buildNextActions returns action for failing smoke profile [stable-release-package-additional]", () => {
  const gate = createMinimalGateReport();
  const profiles: Parameters<typeof buildNextActions>[1] = [
    {
      profile: "smoke",
      reportPath: "/tmp/smoke/report.json",
      present: true,
      passed: false,
      chaosPassed: null,
      leasePassed: null,
      rollbackPassed: null,
      rollingUpgradePassed: null,
      maintenancePassed: null,
      grayReleasePassed: null,
      dbQueueDisconnectPassed: null,
      dbWritabilityPassed: null,
      queueDeliveryPassed: null,
      migrationCompatibilityPassed: null,
      backupRestorePlaybookPath: null,
      rollingUpgradePlaybookPath: null,
      maintenancePlaybookPath: null,
      grayReleasePlaybookPath: null,
      doctorStatus: null,
      acceptanceLineStatus: null,
      acceptanceReportPath: null,
      acceptanceObservedSoakDurationMs: null,
    },
  ];

  const actions = buildNextActions(gate, profiles);

  assert.ok(actions.some((a) => a.includes("smoke evidence bundle") && a.includes("failing")));
});

test("buildNextActions includes promote action when gate is approved [stable-release-package-additional]", () => {
  const gate: StableReleaseGateReport = {
    ...createMinimalGateReport(),
    overallVerdict: "promote_approved",
    blockers: [],
  };
  const profiles: Parameters<typeof buildNextActions>[1] = [];

  const actions = buildNextActions(gate, profiles);

  assert.ok(actions.some((a) => a.includes("Proceed with the") && a.includes("rollout")));
});

test("buildNextActions includes conditional action for conditional verdict [stable-release-package-additional]", () => {
  const gate: StableReleaseGateReport = {
    ...createMinimalGateReport(),
    overallVerdict: "conditional",
    blockers: [],
  };
  const profiles: Parameters<typeof buildNextActions>[1] = [];

  const actions = buildNextActions(gate, profiles);

  assert.ok(actions.some((a) => a.includes("Keep the component at")));
});

test("buildNextActions includes blocked action when gate is blocked [stable-release-package-additional]", () => {
  const gate: StableReleaseGateReport = {
    ...createMinimalGateReport(),
    overallVerdict: "promote_blocked",
    blockers: ["missing evidence profiles: smoke", "missing evidence profiles: 24h"],
  };
  const profiles: Parameters<typeof buildNextActions>[1] = [];

  const actions = buildNextActions(gate, profiles);

  assert.ok(actions.some((a) => a.includes("Do not promote")));
});

test("buildRecommendedCommands returns array of commands [stable-release-package-additional]", () => {
  const commands = buildRecommendedCommands("canary");

  assert.ok(Array.isArray(commands));
  assert.ok(commands.length > 0);
  assert.ok(commands.some((c) => c.includes("npm run")));
});

test("buildRecommendedCommands includes profile-specific commands [stable-release-package-additional]", () => {
  const commands = buildRecommendedCommands("production_ready");

  assert.ok(commands.some((c) => c.includes("24h")));
  assert.ok(commands.some((c) => c.includes("72h")));
  assert.ok(commands.some((c) => c.includes("production_ready")));
});

test("summarizeCriteria returns pass when all criteria pass [stable-release-package-additional]", () => {
  const criteria = [
    createCriterion("contracts_frozen", "pass"),
    createCriterion("conformance_tests", "pass"),
  ];

  const result = summarizeCriteria(criteria);

  assert.equal(result.status, "pass");
});

test("summarizeCriteria returns partial when any criterion is partial [stable-release-package-additional]", () => {
  const criteria = [
    createCriterion("contracts_frozen", "pass"),
    createCriterion("conformance_tests", "partial"),
  ];

  const result = summarizeCriteria(criteria);

  assert.equal(result.status, "partial");
});

test("summarizeCriteria returns fail when any criterion fails [stable-release-package-additional]", () => {
  const criteria = [
    createCriterion("contracts_frozen", "pass"),
    createCriterion("conformance_tests", "fail"),
  ];

  const result = summarizeCriteria(criteria);

  assert.equal(result.status, "fail");
});

test("summarizeCriteria dedupes evidence refs [stable-release-package-additional]", () => {
  const criteria = [
    createCriterion("contracts_frozen", "pass", ["/evidence/1.json"]),
    createCriterion("conformance_tests", "pass", ["/evidence/1.json", "/evidence/2.json"]),
  ];

  const result = summarizeCriteria(criteria);

  assert.equal(result.evidenceRefs.length, 2);
});
