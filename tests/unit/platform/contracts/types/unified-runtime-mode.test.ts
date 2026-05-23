import assert from "node:assert/strict";
import test from "node:test";

import {
  type DocumentedUnifiedRuntimeMode,
  type UnifiedRuntimeMode,
  type HealthDegradationMode,
  type PolicyRuntimeMode,
  type InteractionAutonomyMode,
  mapPolicyModeToUnifiedRuntimeMode,
  mapHealthDegradationModeToUnifiedRuntimeMode,
  mapAutonomyLevelToUnifiedRuntimeMode,
  normalizeUnifiedRuntimeMode,
  toDocumentedUnifiedRuntimeMode,
} from "../../../../../src/platform/contracts/types/unified-runtime-mode.js";

// ---------------------------------------------------------------------------
// UnifiedRuntimeMode type
// ---------------------------------------------------------------------------

test("UnifiedRuntimeMode accepts full_auto", () => {
  const mode: UnifiedRuntimeMode = "full_auto";
  assert.equal(mode, "full_auto");
});

test("UnifiedRuntimeMode accepts supervised_auto", () => {
  const mode: UnifiedRuntimeMode = "supervised_auto";
  assert.equal(mode, "supervised_auto");
});

test("UnifiedRuntimeMode accepts read_only", () => {
  const mode: UnifiedRuntimeMode = "read_only";
  assert.equal(mode, "read_only");
});

test("UnifiedRuntimeMode accepts no_write", () => {
  const mode: UnifiedRuntimeMode = "no_write";
  assert.equal(mode, "no_write");
});

test("UnifiedRuntimeMode accepts no_external_call", () => {
  const mode: UnifiedRuntimeMode = "no_external_call";
  assert.equal(mode, "no_external_call");
});

test("UnifiedRuntimeMode accepts no_rollout", () => {
  const mode: UnifiedRuntimeMode = "no_rollout";
  assert.equal(mode, "no_rollout");
});

test("UnifiedRuntimeMode accepts manual_only", () => {
  const mode: UnifiedRuntimeMode = "manual_only";
  assert.equal(mode, "manual_only");
});

test("UnifiedRuntimeMode accepts incident_mode", () => {
  const mode: UnifiedRuntimeMode = "incident_mode";
  assert.equal(mode, "incident_mode");
});

test("DocumentedUnifiedRuntimeMode accepts hyphenated values", () => {
  const mode: DocumentedUnifiedRuntimeMode = "no-external-call";
  assert.equal(mode, "no-external-call");
});

// ---------------------------------------------------------------------------
// HealthDegradationMode type
// ---------------------------------------------------------------------------

test("HealthDegradationMode accepts none", () => {
  const mode: HealthDegradationMode = "none";
  assert.equal(mode, "none");
});

test("HealthDegradationMode accepts queue_only", () => {
  const mode: HealthDegradationMode = "queue_only";
  assert.equal(mode, "queue_only");
});

test("HealthDegradationMode accepts fast_only", () => {
  const mode: HealthDegradationMode = "fast_only";
  assert.equal(mode, "fast_only");
});

test("HealthDegradationMode accepts pause_non_critical", () => {
  const mode: HealthDegradationMode = "pause_non_critical";
  assert.equal(mode, "pause_non_critical");
});

test("HealthDegradationMode accepts read_only_operations_only", () => {
  const mode: HealthDegradationMode = "read_only_operations_only";
  assert.equal(mode, "read_only_operations_only");
});

// ---------------------------------------------------------------------------
// PolicyRuntimeMode type
// ---------------------------------------------------------------------------

test("PolicyRuntimeMode accepts all valid values", () => {
  const modes: PolicyRuntimeMode[] = [
    "auto",
    "full-auto",
    "read-only",
    "maintenance",
    "incident-mode",
    "degraded",
    "emergency",
  ];
  assert.equal(modes.length, 7);
});

