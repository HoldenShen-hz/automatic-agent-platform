import assert from "node:assert/strict";
import test from "node:test";

import {
  mapAutonomyLevelToUnifiedRuntimeMode,
  mapHealthDegradationModeToUnifiedRuntimeMode,
  mapPolicyModeToUnifiedRuntimeMode,
  normalizeUnifiedRuntimeMode,
  toDocumentedUnifiedRuntimeMode,
  type DocumentedUnifiedRuntimeMode,
  type UnifiedRuntimeMode,
} from "../../../src/platform/contracts/types/unified-runtime-mode.js";

test("mapPolicyModeToUnifiedRuntimeMode keeps only the current policy modes", () => {
  assert.equal(mapPolicyModeToUnifiedRuntimeMode("full-auto"), "full_auto");
  assert.equal(mapPolicyModeToUnifiedRuntimeMode("auto"), "supervised_auto");
  assert.equal(mapPolicyModeToUnifiedRuntimeMode("read-only"), "read_only");
  assert.equal(mapPolicyModeToUnifiedRuntimeMode("incident-mode"), "incident_mode");
});

test("mapHealthDegradationModeToUnifiedRuntimeMode still covers degradation ladders", () => {
  assert.equal(mapHealthDegradationModeToUnifiedRuntimeMode("none"), "full_auto");
  assert.equal(mapHealthDegradationModeToUnifiedRuntimeMode("queue_only"), "no_external_call");
  assert.equal(mapHealthDegradationModeToUnifiedRuntimeMode("pause_non_critical"), "manual_only");
  assert.equal(mapHealthDegradationModeToUnifiedRuntimeMode("read_only_operations_only"), "read_only");
});

test("mapAutonomyLevelToUnifiedRuntimeMode still maps interaction autonomy to runtime modes", () => {
  assert.equal(mapAutonomyLevelToUnifiedRuntimeMode("full_auto"), "full_auto");
  assert.equal(mapAutonomyLevelToUnifiedRuntimeMode("semi_auto"), "supervised_auto");
  assert.equal(mapAutonomyLevelToUnifiedRuntimeMode("suggestion"), "no_write");
  assert.equal(mapAutonomyLevelToUnifiedRuntimeMode("frozen"), "incident_mode");
});

test("normalizeUnifiedRuntimeMode and toDocumentedUnifiedRuntimeMode still round-trip", () => {
  const documentedModes: DocumentedUnifiedRuntimeMode[] = [
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
    const normalized = normalizeUnifiedRuntimeMode(documented);
    const roundTrip = toDocumentedUnifiedRuntimeMode(normalized);
    assert.equal(roundTrip, documented);
  }
});

test("underscore unified runtime modes pass through normalize unchanged", () => {
  const underscoreModes: UnifiedRuntimeMode[] = [
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
    assert.equal(normalizeUnifiedRuntimeMode(mode), mode);
  }
});
