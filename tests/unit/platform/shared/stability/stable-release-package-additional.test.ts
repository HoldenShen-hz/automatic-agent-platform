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
  type StableReleaseGateReport,
} from "../../../../../src/platform/shared/stability/stable-release-package.js";

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

test("buildNextActions returns action for missing smoke profile", () => {
  const gate = createMinimalGateReport();
  const profiles: Parameters<typeof buildNextActions>[1] = [];

  const actions = buildNextActions(gate, profiles);

  assert.ok(actions.some((a) => a.includes("Generate smoke evidence")));
});

test("buildNextActions returns action for failing smoke profile", () => {
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

test("buildNextActions includes promote action when gate is approved", () => {
  const gate: StableReleaseGateReport = {
    ...createMinimalGateReport(),
    overallVerdict: "promote_approved",
    blockers: [],
  };
  const profiles: Parameters<typeof buildNextActions>[1] = [];

  const actions = buildNextActions(gate, profiles);

  assert.ok(actions.some((a) => a.includes("Proceed with the") && a.includes("rollout")));
});

test("buildNextActions includes conditional action for conditional verdict", () => {
  const gate: StableReleaseGateReport = {
    ...createMinimalGateReport(),
    overallVerdict: "conditional",
    blockers: [],
  };
  const profiles: Parameters<typeof buildNextActions>[1] = [];

  const actions = buildNextActions(gate, profiles);

  assert.ok(actions.some((a) => a.includes("Keep the component at")));
});

test("buildNextActions includes blocked action when gate is blocked", () => {
  const gate: StableReleaseGateReport = {
    ...createMinimalGateReport(),
    overallVerdict: "promote_blocked",
    blockers: ["missing evidence profiles: smoke", "missing evidence profiles: 24h"],
  };
  const profiles: Parameters<typeof buildNextActions>[1] = [];

  const actions = buildNextActions(gate, profiles);

  assert.ok(actions.some((a) => a.includes("Do not promote")));
});

test("buildRecommendedCommands returns array of commands", () => {
  const commands = buildRecommendedCommands("canary");

  assert.ok(Array.isArray(commands));
  assert.ok(commands.length > 0);
  assert.ok(commands.some((c) => c.includes("npm run")));
});

test("buildRecommendedCommands includes profile-specific commands", () => {
  const commands = buildRecommendedCommands("production_ready");

  assert.ok(commands.some((c) => c.includes("24h")));
  assert.ok(commands.some((c) => c.includes("72h")));
  assert.ok(commands.some((c) => c.includes("production_ready")));
});

test("summarizeCriteria returns pass when all criteria pass", () => {
  const criteria = [
    { criterionId: "test1", status: "pass" as const, detail: "test1 pass", evidenceRefs: [] },
    { criterionId: "test2", status: "pass" as const, detail: "test2 pass", evidenceRefs: [] },
  ];

  const result = summarizeCriteria(criteria);

  assert.equal(result.status, "pass");
});

test("summarizeCriteria returns partial when any criterion is partial", () => {
  const criteria = [
    { criterionId: "test1", status: "pass" as const, detail: "test1 pass", evidenceRefs: [] },
    { criterionId: "test2", status: "partial" as const, detail: "test2 partial", evidenceRefs: [] },
  ];

  const result = summarizeCriteria(criteria);

  assert.equal(result.status, "partial");
});

test("summarizeCriteria returns fail when any criterion fails", () => {
  const criteria = [
    { criterionId: "test1", status: "pass" as const, detail: "test1 pass", evidenceRefs: [] },
    { criterionId: "test2", status: "fail" as const, detail: "test2 fail", evidenceRefs: [] },
  ];

  const result = summarizeCriteria(criteria);

  assert.equal(result.status, "fail");
});

test("summarizeCriteria dedupes evidence refs", () => {
  const criteria = [
    { criterionId: "test1", status: "pass" as const, detail: "test1 pass", evidenceRefs: ["/evidence/1.json"] },
    { criterionId: "test2", status: "pass" as const, detail: "test2 pass", evidenceRefs: ["/evidence/1.json", "/evidence/2.json"] },
  ];

  const result = summarizeCriteria(criteria);

  assert.equal(result.evidenceRefs.length, 2);
});
