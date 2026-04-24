import assert from "node:assert/strict";
import test from "node:test";

import * as fieldEncryption from "../../../../../src/platform/control-plane/iam/field-encryption.js";
import * as fileFreshness from "../../../../../src/platform/control-plane/iam/file-freshness.js";
import * as accessModel from "../../../../../src/platform/control-plane/iam/access-model.js";
import * as policyEngine from "../../../../../src/platform/control-plane/iam/policy-engine.js";

test("iam.fieldEncryption exports encryptField and decryptField", () => {
  assert.ok(typeof fieldEncryption.encryptField === "function");
  assert.ok(typeof fieldEncryption.decryptField === "function");
});

test("iam.fileFreshness exports FileFreshnessGuard class", () => {
  assert.ok(typeof fileFreshness.FileFreshnessGuard === "function");
  assert.ok(typeof fileFreshness.takeFileSnapshot === "function");
  assert.ok(typeof fileFreshness.checkFreshness === "function");
  assert.ok(typeof fileFreshness.computeFileDigest === "function");
});

test("iam.accessModel exports authorization functions", () => {
  assert.ok(typeof accessModel.listPlatformPrincipalTypes === "function");
  assert.ok(typeof accessModel.listPlatformRoles === "function");
  assert.ok(typeof accessModel.capabilitiesForRole === "function");
  assert.ok(typeof accessModel.roleGrantsCapabilities === "function");
  assert.ok(typeof accessModel.evaluateAuthorizationContext === "function");
});

test("iam.policyEngine exports PolicyEngine class", () => {
  assert.ok(typeof policyEngine.PolicyEngine === "function");
  assert.ok(typeof policyEngine.mapToolRiskToPolicyCategory === "function");
});

test("policyEngine.mapToolRiskToPolicyCategory maps critical to prod_affecting", () => {
  assert.equal(policyEngine.mapToolRiskToPolicyCategory("critical"), "prod_affecting");
});

test("policyEngine.mapToolRiskToPolicyCategory maps high to destructive", () => {
  assert.equal(policyEngine.mapToolRiskToPolicyCategory("high"), "destructive");
});

test("policyEngine.mapToolRiskToPolicyCategory maps medium to cost_sensitive", () => {
  assert.equal(policyEngine.mapToolRiskToPolicyCategory("medium"), "cost_sensitive");
});

test("policyEngine.mapToolRiskToPolicyCategory maps low/unknown to sensitive_data", () => {
  assert.equal(policyEngine.mapToolRiskToPolicyCategory("low"), "sensitive_data");
});
