/**
 * Unit tests for OrgGovernance barrel exports
 *
 * @see src/org-governance/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import * as orgGovernance from "../../../src/org-governance/index.js";

test("org-governance barrel exports approval-routing", () => {
  const keys = Object.keys(orgGovernance);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("approval")),
    "should export approval routing"
  );
});

test("org-governance barrel exports compliance-engine", () => {
  const keys = Object.keys(orgGovernance);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("compliance")),
    "should export compliance engine"
  );
});

test("org-governance barrel exports delegated-governance", () => {
  const keys = Object.keys(orgGovernance);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("delegated") || k.toLowerCase().includes("governance")),
    "should export delegated governance"
  );
});

test("org-governance barrel exports knowledge-boundary", () => {
  const keys = Object.keys(orgGovernance);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("knowledge") || k.toLowerCase().includes("boundary")),
    "should export knowledge boundary"
  );
});

test("org-governance barrel exports org-model", () => {
  const keys = Object.keys(orgGovernance);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("orgmodel") || k.toLowerCase().includes("org")),
    "should export org-model"
  );
});

test("org-governance barrel exports sso-scim", () => {
  const keys = Object.keys(orgGovernance);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("sso") || k.toLowerCase().includes("scim")),
    "should export sso-scim"
  );
});

test("org-governance barrel exports governance-baseline-catalog", () => {
  const keys = Object.keys(orgGovernance);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("baselinecatalog") || k.toLowerCase().includes("catalog")),
    "should export governance-baseline-catalog"
  );
});

test("org-governance barrel exports governance-bootstrap", () => {
  const keys = Object.keys(orgGovernance);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("bootstrap")),
    "should export governance-bootstrap"
  );
});

test("org-governance barrel has multiple exports", () => {
  const keys = Object.keys(orgGovernance);
  assert.ok(keys.length > 5, "should have multiple exports from submodules");
});