// ---------------------------------------------------------------------------
// InteractionAutonomyMode type
// ---------------------------------------------------------------------------

test("InteractionAutonomyMode accepts all valid values", () => {
  const modes: InteractionAutonomyMode[] = [
    "suggestion",
    "supervised",
    "semi_auto",
    "full_auto",
    "frozen",
  ];
  assert.equal(modes.length, 5);
});

// ---------------------------------------------------------------------------
// mapPolicyModeToUnifiedRuntimeMode
// ---------------------------------------------------------------------------

test("mapPolicyModeToUnifiedRuntimeMode maps full-auto to full_auto", () => {
  const result = mapPolicyModeToUnifiedRuntimeMode("full-auto");
  assert.equal(result, "full_auto");
});

test("mapPolicyModeToUnifiedRuntimeMode maps auto to supervised_auto", () => {
  const result = mapPolicyModeToUnifiedRuntimeMode("auto");
  assert.equal(result, "supervised_auto");
});

test("mapPolicyModeToUnifiedRuntimeMode maps read-only to read_only", () => {
  const result = mapPolicyModeToUnifiedRuntimeMode("read-only");
  assert.equal(result, "read_only");
});

test("mapPolicyModeToUnifiedRuntimeMode maps maintenance to no_rollout", () => {
  const result = mapPolicyModeToUnifiedRuntimeMode("maintenance");
  assert.equal(result, "no_rollout");
});

test("mapPolicyModeToUnifiedRuntimeMode maps incident-mode to incident_mode", () => {
  const result = mapPolicyModeToUnifiedRuntimeMode("incident-mode");
  assert.equal(result, "incident_mode");
});

test("mapPolicyModeToUnifiedRuntimeMode maps degraded to no_external_call", () => {
  const result = mapPolicyModeToUnifiedRuntimeMode("degraded");
  assert.equal(result, "no_external_call");
});

test("mapPolicyModeToUnifiedRuntimeMode maps emergency to no_write", () => {
  const result = mapPolicyModeToUnifiedRuntimeMode("emergency");
  assert.equal(result, "no_write");
});

test("mapPolicyModeToUnifiedRuntimeMode falls back to manual_only for unknown values", () => {
  const result = mapPolicyModeToUnifiedRuntimeMode("unknown_value" as PolicyRuntimeMode);
  assert.equal(result, "manual_only");
});

// ---------------------------------------------------------------------------
// mapHealthDegradationModeToUnifiedRuntimeMode
// ---------------------------------------------------------------------------

test("mapHealthDegradationModeToUnifiedRuntimeMode maps none to full_auto", () => {
  const result = mapHealthDegradationModeToUnifiedRuntimeMode("none");
  assert.equal(result, "full_auto");
});

test("mapHealthDegradationModeToUnifiedRuntimeMode maps fast_only to supervised_auto", () => {
  const result = mapHealthDegradationModeToUnifiedRuntimeMode("fast_only");
  assert.equal(result, "supervised_auto");
});

test("mapHealthDegradationModeToUnifiedRuntimeMode maps queue_only to no_external_call", () => {
  const result = mapHealthDegradationModeToUnifiedRuntimeMode("queue_only");
  assert.equal(result, "no_external_call");
});

test("mapHealthDegradationModeToUnifiedRuntimeMode maps pause_non_critical to manual_only", () => {
  const result = mapHealthDegradationModeToUnifiedRuntimeMode("pause_non_critical");
  assert.equal(result, "manual_only");
});

test("mapHealthDegradationModeToUnifiedRuntimeMode maps read_only_operations_only to read_only", () => {
  const result = mapHealthDegradationModeToUnifiedRuntimeMode("read_only_operations_only");
  assert.equal(result, "read_only");
});

test("mapHealthDegradationModeToUnifiedRuntimeMode falls back to manual_only for unknown values", () => {
  const result = mapHealthDegradationModeToUnifiedRuntimeMode("unknown_mode" as HealthDegradationMode);
  assert.equal(result, "manual_only");
});

