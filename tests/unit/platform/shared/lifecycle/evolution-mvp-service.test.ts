/**
 * Unit tests for evolution-mvp-service re-export.
 */

import test from "node:test";
import assert from "node:assert/strict";

// The file just re-exports from the ops-maturity drift detection module.
// Verify that the re-export is accessible.
import * as EvolutionMvpService from "../../../../../src/platform/shared/lifecycle/evolution-mvp-service.js";

test("evolution-mvp-service module exports are accessible", () => {
  // The module re-exports from ops-maturity/drift-detection/evolution-mvp-service
  // Verify the module is importable and has content
  assert.ok(EvolutionMvpService, "module should be importable");
  // Module should have at least one export
  const exportKeys = Object.keys(EvolutionMvpService);
  assert.ok(exportKeys.length > 0, "module should have exports");
});