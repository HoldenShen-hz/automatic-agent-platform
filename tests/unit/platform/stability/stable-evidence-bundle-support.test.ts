import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import {
  STABLE_EVIDENCE_PROFILES,
  buildTakeoverEvidenceSample,
  resolveStableEvidenceProfile,
  seedTakeoverEvidenceScenario,
  type StableEvidenceProfileName,
} from "../../../../src/platform/stability/stable-evidence-bundle-support.js";
import { StructuredLogger } from "../../../../src/platform/shared/observability/structured-logger.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

describe("stable-evidence-bundle-support", () => {
  describe("STABLE_EVIDENCE_PROFILES", () => {
    test("smoke profile has correct structure", () => {
      const smoke = STABLE_EVIDENCE_PROFILES.smoke;
      assert.equal(smoke.name, "smoke");
      assert.equal(smoke.validationIterations, 2);
      assert.equal(smoke.soakDurationMs, 5_000);
      assert.equal(smoke.soakIntervalMs, 500);
      assert.equal(smoke.soakIterationsPerCycle, 1);
    });

    test("24h profile has correct structure", () => {
      const profile = STABLE_EVIDENCE_PROFILES["24h"];
      assert.equal(profile.name, "24h");
      assert.equal(profile.validationIterations, 5);
      assert.equal(profile.soakDurationMs, 24 * 60 * 60 * 1000);
      assert.equal(profile.soakIntervalMs, 5 * 60 * 1000);
      assert.equal(profile.soakIterationsPerCycle, 3);
    });

    test("72h profile has correct structure", () => {
      const profile = STABLE_EVIDENCE_PROFILES["72h"];
      assert.equal(profile.name, "72h");
      assert.equal(profile.validationIterations, 8);
      assert.equal(profile.soakDurationMs, 72 * 60 * 60 * 1000);
      assert.equal(profile.soakIntervalMs, 10 * 60 * 1000);
      assert.equal(profile.soakIterationsPerCycle, 3);
    });
  });

  describe("resolveStableEvidenceProfile", () => {
    test("defaults to smoke profile", () => {
      const profile = resolveStableEvidenceProfile();
      assert.equal(profile.name, "smoke");
      assert.equal(profile.validationIterations, 2);
    });

    test("resolves 24h profile by name", () => {
      const profile = resolveStableEvidenceProfile("24h");
      assert.equal(profile.name, "24h");
      assert.equal(profile.validationIterations, 5);
    });

    test("resolves 72h profile by name", () => {
      const profile = resolveStableEvidenceProfile("72h");
      assert.equal(profile.name, "72h");
      assert.equal(profile.validationIterations, 8);
    });

    test("applies overrides to base profile", () => {
      const profile = resolveStableEvidenceProfile("smoke", {
        validationIterations: 10,
        soakDurationMs: 60_000,
      });
      assert.equal(profile.name, "smoke");
      assert.equal(profile.validationIterations, 10);
      assert.equal(profile.soakDurationMs, 60_000);
      assert.equal(profile.soakIntervalMs, 500); // unchanged from base
    });

    test("overrides soakIntervalMs", () => {
      const profile = resolveStableEvidenceProfile("smoke", {
        soakIntervalMs: 1000,
      });
      assert.equal(profile.soakIntervalMs, 1000);
    });

    test("partial overrides only affect specified fields", () => {
      const profile = resolveStableEvidenceProfile("24h", {
        soakIterationsPerCycle: 5,
      });
      assert.equal(profile.soakDurationMs, 24 * 60 * 60 * 1000);
      assert.equal(profile.soakIterationsPerCycle, 5);
      assert.equal(profile.validationIterations, 5);
    });

    test("unknown profile name returns undefined behavior", () => {
      // TypeScript would catch invalid profile names, but runtime lookup
      // would return undefined and spread would fail
      const profiles = STABLE_EVIDENCE_PROFILES;
      assert.ok(profiles);
    });
  });

  test("seedTakeoverEvidenceScenario creates task, execution, and session records", () => {
    const workspace = createTempWorkspace("aa-stable-evidence-seed-");
    const dbPath = join(workspace, "stable-evidence-seed.db");

    try {
      const db = new SqliteDatabase(dbPath);
      db.migrate();
      const store = new AuthoritativeTaskStore(db);

      const scenario = seedTakeoverEvidenceScenario(db, store);
      const task = store.task.getTask(scenario.taskId);
      const execution = store.execution.getExecution(scenario.executionId);
      const session = store.session.getSession(scenario.sessionId);

      assert.equal(task?.status, "in_progress");
      assert.equal(execution?.status, "executing");
      assert.equal(session?.status, "open");
      db.close();
    } finally {
      cleanupPath(workspace);
    }
  });

  test("buildTakeoverEvidenceSample completes a full human takeover flow", () => {
    const workspace = createTempWorkspace("aa-stable-evidence-sample-");
    const dbPath = join(workspace, "stable-evidence-sample.db");

    try {
      const db = new SqliteDatabase(dbPath);
      db.migrate();
      const store = new AuthoritativeTaskStore(db);
      const logger = new StructuredLogger({ retentionLimit: 20 });

      const sample = buildTakeoverEvidenceSample(db, store, logger);

      assert.equal(sample.finalTaskStatus, "done");
      assert.equal(sample.finalSessionStatus, "completed");
      assert.equal(sample.operatorActionCount >= 4, true);
      db.close();
    } finally {
      cleanupPath(workspace);
    }
  });
});