// ---------------------------------------------------------------------------
// mapAutonomyLevelToUnifiedRuntimeMode
// ---------------------------------------------------------------------------

test("mapAutonomyLevelToUnifiedRuntimeMode maps full_auto to full_auto", () => {
  const result = mapAutonomyLevelToUnifiedRuntimeMode("full_auto");
  assert.equal(result, "full_auto");
});

test("mapAutonomyLevelToUnifiedRuntimeMode maps semi_auto to supervised_auto", () => {
  const result = mapAutonomyLevelToUnifiedRuntimeMode("semi_auto");
  assert.equal(result, "supervised_auto");
});

test("mapAutonomyLevelToUnifiedRuntimeMode maps supervised to manual_only", () => {
  const result = mapAutonomyLevelToUnifiedRuntimeMode("supervised");
  assert.equal(result, "manual_only");
});

test("normalizeUnifiedRuntimeMode converts documented hyphenated values", () => {
  assert.equal(normalizeUnifiedRuntimeMode("no-write"), "no_write");
  assert.equal(normalizeUnifiedRuntimeMode("incident-mode"), "incident_mode");
});

test("toDocumentedUnifiedRuntimeMode converts internal underscore values", () => {
  assert.equal(toDocumentedUnifiedRuntimeMode("no_external_call"), "no-external-call");
  assert.equal(toDocumentedUnifiedRuntimeMode("manual_only"), "manual-only");
});

test("mapAutonomyLevelToUnifiedRuntimeMode maps suggestion to no_write", () => {
  const result = mapAutonomyLevelToUnifiedRuntimeMode("suggestion");
  assert.equal(result, "no_write");
});

test("mapAutonomyLevelToUnifiedRuntimeMode maps frozen to incident_mode", () => {
  const result = mapAutonomyLevelToUnifiedRuntimeMode("frozen");
  assert.equal(result, "incident_mode");
});

test("mapAutonomyLevelToUnifiedRuntimeMode falls back to manual_only for unknown values", () => {
  const result = mapAutonomyLevelToUnifiedRuntimeMode("unknown_level" as InteractionAutonomyMode);
  assert.equal(result, "manual_only");
});

// ---------------------------------------------------------------------------
// Cross-mode mapping consistency
// ---------------------------------------------------------------------------

test("full-auto policy mode and full_auto autonomy mode both map to full_auto", () => {
  const fromPolicy = mapPolicyModeToUnifiedRuntimeMode("full-auto");
  const fromAutonomy = mapAutonomyLevelToUnifiedRuntimeMode("full_auto");
  assert.equal(fromPolicy, "full_auto");
  assert.equal(fromAutonomy, "full_auto");
  assert.equal(fromPolicy, fromAutonomy);
});

test("emergency policy mode maps to no_write (same as suggestion autonomy)", () => {
  const fromPolicy = mapPolicyModeToUnifiedRuntimeMode("emergency");
  const fromAutonomy = mapAutonomyLevelToUnifiedRuntimeMode("suggestion");
  assert.equal(fromPolicy, "no_write");
  assert.equal(fromAutonomy, "no_write");
});

test("incident-mode policy and frozen autonomy both map to incident_mode", () => {
  const fromPolicy = mapPolicyModeToUnifiedRuntimeMode("incident-mode");
  const fromAutonomy = mapAutonomyLevelToUnifiedRuntimeMode("frozen");
  assert.equal(fromPolicy, "incident_mode");
  assert.equal(fromAutonomy, "incident_mode");
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test("maps can be called multiple times without side effects", () => {
  const result1 = mapPolicyModeToUnifiedRuntimeMode("auto");
  const result2 = mapPolicyModeToUnifiedRuntimeMode("auto");
  assert.equal(result1, result2);
});

test("health degradation none produces full_auto", () => {
  const result = mapHealthDegradationModeToUnifiedRuntimeMode("none");
  assert.equal(result, "full_auto");
});
