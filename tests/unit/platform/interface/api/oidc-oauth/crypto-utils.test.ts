import assert from "node:assert/strict";
import test from "node:test";

import {
  rsaAlgToNode,
  ecAlgToNode,
  hmacAlgToNode,
} from "../../../../../src/platform/interface/api/oidc-oauth/crypto-utils.js";

// rsaAlgToNode tests

test("rsaAlgToNode returns RSA-SHA256 for RS256", () => {
  assert.equal(rsaAlgToNode("RS256"), "RSA-SHA256");
});

test("rsaAlgToNode returns RSA-SHA384 for RS384", () => {
  assert.equal(rsaAlgToNode("RS384"), "RSA-SHA384");
});

test("rsaAlgToNode returns RSA-SHA512 for RS512", () => {
  assert.equal(rsaAlgToNode("RS512"), "RSA-SHA512");
});

test("rsaAlgToNode returns RSA-SHA256 as default for unknown alg", () => {
  assert.equal(rsaAlgToNode("RS999"), "RSA-SHA256");
  assert.equal(rsaAlgToNode(""), "RSA-SHA256");
});

// ecAlgToNode tests

test("ecAlgToNode returns correct mapping for ES256", () => {
  assert.equal(ecAlgToNode("ES256"), "SHA256");
});

test("ecAlgToNode returns correct mapping for ES384", () => {
  assert.equal(ecAlgToNode("ES384"), "SHA384");
});

test("ecAlgToNode returns correct mapping for ES512", () => {
  assert.equal(ecAlgToNode("ES512"), "SHA512");
});

test("ecAlgToNode returns default for unknown alg", () => {
  assert.equal(ecAlgToNode("ES999"), "SHA256");
  assert.equal(ecAlgToNode(""), "SHA256");
});

// hmacAlgToNode tests

test("hmacAlgToNode returns correct mapping for HS256", () => {
  assert.equal(hmacAlgToNode("HS256"), "sha256");
});

test("hmacAlgToNode returns correct mapping for HS384", () => {
  assert.equal(hmacAlgToNode("HS384"), "sha384");
});

test("hmacAlgToNode returns correct mapping for HS512", () => {
  assert.equal(hmacAlgToNode("HS512"), "sha512");
});

test("hmacAlgToNode returns default for unknown alg", () => {
  assert.equal(hmacAlgToNode("HS999"), "sha256");
  assert.equal(hmacAlgToNode(""), "sha256");
});
