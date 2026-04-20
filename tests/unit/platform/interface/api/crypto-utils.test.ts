import assert from "node:assert/strict";
import test from "node:test";

import {
  rsaAlgToNode,
  ecAlgToNode,
  hmacAlgToNode,
} from "../../../../../src/platform/interface/api/oidc-oauth/crypto-utils.js";

test("rsaAlgToNode returns RSA-SHA256 for RS256", () => {
  assert.equal(rsaAlgToNode("RS256"), "RSA-SHA256");
});

test("rsaAlgToNode returns RSA-SHA384 for RS384", () => {
  assert.equal(rsaAlgToNode("RS384"), "RSA-SHA384");
});

test("rsaAlgToNode returns RSA-SHA512 for RS512", () => {
  assert.equal(rsaAlgToNode("RS512"), "RSA-SHA512");
});

test("rsaAlgToNode returns default RSA-SHA256 for unknown algorithm", () => {
  assert.equal(rsaAlgToNode("unknown"), "RSA-SHA256");
  assert.equal(rsaAlgToNode(""), "RSA-SHA256");
});

test("ecAlgToNode returns SHA256 for ES256", () => {
  assert.equal(ecAlgToNode("ES256"), "SHA256");
});

test("ecAlgToNode returns SHA384 for ES384", () => {
  assert.equal(ecAlgToNode("ES384"), "SHA384");
});

test("ecAlgToNode returns SHA512 for ES512", () => {
  assert.equal(ecAlgToNode("ES512"), "SHA512");
});

test("ecAlgToNode returns default SHA256 for unknown algorithm", () => {
  assert.equal(ecAlgToNode("unknown"), "SHA256");
  assert.equal(ecAlgToNode(""), "SHA256");
});

test("hmacAlgToNode returns sha256 for HS256", () => {
  assert.equal(hmacAlgToNode("HS256"), "sha256");
});

test("hmacAlgToNode returns sha384 for HS384", () => {
  assert.equal(hmacAlgToNode("HS384"), "sha384");
});

test("hmacAlgToNode returns sha512 for HS512", () => {
  assert.equal(hmacAlgToNode("HS512"), "sha512");
});

test("hmacAlgToNode returns default sha256 for unknown algorithm", () => {
  assert.equal(hmacAlgToNode("unknown"), "sha256");
  assert.equal(hmacAlgToNode(""), "sha256");
});
