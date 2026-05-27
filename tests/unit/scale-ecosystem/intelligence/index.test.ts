/**
 * Tests for intelligence index - verifies barrel re-exports
 *
 * Tests that the intelligence index properly re-exports all expected modules.
 */

import assert from "node:assert/strict";
import test from "node:test";

// Import from the intelligence barrel
import * as Intelligence from "../../../../src/scale-ecosystem/intelligence/index.js";

test("Intelligence index exports PerceptionService [index]", () => {
  assert.ok(Intelligence.PerceptionService !== undefined);
});

test("Intelligence index exports PerceptionServiceAsync [index]", () => {
  assert.ok(Intelligence.PerceptionServiceAsync !== undefined);
});

test("Intelligence index exports PmfValidationService [index]", () => {
  assert.ok(Intelligence.PmfValidationService !== undefined);
});

test("Intelligence index exports buildMarkdownReport function [index]", () => {
  assert.ok(typeof Intelligence.buildMarkdownReport === "function");
});

test("Intelligence index exports buildSummary function [index]", () => {
  assert.ok(typeof Intelligence.buildSummary === "function");
});

test("Intelligence index exports calculatePercentile function [index]", () => {
  assert.ok(typeof Intelligence.calculatePercentile === "function");
});

test("Intelligence index exports DEFAULT_PMF_THRESHOLDS [index]", () => {
  assert.ok(Intelligence.DEFAULT_PMF_THRESHOLDS !== undefined);
  assert.ok(typeof Intelligence.DEFAULT_PMF_THRESHOLDS === "object");
});

test("Intelligence index exports validation utility functions [index]", () => {
  assert.ok(typeof Intelligence.validateDivisionId === "function");
  assert.ok(typeof Intelligence.validateProfileName === "function");
  assert.ok(typeof Intelligence.validateWindowDays === "function");
  assert.ok(typeof Intelligence.mergeThresholds === "function");
  assert.ok(typeof Intelligence.roundMetric === "function");
  assert.ok(typeof Intelligence.safeDividePercent === "function");
  assert.ok(typeof Intelligence.subtractDaysIso === "function");
});

test("Intelligence index exports are constructor functions for services [index]", () => {
  assert.equal(typeof Intelligence.PerceptionService, "function");
  assert.equal(typeof Intelligence.PerceptionServiceAsync, "function");
  assert.equal(typeof Intelligence.PmfValidationService, "function");
});