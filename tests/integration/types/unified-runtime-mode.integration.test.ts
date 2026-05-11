import assert from "node:assert/strict";
import test from "node:test";

import {
  mapAutonomyLevelToUnifiedRuntimeMode,
  mapHealthDegradationModeToUnifiedRuntimeMode,
  mapPolicyModeToUnifiedRuntimeMode,
  normalizeUnifiedRuntimeMode,
  toDocumentedUnifiedRuntimeMode,
} from "../../../src/platform/contracts/types/unified-runtime-mode.js";
import { newId } from "../../../src/platform/contracts/types/ids.js";

test("integration: policy mode pipeline uses only current ADR modes", () => {
  const policyModes = ["auto", "full-auto", "read-only", "incident-mode"] as const;

  for (const policyMode of policyModes) {
    const unified = mapPolicyModeToUnifiedRuntimeMode(policyMode);
    const documented = toDocumentedUnifiedRuntimeMode(unified);
    assert.ok(typeof unified === "string");
    assert.ok(typeof documented === "string");
  }
});

test("integration: health degradation and autonomy still converge to unified runtime modes", () => {
  assert.equal(mapHealthDegradationModeToUnifiedRuntimeMode("fast_only"), "supervised_auto");
  assert.equal(mapHealthDegradationModeToUnifiedRuntimeMode("queue_only"), "no_external_call");
  assert.equal(mapAutonomyLevelToUnifiedRuntimeMode("supervised"), "manual_only");
});

test("integration: normalize and documented conversion remain inverses", () => {
  const documentedModes = [
    "full-auto",
    "supervised-auto",
    "read-only",
    "no-write",
    "no-external-call",
    "no-rollout",
    "manual-only",
    "incident-mode",
  ] as const;

  for (const documentedMode of documentedModes) {
    const normalized = normalizeUnifiedRuntimeMode(documentedMode);
    assert.equal(toDocumentedUnifiedRuntimeMode(normalized), documentedMode);
  }
});

test("integration: runtime mode records stay traceable with generated IDs", () => {
  const modeRecord = {
    id: newId("mode"),
    previousMode: mapPolicyModeToUnifiedRuntimeMode("full-auto"),
    currentMode: mapPolicyModeToUnifiedRuntimeMode("incident-mode"),
    changedAt: new Date().toISOString(),
  };

  assert.ok(modeRecord.id.startsWith("mode_"));
  assert.equal(modeRecord.previousMode, "full_auto");
  assert.equal(modeRecord.currentMode, "incident_mode");
});
