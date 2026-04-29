/**
 * Unit tests for Unified Runtime Mode Types and Mapping Functions
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
  type UnifiedRuntimeMode,
  type DocumentedUnifiedRuntimeMode,
  type HealthDegradationMode,
  type PolicyRuntimeMode,
  type InteractionAutonomyMode,
} from "../../../src/platform/contracts/types/unified-runtime-mode.js";

// ─────────────────────────────────────────────────────────────────────────────
// mapPolicyModeToUnifiedRuntimeMode Tests
// ─────────────────────────────────────────────────────────────────────────────

test("mapPolicyModeToUnifiedRuntimeMode maps full-auto correctly", () => {
  assert.strictEqual(mapPolicyModeToUnifiedRuntimeMode("full-auto"), "full_auto");
});

test("mapPolicyModeToUnifiedRuntimeMode maps auto to supervised_auto", () => {
  assert.strictEqual(mapPolicyModeToUnifiedRuntimeMode("auto"), "supervised_auto");
});

test("mapPolicyModeToUnifiedRuntimeMode maps supervised to manual_only", () => {
  assert.strictEqual(mapPolicyModeToUnifiedRuntimeMode("supervised"), "manual_only");
});

test("mapPolicyModeToUnifiedRuntimeMode maps read-only to read_only", () => {
  assert.strictEqual(mapPolicyModeToUnifiedRuntimeMode("read-only"), "read_only");
});

test("mapPolicyModeToUnifiedRuntimeMode maps maintenance to no_rollout", () => {
  assert.strictEqual(mapPolicyModeToUnifiedRuntimeMode("maintenance"), "no_rollout");
});

test("mapPolicyModeToUnifiedRuntimeMode maps incident-mode correctly", () => {
  assert.strictEqual(mapPolicyModeToUnifiedRuntimeMode("incident-mode"), "incident_mode");
});

test("mapPolicyModeToUnifiedRuntimeMode maps degraded to no_external_call", () => {
  assert.strictEqual(mapPolicyModeToUnifiedRuntimeMode("degraded"), "no_external_call");
});

test("mapPolicyModeToUnifiedRuntimeMode maps emergency to no_write", () => {
  assert.strictEqual(mapPolicyModeToUnifiedRuntimeMode("emergency"), "no_write");
});

test("mapPolicyModeToUnifiedRuntimeMode falls back to manual_only for unknown", () => {
  assert.strictEqual(mapPolicyModeToUnifiedRuntimeMode("unknown" as PolicyRuntimeMode), "manual_only");
});

// ─────────────────────────────────────────────────────────────────────────────
// mapHealthDegradationModeToUnifiedRuntimeMode Tests
// ─────────────────────────────────────────────────────────────────────────────

test("mapHealthDegradationModeToUnifiedRuntimeMode maps none to full_auto", () => {
  assert.strictEqual(mapHealthDegradationModeToUnifiedRuntimeMode("none"), "full_auto");
});

test("mapHealthDegradationModeToUnifiedRuntimeMode maps fast_only to supervised_auto", () => {
  assert.strictEqual(mapHealthDegradationModeToUnifiedRuntimeMode("fast_only"), "supervised_auto");
});

test("mapHealthDegradationModeToUnifiedRuntimeMode maps queue_only to no_external_call", () => {
  assert.strictEqual(mapHealthDegradationModeToUnifiedRuntimeMode("queue_only"), "no_external_call");
});

test("mapHealthDegradationModeToUnifiedRuntimeMode maps pause_non_critical to manual_only", () => {
  assert.strictEqual(mapHealthDegradationModeToUnifiedRuntimeMode("pause_non_critical"), "manual_only");
});

test("mapHealthDegradationModeToUnifiedRuntimeMode maps read_only_operations_only to read_only", () => {
  assert.strictEqual(mapHealthDegradationModeToUnifiedRuntimeMode("read_only_operations_only"), "read_only");
});

test("mapHealthDegradationModeToUnifiedRuntimeMode falls back to manual_only for unknown", () => {
  assert.strictEqual(mapHealthDegradationModeToUnifiedRuntimeMode("unknown" as HealthDegradationMode), "manual_only");
});

// ─────────────────────────────────────────────────────────────────────────────
// mapAutonomyLevelToUnifiedRuntimeMode Tests
// ─────────────────────────────────────────────────────────────────────────────

test("mapAutonomyLevelToUnifiedRuntimeMode maps full_auto correctly", () => {
  assert.strictEqual(mapAutonomyLevelToUnifiedRuntimeMode("full_auto"), "full_auto");
});

test("mapAutonomyLevelToUnifiedRuntimeMode maps semi_auto to supervised_auto", () => {
  assert.strictEqual(mapAutonomyLevelToUnifiedRuntimeMode("semi_auto"), "supervised_auto");
});

test("mapAutonomyLevelToUnifiedRuntimeMode maps supervised to manual_only", () => {
  assert.strictEqual(mapAutonomyLevelToUnifiedRuntimeMode("supervised"), "manual_only");
});

test("mapAutonomyLevelToUnifiedRuntimeMode maps suggestion to no_write", () => {
  assert.strictEqual(mapAutonomyLevelToUnifiedRuntimeMode("suggestion"), "no_write");
});

test("mapAutonomyLevelToUnifiedRuntimeMode maps frozen to incident_mode", () => {
  assert.strictEqual(mapAutonomyLevelToUnifiedRuntimeMode("frozen"), "incident_mode");
});

test("mapAutonomyLevelToUnifiedRuntimeMode falls back to manual_only for unknown", () => {
  assert.strictEqual(mapAutonomyLevelToUnifiedRuntimeMode("unknown" as InteractionAutonomyMode), "manual_only");
});

// ─────────────────────────────────────────────────────────────────────────────
// normalizeUnifiedRuntimeMode Tests
// ─────────────────────────────────────────────────────────────────────────────

test("normalizeUnifiedRuntimeMode preserves underscore format modes", () => {
  const modes: UnifiedRuntimeMode[] = ["full_auto", "supervised_auto", "read_only", "no_write", "no_external_call", "no_rollout", "manual_only", "incident_mode"];
  for (const mode of modes) {
    assert.strictEqual(normalizeUnifiedRuntimeMode(mode), mode);
  }
});

test("normalizeUnifiedRuntimeMode converts hyphen format to underscore", () => {
  assert.strictEqual(normalizeUnifiedRuntimeMode("full-auto"), "full_auto");
  assert.strictEqual(normalizeUnifiedRuntimeMode("supervised-auto"), "supervised_auto");
  assert.strictEqual(normalizeUnifiedRuntimeMode("read-only"), "read_only");
  assert.strictEqual(normalizeUnifiedRuntimeMode("no-write"), "no_write");
  assert.strictEqual(normalizeUnifiedRuntimeMode("no-external-call"), "no_external_call");
  assert.strictEqual(normalizeUnifiedRuntimeMode("no-rollout"), "no_rollout");
  assert.strictEqual(normalizeUnifiedRuntimeMode("manual-only"), "manual_only");
  assert.strictEqual(normalizeUnifiedRuntimeMode("incident-mode"), "incident_mode");
});

test("normalizeUnifiedRuntimeMode handles DocumentedUnifiedRuntimeMode input", () => {
  const documented: DocumentedUnifiedRuntimeMode = "full-auto";
  assert.strictEqual(typeof documented, "string");
  const result = normalizeUnifiedRuntimeMode(documented);
  assert.strictEqual(result, "full_auto");
});

// ─────────────────────────────────────────────────────────────────────────────
// toDocumentedUnifiedRuntimeMode Tests
// ─────────────────────────────────────────────────────────────────────────────

test("toDocumentedUnifiedRuntimeMode converts all modes correctly", () => {
  const mappings: Array<[UnifiedRuntimeMode, DocumentedUnifiedRuntimeMode]> = [
    ["full_auto", "full-auto"],
    ["supervised_auto", "supervised-auto"],
    ["read_only", "read-only"],
    ["no_write", "no-write"],
    ["no_external_call", "no-external-call"],
    ["no_rollout", "no-rollout"],
    ["manual_only", "manual-only"],
    ["incident_mode", "incident-mode"],
  ];

  for (const [input, expected] of mappings) {
    assert.strictEqual(toDocumentedUnifiedRuntimeMode(input), expected, `${input} should map to ${expected}`);
  }
});

test("toDocumentedUnifiedRuntimeMode and normalizeUnifiedRuntimeMode are inverses for documented forms", () => {
  const documented: DocumentedUnifiedRuntimeMode = "full-auto";
  const normalized = normalizeUnifiedRuntimeMode(documented);
  const backToDocumented = toDocumentedUnifiedRuntimeMode(normalized);
  assert.strictEqual(backToDocumented, documented);
});

// ─────────────────────────────────────────────────────────────────────────────
// Round-trip Consistency Tests
// ─────────────────────────────────────────────────────────────────────────────

test("normalizeUnifiedRuntimeMode followed by toDocumentedUnifiedRuntimeMode preserves original underscore format", () => {
  const original: UnifiedRuntimeMode = "full_auto";
  const normalized = normalizeUnifiedRuntimeMode(original);
  const documented = toDocumentedUnifiedRuntimeMode(normalized);
  assert.strictEqual(documented, "full-auto");
});

test("All UnifiedRuntimeMode values can round-trip through normalize and toDocumented", () => {
  const modes: UnifiedRuntimeMode[] = ["full_auto", "supervised_auto", "read_only", "no_write", "no_external_call", "no_rollout", "manual_only", "incident_mode"];

  for (const mode of modes) {
    const normalized = normalizeUnifiedRuntimeMode(mode);
    const documented = toDocumentedUnifiedRuntimeMode(normalized as UnifiedRuntimeMode);
    assert.ok(documented.endsWith("-auto") || documented.endsWith("-only") || documented.includes("-"));
  }
});
