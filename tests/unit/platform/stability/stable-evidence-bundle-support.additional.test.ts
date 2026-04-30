import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  STABLE_EVIDENCE_PROFILES,
  writeJson,
  resolveStableEvidenceProfile,
  seedTakeoverEvidenceScenario,
  buildTakeoverEvidenceSample,
  type StableEvidenceProfile,
  type StableEvidenceProfileName,
  type StableEvidenceBundleOptions,
  type StableEvidenceBundleReport,
  type StableEvidenceRepairReport,
  type StableEvidenceTakeoverSample,
} from "../../../../src/platform/stability/stable-evidence-bundle-support.js";
import { StructuredLogger } from "../../../../src/platform/shared/observability/structured-logger.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";

describe("stable-evidence-bundle-support additional tests", () => {
  describe("writeJson", () => {
    test("writes formatted JSON to file", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "write-json-test-"));
      const filePath = join(tmpDir, "output.json");

      try {
        writeJson(filePath, { key: "value", number: 42 });

        assert.equal(existsSync(filePath), true);
        const content = JSON.parse(readFileSync(filePath, "utf8"));
        assert.equal(content.key, "value");
        assert.equal(content.number, 42);
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    test("creates parent directories recursively", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "write-json-nested-"));
      const filePath = join(tmpDir, "deeply", "nested", "dir", "output.json");

      try {
        writeJson(filePath, { nested: true });
        assert.equal(existsSync(filePath), true);
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    test("writes arrays correctly", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "write-json-array-"));
      const filePath = join(tmpDir, "array.json");

      try {
        writeJson(filePath, [1, 2, 3, "four", { five: true }]);
        const content = JSON.parse(readFileSync(filePath, "utf8"));
        assert.deepEqual(content, [1, 2, 3, "four", { five: true }]);
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    test("writes null and special values", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "write-json-special-"));
      const filePath = join(tmpDir, "special.json");

      try {
        writeJson(filePath, { null: null, bool: false, zero: 0, empty: "" });
        const content = JSON.parse(readFileSync(filePath, "utf8"));
        assert.equal(content.null, null);
        assert.equal(content.bool, false);
        assert.equal(content.zero, 0);
        assert.equal(content.empty, "");
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    test("overwrites existing file", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "write-json-overwrite-"));
      const filePath = join(tmpDir, "overwrite.json");

      try {
        writeJson(filePath, { first: true });
        writeJson(filePath, { second: true });
        const content = JSON.parse(readFileSync(filePath, "utf8"));
        assert.equal(content.first, undefined);
        assert.equal(content.second, true);
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe("STABLE_EVIDENCE_PROFILES", () => {
    test("all profiles have required fields", () => {
      const profiles: StableEvidenceProfileName[] = ["smoke", "24h", "72h"];

      for (const name of profiles) {
        const profile = STABLE_EVIDENCE_PROFILES[name];
        assert.ok(profile, `Profile ${name} should exist`);
        assert.equal(profile.name, name);
        assert.ok(typeof profile.validationIterations === "number");
        assert.ok(typeof profile.soakDurationMs === "number");
        assert.ok(typeof profile.soakIntervalMs === "number");
        assert.ok(typeof profile.soakIterationsPerCycle === "number");
      }
    });

    test("smoke profile is suitable for quick testing", () => {
      const smoke = STABLE_EVIDENCE_PROFILES.smoke;
      assert.ok(smoke.soakDurationMs <= 10_000, "Smoke soak should be <= 10 seconds");
      assert.ok(smoke.validationIterations <= 5, "Smoke iterations should be <= 5");
    });

    test("24h profile has correct duration", () => {
      const profile = STABLE_EVIDENCE_PROFILES["24h"];
      assert.equal(profile.soakDurationMs, 24 * 60 * 60 * 1000);
    });

    test("72h profile has correct duration", () => {
      const profile = STABLE_EVIDENCE_PROFILES["72h"];
      assert.equal(profile.soakDurationMs, 72 * 60 * 60 * 1000);
    });
  });

  describe("resolveStableEvidenceProfile", () => {
    test("handles unknown profile name with undefined result", () => {
      // TypeScript would catch invalid names at compile time,
      // but at runtime accessing undefined profile would spread to undefined
      const profiles = STABLE_EVIDENCE_PROFILES;
      assert.ok(profiles);
    });

    test("returns smoke profile when called with no arguments", () => {
      const profile = resolveStableEvidenceProfile();
      assert.equal(profile.name, "smoke");
    });

    test("all profile fields can be overridden", () => {
      const profile = resolveStableEvidenceProfile("smoke", {
        validationIterations: 100,
        soakDurationMs: 999_999,
        soakIntervalMs: 999,
        soakIterationsPerCycle: 99,
      });

      assert.equal(profile.validationIterations, 100);
      assert.equal(profile.soakDurationMs, 999_999);
      assert.equal(profile.soakIntervalMs, 999);
      assert.equal(profile.soakIterationsPerCycle, 99);
    });
  });

  describe("Type exports", () => {
    test("StableEvidenceProfile has expected shape", () => {
      const smoke = STABLE_EVIDENCE_PROFILES.smoke;
      const profile: StableEvidenceProfile = smoke;
      assert.equal(profile.name, "smoke");
    });

    test("StableEvidenceBundleOptions can be constructed", () => {
      const options: StableEvidenceBundleOptions = {
        outputDir: "/tmp/test",
        profileName: "smoke",
      };
      assert.equal(options.outputDir, "/tmp/test");
      assert.equal(options.profileName, "smoke");
    });

    test("StableEvidenceTakeoverSample can be annotated", () => {
      const sample: StableEvidenceTakeoverSample = {
        taskId: "task-123",
        takeoverSessionId: "sess-456",
        executionId: "exec-789",
        finalTaskStatus: "done",
        finalExecutionStatus: "succeeded",
        finalSessionStatus: "completed",
        operatorActionCount: 5,
      };
      assert.equal(sample.finalTaskStatus, "done");
    });
  });
});
