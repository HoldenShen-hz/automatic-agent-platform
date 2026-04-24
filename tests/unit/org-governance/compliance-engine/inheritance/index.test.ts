/**
 * Unit tests for Policy Inheritance
 */

import test from "node:test";
import { strict as assert } from "node:assert/strict";
import { inheritPolicyLayers, type PolicyLayer } from "../../../../../src/org-governance/compliance-engine/inheritance/index.js";

test("inheritPolicyLayers merges empty layers", () => {
  const result = inheritPolicyLayers([]);
  assert.deepStrictEqual(result, {});
});

test("inheritPolicyLayers merges single layer", () => {
  const layers: readonly PolicyLayer[] = [
    { policyId: "p1", rules: { allow: true, maxRetries: 5 } },
  ];

  const result = inheritPolicyLayers(layers);

  assert.deepStrictEqual(result, { allow: true, maxRetries: 5 });
});

test("inheritPolicyLayers merges two layers", () => {
  const layers: readonly PolicyLayer[] = [
    { policyId: "p1", rules: { allow: true, maxRetries: 5 } },
    { policyId: "p2", rules: { timeout: 30 } },
  ];

  const result = inheritPolicyLayers(layers);

  assert.deepStrictEqual(result, { allow: true, maxRetries: 5, timeout: 30 });
});

test("inheritPolicyLayers merges boolean rules with OR semantics", () => {
  const layers: readonly PolicyLayer[] = [
    { policyId: "p1", rules: { requireApproval: false } },
    { policyId: "p2", rules: { requireApproval: true } },
  ];

  const result = inheritPolicyLayers(layers);

  // OR semantics: false || true = true
  assert.strictEqual(result.requireApproval, true);
});

test("inheritPolicyLayers merges boolean rules when both false", () => {
  const layers: readonly PolicyLayer[] = [
    { policyId: "p1", rules: { requireApproval: false } },
    { policyId: "p2", rules: { requireApproval: false } },
  ];

  const result = inheritPolicyLayers(layers);

  assert.strictEqual(result.requireApproval, false);
});

test("inheritPolicyLayers merges boolean rules when both true", () => {
  const layers: readonly PolicyLayer[] = [
    { policyId: "p1", rules: { requireApproval: true } },
    { policyId: "p2", rules: { requireApproval: true } },
  ];

  const result = inheritPolicyLayers(layers);

  assert.strictEqual(result.requireApproval, true);
});

test("inheritPolicyLayers merges number rules with max semantics", () => {
  const layers: readonly PolicyLayer[] = [
    { policyId: "p1", rules: { maxRetries: 3 } },
    { policyId: "p2", rules: { maxRetries: 5 } },
  ];

  const result = inheritPolicyLayers(layers);

  assert.strictEqual(result.maxRetries, 5);
});

test("inheritPolicyLayers merges number rules when first is larger", () => {
  const layers: readonly PolicyLayer[] = [
    { policyId: "p1", rules: { maxRetries: 10 } },
    { policyId: "p2", rules: { maxRetries: 5 } },
  ];

  const result = inheritPolicyLayers(layers);

  assert.strictEqual(result.maxRetries, 10);
});

test("inheritPolicyLayers merges string rules with restricted priority", () => {
  const layers: readonly PolicyLayer[] = [
    { policyId: "p1", rules: { dataClassification: "internal" } },
    { policyId: "p2", rules: { dataClassification: "restricted" } },
  ];

  const result = inheritPolicyLayers(layers);

  assert.strictEqual(result.dataClassification, "restricted");
});

test("inheritPolicyLayers merges string rules when both non-empty and neither restricted", () => {
  const layers: readonly PolicyLayer[] = [
    { policyId: "p1", rules: { dataClassification: "internal" } },
    { policyId: "p2", rules: { dataClassification: "public" } },
  ];

  const result = inheritPolicyLayers(layers);

  // When neither is restricted, later value wins
  assert.strictEqual(result.dataClassification, "public");
});

test("inheritPolicyLayers merges string rules when first is restricted", () => {
  const layers: readonly PolicyLayer[] = [
    { policyId: "p1", rules: { dataClassification: "restricted" } },
    { policyId: "p2", rules: { dataClassification: "public" } },
  ];

  const result = inheritPolicyLayers(layers);

  // restricted takes priority
  assert.strictEqual(result.dataClassification, "restricted");
});

test("inheritPolicyLayers overwrites with non-boolean/number/string values", () => {
  const layers: readonly PolicyLayer[] = [
    { policyId: "p1", rules: { metadata: { a: 1 } } },
    { policyId: "p2", rules: { metadata: { b: 2 } } },
  ];

  const result = inheritPolicyLayers(layers);

  assert.deepStrictEqual(result.metadata, { b: 2 });
});

test("inheritPolicyLayers handles multiple layers", () => {
  const layers: readonly PolicyLayer[] = [
    { policyId: "p1", rules: { allow: false, maxRetries: 3 } },
    { policyId: "p2", rules: { requireApproval: true, maxRetries: 7 } },
    { policyId: "p3", rules: { allow: true, timeout: 60 } },
  ];

  const result = inheritPolicyLayers(layers);

  // allow: false || true = true
  assert.strictEqual(result.allow, true);
  // maxRetries: Math.max(3, 7) = 7
  assert.strictEqual(result.maxRetries, 7);
  // requireApproval: true
  assert.strictEqual(result.requireApproval, true);
  // timeout: 60
  assert.strictEqual(result.timeout, 60);
});

test("inheritPolicyLayers preserves keys from earlier layer when later layer has empty string", () => {
  const layers: readonly PolicyLayer[] = [
    { policyId: "p1", rules: { dataClassification: "internal" } },
    { policyId: "p2", rules: { dataClassification: "" } },
  ];

  const result = inheritPolicyLayers(layers);

  // Empty string is falsy but not undefined, so it would overwrite
  assert.strictEqual(result.dataClassification, "");
});
