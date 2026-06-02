/**
 * Unit tests for the Stable Evidence Bundle Support Module.
 *
 * Tests the evidence bundle profile resolution and utility functions:
 * - Profile resolution with overrides
 * - JSON serialization for artifacts
 * - Takeover evidence sample generation
 */

import { rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  resolveStableEvidenceProfile,
  STABLE_EVIDENCE_PROFILES,
  seedTakeoverEvidenceScenario,
} from "../../../../../src/platform/shared/stability/stable-evidence-bundle-support.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";

function createTempDb(): { db: SqliteDatabase; store: AuthoritativeTaskStore; cleanup: () => void } {
  const dbPath = join("/tmp", `evidence-test-${Date.now()}.db`);
  rmSync(dbPath, { force: true });
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return {
    db,
    store,
    cleanup: () => {
      db.close();
      rmSync(dbPath, { force: true });
    },
  };
}

test("STABLE_EVIDENCE_PROFILES contains smoke, 24h, and 72h profiles [evidence-bundle]", () => {
  if (!STABLE_EVIDENCE_PROFILES["smoke"]) {
    throw new Error("Missing smoke profile");
  }
  if (!STABLE_EVIDENCE_PROFILES["24h"]) {
    throw new Error("Missing 24h profile");
  }
  if (!STABLE_EVIDENCE_PROFILES["72h"]) {
    throw new Error("Missing 72h profile");
  }
});

test("smoke profile has quick iteration settings [evidence-bundle]", () => {
  const profile = STABLE_EVIDENCE_PROFILES["smoke"];

  if (profile.validationIterations !== 2) {
    throw new Error(`Expected 2 validation iterations, got ${profile.validationIterations}`);
  }
  if (profile.soakDurationMs !== 5_000) {
    throw new Error(`Expected 5s soak duration, got ${profile.soakDurationMs}`);
  }
});

test("24h profile has full day soak settings [evidence-bundle]", () => {
  const profile = STABLE_EVIDENCE_PROFILES["24h"];

  if (profile.validationIterations !== 5) {
    throw new Error(`Expected 5 validation iterations, got ${profile.validationIterations}`);
  }
  if (profile.soakDurationMs !== 24 * 60 * 60 * 1000) {
    throw new Error(`Expected 24h soak duration, got ${profile.soakDurationMs}`);
  }
});

test("resolveStableEvidenceProfile returns default smoke profile [evidence-bundle]", () => {
  const profile = resolveStableEvidenceProfile();

  if (profile.name !== "smoke") {
    throw new Error(`Expected smoke profile, got ${profile.name}`);
  }
});

test("resolveStableEvidenceProfile applies overrides correctly [evidence-bundle]", () => {
  const profile = resolveStableEvidenceProfile("smoke", {
    validationIterations: 10,
    soakDurationMs: 60_000,
  });

  if (profile.validationIterations !== 10) {
    throw new Error(`Expected 10 validation iterations, got ${profile.validationIterations}`);
  }
  if (profile.soakDurationMs !== 60_000) {
    throw new Error(`Expected 60s soak duration, got ${profile.soakDurationMs}`);
  }
  // Other smoke properties should remain
  if (profile.soakIntervalMs !== 500) {
    throw new Error(`Expected 500ms soak interval, got ${profile.soakIntervalMs}`);
  }
});

test("seedTakeoverEvidenceScenario creates task, execution, and session [evidence-bundle]", () => {
  const { db, store, cleanup } = createTempDb();
  try {
    const result = seedTakeoverEvidenceScenario(db, store);

    if (!result.taskId) {
      throw new Error("Expected taskId to be set");
    }
    if (!result.executionId) {
      throw new Error("Expected executionId to be set");
    }
    if (!result.sessionId) {
      throw new Error("Expected sessionId to be set");
    }

    // Verify task exists
    const task = store.task.getTask(result.taskId);
    if (!task) {
      throw new Error("Expected task to exist in store");
    }

    // Verify execution exists
    const execution = store.execution.getExecution(result.executionId);
    if (!execution) {
      throw new Error("Expected execution to exist in store");
    }

    // Verify session exists
    const session = store.session.getSession(result.sessionId);
    if (!session) {
      throw new Error("Expected session to exist in store");
    }
  } finally {
    cleanup();
  }
});

