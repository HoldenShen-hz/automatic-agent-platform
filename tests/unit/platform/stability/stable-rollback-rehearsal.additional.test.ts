import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { rmSync, mkdirSync } from "node:fs";

import {
  REQUIRED_STABLE_ROLLBACK_TARGETS,
  type StableRollbackTargetId,
  type StableRollbackEntryPoint,
  type StableRollbackTarget,
  type StableRollbackPlaybook,
  type StableRollbackScenarioResult,
  type StableRollbackRehearsalOptions,
  type StableRollbackRehearsalReport,
  buildStableRollbackPlaybook,
  writeStableRollbackRehearsalReport,
  runStableRollbackRehearsal,
} from "../../../../src/platform/stability/stable-rollback-rehearsal.js";

describe("stable-rollback-rehearsal additional tests", () => {
  describe("REQUIRED_STABLE_ROLLBACK_TARGETS constant", () => {
    test("contains all required rollback targets", () => {
      const expectedTargets = [
        "application_binary",
        "config_bundle",
        "feature_flag",
        "worker_version",
        "prompt_bundle",
      ] as const;

      assert.equal(REQUIRED_STABLE_ROLLBACK_TARGETS.length, expectedTargets.length);
      for (const expected of expectedTargets) {
        assert.ok(
          REQUIRED_STABLE_ROLLBACK_TARGETS.includes(expected),
          `Expected ${expected} to be in REQUIRED_STABLE_ROLLBACK_TARGETS`,
        );
      }
    });

    test("is a readonly tuple", () => {
      const targets = REQUIRED_STABLE_ROLLBACK_TARGETS;
      assert.equal(Array.isArray(targets), true);
      assert.equal(targets.length, 5);
    });
  });

  describe("Type definitions", () => {
    test("StableRollbackTargetId is one of the required targets", () => {
      const targetId: StableRollbackTargetId = "application_binary";
      assert.ok(REQUIRED_STABLE_ROLLBACK_TARGETS.includes(targetId));
    });

    test("StableRollbackEntryPoint can be constructed", () => {
      const entryPoint: StableRollbackEntryPoint = {
        entryPointId: "stable_rollback_cli",
        description: "CLI-based rollback",
        command: "npm run rollback:stable",
      };
      assert.equal(entryPoint.entryPointId, "stable_rollback_cli");
      assert.ok(entryPoint.description.length > 0);
    });

    test("StableRollbackTarget can be constructed", () => {
      const target: StableRollbackTarget = {
        targetId: "application_binary",
        currentVersion: "1.0.0",
        rollbackOwner: "release_manager",
        rollbackTrigger: "test trigger",
        entryPointId: "stable_rollback_cli",
        rollbackSteps: ["step 1", "step 2"],
        healthValidation: ["check 1"],
        auditRequirements: ["audit 1"],
      };
      assert.equal(target.targetId, "application_binary");
      assert.ok(Array.isArray(target.rollbackSteps));
      assert.ok(Array.isArray(target.healthValidation));
    });

    test("StableRollbackScenarioResult can represent passed scenario", () => {
      const result: StableRollbackScenarioResult = {
        scenarioId: "runtime_repair_rehearsal",
        passed: true,
        durationMs: 150.5,
        summary: "Test passed",
        details: { key: "value" },
      };
      assert.equal(result.passed, true);
      assert.equal(result.scenarioId, "runtime_repair_rehearsal");
    });

    test("StableRollbackScenarioResult can represent failed scenario", () => {
      const result: StableRollbackScenarioResult = {
        scenarioId: "manual_takeover_rehearsal",
        passed: false,
        durationMs: 200,
        summary: "Test failed",
        details: { error: "something went wrong" },
      };
      assert.equal(result.passed, false);
    });

    test("StableRollbackRehearsalOptions requires outputDir", () => {
      const options: StableRollbackRehearsalOptions = {
        outputDir: "/tmp/test-output",
      };
      assert.ok(options.outputDir.length > 0);
    });

    test("StableRollbackPlaybook can be partially constructed", () => {
      const playbook: StableRollbackPlaybook = {
        generatedAt: "2026-04-20T00:00:00.000Z",
        rollbackOwner: "test-owner",
        reportPath: "/tmp/report.json",
        playbookPath: "/tmp/playbook.json",
        runtimeVersionSnapshot: {
          schemaVersion: "1.0",
          applicationVersion: "1.0.0",
          configVersion: "1.0",
          promptBundleVersion: "1.0",
          featureFlags: [],
          buildCommit: "abc123",
          nodeVersion: "20.0.0",
          platform: "darwin",
          schemaStatus: { current: "1.0", target: "1.0", missing: 0 },
        },
        prechecks: [],
        healthValidation: [],
        auditRequirements: [],
        rollbackEntryPoints: [],
        scenarioEvidence: [],
        targets: [],
      };
      assert.ok(playbook.generatedAt.length > 0);
      assert.ok(Array.isArray(playbook.targets));
    });
  });

  describe("buildStableRollbackPlaybook", () => {
    test("generates playbook with all required targets", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "rollback-playbook-"));

      try {
        const playbook = buildStableRollbackPlaybook({
          outputDir: tmpDir,
          reportPath: join(tmpDir, "report.json"),
          playbookPath: join(tmpDir, "playbook.json"),
          scenarios: [],
        });

        assert.equal(playbook.targets.length, REQUIRED_STABLE_ROLLBACK_TARGETS.length);
        for (const target of playbook.targets) {
          assert.ok(
            REQUIRED_STABLE_ROLLBACK_TARGETS.includes(target.targetId),
            `Target ${target.targetId} should be in required targets`,
          );
        }
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    test("playbook includes prechecks", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "rollback-prechecks-"));

      try {
        const playbook = buildStableRollbackPlaybook({
          outputDir: tmpDir,
          reportPath: join(tmpDir, "report.json"),
          playbookPath: join(tmpDir, "playbook.json"),
          scenarios: [],
        });

        assert.ok(Array.isArray(playbook.prechecks));
        assert.ok(playbook.prechecks.length > 0);
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    test("playbook includes audit requirements", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "rollback-audit-"));

      try {
        const playbook = buildStableRollbackPlaybook({
          outputDir: tmpDir,
          reportPath: join(tmpDir, "report.json"),
          playbookPath: join(tmpDir, "playbook.json"),
          scenarios: [],
        });

        assert.ok(Array.isArray(playbook.auditRequirements));
        assert.ok(playbook.auditRequirements.length > 0);
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    test("scenario evidence reflects passed scenarios", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "rollback-scenarios-"));

      try {
        const scenarios: StableRollbackScenarioResult[] = [
          {
            scenarioId: "runtime_repair_rehearsal",
            passed: true,
            durationMs: 100,
            summary: "runtime repair passed",
            details: {},
          },
          {
            scenarioId: "manual_takeover_rehearsal",
            passed: false,
            durationMs: 200,
            summary: "manual takeover failed",
            details: { error: "test" },
          },
        ];

        const playbook = buildStableRollbackPlaybook({
          outputDir: tmpDir,
          reportPath: join(tmpDir, "report.json"),
          playbookPath: join(tmpDir, "playbook.json"),
          scenarios,
        });

        assert.equal(playbook.scenarioEvidence.length, 2);
        assert.equal(playbook.scenarioEvidence[0].passed, true);
        assert.equal(playbook.scenarioEvidence[1].passed, false);
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe("runStableRollbackRehearsal integration", () => {
    test("creates report with correct structure", async () => {
      const outputDir = mkdtempSync(join(tmpdir(), "rollback-rehearsal-"));

      try {
        const report = await runStableRollbackRehearsal({ outputDir });

        assert.ok(report.startedAt.length > 0);
        assert.ok(report.finishedAt.length > 0);
        assert.equal(report.outputDir, outputDir);
        assert.ok(report.artifacts.reportPath.length > 0);
        assert.ok(report.artifacts.playbookPath.length > 0);
        assert.equal(report.totalScenarios, report.scenarios.length);
        assert.equal(
          report.passedScenarios + report.failedScenarios,
          report.totalScenarios,
        );
      } finally {
        rmSync(outputDir, { recursive: true, force: true });
      }
    });

    test("all scenarios have required fields", async () => {
      const outputDir = mkdtempSync(join(tmpdir(), "rollback-scenario-fields-"));

      try {
        const report = await runStableRollbackRehearsal({ outputDir });

        for (const scenario of report.scenarios) {
          assert.ok(["runtime_repair_rehearsal", "manual_takeover_rehearsal"].includes(scenario.scenarioId));
          assert.equal(typeof scenario.passed, "boolean");
          assert.ok(typeof scenario.durationMs === "number");
          assert.ok(scenario.summary.length > 0);
          assert.equal(typeof scenario.details, "object");
        }
      } finally {
        rmSync(outputDir, { recursive: true, force: true });
      }
    });
  });

  describe("writeStableRollbackRehearsalReport", () => {
    test("is callable without errors", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "rollback-write-"));
      const outputFile = join(tmpDir, "report.json");

      try {
        const report: StableRollbackRehearsalReport = {
          startedAt: "2026-04-20T00:00:00.000Z",
          finishedAt: "2026-04-20T00:01:00.000Z",
          outputDir: tmpDir,
          artifacts: {
            reportPath: outputFile,
            playbookPath: join(tmpDir, "playbook.json"),
          },
          playbook: {
            generatedAt: "2026-04-20T00:00:00.000Z",
            rollbackOwner: "test",
            reportPath: outputFile,
            playbookPath: join(tmpDir, "playbook.json"),
            runtimeVersionSnapshot: {
              schemaVersion: "1.0",
              applicationVersion: "1.0.0",
              configVersion: "1.0",
              promptBundleVersion: "1.0",
              featureFlags: [],
              buildCommit: "abc",
              nodeVersion: "20.0.0",
              platform: "darwin",
              schemaStatus: { current: "1.0", target: "1.0", missing: 0 },
            },
            prechecks: [],
            healthValidation: [],
            auditRequirements: [],
            rollbackEntryPoints: [],
            scenarioEvidence: [],
            targets: [],
          },
          totalScenarios: 2,
          passedScenarios: 2,
          failedScenarios: 0,
          scenarios: [],
        };

        writeStableRollbackRehearsalReport(outputFile, report);
        assert.equal(existsSync(outputFile), true);
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });
});

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";
