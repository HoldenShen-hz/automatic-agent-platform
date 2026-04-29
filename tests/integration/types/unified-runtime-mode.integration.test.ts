/**
 * Integration tests for Unified Runtime Mode across modules
 *
 * @see src/platform/contracts/types/unified-runtime-mode.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  mapPolicyModeToUnifiedRuntimeMode,
  mapHealthDegradationModeToUnifiedRuntimeMode,
  mapAutonomyLevelToUnifiedRuntimeMode,
  normalizeUnifiedRuntimeMode,
  toDocumentedUnifiedRuntimeMode,
} from "../../../src/platform/contracts/types/unified-runtime-mode.js";
import { newId } from "../../../src/platform/contracts/types/ids.js";

// ─────────────────────────────────────────────────────────────────────────────
// Mode Mapping Pipeline Integration
// ─────────────────────────────────────────────────────────────────────────────

test("integration: modes can be mapped through multiple conversion pipelines", () => {
  // Policy mode -> Unified mode -> Documented mode
  const policyMode = "full-auto";
  const unified = mapPolicyModeToUnifiedRuntimeMode(policyMode);
  const documented = toDocumentedUnifiedRuntimeMode(unified);

  assert.strictEqual(unified, "full_auto");
  assert.strictEqual(documented, "full-auto");
});

test("integration: health degradation to autonomy mapping", () => {
  // Health degradation mode -> Unified mode -> Autonomy level -> Back to Unified
  const healthMode = "fast_only";
  const unified = mapHealthDegradationModeToUnifiedRuntimeMode(healthMode);
  const autonomyResult = mapAutonomyLevelToUnifiedRuntimeMode("supervised");

  assert.strictEqual(unified, "supervised_auto");
  assert.strictEqual(autonomyResult, "manual_only");
});

test("integration: autonomy mode round-trip through normalize", () => {
  const autonomyLevels = ["full_auto", "semi_auto", "supervised", "suggestion", "frozen"] as const;

  for (const level of autonomyLevels) {
    const unified = mapAutonomyLevelToUnifiedRuntimeMode(level);
    const normalized = normalizeUnifiedRuntimeMode(unified);
    assert.strictEqual(normalized, unified);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Mode Transitions in Runtime Scenarios
// ─────────────────────────────────────────────────────────────────────────────

test("integration: runtime mode escalation under different scenarios", () => {
  // Normal operation - full auto
  let currentMode = mapPolicyModeToUnifiedRuntimeMode("full-auto");
  assert.strictEqual(currentMode, "full_auto");

  // Degraded health - move to degraded mode
  currentMode = mapPolicyModeToUnifiedRuntimeMode("degraded");
  assert.strictEqual(currentMode, "no_external_call");

  // Further degradation - emergency mode
  currentMode = mapPolicyModeToUnifiedRuntimeMode("emergency");
  assert.strictEqual(currentMode, "no_write");

  // Recovery - back to supervised
  currentMode = mapPolicyModeToUnifiedRuntimeMode("supervised");
  assert.strictEqual(currentMode, "manual_only");
});

test("integration: health degradation progression", () => {
  const degradationModes = [
    { input: "none", expected: "full_auto" },
    { input: "fast_only", expected: "supervised_auto" },
    { input: "queue_only", expected: "no_external_call" },
    { input: "pause_non_critical", expected: "manual_only" },
    { input: "read_only_operations_only", expected: "read_only" },
  ];

  for (const { input, expected } of degradationModes) {
    const result = mapHealthDegradationModeToUnifiedRuntimeMode(input as Parameters<typeof mapHealthDegradationModeToUnifiedRuntimeMode>[0]);
    assert.strictEqual(result, expected, `Health degradation mode "${input}" should map to "${expected}"`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Autonomy Mode Changes
// ─────────────────────────────────────────────────────────────────────────────

test("integration: autonomy levels map correctly to runtime modes", () => {
  const autonomyMappings = [
    { autonomy: "full_auto", expected: "full_auto" },
    { autonomy: "semi_auto", expected: "supervised_auto" },
    { autonomy: "supervised", expected: "manual_only" },
    { autonomy: "suggestion", expected: "no_write" },
    { autonomy: "frozen", expected: "incident_mode" },
  ];

  for (const { autonomy, expected } of autonomyMappings) {
    const result = mapAutonomyLevelToUnifiedRuntimeMode(autonomy as Parameters<typeof mapAutonomyLevelToUnifiedRuntimeMode>[0]);
    assert.strictEqual(result, expected, `Autonomy level "${autonomy}" should map to "${expected}"`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Documented Mode Conversions
// ─────────────────────────────────────────────────────────────────────────────

test("integration: documented modes can be normalized and converted back", () => {
  const documentedModes = [
    "full-auto",
    "supervised-auto",
    "read-only",
    "no-write",
    "no-external-call",
    "no-rollout",
    "manual-only",
    "incident-mode",
  ];

  for (const documented of documentedModes) {
    const normalized = normalizeUnifiedRuntimeMode(documented as Parameters<typeof normalizeUnifiedRuntimeMode>[0]);
    const backToDocumented = toDocumentedUnifiedRuntimeMode(normalized);
    assert.strictEqual(backToDocumented, documented, `Mode "${documented}" should round-trip correctly`);
  }
});

test("integration: underscore modes pass through normalize unchanged", () => {
  const underscoreModes = [
    "full_auto",
    "supervised_auto",
    "read_only",
    "no_write",
    "no_external_call",
    "no_rollout",
    "manual_only",
    "incident_mode",
  ];

  for (const mode of underscoreModes) {
    const normalized = normalizeUnifiedRuntimeMode(mode as Parameters<typeof normalizeUnifiedRuntimeMode>[0]);
    assert.strictEqual(normalized, mode);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Mode in Operational Context
// ─────────────────────────────────────────────────────────────────────────────

test("integration: mode changes reflect in operational capabilities", () => {
  interface OperationalCapability {
    canAutoExecute: boolean;
    canWriteExternal: boolean;
    canRollout: boolean;
    canApprove: boolean;
  }

  function getCapabilities(mode: ReturnType<typeof mapPolicyModeToUnifiedRuntimeMode>): OperationalCapability {
    switch (mode) {
      case "full_auto":
        return { canAutoExecute: true, canWriteExternal: true, canRollout: true, canApprove: false };
      case "supervised_auto":
        return { canAutoExecute: true, canWriteExternal: true, canRollout: true, canApprove: true };
      case "read_only":
        return { canAutoExecute: false, canWriteExternal: false, canRollout: false, canApprove: false };
      case "no_write":
        return { canAutoExecute: false, canWriteExternal: false, canRollout: false, canApprove: false };
      case "no_external_call":
        return { canAutoExecute: true, canWriteExternal: false, canRollout: false, canApprove: false };
      case "no_rollout":
        return { canAutoExecute: true, canWriteExternal: true, canRollout: false, canApprove: false };
      case "manual_only":
        return { canAutoExecute: false, canWriteExternal: true, canRollout: false, canApprove: true };
      case "incident_mode":
        return { canAutoExecute: false, canWriteExternal: false, canRollout: false, canApprove: true };
      default:
        return { canAutoExecute: false, canWriteExternal: false, canRollout: false, canApprove: false };
    }
  }

  const fullAutoMode = mapPolicyModeToUnifiedRuntimeMode("full-auto");
  const capabilities = getCapabilities(fullAutoMode);
  assert.strictEqual(capabilities.canAutoExecute, true);
  assert.strictEqual(capabilities.canWriteExternal, true);
  assert.strictEqual(capabilities.canRollout, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Mode with Traceability
// ─────────────────────────────────────────────────────────────────────────────

test("integration: mode changes can be tracked with evidence", () => {
  const modeChanges: Array<{ from: string; to: string; reason: string; timestamp: string }> = [];

  // Record mode change
  const fromMode = mapPolicyModeToUnifiedRuntimeMode("full-auto");
  const toMode = mapPolicyModeToUnifiedRuntimeMode("incident-mode");

  modeChanges.push({
    from: fromMode,
    to: toMode,
    reason: "SEV1 incident detected",
    timestamp: new Date().toISOString(),
  });

  assert.strictEqual(modeChanges[0].from, "full_auto");
  assert.strictEqual(modeChanges[0].to, "incident_mode");
  assert.ok(modeChanges[0].timestamp.includes("T"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Normalize and Convert with ID Generation
// ─────────────────────────────────────────────────────────────────────────────

test("integration: mode records include generated IDs", () => {
  const modeRecord = {
    id: newId("mode"),
    previousMode: normalizeUnifiedRuntimeMode("full-auto"),
    currentMode: normalizeUnifiedRuntimeMode("incident-mode"),
    changedAt: new Date().toISOString(),
    changedBy: "system",
  };

  assert.ok(modeRecord.id.startsWith("mode_"));
  assert.strictEqual(modeRecord.previousMode, "full_auto");
  assert.strictEqual(modeRecord.currentMode, "incident_mode");
});