test("seedTakeoverEvidenceScenario task has correct initial status [evidence-bundle]", () => {
  const { db, store, cleanup } = createTempDb();
  try {
    const result = seedTakeoverEvidenceScenario(db, store);
    const task = store.task.getTask(result.taskId);

    if (task?.status !== "in_progress") {
      throw new Error(`Expected task status in_progress, got ${task?.status}`);
    }
    if (task?.divisionId !== "general-ops") {
      throw new Error(`Expected division general-ops, got ${task?.divisionId}`);
    }
    if (task?.source !== "system") {
      throw new Error(`Expected source system, got ${task?.source}`);
    }
  } finally {
    cleanup();
  }
});

test("seedTakeoverEvidenceScenario execution is in executing status [evidence-bundle]", () => {
  const { db, store, cleanup } = createTempDb();
  try {
    const result = seedTakeoverEvidenceScenario(db, store);
    const execution = store.execution.getExecution(result.executionId);

    if (execution?.status !== "executing") {
      throw new Error(`Expected execution status executing, got ${execution?.status}`);
    }
    if (execution?.agentId !== "agent_general_executor") {
      throw new Error(`Expected agent_general_executor, got ${execution?.agentId}`);
    }
  } finally {
    cleanup();
  }
});

test("seedTakeoverEvidenceScenario session is open [evidence-bundle]", () => {
  const { db, store, cleanup } = createTempDb();
  try {
    const result = seedTakeoverEvidenceScenario(db, store);
    const session = store.session.getSession(result.sessionId);

    if (session?.status !== "open") {
      throw new Error(`Expected session status open, got ${session?.status}`);
    }
    if (session?.channel !== "cli") {
      throw new Error(`Expected channel cli, got ${session?.channel}`);
    }
  } finally {
    cleanup();
  }
});

test("72h profile has extended stress test settings [evidence-bundle]", () => {
  const profile = STABLE_EVIDENCE_PROFILES["72h"];

  if (profile.validationIterations !== 8) {
    throw new Error(`Expected 8 validation iterations, got ${profile.validationIterations}`);
  }
  if (profile.soakDurationMs !== 72 * 60 * 60 * 1000) {
    throw new Error(`Expected 72h soak duration, got ${profile.soakDurationMs}`);
  }
  if (profile.soakIterationsPerCycle !== 3) {
    throw new Error(`Expected 3 iterations per cycle, got ${profile.soakIterationsPerCycle}`);
  }
});

test("resolveStableEvidenceProfile preserves profile name [evidence-bundle]", () => {
  const profile24h = resolveStableEvidenceProfile("24h");

  if (profile24h.name !== "24h") {
    throw new Error(`Expected profile name 24h, got ${profile24h.name}`);
  }
});

test("resolveStableEvidenceProfile 72h with overrides [evidence-bundle]", () => {
  const profile = resolveStableEvidenceProfile("72h", {
    soakDurationMs: 36 * 60 * 60 * 1000, // Half of 72h
  });

  if (profile.name !== "72h") {
    throw new Error(`Expected profile name 72h, got ${profile.name}`);
  }
  if (profile.soakDurationMs !== 36 * 60 * 60 * 1000) {
    throw new Error(`Expected 36h soak duration, got ${profile.soakDurationMs}`);
  }
  // Non-overridden properties should match 72h
  if (profile.validationIterations !== 8) {
    throw new Error(`Expected 8 validation iterations, got ${profile.validationIterations}`);
  }
});
