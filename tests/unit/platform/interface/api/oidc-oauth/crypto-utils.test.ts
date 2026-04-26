import assert from "node:assert/strict";
import test from "node:test";

import {
  rsaAlgToNode,
  ecAlgToNode,
  hmacAlgToNode,
} from "../../../../../src/platform/interface/api/oidc-oauth/crypto-utils.js";

test("rsaAlgToNode converts RS256", () => {
  assert.equal(rsaAlgToNode("RS256"), "RSA-SHA256");
});

test("rsaAlgToNode converts RS384", () => {
  assert.equal(rsaAlgToNode("RS384"), "RSA-SHA384");
});

test("rsaAlgToNode converts RS512", () => {
  assert.equal(rsaAlgToNode("RS512"), "RSA-SHA512");
});

test("rsaAlgToNode defaults to RSA-SHA256 for unknown algorithms", () => {
  assert.equal(rsaAlgToNode("RS999"), "RSA-SHA256");
  assert.equal(rsaAlgToNode(""), "RSA-SHA256");
});

test("ecAlgToNode converts ES256", () => {
  assert.equal(ecAlgToNode("ES256"), "SHA256");
});

test("ecAlgToNode converts ES384", () => {
  assert.equal(ecAlgToNode("ES384"), "SHA384");
});

test("ecAlgToNode converts ES512", () => {
  assert.equal(ecAlgToNode("ES512"), "SHA512");
});

test("ecAlgToNode defaults to SHA256 for unknown algorithms", () => {
  assert.equal(ecAlgToNode("ES999"), "SHA256");
  assert.equal(ecAlgToNode(""), "SHA256");
});

test("hmacAlgToNode converts HS256", () => {
  assert.equal(hmacAlgToNode("HS256"), "sha256");
});

test("hmacAlgToNode converts HS384", () => {
  assert.equal(hmacAlgToNode("HS384"), "sha384");
});

test("hmacAlgToNode converts HS512", () => {
  assert.equal(hmacAlgToNode("HS512"), "sha512");
});

test("hmacAlgToNode defaults to sha256 for unknown algorithms", () => {
  assert.equal(hmacAlgToNode("HS999"), "sha256");
  assert.equal(hmacAlgToNode(""), "sha256");
});
