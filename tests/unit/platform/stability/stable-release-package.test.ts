import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  buildNextActions,
  buildRecommendedCommands,
  summarizeCriteria,
  type StableReleaseGateReport,
  type StableGateCriterion,
  type StableReleasePackageProfileSummary,
  type StableGateTargetStatus,
} from "../../../../src/platform/stability/stable-release-package.js";

describe("stable-release-package", () => {
  describe("summarizeCriteria", () => {
    test("returns pass when all criteria pass", () => {
      const criteria: StableGateCriterion[] = [
        { criterionId: "chaos_drill_results", status: "pass", detail: "ok", evidenceRefs: [] },
        { criterionId: "backup_restore_tested", status: "pass", detail: "ok", evidenceRefs: [] },
      ];
      const result = summarizeCriteria(criteria);
      assert.equal(result.status, "pass");
    });

    test("returns partial when some criteria are partial", () => {
      const criteria: StableGateCriterion[] = [
        { criterionId: "chaos_drill_results", status: "pass", detail: "ok", evidenceRefs: [] },
        { criterionId: "backup_restore_tested", status: "partial", detail: "partial", evidenceRefs: [] },
      ];
      const result = summarizeCriteria(criteria);
      assert.equal(result.status, "partial");
    });

    test("returns fail when any criterion fails", () => {
      const criteria: StableGateCriterion[] = [
        { criterionId: "chaos_drill_results", status: "pass", detail: "ok", evidenceRefs: [] },
        { criterionId: "backup_restore_tested", status: "fail", detail: "failed", evidenceRefs: [] },
      ];
      const result = summarizeCriteria(criteria);
      assert.equal(result.status, "fail");
    });

    test("deduplicates evidence refs", () => {
      const criteria: StableGateCriterion[] = [
        { criterionId: "chaos_drill_results", status: "pass", detail: "ok", evidenceRefs: ["a.json", "b.json"] },
        { criterionId: "backup_restore_tested", status: "pass", detail: "ok", evidenceRefs: ["a.json", "c.json"] },
      ];
      const result = summarizeCriteria(criteria);
      assert.deepEqual(result.evidenceRefs.sort(), ["a.json", "b.json", "c.json"]);
    });

    test("formats detail with criterion statuses", () => {
      const criteria: StableGateCriterion[] = [
        { criterionId: "chaos_drill_results", status: "pass", detail: "ok", evidenceRefs: [] },
        { criterionId: "backup_restore_tested", status: "fail", detail: "failed", evidenceRefs: [] },
      ];
      const result = summarizeCriteria(criteria);
      assert.ok(result.detail.includes("chaos_drill_results:pass"));
      assert.ok(result.detail.includes("backup_restore_tested:fail"));
    });
  });

  describe("buildNextActions", () => {
    const createMockGate = (overrides: Partial<StableReleaseGateReport>): StableReleaseGateReport => ({
      packageId: "test_gate",
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
      blockers: [],
      artifactRefs: [],
      ...overrides,
    });

    const createMockProfile = (overrides: Partial<StableReleasePackageProfileSummary> = {}): StableReleasePackageProfileSummary => ({
      profile: "smoke",
      reportPath: "/evidence/smoke/stable-evidence-report.json",
      present: false,
      passed: null,
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
      ...overrides,
    });

    test("suggests smoke generation when smoke not present", () => {
      const gate = createMockGate();
      const profiles = [createMockProfile()];
      const actions = buildNextActions(gate, profiles);
      assert.ok(actions.some((a) => a.includes("Generate smoke evidence")));
    });

    test("suggests repair when smoke present but failing", () => {
      const gate = createMockGate();
      const profiles = [createMockProfile({ present: true, passed: false })];
      const actions = buildNextActions(gate, profiles);
      assert.ok(actions.some((a) => a.includes("Repair or rerun the smoke evidence bundle")));
    });

    test("returns no smoke-specific action when smoke passes", () => {
      const gate = createMockGate();
      const profiles = [createMockProfile({ present: true, passed: true })];
      const actions = buildNextActions(gate, profiles);
      assert.ok(!actions.some((a) => a.includes("smoke evidence")));
    });

    test("suggests promotion when gate is approved", () => {
      const gate = createMockGate({ overallVerdict: "promote_approved", targetStatus: "canary" });
      const profiles = [createMockProfile({ present: true, passed: true })];
      const actions = buildNextActions(gate, profiles);
      assert.ok(actions.some((a) => a.includes("Proceed with the canary rollout")));
    });

    test("suggests not promoting when blocked", () => {
      const gate = createMockGate({ overallVerdict: "promote_blocked", targetStatus: "production_ready" });
      const profiles = [createMockProfile({ present: true, passed: false })];
      const actions = buildNextActions(gate, profiles);
      assert.ok(actions.some((a) => a.includes("Do not promote")));
    });

    test("includes criteria-specific actions for failing criteria", () => {
      const gate = createMockGate({
        overallVerdict: "promote_blocked",
        targetStatus: "production_ready",
        criteria: [
          {
            criterionId: "backup_restore_tested",
            status: "fail",
            detail: "backup restore failed",
            evidenceRefs: [],
          },
        ],
      });
      const profiles = [createMockProfile({ present: true, passed: true })];
      const actions = buildNextActions(gate, profiles);
      assert.ok(actions.some((a) => a.includes("disaster recovery") || a.includes("rerun")));
    });

    test("deduplicates actions", () => {
      const gate = createMockGate({ overallVerdict: "promote_blocked" });
      const profiles = [createMockProfile({ present: false })];
      const actions = buildNextActions(gate, profiles);
      const uniqueActions = new Set(actions);
      assert.equal(actions.length, uniqueActions.size);
    });
  });

  describe("buildRecommendedCommands", () => {
    test("returns array of command strings for canary", () => {
      const commands = buildRecommendedCommands("canary");
      assert.ok(Array.isArray(commands));
      assert.ok(commands.length > 0);
      assert.ok(commands.every((c) => typeof c === "string"));
    });

    test("returns array of command strings for tenant_gray", () => {
      const commands = buildRecommendedCommands("tenant_gray");
      assert.ok(Array.isArray(commands));
      assert.ok(commands.some((c) => c.includes("tenant_gray")));
    });

    test("returns array of command strings for production_ready", () => {
      const commands = buildRecommendedCommands("production_ready");
      assert.ok(Array.isArray(commands));
      assert.ok(commands.some((c) => c.includes("production_ready")));
    });

    test("includes npm run commands", () => {
      const commands = buildRecommendedCommands("canary");
      assert.ok(commands.some((c) => c.includes("npm run")));
    });

    test("includes gate command with correct target status", () => {
      const commands = buildRecommendedCommands("production_ready");
      assert.ok(commands.some((c) => c.includes("gate:stable") && c.includes("production_ready")));
    });
  });

  test.skip("createStableReleasePackage requires filesystem access", () => {
    // Requires reading evidence bundle JSON files and writing outputs
  });
});
