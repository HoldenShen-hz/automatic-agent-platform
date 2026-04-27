import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import {
  runStableConcurrencyRehearsal,
  writeStableConcurrencyRehearsalReport,
  type StableConcurrencyRehearsalOptions,
  type StableConcurrencyScenarioResult,
  type StableConcurrencyRehearsalReport,
} from "../../../../src/platform/stability/stable-concurrency-rehearsal.js";

describe("stable-concurrency-rehearsal comprehensive", () => {
  describe("runStableConcurrencyRehearsal", () => {
    test("runs all three scenarios", async () => {
      const outputDir = "/tmp/stable-concurrency-comp-test-1";
      rmSync(outputDir, { recursive: true, force: true });
      mkdirSync(outputDir, { recursive: true });

      try {
        const report = await runStableConcurrencyRehearsal({ outputDir });

        assert.equal(report.totalScenarios, 3);
        assert.equal(report.scenarios.length, 3);
        assert.equal(report.passedScenarios + report.failedScenarios, 3);
        assert.ok(report.startedAt.length > 0);
        assert.ok(report.finishedAt.length > 0);
        assert.equal(report.outputDir, outputDir);
      } finally {
        rmSync(outputDir, { recursive: true, force: true });
      }
    });

    test("includes all expected scenario IDs", async () => {
      const outputDir = "/tmp/stable-concurrency-comp-test-2";
      rmSync(outputDir, { recursive: true, force: true });
      mkdirSync(outputDir, { recursive: true });

      try {
        const report = await runStableConcurrencyRehearsal({ outputDir });

        const scenarioIds = report.scenarios.map((s) => s.scenarioId);
        assert.ok(scenarioIds.includes("expired_lock_released"));
        assert.ok(scenarioIds.includes("active_execution_conflict_fail_closed"));
        assert.ok(scenarioIds.includes("competing_write_transactions_fail_closed"));
      } finally {
        rmSync(outputDir, { recursive: true, force: true });
      }
    });

    test("each scenario has required fields", async () => {
      const outputDir = "/tmp/stable-concurrency-comp-test-3";
      rmSync(outputDir, { recursive: true, force: true });
      mkdirSync(outputDir, { recursive: true });

      try {
        const report = await runStableConcurrencyRehearsal({ outputDir });

        for (const scenario of report.scenarios) {
          assert.ok(["expired_lock_released", "active_execution_conflict_fail_closed", "competing_write_transactions_fail_closed"].includes(scenario.scenarioId));
          assert.ok(typeof scenario.passed === "boolean");
          assert.ok(typeof scenario.durationMs === "number");
          assert.ok(scenario.durationMs >= 0);
          assert.ok(typeof scenario.summary === "string");
          assert.ok(scenario.summary.length > 0);
          assert.ok(typeof scenario.details === "object");
          assert.ok(scenario.details !== null);
        }
      } finally {
        rmSync(outputDir, { recursive: true, force: true });
      }
    });

    test("expired_lock_released scenario passes with correct assertions", async () => {
      const outputDir = "/tmp/stable-concurrency-comp-test-4";
      rmSync(outputDir, { recursive: true, force: true });
      mkdirSync(outputDir, { recursive: true });

      try {
        const report = await runStableConcurrencyRehearsal({ outputDir });
        const scenario = report.scenarios.find((s) => s.scenarioId === "expired_lock_released");

        assert.ok(scenario, "expired_lock_released scenario should exist");
        assert.equal(scenario.passed, true);
        assert.ok(scenario.durationMs >= 0);
        assert.ok(scenario.summary.length > 0);
        assert.ok(scenario.details);
      } finally {
        rmSync(outputDir, { recursive: true, force: true });
      }
    });

    test("active_execution_conflict_fail_closed scenario passes", async () => {
      const outputDir = "/tmp/stable-concurrency-comp-test-5";
      rmSync(outputDir, { recursive: true, force: true });
      mkdirSync(outputDir, { recursive: true });

      try {
        const report = await runStableConcurrencyRehearsal({ outputDir });
        const scenario = report.scenarios.find((s) => s.scenarioId === "active_execution_conflict_fail_closed");

        assert.ok(scenario, "active_execution_conflict_fail_closed scenario should exist");
        assert.equal(scenario.passed, true);
        assert.ok(scenario.durationMs >= 0);
      } finally {
        rmSync(outputDir, { recursive: true, force: true });
      }
    });

    test("competing_write_transactions_fail_closed scenario passes", async () => {
      const outputDir = "/tmp/stable-concurrency-comp-test-6";
      rmSync(outputDir, { recursive: true, force: true });
      mkdirSync(outputDir, { recursive: true });

      try {
        const report = await runStableConcurrencyRehearsal({ outputDir });
        const scenario = report.scenarios.find((s) => s.scenarioId === "competing_write_transactions_fail_closed");

        assert.ok(scenario, "competing_write_transactions_fail_closed scenario should exist");
        assert.equal(scenario.passed, true);
      } finally {
        rmSync(outputDir, { recursive: true, force: true });
      }
    });

    test("passedScenarios equals totalScenarios when all pass", async () => {
      const outputDir = "/tmp/stable-concurrency-comp-test-7";
      rmSync(outputDir, { recursive: true, force: true });
      mkdirSync(outputDir, { recursive: true });

      try {
        const report = await runStableConcurrencyRehearsal({ outputDir });

        if (report.failedScenarios === 0) {
          assert.equal(report.passedScenarios, report.totalScenarios);
          assert.equal(report.passedScenarios, 3);
        }
      } finally {
        rmSync(outputDir, { recursive: true, force: true });
      }
    });

    test("failedScenarios equals totalScenarios minus passedScenarios", async () => {
      const outputDir = "/tmp/stable-concurrency-comp-test-8";
      rmSync(outputDir, { recursive: true, force: true });
      mkdirSync(outputDir, { recursive: true });

      try {
        const report = await runStableConcurrencyRehearsal({ outputDir });

        assert.equal(report.passedScenarios + report.failedScenarios, report.totalScenarios);
      } finally {
        rmSync(outputDir, { recursive: true, force: true });
      }
    });

    test("startedAt is before finishedAt", async () => {
      const outputDir = "/tmp/stable-concurrency-comp-test-9";
      rmSync(outputDir, { recursive: true, force: true });
      mkdirSync(outputDir, { recursive: true });

      try {
        const report = await runStableConcurrencyRehearsal({ outputDir });

        assert.ok(new Date(report.startedAt) <= new Date(report.finishedAt));
      } finally {
        rmSync(outputDir, { recursive: true, force: true });
      }
    });
  });

  describe("writeStableConcurrencyRehearsalReport", () => {
    test("is a callable function", () => {
      assert.equal(typeof writeStableConcurrencyRehearsalReport, "function");
    });
  });

  describe("StableConcurrencyRehearsalOptions", () => {
    test("accepts valid options structure", () => {
      const options: StableConcurrencyRehearsalOptions = {
        outputDir: "/tmp/test",
      };

      assert.equal(options.outputDir, "/tmp/test");
    });
  });

  describe("StableConcurrencyScenarioResult", () => {
    test("scenarioId accepts valid values", () => {
      const validIds: StableConcurrencyScenarioResult["scenarioId"][] = [
        "expired_lock_released",
        "active_execution_conflict_fail_closed",
        "competing_write_transactions_fail_closed",
      ];

      for (const id of validIds) {
        const scenario: StableConcurrencyScenarioResult = {
          scenarioId: id,
          passed: true,
          durationMs: 100,
          summary: "test summary",
          details: {},
        };
        assert.equal(scenario.scenarioId, id);
      }
    });

    test("passed field is boolean", () => {
      const scenario: StableConcurrencyScenarioResult = {
        scenarioId: "expired_lock_released",
        passed: false,
        durationMs: 50,
        summary: "test",
        details: {},
      };

      assert.equal(typeof scenario.passed, "boolean");
    });

    test("durationMs is non-negative number", () => {
      const scenario: StableConcurrencyScenarioResult = {
        scenarioId: "expired_lock_released",
        passed: true,
        durationMs: 0,
        summary: "test",
        details: {},
      };

      assert.ok(scenario.durationMs >= 0);
    });
  });

  describe("StableConcurrencyRehearsalReport", () => {
    test("has correct structure", () => {
      const report: StableConcurrencyRehearsalReport = {
        startedAt: "2026-04-01T00:00:00.000Z",
        finishedAt: "2026-04-01T00:01:00.000Z",
        outputDir: "/tmp/test",
        totalScenarios: 3,
        passedScenarios: 3,
        failedScenarios: 0,
        scenarios: [],
      };

      assert.ok(report.startedAt.length > 0);
      assert.ok(report.finishedAt.length > 0);
      assert.ok(report.outputDir.length > 0);
      assert.equal(report.totalScenarios, 3);
      assert.equal(report.passedScenarios, 3);
      assert.equal(report.failedScenarios, 0);
      assert.ok(Array.isArray(report.scenarios));
    });

    test("scenarios array can contain scenario results", () => {
      const scenario: StableConcurrencyScenarioResult = {
        scenarioId: "expired_lock_released",
        passed: true,
        durationMs: 100,
        summary: "test summary",
        details: { key: "value" },
      };

      const report: StableConcurrencyRehearsalReport = {
        startedAt: "2026-04-01T00:00:00.000Z",
        finishedAt: "2026-04-01T00:01:00.000Z",
        outputDir: "/tmp/test",
        totalScenarios: 1,
        passedScenarios: 1,
        failedScenarios: 0,
        scenarios: [scenario],
      };

      assert.equal(report.scenarios.length, 1);
      assert.equal(report.scenarios[0]!.scenarioId, "expired_lock_released");
    });
  });
});
